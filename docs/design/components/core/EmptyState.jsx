import React from 'react';

export function EmptyState({ message, actionLabel, onAction }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      padding: '48px 0', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-muted)' }}>{message}</div>
      {actionLabel && <Button variant="primary" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}

function Button({ variant, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      height: 40, padding: '0 16px', borderRadius: 'var(--radius-md)', background: 'var(--accent)', color: '#fff',
      border: 'none', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm-size)', fontWeight: 'var(--weight-label)', cursor: 'pointer',
    }}>{children}</button>
  );
}
