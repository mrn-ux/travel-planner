import { useEffect, useState } from 'react';
import { Money } from '../../components/Money';
import { Button } from '../../components/ds/Button';
import { Input } from '../../components/ds/Input';
import { Modal } from '../../components/ds/Modal';
import { Select } from '../../components/ds/Select';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { bookFlight, checkFlight, type FlightBooking, type FlightCheck, type PassengerInput } from '../../lib/flightBooking';
import { formatDate } from '../../lib/format';

const TITLES = ['Mr', 'Ms', 'Mrs', 'Miss', 'Dr'];
const GENDERS = ['Male', 'Female'];

interface Draft {
  title: string;
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: string;
}

const emptyDraft = (): Draft => ({ title: 'Mr', givenName: '', familyName: '', bornOn: '', gender: 'Male' });


const clock = (iso: string): string => `${formatDate(iso.slice(0, 10))}, ${iso.slice(11, 16)}`;

/**
 * Book the chosen flight in the airline service's test mode: the offer is looked up again, its live price and terms are shown,
 * every traveler is named, and nothing is confirmed until the airline service confirms. No real reservation, no real money.
 */
export function FlightBookingModal({ tripId, onClose, onBooked }: { tripId: string; onClose: () => void; onBooked: (b: FlightBooking) => void }) {
  const { user } = useAuth();
  const [state, setState] = useState<'loading' | 'form' | 'booking' | 'done' | 'error'>('loading');
  const [check, setCheck] = useState<FlightCheck | null>(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [booking, setBooking] = useState<FlightBooking | null>(null);

  const load = async () => {
    setState('loading');
    try {
      const c = await checkFlight(tripId);
      setCheck(c);
      setDrafts((d) => (d.length === c.offer.passengers.length ? d : c.offer.passengers.map(emptyDraft)));
      if (c.existing) {
        setBooking(c.existing);
        setState('done');
      } else setState('form');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not look the flight up. Check your connection.');
      setState('error');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDraft = (i: number, patch: Partial<Draft>) => setDrafts((all) => all.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const submit = async () => {
    if (!check) return;
    setFieldError(null);
    for (const [i, d] of drafts.entries()) {
      if (!d.givenName.trim() || !d.familyName.trim() || !d.bornOn) {
        setFieldError(`Traveler ${i + 1}: enter the first name, last name and date of birth.`);
        return;
      }
    }
    if (!/^\+\d{7,15}$/.test(phone.trim())) {
      setFieldError('Enter the phone number in international format, for example +442080160509.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFieldError('Enter a valid email address.');
      return;
    }
    const passengers: PassengerInput[] = drafts.map((d) => ({
      title: d.title.toLowerCase() as PassengerInput['title'],
      givenName: d.givenName.trim(),
      familyName: d.familyName.trim(),
      bornOn: d.bornOn,
      gender: d.gender === 'Female' ? 'f' : 'm',
      email: email.trim(),
      phoneNumber: phone.trim(),
    }));
    setState('booking');
    try {
      const b = await bookFlight(tripId, { amount: check.offer.amount, currency: check.offer.currency, passengers });
      setBooking(b);
      setState('done');
      onBooked(b);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'The booking did not go through. Check your connection. Nothing was confirmed.';
      setFieldError(message);
      // A price change or a gone offer: look the flight up again so the new price or the situation is shown.
      if (err instanceof ApiError && (err.status === 409 || err.status === 504)) await load();
      else setState('form');
    }
  };

  const o = check?.offer;
  return (
    <Modal
      title="Book your flight"
      onClose={state === 'booking' ? undefined : onClose}
      actions={
        state === 'form' && o ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void submit()}>
              Book for {o.currency} {o.amount}
            </Button>
          </>
        ) : state === 'booking' ? (
          <Button disabled>Booking...</Button>
        ) : (
          <Button onClick={onClose}>{state === 'done' ? 'Done' : 'Close'}</Button>
        )
      }
    >
      <div className="flex max-h-dialog flex-col gap-3 overflow-y-auto font-sans text-sm">
        {state === 'loading' && <p className="m-0">Checking the flight with the airline service...</p>}
        {state === 'error' && <p className="m-0 text-danger">{error}</p>}
        {state === 'done' && booking && (
          <>
            <p className="m-0 font-semibold text-text">Your flight is booked. Bon voyage!</p>
            <div>
              Booking reference: <span className="font-semibold">{booking.reference}</span>
            </div>
            <div>
              {booking.airline}: {booking.origin} to {booking.destination}
            </div>
            {booking.departureAt && <div>Departs {clock(booking.departureAt)} (UTC)</div>}
            {booking.total && (
              <div>
                Total: <Money amount={booking.total.amount} currency={booking.total.currency} />
              </div>
            )}
            <div>Travelers: {booking.passengers.map((p) => p.name).join(', ')}</div>
            <div className="text-text-secondary">
              {booking.email.status === 'sent' ? 'A confirmation email was sent to you.' : 'Email not sent. Your booking stands.'} This is a test booking: no real reservation was made and no real money was taken.
            </div>
          </>
        )}
        {(state === 'form' || state === 'booking') && o && (
          <>
            <div className="rounded-md border border-solid border-border p-3">
              <div className="font-medium text-text">
                {o.airline ?? 'Flight'}: {o.originName ?? 'origin'} to {o.destinationName ?? 'destination'}
              </div>
              <div className="text-text-secondary">
                Departs {clock(o.departure)}, arrives {clock(o.arrival)} (local times)
              </div>
              <div className="mt-1">
                Price: <Money amount={o.amount} currency={o.currency} /> for {o.passengers.length} {o.passengers.length === 1 ? 'traveler' : 'travelers'}
              </div>
              {o.terms.map((t) => (
                <div key={t} className="text-text-secondary">
                  {t}
                </div>
              ))}
            </div>
            {check?.priceChanged && check.shownPrice && (
              <div role="alert" className="rounded-md border border-solid border-over-budget p-3 text-over-budget">
                The price changed from {check.shownPrice.currency} {check.shownPrice.amount} to {o.currency} {o.amount}. Booking uses the new price shown above.
              </div>
            )}
            {drafts.map((d, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-solid border-border p-3">
                <div className="font-medium text-text">
                  Traveler {i + 1} ({o.passengers[i]?.age != null ? `age ${o.passengers[i]?.age}` : o.passengers[i]?.type === 'adult' ? 'adult' : 'child'})
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select label="Title" value={d.title} options={TITLES} onChange={(e) => setDraft(i, { title: e.target.value })} />
                  <Select label="Gender" value={d.gender} options={GENDERS} onChange={(e) => setDraft(i, { gender: e.target.value })} />
                  <Input label="First name" value={d.givenName} onChange={(e) => setDraft(i, { givenName: e.target.value })} />
                  <Input label="Last name" value={d.familyName} onChange={(e) => setDraft(i, { familyName: e.target.value })} />
                </div>
                <Input label="Date of birth" type="date" value={d.bornOn} onChange={(e) => setDraft(i, { bornOn: e.target.value })} />
                <span className="text-xs text-text-secondary">
                  {o.passengers[i]?.type === 'infant_without_seat' ? 'Must be under 2 on the flight day.' : o.passengers[i]?.type === 'child' ? 'Must be 2 to 11 on the flight day.' : 'Must be 12 or over on the flight day.'}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <Input label="Contact email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Contact phone" placeholder="+442080160509" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <p className="m-0 text-xs text-text-muted">Names must match the travel documents. This books in the airline service's test mode: no real reservation is made and no real money is taken.</p>
          </>
        )}
        {fieldError && (
          <div role="alert" className="text-danger">
            {fieldError}
          </div>
        )}
      </div>
    </Modal>
  );
}
