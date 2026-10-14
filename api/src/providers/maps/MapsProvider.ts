import type { ProviderResult } from '../types.js';

export interface GeocodeHit {
  lat: number;
  lon: number;
  displayName: string;
}

export interface MapsProvider {
  /** Cached, at most 1 request per second. No autocomplete: call it once per submitted address. */
  geocode(query: string, countryCode?: string): Promise<ProviderResult<GeocodeHit>>;
  /** Tile layer settings for the browser map; the attribution must be shown. */
  tileConfig(): { urlTemplate: string; attribution: string; maxZoom: number };
}
