import { PageHero } from '../../components/PageHero';
import { LODGING_IMAGES } from '../../lib/destinationPhoto';
import { usePageImages } from '../../lib/usePageImages';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { SkeletonCard } from '../../components/Skeleton';
import { BookingStepper } from '../../components/ds/BookingStepper';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getBooking, startBooking, type Booking } from '../../lib/booking';
import { Confirm } from './steps/Confirm';
import { Confirmation } from './steps/Confirmation';
import { Guest } from './steps/Guest';
import { Pay } from './steps/Pay';
import { PriceTerms } from './steps/PriceTerms';
import { Verify } from './steps/Verify';

/** Index of the stepper's current step: 0 Select room (done on arrival), 1 Verify ... 6 Confirmation. */
function stepperIndex(b: Booking, priceReviewed: boolean): number {
  if (b.status === 'confirmed' || b.status === 'pending' || b.status === 'failed') return b.status === 'failed' ? 5 : 6;
  switch (b.step) {
    case 'verify':
      return 1;
    case 'price':
      return 2;
    case 'guest':
      return priceReviewed ? 3 : 2; // the price is locked, but the traveler has not accepted it yet
    case 'confirm':
      return 4;
    case 'pay':
      return 5;
    default:
      return 6;
  }
}

/** /trip/:tripId/book/:hotelId: the stepper, then the current step. Steps advance only as the server stores them. */
export default function BookingPage() {
  const stayImages = usePageImages(LODGING_IMAGES);
  const { tripId = '', hotelId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState('We could not start your booking.');
  const [priceReviewed, setPriceReviewed] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const started = useRef(false);

  const back = useCallback(() => navigate(`/hotels/${encodeURIComponent(hotelId)}?tripId=${encodeURIComponent(tripId)}&checkin=${params.get('checkin') ?? ''}&checkout=${params.get('checkout') ?? ''}`), [navigate, hotelId, tripId, params]);

  const open = useCallback(async () => {
    setState('loading');
    const existing = params.get('booking');
    try {
      if (existing) {
        setBooking((await getBooking(existing)).booking);
      } else {
        const room = params.get('room');
        const offer = params.get('offer');
        const checkin = params.get('checkin');
        const checkout = params.get('checkout');
        const total = params.get('total');
        const cur = params.get('cur');
        if (!room || !offer || !checkin || !checkout || !total || !cur) {
          setState('empty');
          return;
        }
        const res = await startBooking(tripId, { hotelId, roomId: room, roomName: params.get('name') ?? undefined, offerId: offer, checkin, checkout, shownPrice: total, currency: cur, rooms: Math.max(1, Math.min(10, Number(params.get('rooms') ?? '1') || 1)) });
        setBooking(res.booking);
        // The booking id goes in the address, so a reload resumes this booking instead of starting another.
        setParams((p) => { const n = new URLSearchParams(p); n.set('booking', res.booking.id); return n; }, { replace: true });
      }
      setState('ready');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.body?.['code'] === 'duplicate_confirmed') {
        setBooking(err.body['booking'] as Booking);
        setState('ready');
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setState('empty');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'We could not start your booking.');
      setState('error');
    }
  }, [params, setParams, tripId, hotelId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void open();
  }, [open]);

  const onBooking = useCallback((b: Booking) => setBooking(b), []);
  const returnedPayment = params.get('payment_intent');

  return (
    <div className="flex flex-col gap-8">
      <PageHero title="Book your stay" subtitle={booking ? `${booking.hotel.name}, almost yours` : 'A few quick steps and your room is yours.'} photoOf={stayImages} />
      <AsyncBoundary
        state={state}
        emptyMessage="This booking could not be found. Pick a room from the hotel details page."
        errorMessage={error}
        onRetry={() => void open()}
        loading={
          <div className="flex flex-col gap-4">
            <SkeletonCard />
          </div>
        }
      >
        {booking && (
          <>
            <BookingStepper currentStep={stepperIndex(booking, priceReviewed)} />
            {booking.status === 'confirmed' || booking.status === 'pending' || booking.status === 'failed' ? (
              <Confirmation booking={booking} userEmail={user?.email ?? ''} onBooking={onBooking} onBack={back} />
            ) : booking.step === 'verify' ? (
              <Verify booking={booking} onBooking={onBooking} onBack={back} />
            ) : booking.step === 'price' || (booking.step === 'guest' && !priceReviewed) ? (
              <PriceTerms booking={booking} onBooking={onBooking} onAccept={() => setPriceReviewed(true)} onBack={back} />
            ) : booking.step === 'guest' ? (
              <Guest booking={booking} email={user?.email ?? ''} onBooking={onBooking} />
            ) : booking.step === 'confirm' ? (
              <Confirm booking={booking} onReady={(b, secret) => { setClientSecret(secret); setBooking(b); }} />
            ) : (
              <Pay booking={booking} clientSecret={clientSecret} onSecret={setClientSecret} onBooking={onBooking} returnedPayment={returnedPayment} />
            )}
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
