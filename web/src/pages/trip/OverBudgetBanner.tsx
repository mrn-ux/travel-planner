import { useState } from 'react';
import { CertaintyBadge } from '../../components/CertaintyBadge';
import { Button } from '../../components/ds/Button';
import { formatMoney } from '../../lib/format';
import type { Plan } from '../../lib/plan';

interface Props {
  plan: Plan;
  busy: boolean;
  error: string | null;
  onApply: (ids: number[]) => void;
}

/** Shown only while the plan is over budget. Nothing is applied until rows are checked and Apply selected is pressed. */
export function OverBudgetBanner({ plan, busy, error, onApply }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  if (!plan.overBudget.over) return null;

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const cur = plan.budget.currency;
  return (
    <div role="region" aria-label="Over budget" className="flex flex-col gap-3 rounded-md border border-over-budget bg-over-budget/10 p-4 font-sans text-sm text-text md:px-6">
      <div className="font-semibold text-over-budget">
        This plan is {formatMoney(plan.overBudget.amount, cur)} over your {formatMoney(plan.budget.budget, cur)} budget.
      </div>

      {plan.proposals.length === 0 ? (
        <p className="m-0 text-text-secondary">No savings could be established from real figures. Change the hotel, transport or dates yourself to bring the plan down.</p>
      ) : (
        plan.proposals.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-start gap-3 md:items-center">
            <input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} className="mt-1 size-4 shrink-0 cursor-pointer md:mt-0" />
            <span className="flex-1">{p.description}</span>
            <span className="tabular flex flex-wrap items-center justify-end gap-2 font-medium text-under-budget">
              Save {formatMoney(p.saving, p.currency)}
              <CertaintyBadge certainty={p.certainty} />
            </span>
          </label>
        ))
      )}

      {error && (
        <p role="alert" className="m-0 text-danger">
          {error}
        </p>
      )}
      {plan.proposals.length > 0 && (
        <div className="flex md:justify-end">
          <Button fullWidth disabled={checked.size === 0 || busy} onClick={() => onApply([...checked])}>
            Apply selected
          </Button>
        </div>
      )}
    </div>
  );
}
