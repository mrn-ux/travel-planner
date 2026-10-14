import { z } from 'zod';
import { unavailable, wrap, type ToolResult } from '../agent/envelope.js';
import { registerTool } from '../agent/registry.js';
import { recommendationsForTool, type Recommendation } from '../recommendations/service.js';
import { getTripById } from '../trips/service.js';

const schema = z.object({ limit: z.coerce.number().int().min(1).max(8).optional() });

export async function runRecommendDestinations(tripId: string, args: z.infer<typeof schema>): Promise<ToolResult<Recommendation[]>> {
  const trip = await getTripById(tripId);
  const v = await recommendationsForTool(trip, args.limit ?? 5);
  if (v.recommendations.length === 0) {
    return unavailable('faro-ranking', v.insufficient ? `No destinations could be ranked: ${v.insufficient.limitingFactor}.` : 'The ranking is still being prepared. Ask again in a moment.');
  }
  // Scores blend estimates (climate) and confirmed facts (advisories); each reason carries its own label.
  return wrap(v.recommendations, {
    source: 'faro-ranking',
    fetched_at: new Date(),
    certainty: 'estimated',
    note: v.limited ? 'Based on limited data: the guides could not be read.' : 'Ranked by season, activities and safety. Budget and transport are not assessed until the comparison step.',
  });
}

export function registerRecommendDestinations(): void {
  registerTool({
    name: 'recommend_destinations',
    description: 'Rank destinations for this trip when the traveler has not chosen one. Uses the trip brief. Each result has reasons with sources.',
    parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'How many destinations, 1 to 8.' } } },
    schema,
    chatCallable: true,
    handler: async (args, ctx) => runRecommendDestinations(ctx.tripId, schema.parse(args)),
    toCard: (r) => {
      const list = (r.data as Recommendation[] | null) ?? [];
      if (list.length === 0) return null;
      return {
        title: 'Suggested destinations',
        lines: list.slice(0, 3).map((x) => `${x.rank}. ${x.destination} (score ${Math.round(x.score)}): ${x.reasons.find((y) => y.certainty !== 'unavailable')?.text ?? 'see the results page'}`),
        certainty: r.certainty,
        source: r.source,
        source_url: r.source_url,
        fetched_at: r.fetched_at,
      };
    },
  });
}
