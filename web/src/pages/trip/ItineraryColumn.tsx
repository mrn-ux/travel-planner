import { CertaintyBadge } from '../../components/CertaintyBadge';
import { Button } from '../../components/ds/Button';
import { DayItineraryCard, type ItineraryItemView } from '../../components/ds/DayItineraryCard';
import { EmptyState } from '../../components/ds/EmptyState';
import { EM_DASH, formatDate, formatDuration, formatMoney } from '../../lib/format';
import type { Plan, PlanItem } from '../../lib/plan';

interface Props {
  plan: Plan;
  /** The itinerary is being built (it is built on its own when the plan opens). */
  generating: boolean;
  /** The automatic build failed. */
  failed: boolean;
  onRetry: () => void;
  onRemove: (itemId: number) => void;
}

function view(item: PlanItem, onRemove: (id: number) => void): ItineraryItemView {
  const activity = item.kind === 'activity';
  return {
    time: item.startsAt ?? undefined,
    title: item.title,
    duration: formatDuration(item.durationMinutes),
    cost: activity && item.cost.amount ? formatMoney(item.cost.amount, item.cost.currency) : EM_DASH,
    // A cost is never shown without its certainty label; an unknown fee says "Unavailable".
    badge: activity ? <CertaintyBadge certainty={item.cost.certainty} /> : undefined,
    hours: activity ? (item.openingHours ? `Open ${item.openingHours}` : 'Opening hours not stated: check before you go') : undefined,
    travelTime: item.travelMinutesToNext !== null ? formatDuration(item.travelMinutesToNext) : undefined,
    onRemove: activity ? () => onRemove(item.id) : undefined,
  };
}

/** One Day itinerary card per day, in date order, split into Morning, Afternoon and Evening. */
export function ItineraryColumn({ plan, generating, failed, onRetry, onRemove }: Props) {
  const canGenerate = Boolean(plan.trip.destination && plan.trip.startDate && plan.trip.endDate);

  if (plan.itinerary.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <EmptyState
          message={
            !canGenerate
              ? 'No itinerary yet: choose a destination and dates.'
              : generating
                ? 'Building your itinerary from the places you chose, using only places that are open and reachable in time...'
                : failed
                  ? 'The itinerary could not be built this time.'
                  : plan.notes && plan.notes.length > 0
                    ? plan.notes.join(' ')
                    : 'None of the places you chose could be scheduled: their opening hours are not stated, and Faro never guesses when something is open.'
          }
        />
        {failed && !generating && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {plan.itinerary.map((d) => (
        <DayItineraryCard
          key={d.day}
          day={d.day}
          date={formatDate(d.date)}
          note={d.note ?? undefined}
          morning={d.items.filter((i) => i.slot === 'morning').map((i) => view(i, onRemove))}
          afternoon={d.items.filter((i) => i.slot === 'afternoon').map((i) => view(i, onRemove))}
          evening={d.items.filter((i) => i.slot === 'evening').map((i) => view(i, onRemove))}
        />
      ))}
      <div className="flex flex-col gap-2 font-sans text-xs text-text-muted">
        <span>Visit lengths and travel times are estimates. Attractions and opening hours: © OpenStreetMap contributors (ODbL). Places that do not state their opening hours are marked: check them before you go.</span>
      </div>
    </div>
  );
}
