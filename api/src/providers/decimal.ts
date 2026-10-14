// Money is a decimal string end to end. These helpers do the little arithmetic the providers need with integers
// (cents), never with floating point.

/** "123.456" -> 12346n (cents, rounded half up). null when not a plain decimal. */
export function toCents(amount: string | number | null | undefined): bigint | null {
  if (amount === null || amount === undefined) return null;
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(amount).trim());
  if (!m) return null;
  const frac = m[3] ?? '';
  let cents = BigInt(m[2] + frac.slice(0, 2).padEnd(2, '0'));
  if (frac.length > 2 && frac.charCodeAt(2) - 48 >= 5) cents += 1n;
  return m[1] === '-' ? -cents : cents;
}

export function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const digits = abs.toString().padStart(3, '0');
  return `${negative ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/** total / n, rounded half up to cents. */
export function divideAmount(total: string, n: number): string | null {
  const cents = toCents(total);
  if (cents === null || !Number.isInteger(n) || n < 1) return null;
  const divisor = BigInt(n);
  return fromCents((cents * 2n + divisor) / (divisor * 2n));
}

export function addAmounts(a: string, b: string): string | null {
  const x = toCents(a);
  const y = toCents(b);
  return x === null || y === null ? null : fromCents(x + y);
}

/** -1, 0, 1 comparison of two decimal strings (null sorts as "no value": the caller decides where). */
export function compareAmounts(a: string, b: string): number {
  const x = toCents(a) ?? 0n;
  const y = toCents(b) ?? 0n;
  return x < y ? -1 : x > y ? 1 : 0;
}

export function nightsBetween(checkin: string, checkout: string): number {
  return Math.round((Date.parse(`${checkout}T00:00:00Z`) - Date.parse(`${checkin}T00:00:00Z`)) / 86_400_000);
}
