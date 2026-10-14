import React from 'react';

export function Select({ label, value, onChange, options = [] }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)' }}>
      {label && <label style={{ fontSize: 'var(--text-sm-size)', fontWeight: 'var(--weight-label)', color: 'var(--text-secondary)' }}>{label}</label>}
      <select
        value={value} onChange={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          height: 40, padding: '0 12px', background: 'var(--surface)', color: 'var(--text)',
          border: `1px solid ${focused ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base-size)',
          outline: focused ? '2px solid var(--focus-ring)' : 'none', outlineOffset: 2,
        }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
