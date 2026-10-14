import { fetchJson } from '../../http.js';
import { DAY_MS, type DestinationRef, type FetchResult, type KnowledgeSource } from './KnowledgeSource.js';

const API = 'https://www.wikidata.org/w/api.php';
const SPACING_MS = 400;

// Wikidata (CC0). The query service times out on heavy queries and the API rate-limits (HTTP 429): every call
// here is cached for 30 days and spaced, and a failure returns "unavailable".

interface EntitiesResponse {
  entities?: Record<string, WikidataEntity>;
}

export interface WikidataEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;
  sitelinks?: Record<string, { title: string; url?: string }>;
}

function claimValue(e: WikidataEntity, prop: string): unknown {
  return e.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
}

export function entityCoordinates(e: WikidataEntity): { lat: number; lon: number } | null {
  const v = claimValue(e, 'P625') as { latitude?: number; longitude?: number } | undefined;
  return v && typeof v.latitude === 'number' && typeof v.longitude === 'number' ? { lat: v.latitude, lon: v.longitude } : null;
}

export function entityCountryId(e: WikidataEntity): string | null {
  const v = claimValue(e, 'P17') as { id?: string } | undefined;
  return v?.id ?? null;
}

export function entityIsoCode(e: WikidataEntity): string | null {
  const v = claimValue(e, 'P297');
  return typeof v === 'string' ? v : null;
}

export const entityLabel = (e: WikidataEntity): string | null => e.labels?.['en']?.value ?? null;

/** Fetch up to 50 entities by id (labels in English, claims, and only the English Wikivoyage sitelink). Cached 30 days. */
export async function getEntities(ids: string[]): Promise<Record<string, WikidataEntity> | null> {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    ids: ids.join('|'),
    props: 'labels|descriptions|claims|sitelinks',
    languages: 'en',
    sitefilter: 'enwikivoyage',
    format: 'json',
  });
  const res = await fetchJson<EntitiesResponse>(`${API}?${params.toString()}`, {
    provider: 'wikidata',
    ttlMs: 30 * DAY_MS,
    timeoutMs: 15000,
    minSpacingMs: SPACING_MS,
  });
  return res.ok ? (res.body.entities ?? null) : null;
}

/** Find a Wikidata item for a place name (first search hit). */
export async function searchEntityId(name: string): Promise<string | null> {
  const params = new URLSearchParams({ action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '1', format: 'json' });
  const res = await fetchJson<{ search?: Array<{ id: string }> }>(`${API}?${params.toString()}`, {
    provider: 'wikidata',
    ttlMs: 30 * DAY_MS,
    timeoutMs: 10000,
    minSpacingMs: SPACING_MS,
  });
  return res.ok ? (res.body.search?.[0]?.id ?? null) : null;
}

export class WikidataSource implements KnowledgeSource {
  readonly id = 'wikidata';
  readonly licence = 'CC0 1.0';
  readonly ttlMs = 30 * DAY_MS;

  async fetch(dest: DestinationRef): Promise<FetchResult> {
    const id = dest.wikidataId ?? (await searchEntityId(dest.name));
    if (!id) return { ok: false, reason: 'not_found' };
    const entities = await getEntities([id]);
    const e = entities?.[id];
    if (!e) return { ok: false, reason: 'http_error', detail: 'Wikidata did not return the item' };

    const facts: string[] = [`${entityLabel(e) ?? dest.name}${e.descriptions?.['en'] ? `: ${e.descriptions['en'].value}` : ''}.`];
    const population = claimValue(e, 'P1082') as { amount?: string } | undefined;
    if (population?.amount) facts.push(`Population: ${Number(population.amount).toLocaleString('en-US')}.`);
    const coords = entityCoordinates(e);
    if (coords) facts.push(`Coordinates: ${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}.`);
    if (dest.countryName) facts.push(`Country: ${dest.countryName}.`);

    return {
      ok: true,
      documents: [
        {
          title: `${entityLabel(e) ?? dest.name} (Wikidata)`,
          text: facts.join(' '),
          source_url: `https://www.wikidata.org/wiki/${id}`,
          attribution: `Wikidata item ${id}, CC0`,
          fetched_at: new Date().toISOString(),
        },
      ],
    };
  }
}
