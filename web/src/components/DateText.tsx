import { formatDate } from '../lib/format';

/** An ISO date shown as "18 Nov 2026" with tabular figures. */
export function DateText({ iso }: { iso: string | null | undefined }) {
  return <span className="tabular">{formatDate(iso)}</span>;
}
