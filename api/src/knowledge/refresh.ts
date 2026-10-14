import { query } from '../db.js';
import type { DestinationRef } from '../providers/knowledge/KnowledgeSource.js';
import { getSources } from '../providers/knowledge/registry.js';
import { deleteStaleDrafts } from '../trips/service.js';
import { refForDestination } from './ensure.js';
import { ingestDestination } from './ingest.js';

let running = false;

/**
 * Re-ingest every destination referenced by a saved trip whose chunks have expired, fetching only the sources that
 * expired (so a 6 hour advisory refresh does not re-read a 30 day guide). Also removes abandoned drafts.
 */
export async function refreshExpired(): Promise<{ destinations: number }> {
  if (running) return { destinations: 0 };
  running = true;
  try {
    const due = await query<{ destination: string; source: string }>(
      `SELECT DISTINCT t.destination, k.source
         FROM trips t
         JOIN knowledge_chunks k ON k.destination = t.destination OR k.destination LIKE t.destination || ', %'
        WHERE t.status <> 'draft' AND t.destination IS NOT NULL AND k.expires_at < now()`,
    );
    const byDestination = new Map<string, Set<string>>();
    for (const r of due.rows) {
      const set = byDestination.get(r.destination) ?? new Set<string>();
      set.add(r.source);
      byDestination.set(r.destination, set);
    }
    let count = 0;
    for (const [text, sourceIds] of byDestination) {
      const ref: DestinationRef | null = await refForDestination(text);
      if (!ref) continue;
      await ingestDestination(ref, getSources().filter((s) => sourceIds.has(s.id)));
      count++;
    }
    await deleteStaleDrafts();
    return { destinations: count };
  } finally {
    running = false;
  }
}
