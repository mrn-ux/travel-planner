import { ALLOWED_SOURCE_IDS, type KnowledgeSource } from './KnowledgeSource.js';
import { FrankfurterSource } from './FrankfurterSource.js';
import { OverpassSource } from './OverpassSource.js';
import { GovUkAdviceSource } from './GovUkAdviceSource.js';
import { NagerHolidaysSource } from './NagerHolidaysSource.js';
import { OpenMeteoSource } from './OpenMeteoSource.js';
import { WikidataSource } from './WikidataSource.js';
import { wikipediaSource, wikivoyageSource } from './MediaWikiSource.js';

const sources = new Map<string, KnowledgeSource>();

/**
 * Add a knowledge source. Plan 006 adds Overpass (attractions) and Frankfurter (exchange rates).
 * Only ids on the allowed list are accepted, so hotel rates, availability and departures can never be stored.
 */
export function registerSource(source: KnowledgeSource): void {
  if (!(ALLOWED_SOURCE_IDS as readonly string[]).includes(source.id)) {
    throw new Error(`Source "${source.id}" is not allowed in the knowledge base`);
  }
  sources.set(source.id, source);
}

export function getSources(): KnowledgeSource[] {
  return [...sources.values()];
}

export function getSource(id: string): KnowledgeSource | undefined {
  return sources.get(id);
}

// REST Countries is not used: its v3.1 API is deprecated and the replacement needs an API key. Country facts
// come from Wikidata instead.
[wikivoyageSource, wikipediaSource, new WikidataSource(), new OpenMeteoSource(), new GovUkAdviceSource(), new NagerHolidaysSource(), new OverpassSource(), new FrankfurterSource()].forEach(registerSource);
