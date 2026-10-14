import { getConfig } from '../config.js';
import type { HotelProvider } from './hotels/HotelProvider.js';
import { LiteApiHotelProvider } from './hotels/LiteApiHotelProvider.js';
import { GmailNotificationProvider } from './notifications/GmailNotificationProvider.js';
import type { NotificationProvider } from './notifications/NotificationProvider.js';
import type { PaymentProvider } from './payments/PaymentProvider.js';
import { StripePaymentProvider } from './payments/StripePaymentProvider.js';
import type { MapsProvider } from './maps/MapsProvider.js';
import { OsmMapsProvider } from './maps/OsmMapsProvider.js';
import { DuffelFlightProvider } from './flights/DuffelFlightProvider.js';
import type { FlightProvider } from './flights/FlightProvider.js';
import type { TransportProvider } from './transport/TransportProvider.js';
import { TransitousTransportProvider } from './transport/TransitousTransportProvider.js';

// Routes and tools get providers only through these functions, so swapping an implementation is a config change
// plus one new class. Config validation already refused unknown values at start-up.

let hotel: HotelProvider | undefined;
let transport: TransportProvider | undefined;
let maps: MapsProvider | undefined;

export function hotelProvider(): HotelProvider {
  if (!hotel) {
    switch (getConfig().providers.hotel) {
      case 'liteapi':
        hotel = new LiteApiHotelProvider();
        break;
      default:
        throw new Error(`No hotel provider "${getConfig().providers.hotel}"`);
    }
  }
  return hotel;
}

export function transportProvider(): TransportProvider {
  if (!transport) {
    switch (getConfig().providers.transport) {
      case 'transitous':
        transport = new TransitousTransportProvider();
        break;
      default:
        throw new Error(`No transport provider "${getConfig().providers.transport}"`);
    }
  }
  return transport;
}

let flights: FlightProvider | null | undefined;

/** The flight provider, or null when no Duffel test token is configured (flights then stay estimates). A live token is refused. */
export function flightProvider(): FlightProvider | null {
  if (flights === undefined) {
    const token = getConfig().duffelAccessToken;
    flights = token ? new DuffelFlightProvider(token) : null;
  }
  return flights;
}

export function mapsProvider(): MapsProvider {
  if (!maps) {
    switch (getConfig().providers.maps) {
      case 'osm':
        maps = new OsmMapsProvider();
        break;
      default:
        throw new Error(`No maps provider "${getConfig().providers.maps}"`);
    }
  }
  return maps;
}

let payment: PaymentProvider | undefined;
let notification: NotificationProvider | undefined;

/** Constructing the Stripe provider refuses non-test keys, so start-up calls this once. */
export function paymentProvider(): PaymentProvider {
  if (!payment) {
    switch (getConfig().providers.payment) {
      case 'stripe':
        payment = new StripePaymentProvider();
        break;
      default:
        throw new Error(`Unknown PAYMENT_PROVIDER "${getConfig().providers.payment}". Supported: stripe.`);
    }
  }
  return payment;
}

export function notificationProvider(): NotificationProvider {
  if (!notification) {
    switch (getConfig().providers.notification) {
      case 'gmail':
        notification = new GmailNotificationProvider();
        break;
      default:
        throw new Error(`Unknown NOTIFICATION_PROVIDER "${getConfig().providers.notification}". Supported: gmail.`);
    }
  }
  return notification;
}
