import { z } from 'zod';
import { unavailable, wrap, type ToolResult } from '../agent/envelope.js';
import { registerTool } from '../agent/registry.js';
import { countryNameFromCode as countryName } from '../providers/knowledge/KnowledgeSource.js';
import { GOVUK_ATTRIBUTION, getTravelAdvice } from '../providers/knowledge/GovUkAdviceSource.js';

const schema = z.object({ countryCode: z.string().length(2) });

export interface AdvisoryData {
  country: string;
  summary: string;
  alertStatus: string[];
  updatedAt: string | null;
}

export async function runGetTravelAdvisory(args: z.infer<typeof schema>): Promise<ToolResult<AdvisoryData>> {
  const name = countryName(args.countryCode);
  if (!name) return unavailable('govuk-fcdo', `"${args.countryCode}" is not a country code.`);
  const got = await getTravelAdvice(name);
  if (!got.ok) {
    return unavailable('govuk-fcdo', got.reason === 'not_found' ? `No FCDO travel advice page for ${name}.` : 'The travel advice service is unavailable right now.');
  }
  const a = got.advice;
  return wrap<AdvisoryData>(
    { country: name, summary: a.summary, alertStatus: a.alertStatus, updatedAt: a.updatedAt },
    { source: 'govuk-fcdo', source_url: a.url, fetched_at: a.fetchedAt, certainty: 'confirmed', note: GOVUK_ATTRIBUTION },
  );
}

export function registerGetTravelAdvisory(): void {
  registerTool({
    name: 'get_travel_advisory',
    description: 'Current UK FCDO travel advice for a country (warnings and summary). Use it for any question about safety.',
    parameters: { type: 'object', properties: { countryCode: { type: 'string', description: 'Two-letter ISO country code, for example "PT".' } }, required: ['countryCode'] },
    schema,
    chatCallable: true,
    handler: async (args) => runGetTravelAdvisory(schema.parse(args)),
    toCard: (r) => {
      const d = r.data as AdvisoryData | null;
      if (!d) return null;
      return {
        title: `Travel advice: ${d.country}`,
        lines: [d.summary || 'No summary published.', d.alertStatus.length > 0 ? `Alerts: ${d.alertStatus.join(', ')}` : 'No FCDO warning against travel.'],
        certainty: r.certainty,
        source: r.source,
        source_url: r.source_url,
        fetched_at: r.fetched_at,
      };
    },
  });
}
