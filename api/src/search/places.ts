import { query } from '../db.js';
import { AppError } from '../errors.js';
import { rankAttractions } from '../itinerary/generate.js';
import { refForDestination } from '../knowledge/ensure.js';
import { fetchJson } from '../http.js';
import { hotelProvider } from '../providers/index.js';
import { fetchCountryPlaces } from '../providers/knowledge/WikidataPlaces.js';
import { fetchDetailsNear, fetchPlaces, OVERPASS_ATTRIBUTION, type Attraction } from '../providers/knowledge/OverpassSource.js';
import type { Trip } from '../trips/service.js';
import { haversineKm } from '../transport/fareEstimate.js';

export interface PlaceRow {
  id: string;
  name: string;
  /** Traveler-facing kind, for example "Museum". */
  kind: string;
  openingHours: string | null;
  /** Entry: free, paid (with the charge when stated) or not stated. */
  entry: { kind: 'free' | 'paid' | 'unknown'; charge: string | null };
  /** From the city centre; null when the whole country is listed. */
  distanceKm: string | null;
  lat: number;
  lon: number;
  website: string | null;
  osmUrl: string;
  wikidataUrl: string | null;
  /** A photo from Wikimedia Commons (thumbnail), with the page that credits its author and licence. Null when there is none. */
  photo: { url: string; creditUrl: string } | null;
  /** Chosen for the trip. */
  selected: boolean;
}

export interface PlacesResult {
  /** True when the whole country is listed (no city was chosen). */
  wholeCountry: boolean;
  /** Always false now: kept so older screens still read the same shape. */
  needsCity: boolean;
  place: string | null;
  items: PlaceRow[];
  /** How many places were found in all; only the best few are listed. */
  totalFound: number;
  source: string;
  sourceUrl: string;
  attribution: string;
  fetchedAt: string | null;
}

const KIND_LABEL: Record<string, string> = {
  attraction: 'Attraction',
  museum: 'Museum',
  gallery: 'Gallery',
  castle: 'Castle',
  monument: 'Monument',
  palace: 'Palace',
  fort: 'Fort',
  ruins: 'Ruins',
  archaeological_site: 'Archaeological site',
  cathedral: 'Cathedral',
  viewpoint: 'Viewpoint',
  zoo: 'Zoo',
  theme_park: 'Theme park',
  aquarium: 'Aquarium',
  memorial: 'Memorial',
  temple: 'Temple',
  manor: 'Manor',
  waterfall: 'Waterfall',
  peak: 'Peak',
  beach: 'Beach',
  hot_spring: 'Hot spring',
  cave_entrance: 'Cave',
  bay: 'Bay',
  park: 'Park',
  garden: 'Garden',
  nature_reserve: 'Nature reserve',
  place_of_worship: 'Place of worship',
};

const MAX_PLACES = 10;
/** Ranking by interest embeds each place's text; beyond this many, the best-known are ranked and the rest follow by name. */
const RANK_LIMIT = 60;

/** A Commons file name as a 480 px thumbnail address and the file's own page (author and licence are shown there). */
function photoOf(file: string | null): { url: string; creditUrl: string } | null {
  if (!file) return null;
  const name = encodeURIComponent(file.replace(/ /g, '_'));
  return { url: `https://commons.wikimedia.org/wiki/Special:FilePath/${name}?width=480`, creditUrl: `https://commons.wikimedia.org/wiki/File:${name}` };
}

const PHOTO_LOOKUPS = 24;
const STOP = new Set(['the', 'of', 'de', 'la', 'le', 'and', 'in', 'at', 'a']);
const wordsOf = (t: string): Set<string> => new Set(t.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
/**
 * Add opening hours, entry fee and website from the map to places that lack them (matched by name within 150 m). Nothing is guessed:
 * a place the map does not describe stays "not stated".
 */
async function withMapDetails(list: Attraction[]): Promise<Attraction[]> {
  const lacking = list.filter((a) => a.openingHours === null || a.fee === null);
  if (lacking.length === 0) return list;
  const near = await fetchDetailsNear(lacking).catch(() => []);
  if (near.length === 0) return list;
  return list.map((a) => {
    if (a.openingHours !== null && a.fee !== null) return a;
    const hit = near.find((n) => Math.abs(n.lat - a.lat) < 0.0025 && Math.abs(n.lon - a.lon) < 0.0035 && similar(a.name, n.name, 0.5));
    return hit ? { ...a, openingHours: a.openingHours ?? hit.openingHours, fee: a.fee ?? hit.fee, charge: a.charge ?? hit.charge, website: a.website ?? hit.website } : a;
  });
}

function similar(a: string, b: string, min: number, wholeName = false): boolean {
  const x = wordsOf(a);
  const y = wordsOf(b);
  const shared = [...x].filter((w) => y.has(w)).length;
  // wholeName: the two names must be nearly the same ("Victoria Museum" is not "Victoria and Albert Museum"); otherwise the shorter name only has to be found in the longer text.
  return x.size > 0 && y.size > 0 && shared / (wholeName ? x.size + y.size - shared : Math.min(x.size, y.size)) >= min;
}

/** A photo for a place the map data has none for: the lead image of the Wikipedia article of that name, else a Commons photo taken within 150 m whose title names the place. */
export async function fallbackPhoto(name: string, lat: number, lon: number): Promise<{ url: string; creditUrl: string } | null> {
  const opts = { provider: 'wikimedia', ttlMs: 30 * 24 * 3600 * 1000, timeoutMs: 8000, minSpacingMs: 150 } as const;
  const wp = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: name, gsrlimit: '3', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '480', format: 'json' });
  const byName = await fetchJson<{ query?: { pages?: Record<string, { title: string; thumbnail?: { source: string } }> } }>(`https://en.wikipedia.org/w/api.php?${wp.toString()}`, opts);
  if (byName.ok) {
    const hit = Object.values(byName.body.query?.pages ?? {}).find((p) => p.thumbnail && similar(name, p.title, 0.75, true));
    if (hit?.thumbnail) return { url: hit.thumbnail.source, creditUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}` };
  }
  const cm = new URLSearchParams({ action: 'query', list: 'geosearch', gscoord: `${lat}|${lon}`, gsradius: '150', gsnamespace: '6', gslimit: '15', format: 'json' });
  const byPlace = await fetchJson<{ query?: { geosearch?: Array<{ title: string }> } }>(`https://commons.wikimedia.org/w/api.php?${cm.toString()}`, opts);
  if (byPlace.ok) {
    const file = (byPlace.body.query?.geosearch ?? []).find((g) => /\.(jpe?g|png)$/i.test(g.title) && similar(name, g.title.replace(/^File:/, ''), 0.5));
    if (file) return photoOf(file.title.replace(/^File:/, ''));
  }
  return null;
}

/** The main image (Wikidata property P18) of each item, as a Commons file name. A failed lookup just means no photos. */
async function wikidataImages(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids)].slice(0, 50);
  if (unique.length === 0) return out;
  const params = new URLSearchParams({ action: 'wbgetentities', ids: unique.join('|'), props: 'claims', format: 'json' });
  const res = await fetchJson<{ entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> }> }>(`https://www.wikidata.org/w/api.php?${params.toString()}`, {
    provider: 'wikidata',
    ttlMs: 30 * 24 * 3600 * 1000,
    timeoutMs: 15000,
    minSpacingMs: 400,
  });
  if (!res.ok) return out;
  for (const [id, e] of Object.entries(res.body.entities ?? {})) {
    const v = e.claims?.['P18']?.[0]?.mainsnak?.datavalue?.value;
    if (typeof v === 'string') out.set(id, v);
  }
  return out;
}

/** Places to visit around the trip's chosen city, from OpenStreetMap. Nothing is invented: a missing hour or charge says "not stated". */
/** The places around the chosen city, or across the whole chosen country, from OpenStreetMap. */
async function findPlaces(trip: Trip): Promise<{ attractions: Attraction[]; centre: { lat: number; lon: number } | null; fetchedAt: Date }> {
  const failed = (reason: string): AppError => new AppError(reason === 'timeout' ? 504 : 502, 'Places to visit are unavailable right now.');
  if (trip.destinationCity) {
    const dest = await refForDestination(trip.destination ?? '');
    if (!dest || dest.lat === null || dest.lon === null) throw new AppError(404, `We could not find "${trip.destination}".`);
    const found = await fetchPlaces({ lat: dest.lat, lon: dest.lon });
    if (!found.ok) throw failed(found.reason);
    return { attractions: found.attractions, centre: { lat: dest.lat, lon: dest.lon }, fetchedAt: found.fetchedAt };
  }
  const countries = await hotelProvider().listCountries();
  const code = countries.ok ? countries.data.find((c) => c.name.toLowerCase() === (trip.destinationCountry ?? trip.destination ?? '').toLowerCase())?.code : undefined;
  const ref = code ? null : await refForDestination(trip.destination ?? '');
  const countryCode = code ?? ref?.countryCode;
  if (!countryCode) throw new AppError(404, `We could not find "${trip.destination}".`);
  const found = await fetchCountryPlaces(countryCode);
  if (!found.ok) throw new AppError(found.reason === 'timeout' ? 504 : 503, 'The list for a whole country is not available right now (the public data service is busy). Choose a city on the first page for a quick list.');
  return { attractions: found.attractions, centre: null, fetchedAt: found.fetchedAt };
}

/** Places to visit in the trip's chosen city, or across the whole country when no city is chosen. Nothing is invented: a missing hour or charge says "not stated". */
export async function placesForTrip(trip: Trip): Promise<PlacesResult> {
  const base = { source: 'OpenStreetMap (Overpass API)', sourceUrl: 'https://www.openstreetmap.org/', attribution: OVERPASS_ATTRIBUTION };
  if (!trip.destination) throw new AppError(400, 'Choose a destination first.', { fields: { destination: 'Required.' } });
  const { attractions, centre, fetchedAt } = await findPlaces(trip);
  const found = { ok: true as const, attractions, fetchedAt };
  const dest = centre;
  const chosen = new Set((await query<{ place_id: string }>('SELECT place_id FROM trip_places WHERE trip_id = $1', [trip.id])).rows.map((r) => r.place_id));
  // Best-known first (a Wikidata entry, opening hours stated); the first RANK_LIMIT are also ordered by the traveler's interests.
  const known = (a: Attraction): number => (a.wikidata ? 2 : 0) + (a.openingHours ? 1 : 0);
  const byKnown = [...found.attractions].sort((x, y) => known(y) - known(x) || x.name.localeCompare(y.name));
  const ranked = await withMapDetails([...(await rankAttractions(byKnown.slice(0, RANK_LIMIT), trip.interests)), ...byKnown.slice(RANK_LIMIT)].slice(0, MAX_PLACES));
  const images = await wikidataImages(ranked.flatMap((a) => (a.wikidata && !a.commonsFile ? [a.wikidata] : [])));
  const items = ranked.map((a): PlaceRow => ({
    id: a.id,
    name: a.name,
    kind: KIND_LABEL[a.kind] ?? 'Attraction',
    openingHours: a.openingHours,
    entry: a.fee === 'no' ? { kind: 'free', charge: null } : a.fee === 'yes' || a.charge ? { kind: 'paid', charge: a.charge } : { kind: 'unknown', charge: null },
    distanceKm: dest ? haversineKm(dest, { lat: a.lat, lon: a.lon }).toFixed(1) : null,
    lat: a.lat,
    lon: a.lon,
    website: a.website,
    osmUrl: /^Q\d+$/.test(a.id) ? `https://www.wikidata.org/wiki/${a.id}` : `https://www.openstreetmap.org/${a.id}`,
    wikidataUrl: a.wikidata ? `https://www.wikidata.org/wiki/${a.wikidata}` : null,
    photo: photoOf(a.commonsFile ?? images.get(a.wikidata ?? '') ?? null),
    selected: chosen.has(a.id),
  }));
  return { ...base, wholeCountry: centre === null, needsCity: false, place: trip.destination, items, totalFound: attractions.length, fetchedAt: found.fetchedAt.toISOString() };
}

export interface SelectedPlace {
  id: string;
  name: string;
  kind: string;
  openingHours: string | null;
  entry: { kind: 'free' | 'paid' | 'unknown'; charge: string | null };
}

export async function selectedPlaces(tripId: string): Promise<SelectedPlace[]> {
  const res = await query<{ place_id: string; name: string; kind: string; opening_hours: string | null; entry_kind: 'free' | 'paid' | 'unknown'; charge: string | null }>(
    'SELECT place_id, name, kind, opening_hours, entry_kind, charge FROM trip_places WHERE trip_id = $1 ORDER BY selected_at',
    [tripId],
  );
  return res.rows.map((r) => ({ id: r.place_id, name: r.name, kind: r.kind, openingHours: r.opening_hours, entry: { kind: r.entry_kind, charge: r.charge } }));
}

/** Add a place the traveler saw in the list to the trip. The details are taken from the live list, never from the browser. */
export async function selectPlace(trip: Trip, placeId: string): Promise<void> {
  const found = (await fetchAttractionsFor(trip)).find((x) => x.id === placeId);
  if (!found) throw new AppError(404, 'That place is not in the list any more. Reload the list and pick it again.');
  const [a] = await withMapDetails([found]);
  if (!a) throw new AppError(404, 'That place is not in the list any more. Reload the list and pick it again.');
  const entry = a.fee === 'no' ? 'free' : a.fee === 'yes' || a.charge ? 'paid' : 'unknown';
  await query(
    `INSERT INTO trip_places (trip_id, place_id, name, kind, lat, lon, opening_hours, entry_kind, charge)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (trip_id, place_id) DO NOTHING`,
    [trip.id, placeId, a.name, KIND_LABEL[a.kind] ?? 'Attraction', a.lat, a.lon, a.openingHours, entry, a.charge],
  );
}

/** Add several places at once (one lookup of the list for all of them). Places no longer in the list are skipped; returns how many were added. */
export async function selectPlaces(trip: Trip, placeIds: string[]): Promise<number> {
  const wanted = new Set(placeIds);
  const found = await withMapDetails((await fetchAttractionsFor(trip)).filter((x) => wanted.has(x.id)));
  for (const a of found) {
    const entry = a.fee === 'no' ? 'free' : a.fee === 'yes' || a.charge ? 'paid' : 'unknown';
    await query(
      `INSERT INTO trip_places (trip_id, place_id, name, kind, lat, lon, opening_hours, entry_kind, charge)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (trip_id, place_id) DO NOTHING`,
      [trip.id, a.id, a.name, KIND_LABEL[a.kind] ?? 'Attraction', a.lat, a.lon, a.openingHours, entry, a.charge],
    );
  }
  return found.length;
}

export async function unselectPlace(tripId: string, placeId: string): Promise<void> {
  await query('DELETE FROM trip_places WHERE trip_id = $1 AND place_id = $2', [tripId, placeId]);
}

async function fetchAttractionsFor(trip: Trip): Promise<Attraction[]> {
  return (await findPlaces(trip)).attractions;
}
