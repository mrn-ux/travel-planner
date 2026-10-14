import { useState } from 'react';
import { Money } from '../../../components/Money';
import { Button } from '../../../components/ds/Button';
import { Card } from '../../../components/ds/Card';
import { ApiError } from '../../../lib/api';
import { confirmBooking, type Booking } from '../../../lib/booking';
import { formatDateRange } from '../../../lib/format';
import { Alert } from './Alert';

interface Props {
  booking: Booking;
  onReady: (b: Booking, clientSecret: string) => void;
}

/** Step 4: review, then **Confirm and pay** creates the payment for the accepted price. Nothing is booked yet. */
export function Confirm({ booking, onReady }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const price = booking.finalPrice;
  const guests = `${booking.adults} ${booking.adults === 1 ? 'adult' : 'adults'}${booking.childrenAges.length > 0 ? `, ${booking.childrenAges.length} ${booking.childrenAges.length === 1 ? 'child' : 'children'}` : ''}`;

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await confirmBooking(booking.id);
      onReady(res.booking, res.clientSecret);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not start the payment. Nothing was charged.');
      setBusy(false);
    }
  };

  const rows: Array<[string, string, boolean?]> = [
    ['Hotel', booking.hotel.name],
    ['Room', booking.room.name],
    ['Dates', `${formatDateRange(booking.checkin, booking.checkout)} (${booking.nights} ${booking.nights === 1 ? 'night' : 'nights'})`],
    ['Guests', guests],
    ['Primary guest', booking.guest ? `${booking.guest.firstName} ${booking.guest.lastName}` : ''],
  ];

  return (
    <div className="flex max-w-booking flex-col gap-4">
      {error && <Alert tone="danger" title="We could not start the payment." >{error}</Alert>}
      <Card title="Review your booking">
        <div className="flex flex-col gap-3 font-sans text-sm">
          {rows.map(([l, v]) => (
            <div key={l} className="flex justify-between gap-4">
              <span className="text-text-secondary">{l}</span>
              <span className="text-right">{v}</span>
            </div>
          ))}
          {price && (
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <Money amount={price.amount} currency={price.currency} />
            </div>
          )}
          <div className="text-xs text-text-muted">{booking.cancellation?.text} Sandbox booking: Stripe test payment, no real reservation.</div>
          <div>
            <Button onClick={() => void go()} disabled={busy}>
              Confirm and pay
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
