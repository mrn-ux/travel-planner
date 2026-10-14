import React from 'react';

const base = {
  height: 40, padding: '0 16px', borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm-size)', lineHeight: 'var(--text-sm-lh)',
  fontWeight: 'var(--weight-label)', border: '1px solid transparent', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};

const variants = {
  primary: { background: 'var(--accent)', color: '#fff' },
  secondary: { background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' },
  ghost: { background: 'transparent', color: 'var(--text-secondary)' },
  danger: { background: 'var(--danger)', color: '#fff' },
};

const hoverBg = { primary: 'var(--accent-hover)', ghost: 'var(--surface-muted)' };

export function Button({ variant = 'primary', disabled = false, children, onClick, type = 'button' }) {
  const [hover, setHover] = React.useState(false);
  const style = {
    ...base,
    ...variants[variant],
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
    ...(hover && hoverBg[variant] ? { background: hoverBg[variant] } : {}),
  };
  return (
    <button type={type} style={style} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {children}
    </button>
  );
}
