/**
 * @startingPoint section="Travel" subtitle="Stacked category bar + legend + totals row" viewport="700x220"
 */
export interface BudgetCategory {
  label: string;
  amount: number;
}
export interface BudgetBreakdownProps {
  categories: BudgetCategory[];
  total: string;
  budget: string;
  remaining: string;
}
export function BudgetBreakdown(props: BudgetBreakdownProps): JSX.Element;
