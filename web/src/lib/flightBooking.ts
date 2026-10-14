import { api } from './api';

export interface FlightBooking {
  id: string;
  status: 'confirmed' | 'failed';
  reference: string | null;
  airline: string | null;
  origin: string | null;
  destination: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  total: { amount: string; currency: string } | null;
  passengers: Array<{ name: string }>;
  email: { status: 'sent' | 'failed' | 'not_configured' | null };
  sandbox: true;
}

export interface FlightCheck {
  offer: {
    id: string;
    airline: string | null;
    originName: string | null;
    destinationName: string | null;
    departure: string;
    arrival: string;
    amount: string;
    currency: string;
    expiresAt: string | null;
    passengers: Array<{ type: string; age: number | null }>;
    terms: string[];
  };
  shownPrice: { amount: string; currency: string } | null;
  priceChanged: boolean;
  existing: FlightBooking | null;
}

export interface PassengerInput {
  title: 'mr' | 'ms' | 'mrs' | 'miss' | 'dr';
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: 'm' | 'f';
  email: string;
  phoneNumber: string;
}

const base = (tripId: string): string => `/trips/${encodeURIComponent(tripId)}/flight-booking`;

export const checkFlight = (tripId: string) => api<FlightCheck>(`${base(tripId)}/check`, { method: 'POST', body: '{}' });
export const bookFlight = (tripId: string, body: { amount: string; currency: string; passengers: PassengerInput[] }) =>
  api<{ booking: FlightBooking }>(base(tripId), { method: 'POST', body: JSON.stringify(body) }).then((r) => r.booking);
export const resendFlightEmail = (tripId: string) => api<{ status: string }>(`${base(tripId)}/resend`, { method: 'POST', body: '{}' });
