import { recalcBudget } from '../budget/recalc.js';
import { query } from '../db.js';

export interface TripCard {
  tripId: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  /** The budget the traveler stated, when there is one. */
  budget: { amount: string; currency: string } | null;
  hotel: { status: 'not_booked' | 'pending' | 'confirmed' | 'failed'; name: string | null; room: string | null; total: { amount: string; currency: string } | null };
  transport: { status: 'compare_only' | 'not_selected'; label: string | null; bookingReference: string | null; price: { amount: string; currency: string; certainty: 'confirmed' | 'estimated' | 'unavailable'; sandbox: boolean } | null };
  places: { count: number; names: string[] };
  estimatedTotal: { amount: string | null; currency: string | null; certainty: 'confirmed' | 'estimated' | 'unavailable'; partial: boolean };
  updatedAt: string;
}

interface Row {
  id: string;
  title: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: Date;
  b_status: string | null;
  b_hotel: string | null;
  h_name: string | null;
  t_mode: string | null;
  t_origin: string | null;
  t_destination: string | null;
  total: string | null;
  total_currency: string | null;
  all_unavailable: boolean | null;
  partial: boolean | null;
  budget_amount: string | null;
  budget_currency: string | null;
  b_final_price: string | null;
  b_currency: string | null;
  b_room: string | null;
  h_room: string | null;
  h_total: string | null;
  h_currency: string | null;
  x_price: string | null;
  x_currency: string | null;
  x_certainty: 'confirmed' | 'estimated' | 'unavailable' | null;
  x_source: string | null;
  place_names: string[] | null;
  flight_ref: string | null;
}

/**
 * The signed-in user's saved trips (never drafts, never anyone else's), newest first, with booking status and the estimated total.
 * One statement: the latest booking and the budget totals come from LATERAL joins and the SQL budget functions.
 */
export async function listTrips(userId: string): Promise<TripCard[]> {
  // The totals on the cards are always current: each trip's budget is rebuilt from what is selected, booked and planned first.
  const ids = await query<{ id: string }>("SELECT id FROM trips WHERE user_id = $1 AND status <> 'draft'", [userId]);
  for (const t of ids.rows) await recalcBudget(t.id, true).catch(() => undefined);
  const res = await query<Row>(
    `SELECT t.id, t.title, t.destination, t.start_date::text, t.end_date::text, t.updated_at,
            t.budget_amount::text, t.budget_currency,
            b.status AS b_status, b.hotel_name AS b_hotel, b.final_price::text AS b_final_price, b.currency AS b_currency, b.room_name AS b_room,
            h.name AS h_name, h.room_name AS h_room, h.total_price::text AS h_total, h.currency AS h_currency,
            x.price::text AS x_price, x.currency AS x_currency, x.price_certainty AS x_certainty, x.price_source AS x_source,
            (SELECT booking_reference FROM flight_bookings f WHERE f.trip_id = t.id AND f.status = 'confirmed') AS flight_ref,
            (SELECT array_agg(p.name ORDER BY p.selected_at) FROM trip_places p WHERE p.trip_id = t.id) AS place_names,
            x.mode AS t_mode, x.origin AS t_origin, x.destination AS t_destination,
            tot.estimated_total::text AS total, tot.currency AS total_currency,
            (SELECT bool_and(s.worst_certainty = 'unavailable') FROM trip_budget_summary(t.id) s) AS all_unavailable,
            (cardinality(tot.categories_without_real_figure) > 0) AS partial
       FROM trips t
       LEFT JOIN LATERAL (SELECT status, hotel_name, final_price, currency, room_name FROM bookings WHERE trip_id = t.id AND status <> 'in_progress'
                           ORDER BY (status = 'confirmed') DESC, created_at DESC LIMIT 1) b ON true
       LEFT JOIN trip_hotels h ON h.trip_id = t.id
       LEFT JOIN trip_transport x ON x.trip_id = t.id
       LEFT JOIN LATERAL trip_budget_totals(t.id) tot ON true
      WHERE t.user_id = $1 AND t.status <> 'draft'
      ORDER BY t.updated_at DESC`,
    [userId],
  );
  return res.rows.map((r): TripCard => {
    const hotelStatus = r.b_status === 'confirmed' ? 'confirmed' : r.b_status === 'pending' ? 'pending' : r.b_status === 'failed' ? 'failed' : 'not_booked';
    const noFigure = r.total === null || r.all_unavailable === true;
    return {
      tripId: r.id,
      title: r.title ?? r.destination ?? 'Destination not chosen',
      destination: r.destination,
      startDate: r.start_date,
      endDate: r.end_date,
      budget: r.budget_amount && r.budget_currency ? { amount: r.budget_amount, currency: r.budget_currency.trim() } : null,
      hotel: {
        status: hotelStatus,
        name: r.b_hotel ?? r.h_name,
        room: r.b_hotel ? r.b_room : r.h_room,
        total: r.b_hotel && r.b_final_price && r.b_currency ? { amount: r.b_final_price, currency: r.b_currency.trim() } : r.h_total && r.h_currency ? { amount: r.h_total, currency: r.h_currency.trim() } : null,
      },
      transport: r.t_mode
        ? { status: 'compare_only', label: `${r.t_mode}, ${r.t_origin ?? ''} to ${r.t_destination ?? ''}`, bookingReference: r.flight_ref, price: r.x_price && r.x_currency && r.x_certainty ? { amount: r.x_price, currency: r.x_currency.trim(), certainty: r.x_certainty, sandbox: r.x_source === 'duffel-sandbox' } : null }
        : { status: 'not_selected', label: null, bookingReference: null, price: null },
      places: { count: r.place_names?.length ?? 0, names: r.place_names ?? [] },
      estimatedTotal: noFigure
        ? { amount: null, currency: r.total_currency?.trim() ?? null, certainty: 'unavailable', partial: true }
        : { amount: r.total, currency: r.total_currency?.trim() ?? null, certainty: 'estimated', partial: r.partial === true },
      updatedAt: r.updated_at.toISOString(),
    };
  });
}
