import { BudgetBreakdown, type BudgetCategoryKey } from '../../components/ds/BudgetBreakdown';
import { Card } from '../../components/ds/Card';
import { EM_DASH, formatMoney } from '../../lib/format';
import type { Plan } from '../../lib/plan';

const LABELS: Record<string, string> = {
  hotels: 'Hotels',
  transportation: 'Transport',
  activities: 'Activities',
  food: 'Food',
  local_transport: 'Local transport',
  miscellaneous: 'Misc',
};

/** The Budget card: stacked bar, legend, totals. Totals and remaining come from the database; this only formats them. */
export function BudgetColumn({ plan }: { plan: Plan }) {
  const b = plan.budget;
  const cur = b.currency;
  const missing = new Set(b.categoriesWithoutRealFigure);

  const categories = b.categories.map((c) => ({
    key: c.category as BudgetCategoryKey,
    label: LABELS[c.category] ?? c.category,
    // A category with no real figure shows an em dash, never zero; a partly known one says so.
    amountText: c.itemCount === 0 ? EM_DASH : missing.has(c.category) ? `${formatMoney(c.amount, cur)} (partial)` : formatMoney(c.amount, cur),
    share: c.share,
  }));

  return (
    <Card title="Budget">
      <BudgetBreakdown
        categories={categories}
        totalText={formatMoney(b.estimatedTotal, cur)}
        budgetText={formatMoney(b.budget, cur)}
        remainingText={formatMoney(b.remaining, cur)}
        over={plan.overBudget.over}
      />
      <p className="mb-0 mt-4 font-sans text-xs text-text-muted">Food, local transport and miscellaneous are Faro estimates, not quotes. Hotel rates are sandbox rates.</p>
    </Card>
  );
}
