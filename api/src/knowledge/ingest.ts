import { getPool, query } from '../db.js';
import type { DestinationRef, KnowledgeSource } from '../providers/knowledge/KnowledgeSource.js';
import { chunkDocument } from './chunk.js';
import { embedDocuments, toVectorLiteral } from './embed.js';

export interface SourceOutcome {
  source: string;
  status: 'ok' | 'failed' | 'skipped';
  inserted: number;
  unchanged: number;
  removed: number;
  error?: string;
}

async function markState(destination: string, source: string, status: 'ok' | 'failed', error?: string): Promise<void> {
  await query(
    `INSERT INTO ingest_state (destination, source, status, last_attempt, last_ok, error)
     VALUES ($1, $2, $3, now(), CASE WHEN $3 = 'ok' THEN now() END, $4)
     ON CONFLICT (destination, source) DO UPDATE SET
       status = EXCLUDED.status,
       last_attempt = now(),
       last_ok = CASE WHEN EXCLUDED.status = 'ok' THEN now() ELSE ingest_state.last_ok END,
       error = EXCLUDED.error`,
    [destination, source, status, error ?? null],
  );
}

async function ingestSource(dest: DestinationRef, source: KnowledgeSource): Promise<SourceOutcome> {
  const outcome: SourceOutcome = { source: source.id, status: 'ok', inserted: 0, unchanged: 0, removed: 0 };

  const fetched = await source.fetch(dest);
  if (!fetched.ok) {
    // The existing chunks stay (they expire and are then shown as estimated); nothing is invented.
    await markState(dest.key, source.id, 'failed', `${fetched.reason}${fetched.detail ? `: ${fetched.detail}` : ''}`);
    return { ...outcome, status: 'failed', error: fetched.reason };
  }

  const existing = await query<{ content_hash: string }>('SELECT content_hash FROM knowledge_chunks WHERE source = $1 AND destination = $2', [
    source.id,
    dest.key,
  ]);
  const known = new Set(existing.rows.map((r) => r.content_hash.trim()));
  const keep = new Set<string>();

  const fresh: Array<{ title: string; text: string; hash: string; doc: (typeof fetched.documents)[number] }> = [];
  for (const doc of fetched.documents) {
    for (const chunk of chunkDocument(source.id, dest.key, doc.title, doc.text)) {
      keep.add(chunk.contentHash);
      const expires = new Date(new Date(doc.fetched_at).getTime() + (doc.ttlMs ?? source.ttlMs));
      if (known.has(chunk.contentHash)) {
        // Unchanged text: refresh the dates only, no embedding.
        await query(
          'UPDATE knowledge_chunks SET fetched_at = $4, expires_at = $5 WHERE source = $1 AND destination = $2 AND content_hash = $3',
          [source.id, dest.key, chunk.contentHash, doc.fetched_at, expires],
        );
        outcome.unchanged++;
      } else {
        fresh.push({ title: doc.title, text: chunk.text, hash: chunk.contentHash, doc });
      }
    }
  }

  if (fresh.length > 0) {
    // Embedding can fail (Ollama down). The error propagates after recording the failure so the caller can report it.
    const vectors = await embedDocuments(fresh.map((f) => f.text));
    for (let i = 0; i < fresh.length; i++) {
      const f = fresh[i]!;
      const expires = new Date(new Date(f.doc.fetched_at).getTime() + (f.doc.ttlMs ?? source.ttlMs));
      await query(
        `INSERT INTO knowledge_chunks (source, source_url, licence, attribution, destination, title, chunk_text, content_hash, embedding, fetched_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, $10, $11)
         ON CONFLICT (source, destination, content_hash) DO NOTHING`,
        [source.id, f.doc.source_url, source.licence, f.doc.attribution, dest.key, f.title, f.text, f.hash, toVectorLiteral(vectors[i]!), f.doc.fetched_at, expires],
      );
      outcome.inserted++;
    }
  }

  // Text that vanished upstream (an old forecast, a rewritten guide section) is removed.
  const stale = [...known].filter((h) => !keep.has(h));
  if (stale.length > 0) {
    await query('DELETE FROM knowledge_chunks WHERE source = $1 AND destination = $2 AND content_hash = ANY($3::text[])', [source.id, dest.key, stale]);
    outcome.removed = stale.length;
  }

  await markState(dest.key, source.id, 'ok');
  return outcome;
}

/**
 * Fetch, chunk, embed and upsert one destination from the given sources. A Postgres advisory lock per destination
 * keeps two requests from ingesting the same place at once (the second returns 'skipped').
 */
export async function ingestDestination(dest: DestinationRef, sources: KnowledgeSource[]): Promise<SourceOutcome[]> {
  const client = await getPool().connect();
  try {
    const lock = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`ingest:${dest.key}`]);
    if (!lock.rows[0]?.locked) {
      return sources.map((s) => ({ source: s.id, status: 'skipped' as const, inserted: 0, unchanged: 0, removed: 0 }));
    }
    try {
      const outcomes: SourceOutcome[] = [];
      // Serial on purpose: Wikimedia asks for one request at a time and the embedder is local.
      for (const source of sources) {
        try {
          outcomes.push(await ingestSource(dest, source));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await markState(dest.key, source.id, 'failed', message).catch(() => undefined);
          outcomes.push({ source: source.id, status: 'failed', inserted: 0, unchanged: 0, removed: 0, error: message });
        }
      }
      return outcomes;
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [`ingest:${dest.key}`]);
    }
  } finally {
    client.release();
  }
}
