import { fetchJson } from '../http.js';
import { DAY_MS, countryNameFromCode, destinationKey } from '../providers/knowledge/KnowledgeSource.js';
import { searchWikivoyage } from '../providers/knowledge/MediaWikiSource.js';
import { entityCoordinates, entityCountryId, entityIsoCode, entityLabel, getEntities, type WikidataEntity } from '../providers/knowledge/WikidataSource.js';

export interface Candidate {
  /** "Lisbon, PT" */
  key: string;
  name: string;
  countryCode: string;
  countryName: string | null;
  lat: number;
  lon: number;
  wikidataId: string | null;
  /** Position in the Wikivoyage interest search (0 = best), null when it did not match the interests. */
  interestRank: number | null;
  /** Number of Wikipedia-family language editions: a rough measure of how well known the place is. */
  popularity: number;
}

// Wikidata's query service times out on anything heavy. This is the simple form that works: cities ordered by how
// many language editions describe them. Cached for 30 days. Anything that fails degrades to the Wikivoyage search alone.
const SPARQL =
  'SELECT ?item ?sl WHERE { ?item wdt:P31 wd:Q515 ; wikibase:sitelinks ?sl . FILTER(?sl > 120) } ORDER BY DESC(?sl) LIMIT 80';

async function popularCities(): Promise<Array<{ id: string; sitelinks: number }>> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(SPARQL)}`;
  const res = await fetchJson<{ results?: { bindings?: Array<{ item: { value: string }; sl: { value: string } }> } }>(url, {
    provider: 'wikidata-sparql',
    ttlMs: 30 * DAY_MS,
    timeoutMs: 20000,
    minSpacingMs: 1000,
    headers: { Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) return [];
  return (res.body.results?.bindings ?? []).map((b) => ({ id: b.item.value.split('/').pop() ?? '', sitelinks: Number(b.sl.value) })).filter((x) => /^Q\d+$/.test(x.id));
}

/** Wikidata items with an English Wikivoyage article, with coordinates and an ISO country code. */
async function hydrate(ids: Array<{ id: string; sitelinks: number }>): Promise<Candidate[]> {
  const entities: Record<string, WikidataEntity> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const got = await getEntities(ids.slice(i, i + 50).map((x) => x.id));
    if (got) Object.assign(entities, got);
  }
  const countryIds = [...new Set(Object.values(entities).map(entityCountryId).filter((x): x is string => x !== null))];
  const countries: Record<string, WikidataEntity> = {};
  for (let i = 0; i < countryIds.length; i += 50) {
    const got = await getEntities(countryIds.slice(i, i + 50));
    if (got) Object.assign(countries, got);
  }

  const out: Candidate[] = [];
  for (const { id, sitelinks } of ids) {
    const e = entities[id];
    if (!e || !e.sitelinks?.['enwikivoyage']) continue; // no English guide: nothing to refine from later
    const name = entityLabel(e);
    const coords = entityCoordinates(e);
    const country = entityCountryId(e) ? countries[entityCountryId(e) as string] : undefined;
    const code = country ? entityIsoCode(country) : null;
    if (!name || !coords || !code) continue;
    out.push({ key: destinationKey(name, code), name, countryCode: code, countryName: countryNameFromCode(code) ?? (country ? entityLabel(country) : null), lat: coords.lat, lon: coords.lon, wikidataId: id, interestRank: null, popularity: sitelinks });
  }
  return out;
}

/**
 * Candidate destinations for a traveler with no destination: well-known cities that have a Wikivoyage guide,
 * boosted by a Wikivoyage search on the traveler's interests. Returns an empty list when every source fails.
 */
export async function discoverCandidates(interests: string | null, exclude: string[] = []): Promise<Candidate[]> {
  const [cities, matches] = await Promise.all([
    popularCities().then(hydrate).catch(() => [] as Candidate[]),
    interests ? searchWikivoyage(interests, 25) : Promise.resolve([] as string[]),
  ]);

  const byKey = new Map<string, Candidate>(cities.map((c) => [c.key, c]));
  const titles = matches.filter((t) => !t.includes('/') && !/^(Talk|Help|Wikivoyage)/i.test(t));

  titles.forEach((title, rank) => {
    const hit = cities.find((c) => c.name.toLowerCase() === title.toLowerCase());
    if (hit) hit.interestRank = rank;
  });

  // Only well-known cities become candidates. Matches that are regions or small places are not geocoded into
  // candidates: a name like "England" resolves to a different place, and a wrong destination is worse than a missing one.

  const excluded = new Set(exclude.map((x) => x.toLowerCase()));
  return [...byKey.values()].filter((c) => !excluded.has(c.key.toLowerCase()) && !excluded.has(c.name.toLowerCase()));
}
