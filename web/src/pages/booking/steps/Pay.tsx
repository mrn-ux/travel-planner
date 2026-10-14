import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ds/Button';
import { Card } from '../../../components/ds/Card';
import { SkeletonRows } from '../../../components/Skeleton';
import { ApiError } from '../../../lib/api';
import { completeBooking, confirmBooking, getStripe, type Booking } from '../../../lib/booking';
import { Alert } from './Alert';

interface Props {
  booking: Booking;
  clientSecret: string | null;
  onSecret: (s: string) => void;
  onBooking: (b: Booking) => void;
  /** A payment id returned from a redirect (3-D Secure) to finish. */
  returnedPayment?: string | null;
}

/** Settle the booking after Stripe reports the payment. The server re-checks the payment itself before booking anything. */
async function finish(id: string, paymentIntentId: string, onBooking: (b: Booking) => void): Promise<string | null> {
  try {
    onBooking((await completeBooking(id, paymentIntentId)).booking);
    return null;
  } catch (err) {
    return err instanceof ApiError ? err.message : 'We could not finish the booking.';
  }
}

function PayForm({ booking, clientSecret, onBooking }: { booking: Booking; clientSecret: string; onBooking: (b: Booking) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);
    // The way back is a short address that names the booking: the page address itself can be longer than Stripe accepts (2048 characters).
    const returnUrl = `${window.location.origin}/trip/${encodeURIComponent(booking.tripId)}/book/${encodeURIComponent(booking.hotel.id)}?booking=${encodeURIComponent(booking.id)}`;
    // Stripe's own fields take the card: Faro never sees it. redirect 'if_required' keeps simple cards on this page.
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required', confirmParams: { return_url: returnUrl } });
    if (stripeError) {
      setError(stripeError.message ?? 'The payment was declined.');
      setBusy(false);
      return;
    }
    const id = paymentIntent?.id ?? clientSecret.split('_secret_')[0] ?? '';
    const problem = await finish(booking.id, id, onBooking);
    if (problem) setError(problem);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert tone="danger" title={error}>
          No booking was made. Try payment again or use a different card.
        </Alert>
      )}
      <PaymentElement />
      <div>
        <Button onClick={() => void pay()} disabled={!stripe || busy}>
          {busy ? 'Processing...' : 'Pay now'}
        </Button>
      </div>
      <p className="m-0 font-sans text-xs text-text-muted">Stripe test mode: use card 4242 4242 4242 4242, any future date and any CVC. No real money is taken.</p>
    </div>
  );
}

/** Step 5: Stripe's embedded Payment Element. Faro adds no card inputs of its own. */
export function Pay({ booking, clientSecret, onSecret, onBooking, returnedPayment }: Props) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void getStripe()
      .then((s) => (s ? setStripe(s) : setProblem('The payment form could not be loaded.')))
      .catch(() => setProblem('The payment form could not be loaded.'));
  }, []);

  // Reloaded mid-payment: asking for the payment again returns the same one (idempotent).
  useEffect(() => {
    if (clientSecret) return;
    confirmBooking(booking.id)
      .then((r) => onSecret(r.clientSecret))
      .catch((err) => setProblem(err instanceof ApiError ? err.message : 'We could not start the payment.'));
  }, [booking.id, clientSecret, onSecret]);

  // Back from a 3-D Secure redirect: finish with the payment named in the URL.
  useEffect(() => {
    if (!returnedPayment) return;
    void finish(booking.id, returnedPayment, onBooking).then((p) => p && setProblem(p));
  }, [returnedPayment, booking.id, onBooking]);

  return (
    <div className="flex max-w-booking flex-col gap-4">
      {problem && <Alert tone="danger" title={problem} />}
      <Card title="Payment">
        {stripe && clientSecret ? (
          <Elements stripe={stripe} options={{ clientSecret }}>
            <PayForm booking={booking} clientSecret={clientSecret} onBooking={onBooking} />
          </Elements>
        ) : (
          <SkeletonRows count={3} />
        )}
      </Card>
    </div>
  );
}
