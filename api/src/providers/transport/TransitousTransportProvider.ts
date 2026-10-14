import { fetchJson } from '../../http.js';
import type { Provenance, ProviderResult } from '../types.js';
import { osrmMatrix, osrmRoadTime } from './OsrmClient.js';
import type { Place, TransportMode, TransportOption, TransportProvider } from './TransportProvider.js';
import type { LatLon } from '../types.js';

// Transitous (MOTIS) public API: open timetable data, non-commercial and light use, attribution to
// https://transitous.org/sources/. The plan endpoint is v6 and geocode v1 (checked against the live server).
const BASE = 'https://api.transitous.org/api';
const PLAN_VERSION = 'v6';
const GEOCODE_VERSION = 'v1';
const SOURCES_URL = 'https://transitous.org/sources/';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const RAIL = new Set(['RAIL', 'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_RAIL', 'REGIONAL_FAST_RAIL', 'SUBURBAN']);

/** Map a MOTIS leg mode onto the traveler-facing modes. Walking and unknown modes have none. */
export function modeOf(motisMode: string): TransportMode | null {
  if (RAIL.has(motisMode)) return 'train';
  if (motisMode === 'BUS' || motisMode === 'COACH') return 'bus';
  if (motisMode === 'FERRY') return 'ferry';
  if (motisMode === 'SUBWAY') return 'metro';
  if (motisMode === 'TRAM' || motisMode === 'METRO' || motisMode === 'CABLE_CAR' || motisMode === 'FUNICULAR') return 'transit';
  return null;
}

export class TransitousTransportProvider implements TransportProvider {
  private prov(url: string, fetchedAt: Date): Provenance {
    return { source: 'transitous', source_url: SOURCES_URL, fetched_at: fetchedAt.toISOString(), certainty: 'confirmed' };
  }

  async geocode(text: string): Promise<ProviderResult<Place[]>> {
    const url = `${BASE}/${GEOCODE_VERSION}/geocode?text=${encodeURIComponent(text)}`;
    const res = await fetchJson<unknown>(url, { provider: 'transitous', ttlMs: 24 * 3_600_000, timeoutMs: 10000, minSpacingMs: 300 });
    if (!res.ok) return { ok: false, reason: res.reason === 'network' ? 'http_error' : res.reason, detail: res.detail };
    const places: Place[] = arr(res.body).flatMap((raw) => {
      const p = obj(raw);
      const name = str(p['name']);
      const lat = num(p['lat']);
      const lon = num(p['lon']);
      return name && lat !== null && lon !== null ? [{ name, lat, lon, countryCode: str(p['country']) }] : [];
    });
    return { ok: true, data: places.slice(0, 5), provenance: this.prov(url, res.fetchedAt) };
  }

  async searchTransport(q: { from: Place; to: Place; date: string }): Promise<ProviderResult<TransportOption[]>> {
    const params = new URLSearchParams({
      fromPlace: `${q.from.lat},${q.from.lon}`,
      toPlace: `${q.to.lat},${q.to.lon}`,
      time: `${q.date}T06:00:00Z`,
      numItineraries: '12',
    });
    const url = `${BASE}/${PLAN_VERSION}/plan?${params.toString()}`;
    const res = await fetchJson<unknown>(url, { provider: 'transitous', ttlMs: 10 * 60_000, timeoutMs: 25000, minSpacingMs: 300 });
    if (!res.ok) return { ok: false, reason: res.reason === 'network' ? 'http_error' : res.reason, detail: res.detail };

    const options: TransportOption[] = [];
    for (const raw of arr(obj(res.body)['itineraries'])) {
      const it = obj(raw);
      const legs = arr(it['legs']).map(obj);
      const start = str(it['startTime']);
      const end = str(it['endTime']);
      const duration = num(it['duration']);
      if (!start || !end || duration === null) continue;

      // The main leg is the longest one that is not walking.
      const main = legs.filter((l) => str(l['mode']) !== 'WALK').sort((a, b) => (num(b['duration']) ?? 0) - (num(a['duration']) ?? 0))[0];
      const mode = main ? modeOf(str(main['mode']) ?? '') : null;
      if (!main || !mode) continue;

      // Some feeds put a stop-code pair like "FRPNO -> BEBMI" in the short name: not a line name, so it is dropped.
      const shortName = str(main['routeShortName']);
      const route = shortName && !shortName.includes('->') ? shortName : '';
      options.push({
        key: str(it['id'])?.slice(-24) ?? `${start}-${mode}`,
        mode,
        operator: [str(main['agencyName']), route].filter(Boolean).join(' ') || null,
        departure: start,
        arrival: end,
        departureTz: str(obj(legs[0]?.['from'])['tz']),
        arrivalTz: str(obj(legs[legs.length - 1]?.['to'])['tz']),
        durationMinutes: Math.round(duration / 60),
        transfers: num(it['transfers']) ?? 0,
        fare: null, // no feed in the public instance publishes a fare product in the plan response yet
      });
    }
    return { ok: true, data: options, provenance: this.prov(url, res.fetchedAt) };
  }

  roadTime(from: LatLon, to: LatLon) {
    return osrmRoadTime(from, to);
  }

  roadMatrix(points: LatLon[]) {
    return osrmMatrix(points);
  }
}
