import { Fragment } from 'react';

export const BOOKING_STEPS = [
  'Select room',
  'Verify availability',
  'Price & terms',
  'Guest details',
  'Confirm',
  'Pay',
  'Confirmation',
] as const;

/** currentStep is a 0-based index. Completed steps show a check, the current step a solid dot. */
export function BookingStepper({ currentStep = 0 }: { currentStep?: number }) {
  return (
    <ol className="flex items-center font-sans" aria-label="Booking progress">
      {BOOKING_STEPS.map((label, i) => {
        const done = i < currentStep;
        const current = i === currentStep;
        const circle = current
          ? 'border-2 border-accent text-accent'
          : done
            ? 'bg-accent-soft text-accent'
            : 'border border-border text-text-muted';
        const text = current ? 'font-semibold text-accent' : done ? 'text-text' : 'text-text-muted';
        return (
          <Fragment key={label}>
            <li className="flex min-w-0 flex-col items-center gap-2" aria-current={current ? 'step' : undefined}>
              <div className={`flex size-stepper items-center justify-center rounded-full text-micro ${circle}`}>
                {done ? '✓' : current ? '●' : ''}
              </div>
              <div className={`text-center text-xs ${text}`}>{label}</div>
            </li>
            {i < BOOKING_STEPS.length - 1 && <li aria-hidden="true" className="mx-1 mb-6 h-px flex-1 bg-border" />}
          </Fragment>
        );
      })}
    </ol>
  );
}
