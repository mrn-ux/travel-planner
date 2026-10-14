import { fetchJson } from '../../http.js';
import { DAY_MS, type DestinationRef, type FetchResult, type KnowledgeSource } from './KnowledgeSource.js';

// Nager.Date moved to nagerholidays.com; the API is open source and documents no rate limit.
const BASE = 'https://nagerholidays.com/api/v4/Holidays';

interface Holiday {
  date: string;
  name: string;
  nationalHoliday?: boolean;
  holidayTypes?: string[];
}

export class NagerHolidaysSource implements KnowledgeSource {
  readonly id = 'nager';
  readonly licence = 'Nager.Date (open source; see nagerholidays.com terms)';
  readonly ttlMs = 30 * DAY_MS;

  async fetch(dest: DestinationRef): Promise<FetchResult> {
    if (!dest.countryCode) return { ok: false, reason: 'not_found', detail: 'Unknown country' };
    const year = new Date().getUTCFullYear();
    const documents = [];
    let lastFailure: Extract<FetchResult, { ok: false }> | null = null;

    for (const y of [year, year + 1]) {
      const url = `${BASE}/${dest.countryCode}/${y}`;
      const res = await fetchJson<Holiday[]>(url, { provider: 'nager', ttlMs: 30 * DAY_MS, timeoutMs: 10000, minSpacingMs: 200 });
      if (!res.ok) {
        lastFailure = { ok: false, reason: res.reason, detail: res.detail };
        continue;
      }
      if (!Array.isArray(res.body) || res.body.length === 0) continue;
      documents.push({
        title: `Public holidays in ${dest.countryName ?? dest.countryCode} ${y}`,
        text:
          `Public holidays in ${dest.countryName ?? dest.countryCode} in ${y} (some may be optional or regional):\n` +
          res.body.map((h) => `${h.date}: ${h.name}${h.holidayTypes?.includes('Optional') ? ' (optional)' : ''}`).join('\n'),
        source_url: url,
        attribution: 'Public holiday data from Nager.Date',
        fetched_at: res.fetchedAt.toISOString(),
      });
    }
    if (documents.length === 0) return lastFailure ?? { ok: false, reason: 'not_found' };
    return { ok: true, documents };
  }
}
