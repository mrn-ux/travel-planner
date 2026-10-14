// Stripe amounts are integers in the currency's smallest unit. Money is a decimal string everywhere else, so the conversion
// is done on the string with BigInt: no floating point, no rounding surprises.

const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

export function currencyExponent(currency: string): number {
  const c = currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) throw new Error(`"${currency}" is not a currency code.`);
  return ZERO_DECIMAL.has(c) ? 0 : THREE_DECIMAL.has(c) ? 3 : 2;
}

/** "765.00" + "USD" -> 76500n. Throws when the amount has more decimals than the currency allows or is not a plain decimal. */
export function toMinorUnits(amount: string, currency: string): bigint {
  const exp = currencyExponent(currency);
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!m) throw new Error(`"${amount}" is not a valid amount.`);
  const frac = m[2] ?? '';
  if (frac.length > exp && /[1-9]/.test(frac.slice(exp))) throw new Error(`${currency} amounts have at most ${exp} decimals.`);
  return BigInt(m[1]! + frac.slice(0, exp).padEnd(exp, '0'));
}

/** 76500n + "USD" -> "765.00" */
export function fromMinorUnits(minor: bigint | number, currency: string): string {
  const exp = currencyExponent(currency);
  const n = BigInt(minor);
  if (exp === 0) return n.toString();
  const digits = n.toString().padStart(exp + 1, '0');
  return `${digits.slice(0, -exp)}.${digits.slice(-exp)}`;
}
