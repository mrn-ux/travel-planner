import type pg from 'pg';
import { getPool, query } from '../db.js';
import { AppError } from '../errors.js';
import { embedDocuments, embedQuery } from '../knowledge/embed.js';
import { refForDestination } from '../knowledge/ensure.js';
import { fetchAttractions, type Attraction } from '../providers/knowledge/OverpassSource.js';
import { transportProvider } from '../providers/index.js';
import type { LatLon } from '../providers/types.js';
import { getTripById, type Trip } from '../trips/service.js';
import { recalcBudget } from '../budget/recalc.js';
import { earliestStart, holidayDates, parseOpeningHours, type ParsedHours } from './hours.js';

// Scheduler constants (minutes from midnight). Visit lengths are assumptions and are shown as estimates.
const SLOTS = { morning: { start: 9 * 60, end: 12 * 60 + 30 }, afternoon: { start: 14 * 60, end: 18 * 60 }, evening: { start: 19 * 60, end: 20 * 60 + 30 } } as const;
const LUNCH = { start: 12 * 60 + 30, minutes: 90 };
const REST = { start: 18 * 60, minutes: 60 };
const DINNER_MINUTES = 90;
const PER_SLOT = { morning: 2, afternoon: 2, evening: 1 } as const;
const BUFFER_MIN = 5;
const MAX_DAYS = 14;
const MATRIX_CANDIDATES = 40;
const VISIT_MINUTES: Record<string, number> = { museum: 120, gallery: 90, attraction: 90, castle: 120, palace: 120, fort: 90, cathedral: 60, monument: 45, ruins: 60, archaeological_site: 90 };

export interface PlannedItem {
  slot: 'morning' | 'afternoon' | 'evening';
  position: number;
  kind: 'activity' | 'meal' | 'rest';
  title: string;
  startsAt: number;
  durationMinutes: number;
  lat: number | null;
  lon: number | null;
  openingHours: string | null;
  checked: boolean;
  cost: { amount: string | null; currency: string | null; certainty: 'confirmed' | 'estimated' | 'unavailable' };
  travelToNext: number | null;
  source: string;
  sourceUrl: string | null;
  fetchedAt: string | null;
  attractionId: string | null;
}

export interface PlannedDay {
  dayNo: number;
  date: string;
  note: string | null;
  items: PlannedItem[];
}

const SYMBOLS: Record<string, string> = { '€': 'EUR', '£': 'GBP', $: 'USD' };

/** "EUR 12", "12 EUR", "€12.50": a parseable charge, else null (the cost stays Unavailable). */
export function parseCharge(charge: string | null): { amount: string; currency: string } | null {
  if (!charge) return null;
  const m = /^\s*(?:([A-Z]{3}|[€£$])\s*)?(\d+(?:[.,]\d{1,2})?)\s*([A-Z]{3}|[€£$])?\s*$/.exec(charge);
  if (!m) return null;
  const cur = m[1] ?? m[3];
  if (!cur) return null;
  const currency = SYMBOLS[cur] ?? cur;
  const amount = m[2]!.replace(',', '.');
  return { amount: amount.includes('.') ? amount : `${amount}.00`, currency };
}

export function attractionCost(a: Attraction, tripCurrency: string): PlannedItem['cost'] {
  if (a.fee === 'no') return { amount: '0.00', currency: tripCurrency, certainty: 'confirmed' };
  const c = a.fee === 'yes' ? parseCharge(a.charge) : null;
  return c ? { amount: c.amount, currency: c.currency, certainty: 'confirmed' } : { amount: null, currency: null, certainty: 'unavailable' };
}

const dot = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);

/** Rank attractions by how closely their name and kind match the interests; places with a Wikidata item get a small boost. */
export async function rankAttractions(list: Attraction[], interests: string | null): Promise<Attraction[]> {
  const boost = (a: Attraction): number => (a.wikidata ? 0.05 : 0) + (a.openingHours ? 0.02 : 0);
  if (!interests?.trim() || list.length === 0) return [...list].sort((a, b) => boost(b) - boost(a) || a.name.localeCompare(b.name));
  try {
    const q = await embedQuery(interests);
    const vectors = await embedDocuments(list.map((a) => `${a.name} (${a.kind})`));
    return list
      .map((a, i) => ({ a, score: dot(q, vectors[i]!) + boost(a) }))
      .sort((x, y) => y.score - x.score)
      .map((x) => x.a);
  } catch {
    return [...list].sort((a, b) => boost(b) - boost(a) || a.name.localeCompare(b.name)); // embeddings down: order by what is known
  }
}

function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`) && out.length < MAX_DAYS; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

interface Candidate {
  a: Attraction;
  hours: ParsedHours;
  minutes: number;
  index: number; // row in the travel matrix
  /** false when the place does not state its opening hours (planned, but to be checked by the traveler). */
  verified: boolean;
}

export interface GenerateResult {
  days: PlannedDay[];
  notes: string[];
  attractionsConsidered: number;
  eligible: number;
}

/** Build the plan in memory. Nothing is written here; a failure leaves the stored plan untouched. */
export async function buildItinerary(trip: Trip, onlyDays?: number[], keepUsed: Set<string> = new Set()): Promise<GenerateResult> {
  if (!trip.destination) throw new AppError(422, 'Choose a destination first.');
  if (!trip.startDate || !trip.endDate) throw new AppError(422, 'Set the trip dates first.');
  const dest = await refForDestination(trip.destination);
  if (!dest || dest.lat === null || dest.lon === null) throw new AppError(404, `We could not find "${trip.destination}".`);

  const fetched = await fetchAttractions(dest.lat, dest.lon);
  if (!fetched.ok) throw new AppError(fetched.reason === 'timeout' ? 504 : 502, 'Attractions are unavailable right now, so no itinerary was made. Your last plan is unchanged.');
  const notes: string[] = [];

  // Only attractions whose opening hours we can read are eligible: the plan never guesses when something is open.
  // The places the traveler chose are the ones planned; with none chosen, every attraction nearby is a candidate.
  const chosenRows = (
    await query<{ place_id: string; name: string; kind: string; lat: number; lon: number; opening_hours: string | null; entry_kind: string; charge: string | null }>(
      'SELECT place_id, name, kind, lat, lon, opening_hours, entry_kind, charge FROM trip_places WHERE trip_id = $1 ORDER BY selected_at',
      [trip.id],
    )
  ).rows;
  // The chosen places are planned as saved (they may lie beyond the city centre's neighbourhood); with none chosen, every attraction nearby is a candidate.
  const pool: Attraction[] =
    chosenRows.length > 0
      ? chosenRows.map((r) => ({
          id: r.place_id, name: r.name, lat: r.lat, lon: r.lon, kind: r.kind.toLowerCase().replace(/ /g, '_'), openingHours: r.opening_hours,
          fee: r.entry_kind === 'free' ? ('no' as const) : r.entry_kind === 'paid' ? ('yes' as const) : null, charge: r.charge, wikidata: null, website: null, commonsFile: null,
        }))
      : fetched.attractions;
  const chosen = new Set(chosenRows.map((r) => r.place_id));
  // Places the traveler chose are planned even when their opening hours are not stated: they are marked "check before you go" and no hours are
  // invented. Without a choice, only places whose hours can be read are planned (nothing unverified is picked for the traveler).
  const allowUnverified = chosen.size > 0;
  if (allowUnverified && pool.some((a) => parseOpeningHours(a.openingHours) === null)) notes.push('Some chosen places do not state their opening hours. They are planned anyway: check their hours before you go.');
  const unverified = new Set<string>();
  const parsed = pool.flatMap((a): Array<{ a: Attraction; hours: ParsedHours }> => {
    const hours = parseOpeningHours(a.openingHours);
    if (hours) return [{ a, hours }];
    if (!allowUnverified) return [];
    unverified.add(a.id);
    return [{ a, hours: { always: true } }];
  });
  const ranked = (await rankAttractions(parsed.map((p) => p.a), trip.interests)).slice(0, MATRIX_CANDIDATES);
  const hoursOf = new Map(parsed.map((p) => [p.a.id, p.hours]));

  // Origin: the selected hotel when there is one, else the city centre.
  const hotel = await query<{ latitude: number | null; longitude: number | null }>('SELECT latitude, longitude FROM trip_hotels WHERE trip_id = $1', [trip.id]);
  const origin: LatLon = hotel.rows[0]?.latitude != null && hotel.rows[0]?.longitude != null ? { lat: hotel.rows[0].latitude, lon: hotel.rows[0].longitude } : { lat: dest.lat, lon: dest.lon };

  const candidates: Candidate[] = ranked.map((a, i) => ({ a, hours: hoursOf.get(a.id)!, minutes: VISIT_MINUTES[a.kind] ?? 60, index: i + 1, verified: !unverified.has(a.id) }));
  if (candidates.length === 0) {
    notes.push('No attractions with known opening hours were found, so none can be scheduled.');
    return { days: [], notes, attractionsConsidered: fetched.attractions.length, eligible: 0 };
  }

  const matrix = await transportProvider().roadMatrix([origin, ...candidates.map((c) => ({ lat: c.a.lat, lon: c.a.lon }))]);
  if (!matrix.ok) throw new AppError(matrix.reason === 'timeout' ? 504 : 502, 'Travel times are unavailable right now, so no itinerary was made. Your last plan is unchanged.');
  const M = matrix.data;

  const dates = eachDate(trip.startDate, trip.endDate);
  const holidays = await holidayDates(dest.key, dates[0]!, dates[dates.length - 1]!);
  const used = new Set(keepUsed);
  const days: PlannedDay[] = [];
  const currency = trip.budget?.currency ?? 'USD';
  const fetchedAt = fetched.fetchedAt.toISOString();

  dates.forEach((date, i) => {
    const dayNo = i + 1;
    if (onlyDays && !onlyDays.includes(dayNo)) return;
    const first = dayNo === 1 && dates.length > 1;
    const last = dayNo === dates.length && dates.length > 1;
    const items: PlannedItem[] = [];
    const positions = { morning: 0, afternoon: 0, evening: 0 };
    let pos = 0; // matrix row of where the traveler is now
    let notesForDay: string | null = null;

    const push = (slot: PlannedItem['slot'], p: Omit<PlannedItem, 'slot' | 'position'>): void => {
      items.push({ slot, position: positions[slot]++, ...p });
    };

    const fillSlot = (slot: 'morning' | 'afternoon' | 'evening', from: number, to: number): number => {
      let t = from;
      let count = 0;
      while (count < PER_SLOT[slot]) {
        let chosen: { c: Candidate; start: number; travel: number } | null = null;
        for (const c of candidates) {
          if (used.has(c.a.id)) continue;
          const travel = M[pos]?.[c.index];
          if (travel === null || travel === undefined) continue; // no route: unreachable
          // Arrive after the travel time, then wait for the doors to open if need be: the whole visit must lie inside the hours.
          const start = earliestStart(c.hours, date, t + travel + BUFFER_MIN, c.minutes, holidays.has(date));
          if (start === null) continue; // closed that day, or never open long enough
          if (start + c.minutes > to) continue; // does not fit before the slot ends
          chosen = { c, start, travel };
          break; // candidates are in rank order: take the best that works
        }
        if (!chosen) break;
        const prev = items.filter((x) => x.kind === 'activity').at(-1);
        if (prev && pos !== 0) prev.travelToNext = chosen.travel;
        const cost = attractionCost(chosen.c.a, currency);
        push(slot, {
          kind: 'activity', title: chosen.c.a.name, startsAt: chosen.start, durationMinutes: chosen.c.minutes, lat: chosen.c.a.lat, lon: chosen.c.a.lon,
          openingHours: chosen.c.a.openingHours, checked: chosen.c.verified, cost, travelToNext: null, source: /^Q\d+$/.test(chosen.c.a.id) ? 'wikidata' : 'overpass', sourceUrl: /^Q\d+$/.test(chosen.c.a.id) ? `https://www.wikidata.org/wiki/${chosen.c.a.id}` : `https://www.openstreetmap.org/${chosen.c.a.id}`,
          fetchedAt, attractionId: chosen.c.a.id,
        });
        used.add(chosen.c.a.id);
        pos = chosen.c.index;
        t = chosen.start + chosen.c.minutes;
        count++;
      }
      return t;
    };

    if (first) notesForDay = 'Arrival day: activities start after midday. Arrival times are not part of this plan.';
    if (last) notesForDay = 'Departure day: the plan ends after the morning. Departure times are not part of this plan.';

    if (!first) fillSlot('morning', SLOTS.morning.start, SLOTS.morning.end);
    push('afternoon', { kind: 'meal', title: 'Lunch', startsAt: LUNCH.start, durationMinutes: LUNCH.minutes, lat: null, lon: null, openingHours: null, checked: false, cost: { amount: null, currency: null, certainty: 'unavailable' }, travelToNext: null, source: 'faro', sourceUrl: null, fetchedAt: null, attractionId: null });
    if (!last) {
      fillSlot('afternoon', SLOTS.afternoon.start, SLOTS.afternoon.end);
      push('evening', { kind: 'rest', title: 'Rest at the hotel', startsAt: REST.start, durationMinutes: REST.minutes, lat: null, lon: null, openingHours: null, checked: false, cost: { amount: null, currency: null, certainty: 'unavailable' }, travelToNext: null, source: 'faro', sourceUrl: null, fetchedAt: null, attractionId: null });
      pos = 0; // back at the hotel for the evening
      const after = fillSlot('evening', SLOTS.evening.start, SLOTS.evening.end);
      push('evening', { kind: 'meal', title: 'Dinner', startsAt: Math.max(after, SLOTS.evening.start), durationMinutes: DINNER_MINUTES, lat: null, lon: null, openingHours: null, checked: false, cost: { amount: null, currency: null, certainty: 'unavailable' }, travelToNext: null, source: 'faro', sourceUrl: null, fetchedAt: null, attractionId: null });
    } else {
      push('afternoon', { kind: 'rest', title: 'Rest before departure', startsAt: 14 * 60, durationMinutes: 60, lat: null, lon: null, openingHours: null, checked: false, cost: { amount: null, currency: null, certainty: 'unavailable' }, travelToNext: null, source: 'faro', sourceUrl: null, fetchedAt: null, attractionId: null });
    }
    days.push({ dayNo, date, note: notesForDay, items });
  });

  const scheduled = days.reduce((n, d) => n + d.items.filter((x) => x.kind === 'activity').length, 0);
  if (scheduled < days.length) notes.push('Some days have few activities: places are scheduled only when they are reachable in time and, where their hours are stated, open.');
  return { days, notes, attractionsConsidered: fetched.attractions.length, eligible: candidates.length };
}

/** Generate and store the plan (all days, or just some), then update the budget. */
export async function generateItinerary(tripId: string, onlyDays?: number[]): Promise<GenerateResult> {
  const trip = await getTripById(tripId);
  // Attractions already used on days that are kept must not repeat on regenerated days.
  const keep = new Set<string>();
  if (onlyDays) {
    const rows = await query<{ source_url: string | null }>(
      `SELECT i.source_url FROM itinerary_items i JOIN itinerary_days d ON d.id = i.day_id WHERE d.trip_id = $1 AND i.kind = 'activity' AND NOT (d.day_no = ANY($2::int[]))`,
      [tripId, onlyDays],
    );
    for (const r of rows.rows) if (r.source_url) keep.add(r.source_url.replace('https://www.openstreetmap.org/', ''));
  }
  const result = await buildItinerary(trip, onlyDays, keep);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM itinerary_days WHERE trip_id = $1 AND ($2::int[] IS NULL OR day_no = ANY($2::int[]))', [tripId, onlyDays ?? null]);
    for (const d of result.days) {
      const day = await client.query<{ id: string }>('INSERT INTO itinerary_days (trip_id, day_no, day_date, place, note) VALUES ($1,$2,$3,$4,$5) RETURNING id', [tripId, d.dayNo, d.date, trip.destination, d.note]);
      for (const it of d.items) await insertItem(client, day.rows[0]!.id, it);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  await recalcBudget(tripId);
  return result;
}

export async function insertItem(db: Pick<pg.PoolClient, 'query'>, dayId: string, it: PlannedItem): Promise<void> {
  const hh = String(Math.floor(it.startsAt / 60)).padStart(2, '0');
  const mm = String(it.startsAt % 60).padStart(2, '0');
  await db.query(
    `INSERT INTO itinerary_items (day_id, slot, position, kind, title, starts_at, duration_minutes, latitude, longitude, opening_hours_text, opening_hours_checked,
                                  cost, cost_currency, cost_certainty, travel_minutes_to_next, travel_certainty, source, source_url, fetched_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [dayId, it.slot, it.position, it.kind, it.title, `${hh}:${mm}`, it.durationMinutes, it.lat, it.lon, it.openingHours, it.checked, it.cost.amount, it.cost.currency, it.cost.certainty,
      it.travelToNext, it.travelToNext !== null ? 'estimated' : null, it.source, it.sourceUrl, it.fetchedAt],
  );
}
