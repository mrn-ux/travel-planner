import { CertaintyBadge } from '../../components/CertaintyBadge';
import { Card } from '../../components/ds/Card';
import { formatDate } from '../../lib/format';
import type { ResultCard } from '../../lib/trip';

/**
 * Structured results from the agent's tools, shown as cards beneath the message (never as text inside it).
 * Each card carries its certainty, its source and when it was fetched.
 */
export function ResultCards({ cards }: { cards: ResultCard[] }) {
  return (
    <>
      {cards.map((c, i) => (
        <Card key={i} title={c.title} compact>
          <div className="flex flex-col gap-2 text-sm text-text">
            {c.lines.map((line, j) => (
              <div key={j}>{line}</div>
            ))}
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <CertaintyBadge certainty={c.certainty} />
              {c.sandbox && <span>Sandbox</span>}
              <span>
                Source:{' '}
                {c.source_url ? (
                  <a href={c.source_url} target="_blank" rel="noreferrer">
                    {c.source}
                  </a>
                ) : (
                  c.source
                )}
              </span>
              <span>Fetched {formatDate(c.fetched_at)}</span>
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}
