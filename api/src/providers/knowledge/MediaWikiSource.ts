import { fetchJson } from '../../http.js';
import { DAY_MS, type DestinationRef, type FetchResult, type KnowledgeSource, type SourceDocument } from './KnowledgeSource.js';

const MAX_GUIDE_CHARS = 20_000; // a guide can be 70,000 characters; the opening sections carry what we need
const MAX_INTRO_CHARS = 6_000;

interface ExtractResponse {
  query?: { pages?: Array<{ title: string; missing?: boolean; extract?: string; fullurl?: string }> };
}

/** Wikimedia asks for serial requests and an identifying User-Agent (added by fetchJson). */
const SPACING_MS = 400;

async function fetchExtract(host: string, title: string, intro: boolean): Promise<{ ok: true; title: string; text: string; url: string; fetchedAt: Date } | { ok: false; reason: Extract<FetchResult, { ok: false }>['reason']; detail?: string }> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    exsectionformat: 'wiki',
    redirects: '1',
    titles: title,
    format: 'json',
    formatversion: '2',
  });
  if (intro) params.set('exintro', '1');
  const url = `https://${host}/w/api.php?${params.toString()}`;
  const res = await fetchJson<ExtractResponse>(url, { provider: host, ttlMs: 30 * DAY_MS, timeoutMs: 12000, minSpacingMs: SPACING_MS });
  if (!res.ok) return { ok: false, reason: res.reason, detail: res.detail };
  const page = res.body.query?.pages?.[0];
  if (!page || page.missing || !page.extract) return { ok: false, reason: 'not_found' };
  const articleUrl = `https://${host}/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
  return { ok: true, title: page.title, text: page.extract, url: articleUrl, fetchedAt: res.fetchedAt };
}

/** Destination guides from Wikivoyage (and the opening of the Wikipedia article). CC BY-SA 4.0: keep the credit. */
function guideSource(id: 'wikivoyage' | 'wikipedia'): KnowledgeSource {
  const host = id === 'wikivoyage' ? 'en.wikivoyage.org' : 'en.wikipedia.org';
  const label = id === 'wikivoyage' ? 'Wikivoyage' : 'Wikipedia';
  return {
    id,
    licence: 'CC BY-SA 4.0',
    ttlMs: 30 * DAY_MS,
    async fetch(dest: DestinationRef): Promise<FetchResult> {
      const got = await fetchExtract(host, dest.name, id === 'wikipedia');
      if (!got.ok) return { ok: false, reason: got.reason, detail: got.detail };
      const limit = id === 'wikivoyage' ? MAX_GUIDE_CHARS : MAX_INTRO_CHARS;
      const doc: SourceDocument = {
        title: `${got.title} (${label})`,
        text: got.text.length > limit ? got.text.slice(0, limit) : got.text,
        source_url: got.url,
        attribution: `Text from "${got.title}", ${label}, CC BY-SA 4.0, ${got.url} (changes: shortened and split into excerpts)`,
        fetched_at: got.fetchedAt.toISOString(),
      };
      return { ok: true, documents: [doc] };
    },
  };
}

export const wikivoyageSource = guideSource('wikivoyage');
export const wikipediaSource = guideSource('wikipedia');

/**
 * Full-text search on Wikivoyage, used to find destinations that match the traveler's interests.
 * Returns article titles (cached 30 days). Never throws.
 */
export async function searchWikivoyage(query: string, limit = 20): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srnamespace: '0',
    srlimit: String(limit),
    format: 'json',
    formatversion: '2',
  });
  const res = await fetchJson<{ query?: { search?: Array<{ title: string }> } }>(`https://en.wikivoyage.org/w/api.php?${params.toString()}`, {
    provider: 'en.wikivoyage.org',
    ttlMs: 30 * DAY_MS,
    timeoutMs: 10000,
    minSpacingMs: SPACING_MS,
  });
  if (!res.ok) return [];
  return (res.body.query?.search ?? []).map((r) => r.title);
}
