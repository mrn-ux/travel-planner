import { getConfig } from '../../config.js';
import { query } from '../../db.js';
import { fetchJson } from '../../http.js';
import type { ProviderResult } from '../types.js';
import type { GeocodeHit, MapsProvider } from './MapsProvider.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const SPACING_MS = 1100; // Nominatim policy: at most 1 request per second for the whole application

/** Lower-cased, trimmed, whitespace-collapsed query plus the country code. */
export function geocodeKey(q: string, countryCode?: string): string {
  return `${q.trim().toLowerCase().replace(/\s+/g, ' ')}|${(countryCode ?? '').toLowerCase()}`;
}

export class OsmMapsProvider implements MapsProvider {
  async geocode(q: string, countryCode?: string): Promise<ProviderResult<GeocodeHit>> {
    const key = geocodeKey(q, countryCode);
    const cached = await query<{ latitude: number | null; longitude: number | null; display_name: string | null; found: boolean; source_url: string; fetched_at: Date }>(
      'SELECT latitude, longitude, display_name, found, source_url, fetched_at FROM geocode_cache WHERE query_key = $1',
      [key],
    );
    const row = cached.rows[0];
    if (row) {
      const provenance = { source: 'nominatim', source_url: row.source_url, fetched_at: row.fetched_at.toISOString(), certainty: 'confirmed' as const };
      if (!row.found || row.latitude === null || row.longitude === null) return { ok: false, reason: 'not_found' };
      return { ok: true, data: { lat: row.latitude, lon: row.longitude, displayName: row.display_name ?? q }, provenance };
    }

    const params = new URLSearchParams({ q, format: 'jsonv2', limit: '1' });
    if (countryCode) params.set('countrycodes', countryCode.toLowerCase());
    const url = `${NOMINATIM}?${params.toString()}`;
    const res = await fetchJson<Array<{ lat: string; lon: string; display_name: string; boundingbox?: string[] }>>(url, {
      provider: 'nominatim',
      ttlMs: 0, // results are cached in geocode_cache below
      timeoutMs: 10000,
      minSpacingMs: SPACING_MS,
      headers: { 'User-Agent': getConfig().dataUserAgent },
    });
    if (!res.ok) return { ok: false, reason: res.reason === 'network' ? 'http_error' : res.reason, detail: res.detail };

    const hit = Array.isArray(res.body) ? res.body[0] : undefined;
    const lat = hit ? Number(hit.lat) : NaN;
    const lon = hit ? Number(hit.lon) : NaN;
    const found = Number.isFinite(lat) && Number.isFinite(lon);
    // A "nothing found" answer is cached too, so a bad address does not spend the 1 request per second again.
    await query(
      `INSERT INTO geocode_cache (query_key, latitude, longitude, display_name, bounding_box, found, source_url, fetched_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, now()) ON CONFLICT (query_key) DO NOTHING`,
      [key, found ? lat : null, found ? lon : null, hit?.display_name ?? null, hit?.boundingbox ? JSON.stringify(hit.boundingbox) : null, found, url],
    );
    if (!found || !hit) return { ok: false, reason: 'not_found' };
    return { ok: true, data: { lat, lon, displayName: hit.display_name }, provenance: { source: 'nominatim', source_url: url, fetched_at: res.fetchedAt.toISOString(), certainty: 'confirmed' } };
  }

  tileConfig() {
    return { urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors', maxZoom: 19 };
  }
}
