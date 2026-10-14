import { z } from 'zod';
import { unavailable, wrap, type ToolResult } from '../agent/envelope.js';
import { registerTool } from '../agent/registry.js';
import { AppError } from '../errors.js';
import { MODES, searchTransportForTrip, type TransportRow } from '../search/transport.js';
import { getTripById } from '../trips/service.js';

const schema = z.object({
  from: z.string().min(1).max(120),
  modes: z.array(z.enum(MODES)).max(10).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const hm = (minutes: number): string => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export async function runSearchTransport(tripId: string, args: z.infer<typeof schema>): Promise<ToolResult<TransportRow[]>> {
  const trip = await getTripById(tripId);
  try {
    const found = await searchTransportForTrip(trip, { ...args, sort: 'recommended' });
    if (found.items.length === 0) return unavailable('transitous', 'No transport options found.', found.provenance.source_url);
    return wrap(found.items.slice(0, 6), {
      source: 'transitous',
      source_url: found.provenance.source_url,
      fetched_at: found.provenance.fetched_at,
      certainty: found.provenance.certainty,
      note: `Timetable times are from published schedules. Prices are Faro estimates, not quotes. ${found.notes.join(' ')}`.trim(),
    });
  } catch (err) {
    if (err instanceof AppError) return unavailable('transitous', err.message);
    throw err;
  }
}

export function registerSearchTransport(): void {
  registerTool({
    name: 'search_transport',
    description:
      'Compare transport from the traveler origin to the trip destination: real timetables for trains, buses and ferries, and labelled estimates for prices. Transport is compared only, never booked.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Where the traveler starts, for example "Paris".' },
        modes: { type: 'array', items: { type: 'string', enum: [...MODES] } },
        date: { type: 'string', description: 'YYYY-MM-DD. Defaults to the trip start date.' },
      },
      required: ['from'],
    },
    schema,
    chatCallable: true,
    handler: async (args, ctx) => runSearchTransport(ctx.tripId, schema.parse(args)),
    toCard: (r) => {
      const rows = (r.data as TransportRow[] | null) ?? [];
      if (rows.length === 0) return null;
      return {
        title: 'Transport options',
        lines: rows
          .slice(0, 3)
          .map(
            (t) =>
              `${t.modeLabel}${t.provider ? ` (${t.provider})` : ''}: ${t.durationMinutes !== null ? hm(t.durationMinutes) : 'duration unavailable'}, ${
                t.price.amount ? `${t.price.currency} ${t.price.amount} (${t.price.certainty})` : 'price unavailable'
              }`,
          ),
        certainty: r.certainty,
        source: r.source,
        source_url: r.source_url,
        fetched_at: r.fetched_at,
      };
    },
  });
}
