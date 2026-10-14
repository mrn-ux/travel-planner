import { useCallback, useEffect, useRef, useState } from 'react';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { CertaintyBadge } from '../../components/CertaintyBadge';
import { SkeletonCard } from '../../components/Skeleton';
import { Button } from '../../components/ds/Button';
import { DestinationCard } from '../../components/ds/DestinationCard';
import { ApiError } from '../../lib/api';
import { chooseDestination, getRecommendations, refreshRecommendations, type Factor, type Reason, type Recommendation, type RecommendationsView } from '../../lib/recommendations';
import type { Trip } from '../../lib/trip';

const POLL_MS = 2000;
const GIVE_UP_MS = 90_000;

const SOURCE_NAMES: Record<string, string> = {
  wikivoyage: 'Wikivoyage',
  wikipedia: 'Wikipedia',
  wikidata: 'Wikidata',
  'open-meteo': 'Open-Meteo',
  'govuk-fcdo': 'GOV.UK FCDO',
};

const FACTOR_NAMES: Record<Factor, string> = { budget: 'budget', season: 'season', activities: 'activities', transport: 'transport', safety: 'safety' };

const GUIDE_SOURCES = new Set(['wikivoyage', 'wikipedia']);

function ReasonLine({ reason }: { reason: Reason }) {
  const guide = GUIDE_SOURCES.has(reason.source);
  return (
    <div className="flex flex-col gap-1">
      <span>{reason.text}</span>
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <CertaintyBadge certainty={reason.certainty} />
        {reason.source_url && (
          <a href={reason.source_url} target="_blank" rel="noopener noreferrer" className="text-accent" title={reason.attribution}>
            {SOURCE_NAMES[reason.source] ?? reason.source}
          </a>
        )}
        {guide && <span className="text-text-muted">CC BY-SA 4.0</span>}
      </span>
    </div>
  );
}

function rankNote(r: Recommendation, refining: boolean): string | undefined {
  if (r.previousRank !== undefined && r.previousRank !== r.rank) {
    return r.previousRank > r.rank ? `Moved up from ${r.previousRank} after reading the guides` : `Moved down from ${r.previousRank} after reading the guides`;
  }
  if (refining && r.completeness === 'quick') return 'Refining...';
  return undefined;
}

interface RecommendationBandProps {
  trip: Trip;
  /** Called with the updated trip after a destination is chosen. */
  onChosen: (trip: Trip) => void;
}

/** Ranked destination suggestions for a trip with no destination (UI-SPEC 2.4). */
export function RecommendationBand({ trip, onChosen }: RecommendationBandProps) {
  const [view, setView] = useState<RecommendationsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const v = await getRecommendations(trip.id);
      if (!alive.current) return;
      setView(v);
      setError(null);
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof ApiError ? err.message : 'We could not load destination suggestions.');
    }
  }, [trip.id]);

  useEffect(() => {
    alive.current = true;
    startedAt.current = Date.now();
    setGaveUp(false);
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  // Poll while the list is being made or refined, for at most 90 seconds.
  const waiting = view === null ? error === null : view.status === 'loading' || view.refining;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        setGaveUp(true);
        clearInterval(timer);
        return;
      }
      void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  const viewAlternatives = async () => {
    if (!view) return;
    setBusy(true);
    try {
      startedAt.current = Date.now();
      setGaveUp(false);
      setView(await refreshRecommendations(trip.id, view.recommendations.map((r) => r.destination)));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not load other suggestions.');
    } finally {
      setBusy(false);
    }
  };

  const choose = async (r: Recommendation) => {
    setBusy(true);
    setChoiceError(null);
    try {
      const res = await chooseDestination(trip.id, r.destination);
      onChosen(res.trip);
    } catch (err) {
      setChoiceError(err instanceof ApiError ? err.message : `We could not set ${r.destination} as the destination.`);
      setBusy(false);
    }
  };

  const state = error !== null && view === null ? 'error' : view === null || view.status === 'loading' ? 'loading' : view.status === 'insufficient' ? 'empty' : 'ready';
  const emptyMessage = view?.insufficient
    ? `No destinations fit this trip yet: ${view.insufficient.limitingFactor}. ${view.insufficient.found} found. Try changing the dates, interests or budget.`
    : undefined;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="recommended-heading">
      <h2 id="recommended-heading" className="font-display text-lg font-semibold text-text">
        Recommended destinations
      </h2>

      <AsyncBoundary
        state={state}
        emptyMessage={emptyMessage}
        errorMessage={error ?? undefined}
        onRetry={() => void load()}
        loading={
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        }
      >
        {view && (
          <>
            {view.refining && !gaveUp && (
              <p role="status" className="m-0 font-sans text-sm text-text-secondary">
                Refining... a first ranking is shown while Faro reads the destination guides.
              </p>
            )}
            {view.refining && gaveUp && <p className="m-0 font-sans text-sm text-text-secondary">Refining is taking longer than expected. The ranking shown is the first one.</p>}
            {view.limited && !view.refining && <p className="m-0 font-sans text-sm text-text-secondary">Based on limited data: the destination guides could not be read, so the ranking uses weather and safety only.</p>}
            {view.note && <p className="m-0 font-sans text-sm text-text-secondary">{view.note}</p>}
            {error && (
              <p role="alert" className="m-0 font-sans text-sm text-danger">
                {error}
              </p>
            )}
            {choiceError && (
              <p role="alert" className="m-0 font-sans text-sm text-danger">
                {choiceError}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {view.recommendations.map((r) => {
                const assessed = r.reasons.filter((x) => x.certainty !== 'unavailable');
                const notAssessed = r.reasons.filter((x) => x.certainty === 'unavailable').map((x) => FACTOR_NAMES[x.factor]);
                const reasons = [
                  ...assessed.map((x) => <ReasonLine key={x.factor} reason={x} />),
                  ...(notAssessed.length > 0 ? [<span key="na">Could not be assessed yet: {notAssessed.join(', ')}.</span>] : []),
                ];
                return <DestinationCard key={r.destination} rank={r.rank} name={r.countryCode ? `${r.destination}, ${r.countryCode}` : r.destination} reasons={reasons} score={r.score} note={rankNote(r, view.refining)} onSelect={() => void choose(r)} disabled={busy} />;
              })}
            </div>

            <p className="m-0 font-sans text-xs text-text-muted">
              Weather data by Open-Meteo.com (CC BY 4.0). Travel advice from the UK FCDO under the Open Government Licence v3.0. Guide text from Wikivoyage and Wikipedia under CC BY-SA 4.0.
            </p>

            <div>
              <Button variant="secondary" onClick={() => void viewAlternatives()} disabled={busy}>
                View alternatives
              </Button>
            </div>
          </>
        )}
      </AsyncBoundary>
    </section>
  );
}
