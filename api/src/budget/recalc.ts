import { query } from '../db.js';
import { getTripById } from '../trips/service.js';
import { convertAmount } from './convert.js';

/**
 * Allowances for the two categories that have no price source (spec 006 R2). They are illustrative USD figures held in one
 * place, always converted to the trip currency, always labelled Estimated "Faro estimate, not a quote" with this basis.
 */
export const ALLOWANCES = {
  /** Food per person per day. */
  foodAdultUsd: '45.00',
  foodChildUsd: '25.00',
  /** Local transport per person per day. */
  localTransportUsd: '8.00',
  /** Miscellaneous as a share of the other categories (computed in SQL). */
  miscShare: '0.05',
} as const;

const BASIS = 'Faro estimate, not a quote';

type Certainty = 'confirmed' | 'estimated' | 'unavailable';

interface Item {
  category: 'hotels' | 'transportation' | 'activities' | 'food' | 'local_transport' | 'miscellaneous';
  label: string;
  /** Original amount (decimal string) or null when unavailable. */
  amount: string | null;
  currency: string | null;
  certainty: Certainty;
  source: string;
  sourceUrl: string | null;
  fetchedAt: string | null;
  refType?: string;
  refId?: string;
}

/** Insert one item, converting into the trip currency with the stored rate. Unconvertible amounts are stored as unavailable. */
async function insertItem(tripId: string, tripCurrency: string, date: string, it: Item): Promise<void> {
  let amountTrip: string | null = null;
  let fxRateId: number | null = null;
  let certainty = it.certainty;

  if (it.amount !== null && it.currency) {
    const c = await convertAmount(it.amount, it.currency, tripCurrency, date);
    if (c) {
      amountTrip = c.converted;
      fxRateId = c.fxRateId;
      if (c.certainty === 'estimated' && certainty === 'confirmed') certainty = 'estimated'; // converted: never Confirmed
    } else {
      certainty = 'unavailable'; // no stored rate: unavailable, not zero
    }
  } else {
    certainty = 'unavailable';
  }
  await query(
    `INSERT INTO budget_items (trip_id, category, label, amount, currency, amount_trip, fx_rate_id, source, source_url, certainty, fetched_at, ref_type, ref_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [tripId, it.category, it.label, it.amount, it.amount !== null ? it.currency : null, amountTrip, fxRateId, it.source, it.sourceUrl, certainty, it.fetchedAt, it.refType ?? null, it.refId ?? null],
  );
}

/** Multiplication done by the database: no money arithmetic in application code. */
async function times(amount: string, factor: number): Promise<string> {
  const r = await query<{ v: string }>('SELECT round($1::numeric * $2::numeric, 2)::text AS v', [amount, factor]);
  return r.rows[0]!.v;
}

/**
 * Rebuild the trip's budget items from what is selected and planned: hotel stay, transport (outbound and return),
 * itinerary activity costs, food, local transport and a miscellaneous share. Totals are never computed here: the SQL
 * functions trip_budget_summary and trip_budget_totals do that.
 */
export async function recalcBudget(tripId: string, keepProposals = false): Promise<void> {
  const trip = await getTripById(tripId);
  const currency = trip.budget?.currency ?? 'USD';
  const date = trip.startDate ?? new Date().toISOString().slice(0, 10);

  await query('DELETE FROM budget_items WHERE trip_id = $1', [tripId]);
  // Open proposals were worked out for the old figures: they are made again for the new ones.
  if (!keepProposals) await query("DELETE FROM budget_proposals WHERE trip_id = $1 AND status = 'proposed'", [tripId]);

  // ---- Hotel ---------------------------------------------------------------------------------------------------------------
  const hotel = await query<{ name: string; checkin: string; checkout: string; total_price: string | null; currency: string | null; price_certainty: Certainty; source_url: string | null; fetched_at: Date; provider_hotel_id: string; nights: number }>(
    'SELECT name, checkin::text, checkout::text, total_price::text, currency, price_certainty, source_url, fetched_at, provider_hotel_id, (checkout - checkin) AS nights FROM trip_hotels WHERE trip_id = $1',
    [tripId],
  );
  // A confirmed booking is the hotel cost (the whole stay, every room): counted even when no room was "selected" on the way to it.
  const booked = await query<{ hotel_name: string; checkin: string; checkout: string; final_price: string; currency: string; provider_hotel_id: string; nights: number }>(
    `SELECT hotel_name, checkin::text, checkout::text, final_price::text, currency, provider_hotel_id, (checkout - checkin) AS nights
       FROM bookings WHERE trip_id = $1 AND status = 'confirmed' AND final_price IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
    [tripId],
  );
  const b = booked.rows[0];
  const h = b
    ? { name: b.hotel_name, checkin: b.checkin, checkout: b.checkout, total_price: b.final_price, currency: b.currency.trim(), price_certainty: 'confirmed' as Certainty, source_url: null, fetched_at: new Date(), provider_hotel_id: b.provider_hotel_id, nights: b.nights }
    : hotel.rows[0];
  if (h) {
    await insertItem(tripId, currency, date, {
      category: 'hotels', label: `${h.name}, ${h.nights} ${h.nights === 1 ? 'night' : 'nights'} (${b ? 'booked, sandbox' : 'sandbox rate'})`, amount: h.total_price, currency: h.currency, certainty: h.price_certainty,
      source: 'liteapi', sourceUrl: h.source_url, fetchedAt: h.fetched_at.toISOString(), refType: 'hotel', refId: h.provider_hotel_id,
    });
  }

  // ---- Transport: one-way price counted twice when the trip has an end date (outbound and return) -------------------------------
  const tr = await query<{ mode: string; origin: string; destination: string; price: string | null; currency: string | null; price_certainty: Certainty; price_source: string; source_url: string | null; fetched_at: Date }>(
    'SELECT mode, origin, destination, price::text, currency, price_certainty, price_source, source_url, fetched_at FROM trip_transport WHERE trip_id = $1',
    [tripId],
  );
  const t = tr.rows[0];
  if (t) {
    const legs = trip.endDate ? ['outbound', 'return'] : ['outbound'];
    for (const leg of legs) {
      await insertItem(tripId, currency, date, {
        category: 'transportation', label: `${t.mode}, ${t.origin} to ${t.destination} (${leg}${leg === 'return' ? ', same price assumed' : ''})`, amount: t.price, currency: t.currency, certainty: t.price_certainty,
        source: t.price_source === 'faro-estimate' ? 'Faro estimate, not a quote' : t.price_source, sourceUrl: t.source_url, fetchedAt: t.fetched_at.toISOString(), refType: 'transport', refId: leg,
      });
    }
  }

  // ---- Activities from the itinerary -------------------------------------------------------------------------------------------
  const acts = await query<{ id: string; title: string; cost: string | null; cost_currency: string | null; cost_certainty: Certainty; source: string; source_url: string | null; fetched_at: Date | null }>(
    `SELECT i.id::text, i.title, i.cost::text, i.cost_currency, i.cost_certainty, i.source, i.source_url, i.fetched_at
       FROM itinerary_items i JOIN itinerary_days d ON d.id = i.day_id WHERE d.trip_id = $1 AND i.kind = 'activity' ORDER BY d.day_no, i.id`,
    [tripId],
  );
  for (const a of acts.rows) {
    await insertItem(tripId, currency, date, {
      category: 'activities', label: a.title, amount: a.cost, currency: a.cost_currency, certainty: a.cost_certainty, source: a.source, sourceUrl: a.source_url,
      fetchedAt: a.fetched_at ? a.fetched_at.toISOString() : null, refType: 'itinerary_item', refId: a.id,
    });
  }

  // ---- Food and local transport (labelled allowances) ---------------------------------------------------------------------------
  if (trip.startDate && trip.endDate && trip.adults) {
    const days = (await query<{ d: number }>('SELECT ($2::date - $1::date + 1) AS d', [trip.startDate, trip.endDate])).rows[0]!.d;
    const kids = trip.childrenAges.length;
    const adultsFood = await times(ALLOWANCES.foodAdultUsd, trip.adults * days);
    const kidsFood = kids > 0 ? await times(ALLOWANCES.foodChildUsd, kids * days) : null;
    const food = (await query<{ v: string }>('SELECT ($1::numeric + COALESCE($2::numeric, 0))::text AS v', [adultsFood, kidsFood])).rows[0]!.v;
    await insertItem(tripId, currency, date, {
      category: 'food', label: `Meals for ${trip.adults + kids} ${trip.adults + kids === 1 ? 'person' : 'people'}, ${days} days (${BASIS}: USD ${ALLOWANCES.foodAdultUsd} per adult and ${ALLOWANCES.foodChildUsd} per child per day)`,
      amount: food, currency: 'USD', certainty: 'estimated', source: BASIS, sourceUrl: null, fetchedAt: new Date().toISOString(),
    });
    const local = await times(ALLOWANCES.localTransportUsd, (trip.adults + kids) * days);
    await insertItem(tripId, currency, date, {
      category: 'local_transport', label: `Local transport, ${days} days (${BASIS}: USD ${ALLOWANCES.localTransportUsd} per person per day)`,
      amount: local, currency: 'USD', certainty: 'estimated', source: BASIS, sourceUrl: null, fetchedAt: new Date().toISOString(),
    });
  }

  // ---- Miscellaneous: a share of the others, computed in SQL ---------------------------------------------------------------------
  await query(
    `INSERT INTO budget_items (trip_id, category, label, amount, currency, amount_trip, source, certainty, fetched_at)
     SELECT $1, 'miscellaneous', $3, s.total, $2, s.total, $4, 'estimated', now()
       FROM (SELECT round(COALESCE(SUM(amount_trip), 0) * $5::numeric, 2) AS total FROM budget_items WHERE trip_id = $1 AND category <> 'miscellaneous') s
      WHERE s.total > 0`,
    [tripId, currency, `Miscellaneous, ${Number(ALLOWANCES.miscShare) * 100}% of the other categories (${BASIS})`, BASIS, ALLOWANCES.miscShare],
  );
}
