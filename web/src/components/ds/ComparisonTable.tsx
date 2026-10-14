import type { ReactNode } from 'react';

export interface ComparisonColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  tabular?: boolean;
}

interface ComparisonTableProps {
  columns: ComparisonColumn[];
  rows: Array<Record<string, ReactNode>>;
  sortKey?: string;
  /** Direction of the active sort, shown as a small arrow on the sorted header. */
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

export function ComparisonTable({ columns, rows, sortKey, sortDir = 'asc', onSort }: ComparisonTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface font-sans">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-muted">
            {columns.map((c) => {
              const sorted = c.sortable && sortKey === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  onClick={() => c.sortable && onSort?.(c.key)}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-header text-text-secondary ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.sortable ? 'cursor-pointer' : ''}`}
                >
                  {c.label}
                  {sorted ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border hover:bg-surface-muted">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-4 py-3 text-sm text-text ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.tabular ? 'tabular' : ''}`}
                >
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
