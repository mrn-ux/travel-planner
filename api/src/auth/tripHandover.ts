// Hand-over of a visitor's draft trip to the account that just signed in or signed up.
// Plan 003 (trips) registers the real handler; until then this does nothing, so authentication works alone.

type ClaimHandler = (tripKey: string, userId: string) => Promise<void>;

let handler: ClaimHandler | undefined;

export function setTripClaimHandler(fn: ClaimHandler): void {
  handler = fn;
}

/** Attach the draft trip identified by tripKey to the user. Never throws: sign-in must not fail because of it. */
export async function claimDraftTrip(tripKey: string | undefined, userId: string): Promise<void> {
  if (!tripKey || !handler) return;
  try {
    await handler(tripKey, userId);
  } catch (err) {
    console.warn('Could not hand over the draft trip:', err instanceof Error ? err.message : err);
  }
}
