import { fetchJson, type FetchResult as HttpResult } from '../../http.js';
import { DAY_MS, HOUR_MS, countryNameFromCode, destinationKey, type DestinationRef } from './KnowledgeSource.js';

// Open-Meteo: free API, non-commercial use only, CC BY 4.0. Limits: 600/min, 5,000/hour, 10,000/day.
const GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';

export const OPEN_METEO_ATTRIBUTION = 'Weather data by Open-Meteo.com (CC BY 4.0)';
export const OPEN_METEO_URL = 'https://open-meteo.com/';

export interface GeocodeHit {
  name: string;
  countryCode: string;
  countryName: string;
  lat: number;
  lon: number;
}

/** Resolve a place name to coordinates and country with Open-Meteo's geocoding API (cached 30 days). */
export async function geocodePlace(name: string): Promise<HttpResult<GeocodeHit>> {
  const url = `${GEOCODING}?name=${encodeURIComponent(name)}&count=1&language=en`;
  const res = await fetchJson<{
    results?: Array<{ name: string; country_code?: string; country?: string; latitude: number; longitude: number }>;
  }>(url, { provider: 'open-meteo', ttlMs: 30 * DAY_MS, timeoutMs: 8000 });
  if (!res.ok) return res;
  const hit = res.body.results?.[0];
  if (!hit || !hit.country_code) return { ok: false, reason: 'invalid_response', detail: 'Place not found' };
  return {
    ok: true,
    status: res.status,
    cached: res.cached,
    fetchedAt: res.fetchedAt,
    body: { name: hit.name, countryCode: hit.country_code, countryName: countryNameFromCode(hit.country_code) ?? hit.country ?? hit.country_code, lat: hit.latitude, lon: hit.longitude },
  };
}

/** Turn a free-text destination into a DestinationRef (name, country, coordinates). */
// Formal country names (as the hotel and ISO lists write them) that place search does not know, with the name it does.
const PLACE_ALIASES: Record<string, string> = {
  'czech republic': 'Czechia',
  'viet nam': 'Vietnam',
  swaziland: 'Eswatini',
  "lao people's democratic republic": 'Laos',
  'holy see (vatican city state)': 'Vatican City',
  "côte d'ivoire": 'Ivory Coast',
  'falkland islands (malvinas)': 'Falkland Islands',
  'saint martin (french part)': 'Saint-Martin',
  'sint maarten (dutch part)': 'Sint Maarten',
  'svalbard and jan mayen': 'Svalbard',
  'heard island and mcdonald islands': 'Heard Island',
  'western sahara': 'Laayoune',
  'american samoa': 'Pago Pago',
  'marshall islands': 'Majuro',
  fiji: 'Suva',
  antarctica: 'McMurdo Station',
};

/** The spellings to try for a place, best first: as typed, an alias, without brackets, the part before a comma. */
function placeSpellings(text: string): string[] {
  const raw = text.trim();
  const first = raw.split(',')[0]?.trim() || raw;
  const out = [first];
  const alias = PLACE_ALIASES[raw.toLowerCase()] ?? PLACE_ALIASES[first.toLowerCase()];
  if (alias) out.push(alias);
  const noBrackets = first.replace(/\s*\([^)]*\)/g, '').trim();
  if (noBrackets && noBrackets !== first) out.push(noBrackets);
  return [...new Set(out)];
}

export async function resolveDestination(text: string): Promise<DestinationRef | null> {
  for (const spelling of placeSpellings(text)) {
    const hit = await geocodePlace(spelling);
    if (!hit.ok) continue;
    const b = hit.body;
    return { key: destinationKey(b.name, b.countryCode), name: b.name, countryCode: b.countryCode, countryName: b.countryName, lat: b.lat, lon: b.lon };
  }
  return null;
}

export interface MonthClimate {
  month: number; // 1-12
  meanTempC: number;
  rainDays: number;
  precipMm: number;
}

export interface ClimateNormals {
  year: number;
  months: MonthClimate[];
  fetchedAt: Date;
  sourceUrl: string;
}

/**
 * Monthly means from the ERA5 archive for the last full calendar year at the coordinates (cached 30 days).
 * Pass `month` (1-12) to fetch just that month: a much smaller and faster request for ranking many destinations.
 */
export async function getClimate(lat: number, lon: number, month?: number): Promise<HttpResult<ClimateNormals>> {
  const year = new Date().getUTCFullYear() - 1;
  const first = month ? `${year}-${String(month).padStart(2, '0')}-01` : `${year}-01-01`;
  const last = month ? new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) : `${year}-12-31`;
  const url =
    `${ARCHIVE}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start_date=${first}&end_date=${last}` +
    '&daily=temperature_2m_mean,precipitation_sum&timezone=auto';
  const res = await fetchJson<{ daily?: { time: string[]; temperature_2m_mean: Array<number | null>; precipitation_sum: Array<number | null> } }>(url, {
    provider: 'open-meteo',
    ttlMs: 30 * DAY_MS,
    timeoutMs: 15000,
  });
  if (!res.ok) return res;
  const d = res.body.daily;
  if (!d || !Array.isArray(d.time)) return { ok: false, reason: 'invalid_response', detail: 'No daily data' };

  const sums = Array.from({ length: 12 }, () => ({ temp: 0, tempN: 0, rainDays: 0, precip: 0 }));
  d.time.forEach((day, i) => {
    const m = Number(day.slice(5, 7)) - 1;
    const bucket = sums[m];
    if (!bucket) return;
    const t = d.temperature_2m_mean[i];
    const p = d.precipitation_sum[i];
    if (typeof t === 'number') {
      bucket.temp += t;
      bucket.tempN += 1;
    }
    if (typeof p === 'number') {
      bucket.precip += p;
      if (p >= 1) bucket.rainDays += 1;
    }
  });
  const months: MonthClimate[] = sums
    .map((b, i) => ({ month: i + 1, meanTempC: b.tempN > 0 ? b.temp / b.tempN : Number.NaN, rainDays: b.rainDays, precipMm: b.precip }))
    .filter((m) => Number.isFinite(m.meanTempC));
  if (months.length === 0) return { ok: false, reason: 'invalid_response', detail: 'No usable months' };
  return { ok: true, status: res.status, cached: res.cached, fetchedAt: res.fetchedAt, body: { year, months, fetchedAt: res.fetchedAt, sourceUrl: url } };
}

export interface ForecastDay {
  date: string;
  maxC: number | null;
  minC: number | null;
  precipMm: number | null;
}

export interface Forecast {
  days: ForecastDay[];
  fetchedAt: Date;
  sourceUrl: string;
}

/** Up to 16 days of forecast (cached 1 hour in the HTTP cache; the knowledge-base copy lives 6 hours). */
export async function getForecast(lat: number, lon: number, days = 7): Promise<HttpResult<Forecast>> {
  const url =
    `${FORECAST}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=${Math.min(16, Math.max(1, days))}`;
  const res = await fetchJson<{
    daily?: { time: string[]; temperature_2m_max: Array<number | null>; temperature_2m_min: Array<number | null>; precipitation_sum: Array<number | null> };
  }>(url, { provider: 'open-meteo', ttlMs: HOUR_MS, timeoutMs: 10000 });
  if (!res.ok) return res;
  const d = res.body.daily;
  if (!d || !Array.isArray(d.time)) return { ok: false, reason: 'invalid_response', detail: 'No daily data' };
  const out: ForecastDay[] = d.time.map((date, i) => ({
    date,
    maxC: d.temperature_2m_max[i] ?? null,
    minC: d.temperature_2m_min[i] ?? null,
    precipMm: d.precipitation_sum[i] ?? null,
  }));
  return { ok: true, status: res.status, cached: res.cached, fetchedAt: res.fetchedAt, body: { days: out, fetchedAt: res.fetchedAt, sourceUrl: url } };
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (m: number): string => MONTH_NAMES[m - 1] ?? '';
