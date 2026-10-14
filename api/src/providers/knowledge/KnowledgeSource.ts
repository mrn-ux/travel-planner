/**
 * A source of open data for the knowledge base. One real implementation per source; the registry lists them.
 * Hotel rates, availability and departures are NEVER knowledge: no hotel or transport source can be registered.
 */
export interface KnowledgeSource {
  /** 'wikivoyage', 'open-meteo', ... (must be in ALLOWED_SOURCE_IDS). */
  readonly id: string;
  readonly licence: string;
  /** Lifetime in milliseconds, used to set expires_at on every chunk this source produces. */
  readonly ttlMs: number;
  /** Fetch current documents for a destination. Never throws: failures are returned, never replaced by a fallback. */
  fetch(dest: DestinationRef): Promise<FetchResult>;
}

export interface DestinationRef {
  /** Normalised key, for example "Lisbon, PT". */
  key: string;
  name: string;
  countryCode: string | null;
  /** English country name (used for the GOV.UK travel advice address). */
  countryName: string | null;
  lat: number | null;
  lon: number | null;
  wikidataId?: string;
}

export type FetchResult =
  | { ok: true; documents: SourceDocument[] }
  | { ok: false; reason: 'timeout' | 'rate_limited' | 'http_error' | 'not_found' | 'invalid_response' | 'network'; detail?: string };

export interface SourceDocument {
  title: string;
  /** Plain text, already cleaned of markup. */
  text: string;
  source_url: string;
  /** Credit shown to the user with the chunk (licence and origin). */
  attribution: string;
  /** ISO time of the upstream fetch. */
  fetched_at: string;
  /** Overrides the source's lifetime for this document (for example a 6 hour forecast next to 30 day climate). */
  ttlMs?: number;
}

/** The only sources the knowledge base accepts. */
export const ALLOWED_SOURCE_IDS = [
  'wikivoyage',
  'wikipedia',
  'wikidata',
  'open-meteo',
  'govuk-fcdo',
  'nager',
  'overpass',
  'frankfurter',
] as const;

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** English country name from an ISO code ("NL" -> "Netherlands"). Sources disagree on names ("Kingdom of the Netherlands"), the code does not. */
export function countryNameFromCode(code: string | null): string | null {
  if (!code) return null;
  try {
    const n = new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase());
    return n && n !== code.toUpperCase() ? n : null;
  } catch {
    return null;
  }
}

export function destinationKey(name: string, countryCode: string | null): string {
  return countryCode ? `${name}, ${countryCode.toUpperCase()}` : name;
}

/** Strip HTML to readable plain text (GOV.UK parts arrive as HTML). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
