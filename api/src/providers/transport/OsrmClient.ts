import { fetchJson } from '../../http.js';
import type { LatLon, ProviderResult } from '../types.js';

// Public OSRM demo server: non-commercial, at most 1 request per second, driving profile only.
const BASE = 'https://router.project-osrm.org/route/v1/driving';

export async function osrmRoadTime(from: LatLon, to: LatLon): Promise<ProviderResult<{ minutes: number; km: string }>> {
  const url = `${BASE}/${from.lon.toFixed(5)},${from.lat.toFixed(5)};${to.lon.toFixed(5)},${to.lat.toFixed(5)}?overview=false`;
  const res = await fetchJson<{ code?: string; routes?: Array<{ duration: number; distance: number }> }>(url, {
    provider: 'osrm',
    ttlMs: 24 * 3_600_000,
    timeoutMs: 10000,
    minSpacingMs: 1000,
  });
  if (!res.ok) return { ok: false, reason: res.reason === 'network' ? 'http_error' : res.reason, detail: res.detail };
  const route = res.body.routes?.[0];
  if (res.body.code !== 'Ok' || !route) return { ok: false, reason: 'not_found' };
  return {
    ok: true,
    data: { minutes: Math.max(1, Math.round(route.duration / 60)), km: (route.distance / 1000).toFixed(1) },
    provenance: { source: 'osrm', source_url: 'https://project-osrm.org/', fetched_at: res.fetchedAt.toISOString(), certainty: 'estimated' },
  };
}

/** One request for a whole duration matrix (the demo server allows up to 100 points). Minutes, rounded up. */
export async function osrmMatrix(points: LatLon[]): Promise<ProviderResult<Array<Array<number | null>>>> {
  if (points.length < 2 || points.length > 100) return { ok: false, reason: 'invalid_response', detail: 'Between 2 and 100 points' };
  const coords = points.map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration`;
  const res = await fetchJson<{ code?: string; durations?: Array<Array<number | null>> }>(url, { provider: 'osrm', ttlMs: 24 * 3_600_000, timeoutMs: 20000, minSpacingMs: 1000 });
  if (!res.ok) return { ok: false, reason: res.reason === 'network' ? 'http_error' : res.reason, detail: res.detail };
  if (res.body.code !== 'Ok' || !Array.isArray(res.body.durations)) return { ok: false, reason: 'invalid_response' };
  return {
    ok: true,
    data: res.body.durations.map((row) => row.map((s) => (typeof s === 'number' ? Math.ceil(s / 60) : null))),
    provenance: { source: 'osrm', source_url: 'https://project-osrm.org/', fetched_at: res.fetchedAt.toISOString(), certainty: 'estimated' },
  };
}
