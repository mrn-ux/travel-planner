import type { Certainty } from '../agent/envelope.js';
import { query } from '../db.js';
import type { Priced } from '../search/hotels.js';
import { getTripById } from '../trips/service.js';
import { generateProposals, listProposals, type Proposal } from './proposals.js';
import { recalcBudget } from './recalc.js';

export interface PlanBudget {
  categories: Array<{ category: string; amount: string; certainty: Certainty; missingCount: number; itemCount: number; share: number }>;
  estimatedTotal: string;
  budget: string | null;
  remaining: string | null;
  currency: string;
  partial: boolean;
  categoriesWithoutRealFigure: string[];
}

export interface PlanItem {
  id: number;
  slot: 'morning' | 'afternoon' | 'evening';
  kind: 'activity' | 'meal' | 'rest';
  title: string;
  startsAt: string | null;
  durationMinutes: number | null;
  cost: Priced;
  openingHours: string | null;
  travelMinutesToNext: number | null;
  travelCertainty: Certainty | null;
  source: string;
  sourceUrl: string | null;
}

export interface Plan {
  trip: { id: string; title: string; destination: string | null; startDate: string | null; endDate: string | null; currency: string };
  budget: PlanBudget;
  overBudget: { over: boolean; amount: string | null };
  proposals: Proposal[];
  itinerary: Array<{ day: number; date: string; place: string | null; note: string | null; items: PlanItem[] }>;
  selectedHotel: { hotelId: string | null; name: string; booked: boolean; roomName: string | null; checkin: string; checkout: string; price: Priced; total: Priced; sandbox: true } | null;
  selectedTransport: { label: string; mode: string; operator: string | null; departureAt: string | null; price: Priced; scheduleCertainty: Certainty; bookable: boolean; booked: boolean; bookingReference: string | null } | null;
  /** The places to visit the traveler chose. Opening hours and entry are as the map data states them (null / unknown when it does not). */
  selectedPlaces: Array<{ id: string; name: string; kind: string; openingHours: string | null; entry: { kind: 'free' | 'paid' | 'unknown'; charge: string | null } }>;
  generatedAt: string;
}

/** Everything the planner screen shows. Totals, remaining and "over budget" all come from SQL functions. */
export async function buildPlan(tripId: string, opts: { proposals?: boolean } = {}): Promise<Plan> {
  const withProposals = opts.proposals !== false;
  await recalcBudget(tripId, true); // always current: dates, travelers, selections and itinerary may have changed
  const trip = await getTripById(tripId);

  const cats = await query<{ category: string; amount: string; item_count: string; missing_count: string; worst_certainty: Certainty; share: number }>(
    `SELECT category, amount::text, item_count::text, missing_count::text, worst_certainty,
            (CASE WHEN SUM(amount) OVER () > 0 THEN round(amount * 100 / SUM(amount) OVER (), 2) ELSE 0 END)::float AS share
       FROM trip_budget_summary($1)`,
    [tripId],
  );
  const order = ['hotels', 'transportation', 'activities', 'food', 'local_transport', 'miscellaneous'];
  const totals = await query<{ estimated_total: string; budget: string | null; remaining: string | null; currency: string | null; without: string[]; over: boolean | null; overage: string | null }>(
    `SELECT estimated_total::text, budget::text, remaining::text, currency, categories_without_real_figure AS without,
            (remaining < 0) AS over, CASE WHEN remaining < 0 THEN (-remaining)::text END AS overage
       FROM trip_budget_totals($1)`,
    [tripId],
  );
  const t = totals.rows[0];
  const currency = (t?.currency ?? trip.budget?.currency ?? 'USD').trim();

  let proposals: Proposal[] = [];
  const over = t?.over === true;
  if (!withProposals) {
    // Read-only use (the plan file): no suggestions are made and nothing is changed.
  } else if (over) {
    proposals = await listProposals(tripId);
    if (proposals.length === 0) proposals = await generateProposals(trip);
  } else {
    await query("DELETE FROM budget_proposals WHERE trip_id = $1 AND status = 'proposed'", [tripId]);
  }

  const days = await query<{ id: string; day_no: number; day_date: string; place: string | null; note: string | null }>('SELECT id::text, day_no, day_date::text, place, note FROM itinerary_days WHERE trip_id = $1 ORDER BY day_no', [tripId]);
  const items = await query<{
    id: string; day_id: string; slot: PlanItem['slot']; kind: PlanItem['kind']; title: string; starts_at: string | null; duration_minutes: number | null; cost: string | null; cost_currency: string | null;
    cost_certainty: Certainty; opening_hours_text: string | null; travel_minutes_to_next: number | null; travel_certainty: Certainty | null; source: string; source_url: string | null;
  }>(
    `SELECT i.id::text, i.day_id::text, i.slot, i.kind, i.title, to_char(i.starts_at, 'HH24:MI') AS starts_at, i.duration_minutes, i.cost::text, i.cost_currency, i.cost_certainty, i.opening_hours_text,
            i.travel_minutes_to_next, i.travel_certainty, i.source, i.source_url
       FROM itinerary_items i JOIN itinerary_days d ON d.id = i.day_id WHERE d.trip_id = $1 ORDER BY d.day_no, i.starts_at, i.position`,
    [tripId],
  );

  const hotel = await query<{ hotel_id: string | null; name: string; room_name: string | null; checkin: string; checkout: string; nightly_rate: string | null; total_price: string | null; currency: string | null; price_certainty: Certainty }>(
    'SELECT provider_hotel_id AS hotel_id, name, room_name, checkin::text, checkout::text, nightly_rate::text, total_price::text, currency, price_certainty FROM trip_hotels WHERE trip_id = $1',
    [tripId],
  );
  const flightRef = (await query<{ provider_ref: string | null; provider: string }>('SELECT provider_ref, provider FROM trip_transport WHERE trip_id = $1', [tripId])).rows[0];
  const flightBooked = (await query<{ booking_reference: string | null }>("SELECT booking_reference FROM flight_bookings WHERE trip_id = $1 AND status = 'confirmed'", [tripId])).rows[0];
  const tr = await query<{ departure_at: string | null; mode: string; origin: string; destination: string; price: string | null; currency: string | null; price_certainty: Certainty; price_basis: string | null; price_low: string | null; price_high: string | null; schedule_certainty: Certainty; operator: string | null }>(
    'SELECT to_char(departure_at AT TIME ZONE \'UTC\', \'YYYY-MM-DD"T"HH24:MI\') AS departure_at, mode, origin, destination, price::text, currency, price_certainty, price_basis, price_low::text, price_high::text, schedule_certainty, operator FROM trip_transport WHERE trip_id = $1',
    [tripId],
  );
  // A confirmed booking is the trip's hotel: shown even when no room was "selected" on the way to it, and over any earlier pick.
  const bookedRow = (
    await query<{ hotel_id: string | null; name: string; room_name: string | null; checkin: string; checkout: string; nightly_rate: string | null; total_price: string | null; currency: string | null; price_certainty: Certainty }>(
      `SELECT provider_hotel_id AS hotel_id, hotel_name AS name, room_name, checkin::text, checkout::text,
              round(final_price / GREATEST(checkout - checkin, 1), 2)::text AS nightly_rate, final_price::text AS total_price, currency, 'confirmed' AS price_certainty
         FROM bookings WHERE trip_id = $1 AND status = 'confirmed' AND final_price IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [tripId],
    )
  ).rows[0];
  const h = bookedRow ?? hotel.rows[0];
  const booked = (await query<{ n: string }>("SELECT count(*) AS n FROM bookings WHERE trip_id = $1 AND status = 'confirmed'", [tripId])).rows[0]?.n !== '0';
  const x = tr.rows[0];

  return {
    trip: { id: trip.id, title: trip.title ?? (trip.destination ? `Trip to ${trip.destination}` : 'Your trip'), destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, currency },
    budget: {
      categories: order.map((c) => {
        const r = cats.rows.find((y) => y.category === c);
        return { category: c, amount: r?.amount ?? '0.00', certainty: r?.worst_certainty ?? 'unavailable', missingCount: Number(r?.missing_count ?? 0), itemCount: Number(r?.item_count ?? 0), share: r?.share ?? 0 };
      }),
      estimatedTotal: t?.estimated_total ?? '0.00',
      budget: t?.budget ?? null,
      remaining: t?.remaining ?? null,
      currency,
      partial: (t?.without ?? []).length > 0,
      categoriesWithoutRealFigure: t?.without ?? [],
    },
    overBudget: { over, amount: t?.overage ?? null },
    proposals,
    itinerary: days.rows.map((d) => ({
      day: d.day_no,
      date: d.day_date,
      place: d.place,
      note: d.note,
      items: items.rows
        .filter((i) => i.day_id === d.id)
        .map((i) => ({
          id: Number(i.id), slot: i.slot, kind: i.kind, title: i.title, startsAt: i.starts_at, durationMinutes: i.duration_minutes,
          cost: { amount: i.cost, currency: i.cost_currency, certainty: i.cost_certainty }, openingHours: i.opening_hours_text,
          travelMinutesToNext: i.travel_minutes_to_next, travelCertainty: i.travel_certainty, source: i.source, sourceUrl: i.source_url,
        })),
    })),
    selectedHotel: h
      ? {
          hotelId: h.hotel_id, name: h.name, booked, roomName: h.room_name, checkin: h.checkin, checkout: h.checkout,
          price: { amount: h.nightly_rate, currency: h.currency, certainty: h.price_certainty }, total: { amount: h.total_price, currency: h.currency, certainty: h.price_certainty }, sandbox: true,
        }
      : null,
    selectedTransport: x
      ? {
          label: `${x.mode}, ${x.origin} to ${x.destination}${x.operator ? ` (${x.operator})` : ''}`, mode: x.mode, operator: x.operator, departureAt: x.departure_at, scheduleCertainty: x.schedule_certainty,
          bookable: flightRef?.provider === 'duffel' && Boolean(flightRef.provider_ref), booked: Boolean(flightBooked), bookingReference: flightBooked?.booking_reference ?? null,
          price: { amount: x.price, currency: x.currency, certainty: x.price_certainty, ...(x.price_low && x.price_high ? { range: { low: x.price_low, high: x.price_high } } : {}), ...(x.price_basis ? { basis: x.price_basis } : {}) },
        }
      : null,
    selectedPlaces: (
      await query<{ place_id: string; name: string; kind: string; opening_hours: string | null; entry_kind: 'free' | 'paid' | 'unknown'; charge: string | null }>(
        'SELECT place_id, name, kind, opening_hours, entry_kind, charge FROM trip_places WHERE trip_id = $1 ORDER BY selected_at',
        [tripId],
      )
    ).rows.map((r) => ({ id: r.place_id, name: r.name, kind: r.kind, openingHours: r.opening_hours, entry: { kind: r.entry_kind, charge: r.charge } })),
    generatedAt: new Date().toISOString(),
  };
}
