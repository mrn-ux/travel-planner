import { getPool } from '../db.js';
import { toVectorLiteral } from './embed.js';

export interface KnowledgeHit {
  title: string;
  text: string;
  source: string;
  source_url: string;
  licence: string;
  attribution: string;
  fetched_at: string;
  /** Past its lifetime: still returned, but shown as estimated. */
  expired: boolean;
  /** Cosine similarity, 0 to 1 (higher is closer). */
  similarity: number;
}

interface Row {
  title: string;
  chunk_text: string;
  source: string;
  source_url: string;
  licence: string;
  attribution: string;
  fetched_at: Date;
  expired: boolean;
  similarity: number;
}

/** Cosine-similarity search within one destination. Expired chunks stay searchable (flagged), never hidden. */
export async function searchKnowledge(destination: string, queryEmbedding: number[], limit = 5, sources?: string[]): Promise<KnowledgeHit[]> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // Without iterative scan a destination filter on an HNSW index can return too few rows.
    await client.query("SELECT set_config('hnsw.iterative_scan', 'relaxed_order', true), set_config('hnsw.ef_search', '100', true)");
    const res = await client.query<Row>(
      `SELECT title, chunk_text, source, source_url, licence, attribution, fetched_at,
              (expires_at < now()) AS expired,
              1 - (embedding <=> $1::vector) AS similarity
         FROM knowledge_chunks
        WHERE destination = $2 AND ($4::text[] IS NULL OR source = ANY($4::text[]))
        ORDER BY embedding <=> $1::vector
        LIMIT $3`,
      [toVectorLiteral(queryEmbedding), destination, Math.min(Math.max(limit, 1), 8), sources ?? null],
    );
    await client.query('COMMIT');
    return res.rows.map((r) => ({
      title: r.title,
      text: r.chunk_text,
      source: r.source,
      source_url: r.source_url,
      licence: r.licence,
      attribution: r.attribution,
      fetched_at: r.fetched_at.toISOString(),
      expired: r.expired,
      similarity: Number(r.similarity),
    }));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
