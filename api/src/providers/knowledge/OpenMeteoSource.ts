import { DAY_MS, HOUR_MS, type DestinationRef, type FetchResult, type KnowledgeSource, type SourceDocument } from './KnowledgeSource.js';
import { OPEN_METEO_ATTRIBUTION, getClimate, getForecast, monthName } from './OpenMeteo.js';

const round = (n: number, d = 1): string => n.toFixed(d);

/** Forecast (6 hours) and climate normals (30 days) as short text documents. CC BY 4.0, non-commercial free tier. */
export class OpenMeteoSource implements KnowledgeSource {
  readonly id = 'open-meteo';
  readonly licence = 'CC BY 4.0 (Open-Meteo free API: non-commercial use only)';
  // Default lifetime; each document sets its own (forecast 6 hours, climate 30 days).
  readonly ttlMs = 6 * HOUR_MS;

  async fetch(dest: DestinationRef): Promise<FetchResult> {
    if (dest.lat === null || dest.lon === null) return { ok: false, reason: 'not_found', detail: 'No coordinates' };
    const [forecast, climate] = await Promise.all([getForecast(dest.lat, dest.lon, 7), getClimate(dest.lat, dest.lon)]);
    const documents: SourceDocument[] = [];

    if (forecast.ok) {
      const lines = forecast.body.days.map(
        (d) => `${d.date}: ${d.minC ?? 'n/a'} to ${d.maxC ?? 'n/a'} degrees C, precipitation ${d.precipMm ?? 'n/a'} mm`,
      );
      documents.push({
        title: `Weather forecast for ${dest.name}`,
        text: `Seven day forecast for ${dest.name} (fetched ${forecast.body.fetchedAt.toISOString().slice(0, 10)}):\n${lines.join('\n')}`,
        source_url: forecast.body.sourceUrl,
        attribution: OPEN_METEO_ATTRIBUTION,
        fetched_at: forecast.body.fetchedAt.toISOString(),
        ttlMs: 6 * HOUR_MS,
      });
    }
    if (climate.ok) {
      const lines = climate.body.months.map(
        (m) => `${monthName(m.month)}: mean ${round(m.meanTempC)} degrees C, ${m.rainDays} rainy days, ${round(m.precipMm, 0)} mm precipitation`,
      );
      documents.push({
        title: `Climate of ${dest.name}`,
        text: `Monthly climate at ${dest.name} from ${climate.body.year} reanalysis data (an estimate of a typical year, not a forecast):\n${lines.join('\n')}`,
        source_url: climate.body.sourceUrl,
        attribution: OPEN_METEO_ATTRIBUTION,
        fetched_at: climate.body.fetchedAt.toISOString(),
        ttlMs: 30 * DAY_MS,
      });
    }
    if (documents.length === 0) {
      const failure = !forecast.ok ? forecast : climate;
      return { ok: false, reason: failure.ok ? 'invalid_response' : failure.reason, detail: failure.ok ? undefined : failure.detail };
    }
    return { ok: true, documents };
  }
}

