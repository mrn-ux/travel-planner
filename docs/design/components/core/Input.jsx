import React from 'react';

export function Input({ label, placeholder, value, onChange, error, type = 'text' }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)' }}>
      {label && <label style={{ fontSize: 'var(--text-sm-size)', fontWeight: 'var(--weight-label)', color: 'var(--text-secondary)' }}>{label}</label>}
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          height: 40, padding: '0 12px', background: 'var(--surface)',
          border: `1px solid ${error ? 'var(--danger)' : focused ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base-size)', color: 'var(--text)',
          outline: focused ? '2px solid var(--focus-ring)' : 'none', outlineOffset: 2,
        }}
      />
      {error && <span style={{ fontSize: 'var(--text-xs-size)', color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}
