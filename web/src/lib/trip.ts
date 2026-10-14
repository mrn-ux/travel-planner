import { api } from './api';
import type { Certainty } from './types';
import { getTripId, setTripId, setTripKey, clearTripId } from './session';

export interface Trip {
  id: string;
  status: 'draft' | 'saved' | 'booked';
  title: string | null;
  destination: string | null;
  recommendRequested: boolean;
  startDate: string | null;
  endDate: string | null;
  dateWindowText: string | null;
  durationDays: number | null;
  adults: number | null;
  childrenAges: number[];
  /** Entered by the traveler. The amount is a decimal string. */
  budget: { amount: string; currency: string; source: 'user'; certainty: 'confirmed' } | null;
  transportPreference: string | null;
  accommodationPreference: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  originCity: string | null;
  originCountry: string | null;
  interests: string | null;
  specialRequirements: string | null;
  updatedAt: string;
}

export type MissingField = 'destinationOrRecommend' | 'datesOrDuration' | 'travelers' | 'budget' | 'transport' | 'accommodation';

export interface TripState {
  trip: Trip;
  missing: MissingField[];
}

/** A result shown beneath an agent message, always with its provenance. */
export interface ResultCard {
  title: string;
  lines: string[];
  certainty: Certainty;
  source: string;
  source_url: string | null;
  fetched_at: string | null;
  sandbox?: boolean;
}

export interface ChatMessageData {
  id: number;
  role: 'user' | 'agent';
  content: string;
  cards: ResultCard[] | null;
  createdAt: string;
}

export interface TurnResponse {
  userMessage: ChatMessageData;
  agentMessage: ChatMessageData;
  trip: Trip;
  missing: MissingField[];
}

/** Partial brief sent to PATCH /api/trips/:id. Any field may be omitted; null clears it. */
export interface BriefPatch {
  destination?: string | null;
  recommendRequested?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  dateWindowText?: string | null;
  durationDays?: number | null;
  adults?: number | null;
  childrenAges?: number[];
  budget?: { amount: string; currency: string } | null;
  transportPreference?: string | null;
  accommodationPreference?: string | null;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  originCity?: string | null;
  originCountry?: string | null;
  interests?: string | null;
  specialRequirements?: string | null;
}

export const MISSING_LABELS: Record<MissingField, string> = {
  destinationOrRecommend: 'a destination',
  datesOrDuration: 'start and end dates',
  travelers: 'adults',
  budget: 'a budget',
  transport: 'a transport preference',
  accommodation: 'an accommodation preference',
};

export const TRANSPORT_OPTIONS = ['None stated', 'Flight', 'Train', 'Bus', 'Car'];
export const ACCOMMODATION_OPTIONS = ['No preference', 'Hotel', 'Villa', 'Cottage', 'Guest house', 'Apartment'];
/** Every ISO 4217 currency the browser knows (all the world's countries), from the platform's own list, A to Z. */
function allCurrencies(): string[] {
  try {
    const codes = Intl.supportedValuesOf('currency');
    if (codes.length > 0) return [...new Set(codes)].sort();
  } catch {
    /* an older browser without Intl.supportedValuesOf */
  }
  return ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'INR', 'JPY', 'USD'];
}
export const CURRENCY_OPTIONS = allCurrencies();

/** "USD" -> "USD (US Dollar)": the platform's own currency names, in English. A code it cannot name is shown as it is. */
export function currencyLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'currency' }).of(code);
    return name && name !== code ? `${code} (${name})` : code;
  } catch {
    return code;
  }
}

/** Create a trip. A visitor gets a draft plus an anonymous key (stored so the draft survives reloads). */
export async function createTrip(): Promise<TripState> {
  const res = await api<TripState & { tripKey?: string }>('/trips', { method: 'POST', body: '{}' });
  if (res.tripKey) setTripKey(res.tripKey);
  setTripId(res.trip.id);
  return { trip: res.trip, missing: res.missing };
}

export function getTrip(id: string): Promise<TripState> {
  return api<TripState>(`/trips/${encodeURIComponent(id)}`);
}

export function getLatestTrip(): Promise<TripState> {
  return api<TripState>('/trips/latest');
}

export function patchTrip(id: string, patch: BriefPatch): Promise<TripState> {
  return api<TripState>(`/trips/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function listMessages(id: string): Promise<ChatMessageData[]> {
  const res = await api<{ messages: ChatMessageData[] }>(`/trips/${encodeURIComponent(id)}/messages`);
  return res.messages;
}

export function sendMessage(id: string, text: string): Promise<TurnResponse> {
  return api<TurnResponse>(`/trips/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ text }) });
}

export function retryLastMessage(id: string): Promise<TurnResponse> {
  return api<TurnResponse>(`/trips/${encodeURIComponent(id)}/messages/retry`, { method: 'POST', body: '{}' });
}

export { getTripId, setTripId, clearTripId };

/** Split an agent reply into prose and follow-up questions (lines that start with "- "). */
export function splitReply(content: string): { text: string; followUps: string[] } {
  const followUps: string[] = [];
  const prose: string[] = [];
  for (const line of content.split('\n')) {
    const m = /^\s*[-•*]\s+(.*\S)\s*$/.exec(line);
    if (m) followUps.push(m[1] as string);
    else prose.push(line);
  }
  return { text: prose.join('\n').trim(), followUps };
}
