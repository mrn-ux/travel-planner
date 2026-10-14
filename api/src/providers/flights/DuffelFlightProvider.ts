import { Duffel } from '@duffel/api';
import { getConfig } from '../../config.js';
import type { ProviderResult } from '../types.js';
import type { FlightOffer, FlightOfferDetail, FlightOrder, FlightPassenger, FlightProvider, FlightSearchQuery } from './FlightProvider.js';

const MAX_OFFERS = 8;

// Formal country names (as hotel and ISO lists write them) that airport searches do not know, with the name people use.
const COMMON_NAMES: Record<string, string> = {
  'russian federation': 'Russia',
  'korea, republic of': 'South Korea',
  "korea, democratic people's republic of": 'North Korea',
  'taiwan, province of china': 'Taiwan',
  'brunei darussalam': 'Brunei',
  'bolivia, plurinational state of': 'Bolivia',
  'venezuela, bolivarian republic of': 'Venezuela',
  'iran, islamic republic of': 'Iran',
  'tanzania, united republic of': 'Tanzania',
  'moldova, republic of': 'Moldova',
  'syrian arab republic': 'Syria',
  "lao people's democratic republic": 'Laos',
  'congo, the democratic republic of the': 'Kinshasa',
  'macedonia, the former yugoslav republic of': 'North Macedonia',
  'micronesia, federated states of': 'Micronesia',
  'viet nam': 'Vietnam',
  'cabo verde': 'Cape Verde',
  // Found by scanning every country in the hotel list: names airport search does not match, with a place it does.
  'bosnia and herzegovina': 'Sarajevo',
  'czech republic': 'Prague',
  'antigua and barbuda': 'Antigua',
  'bonaire, sint eustatius and saba': 'Bonaire',
  'falkland islands (malvinas)': 'Falkland Islands',
  'palestine, state of': 'Tel Aviv',
  'saint barthélemy': 'St Barthelemy',
  'saint kitts and nevis': 'St Kitts',
  'saint lucia': 'St Lucia',
  'saint martin (french part)': 'St Martin',
  'saint pierre and miquelon': 'Saint-Pierre',
  'saint vincent and the grenadines': 'St Vincent',
  'sao tome and principe': 'Sao Tome',
  'sint maarten (dutch part)': 'St Maarten',
  'svalbard and jan mayen': 'Longyearbyen',
  swaziland: 'Eswatini',
  'trinidad and tobago': 'Port of Spain',
  'turks and caicos islands': 'Providenciales',
  'wallis and futuna': 'Wallis',
  'åland islands': 'Mariehamn',
  // No airport of their own: the nearest one is searched.
  monaco: 'Nice',
  'vatican city': 'Rome',
  'holy see (vatican city state)': 'Rome',
  liechtenstein: 'Zurich',
};

/** The name as given, then the common name, then (for "Country, qualifier") the part before the comma. */
function spellings(raw: string): string[] {
  const name = raw.trim();
  const out = [name];
  const common = COMMON_NAMES[name.toLowerCase()];
  if (common) out.push(common);
  const noBrackets = name.replace(/\s*\([^)]*\)/g, '').trim();
  if (noBrackets && noBrackets !== name) out.push(noBrackets);
  const comma = name.indexOf(',');
  if (comma > 0 && !common) out.push(name.slice(0, comma));
  // "Antigua and Barbuda", "Trinidad and Tobago": either part will do.
  for (const part of noBrackets.split(/\s+and\s+|\s*&\s*/i)) if (part.trim() && part.trim() !== noBrackets) out.push(part.trim());
  // "Czech Republic" -> "Czech", "Cayman Islands" -> "Cayman".
  const stripped = noBrackets.replace(/\b(republic|islands?|territory|territories|federation|kingdom|state of|the)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (stripped && stripped !== noBrackets) out.push(stripped);
  return out;
}

/** "PT2H30M" or "P1DT1H" as minutes. */
function isoMinutes(d: string | null | undefined): number | null {
  if (!d) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(d);
  if (!m) return null;
  return Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/**
 * Flight offers from the Duffel API in test mode: the token must be a duffel_test_ token (refused otherwise), and what comes
 * back is sandbox data, not a real fare. Booking creates a test order paid from the test balance: no real reservation, no real money.
 */
export class DuffelFlightProvider implements FlightProvider {
  private readonly duffel: Duffel;

  constructor(token: string) {
    if (!token.startsWith('duffel_test_')) throw new Error('DUFFEL_ACCESS_TOKEN must be a Duffel test token (duffel_test_...). Live tokens are refused.');
    this.duffel = new Duffel({ token });
  }

  /** The IATA code of the airport or city that best matches a place name, trying each spelling in turn, or null. */
  private async iataFor(names: string[]): Promise<string | null> {
    const tried = new Set<string>();
    for (const raw of names) {
      for (const name of spellings(raw)) {
        if (tried.has(name.toLowerCase())) continue;
        tried.add(name.toLowerCase());
        const res = await this.duffel.suggestions.list({ query: name });
        const places = res.data as Array<{ type?: string; iata_code?: string | null }>;
        const best = places.find((p) => p.type === 'city' && p.iata_code) ?? places.find((p) => p.iata_code);
        if (best?.iata_code) return best.iata_code;
      }
    }
    return null;
  }

  async searchFlights(q: FlightSearchQuery): Promise<ProviderResult<FlightOffer[]>> {
    const fetchedAt = new Date().toISOString();
    try {
      const [origin, destination] = await Promise.all([this.iataFor(q.originNames), this.iataFor(q.destinationNames)]);
      if (!origin || !destination) return { ok: false, reason: 'not_found', detail: 'No airport found for one of the places.' };
      const passengers = [
        ...Array.from({ length: q.adults }, () => ({ type: 'adult' as const })),
        ...q.childrenAges.map((age) => ({ age })),
      ];
      const res = await this.duffel.offerRequests.create({
        slices: [{ origin, destination, departure_date: q.date, departure_time: null, arrival_time: null }],
        passengers,
        cabin_class: 'economy',
        return_offers: true,
      });
      const offers = (res.data.offers ?? []) as Array<{
        id: string;
        total_amount: string;
        total_currency: string;
        owner?: { name?: string };
        slices: Array<{
          duration?: string | null;
          segments: Array<{ departing_at: string; arriving_at: string; origin?: { time_zone?: string | null }; destination?: { time_zone?: string | null } }>;
        }>;
      }>;
      const flights: FlightOffer[] = [];
      for (const o of offers) {
        const slice = o.slices[0];
        const first = slice?.segments[0];
        const last = slice?.segments[slice.segments.length - 1];
        if (!slice || !first || !last || !/^\d+(\.\d+)?$/.test(o.total_amount)) continue;
        flights.push({
          id: o.id,
          airline: o.owner?.name ?? null,
          departure: first.departing_at,
          arrival: last.arriving_at,
          departureTz: first.origin?.time_zone ?? null,
          arrivalTz: last.destination?.time_zone ?? null,
          durationMinutes: isoMinutes(slice.duration),
          stops: slice.segments.length - 1,
          amount: Number(o.total_amount).toFixed(2),
          currency: o.total_currency,
        });
      }
      flights.sort((a, b) => Number(a.amount) - Number(b.amount));
      return { ok: true, data: flights.slice(0, MAX_OFFERS), provenance: { source: 'duffel', source_url: 'https://duffel.com/docs', fetched_at: fetchedAt, certainty: 'confirmed', sandbox: true } };
    } catch (err) {
      const status = (err as { meta?: { status?: number } }).meta?.status;
      return { ok: false, reason: status === 429 ? 'rate_limited' : 'http_error', detail: err instanceof Error ? err.message : 'Duffel request failed.' };
    }
  }

  async getOffer(offerId: string): Promise<ProviderResult<FlightOfferDetail>> {
    try {
      const res = await this.duffel.offers.get(offerId);
      const o = res.data as unknown as {
        id: string;
        total_amount: string;
        total_currency: string;
        expires_at?: string | null;
        owner?: { name?: string };
        passengers: Array<{ id: string; type: 'adult' | 'child' | 'infant_without_seat'; age?: number | null }>;
        conditions?: { refund_before_departure?: Condition | null; change_before_departure?: Condition | null } | null;
        slices: Array<{ origin?: { name?: string }; destination?: { name?: string }; segments: Array<{ departing_at: string; arriving_at: string }> }>;
      };
      const slice = o.slices[0];
      const first = slice?.segments[0];
      const last = slice?.segments[slice.segments.length - 1];
      if (!slice || !first || !last) return { ok: false, reason: 'invalid_response' };
      return {
        ok: true,
        data: {
          id: o.id,
          airline: o.owner?.name ?? null,
          originName: slice.origin?.name ?? null,
          destinationName: slice.destination?.name ?? null,
          departure: first.departing_at,
          arrival: last.arriving_at,
          amount: Number(o.total_amount).toFixed(2),
          currency: o.total_currency,
          expiresAt: o.expires_at ?? null,
          passengers: o.passengers.map((p) => ({ id: p.id, type: p.type, age: typeof p.age === 'number' ? p.age : null })),
          terms: [term('Refund before departure', o.conditions?.refund_before_departure), term('Change before departure', o.conditions?.change_before_departure)],
        },
        provenance: { source: 'duffel', source_url: 'https://duffel.com/docs', fetched_at: new Date().toISOString(), certainty: 'confirmed', sandbox: true },
      };
    } catch (err) {
      const status = (err as { meta?: { status?: number } }).meta?.status;
      if (status === 404 || status === 422) return { ok: false, reason: 'not_found', detail: 'offer_expired' };
      return { ok: false, reason: status === 429 ? 'rate_limited' : 'http_error', detail: err instanceof Error ? err.message : 'Duffel request failed.' };
    }
  }

  async createOrder(input: { offerId: string; amount: string; currency: string; passengers: FlightPassenger[] }): Promise<ProviderResult<FlightOrder>> {
    try {
      const res = await this.duffel.orders.create({
        type: 'instant',
        selected_offers: [input.offerId],
        passengers: input.passengers.map((p) => ({
          id: p.id,
          title: p.title,
          given_name: p.givenName,
          family_name: p.familyName,
          born_on: p.bornOn,
          gender: p.gender,
          email: p.email,
          phone_number: p.phoneNumber,
        })),
        payments: [{ type: 'balance', amount: input.amount, currency: input.currency }],
      } as Parameters<Duffel['orders']['create']>[0]);
      const o = res.data as unknown as { id: string; booking_reference: string; total_amount: string; total_currency: string };
      return {
        ok: true,
        data: { orderId: o.id, bookingReference: o.booking_reference, amount: Number(o.total_amount).toFixed(2), currency: o.total_currency },
        provenance: { source: 'duffel', source_url: 'https://duffel.com/docs', fetched_at: new Date().toISOString(), certainty: 'confirmed', sandbox: true },
      };
    } catch (err) {
      const e = err as { meta?: { status?: number }; errors?: Array<{ code?: string; message?: string }> };
      const code = e.errors?.[0]?.code;
      if (code === 'offer_no_longer_available' || e.meta?.status === 404) return { ok: false, reason: 'not_found', detail: 'offer_no_longer_available' };
      if (code === 'price_changed') return { ok: false, reason: 'http_error', detail: 'price_changed' };
      return { ok: false, reason: e.meta?.status === 429 ? 'rate_limited' : 'http_error', detail: e.errors?.[0]?.message ?? (err instanceof Error ? err.message : 'Duffel request failed.') };
    }
  }
}

interface Condition {
  allowed: boolean;
  penalty_amount?: string | null;
  penalty_currency?: string | null;
}

/** One cancellation or change condition in plain words; what the airline does not state is said not to be stated. */
function term(label: string, c: Condition | null | undefined): string {
  if (!c) return `${label}: not stated by the airline.`;
  if (!c.allowed) return `${label}: not allowed.`;
  return c.penalty_amount ? `${label}: allowed for a fee of ${c.penalty_currency ?? ''} ${c.penalty_amount}.` : `${label}: allowed.`;
}
