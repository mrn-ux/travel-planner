import { query as dbQuery } from '../../db.js';
import { fetchJson } from '../../http.js';
import { DAY_MS, type DestinationRef, type FetchResult, type KnowledgeSource } from './KnowledgeSource.js';

// Overpass API (OpenStreetMap data, ODbL). Public instances ask for: an identifying User-Agent, no parallel queries and a
// pause after a 429. Results are cached for 7 days. Instances are tried in order; a failure on all of them is
// "unavailable", never an invented list.
const INSTANCES = ['https://z.overpass-api.de/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
export const OVERPASS_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';
const RADIUS_M = 5000;

export interface Attraction {
  /** "node/123" */
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: string;
  openingHours: string | null;
  /** From the fee tag: yes, no, or null when not stated. */
  fee: 'yes' | 'no' | null;
  /** The raw charge tag when present, for example "EUR 12". */
  charge: string | null;
  wikidata: string | null;
  website: string | null;
  /** A Wikimedia Commons file name from the OSM `wikimedia_commons` tag, when the place has one. */
  commonsFile: string | null;
}

interface OverpassResponse {
  /** Set by Overpass when it gave up (out of memory, timed out): the elements are then partial or empty. */
  remark?: string;
  elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }>;
}

let lastRateLimitedAt = 0;

type AttractionResult = { ok: true; attractions: Attraction[]; fetchedAt: Date } | { ok: false; reason: 'timeout' | 'rate_limited' | 'http_error' | 'invalid_response' };

export async function fetchAttractions(lat: number, lon: number): Promise<AttractionResult> {
  const around = `(around:${RADIUS_M},${lat.toFixed(4)},${lon.toFixed(4)})`;
  const query =
    `[out:json][timeout:25];(` +
    `nwr["tourism"~"^(attraction|museum|gallery)$"]["name"]${around};` +
    `nwr["historic"~"^(castle|monument|palace|fort|ruins|archaeological_site|cathedral)$"]["name"]${around};` +
    `);out center tags 200;`;
  return runOverpass(query);
}

/**
 * Everything worth a visit in a wider area: around a city centre (15 km), or across a whole country (by its ISO code). Beyond the
 * classic attractions it covers viewpoints, waterfalls, beaches, parks and places of worship. Natural features, parks and places
 * of worship are kept only when they have a Wikidata entry (the notable ones, not every named bench).
 */
export async function fetchPlaces(scope: { lat: number; lon: number } | { countryCode: string }): Promise<AttractionResult> {
  const where = 'lat' in scope ? `(around:15000,${scope.lat.toFixed(4)},${scope.lon.toFixed(4)})` : '(area.c)';
  const sets = [
    `nwr["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium)$"]["name"]${where};`,
    `nwr["historic"~"^(castle|monument|palace|fort|ruins|archaeological_site|cathedral|memorial|temple|manor)$"]["name"]${where};`,
    `nwr["natural"~"^(waterfall|peak|beach|hot_spring|cave_entrance|bay)$"]["name"]["wikidata"]${where};`,
    `nwr["leisure"~"^(park|garden|nature_reserve)$"]["name"]["wikidata"]${where};`,
    `nwr["amenity"="place_of_worship"]["name"]["wikidata"]${where};`,
  ];
  const prefix = 'countryCode' in scope ? `area["ISO3166-1"="${scope.countryCode.replace(/[^A-Za-z]/g, '')}"]->.c;` : '';
  if (!('countryCode' in scope)) return runOverpass(`[out:json][timeout:60];(${sets.join('')});out center tags 500;`, 70000);
  // A whole country is listed from Wikidata (fetchCountryPlaces): the public map servers cannot scan a country quickly.
  return { ok: false, reason: 'http_error' };
}

/**
 * Map details for a few known places: named features within 150 m of each point that state opening hours or an entry fee. Used to add
 * hours and fees to places that came from a list without them (Wikidata states neither). A small query, so it answers quickly.
 */
export async function fetchDetailsNear(points: Array<{ lat: number; lon: number }>): Promise<Attraction[]> {
  if (points.length === 0) return [];
  const around = (p: { lat: number; lon: number }): string => `(around:150,${p.lat.toFixed(5)},${p.lon.toFixed(5)})`;
  const body = points.map((p) => `nwr["name"]["opening_hours"]${around(p)};nwr["name"]["fee"]${around(p)};`).join('');
  const r = await runOverpass(`[out:json][timeout:20];(${body});out center tags 300;`, 25000);
  return r.ok ? r.attractions : [];
}

async function runOverpass(query: string, timeoutMs = 30000): Promise<AttractionResult> {
  let failure: 'timeout' | 'rate_limited' | 'http_error' | 'invalid_response' = 'http_error';
  // After a 429 the public instances ask clients to wait 30 seconds: report "rate limited" instead of holding the request.
  if (Date.now() - lastRateLimitedAt < 30_000) return { ok: false, reason: 'rate_limited' };
  for (const host of INSTANCES) {
    const res = await fetchJson<OverpassResponse>(host, {
      provider: 'overpass',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      ttlMs: 7 * DAY_MS,
      timeoutMs,
      minSpacingMs: 1000,
    });
    if (res.ok && res.body.remark && /error|timed out|out of memory|runtime/i.test(res.body.remark)) {
      // A half answer is never kept: it is removed from the cache and the next instance is tried.
      await dbQuery("DELETE FROM http_cache WHERE body->>'remark' = $1", [res.body.remark]).catch(() => undefined);
      failure = 'timeout';
      continue;
    }
    if (res.ok && Array.isArray(res.body.elements)) {
      const seen = new Set<string>();
      const attractions: Attraction[] = [];
      for (const el of res.body.elements) {
        const tags = el.tags ?? {};
        const name = tags['name'];
        const la = el.lat ?? el.center?.lat;
        const lo = el.lon ?? el.center?.lon;
        if (!name || la === undefined || lo === undefined || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        const fee = tags['fee'] === 'yes' || tags['fee'] === 'no' ? tags['fee'] : null;
        attractions.push({
          id: `${el.type}/${el.id}`,
          name,
          lat: la,
          lon: lo,
          kind: tags['tourism'] ?? tags['historic'] ?? tags['natural'] ?? tags['leisure'] ?? tags['amenity'] ?? 'attraction',
          openingHours: tags['opening_hours'] ?? null,
          fee,
          charge: tags['charge'] ?? null,
          wikidata: tags['wikidata'] ?? null,
          website: tags['website'] ?? tags['contact:website'] ?? null,
          commonsFile: /^File:/i.test(tags['wikimedia_commons'] ?? '') ? (tags['wikimedia_commons'] as string).replace(/^File:/i, '') : null,
        });
      }
      return { ok: true, attractions, fetchedAt: res.fetchedAt };
    }
    if (!res.ok) {
      failure = res.reason === 'rate_limited' ? 'rate_limited' : res.reason === 'timeout' ? 'timeout' : res.reason === 'invalid_response' ? 'invalid_response' : 'http_error';
      if (res.reason === 'rate_limited') lastRateLimitedAt = Date.now();
    }
  }
  return { ok: false, reason: failure };
}

/** Attractions as short text documents (for citations and the knowledge base); the structured list is read with fetchAttractions. */
export class OverpassSource implements KnowledgeSource {
  readonly id = 'overpass';
  readonly licence = 'ODbL 1.0';
  readonly ttlMs = 7 * DAY_MS;

  async fetch(dest: DestinationRef): Promise<FetchResult> {
    if (dest.lat === null || dest.lon === null) return { ok: false, reason: 'not_found', detail: 'No coordinates' };
    const got = await fetchAttractions(dest.lat, dest.lon);
    if (!got.ok) return { ok: false, reason: got.reason === 'http_error' ? 'http_error' : got.reason };
    if (got.attractions.length === 0) return { ok: false, reason: 'not_found' };
    const lines = got.attractions
      .slice(0, 80)
      .map((a) => `${a.name} (${a.kind})${a.openingHours ? `; opening hours: ${a.openingHours}` : ''}${a.fee ? `; fee: ${a.fee}` : ''}`);
    return {
      ok: true,
      documents: [
        {
          title: `Attractions in ${dest.name} (OpenStreetMap)`,
          text: `Attractions near ${dest.name} from OpenStreetMap:\n${lines.join('\n')}`,
          source_url: 'https://www.openstreetmap.org/',
          attribution: OVERPASS_ATTRIBUTION,
          fetched_at: got.fetchedAt.toISOString(),
        },
      ],
    };
  }
}
