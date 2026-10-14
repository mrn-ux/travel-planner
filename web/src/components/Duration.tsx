import { formatDuration } from '../lib/format';

/** Minutes shown as "2h 15m" with tabular figures. */
export function Duration({ minutes }: { minutes: number | null | undefined }) {
  return <span className="tabular">{formatDuration(minutes)}</span>;
}
