import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { PriceCell } from '../../components/PriceCell';
import { SkeletonRows } from '../../components/Skeleton';
import { Button } from '../../components/ds/Button';
import { ComparisonTable, type ComparisonColumn } from '../../components/ds/ComparisonTable';
import { Input } from '../../components/ds/Input';
import { Select } from '../../components/ds/Select';
import { ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { searchHotels, type HotelSearch, type HotelSort } from '../../lib/comparison';
import { patchTrip, type Trip, type TripState } from '../../lib/trip';

const RATINGS = ['All', '7 and above', '8 and above', '9 and above'];
const ratingValue = (label: string): string | undefined => (label === 'All' ? undefined : label.slice(0, 1));

const COLUMNS: ComparisonColumn[] = [
  { key: 'hotel', label: 'Hotel', sortable: true },
  { key: 'category', label: 'Category' },
  { key: 'rooms', label: 'Room types' },
  { key: 'location', label: 'Location', sortable: true },
  { key: 'price', label: 'Price per night', align: 'right', sortable: true, tabular: true },
  { key: 'rating', label: 'Rating', sortable: true, tabular: true },
  { key: 'actions', label: '' },
];

interface Props {
  trip: Trip;
  params: URLSearchParams;
  setParam: (key: string, value: string | null) => void;
  /** The trip changed (a field here was edited): the rest of the app shows the same trip. */
  onTripState: (state: TripState) => void;
  /** The hotel already booked or selected for the trip, marked in the list. */
  chosenHotel?: { id: string | null; booked: boolean } | null;
}

/** Hotels tab: filters, then a sortable table with live sandbox prices. Filters and sort live in the URL. */
export function HotelsTab({ trip, params, setParam, onTripState, chosenHotel }: Props) {
  // Dates and guests belong to the trip: editing them here saves them to the trip, so the home form and every other screen agree.
  const checkin = trip.startDate ?? '';
  const checkout = trip.endDate ?? '';
  const guests = String((trip.adults ?? 1) + trip.childrenAges.length);
  // How many rooms: kept in the page address; the party is shared between them (at least one adult in each).
  const rooms = Math.max(1, Math.min(10, Number(params.get('rooms') ?? '1') || 1));
  const [draftIn, setDraftIn] = useState(checkin);
  const [draftOut, setDraftOut] = useState(checkout);
  const [draftGuests, setDraftGuests] = useState(guests);
  const [fieldError, setFieldError] = useState<string | null>(null);
  useEffect(() => {
    setDraftIn(checkin);
    setDraftOut(checkout);
    setDraftGuests(guests);
  }, [checkin, checkout, guests]);

  const saveTrip = async (patch: Parameters<typeof patchTrip>[1]) => {
    setFieldError(null);
    try {
      onTripState(await patchTrip(trip.id, patch));
    } catch (err) {
      setFieldError(err instanceof ApiError ? err.message : 'Could not save. Check your connection.');
    }
  };
  const commitDates = () => {
    if (draftIn === checkin && draftOut === checkout) return;
    if (!draftIn || !draftOut) return; // wait until both dates are there
    const nights = Math.round((Date.parse(`${draftOut}T00:00:00Z`) - Date.parse(`${draftIn}T00:00:00Z`)) / 86_400_000);
    if (!(nights >= 1)) {
      setFieldError('Check-out must be after check-in.');
      return;
    }
    void saveTrip({ startDate: draftIn, endDate: draftOut, durationDays: nights });
  };
  const commitGuests = () => {
    const n = Number(draftGuests);
    if (draftGuests.trim() === '' || !Number.isInteger(n) || n < 1 || n > 30) {
      setFieldError('Guests must be a whole number from 1 to 30.');
      return;
    }
    if (n === (trip.adults ?? 1) + trip.childrenAges.length) return;
    const adults = n - trip.childrenAges.length;
    if (adults < 1) {
      setFieldError(`At least one adult must travel: with ${trip.childrenAges.length} ${trip.childrenAges.length === 1 ? 'child' : 'children'} you need at least ${trip.childrenAges.length + 1} guests.`);
      return;
    }
    void saveTrip({ adults });
  };
  const rating = params.get('rating') ?? 'All';
  const sort = (params.get('hsort') as HotelSort | null) ?? 'recommended';
  const dir = (params.get('hdir') as 'asc' | 'desc' | null) ?? (sort === 'recommended' || sort === 'rating' ? 'desc' : 'asc');
  const page = Number(params.get('page') ?? '1') || 1;

  const [data, setData] = useState<HotelSearch | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('We could not load hotels.');

  const load = useCallback(async () => {
    setState('loading');
    const q: Record<string, string> = { sort, dir, page: String(page) };
    if (checkin) q['checkin'] = checkin;
    if (checkout) q['checkout'] = checkout;
    if (guests) q['guests'] = guests;
    if (rooms > 1) q['rooms'] = String(rooms);
    const min = ratingValue(rating);
    if (min) q['minRating'] = min;
    try {
      setData(await searchHotels(trip.id, q));
      setState('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not load hotels.');
      setState('error');
    }
  }, [trip.id, checkin, checkout, guests, rooms, rating, sort, dir, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // A big party in one room often finds nothing: once, the search is repeated with the party shared between enough rooms (about three
  // guests each), and the traveler is told. The Rooms field can be changed at any time.
  const [autoRooms, setAutoRooms] = useState<number | null>(null);
  const triedAuto = useRef(false);
  useEffect(() => {
    if (state !== 'ready' || !data || data.total > 0 || triedAuto.current || params.has('rooms')) return;
    const adults = trip.adults ?? 1;
    const need = Math.min(adults, Math.ceil(Number(guests) / 3));
    if (need <= 1) return;
    triedAuto.current = true;
    setAutoRooms(need);
    setParam('rooms', String(need));
  }, [state, data, trip.adults, guests, params, setParam]);

  const onSort = (key: string) => {
    const next: HotelSort = key === 'hotel' ? 'recommended' : key === 'price' ? 'price' : key === 'rating' ? 'rating' : 'location';
    const nextDir = next === sort ? (dir === 'asc' ? 'desc' : 'asc') : next === 'recommended' || next === 'rating' ? 'desc' : 'asc';
    setParam('hsort', next === 'recommended' ? null : next);
    setParam('hdir', nextDir);
    setParam('page', null);
  };

  const clearFilters = () => {
    ['rating', 'page'].forEach((k) => setParam(k, null));
  };

  const rows = (data?.items ?? []).map((h) => ({
    hotel: (
      <div className="flex items-center gap-3">
        {h.thumbnail ? (
          <img src={h.thumbnail} alt="" loading="lazy" className="h-8 w-12 shrink-0 rounded-sm bg-surface-muted object-cover" />
        ) : (
          <div className="h-8 w-12 shrink-0 rounded-sm bg-surface-muted" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <div className="font-medium">
            {h.name}
            {chosenHotel?.id === h.hotelId && (
              <span className="ml-2 rounded-sm bg-accent-soft px-2 py-badge-y text-xs text-accent">{chosenHotel.booked ? 'Booked' : 'Selected'}</span>
            )}
          </div>
          <div className="text-xs text-text-secondary" title="Why this ranks where it does">
            {h.recommendedReason}
          </div>
        </div>
      </div>
    ),
    category: h.category ?? 'Not rated',
    rooms: (
      <div className="text-xs">
        <div>{h.roomTypes.length > 0 ? `${h.roomTypes.slice(0, 3).join(', ')}${h.roomTypes.length > 3 ? ` +${h.roomTypes.length - 3} more` : ''}` : 'Room types not stated'}</div>
        <div className="text-text-secondary">{h.maxPerRoom !== null ? `Up to ${h.maxPerRoom} ${h.maxPerRoom === 1 ? 'person' : 'people'} per room` : 'Room size not stated'}</div>
      </div>
    ),
    location: (
      <span>
        {h.area ?? 'Location unavailable'}
        {h.distanceKm && <span className="text-text-secondary"> ({h.distanceKm} km from centre)</span>}
      </span>
    ),
    price: <PriceCell price={h.pricePerNight} suffix="/ night" sandbox />,
    rating: h.rating ?? 'Not rated',
    actions: (
      <div className="flex flex-col items-end gap-2">
        {chosenHotel?.id === h.hotelId && (
          <span className={`rounded-sm px-2 py-badge-y text-xs font-medium text-white ${chosenHotel.booked ? 'bg-confirmed' : 'bg-accent'}`}>{chosenHotel.booked ? '✓ Booked' : '✓ Selected'}</span>
        )}
      <Link
        to={`/hotels/${encodeURIComponent(h.hotelId)}?tripId=${encodeURIComponent(trip.id)}${checkin ? `&checkin=${checkin}` : ''}${checkout ? `&checkout=${checkout}` : ''}${rooms > 1 ? `&rooms=${rooms}` : ''}`}
        className="inline-flex h-control items-center whitespace-nowrap rounded-md border border-accent bg-accent-soft px-4 font-sans text-sm font-medium text-accent no-underline hover:bg-accent hover:text-white"
      >
        View details
      </Link>
      </div>
    ),
  }));

  const noDates = !checkin || !checkout;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 items-end gap-3 md:flex md:gap-4">
        <Input label="Check-in" type="date" value={draftIn} onChange={(e) => setDraftIn(e.target.value)} onBlur={commitDates} />
        <Input label="Check-out" type="date" value={draftOut} onChange={(e) => setDraftOut(e.target.value)} onBlur={commitDates} />
        <Input label="Guests" type="number" min={1} max={30} step={1} value={draftGuests} onChange={(e) => setDraftGuests(e.target.value)} onBlur={commitGuests} error={fieldError ?? undefined} />
        <Input label="Rooms" type="number" min={1} max={Math.max(1, trip.adults ?? 1)} step={1} value={String(rooms)} onChange={(e) => setParam('rooms', Number(e.target.value) > 1 ? String(Math.min(Number(e.target.value), Math.max(1, trip.adults ?? 1))) : null)} />
        <Select label="Rating" value={rating} options={RATINGS} onChange={(e) => setParam('rating', e.target.value === 'All' ? null : e.target.value)} />
      </div>

      {autoRooms !== null && rooms === autoRooms && <p className="m-0 font-sans text-sm font-semibold text-text">One room had no space for your party, so we spread your {guests} guests over {autoRooms} rooms. Change the Rooms field any time.</p>}
      <AsyncBoundary
        state={noDates ? 'empty' : state === 'ready' && data && data.items.length === 0 ? 'empty' : state}
        emptyMessage={noDates ? 'Set check-in and check-out dates to see live hotel prices.' : (data && data.cheapest && data.cheapest.amount && data.cheapest.currency ? `No hotel fits your budget for this stay and party. The lowest price found is ${formatMoney(data.cheapest.amount, data.cheapest.currency)}. Try fewer nights, fewer guests or a larger budget.` : 'No hotel has a room for this stay and party. Try other dates or fewer guests.')}
        errorMessage={error}
        onRetry={() => void load()}
        loading={<SkeletonRows count={5} />}
      >
        {data && (
          <>
            <ComparisonTable columns={COLUMNS} rows={rows} sortKey={sort === 'recommended' ? 'hotel' : sort} sortDir={dir} onSort={onSort} />
            <div className="flex flex-wrap items-center justify-between gap-3 font-sans text-sm font-semibold text-text">
              <span>
                {data.total} {data.total === 1 ? 'hotel' : 'hotels'} for {data.stay.nights} {data.stay.nights === 1 ? 'night' : 'nights'}, {data.stay.adults + data.stay.children} {data.stay.adults + data.stay.children === 1 ? 'guest' : 'guests'} in {data.stay.rooms} {data.stay.rooms === 1 ? 'room' : 'rooms'}, within your budget
                {data.hiddenCount > 0 ? ` (${data.hiddenCount} hidden: no room for this stay or over budget)` : ''}
              </span>
              {data.total > data.pageSize && (
                <span className="flex gap-2">
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
                    Previous
                  </Button>
                  <Button variant="secondary" disabled={page * data.pageSize >= data.total} onClick={() => setParam('page', String(page + 1))}>
                    Next
                  </Button>
                </span>
              )}
            </div>
            <p className="m-0 font-sans text-xs font-medium text-text-secondary">Hotel data and rates from the LiteAPI sandbox: sandbox rates, not real bookings. Prices are fetched live when you open this tab.</p>
          </>
        )}
      </AsyncBoundary>

      {state === 'ready' && data && data.items.length === 0 && !noDates && (
        <div>
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
