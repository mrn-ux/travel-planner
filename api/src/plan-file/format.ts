// Display formatting for the plan file. The same rules as web/src/lib/format.ts: a missing or unreadable value becomes an em dash,
// and nothing here can return "NaN", "undefined", "null" or "Invalid Date". Money is a decimal STRING and is only formatted, never added.

export const EM_DASH = '—';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** USD 1,240.00 (currency code first, thousands separators, exactly two decimals). Negative: -USD 160.50. */
export function formatMoney(amount: string | null | undefined, currency: string | null | undefined): string {
  if (typeof amount !== 'string' || typeof currency !== 'string') return EM_DASH;
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  const code = currency.trim();
  if (!m || !/^[A-Za-z]{3}$/.test(code)) return EM_DASH;
  const frac = m[3] ?? '';
  let cents = BigInt((m[2] as string) + frac.slice(0, 2).padEnd(2, '0'));
  if (frac.length > 2 && frac.charCodeAt(2) - 48 >= 5) cents += 1n;
  const digits = cents.toString().padStart(3, '0');
  const whole = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${m[1] === '-' && cents !== 0n ? '-' : ''}${code.toUpperCase()} ${whole}.${digits.slice(-2)}`;
}

/** 18 Nov 2026 */
export function formatDate(iso: string | null | undefined): string {
  if (typeof iso !== 'string') return EM_DASH;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return EM_DASH;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return EM_DASH;
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

/** 2h 15m, 1h, 45m */
export function formatDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0) return EM_DASH;
  const h = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return h > 0 ? (mm > 0 ? `${h}h ${mm}m` : `${h}h`) : `${mm}m`;
}

/** 18 Nov 2026 14:05 UTC from a Date. */
export function formatDateTime(d: Date): string {
  if (Number.isNaN(d.getTime())) return EM_DASH;
  const iso = d.toISOString();
  return `${formatDate(iso)} ${iso.slice(11, 16)} UTC`;
}

export const label = (c: 'confirmed' | 'estimated' | 'unavailable' | null | undefined): string => (c === 'confirmed' ? 'Confirmed' : c === 'estimated' ? 'Estimated' : 'Unavailable');

/** Text that is safe to print: never the words undefined/null, never control characters. */
export function safe(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return EM_DASH;
  const s = String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  return s === '' || s === 'undefined' || s === 'null' || s === 'NaN' ? EM_DASH : s;
}
