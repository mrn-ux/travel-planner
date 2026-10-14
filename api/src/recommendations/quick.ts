import { getTravelAdvice } from '../providers/knowledge/GovUkAdviceSource.js';
import { getClimate, monthName, OPEN_METEO_ATTRIBUTION } from '../providers/knowledge/OpenMeteo.js';
import type { Trip } from '../trips/service.js';
import type { Candidate } from './discover.js';
import {
  activitiesFromSearchRank,
  blend,
  FILTERS,
  idealBand,
  safetyFromAlerts,
  seasonScore,
  travelMonth,
  unassessed,
  type FactorResult,
  type Factors,
} from './score.js';

export interface Scored {
  candidate: Candidate;
  factors: Factors;
  score: number;
  /** Safety and season scores, kept for the hard filters. */
  safety: number | null;
  season: number | null;
}

const CANDIDATES_SCORED = 14;
const KEEP = 8;
const CONCURRENCY = 10;

async function inPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

async function seasonFactor(c: Candidate, trip: Trip): Promise<FactorResult> {
  const month = travelMonth(trip.startDate, trip.dateWindowText);
  if (month === null) return unassessed('season', 'no travel dates yet.');
  const climate = await getClimate(c.lat, c.lon, month);
  if (!climate.ok) return unassessed('season', 'the climate service did not answer.');
  const m = climate.body.months.find((x) => x.month === month);
  if (!m) return unassessed('season', 'no climate data for that month.');
  const score = seasonScore(m.meanTempC, m.rainDays, idealBand(trip.interests));
  return {
    score,
    reason: {
      factor: 'season',
      text: `In ${monthName(month)} it is typically ${m.meanTempC.toFixed(1)} °C with ${m.rainDays} rainy days (estimate from ${climate.body.year} weather data).`,
      certainty: 'estimated',
      source: 'open-meteo',
      source_url: climate.body.sourceUrl,
      fetched_at: climate.body.fetchedAt.toISOString(),
      attribution: OPEN_METEO_ATTRIBUTION,
    },
  };
}

async function safetyFactor(c: Candidate): Promise<FactorResult> {
  if (!c.countryName) return unassessed('safety', 'the country is not known.');
  const advice = await getTravelAdvice(c.countryName);
  if (!advice.ok) return unassessed('safety', 'the travel advice service did not answer.');
  const s = safetyFromAlerts(advice.advice.alertStatus, c.countryName);
  return {
    score: s.score,
    reason: { factor: 'safety', text: s.text, certainty: 'confirmed', source: 'govuk-fcdo', source_url: advice.advice.url, fetched_at: advice.advice.fetchedAt.toISOString() },
  };
}

function activitiesFactor(c: Candidate, trip: Trip): FactorResult {
  if (!trip.interests) return unassessed('activities', 'no interests given yet.');
  const score = activitiesFromSearchRank(c.interestRank);
  const matched = c.interestRank !== null;
  return {
    score,
    reason: {
      factor: 'activities',
      text: matched ? `Wikivoyage's guides match your interests ("${trip.interests.slice(0, 60)}").` : `Wikivoyage's guides do not stand out for your interests ("${trip.interests.slice(0, 60)}").`,
      certainty: 'estimated',
      source: 'wikivoyage',
      source_url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(c.name.replace(/ /g, '_'))}`,
      fetched_at: new Date().toISOString(),
      attribution: 'Wikivoyage, CC BY-SA 4.0',
    },
  };
}

// Hotel prices and travel costs come from plan 005's providers and fare estimator. Until they exist these two
// factors are honestly unavailable; they never get an invented figure.
const budgetFactor = (): FactorResult => unassessed('budget', 'hotel prices and travel costs arrive with the hotel and transport comparison.');
const transportFactor = (): FactorResult => unassessed('transport', 'travel options arrive with the transport comparison.');

/** Score the best candidates in parallel and keep the top 8. Returns [] when fewer than 3 could be scored. */
export async function quickRank(candidates: Candidate[], trip: Trip): Promise<{ ranked: Scored[]; relaxed: boolean; found: number }> {
  // Well-known places first, those matching the interests ahead of them.
  const ordered = [...candidates].sort((a, b) => (a.interestRank ?? 99) - (b.interestRank ?? 99) || b.popularity - a.popularity).slice(0, CANDIDATES_SCORED);

  const scored: Scored[] = await inPool(ordered, CONCURRENCY, async (candidate) => {
    const [season, safety] = await Promise.all([seasonFactor(candidate, trip), safetyFactor(candidate)]);
    const factors: Factors = { budget: budgetFactor(), season, activities: activitiesFactor(candidate, trip), transport: transportFactor(), safety };
    return { candidate, factors, score: blend(factors), safety: safety.score, season: season.score };
  });

  const survives = (s: Scored, minSeason: number): boolean => (s.safety === null || s.safety >= FILTERS.minSafety) && (s.season === null || s.season >= minSeason);
  let kept = scored.filter((s) => survives(s, FILTERS.minSeason));
  let relaxed = false;
  if (kept.length < 3) {
    // Relax the season threshold once. The safety exclusion is never relaxed.
    kept = scored.filter((s) => survives(s, 0));
    relaxed = true;
  }
  kept.sort((a, b) => b.score - a.score);
  return { ranked: kept.slice(0, KEEP), relaxed: relaxed && kept.length > 0, found: kept.length };
}
