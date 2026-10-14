import type { StayQuery } from './HotelProvider.js';

/** Share the party between the rooms: adults as evenly as possible (at least one per room), children dealt out in turn. */
export function occupanciesFor(stay: Pick<StayQuery, 'adults' | 'childrenAges' | 'rooms'>): Array<{ adults: number; children: number[] }> {
  const rooms = Math.max(1, Math.min(stay.rooms ?? 1, stay.adults));
  const out = Array.from({ length: rooms }, (_, i) => ({ adults: Math.floor(stay.adults / rooms) + (i < stay.adults % rooms ? 1 : 0), children: [] as number[] }));
  stay.childrenAges.forEach((age, i) => out[i % rooms]!.children.push(age));
  return out;
}
