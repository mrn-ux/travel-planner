import React from 'react';

const config = {
  confirmed: { color: 'var(--confirmed)', bg: 'rgba(31,122,77,0.1)', glyph: '✓', label: 'Confirmed' },
  estimated: { color: 'var(--estimated)', bg: 'rgba(184,117,46,0.1)', glyph: '~', label: 'Estimated' },
  unavailable: { color: 'var(--text-muted)', bg: 'var(--surface-muted)', glyph: '–', label: 'Unavailable' },
};

export function StatusBadge({ status = 'confirmed' }) {
  const c = config[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--radius-sm)',
      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs-size)', fontWeight: 'var(--weight-label)',
      color: c.color, background: c.bg,
    }}>
      <span aria-hidden="true">{c.glyph}</span>{c.label}
    </span>
  );
}
