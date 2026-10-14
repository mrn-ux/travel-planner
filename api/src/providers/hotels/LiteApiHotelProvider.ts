import { occupanciesFor } from './occupancies.js';
import { getConfig } from '../../config.js';
import { fetchJson, type FetchResult } from '../../http.js';
import { divideAmount, nightsBetween } from '../decimal.js';
import type { Provenance, ProviderResult } from '../types.js';
import type { BookInput, BookResult, HotelDetails, HotelProvider, HotelReview, HotelSummary, Prebook, Room, StayQuery } from './HotelProvider.js';

// LiteAPI sandbox. A sandbox key returns sandbox data, and every result here says so (sandbox: true).
const API = 'https://api.liteapi.travel/v3.0';
const BOOK_API = 'https://book.liteapi.travel/v3.0';
const HOUR = 3_600_000;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** A decimal string from a number or string, written without exponent notation (money never goes through arithmetic as a float). */
const dec = (v: unknown): string | null => {
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return v.toFixed(2);
  return null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 7 Mar 2027 from an ISO timestamp. */
function friendlyDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}` : iso;
}

function fail<T>(res: Extract<FetchResult<unknown>, { ok: false }>): ProviderResult<T> {
  return { ok: false, reason: res.reason === 'network' ? 'http_error' : res.reason, detail: res.detail };
}

/** LiteAPI property type ids (its /data/hotelTypes list) for each kind of stay Faro offers. */
const ACCOMMODATION_TYPE_IDS: Record<string, number[]> = {
  Hotel: [204, 206, 231, 205],
  Villa: [213, 250],
  Cottage: [230, 257, 232],
  'Guest house': [216, 208, 218, 222, 247],
  Guesthouse: [216, 208, 218, 222, 247], // the spelling older trips were saved with
  Apartment: [201, 219, 229, 207, 220],
};

export class LiteApiHotelProvider implements HotelProvider {
  private headers(): Record<string, string> {
    return { 'X-API-Key': getConfig().liteApiKey, Accept: 'application/json' };
  }

  private prov(url: string, fetchedAt: Date): Provenance {
    return { source: 'liteapi', source_url: url.split('?')[0] ?? url, fetched_at: fetchedAt.toISOString(), certainty: 'confirmed', sandbox: true };
  }

  async searchHotels(q: { city: string | null; near?: { lat: number; lon: number; radiusM: number }; countryCode: string; accommodation: string | null; limit: number; offset: number }): Promise<ProviderResult<HotelSummary[]>> {
    const params = new URLSearchParams({ countryCode: q.countryCode, limit: String(q.limit), offset: String(q.offset) });
    const typeIds = q.accommodation ? ACCOMMODATION_TYPE_IDS[q.accommodation] : undefined;
    if (typeIds) params.set('hotelTypeIds', typeIds.join(','));
    if (q.near) {
      params.set('latitude', String(q.near.lat));
      params.set('longitude', String(q.near.lon));
      params.set('radius', String(q.near.radiusM));
    } else if (q.city) params.set('cityName', q.city);
    const url = `${API}/data/hotels?${params.toString()}`;
    const res = await fetchJson<unknown>(url, { provider: 'liteapi', headers: this.headers(), ttlMs: 10 * 60_000, timeoutMs: 15000 });
    if (!res.ok) return fail(res);
    const data = arr(obj(res.body)['data']);
    const hotels: HotelSummary[] = data.flatMap((raw) => {
      const h = obj(raw);
      const id = str(h['id']);
      const name = str(h['name']);
      if (!id || !name) return [];
      const rating = num(h['rating']);
      return [
        {
          hotelId: id,
          name,
          city: str(h['city']),
          address: str(h['address']),
          latitude: num(h['latitude']),
          longitude: num(h['longitude']),
          thumbnail: str(h['thumbnail']) ?? str(h['main_photo']),
          stars: num(h['stars']),
          rating: rating === null ? null : rating.toFixed(1),
          reviewCount: num(h['reviewCount']),
        },
      ];
    });
    return { ok: true, data: hotels, provenance: this.prov(url, res.fetchedAt) };
  }

  async getMinRates(hotelIds: string[], stay: StayQuery): Promise<ProviderResult<Record<string, { total: string; currency: string }>>> {
    if (hotelIds.length === 0) return { ok: true, data: {}, provenance: this.prov(`${API}/hotels/min-rates`, new Date()) };
    const url = `${API}/hotels/min-rates`;
    const res = await fetchJson<unknown>(url, {
      provider: 'liteapi',
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotelIds, checkin: stay.checkin, checkout: stay.checkout, currency: stay.currency, guestNationality: stay.guestNationality, occupancies: occupanciesFor(stay) }),
      ttlMs: 0, // live prices are never cached
      timeoutMs: 20000,
    });
    if (!res.ok) return fail(res);
    const out: Record<string, { total: string; currency: string }> = {};
    for (const raw of arr(obj(res.body)['data'])) {
      const r = obj(raw);
      const id = str(r['hotelId']);
      const total = dec(r['price']);
      if (id && total) out[id] = { total, currency: stay.currency };
    }
    return { ok: true, data: out, provenance: this.prov(url, res.fetchedAt) };
  }

  async listCountries(): Promise<ProviderResult<Array<{ code: string; name: string }>>> {
    const url = `${API}/data/countries`;
    const res = await fetchJson<unknown>(url, { provider: 'liteapi', headers: this.headers(), ttlMs: 24 * HOUR, timeoutMs: 15000 });
    if (!res.ok) return fail(res);
    const countries = arr(obj(res.body)['data']).flatMap((raw) => {
      const c = obj(raw);
      const code = str(c['code']);
      const name = str(c['name']);
      return code && name ? [{ code, name }] : [];
    });
    countries.sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, data: countries, provenance: this.prov(url, res.fetchedAt) };
  }

  async listCities(countryCode: string): Promise<ProviderResult<string[]>> {
    const url = `${API}/data/cities?countryCode=${encodeURIComponent(countryCode)}`;
    const res = await fetchJson<unknown>(url, { provider: 'liteapi', headers: this.headers(), ttlMs: 24 * HOUR, timeoutMs: 20000 });
    if (!res.ok) return fail(res);
    const cities = [...new Set(arr(obj(res.body)['data']).map((raw) => str(obj(raw)['city'])).filter((c): c is string => c !== null))];
    cities.sort((a, b) => a.localeCompare(b));
    return { ok: true, data: cities, provenance: this.prov(url, res.fetchedAt) };
  }

  async getHotel(hotelId: string): Promise<ProviderResult<HotelDetails>> {
    const url = `${API}/data/hotel?hotelId=${encodeURIComponent(hotelId)}`;
    const res = await fetchJson<unknown>(url, { provider: 'liteapi', headers: this.headers(), ttlMs: 24 * HOUR, timeoutMs: 15000 });
    if (!res.ok) return fail(res);
    const d = obj(obj(res.body)['data']);
    const name = str(d['name']);
    if (!name) return { ok: false, reason: 'not_found' };
    const location = obj(d['location']);
    const images = arr(d['hotelImages']).flatMap((i) => {
      const img = obj(i);
      const u = str(img['urlHd']) ?? str(img['url']);
      return u ? [{ url: u, caption: str(img['caption']) }] : [];
    });
    const facilities = arr(d['facilities']).map((f) => str(obj(f)['name'])).filter((x): x is string => x !== null);
    const amenities = facilities.length > 0 ? facilities : arr(d['hotelFacilities']).filter((x): x is string => typeof x === 'string');
    const rating = num(d['rating']);
    return {
      ok: true,
      provenance: this.prov(url, res.fetchedAt),
      data: {
        hotelId,
        name,
        description: str(d['hotelDescription']),
        images,
        amenities,
        address: str(d['address']),
        city: str(d['city']),
        latitude: num(location['latitude']),
        longitude: num(location['longitude']),
        stars: num(d['starRating']) ?? num(d['stars']),
        rating: rating === null ? null : rating.toFixed(1),
        roomContent: arr(d['rooms']).flatMap((raw) => {
          const r = obj(raw);
          const roomName = str(r['roomName']);
          if (!roomName) return [];
          const beds = arr(r['bedTypes'])
            .map(obj)
            .map((b) => {
              const t = str(b['bedType']);
              const q = num(b['quantity']) ?? 1;
              return t ? `${q} x ${t}` : null;
            })
            .filter((x): x is string => x !== null);
          return [{ name: roomName, maxOccupancy: num(r['maxOccupancy']), beds: beds.length > 0 ? beds.join(', ') : null }];
        }),
      },
    };
  }

  async getReviews(hotelId: string, limit: number): Promise<ProviderResult<HotelReview[]>> {
    const url = `${API}/data/reviews?hotelId=${encodeURIComponent(hotelId)}&limit=${limit}`;
    const res = await fetchJson<unknown>(url, { provider: 'liteapi', headers: this.headers(), ttlMs: 24 * HOUR, timeoutMs: 15000 });
    if (!res.ok) return fail(res);
    const reviews: HotelReview[] = arr(obj(res.body)['data']).map((raw, i) => {
      const r = obj(raw);
      const score = num(r['averageScore']);
      return { id: str(r['reviewId']) ?? String(i), score: score === null ? null : score.toFixed(1), author: str(r['name']), country: str(r['country']), headline: str(r['headline']), pros: str(r['pros']), cons: str(r['cons']), date: str(r['date']) };
    });
    return { ok: true, data: reviews, provenance: this.prov(url, res.fetchedAt) };
  }

  async getRates(hotelId: string, stay: StayQuery): Promise<ProviderResult<Room[]>> {
    const url = `${API}/hotels/rates`;
    const res = await fetchJson<unknown>(url, {
      provider: 'liteapi',
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotelIds: [hotelId], checkin: stay.checkin, checkout: stay.checkout, currency: stay.currency, guestNationality: stay.guestNationality, occupancies: occupanciesFor(stay) }),
      ttlMs: 0, // rates and availability are never cached
      timeoutMs: 25000,
    });
    if (!res.ok) return fail(res);

    const nights = nightsBetween(stay.checkin, stay.checkout);
    const rooms: Room[] = [];
    for (const hotel of arr(obj(res.body)['data'])) {
      for (const rt of arr(obj(hotel)['roomTypes'])) {
        const roomType = obj(rt);
        const offerId = str(roomType['offerId']);
        const roomRates = arr(roomType['rates']).map(obj);
        // Several rooms: each rate is one room, and only the offer's own total covers all of them, so the offer is one line.
        if (roomRates.length > 1) {
          const offer = obj(roomType['offerRetailRate']);
          const total = dec(offer['amount']);
          const nightly = total && nights > 0 ? divideAmount(total, nights) : null;
          if (!total || !nightly) continue;
          const refundable = roomRates.every((r) => str(obj(r['cancellationPolicies'])['refundableTag']) === 'RFN');
          const times = roomRates.map((r) => str(arr(obj(r['cancellationPolicies'])['cancelPolicyInfos']).map(obj)[0]?.['cancelTime'])).filter((t): t is string => t !== null).sort();
          const freeUntil = refundable ? (times[0] ?? null) : null;
          rooms.push({
            roomId: `${str(roomType['roomTypeId']) ?? 'room'}-${rooms.length}`,
            name: roomRates.map((r) => str(r['name']) ?? 'Room').join(' + '),
            offerId: offerId ?? '',
            currency: str(offer['currency']) ?? stay.currency,
            nightly,
            total,
            taxesAndFees: null,
            nights,
            refundable,
            freeUntil,
            cancellationText: refundable ? (freeUntil ? `Free cancellation until ${friendlyDate(freeUntil)}.` : 'Free cancellation.') : 'Non-refundable.',
            adults: roomRates.reduce((n, r) => n + (num(r['adultCount']) ?? 0), 0),
            children: roomRates.reduce((n, r) => n + (num(r['childCount']) ?? 0), 0),
            board: str(roomRates[0]?.['boardName']),
            roomNames: roomRates.map((r) => ({ name: str(r['name']) ?? 'Room', maxOccupancy: num(r['maxOccupancy']) })),
          });
          continue;
        }
        for (const rawRate of arr(roomType['rates'])) {
          const rate = obj(rawRate);
          const retail = obj(rate['retailRate']);
          const total = dec(obj(arr(retail['total'])[0])['amount']);
          if (!total || nights < 1) continue;
          const nightly = divideAmount(total, nights);
          if (!nightly) continue;
          // Taxes and fees not already included in the total are listed separately.
          const extras = arr(retail['taxesAndFees']).map(obj).filter((t) => t['included'] === false);
          const taxes = extras.length > 0 ? dec(extras[0]!['amount']) : null;
          const policies = obj(rate['cancellationPolicies']);
          const refundable = str(policies['refundableTag']) === 'RFN';
          const infos = arr(policies['cancelPolicyInfos']).map(obj);
          const freeUntil = refundable ? str(infos[0]?.['cancelTime']) : null;
          rooms.push({
            roomId: str(rate['rateId']) ?? `${str(roomType['roomTypeId']) ?? 'room'}-${rooms.length}`,
            name: str(rate['name']) ?? 'Room',
            offerId: offerId ?? '',
            currency: str(obj(arr(retail['total'])[0])['currency']) ?? stay.currency,
            nightly,
            total,
            taxesAndFees: taxes,
            nights,
            refundable,
            freeUntil,
            cancellationText: refundable ? (freeUntil ? `Free cancellation until ${friendlyDate(freeUntil)}.` : 'Free cancellation.') : 'Non-refundable.',
            adults: num(rate['adultCount']) ?? stay.adults,
            children: num(rate['childCount']) ?? stay.childrenAges.length,
            board: str(rate['boardName']),
            roomNames: [{ name: str(rate['name']) ?? 'Room', maxOccupancy: num(rate['maxOccupancy']) }],
          });
        }
      }
    }
    return { ok: true, data: rooms, provenance: this.prov(url, res.fetchedAt) };
  }

  // ---- Booking (never cached; the error body matters, so these calls read it directly) ---------------------------------------

  private async call(method: 'GET' | 'POST', url: string, body: unknown, timeoutMs: number): Promise<{ status: number; json: Obj } | 'timeout' | 'network'> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { ...this.headers(), 'User-Agent': getConfig().dataUserAgent, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      let json: Obj = {};
      try {
        json = obj(await res.json());
      } catch {
        /* an empty or non-JSON error body */
      }
      return { status: res.status, json };
    } catch (err) {
      return err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network';
    } finally {
      clearTimeout(timer);
    }
  }

  /** The provider's error code (for example 4012 room gone, 4005 duplicate reference), as text. */
  private errorCode(json: Obj): string {
    const e = obj(json['error']);
    return String(e['code'] ?? json['code'] ?? '');
  }

  private mapFailure<T>(r: { status: number; json: Obj } | 'timeout' | 'network'): ProviderResult<T> {
    if (r === 'timeout') return { ok: false, reason: 'timeout' };
    if (r === 'network') return { ok: false, reason: 'http_error', detail: 'network' };
    const code = this.errorCode(r.json);
    if (r.status === 410 || ['4012', '4040', '4041', '4002'].includes(code)) return { ok: false, reason: 'not_found', detail: 'room_unavailable' };
    if (code === '4005') return { ok: false, reason: 'http_error', detail: 'duplicate' };
    if (r.status === 429) return { ok: false, reason: 'rate_limited' };
    return { ok: false, reason: r.status === 504 || code === '4016' ? 'timeout' : 'http_error', detail: code || String(r.status) };
  }

  async prebook(offerId: string): Promise<ProviderResult<Prebook>> {
    const url = `${BOOK_API}/rates/prebook`;
    const r = await this.call('POST', url, { offerId, usePaymentSdk: false }, 25000);
    if (r === 'timeout' || r === 'network' || r.status >= 400) return this.mapFailure(r);
    const d = obj(r.json['data']);
    const price = dec(d['price']);
    const prebookId = str(d['prebookId']);
    if (!price || !prebookId) return { ok: false, reason: 'invalid_response' };
    const policies = obj(obj(arr(obj(arr(d['roomTypes'])[0])['rates'])[0])['cancellationPolicies']);
    const refundable = str(policies['refundableTag']) === 'RFN';
    const freeUntil = refundable ? str(obj(arr(policies['cancelPolicyInfos'])[0])['cancelTime']) : null;
    return {
      ok: true,
      provenance: this.prov(url, new Date()),
      data: {
        prebookId,
        price,
        currency: str(d['currency']) ?? 'USD',
        priceDifferencePercent: num(d['priceDifferencePercent']) ?? 0,
        cancellationChanged: d['cancellationChanged'] === true,
        boardChanged: d['boardChanged'] === true,
        refundable,
        freeUntil,
        cancellationText: refundable ? (freeUntil ? `Free cancellation until ${friendlyDate(freeUntil)}.` : 'Free cancellation.') : 'Non-refundable.',
      },
    };
  }

  private toBookResult(d: Obj): BookResult | null {
    const bookingId = str(d['bookingId']);
    if (!bookingId) return null;
    return { bookingId, status: str(d['status']) ?? 'UNKNOWN', hotelConfirmationCode: str(d['hotelConfirmationCode']), clientReference: str(d['clientReference']) };
  }

  async book(input: BookInput, timeoutMs: number): Promise<ProviderResult<BookResult>> {
    const url = `${BOOK_API}/rates/book`;
    const body = {
      prebookId: input.prebookId,
      holder: input.holder,
      guests: Array.from({ length: Math.max(1, input.rooms ?? 1) }, (_, i) => ({ occupancyNumber: i + 1, firstName: input.holder.firstName, lastName: input.holder.lastName, email: input.holder.email })),
      payment: { method: 'ACC_CREDIT_CARD' },
      clientReference: input.clientReference,
    };
    const r = await this.call('POST', url, body, timeoutMs);
    if (r === 'timeout' || r === 'network' || r.status >= 400) return this.mapFailure(r);
    const result = this.toBookResult(obj(r.json['data']));
    return result ? { ok: true, data: result, provenance: this.prov(url, new Date()) } : { ok: false, reason: 'invalid_response' };
  }

  async getBooking(clientReference: string): Promise<ProviderResult<BookResult | null>> {
    const url = `${API}/bookings?clientReference=${encodeURIComponent(clientReference)}`;
    const r = await this.call('GET', url, null, 15000);
    if (r === 'timeout' || r === 'network') return this.mapFailure(r);
    if (r.status === 404) return { ok: true, data: null, provenance: this.prov(url, new Date()) };
    if (r.status >= 400) return this.mapFailure(r);
    const first = obj(arr(r.json['data'])[0]);
    return { ok: true, data: this.toBookResult(first), provenance: this.prov(url, new Date()) };
  }
}
