import { z } from 'zod';
import { convertAmount } from '../budget/convert.js';
import { unavailable, wrap, type ToolResult } from '../agent/envelope.js';
import { registerTool } from '../agent/registry.js';

const schema = z.object({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)).pipe(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/)),
  from: z.string().length(3).transform((v) => v.toUpperCase()),
  to: z.string().length(3).transform((v) => v.toUpperCase()),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export interface ConversionData {
  converted: string;
  from: string;
  to: string;
  rate: string | null;
  rateDate: string | null;
}

export async function runConvertCurrency(args: z.infer<typeof schema>): Promise<ToolResult<ConversionData>> {
  const c = await convertAmount(args.amount, args.from, args.to, args.date);
  if (!c) return unavailable('frankfurter', `No exchange rate is available for ${args.from} to ${args.to}.`);
  return wrap<ConversionData>(
    { converted: c.converted, from: args.from, to: args.to, rate: c.rate, rateDate: c.rateDate },
    { source: 'frankfurter', source_url: c.sourceUrl ?? 'https://frankfurter.dev/', fetched_at: c.fetchedAt, certainty: c.certainty, note: c.certainty === 'estimated' ? 'ECB reference rate for its date: an estimate of what the bank will charge.' : undefined },
  );
}

export function registerConvertCurrency(): void {
  registerTool({
    name: 'convert_currency',
    description: 'Convert an amount between currencies with the stored ECB reference rate. The result is always an estimate.',
    parameters: {
      type: 'object',
      properties: { amount: { type: 'string', description: 'Decimal amount, for example "250.00".' }, from: { type: 'string', description: 'ISO currency code.' }, to: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD, optional.' } },
      required: ['amount', 'from', 'to'],
    },
    schema,
    chatCallable: true,
    handler: async (args) => runConvertCurrency(schema.parse(args)),
    toCard: (r) => {
      const d = r.data as ConversionData | null;
      return d ? { title: 'Currency conversion', lines: [`${d.from} to ${d.to}: ${d.converted} ${d.to}${d.rate ? ` (rate ${d.rate} on ${d.rateDate})` : ''}`], certainty: r.certainty, source: r.source, source_url: r.source_url, fetched_at: r.fetched_at } : null;
    },
  });
}
