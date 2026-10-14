import { z } from 'zod';
import { embedQuery } from '../knowledge/embed.js';
import { ensureDestinationKnowledge, refForDestination } from '../knowledge/ensure.js';
import { searchKnowledge, type KnowledgeHit } from '../knowledge/search.js';
import { unavailable, wrap, type ToolResult } from '../agent/envelope.js';
import { registerTool } from '../agent/registry.js';

const schema = z.object({
  destination: z.string().min(1).max(120),
  // The model sometimes sends an empty query for a general question: that means "an overview", not an error.
  query: z.string().max(300).optional().default(''),
  limit: z.coerce.number().int().min(1).max(8).optional(),
});

// First ingestion of a place takes a while (guides are chunked and embedded). Wait for it, but not forever.
const INGEST_WAIT_MS = 60_000;

export async function runSearchKnowledge(args: z.infer<typeof schema>): Promise<ToolResult<KnowledgeHit[]>> {
  const dest = await refForDestination(args.destination);
  if (!dest) return unavailable('knowledge-base', `Could not find the place "${args.destination}".`);

  await Promise.race([ensureDestinationKnowledge(dest).catch(() => undefined), new Promise((r) => setTimeout(r, INGEST_WAIT_MS))]);

  let hits: KnowledgeHit[];
  try {
    hits = await searchKnowledge(dest.key, await embedQuery(args.query.trim() || `things to know, see and do in ${dest.name}`), Math.max(args.limit ?? 5, 3)); // at least 3 passages: one is rarely enough to answer from
  } catch {
    return unavailable('knowledge-base', 'The knowledge base could not be searched right now.');
  }
  if (hits.length === 0) return unavailable('knowledge-base', `No information about ${dest.name} is stored yet.`);

  const oldest = hits.reduce((a, h) => (h.fetched_at < a ? h.fetched_at : a), hits[0]!.fetched_at);
  const anyExpired = hits.some((h) => h.expired);
  return wrap(hits, {
    source: 'knowledge-base',
    source_url: hits[0]!.source_url,
    fetched_at: oldest,
    certainty: anyExpired ? 'estimated' : 'confirmed',
    note: anyExpired ? 'Some of this information is past its refresh date and may be out of date.' : undefined,
  });
}

export function registerSearchKnowledge(): void {
  registerTool({
    name: 'search_knowledge',
    description:
      'Search the stored destination guides, climate, travel advice and public holidays for one destination. Use it for any factual question about a place. Results carry citations.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'The place, for example "Lisbon".' },
        query: { type: 'string', description: 'What to look for, for example "best neighbourhoods for nightlife".' },
        limit: { type: 'integer', description: 'How many passages, 1 to 8.' },
      },
      required: ['destination', 'query'],
    },
    schema,
    chatCallable: true,
    handler: async (args) => runSearchKnowledge(schema.parse(args)),
    toCard: (r) => {
      const hits = (r.data as KnowledgeHit[] | null) ?? [];
      if (hits.length === 0) return null;
      return {
        title: `From the guides: ${hits[0]!.title}`,
        lines: hits.slice(0, 3).map((h) => `${h.text.replace(/\s+/g, ' ').slice(0, 160)}... (${h.attribution})`),
        certainty: r.certainty,
        source: r.source,
        source_url: r.source_url,
        fetched_at: r.fetched_at,
      };
    },
  });
}
