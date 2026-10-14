import { fetchJson } from '../http.js';
import { hotelProvider } from '../providers/index.js';

// Currencies in use today (ISO 4217): obsolete codes that Wikidata also lists for a country (old zlotys, dinars, ...) are ignored.
const CURRENT = new Set<string>(Intl.supportedValuesOf('currency'));

/**
 * The mapping from every country (ISO 3166 code) to its currency (ISO 4217 code), read from Wikidata in one request and cached for 30
 * days. Where a country lists several, the pick is: a code that starts with the country code (Panama PAB), else EUR, else USD, else the
 * first current one.
 */
export async function currencyMap(): Promise<Record<string, string>> {
  const sparql = 'SELECT ?iso ?code WHERE { ?c wdt:P297 ?iso . ?c wdt:P38 ?cur . ?cur wdt:P498 ?code . }';
  const r = await fetchJson<{ results?: { bindings?: Array<{ iso?: { value: string }; code?: { value: string } }> } }>(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}`, {
    provider: 'wikidata-query',
    headers: { Accept: 'application/sparql-results+json' },
    ttlMs: 30 * 24 * 3600 * 1000,
    timeoutMs: 30000,
    minSpacingMs: 500,
  });
  if (!r.ok) return {};
  const candidates = new Map<string, string[]>();
  for (const b of r.body.results?.bindings ?? []) {
    const iso = b.iso?.value;
    const code = b.code?.value;
    if (!iso || !code || !/^[A-Z]{2}$/.test(iso) || !CURRENT.has(code)) continue;
    const list = candidates.get(iso) ?? [];
    if (!list.includes(code)) list.push(code);
    candidates.set(iso, list);
  }
  const out: Record<string, string> = {};
  for (const [iso, list] of candidates) {
    out[iso] = list.find((c) => c.startsWith(iso)) ?? (list.includes('EUR') ? 'EUR' : list.includes('USD') ? 'USD' : (list[0] as string));
  }
  // Territories whose Wikidata entry lists no currency of their own: they use their sovereign's (Antarctica has none).
  for (const [iso, code] of Object.entries({ FO: 'DKK', IM: 'GBP', BV: 'NOK', HM: 'AUD' })) out[iso] ??= code;
  return out;
}

/** The currency a country uses (null when unknown). */
export async function currencyOfCountry(isoCode: string): Promise<string | null> {
  const code = isoCode.replace(/[^A-Za-z]/g, '').toUpperCase();
  return (await currencyMap())[code] ?? null;
}

/** The currency of a country given by name (as the country list writes it). */
export async function currencyOfCountryName(name: string): Promise<string | null> {
  const countries = await hotelProvider().listCountries();
  const code = countries.ok ? countries.data.find((c) => c.name.toLowerCase() === name.toLowerCase())?.code : undefined;
  return code ? currencyOfCountry(code).catch(() => null) : null;
}
