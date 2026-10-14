import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LODGING_IMAGES, VEHICLE_IMAGES } from '../../lib/destinationPhoto';
import { usePageImages } from '../../lib/usePageImages';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { ApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { getTrip, getTripId, MISSING_LABELS, type Trip, type TripState } from '../../lib/trip';
import { PageHero } from '../../components/PageHero';
import { ComparisonBand } from './ComparisonBand';
import { RecommendationBand } from './RecommendationBand';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 18-26 Nov 2026 when both dates share a month, 30 Apr - 3 May 2027 within a year, otherwise two full dates. */
function dateRange(start: string, end: string): string {
  const s = /^(\d{4})-(\d{2})-(\d{2})/.exec(start);
  const e = /^(\d{4})-(\d{2})-(\d{2})/.exec(end);
  if (!s || !e) return `${formatDate(start)} to ${formatDate(end)}`;
  const sameYear = s[1] === e[1];
  const sameMonth = sameYear && s[2] === e[2];
  const month = (m: RegExpExecArray) => MONTHS[Number(m[2]) - 1] ?? '';
  if (sameMonth) return `${Number(s[3])}–${Number(e[3])} ${month(e)} ${e[1]}`;
  if (sameYear) return `${Number(s[3])} ${month(s)} – ${Number(e[3])} ${month(e)} ${e[1]}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function pillsFor(trip: Trip): string[] {
  const pills: string[] = [];
  pills.push(trip.destination ?? 'Destination open');
  if (trip.startDate && trip.endDate) pills.push(dateRange(trip.startDate, trip.endDate));
  else if (trip.startDate) pills.push(`From ${formatDate(trip.startDate)}`);
  else if (trip.dateWindowText) pills.push(trip.dateWindowText);
  else if (trip.durationDays) pills.push(`${trip.durationDays} days`);
  if (trip.adults) {
    const kids = trip.childrenAges.length;
    pills.push(`${trip.adults} adult${trip.adults === 1 ? '' : 's'}${kids > 0 ? `, ${kids} ${kids === 1 ? 'child' : 'children'}` : ''}`);
  }
  return pills;
}

/** /search: header, destination recommendations while there is no destination, then the Hotels / Transport band. */
export default function SearchPage() {
  const navigate = useNavigate();
  const [load, setLoad] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [errorText, setErrorText] = useState('We could not open your trip.');
  // Hotels tab: places to stay. Transport tab: ways to travel. Places tab: the chosen country.
  const [searchParams] = useSearchParams();
  const tabName = searchParams.get('tab');
  const tabImages = usePageImages(tabName === 'transport' ? VEHICLE_IMAGES : tabName === 'places' ? null : LODGING_IMAGES);
  const [state, setState] = useState<TripState | null>(null);

  const open = useCallback(async () => {
    const id = getTripId();
    if (!id) {
      setLoad('empty');
      return;
    }
    setLoad('loading');
    try {
      setState(await getTrip(id));
      setLoad('ready');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setLoad('empty');
        return;
      }
      setErrorText(err instanceof ApiError ? err.message : 'We could not open your trip.');
      setLoad('error');
    }
  }, []);

  useEffect(() => {
    void open();
  }, [open]);

  const trip = state?.trip ?? null;
  const missing = state?.missing ?? [];
  const goChat = () => navigate(trip ? `/?tripId=${encodeURIComponent(trip.id)}` : '/');

  const needsDetails = trip !== null && missing.length > 0;
  const body: 'loading' | 'empty' | 'error' | 'ready' = load === 'ready' && needsDetails ? 'empty' : load;
  const emptyMessage = needsDetails
    ? `Tell Faro ${missing.map((m) => MISSING_LABELS[m]).join(', ')} first, then the results appear here.`
    : 'Start a trip in the chat to see results.';

  return (
    <div className="flex flex-col gap-8">
      {trip && trip.destination && <PageHero title={trip.destination} subtitle={pillsFor(trip).slice(1).join('  \u00b7  ')} photoOf={tabImages.length > 0 ? tabImages : [trip.destinationCity, trip.destinationCountry, trip.destination].filter((x): x is string => Boolean(x))} />}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="m-0 font-display text-xl font-semibold text-text">Search results</h1>
        {trip && (
          <div className="flex flex-wrap gap-2">
            {pillsFor(trip).map((p) => (
              <button
                key={p}
                type="button"
                onClick={goChat}
                className="cursor-pointer rounded-full border border-border bg-surface px-3 py-1 font-sans text-chip text-text-secondary"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <AsyncBoundary state={body} emptyMessage={emptyMessage} errorMessage={errorText} onRetry={() => void open()}>
        {trip && !trip.destination && <RecommendationBand trip={trip} onChosen={(t) => setState((s) => (s ? { ...s, trip: t } : s))} />}

        {trip && trip.destination && <ComparisonBand trip={trip} onTripState={setState} />}
      </AsyncBoundary>
    </div>
  );
}
