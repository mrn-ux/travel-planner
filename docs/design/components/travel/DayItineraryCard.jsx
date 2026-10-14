import React from 'react';

function Segment({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 'var(--text-sm-size)', fontWeight: 'var(--weight-label)', color: 'var(--text-secondary)' }}>{label}</div>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text)' }}>{item.title}</div>
            <div className="tabular" style={{ fontSize: 'var(--text-sm-size)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.duration} · {item.cost}</div>
          </div>
          {item.hours && <div style={{ fontSize: 'var(--text-xs-size)', color: 'var(--text-muted)', marginTop: 2 }}>{item.hours}</div>}
          {item.travelTime && <div style={{ fontSize: 'var(--text-xs-size)', color: 'var(--text-muted)', marginTop: 6, paddingLeft: 8, borderLeft: '1px solid var(--border)' }}>{item.travelTime} to next stop</div>}
        </div>
      ))}
    </div>
  );
}

export function DayItineraryCard({ day, date, morning, afternoon, evening }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-raised)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg-size)', fontWeight: 600, color: 'var(--text)' }}>Day {day} {date && `· ${date}`}</div>
      <Segment label="Morning" items={morning} />
      <Segment label="Afternoon" items={afternoon} />
      <Segment label="Evening" items={evening} />
    </div>
  );
}
