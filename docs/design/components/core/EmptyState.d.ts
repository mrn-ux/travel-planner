/**
 * @startingPoint section="Core" subtitle="Centered empty-list / empty-chart state" viewport="700x180"
 */
export interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}
export function EmptyState(props: EmptyStateProps): JSX.Element;
