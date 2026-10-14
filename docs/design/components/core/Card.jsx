import React from 'react';

export function Card({ title, children, padding = 24 }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-raised)', padding, fontFamily: 'var(--font-sans)',
    }}>
      {title && <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg-size)', lineHeight: 'var(--text-lg-lh)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  );
}
