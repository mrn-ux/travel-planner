import type { Certainty } from '../../lib/types';

// Certainty is always shown as a glyph AND a word, never colour alone.
const config: Record<Certainty, { cls: string; glyph: string; label: string }> = {
  confirmed: { cls: 'bg-confirmed/10 text-confirmed', glyph: '✓', label: 'Confirmed' },
  estimated: { cls: 'bg-estimated/10 text-estimated', glyph: '~', label: 'Estimated' },
  unavailable: { cls: 'bg-surface-muted text-text-muted', glyph: '–', label: 'Unavailable' },
};

export function StatusBadge({ status = 'confirmed' }: { status?: Certainty }) {
  const c = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-badge-y font-sans text-xs font-medium ${c.cls}`}
    >
      <span aria-hidden="true">{c.glyph}</span>
      {c.label}
    </span>
  );
}
