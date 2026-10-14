import { fetchJson } from '../../http.js';
import { DAY_MS } from './KnowledgeSource.js';
import type { Attraction } from './OverpassSource.js';

// The best-known places of a whole country, from Wikidata (CC0): items that are tourist attractions, ranked by how many Wikipedia
// language editions have an article about them (a good sign of fame). One small query; the public query service is sometimes busy, and
// then the traveler is told so (never an invented list). Cached for 7 days.

interface Row {
  item: { value: string };
  itemLabel?: { value: string };
  coord?: { value: string };
  image?: { value: string };
  sl?: { value: string };
}

export type CountryPlacesResult = { ok: true; attractions: Attraction[]; fetchedAt: Date } | { ok: false; reason: 'timeout' | 'rate_limited' | 'http_error' | 'invalid_response' };

export async function fetchCountryPlaces(isoCode: string): Promise<CountryPlacesResult> {
  const code = isoCode.replace(/[^A-Za-z]/g, '').toUpperCase();
  const query = `SELECT ?item ?itemLabel ?coord ?image ?sl WHERE {
  ?country wdt:P297 "${code}" .
  ?item wdt:P17 ?country .
  ?item wdt:P31/wdt:P279* wd:Q570116 .
  ?item wdt:P625 ?coord .
  ?item wikibase:sitelinks ?sl .
  FILTER(?sl > 5)
  OPTIONAL { ?item wdt:P18 ?image }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 250`;
  const res = await fetchJson<{ results?: { bindings?: Row[] } }>(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
    provider: 'wikidata-query',
    headers: { Accept: 'application/sparql-results+json' },
    ttlMs: 7 * DAY_MS,
    timeoutMs: 40000,
    minSpacingMs: 1000,
  });
  if (!res.ok) return { ok: false, reason: res.reason === 'rate_limited' ? 'rate_limited' : res.reason === 'timeout' ? 'timeout' : res.reason === 'invalid_response' ? 'invalid_response' : 'http_error' };
  const rows = res.body.results?.bindings;
  if (!Array.isArray(rows)) return { ok: false, reason: 'invalid_response' };
  const seen = new Set<string>();
  const attractions: Attraction[] = [];
  for (const r of rows) {
    const qid = /\/(Q\d+)$/.exec(r.item.value)?.[1];
    const name = r.itemLabel?.value;
    const point = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(r.coord?.value ?? '');
    if (!qid || !name || /^Q\d+$/.test(name) || !point || seen.has(qid) || seen.has(name.toLowerCase())) continue;
    seen.add(qid);
    seen.add(name.toLowerCase());
    const file = r.image?.value ? decodeURIComponent(r.image.value.split('/').pop() ?? '') : '';
    attractions.push({
      id: qid,
      name,
      lat: Number(point[2]),
      lon: Number(point[1]),
      kind: 'attraction',
      openingHours: null,
      fee: null,
      charge: null,
      wikidata: qid,
      website: null,
      commonsFile: file || null,
    });
  }
  return { ok: true, attractions, fetchedAt: res.fetchedAt };
}
