import { z } from 'zod';
import { unavailable, wrap } from '../agent/envelope.js';
import { registerTool } from '../agent/registry.js';
import { buildPlan } from '../budget/plan.js';
import { AppError } from '../errors.js';
import { generateItinerary, rankAttractions } from '../itinerary/generate.js';
import { parseOpeningHours } from '../itinerary/hours.js';
import { refForDestination } from '../knowledge/ensure.js';
import { fetchAttractions, OVERPASS_ATTRIBUTION } from '../providers/knowledge/OverpassSource.js';
import { getTripById } from '../trips/service.js';

// ---- calculate_budget ---------------------------------------------------------------------------------------------------------

const none = z.object({}).passthrough();

function registerCalculateBudget(): void {
  registerTool({
    name: 'calculate_budget',
    description: 'The trip budget by category (hotels, transportation, activities, food, local transport, miscellaneous) against the stated total, with the categories that have no real figure and any suggested savings. Totals come from the database.',
    parameters: { type: 'object', properties: {} },
    schema: none,
    chatCallable: true,
    handler: async (_args, ctx) => {
      const plan = await buildPlan(ctx.tripId);
      const b = plan.budget;
      const summary = `Estimated total ${b.currency} ${b.estimatedTotal} against a budget of ${b.budget ? `${b.currency} ${b.budget}` : 'none set'}. ${b.remaining ? `${b.remaining.startsWith('-') ? 'Over budget by' : 'Remaining'} ${b.currency} ${b.remaining.replace('-', '')}.` : ''} ${b.categoriesWithoutRealFigure.length > 0 ? `No real figure yet for: ${b.categoriesWithoutRealFigure.join(', ')}.` : ''}`.trim();
      return wrap({ summary, budget: plan.budget, overBudget: plan.overBudget, proposals: plan.proposals }, { source: 'faro-budget', fetched_at: new Date(), certainty: plan.budget.partial ? 'estimated' : 'estimated', note: plan.budget.partial ? 'Partial total: some categories have no real figure yet.' : 'A total built from sandbox rates and labelled estimates.' });
    },
    toCard: (r) => {
      const d = r.data as { budget: { estimatedTotal: string; budget: string | null; remaining: string | null; currency: string; categoriesWithoutRealFigure: string[] } } | null;
      return d
        ? {
            title: 'Budget',
            lines: [`Estimated total ${d.budget.currency} ${d.budget.estimatedTotal}${d.budget.budget ? ` of ${d.budget.currency} ${d.budget.budget}` : ''}`, d.budget.remaining ? `Remaining ${d.budget.currency} ${d.budget.remaining}` : 'No budget set', d.budget.categoriesWithoutRealFigure.length > 0 ? `No real figure yet: ${d.budget.categoriesWithoutRealFigure.join(', ')}` : 'Every category has a figure'],
            certainty: r.certainty, source: r.source, source_url: r.source_url, fetched_at: r.fetched_at,
          }
        : null;
    },
  });
}

// ---- create_itinerary -----------------------------------------------------------------------------------------------------------

const itinerarySchema = z.object({ days: z.array(z.coerce.number().int().min(1).max(14)).max(14).optional() });

function registerCreateItinerary(): void {
  registerTool({
    name: 'create_itinerary',
    description: 'Build or rebuild the day-by-day itinerary for the trip from real attractions that are open and reachable in time. Never invents activities.',
    parameters: { type: 'object', properties: { days: { type: 'array', items: { type: 'integer' }, description: 'Optional day numbers to rebuild.' } } },
    schema: itinerarySchema,
    chatCallable: true,
    handler: async (args, ctx) => {
      const a = itinerarySchema.parse(args);
      try {
        const result = await generateItinerary(ctx.tripId, a.days);
        const plan = await buildPlan(ctx.tripId);
        return wrap({ itinerary: plan.itinerary, notes: result.notes }, { source: 'overpass', source_url: 'https://www.openstreetmap.org/', fetched_at: new Date(), certainty: 'estimated', note: `${OVERPASS_ATTRIBUTION}. Visit lengths and travel times are estimates.` });
      } catch (err) {
        if (err instanceof AppError) return unavailable('overpass', err.message);
        throw err;
      }
    },
    toCard: (r) => {
      const d = r.data as { itinerary: Array<{ day: number; date: string; items: Array<{ kind: string; title: string }> }> } | null;
      return d
        ? { title: 'Itinerary', lines: d.itinerary.slice(0, 3).map((x) => `Day ${x.day}: ${x.items.filter((i) => i.kind === 'activity').map((i) => i.title).join(', ') || 'rest day'}`), certainty: r.certainty, source: r.source, source_url: r.source_url, fetched_at: r.fetched_at }
        : null;
    },
  });
}

// ---- search_attractions ---------------------------------------------------------------------------------------------------------

const attractionsSchema = z.object({ query: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(10).optional() });

function registerSearchAttractions(): void {
  registerTool({
    name: 'search_attractions',
    description: 'Attractions near the trip destination from OpenStreetMap with opening hours and fees when stated. Use it to answer what there is to see or do.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'What kind of thing, for example "museums".' }, limit: { type: 'integer', description: '1 to 10.' } } },
    schema: attractionsSchema,
    chatCallable: true,
    handler: async (args, ctx) => {
      const a = attractionsSchema.parse(args);
      const trip = await getTripById(ctx.tripId);
      if (!trip.destination) return unavailable('overpass', 'Choose a destination first.');
      const dest = await refForDestination(trip.destination);
      if (!dest || dest.lat === null || dest.lon === null) return unavailable('overpass', `Could not find "${trip.destination}".`);
      const found = await fetchAttractions(dest.lat, dest.lon);
      if (!found.ok) return unavailable('overpass', 'Attractions are unavailable right now.', 'https://www.openstreetmap.org/');
      const ranked = (await rankAttractions(found.attractions, a.query ?? trip.interests)).slice(0, a.limit ?? 5);
      return wrap(
        ranked.map((x) => ({ id: x.id, name: x.name, kind: x.kind, openingHours: x.openingHours, openingHoursReadable: parseOpeningHours(x.openingHours) !== null, fee: x.fee, charge: x.charge, lat: x.lat, lon: x.lon })),
        { source: 'overpass', source_url: 'https://www.openstreetmap.org/', fetched_at: found.fetchedAt, certainty: 'confirmed', note: OVERPASS_ATTRIBUTION },
      );
    },
    toCard: (r) => {
      const rows = (r.data as Array<{ name: string; openingHours: string | null; fee: string | null }> | null) ?? [];
      return rows.length > 0
        ? { title: 'Attractions', lines: rows.slice(0, 4).map((x) => `${x.name}${x.openingHours ? ` (${x.openingHours})` : ' (opening hours not listed)'}${x.fee === 'no' ? ', free' : x.fee === 'yes' ? ', paid' : ''}`), certainty: r.certainty, source: r.source, source_url: r.source_url, fetched_at: r.fetched_at }
        : null;
    },
  });
}

export function registerPlanTools(): void {
  registerCalculateBudget();
  registerCreateItinerary();
  registerSearchAttractions();
}
