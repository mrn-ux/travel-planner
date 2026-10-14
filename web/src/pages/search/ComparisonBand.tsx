import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ds/Button';
import { Money } from '../../components/Money';
import { FlightBookingModal } from './FlightBookingModal';
import { formatDateRange } from '../../lib/format';
import { getPlan, type Plan } from '../../lib/plan';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavItem } from '../../components/ds/NavItem';
import { getSelectedPlaces, type SelectedPlace } from '../../lib/places';
import type { Trip, TripState } from '../../lib/trip';
import { HotelsTab } from './HotelsTab';
import { PlacesTab } from './PlacesTab';
import { TransportTab } from './TransportTab';

/**
 * Hotels / Transport tabs (frames 1e and 1f). Tab, filters and sort live in the URL query, so a reload or a tab switch
 * keeps them. Each tab loads and fails on its own: one failing never blocks the other.
 */
export function ComparisonBand({ trip, onTripState }: { trip: Trip; onTripState: (state: TripState) => void }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get('tab') === 'transport' ? 'transport' : params.get('tab') === 'places' ? 'places' : 'hotels';

  // Several parameters are often set in one go (a country and its city, a sort key and its direction). React Router's functional
  // updates do not queue, so the last call would win: changes made in the same tick are collected and applied together.
  // The three steps: a hotel, a transport option and at least one place to visit. The trip plan opens once all three are done.
  const [bookingFlight, setBookingFlight] = useState(false);
  const [done, setDone] = useState<{ hotel: boolean; transport: boolean; places: boolean }>({ hotel: false, transport: false, places: false });
  // What is already chosen or booked, shown above the tab so it is still there when the traveler comes back.
  const [chosen, setChosen] = useState<{ hotel: Plan['selectedHotel']; transport: Plan['selectedTransport']; places: SelectedPlace[] }>({ hotel: null, transport: null, places: [] });
  const refreshDone = useCallback(() => {
    void Promise.all([getPlan(trip.id).catch(() => null), getSelectedPlaces(trip.id).catch(() => null)]).then(([plan, places]) => {
      setChosen((c) => ({ hotel: plan ? plan.selectedHotel : c.hotel, transport: plan ? plan.selectedTransport : c.transport, places: places ?? c.places }));
      setDone((d) => ({ hotel: plan ? plan.selectedHotel !== null : d.hotel, transport: plan ? plan.selectedTransport !== null : d.transport, places: places ? places.length > 0 : d.places }));
    });
  }, [trip.id]);
  useEffect(() => {
    refreshDone();
  }, [refreshDone, tab]);
  // The trip plan opens as soon as a place to visit is chosen; a hotel and transport can still be added before or after.
  const canOpen = done.places;
  const missing = [!done.hotel && 'a hotel', !done.transport && 'a transport option'].filter(Boolean).join(' and ');
  const pending = useRef<Map<string, string | null>>(new Map());
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const first = pending.current.size === 0;
      pending.current.set(key, value);
      if (!first) return;
      queueMicrotask(() => {
        const changes = pending.current;
        pending.current = new Map();
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            for (const [k, v] of changes) {
              if (v === null || v === '') next.delete(k);
              else next.set(k, v);
            }
            return next;
          },
          { replace: true },
        );
      });
    },
    [setParams],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <NavItem active={tab === 'hotels'} onClick={() => setParam('tab', null)}>
            {done.hotel ? '✓ ' : ''}Hotels
          </NavItem>
          <NavItem active={tab === 'transport'} onClick={() => setParam('tab', 'transport')}>
            {done.transport ? '✓ ' : ''}Transport
          </NavItem>
          <NavItem active={tab === 'places'} onClick={() => setParam('tab', 'places')}>
            {done.places ? '✓ ' : ''}Places to visit
          </NavItem>
        </div>
        {canOpen && (
          <Link to={`/trip/${encodeURIComponent(trip.id)}`} className="font-sans text-sm text-accent">
            Open trip plan
          </Link>
        )}
      </div>
      <p className="m-0 font-sans text-sm font-semibold text-text">
        {tab === 'hotels'
          ? 'Step 1 of 3: find a cosy place to rest your head. Every great trip starts with a great bed.'
          : tab === 'transport'
            ? 'Step 2 of 3: let us get you there in style. Compare your ways to go and pick your favourite.'
            : 'Step 3 of 3: choose the places that make your heart race. Your plan is built around them.'}
      </p>
      <Chosen tab={tab} chosen={chosen} onBookFlight={() => setBookingFlight(true)} />
      {bookingFlight && (
        <FlightBookingModal
          tripId={trip.id}
          onClose={() => {
            setBookingFlight(false);
            refreshDone();
          }}
          onBooked={() => refreshDone()}
        />
      )}
      {tab === 'hotels' ? (
        <HotelsTab trip={trip} params={params} setParam={setParam} onTripState={onTripState} chosenHotel={chosen.hotel ? { id: chosen.hotel.hotelId, booked: chosen.hotel.booked } : null} />
      ) : tab === 'transport' ? (
        <TransportTab trip={trip} params={params} setParam={setParam} onSelected={refreshDone} onTripState={onTripState} onBook={() => setBookingFlight(true)} flightBooked={chosen.transport?.booked === true} chosenTransport={chosen.transport ? { mode: chosen.transport.mode, operator: chosen.transport.operator, departureAt: chosen.transport.departureAt } : null} />
      ) : (
        <PlacesTab trip={trip} onCount={(n) => { setDone((d) => ({ ...d, places: n > 0 })); refreshDone(); }} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-border pt-4">
        <div>
          {tab !== 'hotels' && (
            <Button variant="secondary" onClick={() => setParam('tab', tab === 'places' ? 'transport' : null)}>
              &larr; {tab === 'places' ? 'Transport' : 'Hotels'}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {tab === 'places' && !done.places && <span className="font-sans text-sm font-semibold text-text">Choose at least one place to visit to open your trip plan.</span>}
          {tab === 'places' && done.places && missing && <span className="font-sans text-sm font-semibold text-text">Still to choose (optional for now): {missing}.</span>}
          {tab !== 'places' ? (
            <Button onClick={() => setParam('tab', tab === 'hotels' ? 'transport' : 'places')}>Next: {tab === 'hotels' ? 'Transport' : 'Places to visit'} &rarr;</Button>
          ) : (
            canOpen && <Button onClick={() => navigate(`/trip/${encodeURIComponent(trip.id)}`)}>Open trip plan</Button>
          )}
        </div>
      </div>
    </section>
  );
}

/** The hotel, transport or places already chosen (or booked) for the trip, shown above the matching tab. */
function Chosen({ tab, chosen, onBookFlight }: { tab: 'hotels' | 'transport' | 'places'; onBookFlight: () => void; chosen: { hotel: Plan['selectedHotel']; transport: Plan['selectedTransport']; places: SelectedPlace[] } }) {
  const box = 'rounded-md border border-solid border-accent bg-accent-soft px-4 py-3 font-sans text-sm text-text';
  if (tab === 'hotels' && chosen.hotel) {
    const h = chosen.hotel;
    return (
      <div className={box} role="status">
        <span className="font-medium">{h.booked ? 'Your booked hotel' : 'Your selected hotel'}: </span>
        {h.name}
        {h.roomName ? `, ${h.roomName}` : ''}, {formatDateRange(h.checkin, h.checkout)}, <Money amount={h.total.amount} currency={h.total.currency} /> in total ({h.booked ? 'booked' : 'not booked yet'}; sandbox rate).
      </div>
    );
  }
  if (tab === 'transport' && chosen.transport) {
    const t = chosen.transport;
    return (
      <div className={box} role="status">
        <span className="font-medium">{t.booked ? 'Your booked flight' : 'Your selected transport'}: </span>
        {t.label}, <Money amount={t.price.amount} currency={t.price.currency} />
        {t.booked ? ` (booked, reference ${t.bookingReference ?? ''}; test booking)` : t.bookable ? ' (not booked yet).' : ' (compared only: this kind of transport cannot be booked here).'}
        {t.bookable && !t.booked && (
          <span className="ml-3">
            <Button onClick={onBookFlight}>Book this flight</Button>
          </span>
        )}
      </div>
    );
  }
  if (tab === 'places' && chosen.places.length > 0) {
    return (
      <div className={box} role="status">
        <span className="font-medium">Your chosen places ({chosen.places.length}): </span>
        {chosen.places.map((p) => p.name).join(', ')}.
      </div>
    );
  }
  return null;
}
