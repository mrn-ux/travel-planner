export type BudgetCategoryKey =
  | 'hotels'
  | 'transportation'
  | 'activities'
  | 'food'
  | 'local_transport'
  | 'miscellaneous';

// Fixed category order and colours (design system: chart palette, never a library default).
const CATEGORY_STYLE: Record<BudgetCategoryKey, string> = {
  hotels: 'bg-chart-hotels',
  transportation: 'bg-chart-transportation',
  activities: 'bg-chart-activities',
  food: 'bg-chart-food',
  local_transport: 'bg-chart-local-transport',
  miscellaneous: 'bg-chart-misc',
};

export interface BudgetCategoryView {
  key: BudgetCategoryKey;
  label: string;
  /** Already formatted for display, for example "USD 1,900.00" (or an em dash when unavailable). */
  amountText: string;
  /** Share of the bar from 0 to 100, supplied by the API; presentation only, not a money calculation. */
  share: number;
}

interface BudgetBreakdownProps {
  categories: BudgetCategoryView[];
  totalText: string;
  budgetText: string;
  remainingText: string;
  /** True when remaining is negative: shown in the over-budget colour, otherwise under-budget. */
  over: boolean;
}

export function BudgetBreakdown({ categories, totalText, budgetText, remainingText, over }: BudgetBreakdownProps) {
  return (
    <div className="flex flex-col gap-4 font-sans">
      <div className="flex h-bar overflow-hidden rounded-full bg-surface-muted" role="img" aria-label="Budget by category">
        {categories.map((c) => (
          <div key={c.key} className={CATEGORY_STYLE[c.key]} style={{ width: `${c.share}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-4">
        {categories.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-sm text-text-secondary">
            <span className={`size-dot-sm rounded-full ${CATEGORY_STYLE[c.key]}`} />
            {c.label} <span className="tabular text-text">{c.amountText}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-4">
        <Total label="Estimated total" value={totalText} valueClass="text-text" />
        <Total label="Budget" value={budgetText} valueClass="text-text" />
        <Total label="Remaining" value={remainingText} valueClass={over ? 'text-over-budget' : 'text-under-budget'} />
      </div>
    </div>
  );
}

function Total({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div>
      <div className="text-sm text-text-secondary">{label}</div>
      <div className={`tabular text-xl font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
