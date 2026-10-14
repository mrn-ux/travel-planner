import { ensureRate } from '../budget/fx.js';
import { fromCents, toCents } from '../providers/decimal.js';

/**
 * Indicative fare model. This is a rule-based ESTIMATOR, not a provider and not mock data: the price is derived from
 * real inputs (the great-circle distance between the real origin and destination, and the real timetable duration when
 * there is one) with the rule-of-thumb rates below. It is always labelled Estimated, "Faro estimate, not a quote",
 * and it never produces departure or arrival times. All rates are USD and live in this one object.
 */
export const FARE_MODEL = {
  train: { perKmLow: 0.12, perKmHigh: 0.22, fixed: 0 },
  bus: { perKmLow: 0.05, perKmHigh: 0.1, fixed: 0 },
  ferry: { perKmLow: 0.2, perKmHigh: 0.4, fixed: 10 },
  // Flights: fixed fare plus a per-km rate by length band.
  flightShort: { maxKm: 1500, base: 45, perKm: 0.09 },
  flightMedium: { maxKm: 4000, base: 70, perKm: 0.07 },
  flightLong: { base: 140, perKm: 0.06 },
  /** A flight's range around the midpoint. */
  flightSpread: 0.25,
  /** Cruise speed and ground allowance for an indicative flight duration. */
  flightKmPerHour: 800,
  flightGroundMinutes: 60,
  /** Average speeds for an indicative duration when there is no timetable. */
  speeds: { train: 90, bus: 60 },
} as const;

export type EstimatedMode = 'train' | 'bus' | 'ferry' | 'flight';

export interface FareEstimate {
  /** Decimal strings in the requested currency. */
  amount: string;
  low: string;
  high: string;
  currency: string;
  certainty: 'estimated';
  source: 'faro-estimate';
  note: 'Indicative price from a distance-based model, not a quote';
  /** The assumptions, shown to the traveler. */
  basis: string;
}

export type FareResult = { ok: true; estimate: FareEstimate } | { ok: false; reason: string };

/** Great-circle distance in kilometres. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Indicative flight duration in minutes: cruise time plus a ground allowance. */
export const flightMinutes = (distanceKm: number): number => Math.round((distanceKm / FARE_MODEL.flightKmPerHour) * 60 + FARE_MODEL.flightGroundMinutes);

/** Indicative duration for a mode with no timetable, from the distance and an average speed. Estimated. */
export const groundMinutes = (mode: 'train' | 'bus', distanceKm: number): number => Math.round((distanceKm / FARE_MODEL.speeds[mode]) * 60);

/** USD to another currency with the stored ECB rate (Frankfurter, 24 h). null when no rate is available. */
async function usdRate(currency: string, _date: string): Promise<{ rate: string; url: string } | null> {
  if (currency === 'USD') return { rate: '1', url: 'https://frankfurter.dev/' };
  const stored = await ensureRate('USD', currency);
  return stored ? { rate: stored.rate, url: stored.sourceUrl } : null;
}

/** USD amount (as a float rate times) -> currency string, via integer cents. */
function convert(usd: number, rate: string): string {
  const cents = toCents(usd.toFixed(2)) ?? 0n;
  const [whole, frac = ''] = rate.split('.');
  const scale = 10n ** BigInt(frac.length);
  const r = BigInt((whole ?? '0') + frac);
  return fromCents((cents * r * 2n + scale) / (scale * 2n));
}

export async function estimateFare(q: { mode: EstimatedMode; distanceKm: number | null; durationMinutes?: number | null; currency: string; date: string }): Promise<FareResult> {
  const { mode, distanceKm, currency } = q;
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm <= 0) return { ok: false, reason: 'The distance is unknown.' };
  const fx = await usdRate(currency.toUpperCase(), q.date);
  if (!fx) return { ok: false, reason: `No exchange rate for ${currency}.` };

  let low: number;
  let high: number;
  let band: string;
  if (mode === 'flight') {
    const f = distanceKm < FARE_MODEL.flightShort.maxKm ? FARE_MODEL.flightShort : distanceKm < FARE_MODEL.flightMedium.maxKm ? FARE_MODEL.flightMedium : FARE_MODEL.flightLong;
    const mid = f.base + f.perKm * distanceKm;
    low = mid * (1 - FARE_MODEL.flightSpread);
    high = mid * (1 + FARE_MODEL.flightSpread);
    band = `flight: USD ${f.base} + ${f.perKm} per km, plus or minus ${FARE_MODEL.flightSpread * 100}%`;
  } else {
    const m = FARE_MODEL[mode];
    low = m.fixed + m.perKmLow * distanceKm;
    high = m.fixed + m.perKmHigh * distanceKm;
    band = `${mode}: USD ${m.perKmLow} to ${m.perKmHigh} per km${m.fixed ? ` plus USD ${m.fixed}` : ''}`;
  }
  const mid = (low + high) / 2;
  return {
    ok: true,
    estimate: {
      amount: convert(mid, fx.rate),
      low: convert(low, fx.rate),
      high: convert(high, fx.rate),
      currency: currency.toUpperCase(),
      certainty: 'estimated',
      source: 'faro-estimate',
      note: 'Indicative price from a distance-based model, not a quote',
      basis: `${Math.round(distanceKm)} km great-circle distance; ${band}${currency.toUpperCase() === 'USD' ? '' : `; converted at the ECB rate ${fx.rate}`}. Not a quote.`,
    },
  };
}
