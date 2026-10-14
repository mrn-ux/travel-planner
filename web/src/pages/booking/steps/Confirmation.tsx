import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CertaintyBadge } from '../../../components/CertaintyBadge';
import { Money } from '../../../components/Money';
import { Button } from '../../../components/ds/Button';
import { Card } from '../../../components/ds/Card';
import { ApiError } from '../../../lib/api';
import { getBooking, resendEmail, type Booking } from '../../../lib/booking';
import { formatDateRange } from '../../../lib/format';
import { setTripId } from '../../../lib/session';
import { Alert } from './Alert';

interface Props {
  booking: Booking;
  userEmail: string;
  onBooking: (b: Booking) => void;
  onBack: () => void;
}

/** The final screen. A confirmation is shown only when the hotel provider confirmed; pending and failed say exactly that. */
export function Confirmation({ booking, userEmail, onBooking, onBack }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // A booking waiting on the provider refreshes every few seconds until it is settled.
  useEffect(() => {
    if (booking.status !== 'pending') return;
    const t = setInterval(() => {
      getBooking(booking.id)
        .then((r) => onBooking(r.booking))
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [booking.status, booking.id, onBooking]);

  const resend = async () => {
    setBusy(true);
    setNote(null);
    try {
      await resendEmail(booking.id);
      onBooking((await getBooking(booking.id)).booking);
      setNote('The confirmation email was sent.');
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : 'The email could not be sent.');
      onBooking((await getBooking(booking.id).catch(() => ({ booking }))).booking);
    } finally {
      setBusy(false);
    }
  };

  if (booking.status === 'pending') {
    return (
      <div className="max-w-booking">
        <Alert tone="danger" title="Pending confirmation">
          Your payment was received and Faro is confirming with the hotel provider. This page refreshes on its own. Nothing is confirmed until the provider says so.
        </Alert>
      </div>
    );
  }

  if (booking.status === 'failed') {
    return (
      <div className="max-w-booking">
        <Alert
          tone="danger"
          title="The booking was not completed."
          actions={
            <Button variant="secondary" onClick={onBack}>
              Back to hotel details
            </Button>
          }
        >
          {booking.failureReason ?? 'The booking failed.'}
        </Alert>
      </div>
    );
  }

  const price = booking.finalPrice;
  const status = booking.email.status;
  const rows: Array<[string, React.ReactNode, boolean?]> = [
    ['Booking reference', booking.reference ?? '', true],
    ...(booking.hotelConfirmationCode ? ([['Hotel confirmation code', booking.hotelConfirmationCode]] as Array<[string, React.ReactNode]>) : []),
    ['Hotel', booking.hotel.name],
    ['Dates', formatDateRange(booking.checkin, booking.checkout)],
    ['Rooms', String(booking.rooms)],
    ['Final price', price ? <Money key="p" amount={price.amount} currency={price.currency} /> : ''],
  ];

  return (
    <div className="max-w-booking">
      <Card title="You are all set! Booking confirmed">
        <div className="flex flex-col gap-3 font-sans text-sm">
          <div className="flex items-center gap-2">
            <CertaintyBadge certainty="confirmed" />
            <span className="text-xs text-text-muted">Sandbox booking: no real reservation and no real money.</span>
          </div>
          {rows.map(([l, v, bold]) => (
            <div key={l} className="flex justify-between gap-4">
              <span className="text-text-secondary">{l}</span>
              <span className={`tabular text-right ${bold ? 'font-semibold' : ''}`}>{v}</span>
            </div>
          ))}
          <div className="text-text-secondary">
            {status === 'sent' ? `A confirmation email was sent to ${userEmail}.` : status === 'not_configured' ? 'Email not sent: email is not set up on this server.' : 'Email not sent.'}
          </div>
          {note && <div role="status">{note}</div>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/trips')}>View in My trips</Button>
            <Button variant="secondary" onClick={() => void resend()} disabled={busy}>
              Resend email
            </Button>
          </div>
        </div>
      </Card>
      <div className="mt-4">
        <Card title="Next: add your transport">
          <div className="flex flex-col gap-3 font-sans text-sm">
            <span className="text-text-secondary">Your room is booked. Pick how you will get there and add it to your trip plan. Transport is compared only, never booked here.</span>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setTripId(booking.tripId);
                  navigate('/search?tab=transport');
                }}
              >
                Add transport
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/trip/${encodeURIComponent(booking.tripId)}`)}>
                Open trip plan
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
