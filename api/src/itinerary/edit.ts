import { recalcBudget } from '../budget/recalc.js';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { refForDestination } from '../knowledge/ensure.js';
import { fetchAttractions } from '../providers/knowledge/OverpassSource.js';
import { transportProvider } from '../providers/index.js';
import type { Trip } from '../trips/service.js';
import { attractionCost } from './generate.js';
import { holidayDates, isOpen, parseOpeningHours } from './hours.js';

interface ItemRow {
  id: string;
  day_id: string;
  day_date: string;
  slot: string;
  position: number;
  kind: string;
  starts_min: number | null;
  duration_minutes: number | null;
  latitude: number | null;
  longitude: number | null;
}

async function itemFor(tripId: string, itemId: string): Promise<ItemRow> {
  if (!/^\d{1,18}$/.test(itemId)) throw new AppError(404, 'That item is not in this plan.');
  const r = await query<ItemRow>(
    `SELECT i.id::text, i.day_id::text, d.day_date::text, i.slot, i.position, i.kind, (EXTRACT(HOUR FROM i.starts_at) * 60 + EXTRACT(MINUTE FROM i.starts_at))::int AS starts_min,
            i.duration_minutes, i.latitude, i.longitude
       FROM itinerary_items i JOIN itinerary_days d ON d.id = i.day_id WHERE i.id = $1 AND d.trip_id = $2`,
    [itemId, tripId],
  );
  const row = r.rows[0];
  if (!row) throw new AppError(404, 'That item is not in this plan.');
  return row;
}

/** Activities of the same day in time order. */
async function dayActivities(dayId: string): Promise<ItemRow[]> {
  const r = await query<ItemRow>(
    `SELECT i.id::text, i.day_id::text, d.day_date::text, i.slot, i.position, i.kind, (EXTRACT(HOUR FROM i.starts_at) * 60 + EXTRACT(MINUTE FROM i.starts_at))::int AS starts_min,
            i.duration_minutes, i.latitude, i.longitude
       FROM itinerary_items i JOIN itinerary_days d ON d.id = i.day_id WHERE i.day_id = $1 AND i.kind = 'activity' ORDER BY i.starts_at`,
    [dayId],
  );
  return r.rows;
}

/** Travel time between two stops from the routing service; null when it cannot be worked out. */
async function travel(a: ItemRow | undefined, b: ItemRow | undefined): Promise<number | null> {
  if (!a || !b || a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) return null;
  const r = await transportProvider().roadTime({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude });
  return r.ok ? r.data.minutes : null;
}

/** After an item changes, the travel time stored on the stop before it is worked out again against its new neighbour. */
async function retime(dayId: string): Promise<void> {
  const acts = await dayActivities(dayId);
  for (let i = 0; i < acts.length; i++) {
    const minutes = i < acts.length - 1 ? await travel(acts[i], acts[i + 1]) : null;
    await query('UPDATE itinerary_items SET travel_minutes_to_next = $2, travel_certainty = $3 WHERE id = $1', [acts[i]!.id, minutes, minutes === null ? null : 'estimated']);
  }
}

export async function deleteItem(trip: Trip, itemId: string): Promise<void> {
  const item = await itemFor(trip.id, itemId);
  await query('DELETE FROM itinerary_items WHERE id = $1', [item.id]);
  if (item.kind === 'activity') await retime(item.day_id);
  await recalcBudget(trip.id);
}

/** Replace an activity with another attraction, only if it is open for that visit and reachable in time. 422 otherwise. */
export async function swapItem(trip: Trip, itemId: string, attractionId: string): Promise<void> {
  const item = await itemFor(trip.id, itemId);
  if (item.kind !== 'activity' || item.starts_min === null || item.duration_minutes === null) throw new AppError(422, 'Only activities can be swapped.');
  if (!trip.destination) throw new AppError(422, 'Choose a destination first.');
  const dest = await refForDestination(trip.destination);
  if (!dest || dest.lat === null || dest.lon === null) throw new AppError(404, 'We could not find the destination.');

  const list = await fetchAttractions(dest.lat, dest.lon);
  if (!list.ok) throw new AppError(502, 'Attractions are unavailable right now. Nothing was changed.');
  const a = list.attractions.find((x) => x.id === attractionId);
  if (!a) throw new AppError(404, 'That attraction was not found.');

  const hours = parseOpeningHours(a.openingHours);
  if (!hours) throw new AppError(422, `${a.name} has no opening hours we can read, so it cannot be scheduled.`);
  const holidays = await holidayDates(dest.key, item.day_date, item.day_date);
  const start = item.starts_min;
  const end = start + item.duration_minutes;
  if (!isOpen(hours, item.day_date, start, end, holidays.has(item.day_date))) throw new AppError(422, `${a.name} is not open at that time on that day (${a.openingHours}).`);

  // Reachable in time from the stop before it, and the stop after it still fits.
  const acts = await dayActivities(item.day_id);
  const idx = acts.findIndex((x) => x.id === item.id);
  const candidate: ItemRow = { ...item, latitude: a.lat, longitude: a.lon };
  const before = idx > 0 ? acts[idx - 1] : undefined;
  const after = idx < acts.length - 1 ? acts[idx + 1] : undefined;
  const tIn = before ? await travel(before, candidate) : 0;
  if (before && tIn === null) throw new AppError(422, `${a.name} cannot be reached from the previous stop.`);
  if (before && before.starts_min !== null && before.duration_minutes !== null && before.starts_min + before.duration_minutes + (tIn ?? 0) > start) throw new AppError(422, `${a.name} is too far from the previous stop to arrive on time.`);
  const tOut = after ? await travel(candidate, after) : 0;
  if (after && tOut === null) throw new AppError(422, `The next stop cannot be reached from ${a.name}.`);
  if (after && after.starts_min !== null && end + (tOut ?? 0) > after.starts_min) throw new AppError(422, `${a.name} is too far from the next stop to get there on time.`);

  const cost = attractionCost(a, trip.budget?.currency ?? 'USD');
  await query(
    `UPDATE itinerary_items SET title = $2, latitude = $3, longitude = $4, opening_hours_text = $5, opening_hours_checked = true, cost = $6, cost_currency = $7, cost_certainty = $8,
            source = 'overpass', source_url = $9, fetched_at = $10 WHERE id = $1`,
    [item.id, a.name, a.lat, a.lon, a.openingHours, cost.amount, cost.currency, cost.certainty, `https://www.openstreetmap.org/${a.id}`, list.fetchedAt.toISOString()],
  );
  await retime(item.day_id);
  await recalcBudget(trip.id);
}
