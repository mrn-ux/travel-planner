import React from 'react';

export function Modal({ title, children, actions, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--modal-backdrop)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-modal)',
        padding: 32, maxWidth: 480, width: '100%', fontFamily: 'var(--font-sans)',
      }}>
        {title && <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg-size)', fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>{title}</div>}
        <div style={{ color: 'var(--text)', fontSize: 'var(--text-sm-size)' }}>{children}</div>
        {actions && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>{actions}</div>}
      </div>
    </div>
  );
}
