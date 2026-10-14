import { query } from '../db.js';
import { resolveDestination } from '../providers/knowledge/OpenMeteo.js';
import type { DestinationRef } from '../providers/knowledge/KnowledgeSource.js';
import { getSources } from '../providers/knowledge/registry.js';
import { ingestDestination, type SourceOutcome } from './ingest.js';

/** Turn the trip's destination text into a normalised reference (name, country, coordinates). Geocoding is cached 30 days. */
export function refForDestination(text: string): Promise<DestinationRef | null> {
  return resolveDestination(text);
}

// Destinations being ingested right now in this process, so repeated requests do not queue duplicates.
const running = new Map<string, Promise<SourceOutcome[]>>();

/**
 * Ingest the sources a destination has never been read from (a place refined for recommendations already has its
 * guides; the first time it is chosen or discussed it still needs weather, advice and holidays). Later refreshes are the
 * scheduler's job. Returns the in-flight promise when one is already running.
 */
export function ensureDestinationKnowledge(dest: DestinationRef): Promise<SourceOutcome[]> {
  const inflight = running.get(dest.key);
  if (inflight) return inflight;
  const job = (async () => {
    const done = await query<{ source: string }>("SELECT source FROM ingest_state WHERE destination = $1 AND status = 'ok'", [dest.key]);
    const have = new Set(done.rows.map((r) => r.source));
    const missing = getSources().filter((s) => !have.has(s.id));
    return missing.length > 0 ? ingestDestination(dest, missing) : [];
  })().finally(() => running.delete(dest.key));
  running.set(dest.key, job);
  return job;
}

export interface KnowledgeStatus {
  destination: string;
  sources: Array<{ source: string; status: string; lastOk: string | null }>;
}

export async function knowledgeStatus(destination: string): Promise<KnowledgeStatus> {
  const res = await query<{ source: string; status: string; last_ok: Date | null }>(
    'SELECT source, status, last_ok FROM ingest_state WHERE destination = $1 ORDER BY source',
    [destination],
  );
  return { destination, sources: res.rows.map((r) => ({ source: r.source, status: r.status, lastOk: r.last_ok ? r.last_ok.toISOString() : null })) };
}
