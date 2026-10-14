import { ensureRate } from '../../budget/fx.js';
import { DAY_MS, type DestinationRef, type FetchResult, type KnowledgeSource } from './KnowledgeSource.js';

// Major currencies refreshed with the knowledge base so the stored rates stay current (24 hour lifetime). Any other pair
// is fetched on first use by the budget code (ensureRate).
const MAJOR = ['USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'INR'];

/** ECB reference rates through Frankfurter. Rates land in fx_rates (read by SQL); the document is a short summary for citations. */
export class FrankfurterSource implements KnowledgeSource {
  readonly id = 'frankfurter';
  readonly licence = 'ECB euro foreign exchange reference rates (via Frankfurter)';
  readonly ttlMs = DAY_MS;

  async fetch(_dest: DestinationRef): Promise<FetchResult> {
    const lines: string[] = [];
    let latest: string | null = null;
    let url: string | null = null;
    for (const quote of MAJOR) {
      const r = await ensureRate('EUR', quote);
      if (!r) continue;
      lines.push(`1 EUR = ${r.rate} ${quote}`);
      latest = r.fetchedAt;
      url = r.sourceUrl;
    }
    if (lines.length === 0 || !latest || !url) return { ok: false, reason: 'http_error', detail: 'No exchange rates could be fetched' };
    return {
      ok: true,
      documents: [
        {
          title: 'Euro foreign exchange reference rates',
          text: `European Central Bank reference rates, as published through Frankfurter:\n${lines.join('\n')}`,
          source_url: 'https://frankfurter.dev/',
          attribution: 'Exchange rates: European Central Bank reference rates via Frankfurter',
          fetched_at: latest,
        },
      ],
    };
  }
}
