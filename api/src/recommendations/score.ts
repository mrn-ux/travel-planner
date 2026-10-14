import type { Certainty } from '../agent/envelope.js';

export type Factor = 'budget' | 'season' | 'activities' | 'transport' | 'safety';

/** Blend weights, in one place. They add up to 100. */
export const WEIGHTS: Record<Factor, number> = { budget: 30, season: 20, activities: 20, transport: 15, safety: 15 };

/** A factor with no data counts as neutral, so a missing source never wins or loses a destination on its own. */
export const NEUTRAL = 50;

/** Hard filters applied before ranking. The season one is relaxed once if fewer than 3 destinations survive. */
export const FILTERS = { minSeason: 30, minSafety: 20 };

export interface Reason {
  factor: Factor;
  text: string;
  certainty: Certainty;
  source: string;
  source_url: string | null;
  fetched_at: string | null;
  /** Licence credit for guide-derived text (shown under the reason). */
  attribution?: string;
}

export interface FactorResult {
  /** 0-100, or null when there is nothing to score. */
  score: number | null;
  reason: Reason;
}

export type Factors = Record<Factor, FactorResult>;

export const clamp = (n: number, lo = 0, hi = 100): number => Math.min(hi, Math.max(lo, n));

export function blend(f: Factors): number {
  let total = 0;
  for (const factor of Object.keys(WEIGHTS) as Factor[]) {
    total += WEIGHTS[factor] * (f[factor].score ?? NEUTRAL);
  }
  return Math.round((total / 100) * 100) / 100;
}

export const unassessed = (factor: Factor, why: string): FactorResult => ({
  score: null,
  reason: { factor, text: `Could not be assessed: ${why}`, certainty: 'unavailable', source: 'faro', source_url: null, fetched_at: null },
});

// ---- Season -------------------------------------------------------------------------------------------------

/** The temperature band the traveler would enjoy, from their interests (a default of 18-26 °C). */
export function idealBand(interests: string | null): { lo: number; hi: number } {
  const t = (interests ?? '').toLowerCase();
  if (/\b(ski|skiing|snow|snowboard|winter sports)\b/.test(t)) return { lo: -5, hi: 5 };
  if (/\b(beach|beaches|swim|swimming|sunbathe|sun|snorkel|diving|surf)\b/.test(t)) return { lo: 24, hi: 32 };
  if (/\b(hike|hiking|trek|trekking|walking|cycling)\b/.test(t)) return { lo: 10, hi: 22 };
  return { lo: 18, hi: 26 };
}

export function seasonScore(meanTempC: number, rainDays: number, band: { lo: number; hi: number }): number {
  const off = meanTempC < band.lo ? band.lo - meanTempC : meanTempC > band.hi ? meanTempC - band.hi : 0;
  const rainPenalty = Math.max(0, rainDays - 8) * 2.5;
  return Math.round(clamp(100 - off * 6 - rainPenalty));
}

// ---- Safety -------------------------------------------------------------------------------------------------

/** FCDO alert_status values to a safety score and a plain sentence. */
export function safetyFromAlerts(alerts: string[], country: string): { score: number; text: string } {
  if (alerts.includes('avoid_all_travel_to_whole_country')) return { score: 0, text: `The UK FCDO advises against all travel to ${country}.` };
  if (alerts.includes('avoid_all_but_essential_travel_to_whole_country')) return { score: 15, text: `The UK FCDO advises against all but essential travel to ${country}.` };
  if (alerts.includes('avoid_all_travel_to_parts')) return { score: 55, text: `The UK FCDO advises against all travel to parts of ${country}.` };
  if (alerts.includes('avoid_all_but_essential_travel_to_parts')) return { score: 65, text: `The UK FCDO advises against all but essential travel to parts of ${country}.` };
  return { score: 100, text: `The UK FCDO has no warning against travel to ${country}.` };
}

// ---- Activities ---------------------------------------------------------------------------------------------

/** Quick tier: how early the place appeared in a Wikivoyage search on the traveler's interests. */
export function activitiesFromSearchRank(rank: number | null): number {
  return rank === null ? 35 : Math.round(clamp(100 - rank * 3, 40, 100));
}

/** Refined tier: mean cosine similarity of the closest guide passages (nomic-embed-text sits around 0.35-0.75). */
export function activitiesFromSimilarity(meanSimilarity: number): number {
  return Math.round(clamp(((meanSimilarity - 0.35) / 0.4) * 100));
}

// ---- Travel month -------------------------------------------------------------------------------------------

const MONTH_WORDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** 1-12 from the start date, else from a month named in the date window text, else null. */
export function travelMonth(startDate: string | null, windowText: string | null): number | null {
  if (startDate) return Number(startDate.slice(5, 7));
  if (windowText) {
    const t = windowText.toLowerCase();
    const i = MONTH_WORDS.findIndex((m) => new RegExp(`\\b${m}[a-z]*\\b`).test(t));
    if (i >= 0) return i + 1;
  }
  return null;
}
