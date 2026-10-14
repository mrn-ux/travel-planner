import { api } from './api';

export interface Country {
  code: string;
  name: string;
}

// The lists change rarely: each is fetched once per page load.
let countries: Promise<Country[]> | null = null;
const cities = new Map<string, Promise<string[]>>();

export function getCountries(): Promise<Country[]> {
  countries ??= api<{ countries: Country[] }>('/places/countries')
    .then((r) => r.countries)
    .catch((err) => {
      countries = null; // try again next time
      throw err;
    });
  return countries;
}

export function getCities(countryCode: string): Promise<string[]> {
  let p = cities.get(countryCode);
  if (!p) {
    p = api<{ cities: string[] }>(`/places/cities?country=${encodeURIComponent(countryCode)}`)
      .then((r) => r.cities)
      .catch((err) => {
        cities.delete(countryCode);
        throw err;
      });
    cities.set(countryCode, p);
  }
  return p;
}

export interface PlaceRow {
  id: string;
  name: string;
  kind: string;
  openingHours: string | null;
  entry: { kind: 'free' | 'paid' | 'unknown'; charge: string | null };
  distanceKm: string | null;
  lat: number;
  lon: number;
  website: string | null;
  osmUrl: string;
  wikidataUrl: string | null;
  photo: { url: string; creditUrl: string } | null;
  selected: boolean;
}

export interface PlacesResult {
  wholeCountry: boolean;
  needsCity: boolean;
  place: string | null;
  items: PlaceRow[];
  totalFound: number;
  source: string;
  sourceUrl: string;
  attribution: string;
  fetchedAt: string | null;
}

export const getPlaces = (tripId: string): Promise<PlacesResult> => api<PlacesResult>(`/trips/${encodeURIComponent(tripId)}/places`);

export interface SelectedPlace {
  id: string;
  name: string;
  kind: string;
  openingHours: string | null;
  entry: { kind: 'free' | 'paid' | 'unknown'; charge: string | null };
}

const placePath = (tripId: string, placeId: string): string => `/trips/${encodeURIComponent(tripId)}/places/${encodeURIComponent(placeId)}`;
export const getSelectedPlaces = (tripId: string) => api<{ items: SelectedPlace[] }>(`/trips/${encodeURIComponent(tripId)}/places/selected`).then((r) => r.items);
export const addPlace = (tripId: string, placeId: string) => api<{ items: SelectedPlace[] }>(placePath(tripId, placeId), { method: 'PUT' }).then((r) => r.items);
export const removePlace = (tripId: string, placeId: string) => api<{ items: SelectedPlace[] }>(placePath(tripId, placeId), { method: 'DELETE' }).then((r) => r.items);

export const getPlacePhoto = (p: { name: string; lat: number; lon: number }): Promise<{ url: string; creditUrl: string } | null> =>
  api<{ photo: { url: string; creditUrl: string } | null }>(`/places/photo?name=${encodeURIComponent(p.name)}&lat=${p.lat}&lon=${p.lon}`).then((r) => r.photo);

export const addPlaces = (tripId: string, ids: string[]) =>
  api<{ items: SelectedPlace[] }>(`/trips/${encodeURIComponent(tripId)}/places`, { method: 'POST', body: JSON.stringify({ ids }) }).then((r) => r.items);

// The country to currency mapping is fetched once (250 countries) and used every time a country is chosen.
let currencyMapPromise: Promise<Record<string, string>> | null = null;
export function getCurrencyMap(): Promise<Record<string, string>> {
  currencyMapPromise ??= api<{ currencies: Record<string, string> }>('/places/currencies')
    .then((r) => r.currencies)
    .catch(() => {
      currencyMapPromise = null; // try again next time
      return {};
    });
  return currencyMapPromise;
}

/** The currency a country uses (null when unknown). */
export async function getCountryCurrency(countryCode: string): Promise<string | null> {
  return (await getCurrencyMap())[countryCode.toUpperCase()] ?? null;
}
