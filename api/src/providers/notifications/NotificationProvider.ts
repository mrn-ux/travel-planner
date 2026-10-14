import type { ProviderResult } from '../types.js';

export interface BookingConfirmationMessage {
  to: string;
  bookingReference: string;
  hotelName: string;
  checkin: string;
  checkout: string;
  /** Decimal string. */
  finalPrice: string;
  currency: string;
  cancellationSummary: string;
  hotelConfirmationCode: string | null;
  sandbox: true;
}

export interface FlightConfirmationMessage {
  to: string;
  bookingReference: string;
  airline: string;
  origin: string;
  destination: string;
  /** ISO times. */
  departure: string;
  arrival: string;
  /** Decimal string. */
  total: string;
  currency: string;
  passengers: string[];
  sandbox: true;
}

/** Booking confirmation delivery (the only notification Faro sends). One real implementation (Gmail), chosen by NOTIFICATION_PROVIDER. */
export interface NotificationProvider {
  isConfigured(): boolean;
  sendBookingConfirmation(input: BookingConfirmationMessage): Promise<ProviderResult<{ messageId: string }>>;
  sendFlightConfirmation(input: FlightConfirmationMessage): Promise<ProviderResult<{ messageId: string }>>;
}
