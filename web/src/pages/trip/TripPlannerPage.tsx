import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { SkeletonCard } from '../../components/Skeleton';
import { Button } from '../../components/ds/Button';
import { ApiError } from '../../lib/api';
import { usePlanDownload } from '../../lib/download';
import { setTripId } from '../../lib/session';
import { formatDateRange } from '../../lib/format';
import { getSelectedPlaces } from '../../lib/places';
import { applyProposals, generatePlan, getPlan, removeItem, type Plan } from '../../lib/plan';
import { PageHero } from '../../components/PageHero';
import { BudgetColumn } from './BudgetColumn';
import { ItineraryColumn } from './ItineraryColumn';
import { OverBudgetBanner } from './OverBudgetBanner';
import { SelectedLists } from './SelectedLists';

/** /trip/:tripId (UI-SPEC 2.5): header, over-budget banner while over budget, then itinerary beside a 320 px budget column. */
export default function TripPlannerPage() {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState('We could not load your plan.');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const download = usePlanDownload(tripId);
  // The plan opens only once at least one place to visit has been chosen (null while that is being checked).
  const [placeCount, setPlaceCount] = useState<number | null>(null);
  useEffect(() => {
    setPlaceCount(null);
    void getSelectedPlaces(tripId).then((p) => setPlaceCount(p.length)).catch(() => setPlaceCount(-1));
  }, [tripId]);

  const load = useCallback(async () => {
    setState((s) => (s === 'ready' ? s : 'loading')); // a retry keeps the last plan visible
    try {
      setPlan(await getPlan(tripId));
      setState('ready');
      setError('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setState('empty');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'We could not load your plan.');
      setState((s) => (s === 'ready' ? s : 'error'));
      if (plan) setActionError(err instanceof ApiError ? err.message : 'We could not refresh your plan.');
    }
  }, [tripId, plan]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const act = async (fn: () => Promise<Plan>): Promise<boolean> => {
    setBusy(true);
    setActionError(null);
    try {
      setPlan(await fn());
      return true;
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That did not work. Your plan is unchanged.');
      // The suggestions may have changed under us: reload the plan.
      if (err instanceof ApiError && err.status === 409) void load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  // The itinerary is built when the plan is opened: when there is none yet, or when the chosen places changed since it was built.
  // (Edits made to an itinerary are kept while the chosen places stay the same.)
  const tried = useRef<string | null>(null);
  const [genFailed, setGenFailed] = useState(false);
  const planned = plan !== null && placeCount !== null && placeCount > 0 ? plan : null;
  useEffect(() => {
    if (!planned || busy) return;
    const canGenerate = Boolean(planned.trip.destination && planned.trip.startDate && planned.trip.endDate);
    // The version changes when the way itineraries are built changes, so an older itinerary is rebuilt once.
    const sig = `v2:${planned.selectedPlaces.map((p) => p.id).sort().join('|')}`;
    const noActivities = planned.selectedPlaces.length > 0 && !planned.itinerary.some((d) => d.items.some((i) => i.kind === 'activity'));
    const key = `faro.itinerarySig.${tripId}`;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(key);
    } catch {
      /* storage unavailable: treated as never generated */
    }
    if (!canGenerate || (planned.itinerary.length > 0 && stored === sig && !noActivities) || tried.current === `${tripId}:${sig}`) return;
    tried.current = `${tripId}:${sig}`;
    setGenFailed(false);
    void act(() => generatePlan(tripId)).then((ok) => {
      setGenFailed(!ok);
      if (!ok) return;
      try {
        localStorage.setItem(key, sig);
      } catch {
        /* ignore */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planned, busy, tripId]);

  const title = plan ? `${plan.trip.destination ?? 'Your trip'}${plan.trip.startDate && plan.trip.endDate ? ` · ${formatDateRange(plan.trip.startDate, plan.trip.endDate)}` : ''}` : 'Trip planner';
  const incomplete = plan !== null && (plan.selectedHotel === null || plan.selectedTransport === null);

  if (placeCount === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="m-0 font-display text-xl font-semibold text-text">Choose places to visit first</h1>
        <p className="m-0 max-w-booking font-sans text-sm text-text-secondary">
          Your trip plan opens once you have chosen at least one place to visit. Pick the places you want to see, then come back here.
        </p>
        <div>
          <Button
            onClick={() => {
              setTripId(tripId);
              navigate('/search?tab=places');
            }}
          >
            Choose places to visit
          </Button>
        </div>
      </div>
    );
  }
  if (placeCount === null) return <AsyncBoundary state="loading" />;

  return (
    <div className="flex flex-col gap-6">
      {plan && plan.trip.destination && (
        <PageHero
          title={plan.trip.destination}
          subtitle={`${plan.trip.startDate && plan.trip.endDate ? `${formatDateRange(plan.trip.startDate, plan.trip.endDate)}. ` : ''}Your adventure, day by day. Pack light, dream big.`}
          photoOf={[plan.trip.destination.split(',')[0] ?? plan.trip.destination, plan.trip.destination]}
        />
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="m-0 font-display text-xl font-semibold text-text">{title}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void download.start()} disabled={download.state === 'preparing'}>
            {download.state === 'preparing' ? 'Preparing your plan' : 'Download'}
          </Button>
        </div>
      </div>

      {download.state === 'error' && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-danger bg-danger/10 px-4 py-3 font-sans text-sm text-danger">
          <span>{download.error}</span>
          <Button variant="secondary" onClick={() => void download.start()}>
            Retry
          </Button>
        </div>
      )}

      <AsyncBoundary
        state={state}
        emptyMessage="This trip could not be found. Start one from the home page."
        errorMessage={error}
        onRetry={() => void load()}
        loading={
          <div className="grid grid-cols-1 gap-4 md:grid-cols-planner">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        }
      >
        {plan && (
          <>
            {actionError && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-danger bg-danger/10 px-4 py-3 font-sans text-sm text-danger">
                <span>{actionError}</span>
                <Button variant="secondary" onClick={() => void load()}>
                  Retry
                </Button>
              </div>
            )}
            <OverBudgetBanner key={plan.proposals.map((p) => p.id).join('-')} plan={plan} busy={busy} error={null} onApply={(ids) => void act(() => applyProposals(tripId, ids))} />
            {incomplete && <p className="m-0 font-sans text-sm text-text-secondary">Select a hotel and transport to complete your budget.</p>}
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-planner">
              <ItineraryColumn plan={plan} generating={busy} failed={genFailed} onRetry={() => { tried.current = null; setGenFailed(false); void act(() => generatePlan(tripId)).then((ok) => setGenFailed(!ok)); }} onRemove={(id) => void act(() => removeItem(tripId, id))} />
              <div className="flex flex-col gap-4">
                <BudgetColumn plan={plan} />
                <SelectedLists plan={plan} />
              </div>
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
