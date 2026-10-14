import { embedQuery } from '../knowledge/embed.js';
import { ingestDestination } from '../knowledge/ingest.js';
import { searchKnowledge } from '../knowledge/search.js';
import { getSource } from '../providers/knowledge/registry.js';
import type { KnowledgeSource } from '../providers/knowledge/KnowledgeSource.js';
import { activitiesFromSimilarity, blend, type FactorResult } from './score.js';
import type { Scored } from './quick.js';

const REFINE_TOP = 5;
const MAX_EXCERPT = 180;

/** Start at a sentence, drop wiki heading marks, end at a word. */
export function tidyExcerpt(text: string): string {
  let t = text.replace(/=+\s*([^=\n]+?)\s*=+/g, '$1.').replace(/\s+/g, ' ').trim();
  const start = t.search(/(?<=[.!?]\s)[A-Z]/);
  if (!/^[A-Z]/.test(t) && start > 0 && start < 200) t = t.slice(start);
  if (t.length <= MAX_EXCERPT) return t;
  const cut = t.slice(0, MAX_EXCERPT);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60))}...`;
}

const guideSources = (): KnowledgeSource[] => ['wikivoyage', 'wikipedia'].map((id) => getSource(id)).filter((s): s is KnowledgeSource => s !== undefined);

/**
 * Background refinement of the quick list: ingest the guides for the top 5, score "activities" by how closely the
 * guide passages match the traveler's interests, and attach a cited guide-based reason. Throws when nothing could be
 * refined (Ollama down, every source failed); the caller keeps the quick list and says it is based on limited data.
 */
export async function refineTop(ranked: Scored[], interests: string | null): Promise<Scored[]> {
  const top = ranked.slice(0, REFINE_TOP);
  const rest = ranked.slice(REFINE_TOP);
  const query = interests?.trim() ? interests.trim() : 'things to see and do';
  const queryVector = await embedQuery(query);

  const refined: Scored[] = [];
  let anyGuide = false;
  for (const s of top) {
    const dest = { key: s.candidate.key, name: s.candidate.name, countryCode: s.candidate.countryCode, countryName: s.candidate.countryName, lat: s.candidate.lat, lon: s.candidate.lon, wikidataId: s.candidate.wikidataId ?? undefined };
    await ingestDestination(dest, guideSources());
    const hits = await searchKnowledge(dest.key, queryVector, 3, ['wikivoyage', 'wikipedia']);
    if (hits.length === 0) {
      refined.push(s); // no guide for this one: its quick score stands
      continue;
    }
    anyGuide = true;
    const mean = hits.reduce((a, h) => a + h.similarity, 0) / hits.length;
    const best = hits[0]!;
    const excerpt = tidyExcerpt(best.text);
    const activities: FactorResult = {
      score: activitiesFromSimilarity(mean),
      reason: {
        factor: 'activities',
        text: interests ? `Closest passage in the ${dest.name} guide to "${interests.slice(0, 60)}": "${excerpt}"` : `From the ${dest.name} guide: "${excerpt}"`,
        certainty: best.expired ? 'estimated' : 'confirmed',
        source: best.source,
        source_url: best.source_url,
        fetched_at: best.fetched_at,
        attribution: best.attribution,
      },
    };
    const factors = { ...s.factors, activities };
    refined.push({ ...s, factors, score: blend(factors) });
  }
  if (!anyGuide) throw new Error('No guides could be fetched for the top destinations');

  refined.sort((a, b) => b.score - a.score);
  return [...refined, ...rest];
}
