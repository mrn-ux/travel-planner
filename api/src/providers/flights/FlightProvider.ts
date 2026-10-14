import type { ProviderResult } from '../types.js';

export interface FlightOffer {
  /** Stable within one search. */
  id: string;
  airline: string | null;
  /** ISO times of the first slice, and the IANA zones of its airports. */
  departure: string;
  arrival: string;
  departureTz: string | null;
  arrivalTz: string | null;
  durationMinutes: number | null;
  /** Stops between the origin and the destination. */
  stops: number;
  /** Decimal string in the provider's own currency (never converted here). */
  amount: string;
  currency: string;
}

export interface FlightSearchQuery {
  /** Place names to try, best first; the provider finds the airports itself. */
  originNames: string[];
  destinationNames: string[];
  date: string;
  adults: number;
  childrenAges: number[];
}

/** One offer looked at again just before booking: its live price, who must be named, and its terms. */
export interface FlightOfferDetail {
  id: string;
  airline: string | null;
  originName: string | null;
  destinationName: string | null;
  departure: string;
  arrival: string;
  /** Decimal string in the provider's own currency. */
  amount: string;
  currency: string;
  /** ISO time after which the provider no longer honours the offer. */
  expiresAt: string | null;
  /** The people the booking must name, in order: adults first. */
  passengers: Array<{ id: string; type: 'adult' | 'child' | 'infant_without_seat'; age: number | null }>;
  /** Cancellation and change terms as the provider states them, in plain words. */
  terms: string[];
}

export interface FlightPassenger {
  /** The provider's id for this seat, from the offer. */
  id: string;
  title: 'mr' | 'ms' | 'mrs' | 'miss' | 'dr';
  givenName: string;
  familyName: string;
  /** YYYY-MM-DD */
  bornOn: string;
  gender: 'm' | 'f';
  email: string;
  /** International format, for example +442080160509. */
  phoneNumber: string;
}

export interface FlightOrder {
  orderId: string;
  /** The airline booking reference (PNR). */
  bookingReference: string;
  amount: string;
  currency: string;
}

/** Flights are searched and compared, and booked in the provider's test mode only. */
export interface FlightProvider {
  /** Look the offer up again. A failure with reason 'not_found' means it has expired or been withdrawn. */
  getOffer(offerId: string): Promise<ProviderResult<FlightOfferDetail>>;
  /** Book the offer at exactly this price. A failure with detail 'offer_no_longer_available' or 'price_changed' is explicit. */
  createOrder(input: { offerId: string; amount: string; currency: string; passengers: FlightPassenger[] }): Promise<ProviderResult<FlightOrder>>;
  searchFlights(q: FlightSearchQuery): Promise<ProviderResult<FlightOffer[]>>;
}
