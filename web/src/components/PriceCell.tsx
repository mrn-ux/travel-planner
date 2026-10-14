import type { Priced } from '../lib/comparison';
import { CertaintyBadge } from './CertaintyBadge';
import { Money } from './Money';

interface PriceCellProps {
  price: Priced;
  /** Appended after the amount, for example "/ night". */
  suffix?: string;
  sandbox?: boolean;
}

/** A price is never shown without its certainty badge; an estimate carries its basis and range as a tooltip. */
export function PriceCell({ price, suffix, sandbox = false }: PriceCellProps) {
  const range = price.range && price.currency ? `Range ${price.currency} ${price.range.low} to ${price.range.high}. ` : '';
  const tip = price.certainty === 'estimated' ? `Faro estimate, not a quote. ${range}${price.basis ?? ''}`.trim() : undefined;
  return (
    <span className="inline-flex flex-col items-end gap-1" title={tip}>
      <span className="inline-flex items-center gap-2">
        <CertaintyBadge certainty={price.certainty} />
        {price.amount && price.currency && (
          <span className="whitespace-nowrap">
            <Money amount={price.amount} currency={price.currency} />
            {suffix ? ` ${suffix}` : ''}
          </span>
        )}
      </span>
      {price.certainty === 'estimated' && <span className="text-xs text-text-muted">Faro estimate, not a quote</span>}
      {sandbox && <span className="text-xs text-text-muted">Sandbox rate</span>}
    </span>
  );
}
