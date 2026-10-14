/**
 * @startingPoint section="Core" subtitle="Confirmed / estimated / unavailable — pairs with every price and schedule" viewport="700x100"
 */
export interface StatusBadgeProps {
  status: 'confirmed' | 'estimated' | 'unavailable';
}
export function StatusBadge(props: StatusBadgeProps): JSX.Element;
