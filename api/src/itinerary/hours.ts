import { query } from '../db.js';

/**
 * A small parser for the common forms of OpenStreetMap `opening_hours`:
 *   "24/7"   "Mo-Fr 09:00-17:00; Sa 10:00-14:00; Su off"   "Tu-Su 10:00-12:30,14:00-18:00"   "PH off"
 * Anything it does not fully understand (sunrise/sunset, months, week numbers, hours past midnight, comments) returns null,
 * and an attraction with unparseable hours is never scheduled: the itinerary must not guess when something is open.
 */

export interface DayRule {
  /** 0 = Monday ... 6 = Sunday. */
  days: number[];
  /** Minutes from midnight; empty with off = closed. */
  ranges: Array<[number, number]>;
  off: boolean;
  /** true for a "PH ..." rule: applies on public holidays only. */
  holiday: boolean;
}

export type ParsedHours = { always: true } | { always: false; rules: DayRule[] };

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function parseDays(spec: string): number[] | 'PH' | null {
  if (spec === 'PH') return 'PH';
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const m = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/.exec(part.trim());
    if (!m) return null;
    const a = DAYS.indexOf(m[1]!);
    const b = m[2] ? DAYS.indexOf(m[2]) : a;
    for (let d = a; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === b) break;
    }
  }
  return [...out];
}

function parseRanges(spec: string): Array<[number, number]> | null {
  const ranges: Array<[number, number]> = [];
  for (const part of spec.split(',')) {
    const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(part.trim());
    if (!m) return null;
    const start = Number(m[1]) * 60 + Number(m[2]);
    const end = Number(m[3]) * 60 + Number(m[4]);
    if (start >= end || end > 24 * 60 || Number(m[2]) > 59 || Number(m[4]) > 59) return null; // past midnight: not supported
    ranges.push([start, end]);
  }
  return ranges;
}

export function parseOpeningHours(text: string | null | undefined): ParsedHours | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed === '24/7') return { always: true };

  const rules: DayRule[] = [];
  for (const raw of trimmed.split(';')) {
    const rule = raw.trim();
    if (rule === '') continue;
    // Optional leading days, then times or "off".
    const m = /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?|PH)(?:,(?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?))*\s+)?(.+)$/.exec(rule);
    if (!m) return null;
    const daySpec = m[1]?.trim();
    const rest = m[2]!.trim();
    let days: number[] | 'PH' = [0, 1, 2, 3, 4, 5, 6];
    if (daySpec) {
      const d = parseDays(daySpec);
      if (d === null) return null;
      days = d;
    }
    const holiday = days === 'PH';
    if (rest === 'off' || rest === 'closed') {
      rules.push({ days: holiday ? [] : (days as number[]), ranges: [], off: true, holiday });
      continue;
    }
    const ranges = parseRanges(rest);
    if (!ranges) return null;
    rules.push({ days: holiday ? [] : (days as number[]), ranges, off: false, holiday });
  }
  return rules.length > 0 ? { always: false, rules } : null;
}

/** Monday = 0 for a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** True when the visit [startMin, endMin) on `date` lies fully inside the opening hours. */
export function isOpen(parsed: ParsedHours, date: string, startMin: number, endMin: number, publicHoliday = false): boolean {
  if (parsed.always) return true;
  const weekday = weekdayOf(date);
  // Later rules override earlier ones, as in the OSM syntax.
  let ranges: Array<[number, number]> | null = null;
  for (const rule of parsed.rules) {
    if (rule.holiday) {
      if (publicHoliday) ranges = rule.off ? [] : rule.ranges;
    } else if (rule.days.includes(weekday)) {
      ranges = rule.off ? [] : rule.ranges;
    }
  }
  // Rules exist but none covers this day: closed.
  if (ranges === null) return false;
  return ranges.some(([from, to]) => startMin >= from && endMin <= to);
}

/**
 * The earliest start at or after `notBefore` (minutes) from which a visit of `minutes` lies fully inside the opening hours
 * that day, or null when there is none. Lets the plan wait for a 10:00 opening instead of dropping the attraction.
 */
export function earliestStart(parsed: ParsedHours, date: string, notBefore: number, minutes: number, publicHoliday = false): number | null {
  if (parsed.always) return notBefore;
  const weekday = weekdayOf(date);
  let ranges: Array<[number, number]> | null = null;
  for (const rule of parsed.rules) {
    if (rule.holiday) {
      if (publicHoliday) ranges = rule.off ? [] : rule.ranges;
    } else if (rule.days.includes(weekday)) {
      ranges = rule.off ? [] : rule.ranges;
    }
  }
  if (!ranges) return null;
  let best: number | null = null;
  for (const [from, to] of ranges) {
    const start = Math.max(notBefore, from);
    if (start + minutes <= to && (best === null || start < best)) best = start;
  }
  return best;
}

/** Public-holiday dates for a destination, read from the Nager.Date chunks in the knowledge base. */
export async function holidayDates(destinationKey: string, from: string, to: string): Promise<Set<string>> {
  const res = await query<{ chunk_text: string }>("SELECT chunk_text FROM knowledge_chunks WHERE source = 'nager' AND destination = $1", [destinationKey]);
  const out = new Set<string>();
  for (const row of res.rows) {
    for (const m of row.chunk_text.matchAll(/(\d{4}-\d{2}-\d{2}):/g)) {
      const d = m[1]!;
      if (d >= from && d <= to) out.add(d);
    }
  }
  return out;
}
