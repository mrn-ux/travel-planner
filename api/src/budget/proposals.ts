import { query } from '../db.js';
import { AppError } from '../errors.js';
import { compareAmounts } from '../providers/decimal.js';
import { hotelProvider } from '../providers/index.js';
import { collapseRooms, searchHotelsForTrip, stayFor } from '../search/hotels.js';
import { selectHotel, selectTransportOption } from '../search/selection.js';
import { searchTransportForTrip } from '../search/transport.js';
import { applyBriefPatch, getTripById, type Owner, type Trip } from '../trips/service.js';
import { generateItinerary } from '../itinerary/generate.js';
import { convertAmount } from './convert.js';
import { recalcBudget } from './recalc.js';

type Certainty = 'confirmed' | 'estimated' | 'unavailable';
type Kind = 'lower_hotel_tier' | 'train_instead_of_flight' | 'fewer_paid_attractions' | 'different_dates';

interface Draft {
  kind: Kind;
  description: string;
  /** Decimal string, already in `currency`. */
  saving: string;
  currency: string;
  certainty: Certainty;
  payload: Record<string, unknown>;
}

export interface Proposal {
  id: number;
  kind: Kind;
  description: string;
  saving: string;
  currency: string;
  certainty: Certainty;
}

/** (a - b) * n computed by the database, or null when it is not a positive saving. Money arithmetic never happens in TypeScript. */
async function positiveSaving(a: string, b: string, times = 1): Promise<string | null> {
  const r = await query<{ s: string | null }>('SELECT CASE WHEN $1::numeric > $2::numeric THEN round(($1::numeric - $2::numeric) * $3::numeric, 2)::text END AS s', [a, b, times]);
  return r.rows[0]?.s ?? null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const friendly = (d: string): string => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const shiftDate = (d: string, days: number): string => new Date(Date.parse(`${d}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

interface SelectedHotel {
  provider_hotel_id: string;
  name: string;
  checkin: string;
  checkout: string;
  total_price: string;
  currency: string;
}

async function selectedHotel(tripId: string): Promise<SelectedHotel | null> {
  const r = await query<SelectedHotel>('SELECT provider_hotel_id, name, checkin::text, checkout::text, total_price::text, currency FROM trip_hotels WHERE trip_id = $1 AND total_price IS NOT NULL', [tripId]);
  return r.rows[0] ?? null;
}

/** A saving found in another currency is converted with the stored rate (and then only Estimated). */
async function toTripCurrency(amount: string, from: string, trip: Trip, certainty: Certainty): Promise<{ amount: string; currency: string; certainty: Certainty } | null> {
  const to = trip.budget?.currency ?? from;
  if (from === to) return { amount, currency: to, certainty };
  const c = await convertAmount(amount, from, to);
  return c ? { amount: c.converted, currency: to, certainty: certainty === 'unavailable' ? 'unavailable' : 'estimated' } : null;
}

async function lowerHotelTier(trip: Trip): Promise<Draft | null> {
  const cur = await selectedHotel(trip.id);
  if (!cur) return null;
  const found = await searchHotelsForTrip(trip, { checkin: cur.checkin, checkout: cur.checkout, sort: 'price', dir: 'asc' });
  const cheaper = found.items.filter((h) => h.total.amount && h.total.currency === cur.currency && h.total.certainty === 'confirmed' && h.hotelId !== cur.provider_hotel_id && compareAmounts(h.total.amount, cur.total_price) < 0);
  // The best-rated of the cheaper hotels: a lower tier, not simply the cheapest place.
  const pick = cheaper.sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0))[0];
  if (!pick?.total.amount) return null;
  const saving = await positiveSaving(cur.total_price, pick.total.amount);
  if (!saving) return null;
  const conv = await toTripCurrency(saving, cur.currency, trip, 'confirmed');
  if (!conv) return null;
  return {
    kind: 'lower_hotel_tier',
    description: `Stay at ${pick.name}${pick.rating ? ` (rated ${pick.rating})` : ''} instead of ${cur.name}`,
    saving: conv.amount, currency: conv.currency, certainty: conv.certainty,
    payload: { fromHotelId: cur.provider_hotel_id, hotelId: pick.hotelId, checkin: cur.checkin, checkout: cur.checkout },
  };
}

async function trainInsteadOfFlight(trip: Trip): Promise<Draft | null> {
  const tr = await query<{ mode: string; origin: string; price: string | null; currency: string | null }>('SELECT mode, origin, price::text, currency FROM trip_transport WHERE trip_id = $1', [trip.id]);
  const t = tr.rows[0];
  if (!t || t.mode !== 'flight' || !t.price || !t.currency || !trip.startDate) return null;
  const found = await searchTransportForTrip(trip, { from: t.origin, modes: ['train'], date: trip.startDate, sort: 'price', dir: 'asc' });
  const train = found.items.find((r) => r.mode === 'train' && r.price.amount && r.price.currency === t.currency);
  if (!train?.price.amount) return null;
  const legs = trip.endDate ? 2 : 1;
  const saving = await positiveSaving(t.price, train.price.amount, legs);
  if (!saving) return null;
  const conv = await toTripCurrency(saving, t.currency, trip, 'estimated'); // both prices are estimates
  if (!conv) return null;
  return {
    kind: 'train_instead_of_flight',
    description: `Take the train from ${t.origin}${train.durationMinutes ? ` (about ${Math.floor(train.durationMinutes / 60)}h ${train.durationMinutes % 60}m)` : ''} instead of flying`,
    saving: conv.amount, currency: conv.currency, certainty: 'estimated',
    payload: { optionId: train.optionId },
  };
}

async function fewerPaidAttractions(trip: Trip): Promise<Draft | null> {
  const rows = await query<{ ref_id: string; label: string; amount_trip: string }>(
    `SELECT ref_id, label, amount_trip::text FROM budget_items WHERE trip_id = $1 AND category = 'activities' AND amount_trip > 0 AND certainty <> 'unavailable' ORDER BY amount_trip DESC LIMIT 2`,
    [trip.id],
  );
  if (rows.rows.length === 0) return null;
  const ids = rows.rows.map((r) => r.ref_id);
  const s = await query<{ s: string; c: string | null }>(`SELECT COALESCE(SUM(amount_trip), 0)::text AS s, NULL AS c FROM budget_items WHERE trip_id = $1 AND category = 'activities' AND ref_id = ANY($2::text[])`, [trip.id, ids]);
  const worst = await query<{ c: Certainty }>(`SELECT CASE WHEN bool_or(certainty = 'estimated') THEN 'estimated' ELSE 'confirmed' END AS c FROM budget_items WHERE trip_id = $1 AND ref_id = ANY($2::text[]) AND category = 'activities'`, [trip.id, ids]);
  return {
    kind: 'fewer_paid_attractions',
    description: `Skip ${rows.rows.map((r) => r.label).join(' and ')}`,
    saving: s.rows[0]!.s, currency: trip.budget?.currency ?? 'USD', certainty: worst.rows[0]?.c ?? 'confirmed',
    payload: { itemIds: ids },
  };
}

async function differentDates(trip: Trip): Promise<Draft | null> {
  const cur = await selectedHotel(trip.id);
  if (!cur || !trip.startDate || !trip.endDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  const stays = [-3, -2, -1, 1, 2, 3].map((n) => ({ n, start: shiftDate(trip.startDate!, n), end: shiftDate(trip.endDate!, n) })).filter((s) => s.start >= today);
  // Live rates for each shifted stay (never cached).
  const results = await Promise.all(
    stays.map(async (s) => {
      const stay = stayFor(trip, { checkin: s.start, checkout: s.end });
      const rates = await hotelProvider().getRates(cur.provider_hotel_id, stay);
      const cheapest = rates.ok ? collapseRooms(rates.data).sort((a, b) => compareAmounts(a.total, b.total))[0] : undefined;
      return { ...s, total: cheapest?.total ?? null, currency: cheapest?.currency ?? null };
    }),
  );
  let best: { n: number; start: string; end: string; saving: string } | null = null;
  for (const r of results) {
    if (!r.total || r.currency !== cur.currency) continue;
    const saving = await positiveSaving(cur.total_price, r.total);
    if (saving && (!best || compareAmounts(saving, best.saving) > 0)) best = { n: r.n, start: r.start, end: r.end, saving };
  }
  if (!best) return null;
  const conv = await toTripCurrency(best.saving, cur.currency, trip, 'confirmed');
  if (!conv) return null;
  return {
    kind: 'different_dates',
    description: `Travel ${Math.abs(best.n)} ${Math.abs(best.n) === 1 ? 'day' : 'days'} ${best.n < 0 ? 'earlier' : 'later'} (${friendly(best.start)} to ${friendly(best.end)}) for a cheaper room at ${cur.name}`,
    saving: conv.amount, currency: conv.currency, certainty: conv.certainty,
    payload: { fromStart: trip.startDate, startDate: best.start, endDate: best.end },
  };
}

/** Make the proposals for an over-budget trip: only savings that can be shown from real figures. Replaces open proposals. */
export async function generateProposals(trip: Trip): Promise<Proposal[]> {
  const drafts = await Promise.allSettled([lowerHotelTier(trip), trainInsteadOfFlight(trip), fewerPaidAttractions(trip), differentDates(trip)]);
  await query("DELETE FROM budget_proposals WHERE trip_id = $1 AND status = 'proposed'", [trip.id]);
  const out: Proposal[] = [];
  for (const d of drafts) {
    if (d.status === 'rejected') {
      console.warn('A proposal generator failed:', d.reason instanceof Error ? d.reason.message : d.reason);
      continue;
    }
    if (!d.value) continue;
    const x = d.value;
    const row = await query<{ id: string }>(
      'INSERT INTO budget_proposals (trip_id, kind, description, saving, currency, certainty, payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id',
      [trip.id, x.kind, x.description, x.saving, x.currency, x.certainty, JSON.stringify(x.payload)],
    );
    out.push({ id: Number(row.rows[0]!.id), kind: x.kind, description: x.description, saving: x.saving, currency: x.currency, certainty: x.certainty });
  }
  return out;
}

export async function listProposals(tripId: string): Promise<Proposal[]> {
  const r = await query<{ id: string; kind: Kind; description: string; saving: string; currency: string; certainty: Certainty }>(
    "SELECT id::text, kind, description, saving::text, currency, certainty FROM budget_proposals WHERE trip_id = $1 AND status = 'proposed' ORDER BY saving DESC",
    [tripId],
  );
  return r.rows.map((p) => ({ ...p, id: Number(p.id), currency: p.currency.trim() }));
}

const ORDER: Kind[] = ['fewer_paid_attractions', 'train_instead_of_flight', 'lower_hotel_tier', 'different_dates'];

/** Apply only the checked proposals, each re-validated against what is stored now; nothing else changes. */
export async function applyProposals(tripId: string, owner: Owner, ids: number[]): Promise<void> {
  const rows = await query<{ id: string; kind: Kind; payload: Record<string, unknown> }>(
    "SELECT id::text, kind, payload FROM budget_proposals WHERE trip_id = $1 AND status = 'proposed' AND id = ANY($2::bigint[])",
    [tripId, ids],
  );
  if (rows.rows.length !== new Set(ids).size) throw new AppError(409, 'Some of these suggestions are no longer valid. The list has been refreshed.');

  let datesChanged = false;
  for (const kind of ORDER) {
    for (const p of rows.rows.filter((r) => r.kind === kind)) {
      const trip = await getTripById(tripId);
      const pl = p.payload;
      if (kind === 'fewer_paid_attractions') {
        const itemIds = pl['itemIds'] as string[];
        const del = await query('DELETE FROM itinerary_items WHERE id = ANY($1::bigint[]) AND day_id IN (SELECT id FROM itinerary_days WHERE trip_id = $2)', [itemIds, tripId]);
        if (del.rowCount === 0) throw new AppError(409, 'That suggestion is no longer valid.');
      } else if (kind === 'train_instead_of_flight') {
        const cur = await query<{ mode: string }>('SELECT mode FROM trip_transport WHERE trip_id = $1', [tripId]);
        if (cur.rows[0]?.mode !== 'flight') throw new AppError(409, 'That suggestion is no longer valid.');
        await selectTransportOption(trip, String(pl['optionId']));
      } else if (kind === 'lower_hotel_tier') {
        const cur = await selectedHotel(tripId);
        if (!cur || cur.provider_hotel_id !== pl['fromHotelId']) throw new AppError(409, 'That suggestion is no longer valid.');
        await selectHotel(trip, { hotelId: String(pl['hotelId']), checkin: String(pl['checkin']), checkout: String(pl['checkout']) });
      } else {
        if (trip.startDate !== pl['fromStart']) throw new AppError(409, 'That suggestion is no longer valid.');
        await applyBriefPatch(tripId, owner, { startDate: String(pl['startDate']), endDate: String(pl['endDate']) });
        const cur = await selectedHotel(tripId);
        if (cur) await selectHotel(await getTripById(tripId), { hotelId: cur.provider_hotel_id, checkin: String(pl['startDate']), checkout: String(pl['endDate']) });
        datesChanged = true;
      }
      await query("UPDATE budget_proposals SET status = 'applied' WHERE id = $1", [p.id]);
    }
  }
  if (datesChanged) await generateItinerary(tripId).catch((err) => console.warn('Itinerary was not regenerated after the date change:', err instanceof Error ? err.message : err));
  await recalcBudget(tripId);
}

export async function dismissProposal(tripId: string, id: number): Promise<void> {
  await query("UPDATE budget_proposals SET status = 'dismissed' WHERE id = $1 AND trip_id = $2 AND status = 'proposed'", [id, tripId]);
}
