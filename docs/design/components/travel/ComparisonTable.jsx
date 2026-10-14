import React from 'react';

export function ComparisonTable({ columns = [], rows = [], sortKey, onSort }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface-muted)' }}>
            {columns.map(c => (
              <th key={c.key} onClick={() => c.sortable && onSort && onSort(c.key)}
                style={{
                  textAlign: c.align || 'left', padding: '12px 16px', fontSize: 'var(--text-xs-size)', fontWeight: 'var(--weight-label)',
                  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em',
                  cursor: c.sortable ? 'pointer' : 'default',
                }}>
                {c.label}{c.sortable && sortKey === c.key ? ' ↓' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {columns.map(c => (
                <td key={c.key} className={c.tabular ? 'tabular' : ''} style={{ textAlign: c.align || 'left', padding: '12px 16px', fontSize: 'var(--text-sm-size)', color: 'var(--text)' }}>
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
