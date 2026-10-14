import type { ReactNode } from 'react';

interface AlertProps {
  /** danger: price change, payment failure, timeout. over-budget: the room is gone (UI-SPEC 2.7). */
  tone: 'danger' | 'over-budget';
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}

export function Alert({ tone, title, children, actions }: AlertProps) {
  const cls = tone === 'danger' ? 'border-danger bg-danger/10' : 'border-over-budget bg-over-budget/10';
  const head = tone === 'danger' ? 'text-danger' : 'text-over-budget';
  return (
    <div role="alert" className={`flex flex-col gap-3 rounded-md border px-6 py-4 font-sans text-sm ${cls}`}>
      <div className={`font-semibold ${head}`}>{title}</div>
      {children && <div className="text-text">{children}</div>}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
