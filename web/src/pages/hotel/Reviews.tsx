import { formatDate } from '../../lib/format';
import type { HotelDetails } from '../../lib/comparison';

/** Provider-sourced text is always set apart (quoted, italic, ruled) and labelled, never styled as Faro's own words. */
export function ProviderQuote({ text, label }: { text: string; label: string }) {
  return (
    <blockquote className="m-0 border-0 border-l-2 border-solid border-border-strong pl-4 font-sans text-sm italic text-text-secondary">
      &ldquo;{text}&rdquo;
      <div className="mt-1 text-xs not-italic text-text-muted">{label}</div>
    </blockquote>
  );
}

export function Reviews({ reviews, note }: { reviews: HotelDetails['reviews']; note: string | null }) {
  if (reviews === null) return <p className="m-0 font-sans text-sm text-text-secondary">{note ?? 'Reviews are not available right now.'}</p>;
  if (reviews.length === 0) return <p className="m-0 font-sans text-sm text-text-secondary">No reviews yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      {reviews.slice(0, 5).map((r) => {
        const text = [r.headline, r.pros, r.cons ? `Not so good: ${r.cons}` : null].filter(Boolean).join('. ');
        if (!text) return null;
        const when = r.date ? formatDate(r.date.slice(0, 10)) : null;
        return <ProviderQuote key={r.id} text={text} label={`Guest review${r.score ? ` · ${r.score}/10` : ''}${when && when !== '—' ? ` · ${when}` : ''}`} />;
      })}
    </div>
  );
}
