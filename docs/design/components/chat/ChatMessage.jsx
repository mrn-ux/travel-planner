import React from 'react';

export function ChatMessage({ role = 'agent', text, followUps, results }) {
  const isAgent = role === 'agent';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAgent ? 'flex-start' : 'flex-end', gap: 8, fontFamily: 'var(--font-sans)' }}>
      <div style={{
        maxWidth: '70%', background: isAgent ? 'var(--surface-muted)' : 'var(--accent-soft)',
        borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 'var(--text-sm-size)',
        lineHeight: 'var(--text-sm-lh)', color: 'var(--text)',
      }}>
        {text}
        {followUps && followUps.length > 0 && (
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {followUps.map((q, i) => <li key={i} style={{ marginTop: 4 }}>{q}</li>)}
          </ul>
        )}
      </div>
      {results && <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 12 }}>{results}</div>}
    </div>
  );
}
