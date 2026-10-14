import type pg from 'pg';
import { z } from 'zod';
import { getConfig } from '../config.js';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { compareAmounts, nightsBetween } from '../providers/decimal.js';
import { hotelProvider, paymentProvider } from '../providers/index.js';
import { collapseRooms } from '../search/hotels.js';
import { getTripForOwner } from '../trips/service.js';
import { latestEmailStatus, sendConfirmationEmail, type EmailStatus } from './confirmationEmail.js';
import { atOrPast, CommitThenThrow, requireStep, SELECT_BOOKING, setBooking, withBooking, type BookingRow } from './machine.js';

// ---------------------------------------------------------------------------------------------------------------------
// Shape returned to the browser (contracts/booking-api.md)
// ---------------------------------------------------------------------------------------------------------------------

interface Priced {
  amount: string | null;
  currency: string | null;
  certainty: 'confirmed' | 'estimated' | 'unavailable';
}

export interface BookingView {
  id: string;
  tripId: string;
  status: BookingRow['status'];
  step: BookingRow['step'];
  hotel: { id: string; name: string };
  room: { id: string; name: string };
  checkin: string;
  checkout: string;
  nights: number;
  adults: number;
  childrenAges: number[];
  rooms: number;
  shownPrice: Priced;
  finalPrice: Priced | null;
  cancellation: BookingRow['cancellation'];
  guest: BookingRow['guest'];
  /** The hotel provider's booking id: null unless the booking is confirmed. A confirmation is shown only when this exists. */
  reference: string | null;
  hotelConfirmationCode: string | null;
  failureReason: string | null;
  refundPending: boolean;
  sandbox: true;
  email: { status: EmailStatus | null };
}

async function toView(row: BookingRow): Promise<BookingView> {
  const cur = row.currency.trim();
  const confirmed = row.status === 'confirmed' && row.provider_booking_id !== null;
  return {
    id: row.id,
    tripId: row.trip_id,
    status: row.status,
    step: row.step,
    hotel: { id: row.provider_hotel_id, name: row.hotel_name },
    room: { id: row.room_id, name: row.room_name },
    checkin: row.checkin,
    checkout: row.checkout,
    nights: nightsBetween(row.checkin, row.checkout),
    adults: row.adults,
    childrenAges: row.children_ages,
    rooms: row.rooms,
    shownPrice: { amount: row.shown_price, currency: cur, certainty: row.price_certainty },
    finalPrice: row.final_price ? { amount: row.final_price, currency: cur, certainty: row.price_certainty } : null,
    cancellation: row.cancellation,
    guest: row.guest,
    reference: confirmed ? row.provider_booking_id : null,
    hotelConfirmationCode: confirmed ? row.hotel_confirmation_code : null,
    failureReason: row.failure_reason,
    refundPending: row.refund_pending,
    sandbox: true,
    email: { status: confirmed ? await latestEmailStatus(row.id) : null },
  };
}

async function load(id: string, userId: string): Promise<BookingRow> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AppError(404, 'Booking not found.');
  const r = await query<BookingRow>(`${SELECT_BOOKING} WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (!r.rows[0]) throw new AppError(404, 'Booking not found.');
  return r.rows[0];
}

// ---------------------------------------------------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------------------------------------------------

export const startSchema = z
  .object({
    hotelId: z.string().min(1).max(60),
    roomId: z.string().min(1).max(120),
    roomName: z.string().max(200).optional(),
    offerId: z.string().min(1).max(4000),
    checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    shownPrice: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/),
    currency: z.string().length(3).transform((v) => v.toUpperCase()),
    rooms: z.number().int().min(1).max(10).optional(),
  })
  .strict();

/** Create the booking, or return the existing active one for the same user, room and dates (a double click never makes two). */
export async function startBooking(userId: string, tripId: string, input: z.infer<typeof startSchema>): Promise<{ booking: BookingView; created: boolean }> {
  const trip = await getTripForOwner(tripId, { userId });
  if (nightsBetween(input.checkin, input.checkout) < 1) throw new AppError(400, 'Check-out must be after check-in.');
  if (input.checkin < new Date().toISOString().slice(0, 10)) throw new AppError(400, 'The check-in date is in the past.');

  const hotel = await hotelProvider().getHotel(input.hotelId);
  if (!hotel.ok) throw new AppError(hotel.reason === 'not_found' ? 404 : 502, 'Hotel details are unavailable right now.');

  const inserted = await query<{ id: string }>(
    `INSERT INTO bookings (user_id, trip_id, provider, provider_hotel_id, hotel_name, room_id, room_name, checkin, checkout, adults, children_ages, rooms, offer_id, shown_price, currency)
     VALUES ($1,$2,'liteapi',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (user_id, provider_hotel_id, room_id, checkin, checkout) WHERE status IN ('in_progress','pending','confirmed') DO NOTHING
     RETURNING id`,
    [userId, trip.id, input.hotelId, hotel.data.name, input.roomId, input.roomName ?? 'Room', input.checkin, input.checkout, trip.adults ?? 1, trip.childrenAges, input.rooms ?? 1, input.offerId, input.shownPrice, input.currency],
  );
  if (inserted.rows[0]) return { booking: await toView(await load(inserted.rows[0].id, userId)), created: true };

  const existing = await query<BookingRow>(
    `${SELECT_BOOKING} WHERE user_id = $1 AND provider_hotel_id = $2 AND room_id = $3 AND checkin = $4 AND checkout = $5 AND status IN ('in_progress','pending','confirmed') LIMIT 1`,
    [userId, input.hotelId, input.roomId, input.checkin, input.checkout],
  );
  const row = existing.rows[0];
  if (!row) throw new AppError(409, 'Please try again.');
  if (row.status === 'confirmed') throw new AppError(409, 'You already have a confirmed booking for this room and these dates.', { code: 'duplicate_confirmed', booking: await toView(row) });
  return { booking: await toView(row), created: false };
}

export async function getBooking(userId: string, id: string): Promise<BookingView> {
  const row = await load(id, userId);
  // A booking waiting on the hotel provider (or a payment whose return never arrived) is checked each time it is opened.
  if (row.status === 'pending' || (row.status === 'in_progress' && row.step === 'pay')) await reconcileOne(id).catch((err) => console.warn('Reconcile failed:', err instanceof Error ? err.message : err));
  return toView(await load(id, userId));
}

// ---------------------------------------------------------------------------------------------------------------------
// Steps: verify -> price -> guest -> confirm -> pay
// ---------------------------------------------------------------------------------------------------------------------

function stayFrom(row: BookingRow) {
  return { checkin: row.checkin, checkout: row.checkout, adults: row.adults, childrenAges: row.children_ages, rooms: row.rooms, currency: row.currency.trim(), guestNationality: getConfig().guestNationality };
}

const unavailableError = (): AppError => new AppError(409, 'This room is no longer available.', { code: 'room_unavailable' });

/** Step 1: a live rates call for this room. Gone -> failed with no charge. A different price is shown and must be accepted. */
export async function verify(userId: string, id: string): Promise<{ booking: BookingView; availability: { available: true; price: Priced } }> {
  return withBooking(id, userId, async (db, row) => {
    requireStep(row, 'verify');
    if (atOrPast(row, 'price')) return { booking: await toView(row), availability: { available: true as const, price: { amount: row.final_price, currency: row.currency.trim(), certainty: row.price_certainty } } };

    const rates = await hotelProvider().getRates(row.provider_hotel_id, stayFrom(row));
    if (!rates.ok) throw new AppError(rates.reason === 'timeout' ? 504 : 502, 'The hotel provider did not answer. Nothing was charged. Try again.', { code: 'provider_timeout' });
    const room = collapseRooms(rates.data).find((r) => r.roomId === row.room_id);
    if (!room) {
      await setBooking(db, id, { status: 'failed', failure_reason: 'The room is no longer available.' });
      throw new CommitThenThrow(unavailableError());
    }
    await setBooking(db, id, { offer_id: room.offerId, room_name: room.name, final_price: room.total, cancellation: { refundable: room.refundable, freeUntil: room.freeUntil, text: room.cancellationText } });
    if (compareAmounts(room.total, row.shown_price) !== 0 && !row.price_change_accepted) {
      throw new CommitThenThrow(new AppError(409, `The price changed from ${row.currency.trim()} ${row.shown_price} to ${room.currency} ${room.total}.`, { code: 'price_changed', oldPrice: { amount: row.shown_price, currency: row.currency.trim() }, newPrice: { amount: room.total, currency: room.currency } }));
    }
    await setBooking(db, id, { step: 'price' });
    return { booking: await toView((await db.query<BookingRow>(`${SELECT_BOOKING} WHERE id = $1`, [id])).rows[0]!), availability: { available: true as const, price: { amount: room.total, currency: room.currency, certainty: 'confirmed' as const } } };
  });
}

/** The traveler accepts the latest quoted price. It must equal what the server holds: a stale quote is refused. */
export async function acceptPrice(userId: string, id: string, body: { amount: string; currency: string }): Promise<BookingView> {
  return withBooking(id, userId, async (db, row) => {
    requireStep(row, 'verify');
    if (!row.final_price || compareAmounts(row.final_price, body.amount) !== 0 || row.currency.trim() !== body.currency.toUpperCase()) {
      throw new AppError(409, 'That price is out of date. Please review the latest price.', { code: 'stale_quote' });
    }
    await setBooking(db, id, { price_change_accepted: true, ...(row.step === 'verify' ? { step: 'price' } : {}) });
    return toView((await db.query<BookingRow>(`${SELECT_BOOKING} WHERE id = $1`, [id])).rows[0]!);
  });
}

/** Step 2: lock the price and terms with the provider (prebook). Any change in price, cancellation or board must be accepted. */
export async function priceAndTerms(userId: string, id: string): Promise<{ booking: BookingView; price: Priced; cancellation: BookingRow['cancellation'] }> {
  return withBooking(id, userId, async (db, row) => {
    requireStep(row, 'price');
    const out = (r: BookingRow) => ({ price: { amount: r.final_price, currency: r.currency.trim(), certainty: r.price_certainty } as Priced, cancellation: r.cancellation });
    if (atOrPast(row, 'guest')) return { booking: await toView(row), ...out(row) };
    // Prebook already done and any change accepted: move on.
    if (row.prebook_id && row.price_change_accepted) {
      await setBooking(db, id, { step: 'guest' });
      const fresh = (await db.query<BookingRow>(`${SELECT_BOOKING} WHERE id = $1`, [id])).rows[0]!;
      return { booking: await toView(fresh), ...out(fresh) };
    }

    const pb = await hotelProvider().prebook(row.offer_id);
    if (!pb.ok) {
      if (pb.detail === 'room_unavailable') {
        await setBooking(db, id, { status: 'failed', failure_reason: 'The room is no longer available.' });
        throw new CommitThenThrow(unavailableError());
      }
      throw new AppError(pb.reason === 'timeout' ? 504 : 502, 'The hotel provider did not answer. Nothing was charged. Try again.', { code: 'provider_timeout' });
    }
    const p = pb.data;
    const cancellation = { refundable: p.refundable, freeUntil: p.freeUntil, text: p.cancellationText };
    const priceChanged = row.final_price === null || compareAmounts(p.price, row.final_price) !== 0 || p.priceDifferencePercent !== 0;
    const termsChanged = p.cancellationChanged || p.boardChanged;
    if (priceChanged || termsChanged) {
      await setBooking(db, id, { prebook_id: p.prebookId, final_price: p.price, cancellation, price_change_accepted: false });
      throw new CommitThenThrow(
        new AppError(409, priceChanged ? `The price changed from ${row.currency.trim()} ${row.final_price} to ${p.currency} ${p.price}.` : 'The cancellation terms or meal plan changed.', {
          code: priceChanged ? 'price_changed' : 'terms_changed',
          oldPrice: { amount: row.final_price, currency: row.currency.trim() },
          newPrice: { amount: p.price, currency: p.currency },
          cancellation,
        }),
      );
    }
    await setBooking(db, id, { prebook_id: p.prebookId, cancellation, step: 'guest' });
    const fresh = (await db.query<BookingRow>(`${SELECT_BOOKING} WHERE id = $1`, [id])).rows[0]!;
    return { booking: await toView(fresh), ...out(fresh) };
  });
}

export const guestSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter a first name.').max(60),
    lastName: z.string().trim().min(1, 'Enter a last name.').max(60),
    email: z.string().trim().email('Enter a valid email address.').max(200),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number, for example +33 1 23 45 67 89.'),
    specialRequests: z.string().trim().max(500, 'Keep this under 500 characters.').optional(),
  })
  .strict();

/** Step 3: guest details (validated). Special requests are stored as data and never followed as instructions. */
export async function saveGuest(userId: string, id: string, input: z.infer<typeof guestSchema>): Promise<BookingView> {
  return withBooking(id, userId, async (db, row) => {
    requireStep(row, 'guest');
    if (row.step === 'pay') throw new AppError(409, 'Details cannot be changed once payment has started.', { code: 'wrong_step' });
    await setBooking(db, id, { guest: input, step: 'confirm' });
    return toView((await db.query<BookingRow>(`${SELECT_BOOKING} WHERE id = $1`, [id])).rows[0]!);
  });
}

/** Step 4 to 5: create the payment for the accepted price. The same call again returns the same payment (idempotency key). */
export async function confirm(userId: string, id: string): Promise<{ booking: BookingView; clientSecret: string }> {
  return withBooking(id, userId, async (db, row) => {
    requireStep(row, 'confirm');
    if (!row.guest || !row.final_price || !row.prebook_id) throw new AppError(409, 'Finish the earlier steps first.', { code: 'wrong_step' });
    let paid;
    try {
      paid = await paymentProvider().createPayment({ bookingId: id, amount: row.final_price, currency: row.currency.trim(), idempotencyKey: `pi_${id}` });
    } catch (err) {
      throw new AppError(400, err instanceof Error ? err.message : 'That amount cannot be charged.');
    }
    if (!paid.ok) throw new AppError(502, 'The payment service is unavailable. Nothing was charged. Try again.', { code: 'payment_unavailable' });
    await db.query(
      `INSERT INTO payment_attempts (booking_id, stripe_payment_intent_id, amount, currency, status) VALUES ($1, $2, $3, $4, 'created') ON CONFLICT (stripe_payment_intent_id) DO NOTHING`,
      [id, paid.data.paymentId, row.final_price, row.currency.trim()],
    );
    if (row.step !== 'pay') await setBooking(db, id, { step: 'pay' });
    return { booking: await toView((await db.query<BookingRow>(`${SELECT_BOOKING} WHERE id = $1`, [id])).rows[0]!), clientSecret: paid.data.clientSecret };
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// After payment
// ---------------------------------------------------------------------------------------------------------------------

async function markConfirmed(db: pg.PoolClient, row: BookingRow, r: { bookingId: string; hotelConfirmationCode: string | null }): Promise<void> {
  await setBooking(db, row.id, { status: 'confirmed', step: 'done', provider_booking_id: r.bookingId, provider_status: 'CONFIRMED', hotel_confirmation_code: r.hotelConfirmationCode, confirmed_at: new Date(), failure_reason: null });
  await db.query("UPDATE trips SET status = 'booked', updated_at = now() WHERE id = $1", [row.trip_id]);
}

/** The payment was taken but the hotel did not book: give the money back and say so. If the refund itself fails it is retried. */
async function refundAndFail(db: pg.PoolClient, row: BookingRow, paymentId: string, reason: string): Promise<void> {
  const refund = await paymentProvider().refund({ paymentId, idempotencyKey: `rf_${row.id}` });
  if (refund.ok) {
    await db.query("UPDATE payment_attempts SET status = 'refunded', refund_id = $2, updated_at = now() WHERE stripe_payment_intent_id = $1", [paymentId, refund.data.refundId]);
    await setBooking(db, row.id, { status: 'failed', failure_reason: `${reason} Your payment was refunded.`, refund_pending: false });
  } else {
    await setBooking(db, row.id, { status: 'failed', failure_reason: `${reason} Your refund is being processed.`, refund_pending: true });
  }
}

/** Book with the hotel provider after a successful payment. Returns true when the booking just became confirmed. */
async function bookAfterPayment(db: pg.PoolClient, row: BookingRow, paymentId: string): Promise<boolean> {
  if (!row.guest || !row.prebook_id) {
    await refundAndFail(db, row, paymentId, 'The booking details were incomplete.');
    return false;
  }
  const result = await hotelProvider().book({ prebookId: row.prebook_id, clientReference: row.id, rooms: row.rooms, holder: { firstName: row.guest.firstName, lastName: row.guest.lastName, email: row.guest.email, phone: row.guest.phone } }, getConfig().bookTimeoutMs);

  if (result.ok && result.data.status === 'CONFIRMED') {
    await markConfirmed(db, row, result.data);
    return true;
  }
  if (result.ok) {
    await refundAndFail(db, row, paymentId, 'The hotel did not confirm the booking.');
    return false;
  }
  if (result.reason === 'timeout') {
    // Outcome unknown: payment taken, hotel not heard from. Wait and reconcile; never report a confirmation.
    await db.query("UPDATE payment_attempts SET status = 'awaiting_return', updated_at = now() WHERE stripe_payment_intent_id = $1", [paymentId]);
    await setBooking(db, row.id, { status: 'pending', step: 'done' });
    return false;
  }
  if (result.detail === 'room_unavailable') {
    await refundAndFail(db, row, paymentId, 'The room was no longer available.');
    return false;
  }
  // Duplicate reference or any other error: ask the provider what it holds under our reference before deciding.
  const found = await hotelProvider().getBooking(row.id);
  if (found.ok && found.data?.status === 'CONFIRMED') {
    await markConfirmed(db, row, found.data);
    return true;
  }
  if (found.ok && found.data === null) {
    await refundAndFail(db, row, paymentId, 'The hotel provider could not complete the booking.');
    return false;
  }
  await db.query("UPDATE payment_attempts SET status = 'awaiting_return', updated_at = now() WHERE stripe_payment_intent_id = $1", [paymentId]);
  await setBooking(db, row.id, { status: 'pending', step: 'done' });
  return false;
}

/**
 * The browser says it paid. The payment is checked server-side (status, amount, currency, booking id) before anything is booked,
 * and a booking is confirmed only when the hotel provider says CONFIRMED. Repeating the call returns the stored outcome.
 */
export async function complete(userId: string, id: string, paymentIntentId: string): Promise<BookingView> {
  let sendEmail: BookingRow | null = null;
  const view = await withBooking(id, userId, async (db, row) => {
    if (row.status === 'confirmed' || row.status === 'pending' || row.status === 'failed') return toView(row);
    requireStep(row, 'pay');

    const attempt = await db.query<{ stripe_payment_intent_id: string; amount: string; currency: string }>('SELECT stripe_payment_intent_id, amount::text, currency FROM payment_attempts WHERE booking_id = $1 AND stripe_payment_intent_id = $2', [id, paymentIntentId]);
    if (!attempt.rows[0]) throw new AppError(400, 'That payment does not belong to this booking.');

    const info = await paymentProvider().getPayment(paymentIntentId);
    if (!info.ok) throw new AppError(502, 'The payment service is unavailable. Your booking is unchanged. Try again.', { code: 'payment_unavailable' });
    const p = info.data;
    if (p.status === 'failed') {
      await db.query("UPDATE payment_attempts SET status = 'failed', failure_code = $2, updated_at = now() WHERE stripe_payment_intent_id = $1", [paymentIntentId, p.failureCode ?? 'payment_failed']);
      throw new CommitThenThrow(new AppError(402, p.failureMessage ?? 'The payment was not accepted.', { code: 'payment_failed', reason: p.failureMessage ?? 'The payment was not accepted.' }));
    }
    if (p.status !== 'succeeded') throw new AppError(409, 'The payment is not complete yet.', { code: 'payment_incomplete' });
    if (compareAmounts(p.amount, row.final_price ?? '0') !== 0 || p.currency !== row.currency.trim() || p.bookingId !== id) {
      throw new AppError(409, 'The payment does not match this booking, so nothing was booked.', { code: 'payment_mismatch' });
    }
    await db.query("UPDATE payment_attempts SET status = 'succeeded', updated_at = now() WHERE stripe_payment_intent_id = $1", [paymentIntentId]);

    const confirmed = await bookAfterPayment(db, row, paymentIntentId);
    const fresh = (await db.query<BookingRow>(`${SELECT_BOOKING} WHERE id = $1`, [id])).rows[0]!;
    if (confirmed) sendEmail = fresh;
    return toView(fresh);
  });
  // The email goes after the booking is stored and never affects it.
  if (sendEmail) {
    await sendConfirmationEmail(sendEmail);
    return toView(await load(id, userId));
  }
  return view;
}

export async function resend(userId: string, id: string): Promise<{ status: EmailStatus }> {
  const row = await load(id, userId);
  if (row.status !== 'confirmed') throw new AppError(409, 'Only a confirmed booking has a confirmation to send.');
  const status = await sendConfirmationEmail(row);
  if (status === 'failed') throw new AppError(502, 'The email could not be sent. Your booking is unaffected. Try again.', { status });
  return { status };
}

// ---------------------------------------------------------------------------------------------------------------------
// Reconciliation (the substitute for payment webhooks)
// ---------------------------------------------------------------------------------------------------------------------

const GIVE_UP_MS = 15 * 60_000;

/** Settle one booking that is waiting on something outside: the hotel provider, a payment return, or a refund. */
export async function reconcileOne(id: string): Promise<void> {
  let sendEmail: BookingRow | null = null;
  await withBooking(id, null, async (db, row) => {
    const attempt = (await db.query<{ stripe_payment_intent_id: string; status: string; updated_at: Date }>(
      "SELECT stripe_payment_intent_id, status, updated_at FROM payment_attempts WHERE booking_id = $1 ORDER BY id DESC LIMIT 1", [id])).rows[0];

    if (row.status === 'failed' && row.refund_pending && attempt) {
      await refundAndFail(db, row, attempt.stripe_payment_intent_id, row.failure_reason?.replace(/ Your (payment was refunded|refund is being processed)\.$/, '') ?? 'The booking failed.');
      return;
    }
    if (row.status === 'pending' && attempt) {
      const found = await hotelProvider().getBooking(id);
      if (!found.ok) return; // cannot tell: stay pending
      if (found.data?.status === 'CONFIRMED') {
        await markConfirmed(db, row, found.data);
        sendEmail = (await db.query<BookingRow>(`${SELECT_BOOKING} WHERE id = $1`, [id])).rows[0]!;
      } else if (found.data || Date.now() - row.created_at.getTime() > GIVE_UP_MS) {
        await refundAndFail(db, row, attempt.stripe_payment_intent_id, 'The hotel did not confirm the booking.');
      }
      return;
    }
    // Paid in the browser but the browser never came back (closed tab): finish it from the payment itself.
    if (row.status === 'in_progress' && row.step === 'pay' && attempt && attempt.status === 'created' && Date.now() - attempt.updated_at.getTime() > 2 * 60_000) {
      const info = await paymentProvider().getPayment(attempt.stripe_payment_intent_id);
      if (info.ok && info.data.status === 'succeeded' && compareAmounts(info.data.amount, row.final_price ?? '0') === 0 && info.data.bookingId === id) {
        await db.query("UPDATE payment_attempts SET status = 'succeeded', updated_at = now() WHERE stripe_payment_intent_id = $1", [attempt.stripe_payment_intent_id]);
        if (await bookAfterPayment(db, row, attempt.stripe_payment_intent_id)) sendEmail = (await db.query<BookingRow>(`${SELECT_BOOKING} WHERE id = $1`, [id])).rows[0]!;
      }
    }
  });
  if (sendEmail) await sendConfirmationEmail(sendEmail);
}

export async function reconcileAll(): Promise<void> {
  const r = await query<{ id: string }>(
    `SELECT b.id FROM bookings b
      WHERE b.status = 'pending'
         OR (b.status = 'failed' AND b.refund_pending)
         OR (b.status = 'in_progress' AND b.step = 'pay' AND EXISTS (SELECT 1 FROM payment_attempts p WHERE p.booking_id = b.id AND p.status = 'created' AND p.updated_at < now() - interval '2 minutes'))`,
  );
  for (const row of r.rows) await reconcileOne(row.id).catch((err) => console.warn(`Reconcile ${row.id} failed:`, err instanceof Error ? err.message : err));
}
