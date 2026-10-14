import type { Certainty } from '../agent/envelope.js';

/** Where a value came from and how sure we are of it. Every provider result carries one. */
export interface Provenance {
  source: string;
  source_url: string | null;
  /** ISO time of the upstream fetch. */
  fetched_at: string;
  certainty: Certainty;
  /** true for every LiteAPI sandbox result. */
  sandbox?: true;
}

export type ProviderFailure = 'timeout' | 'rate_limited' | 'http_error' | 'not_found' | 'invalid_response';

/**
 * Every provider call returns this. A failure is returned, never thrown and never replaced by a fallback value:
 * the tool layer turns it into certainty 'unavailable'. Amounts inside `data` are decimal strings.
 */
export type ProviderResult<T> = { ok: true; data: T; provenance: Provenance } | { ok: false; reason: ProviderFailure; detail?: string };

export interface LatLon {
  lat: number;
  lon: number;
}
