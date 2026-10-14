import { useCallback, useEffect, useRef, useState } from 'react';
import { CertaintyBadge } from '../../../components/CertaintyBadge';
import { Money } from '../../../components/Money';
import { Button } from '../../../components/ds/Button';
import { Card } from '../../../components/ds/Card';
import { SkeletonRows } from '../../../components/Skeleton';
import { ApiError } from '../../../lib/api';
import { acceptPrice, priceBooking, type Booking } from '../../../lib/booking';
import { formatMoney } from '../../../lib/format';
import { Alert } from './Alert';

interface Props {
  booking: Booking;
  onBooking: (b: Booking) => void;
  onAccept: () => void;
  onBack: () => void;
}

type Change = { kind: 'price' | 'terms'; old: { amount: string; currency: string }; next: { amount: string; currency: string }; message: string };

/** Step 2: the final price and the full cancellation terms, locked with the provider (prebook). Any change must be accepted. */
export function PriceTerms({ booking, onBooking, onAccept, onBack }: Props) {
  const needsLock = booking.step === 'price';
  const [state, setState] = useState<'locking' | 'ready' | 'changed' | 'error'>(needsLock ? 'locking' : 'ready');
  const [change, setChange] = useState<Change | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const lock = useCallback(async () => {
    setState('locking');
    try {
      onBooking((await priceBooking(booking.id)).booking);
      setState('ready');
    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.body?.['code'];
        if (code === 'room_unavailable') {
          setMessage('This room is no longer available. You were not charged.');
          return setState('error');
        }
        if (code === 'price_changed' || code === 'terms_changed') {
          setChange({ kind: code === 'price_changed' ? 'price' : 'terms', old: err.body?.['oldPrice'] as Change['old'], next: err.body?.['newPrice'] as Change['next'], message: err.message });
          return setState('changed');
        }
        setMessage(err.message);
      } else {
        setMessage('We could not lock the price.');
      }
      setState('error');
    }
  }, [booking.id, onBooking]);

  useEffect(() => {
    if (!needsLock || started.current) return;
    started.current = true;
    void lock();
  }, [needsLock, lock]);

  const acceptChange = async () => {
    if (!change) return;
    setBusy(true);
    try {
      await acceptPrice(booking.id, change.next.amount, change.next.currency);
      await lock();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'We could not accept the change.');
      setState('error');
    } finally {
      setBusy(false);
    }
  };

  const price = booking.finalPrice;
  return (
    <div className="flex max-w-booking flex-col gap-4">
      {state === 'changed' && change && (
        <Alert
          tone="danger"
          title={change.kind === 'price' ? `The price changed from ${formatMoney(change.old.amount, change.old.currency)} to ${formatMoney(change.next.amount, change.next.currency)}.` : 'The cancellation terms or meal plan changed.'}
          actions={
            <>
              <Button onClick={() => void acceptChange()} disabled={busy}>
                Accept new price
              </Button>
              <Button variant="secondary" onClick={onBack} disabled={busy}>
                Back
              </Button>
            </>
          }
        >
          Nothing has been charged. Review the terms below, then accept to continue.
        </Alert>
      )}
      {state === 'error' && (
        <Alert
          tone="danger"
          title="We could not confirm the price and terms."
          actions={
            <>
              <Button variant="secondary" onClick={() => void lock()}>
                Try again
              </Button>
              <Button variant="secondary" onClick={onBack}>
                Back to hotel details
              </Button>
            </>
          }
        >
          {message}
        </Alert>
      )}
      <Card title="Price & terms">
        {state === 'locking' ? (
          <SkeletonRows count={3} />
        ) : (
          price && (
            <div className="flex flex-col gap-3 font-sans text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  {booking.nights} {booking.nights === 1 ? 'night' : 'nights'}, {booking.room.name}
                </span>
                <Money amount={price.amount} currency={price.currency} />
              </div>
              <div className="flex items-center justify-between border-0 border-t border-solid border-border pt-3 font-semibold">
                <span>Total</span>
                <span className="flex items-center gap-2">
                  <CertaintyBadge certainty={price.certainty} />
                  <Money amount={price.amount} currency={price.currency} />
                </span>
              </div>
              <div className="mt-2 text-xs font-medium text-text-secondary">Cancellation policy</div>
              <div className="leading-relaxed text-text-secondary">{booking.cancellation?.text ?? 'See the hotel terms.'}</div>
              <div className="text-xs text-text-muted">Sandbox rate: no real reservation will be made.</div>
              {state === 'ready' && (
                <div>
                  <Button onClick={onAccept}>Accept and continue</Button>
                </div>
              )}
            </div>
          )
        )}
      </Card>
    </div>
  );
}
