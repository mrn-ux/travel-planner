// Display formatting shared by every screen. Nothing here can return "NaN", "undefined", "null" or
// "Invalid Date": any missing or unreadable input becomes an em dash.
// Money is handled as a decimal STRING end to end (never a float) and is only ever formatted here.

export const EM_DASH = '—';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** USD 1,240.00 (currency code first, thousands separators, exactly two decimals). Negative: -USD 160.50. */
export function formatMoney(amount: string | null | undefined, currency: string | null | undefined): string {
  if (typeof amount !== 'string' || typeof currency !== 'string') return EM_DASH;
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  const code = currency.trim();
  if (!m || !/^[A-Za-z]{3}$/.test(code)) return EM_DASH;

  const negative = m[1] === '-';
  const whole = m[2] as string;
  const frac = m[3] ?? '';

  // Round half up to two decimals using integers only.
  let cents = BigInt(whole + frac.slice(0, 2).padEnd(2, '0'));
  if (frac.length > 2 && frac.charCodeAt(2) - 48 >= 5) cents += 1n;
  const digits = cents.toString().padStart(3, '0');
  const intPart = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decPart = digits.slice(-2);
  const isZero = cents === 0n;

  return `${negative && !isZero ? '-' : ''}${code.toUpperCase()} ${intPart}.${decPart}`;
}

/** 18 Nov 2026 */
export function formatDate(iso: string | null | undefined): string {
  if (typeof iso !== 'string') return EM_DASH;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return EM_DASH;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return EM_DASH;
  }
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** 2h 15m, 1h, 45m */
export function formatDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0) return EM_DASH;
  const h = Math.floor(minutes / 60);
  const mm = minutes % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

/** 18–26 Nov 2026 when both dates share a month, 30 Apr – 3 May 2027 within a year, otherwise two full dates. */
export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (typeof start !== 'string' || typeof end !== 'string') return EM_DASH;
  const s = /^(\d{4})-(\d{2})-(\d{2})/.exec(start);
  const e = /^(\d{4})-(\d{2})-(\d{2})/.exec(end);
  if (!s || !e || formatDate(start) === EM_DASH || formatDate(end) === EM_DASH) return `${formatDate(start)} – ${formatDate(end)}`;
  const month = (m: RegExpExecArray): string => MONTHS[Number(m[2]) - 1] ?? '';
  if (s[1] === e[1] && s[2] === e[2]) return `${Number(s[3])}–${Number(e[3])} ${month(e)} ${e[1]}`;
  if (s[1] === e[1]) return `${Number(s[3])} ${month(s)} – ${Number(e[3])} ${month(e)} ${e[1]}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}
