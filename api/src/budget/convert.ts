import { query } from '../db.js';
import { ensureRate } from './fx.js';

export interface Converted {
  /** Decimal string in the target currency, rounded to cents by the database. */
  converted: string;
  fxRateId: number | null;
  rate: string | null;
  rateDate: string | null;
  sourceUrl: string | null;
  fetchedAt: string | null;
  /** 'estimated' whenever a conversion happened; 'confirmed' only when no conversion was needed. */
  certainty: 'confirmed' | 'estimated';
}

/** Convert with the stored rate (SQL function convert_amount). null when no rate is stored for the pair: Unavailable. */
export async function convertAmount(amount: string, from: string, to: string, date?: string): Promise<Converted | null> {
  const a = from.toUpperCase();
  const b = to.toUpperCase();
  if (a === b) return { converted: amount, fxRateId: null, rate: null, rateDate: null, sourceUrl: null, fetchedAt: null, certainty: 'confirmed' };

  const stored = await ensureRate(a, b);
  if (!stored) return null;
  const day = date ?? new Date().toISOString().slice(0, 10);
  const res = await query<{ converted: string; fx_rate_id: string }>('SELECT converted::text, fx_rate_id::text FROM convert_amount($1::numeric, $2, $3, $4::date)', [amount, a, b, day]);
  const row = res.rows[0];
  if (!row) return null;
  return { converted: row.converted, fxRateId: Number(row.fx_rate_id), rate: stored.rate, rateDate: stored.rateDate, sourceUrl: stored.sourceUrl, fetchedAt: stored.fetchedAt, certainty: 'estimated' };
}
