import { getConfig } from '../config.js';
import { query } from '../db.js';
import { discoverCandidates } from '../recommendations/discover.js';
import { getSources } from '../providers/knowledge/registry.js';
import { ingestDestination } from './ingest.js';

const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * After start-up, fill the knowledge base with the best-known destinations so recommendations are rich from the first
 * request. Serial and in the background: it never blocks a request, and it stops when sources keep failing.
 * Destinations already ingested are skipped, so a restart does not repeat the work.
 */
export async function warmUp(): Promise<void> {
  const limit = getConfig().warmupDestinations;
  if (limit <= 0) return;
  const candidates = (await discoverCandidates(null)).slice(0, limit);
  let failures = 0;
  for (const c of candidates) {
    const done = await query<{ n: string }>("SELECT count(*) AS n FROM ingest_state WHERE destination = $1 AND status = 'ok'", [c.key]);
    if (Number(done.rows[0]?.n ?? 0) > 0) continue;
    const outcomes = await ingestDestination(
      { key: c.key, name: c.name, countryCode: c.countryCode, countryName: c.countryName, lat: c.lat, lon: c.lon, wikidataId: c.wikidataId ?? undefined },
      getSources(),
    );
    const ok = outcomes.some((o) => o.status === 'ok');
    failures = ok ? 0 : failures + 1;
    if (failures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn('Knowledge warm-up stopped: sources keep failing. It will not retry until the next start.');
      return;
    }
  }
  console.log(`Knowledge warm-up finished (${candidates.length} destinations checked).`);
}
