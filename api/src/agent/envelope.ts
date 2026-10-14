// Every tool returns this envelope. The agent passes source, source_url, fetched_at and certainty through to
// the UI; the model never states a fact that did not come from a tool result.

export type Certainty = 'confirmed' | 'estimated' | 'unavailable';

export interface ToolResult<T = unknown> {
  ok: boolean;
  /** null when certainty is 'unavailable'. */
  data: T | null;
  /** For example 'liteapi', 'open-meteo', 'knowledge-base'. */
  source: string;
  source_url: string | null;
  /** ISO time of the upstream fetch. */
  fetched_at: string | null;
  certainty: Certainty;
  /** Present and true for LiteAPI and Stripe results. */
  sandbox?: true;
  /** Short reason when unavailable or estimated. */
  note?: string;
}

/** A failed, rate-limited or timed-out source: unavailable, never a fallback value. */
export function unavailable(source: string, note: string, sourceUrl: string | null = null): ToolResult<never> {
  return { ok: false, data: null, source, source_url: sourceUrl, fetched_at: null, certainty: 'unavailable', note };
}

export function wrap<T>(
  data: T,
  provenance: { source: string; source_url?: string | null; fetched_at?: string | Date | null; certainty: Certainty; sandbox?: true; note?: string },
): ToolResult<T> {
  const fetched = provenance.fetched_at;
  return {
    ok: true,
    data,
    source: provenance.source,
    source_url: provenance.source_url ?? null,
    fetched_at: fetched instanceof Date ? fetched.toISOString() : (fetched ?? null),
    certainty: provenance.certainty,
    ...(provenance.sandbox ? { sandbox: true as const } : {}),
    ...(provenance.note ? { note: provenance.note } : {}),
  };
}

/** A result shown beneath an agent message in the chat (rendered by the web app). */
export interface ResultCard {
  title: string;
  lines: string[];
  certainty: Certainty;
  source: string;
  source_url: string | null;
  fetched_at: string | null;
  sandbox?: boolean;
}
