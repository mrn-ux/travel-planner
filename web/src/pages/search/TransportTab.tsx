import { useCallback, useEffect, useState } from 'react';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { CertaintyBadge } from '../../components/CertaintyBadge';
import { PriceCell } from '../../components/PriceCell';
import { SkeletonRows } from '../../components/Skeleton';
import { ComparisonTable, type ComparisonColumn } from '../../components/ds/ComparisonTable';
import { Button } from '../../components/ds/Button';
import { Input } from '../../components/ds/Input';
import { Select } from '../../components/ds/Select';
import { ApiError } from '../../lib/api';
import { formatDate, formatDuration } from '../../lib/format';
import { formatClock, searchTransport, selectTransport, TRANSPORT_MODES, type TransportRow, type TransportSearch } from '../../lib/comparison';
import { getCities, getCountries, type Country } from '../../lib/places';
import { patchTrip, type Trip, type TripState } from '../../lib/trip';

const DEFAULT_MODES = ['train', 'bus', 'flight'];

const COLUMNS: ComparisonColumn[] = [
  { key: 'mode', label: 'Mode' },
  { key: 'provider', label: 'Provider' },
  { key: 'departure', label: 'Departure', sortable: true },
  { key: 'arrival', label: 'Arrival' },
  { key: 'duration', label: 'Duration', sortable: true, tabular: true },
  { key: 'transfers', label: 'Transfers', tabular: true },
  { key: 'price', label: 'Price', align: 'right', sortable: true, tabular: true },
];

const SORT_KEYS: Record<string, string> = { departure: 'departure', duration: 'duration', price: 'price' };

interface Props {
  trip: Trip;
  params: URLSearchParams;
  setParam: (key: string, value: string | null) => void;
  /** A transport option was saved to the trip. */
  onSelected?: () => void;
  /** The start place was changed: it is saved on the trip. */
  onTripState: (state: TripState) => void;
  /** The transport option already chosen for the trip, marked in the list. */
  chosenTransport?: { mode: string; operator: string | null; departureAt: string | null } | null;
  /** Open the flight booking for the option just chosen. */
  onBook?: () => void;
  /** The trip already has a booked flight: no other flight can be booked. */
  flightBooked?: boolean;
}

/** Transport tab: real timetables where the feeds have them, labelled estimates for prices. Compared only, never booked. */
export function TransportTab({ trip, params, setParam, onSelected, onTripState, chosenTransport, onBook, flightBooked = false }: Props) {
  const modes = (params.get('modes') ?? DEFAULT_MODES.join(',')).split(',').filter(Boolean);
  const sort = params.get('tsort') ?? 'recommended';
  const dir = (params.get('tdir') as 'asc' | 'desc' | null) ?? (sort === 'recommended' ? 'desc' : 'asc');
  const date = params.get('tdate') ?? trip.startDate ?? '';

  // Where the journey starts: a country and optionally a city from the provider's lists, saved on the trip so they are still shown
  // when the traveler comes back. `from` is what the search receives. The destination is the trip's.
  const fromCountry = trip.originCountry ?? '';
  const fromCity = trip.originCity ?? '';
  const from = fromCountry ? (fromCity ? `${fromCity}, ${fromCountry}` : fromCountry) : '';
  const [countryList, setCountryList] = useState<Country[]>([]);
  const [cityList, setCityList] = useState<string[]>([]);
  useEffect(() => {
    void getCountries().then(setCountryList).catch(() => setCountryList([]));
  }, []);
  const [startError, setStartError] = useState<string | null>(null);
  const chooseStart = async (country: string, city: string) => {
    setStartError(null);
    try {
      onTripState(await patchTrip(trip.id, { originCountry: country || null, originCity: city || null }));
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : 'Could not save the start place.');
    }
  };
  const fromCode = countryList.find((c) => c.name === fromCountry)?.code ?? null;
  useEffect(() => {
    setCityList([]);
    if (fromCode) void getCities(fromCode).then(setCityList).catch(() => setCityList([]));
  }, [fromCode]);
  const [data, setData] = useState<TransportSearch | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'idle'>(from ? 'loading' : 'idle');
  const [error, setError] = useState('We could not load transport options.');
  const [picked, setPicked] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!from) {
      setState('idle');
      return;
    }
    setState('loading');
    const q: Record<string, string> = { from, modes: modes.join(','), sort, dir };
    if (date) q['date'] = date;
    try {
      setData(await searchTransport(trip.id, q));
      setState('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not load transport options.');
      setState('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, from, modes.join(','), sort, dir, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleMode = (key: string) => {
    const next = modes.includes(key) ? modes.filter((m) => m !== key) : [...modes, key];
    setParam('modes', next.length > 0 ? next.join(',') : null);
  };

  const onSort = (key: string) => {
    const k = SORT_KEYS[key];
    if (!k) return;
    setParam('tsort', k);
    setParam('tdir', k === sort ? (dir === 'asc' ? 'desc' : 'asc') : 'asc');
  };

  const choose = async (row: TransportRow): Promise<boolean> => {
    setPickError(null);
    try {
      await selectTransport(trip.id, row.optionId);
      setPicked(row.optionId);
      onSelected?.();
      return true;
    } catch (err) {
      setPickError(err instanceof ApiError ? err.message : 'We could not save that option.');
      return false;
    }
  };
  // "Book this flight" on a row: the flight is chosen for the trip first, then the booking opens for it.
  const bookRow = async (row: TransportRow): Promise<void> => {
    if (await choose(row)) onBook?.();
  };

  // The same flight or service is recognised after a new search: same mode, operator and departure time (offer ids change every search).
  const isChosen = (r: TransportRow): boolean =>
    picked === r.optionId ||
    (chosenTransport !== null &&
      chosenTransport !== undefined &&
      chosenTransport.mode === r.mode &&
      (chosenTransport.operator ?? null) === (r.provider ?? null) &&
      chosenTransport.departureAt !== null &&
      r.departure !== null &&
      r.departure.slice(0, 16) === chosenTransport.departureAt);

  const na = <CertaintyBadge certainty="unavailable" />;
  const rows = (data?.items ?? []).map((r) => ({
    mode: (
      <div className="flex flex-col items-start gap-1">
        <span className="font-medium">{r.modeLabel}</span>
        {r.price.amount !== null || r.durationMinutes !== null ? (
          <button type="button" onClick={() => void choose(r)} className="cursor-pointer border-0 bg-transparent p-0 font-sans text-xs text-accent">
            {isChosen(r) ? '✓ Selected for this trip' : 'Select'}
          </button>
        ) : null}
      </div>
    ),
    provider: r.provider ?? (r.note ? <span className="text-xs text-text-secondary">{r.note}</span> : '—'),
    departure: r.departure ? `${formatClock(r.departure, r.departureTz)}` : na,
    arrival: r.arrival ? `${formatClock(r.arrival, r.arrivalTz)}` : na,
    duration:
      r.durationMinutes !== null ? (
        <span className="inline-flex flex-col gap-1">
          <span>{formatDuration(r.durationMinutes)}</span>
          {r.durationCertainty === 'estimated' && <CertaintyBadge certainty="estimated" />}
        </span>
      ) : (
        na
      ),
    transfers: r.transfers ?? '—',
    price: (
      <div className="flex flex-col items-end gap-2">
        <PriceCell price={r.price} sandbox={r.priceSource === 'duffel-sandbox'} />
        {onBook && !flightBooked && r.priceSource === 'duffel-sandbox' && r.providerRef && <Button onClick={() => void bookRow(r)}>Book this flight</Button>}
      </div>
    ),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 md:gap-4">
        <Select
          label="Start country *"
          value={fromCountry}
          options={['', ...(fromCountry && !countryList.some((c) => c.name === fromCountry) ? [fromCountry] : []), ...countryList.map((c) => c.name)]}
          labels={{ '': 'Select a country' }}
          onChange={(e) => void chooseStart(e.target.value, '')}
        />
        <Select
          label="Start city"
          value={fromCity}
          options={['', ...(fromCity && !cityList.includes(fromCity) ? [fromCity] : []), ...cityList]}
          labels={{ '': fromCountry ? 'Whole country (no city)' : 'Select a country first' }}
          onChange={(e) => void chooseStart(fromCountry, e.target.value)}
        />
        <Input label="Date" type="date" value={date} onChange={(e) => setParam('tdate', e.target.value || null)} />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Transport modes">
        {TRANSPORT_MODES.map((m) => {
          const on = modes.includes(m.key);
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggleMode(m.key)}
              className={`cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 font-sans text-chip ${on ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text-secondary'}`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <AsyncBoundary
        state={state === 'idle' ? 'empty' : state === 'ready' && data && data.items.length === 0 ? 'empty' : state}
        emptyMessage={state === 'idle' ? 'Where does your journey begin? Choose your start country (and city) and we will line up the best ways to get there.' : 'No transport options for these modes.'}
        errorMessage={error}
        onRetry={() => void load()}
        loading={<SkeletonRows count={5} />}
      >
        {data && (
          <>
            {data.notes.map((n) => (
              <p key={n} className="m-0 font-sans text-sm text-text-secondary">
                {n}
              </p>
            ))}
            {pickError && (
              <p role="alert" className="m-0 font-sans text-sm text-danger">
                {pickError}
              </p>
            )}
            <ComparisonTable columns={COLUMNS} rows={rows} sortKey={SORT_KEYS[sort] ? sort : undefined} sortDir={dir} onSort={onSort} />
            <p className="m-0 font-sans text-xs text-text-muted">
              Transport is compared only: Faro does not book flights, trains or buses. {data.origin ? `${data.origin} to ${data.destination}, about ${data.distanceKm} km in a straight line, on ${formatDate(data.date)}. ` : ''}Times are the published
              timetable in local time. Prices marked Estimated come from a distance-based model, not a quote. Timetables from{' '}
              <a href="https://transitous.org/sources/" target="_blank" rel="noopener noreferrer" className="text-accent">
                Transitous
              </a>
              .
            </p>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
