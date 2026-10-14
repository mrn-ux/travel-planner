import { z } from 'zod';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { flightProvider, notificationProvider } from '../providers/index.js';
import type { FlightOfferDetail } from '../providers/flights/FlightProvider.js';
import type { Trip } from '../trips/service.js';

// Flight booking runs in the provider's test mode only (a Duffel test token is required at start-up): the order is paid from the
// test balance, so no real reservation is made and no real money moves. Trains and buses cannot be booked: there is no free booking source.

export type FlightEmailStatus = 'sent' | 'failed' | 'not_configured';

export interface FlightBookingView {
  id: string;
  status: 'confirmed' | 'failed';
  reference: string | null;
  airline: string | null;
  origin: string | null;
  destination: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  total: { amount: string; currency: string } | null;
  passengers: Array<{ name: string }>;
  email: { status: FlightEmailStatus | null };
  sandbox: true;
}

interface BookingRow {
  id: string;
  status: 'confirmed' | 'failed';
  booking_reference: string | null;
  airline: string | null;
  origin: string | null;
  destination: string | null;
  departure_at: Date | null;
  arrival_at: Date | null;
  total: string | null;
  currency: string | null;
  passengers: Array<{ givenName: string; familyName: string; email?: string }>;
  email_status: FlightEmailStatus | null;
}

const COLUMNS = `id, status, booking_reference, airline, origin, destination, departure_at, arrival_at, total::text, currency, passengers, email_status`;

const toView = (r: BookingRow): FlightBookingView => ({
  id: r.id,
  status: r.status,
  reference: r.booking_reference,
  airline: r.airline,
  origin: r.origin,
  destination: r.destination,
  departureAt: r.departure_at ? r.departure_at.toISOString() : null,
  arrivalAt: r.arrival_at ? r.arrival_at.toISOString() : null,
  total: r.total && r.currency ? { amount: r.total, currency: r.currency.trim() } : null,
  passengers: r.passengers.map((p) => ({ name: `${p.givenName} ${p.familyName}` })),
  email: { status: r.status === 'confirmed' ? r.email_status : null },
  sandbox: true,
});

/** The confirmed flight booking of a trip, or null. */
export async function getFlightBooking(tripId: string): Promise<FlightBookingView | null> {
  const res = await query<BookingRow>(`SELECT ${COLUMNS} FROM flight_bookings WHERE trip_id = $1 AND status = 'confirmed'`, [tripId]);
  return res.rows[0] ? toView(res.rows[0]) : null;
}

interface SelectedFlight {
  provider_ref: string;
  price: string | null;
  currency: string | null;
  origin: string;
  destination: string;
}

async function selectedFlight(tripId: string): Promise<SelectedFlight> {
  const res = await query<SelectedFlight>(
    "SELECT provider_ref, price::text, currency, origin, destination FROM trip_transport WHERE trip_id = $1 AND provider = 'duffel' AND provider_ref IS NOT NULL",
    [tripId],
  );
  const row = res.rows[0];
  if (!row) throw new AppError(409, 'Choose a flight in the Transport tab first. Only the flight offers from the airline test service can be booked.', { code: 'no_flight_selected' });
  return row;
}

const gone = (): AppError => new AppError(409, 'This flight offer is no longer available. Search again and pick a flight.', { code: 'offer_unavailable' });

async function liveOffer(selected: SelectedFlight): Promise<FlightOfferDetail> {
  const provider = flightProvider();
  if (!provider) throw new AppError(503, 'Flight booking is not set up on this server.');
  const offer = await provider.getOffer(selected.provider_ref);
  if (!offer.ok) {
    if (offer.reason === 'not_found') throw gone();
    throw new AppError(offer.reason === 'timeout' ? 504 : 502, 'The airline test service did not answer. Nothing was booked. Try again.', { code: 'provider_unavailable' });
  }
  return offer.data;
}

export interface FlightCheck {
  offer: Omit<FlightOfferDetail, 'passengers'> & { passengers: Array<{ type: string; age: number | null }> };
  /** The price shown when the flight was chosen, and whether the live price now differs from it. */
  shownPrice: { amount: string; currency: string } | null;
  priceChanged: boolean;
  /** Set when this trip already has a confirmed flight booking. */
  existing: FlightBookingView | null;
}

/** An airline seats a child under 2 on an adult's lap: each such infant needs an adult of their own in the same booking. */
function requireAdultPerInfant(passengers: Array<{ type: string }>): void {
  const infants = passengers.filter((p) => p.type === 'infant_without_seat').length;
  const adults = passengers.filter((p) => p.type === 'adult').length;
  if (infants > adults) {
    throw new AppError(400, `This trip has ${infants} ${infants === 1 ? 'child' : 'children'} under 2 but only ${adults} ${adults === 1 ? 'adult' : 'adults'}. Airlines need one adult for each child under 2: add an adult to the trip (or enter the child's age as 2 or over if that is right), then search again.`, { code: 'infant_needs_adult' });
  }
}

/** Step: look the offer up again before asking for details: its live price and terms, and who must be named. */
export async function checkFlight(trip: Trip): Promise<FlightCheck> {
  const selected = await selectedFlight(trip.id);
  const existing = await getFlightBooking(trip.id);
  const offer = await liveOffer(selected);
  requireAdultPerInfant(offer.passengers);
  const shown = selected.price && selected.currency ? { amount: selected.price, currency: selected.currency.trim() } : null;
  return {
    offer: { ...offer, passengers: offer.passengers.map((p) => ({ type: p.type, age: p.age })) },
    shownPrice: shown,
    priceChanged: shown !== null && (shown.amount !== offer.amount || shown.currency !== offer.currency),
    existing,
  };
}

const passengerSchema = z
  .object({
    title: z.enum(['mr', 'ms', 'mrs', 'miss', 'dr']),
    givenName: z.string().trim().min(1, 'Enter the first name.').max(40).regex(/^[\p{L} '-]+$/u, 'Use letters only.'),
    familyName: z.string().trim().min(1, 'Enter the last name.').max(40).regex(/^[\p{L} '-]+$/u, 'Use letters only.'),
    bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date of birth.'),
    gender: z.enum(['m', 'f']),
    email: z.string().trim().email('Enter a valid email address.').max(200),
    phoneNumber: z.string().trim().regex(/^\+\d{7,15}$/, 'Use the international format, for example +442080160509.'),
  })
  .strict();

const bookSchema = z.object({ amount: z.string().regex(/^\d+(\.\d{1,2})?$/), currency: z.string().length(3), passengers: z.array(passengerSchema).min(1).max(9) }).strict();

/** Whole years between a date of birth and a day (both YYYY-MM-DD). */
function ageOn(dob: string, day: string): number {
  let age = Number(day.slice(0, 4)) - Number(dob.slice(0, 4));
  if (day.slice(5) < dob.slice(5)) age -= 1;
  return age;
}

const shiftYears = (day: string, years: number): string => `${Number(day.slice(0, 4)) - years}${day.slice(4)}`;
/** The oldest date of birth that makes someone `age` years old on `day`. */
const earliestBorn = (age: number, day: string): string => {
  const d = new Date(`${shiftYears(day, age + 1)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
/** The latest date of birth that makes someone `age` years old on `day`. */
const latestBorn = (age: number, day: string): string => shiftYears(day, age);

/**
 * Book the chosen flight: the offer is looked up again, the price the traveler accepted must still be the live price, every traveler
 * is named, and the airline's test service creates the order. A flight is never reported booked until it confirms.
 */
export async function bookFlight(trip: Trip, userId: string, rawBody: unknown): Promise<FlightBookingView> {
  const body = bookSchema.parse(rawBody);
  if (await getFlightBooking(trip.id)) throw new AppError(409, 'A flight is already booked for this trip.', { code: 'duplicate' });
  const selected = await selectedFlight(trip.id);
  const offer = await liveOffer(selected);
  requireAdultPerInfant(offer.passengers);
  if (offer.amount !== body.amount || offer.currency !== body.currency.toUpperCase()) {
    throw new AppError(409, `The price changed to ${offer.currency} ${offer.amount}. Nothing was booked.`, { code: 'price_changed', price: { amount: offer.amount, currency: offer.currency } });
  }
  if (body.passengers.length !== offer.passengers.length) {
    throw new AppError(400, `This flight needs ${offer.passengers.length} ${offer.passengers.length === 1 ? 'traveler' : 'travelers'} named.`, { fields: { passengers: 'Name every traveler.' } });
  }
  // The airline service sorts travelers into infant (under 2), child (2 to 11) and adult (12 and over) by their age on the day they
  // fly, so that is the day each date of birth is checked against; the message says which traveler and what to enter.
  const flyDay = (offer.departure ?? new Date().toISOString()).slice(0, 10);
  const bands: Record<string, { min: number; max: number; label: string }> = {
    infant_without_seat: { min: 0, max: 1, label: 'under 2' },
    child: { min: 2, max: 11, label: '2 to 11' },
    adult: { min: 12, max: 120, label: '12 or over' },
  };
  for (const [i, p] of offer.passengers.entries()) {
    const dob = body.passengers[i]?.bornOn;
    const band = bands[p.type];
    if (!dob || !band) continue;
    const age = ageOn(dob, flyDay);
    if (age < band.min || age > band.max) {
      const who = p.age !== null ? `Traveler ${i + 1} (age ${p.age} when you searched)` : `Traveler ${i + 1}`;
      throw new AppError(400, `${who} must be ${band.label} on the flight day (${flyDay}). Enter a date of birth between ${earliestBorn(band.max, flyDay)} and ${latestBorn(band.min, flyDay)}.`, { fields: { passengers: `Traveler ${i + 1}: date of birth must make them ${band.label} on ${flyDay}.` } });
    }
  }
  const provider = flightProvider();
  if (!provider) throw new AppError(503, 'Flight booking is not set up on this server.');
  const order = await provider.createOrder({
    offerId: offer.id,
    amount: offer.amount,
    currency: offer.currency,
    passengers: body.passengers.map((p, i) => ({ id: (offer.passengers[i] as { id: string }).id, ...p })),
  });
  if (!order.ok) {
    if (order.reason === 'not_found') throw gone();
    if (order.detail === 'price_changed') throw new AppError(409, 'The price changed. Nothing was booked. Check the new price and try again.', { code: 'price_changed' });
    if (order.reason === 'timeout') throw new AppError(504, 'The airline test service did not answer, so the flight is not confirmed. Check again before booking another.', { code: 'provider_timeout' });
    if (order.detail && /does not match date of birth/i.test(order.detail)) {
      throw new AppError(400, 'The date of birth of a traveler does not fit their age group (adult or child) for this flight. Check each date of birth against the age shown for that traveler. Nothing was booked.', { code: 'dob_mismatch' });
    }
    throw new AppError(502, `The airline test service did not accept the booking${order.detail ? `: ${order.detail}` : ''}. Nothing was booked.`, { code: 'booking_failed' });
  }

  let id: string;
  try {
    const saved = await query<{ id: string }>(
      `INSERT INTO flight_bookings (user_id, trip_id, offer_id, order_id, booking_reference, airline, origin, destination, departure_at, arrival_at, total, currency, passengers, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'confirmed') RETURNING id`,
      [userId, trip.id, offer.id, order.data.orderId, order.data.bookingReference, offer.airline, offer.originName ?? selected.origin, offer.destinationName ?? selected.destination, offer.departure, offer.arrival, order.data.amount, order.data.currency, JSON.stringify(body.passengers.map(({ title, givenName, familyName, bornOn, gender, email }) => ({ title, givenName, familyName, bornOn, gender, email })))],
    );
    id = saved.rows[0]!.id;
  } catch (err) {
    // The airline confirmed but this trip already had a confirmed booking (two requests at once): the unique index refuses the second record.
    if ((err as { code?: string }).code === '23505') throw new AppError(409, 'A flight is already booked for this trip.', { code: 'duplicate' });
    throw err;
  }
  await sendEmail(id, userId, body.passengers[0]!.email);
  return (await getFlightBooking(trip.id)) as FlightBookingView;
}

async function sendEmail(bookingId: string, userId: string, fallbackTo: string): Promise<FlightEmailStatus> {
  const row = (await query<BookingRow & { user_email: string | null }>(`SELECT ${COLUMNS}, (SELECT email FROM users WHERE id = $2) AS user_email FROM flight_bookings WHERE id = $1`, [bookingId, userId])).rows[0];
  if (!row || row.status !== 'confirmed' || !row.booking_reference || !row.total || !row.currency) return 'failed';
  const notifier = notificationProvider();
  let status: FlightEmailStatus;
  if (!notifier.isConfigured()) status = 'not_configured';
  else {
    const sent = await notifier.sendFlightConfirmation({
      to: row.user_email ?? fallbackTo,
      bookingReference: row.booking_reference,
      airline: row.airline ?? 'the airline',
      origin: row.origin ?? '',
      destination: row.destination ?? '',
      departure: row.departure_at ? row.departure_at.toISOString() : '',
      arrival: row.arrival_at ? row.arrival_at.toISOString() : '',
      total: row.total,
      currency: row.currency.trim(),
      passengers: row.passengers.map((p) => `${p.givenName} ${p.familyName}`),
      sandbox: true,
    });
    status = sent.ok ? 'sent' : 'failed';
  }
  await query('UPDATE flight_bookings SET email_status = $2 WHERE id = $1', [bookingId, status]);
  return status;
}

export async function resendFlightEmail(trip: Trip, userId: string): Promise<{ status: FlightEmailStatus }> {
  const booking = await getFlightBooking(trip.id);
  if (!booking) throw new AppError(409, 'There is no confirmed flight booking to send.');
  const status = await sendEmail(booking.id, userId, '');
  if (status === 'failed') throw new AppError(502, 'The email could not be sent. Your booking is unaffected. Try again.', { status });
  return { status };
}
