import { z } from 'zod';
import { unavailable, wrap, type ToolResult } from '../agent/envelope.js';
import { registerTool } from '../agent/registry.js';
import { resolveDestination, getClimate, getForecast, monthName, OPEN_METEO_ATTRIBUTION } from '../providers/knowledge/OpenMeteo.js';
import { DAY_MS } from '../providers/knowledge/KnowledgeSource.js';

const schema = z.object({
  destination: z.string().min(1).max(120),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type WeatherData =
  | { kind: 'forecast'; destination: string; days: Array<{ date: string; minC: number | null; maxC: number | null; precipMm: number | null }> }
  | { kind: 'climate'; destination: string; month: string; meanTempC: number; rainDays: number; precipMm: number; basis: string };

export async function runGetWeather(args: z.infer<typeof schema>): Promise<ToolResult<WeatherData>> {
  const dest = await resolveDestination(args.destination);
  if (!dest || dest.lat === null || dest.lon === null) return unavailable('open-meteo', `Could not find the place "${args.destination}".`);

  const startMs = args.start ? Date.parse(`${args.start}T00:00:00Z`) : NaN;
  const daysAhead = Number.isNaN(startMs) ? NaN : Math.floor((startMs - Date.now()) / DAY_MS);

  // A forecast only exists for the next 16 days; for later dates the honest answer is last year's climate, as an estimate.
  if (!Number.isNaN(daysAhead) && daysAhead <= 15) {
    const f = await getForecast(dest.lat, dest.lon, 16);
    if (!f.ok) return unavailable('open-meteo', 'The weather forecast is unavailable right now.');
    const days = f.body.days.filter((d) => (!args.start || d.date >= args.start) && (!args.end || d.date <= args.end)).slice(0, 14);
    if (days.length > 0) {
      return wrap<WeatherData>(
        { kind: 'forecast', destination: dest.name, days },
        { source: 'open-meteo', source_url: 'https://open-meteo.com/', fetched_at: f.body.fetchedAt, certainty: 'confirmed', note: OPEN_METEO_ATTRIBUTION },
      );
    }
  }

  const c = await getClimate(dest.lat, dest.lon);
  if (!c.ok) return unavailable('open-meteo', 'Climate data is unavailable right now.');
  const month = !Number.isNaN(startMs) ? new Date(startMs).getUTCMonth() + 1 : new Date().getUTCMonth() + 1;
  const m = c.body.months.find((x) => x.month === month);
  if (!m) return unavailable('open-meteo', 'No climate data for that month.');
  return wrap<WeatherData>(
    { kind: 'climate', destination: dest.name, month: monthName(month), meanTempC: m.meanTempC, rainDays: m.rainDays, precipMm: m.precipMm, basis: `${c.body.year} reanalysis data` },
    { source: 'open-meteo', source_url: c.body.sourceUrl, fetched_at: c.body.fetchedAt, certainty: 'estimated', note: `A typical-year estimate, not a forecast. ${OPEN_METEO_ATTRIBUTION}` },
  );
}

export function registerGetWeather(): void {
  registerTool({
    name: 'get_weather',
    description: 'Weather for a destination: a daily forecast when the dates are within 16 days, otherwise typical monthly climate (labelled as an estimate).',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        start: { type: 'string', description: 'First day, YYYY-MM-DD.' },
        end: { type: 'string', description: 'Last day, YYYY-MM-DD.' },
      },
      required: ['destination'],
    },
    schema,
    chatCallable: true,
    handler: async (args) => runGetWeather(schema.parse(args)),
    toCard: (r) => {
      const d = r.data as WeatherData | null;
      if (!d) return null;
      const lines =
        d.kind === 'forecast'
          ? d.days.slice(0, 5).map((x) => `${x.date}: ${x.minC ?? 'n/a'} to ${x.maxC ?? 'n/a'} °C, ${x.precipMm ?? 'n/a'} mm rain`)
          : [`${d.month}: about ${d.meanTempC.toFixed(1)} °C on average, ${d.rainDays} rainy days, ${Math.round(d.precipMm)} mm of rain`];
      return { title: `Weather in ${d.destination}`, lines, certainty: r.certainty, source: r.source, source_url: r.source_url, fetched_at: r.fetched_at };
    },
  });
}
