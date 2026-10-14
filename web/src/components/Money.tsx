import { formatMoney } from '../lib/format';

/** Money from the API (decimal string + currency), shown as "USD 1,240.00" with tabular figures. */
export function Money({ amount, currency }: { amount: string | null | undefined; currency: string | null | undefined }) {
  return <span className="tabular">{formatMoney(amount, currency)}</span>;
}
