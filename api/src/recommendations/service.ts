import { createHash } from 'node:crypto';
import { getPool, query } from '../db.js';
import type { Trip } from '../trips/service.js';
import { discoverCandidates } from './discover.js';
import { quickRank, type Scored } from './quick.js';
import { refineTop } from './refine.js';
import type { Reason } from './score.js';

export interface Recommendation {
  rank: number;
  destination: string;
  countryCode: string | null;
  score: number;
  completeness: 'quick' | 'full';
  previousRank?: number;
  reasons: Reason[];
}

export interface RecommendationsView {
  status: 'loading' | 'partial' | 'ready' | 'insufficient';
  refining: boolean;
  /** Refinement failed: the list is the quick one ("Based on limited data"). */
  limited: boolean;
  recommendations: Recommendation[];
  /** Present when status is 'insufficient'. */
  insufficient?: { limitingFactor: string; found: number };
  /** Present when the season filter had to be relaxed to reach three destinations. */
  note?: string;
}

interface Row {
  rank: number;
  destination: string;
  country_code: string | null;
  score: string;
  reasons: Reason[];
  completeness: 'quick' | 'full';
  previous_rank: number | null;
  brief_hash: string;
}

/** The part of the brief that changes a ranking. Changing anything else leaves the list alone. */
export function briefHash(trip: Trip): string {
  const parts = [trip.budget?.amount, trip.budget?.currency, trip.startDate, trip.endDate, trip.dateWindowText, trip.durationDays, trip.interests, trip.transportPreference, trip.adults, trip.childrenAges.join(',')];
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);
}

const generating = new Map<string, Promise<void>>();
const refining = new Set<string>();
const failedRefine = new Set<string>();
const insufficient = new Map<string, { hash: string; limitingFactor: string; found: number; note?: string }>();
const relaxedNote = new Map<string, string>();

function toRecommendation(r: Row): Recommendation {
  return {
    rank: r.rank,
    destination: r.destination,
    countryCode: r.country_code ? r.country_code.trim() : null,
    score: Number(r.score),
    completeness: r.completeness,
    ...(r.previous_rank !== null ? { previousRank: r.previous_rank } : {}),
    reasons: r.reasons,
  };
}

async function loadRows(tripId: string): Promise<Row[]> {
  const res = await query<Row>(
    'SELECT rank, destination, country_code, score, reasons, completeness, previous_rank, brief_hash FROM trip_recommendations WHERE trip_id = $1 ORDER BY rank',
    [tripId],
  );
  return res.rows;
}

async function persist(tripId: string, hash: string, list: Scored[], completeness: Array<'quick' | 'full'>, previous: Map<string, number>): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM trip_recommendations WHERE trip_id = $1', [tripId]);
    for (let i = 0; i < list.length; i++) {
      const s = list[i]!;
      const reasons = (['budget', 'season', 'activities', 'transport', 'safety'] as const).map((f) => s.factors[f].reason);
      await client.query(
        `INSERT INTO trip_recommendations (trip_id, rank, destination, country_code, score, reasons, completeness, previous_rank, brief_hash, refined_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, CASE WHEN $7 = 'full' THEN now() END)`,
        [tripId, i + 1, s.candidate.name, s.candidate.countryCode, s.score, JSON.stringify(reasons), completeness[i], previous.get(s.candidate.key) ?? null, hash],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Quick tier, then refinement in the background. Resolves when the quick tier is stored (or found insufficient). */
function generate(trip: Trip, excluded: string[]): Promise<void> {
  const existing = generating.get(trip.id);
  if (existing) return existing;
  const hash = briefHash(trip);

  const job = (async () => {
    insufficient.delete(trip.id);
    failedRefine.delete(trip.id);
    relaxedNote.delete(trip.id);
    const candidates = await discoverCandidates(trip.interests, excluded);
    const { ranked, relaxed, found } = await quickRank(candidates, trip);
    if (ranked.length < 3) {
      const limiting = candidates.length === 0 ? 'no candidate destinations could be loaded from the open data sources' : 'too few destinations passed the season and safety checks';
      insufficient.set(trip.id, { hash, limitingFactor: limiting, found: ranked.length || found });
      await query('DELETE FROM trip_recommendations WHERE trip_id = $1', [trip.id]);
      return;
    }
    if (relaxed) relaxedNote.set(trip.id, 'Few destinations suit the season, so the seasonal check was relaxed to show at least three.');
    await persist(trip.id, hash, ranked, ranked.map(() => 'quick'), new Map());

    // Refinement runs after the response; its failure keeps the quick list.
    refining.add(trip.id);
    void refineTop(ranked, trip.interests)
      .then(async (refined) => {
        const before = new Map(ranked.map((s, i) => [s.candidate.key, i + 1]));
        const moved = new Map<string, number>();
        refined.forEach((s, i) => {
          const was = before.get(s.candidate.key);
          if (was !== undefined && was !== i + 1) moved.set(s.candidate.key, was);
        });
        const topKeys = new Set(refined.slice(0, 5).map((s) => s.candidate.key));
        await persist(trip.id, hash, refined, refined.map((s) => (topKeys.has(s.candidate.key) ? 'full' : 'quick')), moved);
      })
      .catch((err) => {
        console.warn(`Refinement failed for trip ${trip.id}:`, err instanceof Error ? err.message : err);
        failedRefine.add(trip.id);
      })
      .finally(() => refining.delete(trip.id));
  })()
    .catch((err) => {
      console.warn(`Recommendation failed for trip ${trip.id}:`, err instanceof Error ? err.message : err);
      insufficient.set(trip.id, { hash, limitingFactor: 'the open data sources did not answer', found: 0 });
    })
    .finally(() => generating.delete(trip.id));
  generating.set(trip.id, job);
  return job;
}

async function view(trip: Trip): Promise<RecommendationsView | null> {
  const hash = briefHash(trip);
  const rows = (await loadRows(trip.id)).filter((r) => r.brief_hash === hash);
  const isRefining = refining.has(trip.id);
  if (rows.length > 0) {
    const allFull = rows.slice(0, 5).every((r) => r.completeness === 'full');
    const limited = !allFull && !isRefining;
    return { status: allFull ? 'ready' : isRefining ? 'partial' : 'ready', refining: isRefining, limited, recommendations: rows.map(toRecommendation), ...(relaxedNote.has(trip.id) ? { note: relaxedNote.get(trip.id) } : {}) };
  }
  const bad = insufficient.get(trip.id);
  if (bad && bad.hash === hash) {
    return { status: 'insufficient', refining: false, limited: false, recommendations: [], insufficient: { limitingFactor: bad.limitingFactor, found: bad.found } };
  }
  return null;
}

/** Current list for the trip's brief. Starts generating in the background when there is none, and says "loading". */
export async function getRecommendations(trip: Trip): Promise<RecommendationsView> {
  const current = await view(trip);
  if (current) return current;
  void generate(trip, []);
  return { status: 'loading', refining: false, limited: false, recommendations: [] };
}

/** New ranking now (the quick tier is awaited), excluding destinations the traveler dismissed. */
export async function refreshRecommendations(trip: Trip, excluded: string[]): Promise<RecommendationsView> {
  await generating.get(trip.id);
  await generate(trip, excluded);
  return (await view(trip)) ?? { status: 'loading', refining: false, limited: false, recommendations: [] };
}

/** For the agent tool: wait (bounded) for the quick tier. */
export async function recommendationsForTool(trip: Trip, limit: number): Promise<RecommendationsView> {
  const current = await view(trip);
  if (current) return { ...current, recommendations: current.recommendations.slice(0, limit) };
  await Promise.race([generate(trip, []), new Promise((r) => setTimeout(r, 40_000))]);
  const after = await view(trip);
  return after ? { ...after, recommendations: after.recommendations.slice(0, limit) } : { status: 'loading', refining: false, limited: false, recommendations: [] };
}

export const hasFailedRefinement = (tripId: string): boolean => failedRefine.has(tripId);
