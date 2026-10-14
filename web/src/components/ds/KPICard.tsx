interface KPICardProps {
  label: string;
  value: string;
  /** Tailwind text colour class from the design tokens, for example "text-over-budget". */
  valueClass?: string;
}

export function KPICard({ label, value, valueClass = 'text-text' }: KPICardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-6 font-sans shadow-raised">
      <div className="text-sm text-text-secondary">{label}</div>
      <div className={`tabular text-xl font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
