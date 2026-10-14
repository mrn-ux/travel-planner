import React from 'react';

export function NavItem({ children, active = false, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <a
      onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm-size)', fontWeight: 'var(--weight-label)',
        cursor: 'pointer', textDecoration: 'none',
        color: active ? 'var(--accent)' : hover ? 'var(--text)' : 'var(--text-secondary)',
        background: active ? 'var(--accent-soft)' : 'transparent',
      }}
    >
      {children}
    </a>
  );
}
