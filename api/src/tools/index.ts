import { registerGetTravelAdvisory } from './getTravelAdvisory.js';
import { registerGetWeather } from './getWeather.js';
import { registerRecommendDestinations } from './recommendDestinations.js';
import { registerBookingTools } from './bookingTools.js';
import { registerConvertCurrency } from './convertCurrency.js';
import { registerPlanTools } from './planTools.js';
import { registerSearchHotels } from './searchHotels.js';
import { registerSearchTransport } from './searchTransport.js';
import { registerSearchKnowledge } from './searchKnowledge.js';

/** Tools for plans 004 to 007. Later plans add theirs in the same way. */
export function registerKnowledgeTools(): void {
  registerSearchKnowledge();
  registerGetWeather();
  registerGetTravelAdvisory();
  registerRecommendDestinations();
  registerSearchHotels();
  registerSearchTransport();
  registerConvertCurrency();
  registerPlanTools();
  registerBookingTools();
}
