import { flightProvider } from '../providers/index.js';
import { AppError } from '../errors.js';
import { refForDestination } from '../knowledge/ensure.js';
import { transportProvider } from '../providers/index.js';
import { toCents } from '../providers/decimal.js';
import type { Certainty } from '../agent/envelope.js';
import type { Place } from '../providers/transport/TransportProvider.js';
import { estimateFare, flightMinutes, groundMinutes, haversineKm, type EstimatedMode } from '../transport/fareEstimate.js';
import type { Trip } from '../trips/service.js';
import { scoreTransport } from './aiScore.js';
import type { Priced } from './hotels.js';

export const MODES = ['flight', 'train', 'bus', 'ferry', 'metro', 'transit', 'car', 'transfer', 'taxi', 'walking'] as const;
export type RequestedMode = (typeof MODES)[number];

export interface TransportRow {
  optionId: string;
  mode: RequestedMode;
  /** Traveler-facing mode name. */
  modeLabel: string;
  provider: string | null;
  departure: string | null;
  arrival: string | null;
  departureTz: string | null;
  arrivalTz: string | null;
  durationMinutes: number | null;
  durationCertainty: Certainty;
  transfers: number | null;
  price: Priced;
  scheduleCertainty: Certainty;
  priceSource: 'transitous-fare' | 'faro-estimate' | 'duffel-sandbox' | null;
  /** The provider's own id for the offer, when it can be booked. */
  providerRef: string | null;
  recommendedReason: string;
  /** Why something is unavailable or estimated. */
  note: string | null;
}

export interface TransportSearch {
  items: TransportRow[];
  needsFrom: boolean;
  origin: string | null;
  destination: string;
  date: string;
  distanceKm: string | null;
  notes: string[];
  provenance: { source: string; source_url: string; fetched_at: string; certainty: Certainty };
}

export interface TransportFilters {
  modes?: RequestedMode[];
  from?: string;
  date?: string;
  sort?: 'price' | 'duration' | 'departure' | 'recommended';
  dir?: 'asc' | 'desc';
}

const LABELS: Record<RequestedMode, string> = {
  flight: 'Flight',
  train: 'Train',
  bus: 'Bus',
  ferry: 'Ferry',
  metro: 'Metro / subway',
  transit: 'Public transportation',
  car: 'Rental car',
  transfer: 'Private transfer',
  taxi: 'Taxi',
  walking: 'Walking',
};

const NO_DATA: Partial<Record<RequestedMode, string>> = {
  car: 'No free source for rental car prices or availability.',
  transfer: 'No free source for private transfer prices or availability.',
  taxi: 'No free source for taxi fares or availability.',
  walking: 'Walking times are not available from the free routing service.',
};

const unavailablePrice: Priced = { amount: null, currency: null, certainty: 'unavailable' };

// Long-distance ground travel beyond this is not offered as an estimate: the model is not meaningful there.
const MAX_GROUND_KM = 3000;

// Itineraries from the timetable cache between searches so a selection (by optionId) can be looked up again.
const recent = new Map<string, { at: number; rows: TransportRow[]; origin: string; destination: string }>();
const RECENT_MS = 30 * 60_000;

export function findOption(tripId: string, optionId: string): { row: TransportRow; origin: string; destination: string } | undefined {
  const entry = recent.get(tripId);
  const row = entry && Date.now() - entry.at < RECENT_MS ? entry.rows.find((r) => r.optionId === optionId) : undefined;
  return entry && row ? { row, origin: entry.origin, destination: entry.destination } : undefined;
}

async function priceFor(mode: EstimatedMode, distanceKm: number, durationMinutes: number | null, currency: string, date: string): Promise<{ price: Priced; note: string | null }> {
  const fare = await estimateFare({ mode, distanceKm, durationMinutes, currency, date });
  if (!fare.ok) return { price: unavailablePrice, note: fare.reason };
  const e = fare.estimate;
  return { price: { amount: e.amount, currency: e.currency, certainty: 'estimated', range: { low: e.low, high: e.high }, basis: e.basis }, note: null };
}

/** Sandbox flight offers for the trip's party, or null when Duffel is not configured or returned nothing usable. */
async function sandboxFlights(trip: Trip, fromNames: string[], toNames: string[], date: string) {
  const provider = flightProvider();
  if (!provider) return null;
  const res = await provider.searchFlights({ originNames: fromNames, destinationNames: toNames, date, adults: trip.adults ?? 1, childrenAges: trip.childrenAges });
  return res.ok ? res.data : null;
}

export async function searchTransportForTrip(trip: Trip, f: TransportFilters): Promise<TransportSearch> {
  if (!trip.destination) throw new AppError(400, 'Choose a destination first.', { fields: { destination: 'Required.' } });
  const date = f.date ?? trip.startDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(400, 'Set a travel date first.', { fields: { date: 'Required.' } });

  const modes = f.modes && f.modes.length > 0 ? f.modes : (['train', 'bus', 'flight'] as RequestedMode[]);
  const currency = trip.budget?.currency ?? 'USD';
  const base = { destination: trip.destination, date, notes: [] as string[] };
  const provenanceBase = { source: 'transitous', source_url: 'https://transitous.org/sources/', fetched_at: new Date().toISOString() };

  if (!f.from || f.from.trim() === '') {
    return { ...base, items: [], needsFrom: true, origin: null, distanceKm: null, provenance: { ...provenanceBase, certainty: 'unavailable' } };
  }

  const transport = transportProvider();
  const [geo, destRef] = await Promise.all([transport.geocode(f.from.trim()), refForDestination(trip.destination)]);
  if (!geo.ok) throw new AppError(geo.reason === 'timeout' ? 504 : 502, 'Place lookup is unavailable right now.');
  const from: Place | undefined = geo.data[0];
  if (!from) throw new AppError(404, `We could not find "${f.from}".`, { fields: { from: 'Place not found.' } });
  if (!destRef || destRef.lat === null || destRef.lon === null) throw new AppError(404, `We could not find "${trip.destination}".`);
  const to: Place = { name: destRef.name, lat: destRef.lat, lon: destRef.lon, countryCode: destRef.countryCode };

  const distanceKm = haversineKm(from, to);
  const rows: TransportRow[] = [];
  let fetchedAt = new Date().toISOString();
  const notes = base.notes;

  // ---- Real timetables (train, bus, ferry, metro, public transport) ---------------------------------------------
  const timetableModes = modes.filter((m) => m === 'train' || m === 'bus' || m === 'ferry' || m === 'metro' || m === 'transit');
  let timetableFailed = false;
  if (timetableModes.length > 0) {
    const plan = await transport.searchTransport({ from, to, date });
    if (!plan.ok) {
      timetableFailed = true;
      notes.push('Timetables are unavailable right now.');
    } else {
      fetchedAt = plan.provenance.fetched_at;
      const seen = new Set<string>();
      for (const o of plan.data) {
        if (!timetableModes.includes(o.mode)) continue;
        const dedupe = `${o.mode}|${o.departure}|${o.arrival}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        let price: Priced = unavailablePrice;
        let priceSource: TransportRow['priceSource'] = null;
        let note: string | null = null;
        if (o.fare) {
          price = { amount: o.fare.amount, currency: o.fare.currency, certainty: 'confirmed' };
          priceSource = 'transitous-fare';
        } else if (o.mode === 'train' || o.mode === 'bus' || o.mode === 'ferry') {
          const p = await priceFor(o.mode, distanceKm, o.durationMinutes, currency, date);
          price = p.price;
          note = p.note;
          priceSource = p.price.amount ? 'faro-estimate' : null;
        } else {
          note = 'Local transit fares are not available from the timetable data.';
        }
        rows.push({
          optionId: `${trip.id}:${o.key}`, mode: o.mode, modeLabel: LABELS[o.mode], provider: o.operator, departure: o.departure, arrival: o.arrival, departureTz: o.departureTz, arrivalTz: o.arrivalTz,
          durationMinutes: o.durationMinutes, durationCertainty: 'confirmed', transfers: o.transfers, price, scheduleCertainty: 'confirmed',
          priceSource, providerRef: null, recommendedReason: '', note,
        });
        if (rows.length >= 15) break;
      }
      if (rows.length === 0) {
        notes.push(`No published timetable covers ${date}. Public transport data is usually available only a few weeks ahead. Estimates are shown instead.`);
      }
    }
  }

  // ---- Estimated rows where the timetable has nothing (labelled, never with invented times) ---------------------------
  for (const mode of timetableModes) {
    if (mode !== 'train' && mode !== 'bus') continue;
    if (timetableFailed || rows.some((r) => r.mode === mode)) continue;
    if (distanceKm > MAX_GROUND_KM) continue;
    const minutes = groundMinutes(mode, distanceKm);
    const p = await priceFor(mode, distanceKm, minutes, currency, date);
    rows.push({
      optionId: `${trip.id}:est-${mode}`, mode, modeLabel: LABELS[mode], provider: null, departure: null, arrival: null, departureTz: null, arrivalTz: null, durationMinutes: minutes,
      durationCertainty: 'estimated', transfers: null, price: p.price, scheduleCertainty: 'unavailable', priceSource: p.price.amount ? 'faro-estimate' : null, providerRef: null,
      recommendedReason: '', note: 'No published timetable for this date. Duration and price are estimates from the distance.',
    });
  }

  // ---- Flights: an estimated price and duration, no schedule ------------------------------------------------------------
  const flightOffers = modes.includes('flight') ? await sandboxFlights(trip, [f.from?.trim() ?? '', from.name, trip.originCountry ?? ''].filter(Boolean), [trip.destinationCity ?? '', trip.destinationCountry ?? '', to.name, trip.destination ?? ''].filter(Boolean), date) : null;
  if (flightOffers && flightOffers.length > 0) {
    notes.push('Flight offers are from the Duffel test environment: sandbox data, not real fares or schedules.');
    rows.push(...flightOffers.map((o): TransportRow => ({
      optionId: `${trip.id}:duffel-${o.id}`, mode: 'flight', modeLabel: LABELS.flight, provider: o.airline, departure: o.departure, arrival: o.arrival,
      departureTz: o.departureTz, arrivalTz: o.arrivalTz, durationMinutes: o.durationMinutes, durationCertainty: 'confirmed', transfers: o.stops,
      price: { amount: o.amount, currency: o.currency, certainty: 'confirmed' }, scheduleCertainty: 'confirmed', priceSource: 'duffel-sandbox', providerRef: o.id, recommendedReason: '',
      note: 'Duffel sandbox offer (test data, not a real fare).',
    })));
  } else if (modes.includes('flight')) {
    const p = await priceFor('flight', distanceKm, null, currency, date);
    rows.push({
      optionId: `${trip.id}:est-flight`, mode: 'flight', modeLabel: LABELS.flight, provider: null, departure: null, arrival: null, departureTz: null, arrivalTz: null,
      durationMinutes: flightMinutes(distanceKm), durationCertainty: 'estimated', transfers: null, price: p.price, scheduleCertainty: 'unavailable',
      priceSource: p.price.amount ? 'faro-estimate' : null, providerRef: null, recommendedReason: '', note: 'No free source for flight schedules. Price and duration are estimates from the distance.',
    });
  }

  // ---- Modes with no free data ---------------------------------------------------------------------------------------------
  for (const mode of modes) {
    const why = NO_DATA[mode];
    if (!why) continue;
    rows.push({
      optionId: `${trip.id}:none-${mode}`, mode, modeLabel: LABELS[mode], provider: null, departure: null, arrival: null, departureTz: null, arrivalTz: null, durationMinutes: null, durationCertainty: 'unavailable',
      transfers: null, price: unavailablePrice, scheduleCertainty: 'unavailable', priceSource: null, providerRef: null, recommendedReason: 'Not available.', note: why,
    });
  }

  // ---- AI recommendation reasons, then sorting ---------------------------------------------------------------------------
  const cents = (r: TransportRow): bigint | null => toCents(r.price.amount);
  const prices = rows.map(cents).filter((c): c is bigint => c !== null);
  const cheapest = prices.length > 0 ? prices.reduce((a, b) => (a < b ? a : b)) : null;
  const durations = rows.map((r) => r.durationMinutes).filter((d): d is number => d !== null);
  const shortest = durations.length > 0 ? Math.min(...durations) : null;
  const scores = new Map<string, number>();
  for (const r of rows) {
    if (r.price.amount === null && r.durationMinutes === null) continue;
    const s = scoreTransport({ priceCents: cents(r), cheapestCents: cheapest, durationMinutes: r.durationMinutes, shortestMinutes: shortest, transfers: r.transfers });
    r.recommendedReason = s.reason;
    scores.set(r.optionId, s.score);
  }

  const sort = f.sort ?? 'recommended';
  const sign = (f.dir ?? (sort === 'recommended' ? 'desc' : 'asc')) === 'asc' ? 1 : -1;
  const keyOf = (r: TransportRow): number | null =>
    sort === 'price' ? (cents(r) === null ? null : Number(cents(r))) : sort === 'duration' ? r.durationMinutes : sort === 'departure' ? (r.departure ? Date.parse(r.departure) : null) : (scores.get(r.optionId) ?? null);
  rows.sort((a, b) => {
    const x = keyOf(a);
    const y = keyOf(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // no value: last
    return (x - y) * sign;
  });

  recent.set(trip.id, { at: Date.now(), rows, origin: from.name, destination: trip.destination });
  return {
    ...base,
    items: rows,
    needsFrom: false,
    origin: from.name,
    distanceKm: distanceKm.toFixed(0),
    provenance: { ...provenanceBase, fetched_at: fetchedAt, certainty: timetableFailed ? 'unavailable' : 'confirmed' },
  };
}
