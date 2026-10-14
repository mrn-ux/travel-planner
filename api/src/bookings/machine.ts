import type pg from 'pg';
import { getPool } from '../db.js';
import { AppError } from '../errors.js';

export type Step = 'verify' | 'price' | 'guest' | 'confirm' | 'pay' | 'done';
export type Status = 'in_progress' | 'pending' | 'confirmed' | 'failed';

const ORDER: Step[] = ['verify', 'price', 'guest', 'confirm', 'pay', 'done'];

export interface BookingRow {
  id: string;
  user_id: string;
  trip_id: string;
  status: Status;
  step: Step;
  provider: string;
  provider_hotel_id: string;
  hotel_name: string;
  room_id: string;
  room_name: string;
  checkin: string;
  checkout: string;
  adults: number;
  children_ages: number[];
  rooms: number;
  offer_id: string;
  prebook_id: string | null;
  shown_price: string;
  final_price: string | null;
  currency: string;
  price_source: string;
  price_certainty: 'confirmed' | 'estimated' | 'unavailable';
  price_change_accepted: boolean;
  cancellation: { refundable: boolean; freeUntil: string | null; text: string } | null;
  guest: { firstName: string; lastName: string; email: string; phone: string; specialRequests?: string } | null;
  provider_booking_id: string | null;
  provider_status: string | null;
  hotel_confirmation_code: string | null;
  failure_reason: string | null;
  refund_pending: boolean;
  created_at: Date;
  confirmed_at: Date | null;
}

/** Throw this from a transition to keep what it stored (for example a new quote) and still answer with the error. */
export class CommitThenThrow extends Error {
  constructor(public readonly error: AppError) {
    super(error.message);
  }
}

export const SELECT_BOOKING =
  `SELECT id, user_id, trip_id, status, step, provider, provider_hotel_id, hotel_name, room_id, room_name, checkin::text, checkout::text, adults, children_ages, rooms,
          offer_id, prebook_id, shown_price::text, final_price::text, currency, price_source, price_certainty, price_change_accepted, cancellation, guest,
          provider_booking_id, provider_status, hotel_confirmation_code, failure_reason, refund_pending, created_at, confirmed_at
     FROM bookings`;

/** Steps only move forward and never skip: a call for a step needs the previous one stored. */
export function requireStep(row: BookingRow, expected: Step): void {
  if (row.status !== 'in_progress') throw new AppError(409, row.status === 'confirmed' ? 'This booking is already confirmed.' : 'This booking can no longer be changed.', { code: 'wrong_step' });
  if (ORDER.indexOf(row.step) < ORDER.indexOf(expected)) throw new AppError(409, 'Finish the earlier steps first.', { code: 'wrong_step' });
}

export const atOrPast = (row: BookingRow, step: Step): boolean => ORDER.indexOf(row.step) >= ORDER.indexOf(step);

/**
 * Run one transition with the booking row locked (SELECT ... FOR UPDATE). Two clicks, two tabs or a reload serialise here: the
 * second caller waits, then sees the stored result of the first and answers from it instead of repeating the work.
 */
export async function withBooking<T>(id: string, userId: string | null, fn: (db: pg.PoolClient, row: BookingRow) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AppError(404, 'Booking not found.');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const res = await client.query<BookingRow>(`${SELECT_BOOKING} WHERE id = $1 AND ($2::uuid IS NULL OR user_id = $2) FOR UPDATE`, [id, userId]);
    const row = res.rows[0];
    if (!row) throw new AppError(404, 'Booking not found.');
    const out = await fn(client, row);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    if (err instanceof CommitThenThrow) {
      await client.query('COMMIT');
      throw err.error;
    }
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function setBooking(db: pg.PoolClient, id: string, fields: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(fields);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await db.query(`UPDATE bookings SET ${sets}, updated_at = now() WHERE id = $1`, [id, ...keys.map((k) => (k === 'cancellation' || k === 'guest' ? JSON.stringify(fields[k]) : fields[k]))]);
}
