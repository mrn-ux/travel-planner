import { createHash } from 'node:crypto';
import { getConfig } from './config.js';
import { query } from './db.js';

export type FetchFailReason = 'timeout' | 'rate_limited' | 'http_error' | 'invalid_response' | 'network';

export type FetchResult<T> =
  | { ok: true; status: number; body: T; cached: boolean; fetchedAt: Date }
  | { ok: false; reason: FetchFailReason; status?: number; detail?: string };

export interface FetchOptions {
  /** Provider name stored with the cache row (for example 'open-meteo'). */
  provider: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /** Request body for POST (form-encoded or JSON string). */
  body?: string;
  /** Cache lifetime in milliseconds. 0 (default) bypasses the cache: use it for rates, availability, bookings. */
  ttlMs?: number;
  /** Abort after this long. Default 8 seconds. */
  timeoutMs?: number;
  /** Minimum gap between requests to the same host, in milliseconds (per-process queue). */
  minSpacingMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

// Per-host queue so calls to one host are spaced out (for example Nominatim: one request per second).
const hostTail = new Map<string, Promise<void>>();
const hostLast = new Map<string, number>();

async function waitForHostSlot(host: string, spacingMs: number): Promise<void> {
  if (spacingMs <= 0) return;
  const previous = hostTail.get(host) ?? Promise.resolve();
  const turn = previous.then(async () => {
    const wait = (hostLast.get(host) ?? 0) + spacingMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    hostLast.set(host, Date.now());
  });
  hostTail.set(host, turn.catch(() => undefined));
  await turn;
}

function cacheKey(opts: FetchOptions, url: string): string {
  const raw = [opts.provider, opts.method ?? 'GET', url, opts.body ?? ''].join('\n');
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * The only way the API calls an outside service. Adds the identifying User-Agent, a timeout, host spacing
 * and an optional Postgres-backed cache. A failure, timeout, 429 or non-2xx returns { ok: false } so callers
 * report "unavailable". It never returns a stale or invented value.
 */
export async function fetchJson<T = unknown>(url: string, opts: FetchOptions): Promise<FetchResult<T>> {
  const ttlMs = opts.ttlMs ?? 0;
  const key = cacheKey(opts, url);

  if (ttlMs > 0) {
    try {
      const hit = await query<{ status: number; body: T; fetched_at: Date }>(
        'SELECT status, body, fetched_at FROM http_cache WHERE cache_key = $1 AND expires_at > now()',
        [key],
      );
      const row = hit.rows[0];
      if (row) return { ok: true, status: row.status, body: row.body, cached: true, fetchedAt: row.fetched_at };
    } catch (err) {
      console.warn('http_cache read failed:', err);
    }
  }

  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return { ok: false, reason: 'invalid_response', detail: 'Invalid URL' };
  }
  await waitForHostSlot(host, opts.minSpacingMs ?? 0);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { 'User-Agent': getConfig().dataUserAgent, Accept: 'application/json', ...opts.headers },
      body: opts.body,
      signal: controller.signal,
    });
    if (res.status === 429) return { ok: false, reason: 'rate_limited', status: 429 };
    if (!res.ok) return { ok: false, reason: 'http_error', status: res.status };

    let body: T;
    try {
      body = (await res.json()) as T;
    } catch {
      return { ok: false, reason: 'invalid_response', status: res.status, detail: 'Response was not JSON' };
    }

    const fetchedAt = new Date();
    if (ttlMs > 0) {
      try {
        await query(
          `INSERT INTO http_cache (cache_key, provider, status, body, fetched_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (cache_key) DO UPDATE
             SET status = EXCLUDED.status, body = EXCLUDED.body,
                 fetched_at = EXCLUDED.fetched_at, expires_at = EXCLUDED.expires_at`,
          [key, opts.provider, res.status, JSON.stringify(body), fetchedAt, new Date(fetchedAt.getTime() + ttlMs)],
        );
      } catch (err) {
        console.warn('http_cache write failed:', err);
      }
    }
    return { ok: true, status: res.status, body, cached: false, fetchedAt };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return { ok: false, reason: 'timeout' };
    return { ok: false, reason: 'network', detail: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
