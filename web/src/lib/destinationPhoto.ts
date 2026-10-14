import { api } from './api';

export interface DestinationPhoto {
  url: string;
  creditUrl: string;
  title: string;
}

// Destination photos are looked up once per name and kept for the visit.
const known = new Map<string, Promise<DestinationPhoto | null>>();

/** A photo of a place from Wikipedia (free licence; creditUrl names the author), or null. */
export function photoFor(name: string): Promise<DestinationPhoto | null> {
  let p = known.get(name);
  if (!p) {
    p = api<{ photo: DestinationPhoto | null }>(`/places/destination-photo?name=${encodeURIComponent(name)}`, {}, { redirectOn401: false })
      .then((r) => r.photo)
      .catch(() => null);
    known.set(name, p);
  }
  return p;
}

/** Dream destinations shown as backgrounds when the traveler has not chosen a place yet. */
export const DREAM_DESTINATIONS = ['Kyoto', 'Machu Picchu', 'Venice', 'Cappadocia', 'Banff National Park', 'Amalfi Coast', 'Petra', 'Positano', 'Ha Long Bay', 'Cinque Terre', 'Dubrovnik', 'Bora Bora'];

const LAST = 'faro.backdrop';
const EVENT = 'faro:backdrop';

/** The places whose photo is shown behind the whole app: the chosen city and country. Pages call this when the destination changes. */
export function setBackdropPlaces(names: string[]): void {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return;
  try {
    localStorage.setItem(LAST, JSON.stringify(clean));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const BACKDROP_EVENT = EVENT;

/** The places to show behind the app: the last chosen destination (city, then country), else one random dream destination. */
export function backdropNames(): string[] {
  if (contextNames) return contextNames; // a page about lodging or travel shows its own pictures
  try {
    const raw = localStorage.getItem(LAST);
    if (raw) {
      const list = JSON.parse(raw) as unknown;
      if (Array.isArray(list) && list.every((x) => typeof x === 'string') && list.length > 0) return list as string[];
    }
  } catch {
    /* ignore */
  }
  return [DREAM_DESTINATIONS[Math.floor(Math.random() * DREAM_DESTINATIONS.length)] as string];
}

// Pictures that match what a page is about: places to stay on the hotel pages, ways to travel on the transport pages.
export const LODGING_IMAGES = ['Hotel', 'Villa', 'Cottage', 'Resort', 'Chalet', 'Guest house'];
export const VEHICLE_IMAGES = ['Airliner', 'High-speed rail', 'Bus', 'Ferry', 'Cruise ship', 'Train'];

let contextNames: string[] | null = null;

/** Show these pictures behind the whole app until cleared (null goes back to the chosen country). */
export function setBackdropContext(names: string[] | null): void {
  contextNames = names;
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** One of the names, chosen at random once per call site (stable while the component lives). */
export function pickOne(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)] as string;
}
