import type { ReactNode } from 'react';

export interface ItineraryItemView {
  /** Start time, for example "14:17". */
  time?: string;
  /** Certainty badge for the cost (never shown without one when there is a cost). */
  badge?: ReactNode;
  /** Removes the item from the plan. */
  onRemove?: () => void;
  title: string;
  /** Preformatted, for example "1h 30m". */
  duration: string;
  /** Preformatted money, for example "USD 6.00", or an em dash when the cost is unavailable. */
  cost: string;
  hours?: string;
  /** Preformatted travel time to the next stop, for example "15m". */
  travelTime?: string;
}

function Segment({ label, items }: { label: string; items?: ItineraryItemView[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-text-secondary">{label}</div>
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between gap-3">
            <div className="text-sm text-text">
              {item.time && <span className="tabular mr-2 text-text-secondary">{item.time}</span>}
              {item.title}
              {item.onRemove && (
                <button type="button" onClick={item.onRemove} aria-label={`Remove ${item.title}`} className="ml-2 cursor-pointer border-0 bg-transparent p-0 font-sans text-xs text-text-muted">
                  Remove
                </button>
              )}
            </div>
            <div className="tabular flex items-center gap-2 whitespace-nowrap text-sm text-text-secondary">
              {item.duration} · {item.cost}
              {item.badge}
            </div>
          </div>
          {item.hours && <div className="mt-px text-xs text-text-muted">{item.hours}</div>}
          {item.travelTime && (
            <div className="mt-2 border-l border-border pl-2 text-xs text-text-muted">{item.travelTime} to next stop</div>
          )}
        </div>
      ))}
    </div>
  );
}

interface DayItineraryCardProps {
  day: number;
  /** Preformatted date, for example "18 Nov 2026". */
  date?: string;
  morning?: ItineraryItemView[];
  afternoon?: ItineraryItemView[];
  evening?: ItineraryItemView[];
  /** A note for the day, for example "Arrival day". */
  note?: string;
}

export function DayItineraryCard({ day, date, morning, afternoon, evening, note }: DayItineraryCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6 font-sans shadow-raised">
      <div className="font-display text-lg font-semibold text-text">
        Day {day}
        {date ? ` · ${date}` : ''}
      </div>
      {note && <div className="text-xs text-text-muted">{note}</div>}
      <Segment label="Morning" items={morning} />
      <Segment label="Afternoon" items={afternoon} />
      <Segment label="Evening" items={evening} />
    </div>
  );
}
