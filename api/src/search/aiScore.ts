import { toCents } from '../providers/decimal.js';

/**
 * "AI recommendation" score: a deterministic, explained blend (not model-generated). Weights are in one place and
 * every row gets a one-line reason built from the same numbers. 0 to 100.
 */
export const HOTEL_WEIGHTS = { price: 40, rating: 30, distance: 20, availability: 10 } as const;
export const TRANSPORT_WEIGHTS = { price: 40, duration: 35, transfers: 25 } as const;

/** Share of the trip budget assumed for the hotel (the rest is transport, food and activities). */
export const HOTEL_BUDGET_SHARE = 0.4;

export interface Scored {
  score: number;
  reason: string;
}

const clamp = (n: number): number => Math.min(1, Math.max(0, n));

export function scoreHotel(input: { nightly: string | null; nights: number; budget: string | null; rating: string | null; distanceKm: number | null }): Scored {
  const w = HOTEL_WEIGHTS;
  const reasons: string[] = [];
  let score = 0;

  // Price: full marks at or under the nightly share of the budget, falling to zero at twice that.
  const nightly = toCents(input.nightly);
  const budget = toCents(input.budget);
  if (nightly !== null && budget !== null && input.nights > 0) {
    const share = (Number(budget) * HOTEL_BUDGET_SHARE) / input.nights;
    const ratio = Number(nightly) / share;
    score += w.price * clamp(2 - ratio);
    reasons.push(ratio <= 1 ? 'within your budget share' : 'above your budget share');
  } else {
    score += w.price * 0.5; // no budget or no price: neutral
  }

  if (input.rating !== null && Number.isFinite(Number(input.rating))) {
    score += w.rating * clamp(Number(input.rating) / 10);
    reasons.push(`rated ${input.rating}`);
  } else {
    score += w.rating * 0.5;
  }

  if (input.distanceKm !== null) {
    score += w.distance * clamp(1 - input.distanceKm / 10);
    reasons.push(`${input.distanceKm.toFixed(1)} km from the centre`);
  } else {
    score += w.distance * 0.5;
  }

  score += nightly !== null ? w.availability : 0;
  if (nightly === null) reasons.push('no live price');

  const text = reasons.join('; ');
  return { score: Math.round(score), reason: text.charAt(0).toUpperCase() + text.slice(1) + '.' };
}

export function scoreTransport(input: { priceCents: bigint | null; cheapestCents: bigint | null; durationMinutes: number | null; shortestMinutes: number | null; transfers: number | null }): Scored {
  const w = TRANSPORT_WEIGHTS;
  const reasons: string[] = [];
  let score = 0;

  if (input.priceCents !== null && input.cheapestCents !== null && input.cheapestCents > 0n) {
    const ratio = Number(input.priceCents) / Number(input.cheapestCents);
    score += w.price * clamp(2 - ratio);
    reasons.push(ratio <= 1.05 ? 'among the cheapest' : 'pricier than the cheapest');
  } else {
    score += w.price * 0.5;
  }

  if (input.durationMinutes !== null && input.shortestMinutes !== null && input.shortestMinutes > 0) {
    const ratio = input.durationMinutes / input.shortestMinutes;
    score += w.duration * clamp(2 - ratio);
    reasons.push(ratio <= 1.1 ? 'among the fastest' : 'slower than the fastest');
  } else {
    score += w.duration * 0.5;
  }

  if (input.transfers !== null) {
    score += w.transfers * clamp(1 - input.transfers / 4);
    reasons.push(input.transfers === 0 ? 'no changes' : `${input.transfers} change${input.transfers === 1 ? '' : 's'}`);
  } else {
    score += w.transfers * 0.5;
  }

  const text = reasons.join('; ');
  return { score: Math.round(score), reason: text ? text.charAt(0).toUpperCase() + text.slice(1) + '.' : 'Not enough information to rank.' };
}
