import React from 'react';

export function KPICard({ label, value, valueColor }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-raised)', padding: 24, fontFamily: 'var(--font-sans)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)' }}>{label}</div>
      <div className="tabular" style={{ fontSize: 'var(--text-xl-size)', lineHeight: 'var(--text-xl-lh)', fontWeight: 600, color: valueColor || 'var(--text)' }}>{value}</div>
    </div>
  );
}
