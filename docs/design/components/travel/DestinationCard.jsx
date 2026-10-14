import React from 'react';

export function DestinationCard({ rank, name, reasons = [], score }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-raised)', padding: 24, display: 'flex', gap: 16, fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>{rank}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg-size)', fontWeight: 600, color: 'var(--text)' }}>{name}</div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)' }}>
          {reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        <div style={{ height: 6, background: 'var(--surface-muted)', borderRadius: 'var(--radius-full)', marginTop: 4 }}>
          <div style={{ width: `${score}%`, height: '100%', background: 'var(--accent)', borderRadius: 'var(--radius-full)' }} />
        </div>
      </div>
    </div>
  );
}
