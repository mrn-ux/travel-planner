import { api } from './api';
import type { Certainty } from './types';

export interface TripCardData {
  tripId: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: { amount: string; currency: string } | null;
  hotel: { status: 'not_booked' | 'pending' | 'confirmed' | 'failed'; name: string | null; room: string | null; total: { amount: string; currency: string } | null };
  transport: { status: 'compare_only' | 'not_selected'; label: string | null; bookingReference: string | null; price: { amount: string; currency: string; certainty: Certainty; sandbox: boolean } | null };
  places: { count: number; names: string[] };
  estimatedTotal: { amount: string | null; currency: string | null; certainty: Certainty; partial: boolean };
  updatedAt: string;
}

export async function listMyTrips(): Promise<TripCardData[]> {
  return (await api<{ trips: TripCardData[] }>('/trips')).trips;
}

/** Delete one of my trips (refused by the server when it has a booking). */
export async function deleteMyTrip(tripId: string): Promise<void> {
  await api<void>(`/trips/${encodeURIComponent(tripId)}`, { method: 'DELETE' });
}
