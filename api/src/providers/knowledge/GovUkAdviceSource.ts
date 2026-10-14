import { fetchJson } from '../../http.js';
import { HOUR_MS, htmlToText, type DestinationRef, type FetchResult, type KnowledgeSource } from './KnowledgeSource.js';

// FCDO foreign travel advice through the GOV.UK Content API. Open Government Licence v3.0. No key.
export const GOVUK_ATTRIBUTION = 'Contains public sector information licensed under the Open Government Licence v3.0';

// FCDO uses its own page names for a few countries; everything else is the English name, lower-case and hyphenated.
const SLUG_OVERRIDES: Record<string, string> = {
  'united states': 'usa',
  'united states of america': 'usa',
  czechia: 'czech-republic',
  türkiye: 'turkey',
  'south korea': 'south-korea',
  'north macedonia': 'north-macedonia',
  myanmar: 'myanmar-burma',
};

export function adviceSlug(countryName: string): string {
  const key = countryName.trim().toLowerCase();
  return SLUG_OVERRIDES[key] ?? key.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface AdviceResponse {
  title?: string;
  description?: string;
  public_updated_at?: string;
  details?: {
    alert_status?: string[];
    parts?: Array<{ title: string; slug: string; body: string }>;
    change_description?: string;
  };
}

export interface Advice {
  country: string;
  summary: string;
  alertStatus: string[];
  updatedAt: string | null;
  parts: Array<{ title: string; text: string }>;
  url: string;
  fetchedAt: Date;
}

export async function getTravelAdvice(countryName: string): Promise<{ ok: true; advice: Advice } | { ok: false; reason: Extract<FetchResult, { ok: false }>['reason']; detail?: string }> {
  const slug = adviceSlug(countryName);
  const api = `https://www.gov.uk/api/content/foreign-travel-advice/${slug}`;
  const res = await fetchJson<AdviceResponse>(api, { provider: 'govuk', ttlMs: 6 * HOUR_MS, timeoutMs: 10000, minSpacingMs: 150 });
  if (!res.ok) return { ok: false, reason: res.status === 404 ? 'not_found' : res.reason, detail: res.detail };
  const b = res.body;
  return {
    ok: true,
    advice: {
      country: countryName,
      summary: b.description ?? '',
      alertStatus: b.details?.alert_status ?? [],
      updatedAt: b.public_updated_at ?? null,
      parts: (b.details?.parts ?? []).map((p) => ({ title: p.title, text: htmlToText(p.body) })),
      url: `https://www.gov.uk/foreign-travel-advice/${slug}`,
      fetchedAt: res.fetchedAt,
    },
  };
}

export class GovUkAdviceSource implements KnowledgeSource {
  readonly id = 'govuk-fcdo';
  readonly licence = 'Open Government Licence v3.0';
  readonly ttlMs = 6 * HOUR_MS;

  async fetch(dest: DestinationRef): Promise<FetchResult> {
    if (!dest.countryName) return { ok: false, reason: 'not_found', detail: 'Unknown country' };
    const got = await getTravelAdvice(dest.countryName);
    if (!got.ok) return got;
    const a = got.advice;
    const alerts = a.alertStatus.length > 0 ? `Alert status: ${a.alertStatus.join(', ')}.` : 'No FCDO warning against travel.';
    const documents = [
      {
        title: `FCDO travel advice: ${a.country} (summary)`,
        text: `${a.summary} ${alerts}${a.updatedAt ? ` Last updated ${a.updatedAt.slice(0, 10)}.` : ''}`.trim(),
        source_url: a.url,
        attribution: GOVUK_ATTRIBUTION,
        fetched_at: a.fetchedAt.toISOString(),
      },
      ...a.parts
        .filter((p) => p.text.length > 0)
        .slice(0, 6)
        .map((p) => ({
          title: `FCDO travel advice: ${a.country} - ${p.title}`,
          text: p.text.slice(0, 4000),
          source_url: a.url,
          attribution: GOVUK_ATTRIBUTION,
          fetched_at: a.fetchedAt.toISOString(),
        })),
    ];
    return { ok: true, documents };
  }
}
