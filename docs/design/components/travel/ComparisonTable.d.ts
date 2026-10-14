/**
 * @startingPoint section="Travel" subtitle="Hotel / transport comparison — sortable, status-badged price column" viewport="700x260"
 */
export interface ComparisonColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  tabular?: boolean;
}
export interface ComparisonTableProps {
  columns: ComparisonColumn[];
  rows: Record<string, React.ReactNode>[];
  sortKey?: string;
  onSort?: (key: string) => void;
}
export function ComparisonTable(props: ComparisonTableProps): JSX.Element;
