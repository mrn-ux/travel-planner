import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { query } from '../db.js';
import { AppError } from '../errors.js';

// ---------------------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------------------

/** Who may read and change a trip: a signed-in user, or the holder of a draft's anonymous key (hashed). */
export type Owner = { userId: string; anonKeyHash?: undefined } | { anonKeyHash: string; userId?: undefined };

export interface Trip {
  id: string;
  status: 'draft' | 'saved' | 'booked';
  title: string | null;
  destination: string | null;
  recommendRequested: boolean;
  startDate: string | null;
  endDate: string | null;
  dateWindowText: string | null;
  durationDays: number | null;
  adults: number | null;
  childrenAges: number[];
  /** Entered by the traveler: source 'user', certainty 'confirmed'. The amount is a decimal string. */
  budget: { amount: string; currency: string; source: 'user'; certainty: 'confirmed' } | null;
  transportPreference: string | null;
  accommodationPreference: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  originCity: string | null;
  originCountry: string | null;
  interests: string | null;
  specialRequirements: string | null;
  updatedAt: string;
}

interface TripRow {
  id: string;
  status: Trip['status'];
  title: string | null;
  destination: string | null;
  recommend_requested: boolean;
  start_date: string | null;
  end_date: string | null;
  date_window_text: string | null;
  duration_days: number | null;
  adults: number | null;
  children_ages: number[];
  budget_amount: string | null;
  budget_currency: string | null;
  transport_preference: string | null;
  accommodation_preference: string | null;
  dest_city: string | null;
  dest_country_name: string | null;
  origin_city: string | null;
  origin_country_name: string | null;
  interests: string | null;
  special_requirements: string | null;
  updated_at: Date;
}

function toTrip(r: TripRow): Trip {
  return {
    id: r.id,
    status: r.status,
    title: r.title,
    destination: r.destination,
    recommendRequested: r.recommend_requested,
    startDate: r.start_date,
    endDate: r.end_date,
    dateWindowText: r.date_window_text,
    durationDays: r.duration_days,
    adults: r.adults,
    childrenAges: r.children_ages ?? [],
    budget:
      r.budget_amount !== null && r.budget_currency !== null
        ? { amount: r.budget_amount, currency: r.budget_currency.trim(), source: 'user', certainty: 'confirmed' }
        : null,
    transportPreference: r.transport_preference,
    accommodationPreference: r.accommodation_preference,
    destinationCity: r.dest_city,
    destinationCountry: r.dest_country_name,
    originCity: r.origin_city,
    originCountry: r.origin_country_name,
    interests: r.interests,
    specialRequirements: r.special_requirements,
    updatedAt: r.updated_at.toISOString(),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Validation (the single writer path: form PATCH, chat extraction and "Edit in chat" all use it)
// ---------------------------------------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === s;
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 18 Nov 2026, for messages shown to the traveler. */
function friendly(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[(m as number) - 1]} ${y}`;
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

const dateField = z.string().trim().refine(isRealDate, 'Use a real date.');
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === '' ? null : v));

export const briefPatchSchema = z
  .object({
    destination: text(200).nullable(),
    recommendRequested: z.boolean(),
    startDate: dateField.nullable(),
    endDate: dateField.nullable(),
    dateWindowText: text(100).nullable(),
    durationDays: z.number().int('Use a whole number of days.').min(1, 'Duration must be at least 1 day.').max(365, 'Duration cannot be more than 365 days.').nullable(),
    adults: z.number().int('Use a whole number.').min(1, 'At least one adult must travel.').max(20, 'Up to 20 adults.').nullable(),
    childrenAges: z.array(z.number().int().min(0, 'Ages are 0 to 17.').max(17, 'Ages are 0 to 17.')).max(10, 'Up to 10 children.'),
    budget: z
      .object({
        amount: z
          .string()
          .trim()
          .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Enter an amount like 4000.00.')
          .refine((v) => /[1-9]/.test(v), 'The budget must be more than zero.'),
        currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a three-letter currency code.'),
      })
      .nullable(),
    transportPreference: text(40).nullable(),
    accommodationPreference: text(40).nullable(),
    destinationCity: text(100).nullable(),
    destinationCountry: text(100).nullable(),
    originCity: text(100).nullable(),
    originCountry: text(100).nullable(),
    interests: text(500).nullable(),
    specialRequirements: text(1000).nullable(),
  })
  .partial()
  .strict();

export type BriefPatch = z.infer<typeof briefPatchSchema>;

function fieldsFromZod(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.code === 'unrecognized_keys' ? 'form' : String(issue.path[0] ?? 'form');
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

const VALIDATION_MESSAGE = 'Please correct the highlighted fields.';

/** Cross-field rules on the merged result. Returns the final start/end/duration or throws AppError. */
function resolveDates(current: Trip, patch: BriefPatch): { startDate: string | null; endDate: string | null; durationDays: number | null } {
  const today = new Date().toISOString().slice(0, 10);
  const fields: Record<string, string> = {};

  if (patch.startDate && patch.startDate < today) fields['startDate'] = 'The start date cannot be in the past.';
  if (patch.endDate && patch.endDate < today) fields['endDate'] = 'The end date cannot be in the past.';

  let start = patch.startDate !== undefined ? patch.startDate : current.startDate;
  let end = patch.endDate !== undefined ? patch.endDate : current.endDate;
  let duration = patch.durationDays !== undefined ? patch.durationDays : current.durationDays;

  if (start && end) {
    if (end < start) {
      fields['endDate'] = 'The end date must be on or after the start date.';
    } else {
      const computed = daysBetween(start, end);
      const datesTouched = patch.startDate !== undefined || patch.endDate !== undefined;
      if (patch.durationDays != null && patch.durationDays !== computed) {
        if (datesTouched) {
          throw new AppError(409, `The dates and duration disagree: ${friendly(start)} to ${friendly(end)} is ${computed} days, not ${patch.durationDays}.`, {
            fields: { durationDays: `These dates are ${computed} days.` },
          });
        }
        // Only the duration changed: move the end date.
        end = addDays(start, patch.durationDays);
        duration = patch.durationDays;
      } else {
        duration = computed > 0 ? computed : duration;
      }
    }
  } else if (start && !end && duration) {
    end = addDays(start, duration);
  }

  if (Object.keys(fields).length > 0) throw new AppError(400, VALIDATION_MESSAGE, { fields });
  return { startDate: start, endDate: end, durationDays: duration };
}

// ---------------------------------------------------------------------------------------------------------
// Queries (every one is scoped to the owner)
// ---------------------------------------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function hashTripKey(tripKey: string): string {
  return createHash('sha256').update(tripKey).digest('hex');
}

function ownerClause(owner: Owner, paramIndex: number): { sql: string; value: string } {
  return owner.userId !== undefined
    ? { sql: `user_id = $${paramIndex}`, value: owner.userId }
    : { sql: `anon_key_hash = $${paramIndex}`, value: owner.anonKeyHash as string };
}

export async function getTripForOwner(tripId: string, owner: Owner): Promise<Trip> {
  if (!UUID.test(tripId)) throw new AppError(404, 'Trip not found');
  const o = ownerClause(owner, 2);
  const res = await query<TripRow>(`SELECT * FROM trips WHERE id = $1 AND ${o.sql}`, [tripId, o.value]);
  const row = res.rows[0];
  if (!row) throw new AppError(404, 'Trip not found'); // 404 whether it does not exist or belongs to someone else
  return toTrip(row);
}

/**
 * Internal lookup for agent tools: the chat route has already proven the caller owns this trip before any tool runs.
 * Never call it with an id taken from a request.
 */
export async function getTripById(tripId: string): Promise<Trip> {
  const res = await query<TripRow>('SELECT * FROM trips WHERE id = $1', [tripId]);
  const row = res.rows[0];
  if (!row) throw new AppError(404, 'Trip not found');
  return toTrip(row);
}

/** Choose (or clear) the trip's destination, with the country and coordinates the knowledge base and weather need. */
export async function setTripDestination(
  tripId: string,
  owner: Owner,
  dest: { name: string; countryCode: string; lat: number; lon: number; countryName?: string | null } | null,
): Promise<Trip> {
  await getTripForOwner(tripId, owner);
  const o = ownerClause(owner, 6);
  const res = await query<TripRow>(
    `UPDATE trips SET destination = $2, destination_country = $3, destination_lat = $4, destination_lon = $5, dest_city = $7, dest_country_name = $8,
            recommend_requested = CASE WHEN $2::text IS NULL THEN true ELSE recommend_requested END, updated_at = now()
      WHERE id = $1 AND ${o.sql} RETURNING *`,
    [tripId, dest?.name ?? null, dest?.countryCode ?? null, dest?.lat ?? null, dest?.lon ?? null, o.value, ...cityAndCountry(dest)],
  );
  const row = res.rows[0];
  if (!row) throw new AppError(404, 'Trip not found');
  return toTrip(row);
}

/**
 * Delete one of the user's trips with everything planned on it. A trip with a hotel or flight booking (confirmed, waiting for the
 * provider, or with a refund still owed) is kept: the record of a booking must not disappear with the plan.
 */
export async function deleteTrip(userId: string, tripId: string): Promise<void> {
  await getTripForOwner(tripId, { userId });
  const held = await query<{ n: string }>(
    `SELECT (SELECT count(*) FROM bookings WHERE trip_id = $1 AND (status IN ('confirmed','pending') OR refund_pending))
          + (SELECT count(*) FROM flight_bookings WHERE trip_id = $1 AND status = 'confirmed') AS n`,
    [tripId],
  );
  if (Number(held.rows[0]?.n ?? 0) > 0) throw new AppError(409, 'This trip has a booking, so it cannot be deleted. Only trips without bookings can be removed.', { code: 'has_booking' });
  await query('DELETE FROM trips WHERE id = $1 AND user_id = $2', [tripId, userId]);
}

export async function latestTripForUser(userId: string): Promise<Trip | null> {
  const res = await query<TripRow>('SELECT * FROM trips WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', [userId]);
  return res.rows[0] ? toTrip(res.rows[0]) : null;
}

/** Signed-in: a saved trip owned by the user. Visitor: a draft with a new anonymous key (returned once). */
export async function createTrip(
  owner: { userId: string } | { anonymous: true },
  initial?: BriefPatch,
): Promise<{ trip: Trip; tripKey?: string }> {
  let tripKey: string | undefined;
  let res;
  if ('userId' in owner) {
    res = await query<TripRow>(`INSERT INTO trips (user_id, status) VALUES ($1, 'saved') RETURNING *`, [owner.userId]);
  } else {
    tripKey = randomBytes(24).toString('base64url');
    res = await query<TripRow>(`INSERT INTO trips (anon_key_hash, status) VALUES ($1, 'draft') RETURNING *`, [hashTripKey(tripKey)]);
  }
  let trip = toTrip(res.rows[0] as TripRow);
  if (initial && Object.keys(initial).length > 0) {
    const ownerRef: Owner = 'userId' in owner ? { userId: owner.userId } : { anonKeyHash: hashTripKey(tripKey as string) };
    trip = (await applyBriefPatch(trip.id, ownerRef, initial)).trip;
  }
  return { trip, tripKey };
}

/** Attach the draft trip identified by tripKey to the user (called on sign-in and sign-up). */
export async function claimTrip(tripKey: string, userId: string): Promise<string[]> {
  const res = await query<{ id: string }>(
    `UPDATE trips SET user_id = $2, anon_key_hash = NULL, status = 'saved', updated_at = now()
      WHERE anon_key_hash = $1 RETURNING id`,
    [hashTripKey(tripKey), userId],
  );
  return res.rows.map((r) => r.id);
}

/** Draft trips that nobody has touched for a week are removed. */
export async function deleteStaleDrafts(): Promise<void> {
  await query(`DELETE FROM trips WHERE status = 'draft' AND updated_at < now() - interval '7 days'`);
}

// ---------------------------------------------------------------------------------------------------------
// The one writer
// ---------------------------------------------------------------------------------------------------------

const COLUMNS: Record<keyof BriefPatch, string> = {
  destination: 'destination',
  recommendRequested: 'recommend_requested',
  startDate: 'start_date',
  endDate: 'end_date',
  dateWindowText: 'date_window_text',
  durationDays: 'duration_days',
  adults: 'adults',
  childrenAges: 'children_ages',
  budget: 'budget_amount', // budget also sets budget_currency below
  transportPreference: 'transport_preference',
  accommodationPreference: 'accommodation_preference',
  destinationCity: 'dest_city',
  destinationCountry: 'dest_country_name',
  originCity: 'origin_city',
  originCountry: 'origin_country_name',
  interests: 'interests',
  specialRequirements: 'special_requirements',
};

/** The city and the country-name of a resolved place: a place named like its own country is the whole country (no city). */
function cityAndCountry(dest: { name: string; countryName?: string | null } | null): [string | null, string | null] {
  if (!dest) return [null, null];
  const country = dest.countryName?.trim() || null;
  const wholeCountry = country !== null && dest.name.trim().toLowerCase() === country.toLowerCase();
  return [wholeCountry ? null : dest.name, country ?? (wholeCountry ? dest.name : null)];
}

/**
 * Keep destination, city and country in step. The form sends city and/or country (the destination is then "City, Country");
 * chat and recommendations send a destination, which is looked up to fill the city and country in. A failed lookup leaves them empty.
 */
async function settleLocation(current: Trip, patch: BriefPatch): Promise<void> {
  if (patch.originCity !== undefined || patch.originCountry !== undefined) {
    const oc = (patch.originCity !== undefined ? patch.originCity : current.originCity)?.trim() || null;
    const ok = (patch.originCountry !== undefined ? patch.originCountry : current.originCountry)?.trim() || null;
    if (oc && !ok) throw new AppError(400, 'Enter the start country as well as the start city.', { fields: { originCountry: 'Enter the country too.' } });
    patch.originCity = oc;
    patch.originCountry = ok;
  }
  const parts = patch.destinationCity !== undefined || patch.destinationCountry !== undefined;
  if (parts) {
    const city = (patch.destinationCity !== undefined ? patch.destinationCity : current.destinationCity)?.trim() || null;
    const country = (patch.destinationCountry !== undefined ? patch.destinationCountry : current.destinationCountry)?.trim() || null;
    if (city && !country) throw new AppError(400, 'Enter the country as well as the city.', { fields: { destinationCountry: 'Enter the country too.' } });
    patch.destinationCity = city;
    patch.destinationCountry = country;
    patch.destination = [city, country].filter(Boolean).join(', ') || null;
    if (patch.destination) patch.recommendRequested = false;
    return;
  }
  if (patch.destination === undefined) return;
  if (patch.destination === null) {
    patch.destinationCity = null;
    patch.destinationCountry = null;
    return;
  }
  try {
    const { resolveDestination } = await import('../providers/knowledge/OpenMeteo.js');
    const ref = await resolveDestination(patch.destination);
    const [city, country] = ref ? cityAndCountry(ref) : [null, null];
    patch.destinationCity = city;
    patch.destinationCountry = country;
  } catch {
    patch.destinationCity = null;
    patch.destinationCountry = null;
  }
}

/** What the traveler still has to give before results can be shown (spec FR-006). */
export function missingMinimum(trip: Trip): string[] {
  const missing: string[] = [];
  if (!trip.destination && !trip.recommendRequested) missing.push('destinationOrRecommend');
  if (!trip.startDate || !trip.endDate) missing.push('datesOrDuration');
  if (!trip.adults || trip.adults < 1) missing.push('travelers');
  if (!trip.budget) missing.push('budget');
  if (!trip.transportPreference) missing.push('transport');
  if (!trip.accommodationPreference) missing.push('accommodation');
  return missing;
}

/** Validate and save a partial brief. Throws AppError 400 with per-field messages, or 409 when dates disagree. */
export async function applyBriefPatch(tripId: string, owner: Owner, rawPatch: unknown): Promise<{ trip: Trip; missing: string[] }> {
  const parsed = briefPatchSchema.safeParse(rawPatch);
  if (!parsed.success) throw new AppError(400, VALIDATION_MESSAGE, { fields: fieldsFromZod(parsed.error) });
  const patch: BriefPatch = { ...parsed.data };

  const current = await getTripForOwner(tripId, owner);
  await settleLocation(current, patch);
  const dates = resolveDates(current, patch);

  const sets: string[] = [];
  const values: unknown[] = [tripId];
  const push = (column: string, value: unknown): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  for (const key of Object.keys(patch) as Array<keyof BriefPatch>) {
    if (key === 'startDate' || key === 'endDate' || key === 'durationDays') continue; // resolved above
    if (key === 'budget') {
      push('budget_amount', patch.budget ? patch.budget.amount : null);
      push('budget_currency', patch.budget ? patch.budget.currency : null);
      continue;
    }
    push(COLUMNS[key], patch[key] ?? null);
  }
  const touchedDates = patch.startDate !== undefined || patch.endDate !== undefined || patch.durationDays !== undefined;
  if (touchedDates) {
    push('start_date', dates.startDate);
    push('end_date', dates.endDate);
    push('duration_days', dates.durationDays);
  }

  if (sets.length === 0) return { trip: current, missing: missingMinimum(current) };

  const o = ownerClause(owner, values.length + 1);
  values.push(o.value);
  const res = await query<TripRow>(
    `UPDATE trips SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND ${o.sql} RETURNING *`,
    values,
  );
  const row = res.rows[0];
  if (!row) throw new AppError(404, 'Trip not found');
  const trip = toTrip(row);
  return { trip, missing: missingMinimum(trip) };
}

/**
 * Chat extraction path: apply what the traveler said; fields that fail validation are dropped (and returned
 * so the agent can explain) instead of failing the whole message.
 */
export async function applyBriefPatchLenient(
  tripId: string,
  owner: Owner,
  patch: BriefPatch,
): Promise<{ trip: Trip; missing: string[]; rejected: Record<string, string> }> {
  let remaining: BriefPatch = { ...patch };
  const rejected: Record<string, string> = {};
  for (let attempt = 0; attempt < 3; attempt++) {
    if (Object.keys(remaining).length === 0) break;
    try {
      const result = await applyBriefPatch(tripId, owner, remaining);
      return { ...result, rejected };
    } catch (err) {
      if (!(err instanceof AppError) || (err.status !== 400 && err.status !== 409)) throw err;
      const fields = (err.extra?.['fields'] ?? {}) as Record<string, string>;
      const bad = Object.keys(fields);
      if (bad.length === 0) throw err;
      for (const f of bad) {
        rejected[f] = fields[f] as string;
        const aliases = f === 'durationDays' && err.status === 409 ? ['durationDays', 'startDate', 'endDate'] : [f];
        for (const a of aliases) delete (remaining as Record<string, unknown>)[a];
      }
    }
  }
  const trip = await getTripForOwner(tripId, owner);
  return { trip, missing: missingMinimum(trip), rejected };
}
