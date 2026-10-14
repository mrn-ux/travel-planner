export type Certainty = 'confirmed' | 'estimated' | 'unavailable';

/** An amount is always a decimal string from the API, never a float. */
export interface Money {
  amount: string | null;
  currency: string | null;
  certainty: Certainty;
}

/** Every fact that originates outside the database carries its provenance. */
export interface Provenance {
  source: string;
  source_url: string | null;
  fetched_at: string | null;
  certainty: Certainty;
  sandbox?: boolean;
}

/** The API error body is always { error: string }. */
export interface ApiErrorBody {
  error: string;
}
