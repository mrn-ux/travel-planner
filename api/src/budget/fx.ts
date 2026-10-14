import { query } from '../db.js';
import { fetchJson } from '../http.js';

// Exchange rates come from Frankfurter (ECB reference rates) and are stored in fx_rates with their date and source, so a
// conversion always names the stored rate it used. A conversion is always Estimated, and with no stored rate it is
// Unavailable: there is no fallback figure.
const HOUR_MS = 3_600_000;

export interface StoredRate {
  id: number;
  base: string;
  quote: string;
  rate: string;
  rateDate: string;
  sourceUrl: string;
  fetchedAt: string;
}

interface Row {
  id: string;
  base: string;
  quote: string;
  rate: string;
  rate_date: string;
  source_url: string;
  fetched_at: Date;
}

const toRate = (r: Row): StoredRate => ({ id: Number(r.id), base: r.base.trim(), quote: r.quote.trim(), rate: r.rate, rateDate: r.rate_date, sourceUrl: r.source_url, fetchedAt: r.fetched_at.toISOString() });

async function latest(base: string, quote: string): Promise<Row | undefined> {
  const res = await query<Row>(
    'SELECT id, base, quote, rate::text, rate_date::text, source_url, fetched_at FROM fx_rates WHERE base = $1 AND quote = $2 ORDER BY rate_date DESC, fetched_at DESC LIMIT 1',
    [base, quote],
  );
  return res.rows[0];
}

/**
 * Make sure a rate for base -> quote that is less than 24 hours old is stored, fetching it from Frankfurter when not.
 * If the fetch fails, the latest stored rate (with its own date) is returned; null when none exists at all.
 */
export async function ensureRate(base: string, quote: string): Promise<StoredRate | null> {
  const from = base.toUpperCase();
  const to = quote.toUpperCase();
  if (from === to) return null;

  const have = await latest(from, to);
  if (have && Date.now() - have.fetched_at.getTime() < 24 * HOUR_MS) return toRate(have);

  const url = `https://api.frankfurter.dev/v2/rates?base=${from}&quotes=${to}&providers=ecb`;
  const res = await fetchJson<Array<{ date: string; base: string; quote: string; rate: number }>>(url, { provider: 'frankfurter', ttlMs: 0, timeoutMs: 8000 });
  const hit = res.ok && Array.isArray(res.body) ? res.body.find((r) => r.quote === to) : undefined;
  if (!res.ok || !hit || !(hit.rate > 0)) return have ? toRate(have) : null;

  const saved = await query<Row>(
    `INSERT INTO fx_rates (base, quote, rate_date, rate, source, source_url, fetched_at)
     VALUES ($1, $2, $3, $4, 'frankfurter-ecb', $5, now())
     ON CONFLICT (base, quote, rate_date, source) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = now()
     RETURNING id, base, quote, rate::text, rate_date::text, source_url, fetched_at`,
    [from, to, hit.date, String(hit.rate), url],
  );
  return toRate(saved.rows[0]!);
}
