import type { ReactNode } from 'react';

interface DestinationCardProps {
  rank: number;
  name: string;
  /** Plain text or richer content (badges, source links). */
  reasons?: ReactNode[];
  /** Recommendation score from 0 to 100 (bar width, presentation only). */
  score: number;
  /** Small note under the name, for example "Moved up from 4". */
  note?: ReactNode;
  /** When set, the whole card selects this destination (click or Enter). */
  onSelect?: () => void;
  disabled?: boolean;
}

export function DestinationCard({ rank, name, reasons = [], score, note, onSelect, disabled = false }: DestinationCardProps) {
  const width = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const selectable = onSelect !== undefined && !disabled;
  const interactive = selectable
    ? 'cursor-pointer hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring'
    : '';
  return (
    <div
      className={`flex gap-4 rounded-md border border-border bg-surface p-6 font-sans shadow-raised ${interactive}`}
      {...(selectable
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': `Choose ${name}`,
            onClick: onSelect,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.();
              }
            },
          }
        : {})}
    >
      <div className="font-display text-xl font-semibold text-text-secondary">{rank}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="font-display text-lg font-semibold text-text">{name}</div>
        {note && <div className="text-xs text-accent">{note}</div>}
        <ul className="m-0 flex list-disc flex-col gap-2 pl-4 text-sm text-text-secondary">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <div className="mt-1 h-score rounded-full bg-surface-muted" role="img" aria-label={`Recommendation score ${Math.round(width)}`}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
        </div>
      </div>
    </div>
  );
}
