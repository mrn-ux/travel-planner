import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ds/Button';
import { Card } from '../../../components/ds/Card';
import { ApiError } from '../../../lib/api';
import { acceptPrice, verifyBooking, type Booking } from '../../../lib/booking';
import { formatDateRange, formatMoney } from '../../../lib/format';
import { Alert } from './Alert';

interface Props {
  booking: Booking;
  onBooking: (b: Booking) => void;
  onBack: () => void;
}

type Change = { old: { amount: string; currency: string }; next: { amount: string; currency: string } };

/** Step 1: a live availability check with the provider. Gone = alert and a way back; a new price must be accepted. */
export function Verify({ booking, onBooking, onBack }: Props) {
  const [state, setState] = useState<'checking' | 'unavailable' | 'changed' | 'error'>('checking');
  const [change, setChange] = useState<Change | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    setState('checking');
    try {
      onBooking((await verifyBooking(booking.id)).booking);
    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.body?.['code'];
        if (code === 'room_unavailable') return setState('unavailable');
        if (code === 'price_changed') {
          setChange({ old: err.body?.['oldPrice'] as Change['old'], next: err.body?.['newPrice'] as Change['next'] });
          return setState('changed');
        }
        setMessage(err.message);
      } else {
        setMessage('We could not check availability.');
      }
      setState('error');
    }
  }, [booking.id, onBooking]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const accept = async () => {
    if (!change) return;
    setBusy(true);
    try {
      onBooking((await acceptPrice(booking.id, change.next.amount, change.next.currency)).booking);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'We could not accept the new price.');
      setState('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-w-booking flex-col gap-4">
      {state === 'unavailable' && (
        <Alert
          tone="over-budget"
          title={`Could not confirm availability for ${booking.room.name}.`}
          actions={
            <Button variant="secondary" onClick={onBack}>
              Back to hotel details
            </Button>
          }
        >
          The hotel provider reports this room as no longer available. You were not charged.
        </Alert>
      )}
      {state === 'changed' && change && (
        <Alert
          tone="danger"
          title={`The price changed from ${formatMoney(change.old.amount, change.old.currency)} to ${formatMoney(change.next.amount, change.next.currency)}.`}
          actions={
            <>
              <Button onClick={() => void accept()} disabled={busy}>
                Accept new price
              </Button>
              <Button variant="secondary" onClick={onBack} disabled={busy}>
                Back
              </Button>
            </>
          }
        >
          Nothing has been charged. Accept the new price to continue, or go back to choose another room.
        </Alert>
      )}
      {state === 'error' && (
        <Alert
          tone="danger"
          title="We could not check availability."
          actions={
            <Button variant="secondary" onClick={() => void run()}>
              Try again
            </Button>
          }
        >
          {message}
        </Alert>
      )}
      {state === 'checking' && (
        <Card title="Verify availability">
          <div role="status" className="font-sans text-sm text-text-secondary">
            Checking {booking.room.name} at {booking.hotel.name} for {formatDateRange(booking.checkin, booking.checkout)} with the provider...
          </div>
          <div className="mt-4 h-progress overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full w-2/5 animate-pulse rounded-full bg-accent" />
          </div>
        </Card>
      )}
    </div>
  );
}
