import { api } from './api';
import type { Trip } from './trip';
import type { Certainty } from './types';

export type Factor = 'budget' | 'season' | 'activities' | 'transport' | 'safety';

export interface Reason {
  factor: Factor;
  text: string;
  certainty: Certainty;
  source: string;
  source_url: string | null;
  fetched_at: string | null;
  /** Licence credit for guide-derived text. */
  attribution?: string;
}

export interface Recommendation {
  rank: number;
  destination: string;
  countryCode: string | null;
  /** 0-100, shown only as the score bar. */
  score: number;
  completeness: 'quick' | 'full';
  /** Set when refinement moved this destination. */
  previousRank?: number;
  reasons: Reason[];
}

export interface RecommendationsView {
  status: 'loading' | 'partial' | 'ready' | 'insufficient';
  refining: boolean;
  /** Refinement failed: the list is based on limited data. */
  limited: boolean;
  recommendations: Recommendation[];
  insufficient?: { limitingFactor: string; found: number };
  note?: string;
}

const base = (tripId: string): string => `/trips/${encodeURIComponent(tripId)}`;

export const getRecommendations = (tripId: string): Promise<RecommendationsView> => api<RecommendationsView>(`${base(tripId)}/recommendations`);

export const refreshRecommendations = (tripId: string, excluded: string[]): Promise<RecommendationsView> =>
  api<RecommendationsView>(`${base(tripId)}/recommendations/refresh`, { method: 'POST', body: JSON.stringify({ excluded }) });

export const chooseDestination = (tripId: string, destination: string): Promise<{ trip: Trip }> =>
  api<{ trip: Trip }>(`${base(tripId)}/destination`, { method: 'PUT', body: JSON.stringify({ destination }) });

export const clearDestination = (tripId: string): Promise<{ trip: Trip }> => api<{ trip: Trip }>(`${base(tripId)}/destination`, { method: 'DELETE' });
