import { buildPlan, type Plan } from '../budget/plan.js';
import { query } from '../db.js';
import { getTripById, type Trip } from '../trips/service.js';

export interface BookingSummary {
  status: 'in_progress' | 'pending' | 'confirmed' | 'failed';
  reference: string | null;
  hotelConfirmationCode: string | null;
  hotelName: string;
  roomName: string;
  checkin: string;
  checkout: string;
  finalPrice: string | null;
  currency: string;
}

export interface TransportDetail {
  mode: string;
  origin: string;
  destination: string;
  departure: string | null;
  arrival: string | null;
  durationMinutes: number | null;
  operator: string | null;
  scheduleCertainty: 'confirmed' | 'estimated' | 'unavailable';
}

export interface PlanData {
  trip: Trip;
  plan: Plan;
  booking: BookingSummary | null;
  transport: TransportDetail | null;
  /** The flight booked in the airline test service, when there is one. */
  flightBooking: { reference: string; airline: string | null; total: string | null; currency: string | null } | null;
  generatedAt: Date;
}

/**
 * Everything the plan file shows, read from the database as it is right now. Nothing is fetched from a provider and nothing is
 * stored: no suggestions are made and no copy of the file is kept. Amounts stay decimal strings from SQL.
 */
export async function buildPlanData(tripId: string): Promise<PlanData> {
  const [plan, trip] = await Promise.all([buildPlan(tripId, { proposals: false }), getTripById(tripId)]);

  const b = await query<{ status: BookingSummary['status']; provider_booking_id: string | null; hotel_confirmation_code: string | null; hotel_name: string; room_name: string; checkin: string; checkout: string; final_price: string | null; currency: string }>(
    `SELECT status, provider_booking_id, hotel_confirmation_code, hotel_name, room_name, checkin::text, checkout::text, final_price::text, currency
       FROM bookings WHERE trip_id = $1 AND status IN ('confirmed','pending') ORDER BY (status = 'confirmed') DESC, created_at DESC LIMIT 1`,
    [tripId],
  );
  const t = await query<{ mode: string; origin: string; destination: string; departure_at: Date | null; arrival_at: Date | null; duration_minutes: number | null; operator: string | null; schedule_certainty: TransportDetail['scheduleCertainty'] }>(
    'SELECT mode, origin, destination, departure_at, arrival_at, duration_minutes, operator, schedule_certainty FROM trip_transport WHERE trip_id = $1',
    [tripId],
  );
  const f = await query<{ booking_reference: string | null; airline: string | null; total: string | null; currency: string | null }>(
    "SELECT booking_reference, airline, total::text, currency FROM flight_bookings WHERE trip_id = $1 AND status = 'confirmed'",
    [tripId],
  );
  const fb = f.rows[0];
  const bk = b.rows[0];
  const tr = t.rows[0];
  return {
    trip,
    plan,
    booking: bk
      ? { status: bk.status, reference: bk.status === 'confirmed' ? bk.provider_booking_id : null, hotelConfirmationCode: bk.hotel_confirmation_code, hotelName: bk.hotel_name, roomName: bk.room_name, checkin: bk.checkin, checkout: bk.checkout, finalPrice: bk.final_price, currency: bk.currency.trim() }
      : null,
    transport: tr
      ? { mode: tr.mode, origin: tr.origin, destination: tr.destination, departure: tr.departure_at?.toISOString() ?? null, arrival: tr.arrival_at?.toISOString() ?? null, durationMinutes: tr.duration_minutes, operator: tr.operator, scheduleCertainty: tr.schedule_certainty }
      : null,
    flightBooking: fb && fb.booking_reference ? { reference: fb.booking_reference, airline: fb.airline, total: fb.total, currency: fb.currency?.trim() ?? null } : null,
    generatedAt: new Date(),
  };
}
