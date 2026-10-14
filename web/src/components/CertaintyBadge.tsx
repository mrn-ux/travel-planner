import type { Certainty } from '../lib/types';
import { StatusBadge } from './ds/StatusBadge';

/** The one way certainty is shown anywhere: a glyph plus the word Confirmed, Estimated or Unavailable. */
export function CertaintyBadge({ certainty }: { certainty: Certainty }) {
  return <StatusBadge status={certainty} />;
}
