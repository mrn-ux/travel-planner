# Contract: KnowledgeSource interface

File: `api/src/providers/knowledge/KnowledgeSource.ts`. One real implementation per source; `registry.ts` lists them. Plans 006 adds `OverpassSource` and `FrankfurterSource` to the registry.

```ts
export interface KnowledgeSource {
  readonly id: string;                         // 'wikivoyage', 'open-meteo', ...
  readonly licence: string;
  readonly ttlMs: number;                      // lifetime used to set expires_at
  /** Fetch current documents for a destination. Never throws; failures are returned. */
  fetch(dest: DestinationRef): Promise<FetchResult>;
}

export type DestinationRef = {
  key: string;            // "Lisbon, PT"
  name: string; countryCode: string | null; lat: number | null; lon: number | null;
};

export type FetchResult =
  | { ok: true; documents: SourceDocument[] }
  | { ok: false; reason: 'timeout' | 'rate_limited' | 'http_error' | 'not_found'; detail?: string };

export type SourceDocument = {
  title: string;
  text: string;                  // plain text, already cleaned of markup
  source_url: string;
  attribution: string;           // shown to the user with the chunk
  fetched_at: string;            // ISO
};
```

## Rules
- Every call goes through `fetchJson` (timeout, User-Agent from `DATA_USER_AGENT`, cache, per-host spacing).
- A failed or rate-limited call returns `ok:false`; the ingest records `failed` and keeps existing chunks (which become Estimated once expired). No fallback text is ever produced.
- Documents never include hotel rates, availability or departures; the registry rejects any source id outside the allowed list.
- Attribution strings: Wikivoyage/Wikipedia "Text from <Title>, <Wikivoyage|Wikipedia>, CC BY-SA 4.0, <article URL>"; GOV.UK "Contains public sector information licensed under the Open Government Licence v3.0"; Open-Meteo "Weather data by Open-Meteo.com (CC BY 4.0)"; Wikidata "Wikidata (CC0)"; OSM-derived data "© OpenStreetMap contributors (ODbL)".
