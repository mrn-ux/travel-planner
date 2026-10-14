import { api } from './api';
import type { Priced } from './comparison';
import type { Certainty } from './types';

export interface PlanItem {
  id: number;
  slot: 'morning' | 'afternoon' | 'evening';
  kind: 'activity' | 'meal' | 'rest';
  title: string;
  startsAt: string | null;
  durationMinutes: number | null;
  cost: Priced;
  openingHours: string | null;
  travelMinutesToNext: number | null;
  travelCertainty: Certainty | null;
  source: string;
  sourceUrl: string | null;
}

export interface Proposal {
  id: number;
  kind: string;
  description: string;
  saving: string;
  currency: string;
  certainty: Certainty;
}

export interface Plan {
  trip: { id: string; title: string; destination: string | null; startDate: string | null; endDate: string | null; currency: string };
  budget: {
    categories: Array<{ category: string; amount: string; certainty: Certainty; missingCount: number; itemCount: number; share: number }>;
    estimatedTotal: string;
    budget: string | null;
    remaining: string | null;
    currency: string;
    partial: boolean;
    categoriesWithoutRealFigure: string[];
  };
  overBudget: { over: boolean; amount: string | null };
  proposals: Proposal[];
  itinerary: Array<{ day: number; date: string; place: string | null; note: string | null; items: PlanItem[] }>;
  selectedHotel: { hotelId: string | null; name: string; booked: boolean; roomName: string | null; checkin: string; checkout: string; price: Priced; total: Priced; sandbox: true } | null;
  selectedTransport: { label: string; mode: string; operator: string | null; departureAt: string | null; price: Priced; scheduleCertainty: Certainty; bookable: boolean; booked: boolean; bookingReference: string | null } | null;
  selectedPlaces: Array<{ id: string; name: string; kind: string; openingHours: string | null; entry: { kind: 'free' | 'paid' | 'unknown'; charge: string | null } }>;
  generatedAt: string;
  notes?: string[];
}

const base = (id: string): string => `/trips/${encodeURIComponent(id)}/plan`;

export const getPlan = (tripId: string): Promise<Plan> => api<Plan>(base(tripId));
export const generatePlan = (tripId: string): Promise<Plan> => api<Plan>(`${base(tripId)}/generate`, { method: 'POST', body: '{}' });
export const applyProposals = (tripId: string, proposalIds: number[]): Promise<Plan> => api<Plan>(`${base(tripId)}/proposals/apply`, { method: 'POST', body: JSON.stringify({ proposalIds }) });
export const removeItem = (tripId: string, itemId: number): Promise<Plan> => api<Plan>(`${base(tripId)}/items/${itemId}`, { method: 'DELETE' });
