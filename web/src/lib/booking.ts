// The "pure" entry does not add Stripe.js to every page when the app starts; it is fetched only when a payment form is needed.
import { loadStripe } from '@stripe/stripe-js/pure';
import type { Stripe } from '@stripe/stripe-js';
import { api } from './api';
import type { Priced } from './comparison';

export interface Booking {
  id: string;
  tripId: string;
  status: 'in_progress' | 'pending' | 'confirmed' | 'failed';
  step: 'verify' | 'price' | 'guest' | 'confirm' | 'pay' | 'done';
  hotel: { id: string; name: string };
  room: { id: string; name: string };
  checkin: string;
  checkout: string;
  nights: number;
  adults: number;
  childrenAges: number[];
  rooms: number;
  shownPrice: Priced;
  finalPrice: Priced | null;
  cancellation: { refundable: boolean; freeUntil: string | null; text: string } | null;
  guest: { firstName: string; lastName: string; email: string; phone: string; specialRequests?: string } | null;
  /** Present only when the hotel provider has confirmed the booking. */
  reference: string | null;
  hotelConfirmationCode: string | null;
  failureReason: string | null;
  refundPending: boolean;
  sandbox: true;
  email: { status: 'sent' | 'failed' | 'not_configured' | null };
}

export interface StartBody {
  hotelId: string;
  roomId: string;
  roomName?: string;
  offerId: string;
  checkin: string;
  checkout: string;
  shownPrice: string;
  currency: string;
  rooms?: number;
}

const post = <T>(path: string, body?: unknown): Promise<T> => api<T>(path, { method: 'POST', body: body === undefined ? '{}' : JSON.stringify(body) });

export const startBooking = (tripId: string, body: StartBody) => post<{ booking: Booking }>(`/trips/${encodeURIComponent(tripId)}/bookings`, body);
export const getBooking = (id: string) => api<{ booking: Booking }>(`/bookings/${id}`);
export const verifyBooking = (id: string) => post<{ booking: Booking }>(`/bookings/${id}/verify`);
export const priceBooking = (id: string) => post<{ booking: Booking }>(`/bookings/${id}/price`);
export const acceptPrice = (id: string, amount: string, currency: string) => post<{ booking: Booking }>(`/bookings/${id}/accept-price`, { amount, currency });
export const saveGuest = (id: string, body: { firstName: string; lastName: string; email: string; phone: string; specialRequests?: string }) =>
  api<{ booking: Booking }>(`/bookings/${id}/guest`, { method: 'PUT', body: JSON.stringify(body) });
export const confirmBooking = (id: string) => post<{ booking: Booking; clientSecret: string }>(`/bookings/${id}/confirm`);
export const completeBooking = (id: string, paymentIntentId: string) => post<{ booking: Booking }>(`/bookings/${id}/complete`, { paymentIntentId });
export const resendEmail = (id: string) => post<{ message: { status: string } }>(`/bookings/${id}/resend`);

let stripePromise: Promise<Stripe | null> | null = null;

/** Stripe.js is loaded only on the booking page, with the publishable key from the API. Faro builds no card inputs. */
export function getStripe(): Promise<Stripe | null> {
  stripePromise ??= api<{ stripePublishableKey: string }>('/config/public').then((c) => loadStripe(c.stripePublishableKey, { developerTools: { assistant: { enabled: false } } } as Parameters<typeof loadStripe>[1]));
  return stripePromise;
}
