import React from 'react';

const palette = ['var(--chart-hotels)', 'var(--chart-transportation)', 'var(--chart-activities)', 'var(--chart-food)', 'var(--chart-local-transport)', 'var(--chart-misc)'];

export function BudgetBreakdown({ categories = [], total, budget, remaining }) {
  const sum = categories.reduce((s, c) => s + c.amount, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', height: 12, borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        {categories.map((c, i) => <div key={c.label} style={{ width: `${(c.amount / sum) * 100}%`, background: palette[i % palette.length] }} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {categories.map((c, i) => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: palette[i % palette.length] }} />
            {c.label} <span className="tabular" style={{ color: 'var(--text)' }}>{c.amount}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 32, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div><div style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)' }}>Estimated total</div><div className="tabular" style={{ fontSize: 'var(--text-xl-size)', fontWeight: 600, color: 'var(--text)' }}>{total}</div></div>
        <div><div style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)' }}>Budget</div><div className="tabular" style={{ fontSize: 'var(--text-xl-size)', fontWeight: 600, color: 'var(--text)' }}>{budget}</div></div>
        <div><div style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)' }}>Remaining</div><div className="tabular" style={{ fontSize: 'var(--text-xl-size)', fontWeight: 600, color: remaining && remaining.trim().startsWith('-') ? 'var(--over-budget)' : 'var(--under-budget)' }}>{remaining}</div></div>
      </div>
    </div>
  );
}
