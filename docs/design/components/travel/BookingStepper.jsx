import React from 'react';

const steps = ['Select room', 'Verify availability', 'Price & terms', 'Guest details', 'Confirm', 'Pay', 'Confirmation'];

export function BookingStepper({ currentStep = 0 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'var(--font-sans)' }}>
      {steps.map((s, i) => {
        const done = i < currentStep, current = i === currentStep;
        return (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, background: done ? 'var(--accent-soft)' : 'transparent',
                color: done ? 'var(--accent)' : current ? 'var(--accent)' : 'var(--text-muted)',
                border: current ? '2px solid var(--accent)' : done ? 'none' : '1px solid var(--border)',
              }}>
                {done ? '✓' : current ? '●' : ''}
              </div>
              <div style={{ fontSize: 'var(--text-xs-size)', textAlign: 'center', color: current ? 'var(--accent)' : done ? 'var(--text)' : 'var(--text-muted)', fontWeight: current ? 600 : 400 }}>{s}</div>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 4px 20px' }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
