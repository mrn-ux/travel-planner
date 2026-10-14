// Spotting "we are travelling with children" in what the traveler wrote, so the agent can ask for their ages. Ages are needed for hotel
// occupancy and prices, and a child count alone cannot be saved (the brief stores one age per child).

const WORDS: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const POSITIVE = /\b(\d{1,2}|a|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:small\s+|young\s+|little\s+)?(?:kids?|children|child|toddlers?|babies|baby|teens?|teenagers?)\b/i;
const WITH_KIDS = /\bwith\s+(?:my\s+|our\s+|the\s+)?(?:kids|children|family)\b/i;
const NEGATIVE = /\b(?:no|without|zero|0)\s+(?:kids|children)\b|\bnot\s+(?:bringing|taking|travel+ing\s+with)\s+(?:any\s+)?(?:kids|children)\b/i;

export interface ChildrenMention {
  mentioned: boolean;
  /** The number they gave, when they gave one. */
  count: number | null;
}

/** Looks at the traveler's messages newest first: the latest one that says anything about children decides. */
export function childrenMention(userTexts: string[]): ChildrenMention {
  for (let i = userTexts.length - 1; i >= 0; i--) {
    const t = userTexts[i] ?? '';
    if (NEGATIVE.test(t)) return { mentioned: false, count: 0 };
    const m = POSITIVE.exec(t);
    if (m) {
      const raw = (m[1] ?? '').toLowerCase();
      const n = /^\d+$/.test(raw) ? Number(raw) : (WORDS[raw] ?? null);
      return { mentioned: true, count: n };
    }
    if (WITH_KIDS.test(t) && /kids|children/i.test(t)) return { mentioned: true, count: null };
  }
  return { mentioned: false, count: null };
}
