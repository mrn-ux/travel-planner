import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  /** Tighter padding for dense layouts (smaller padding). */
  compact?: boolean;
  children: ReactNode;
}

export function Card({ title, compact = false, children }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface font-sans shadow-raised transition-shadow duration-200 hover:shadow-lift ${compact ? 'p-4' : 'p-6'}`}
    >
      {title && <div className="mb-3 font-display text-lg font-semibold text-text">{title}</div>}
      {children}
    </div>
  );
}
