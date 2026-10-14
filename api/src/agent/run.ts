import { currencyOfCountryName } from '../search/countryCurrency.js';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import {
  applyBriefPatchLenient,
  getTripForOwner,
  missingMinimum,
  type Owner,
  type Trip,
} from '../trips/service.js';
import type { ResultCard } from './envelope.js';
import { childrenMention } from './children.js';
import { lead, nextIntakeQuestion } from './intake.js';
import { halfAnswered } from './prompt.js';
import { extractBrief } from './extract.js';
import { AgentUnavailableError, ollamaChat, type OllamaMessage } from './ollama.js';
import { buildSystemPrompt, untrusted } from './prompt.js';
import { chatToolDefinitions, getTool } from './registry.js';

export interface StoredMessage {
  id: number;
  role: 'user' | 'agent';
  content: string;
  cards: ResultCard[] | null;
  createdAt: string;
}

interface MessageRow {
  id: string;
  role: 'user' | 'agent';
  content: string;
  cards: ResultCard[] | null;
  created_at: Date;
}

const MAX_TOOL_ROUNDS = 6;
const HISTORY_LIMIT = 12;

function toStored(r: MessageRow): StoredMessage {
  return { id: Number(r.id), role: r.role, content: r.content, cards: r.cards, createdAt: r.created_at.toISOString() };
}

export async function listMessages(tripId: string): Promise<StoredMessage[]> {
  const res = await query<MessageRow>(
    'SELECT id, role, content, cards, created_at FROM conversation_messages WHERE trip_id = $1 ORDER BY id',
    [tripId],
  );
  return res.rows.map(toStored);
}

async function insertMessage(tripId: string, role: 'user' | 'agent', content: string, cards: ResultCard[] | null): Promise<StoredMessage> {
  const res = await query<MessageRow>(
    `INSERT INTO conversation_messages (trip_id, role, content, cards) VALUES ($1, $2, $3, $4)
     RETURNING id, role, content, cards, created_at`,
    [tripId, role, content, cards ? JSON.stringify(cards) : null],
  );
  await query('UPDATE trips SET updated_at = now() WHERE id = $1', [tripId]);
  return toStored(res.rows[0] as MessageRow);
}

export interface TurnInput {
  trip: Trip;
  owner: Owner;
  userId: string | null;
  preferredCurrency: string | null;
  /** The traveler's message. */
  text: string;
  /** Set when retrying: the user message is already stored and must not be inserted again. */
  existingUserMessage?: StoredMessage;
}

export interface TurnResult {
  userMessage: StoredMessage;
  agentMessage: StoredMessage;
  trip: Trip;
  missing: string[];
}

/** Thrown when the assistant fails. The traveler's message is already stored, so nothing is lost. */
export class AgentTurnError extends AppError {
  constructor(
    status: number,
    message: string,
    public readonly userMessage: StoredMessage,
  ) {
    super(status, message, { userMessage });
  }
}

/**
 * One conversation turn: store the message, extract trip details into the trip, then let the model reply
 * (calling registered tools if it needs facts). Tool results are wrapped as untrusted data.
 */
const QUESTION_START = /^\s*(what|which|how|is|are|does|do|can|could|tell|show|find|search|suggest|recommend|compare|check|give|list|any)\b/i;
const FACT_WORDS = /\b(weather|climate|safe|safety|advisory|visa|attractions?|things to do|to see|currency|exchange rate|convert)\b/i;

/** True when the traveler's message asks for information (a question, a request, or a fact topic) rather than giving trip details. */
const CHILD_Q = 'How many children will be joining you?';
const WORD_COUNT: Record<string, number> = { no: 0, none: 0, zero: 0, nope: 0, nil: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/**
 * The traveler's messages in order, where a bare answer to "How many children will be joining you?" ("2", "none") is written out as
 * "2 children" / "no children", so the answer stays understood on every later turn.
 */
export function effectiveUserTexts(all: Array<{ role: string; content: string }>): string[] {
  const out: string[] = [];
  all.forEach((m, i) => {
    if (m.role !== 'user') return;
    const prev = all[i - 1];
    if (prev && prev.role === 'agent' && prev.content.includes(CHILD_Q)) {
      const t = m.content.trim().toLowerCase().replace(/[.!]+$/, '');
      const w = /^(\d{1,2}|no|none|zero|nope|nil|one|two|three|four|five|six|seven|eight|nine|ten)\b/.exec(t);
      if (w) {
        const n = /^\d+$/.test(w[1] as string) ? Number(w[1]) : (WORD_COUNT[w[1] as string] as number);
        out.push(n === 0 ? 'no children' : `${n} ${n === 1 ? 'child' : 'children'}`);
        return;
      }
    }
    out.push(m.content);
  });
  return out;
}

/** Whatever the model wrote, a reply carries at most one question line ("- ..."): the first. */
export function oneQuestion(reply: string): string {
  const lines = reply.split('\n');
  let seen = false;
  const kept = lines.filter((l) => {
    if (!/^\s*[-\u2022*]\s+/.test(l)) return true;
    if (seen) return false;
    seen = true;
    return true;
  });
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function asksForFacts(text: string): boolean {
  return text.includes('?') || QUESTION_START.test(text) || FACT_WORDS.test(text);
}

export async function runAgentTurn(input: TurnInput): Promise<TurnResult> {
  const { owner, userId, text } = input;
  const userMessage = input.existingUserMessage ?? (await insertMessage(input.trip.id, 'user', text, null));
  const today = new Date().toISOString().slice(0, 10);

  try {
    // 1. Save what the traveler stated (a separate structured call, not a tool).
    // Children mentioned earlier (or now) but no ages saved: the extractor is told an age answer may follow.
    const everything = await listMessages(input.trip.id);
    const effective = effectiveUserTexts(everything);
    const earlier = effective.slice(0, -1);
    const textForKids = effective[effective.length - 1] ?? text;
    // Only an EARLIER mention of children counts: the ages question has been asked. This same message may be the one that mentions them.
    const askedChildAges = input.trip.childrenAges.length === 0 && childrenMention(earlier).mentioned;
    // The budget is in the destination country's currency unless the traveler says otherwise.
    const countryCurrency = input.trip.destinationCountry ? await currencyOfCountryName(input.trip.destinationCountry).catch(() => null) : null;
    const extraction = await extractBrief({ trip: input.trip, message: text, today, preferredCurrency: countryCurrency ?? input.preferredCurrency, askedChildAges, earlierUserTexts: earlier, lastAgentText: everything.filter((m) => m.role === 'agent').at(-1)?.content });
    const applied = await applyBriefPatchLenient(input.trip.id, owner, extraction.patch);
    const trip = applied.trip;
    const rejected = { ...extraction.notes, ...applied.rejected };
    // What could not be saved is always told to the traveler by the server, whatever the model writes.
    const notices = Object.values(rejected);

    // 2. Build the conversation: system prompt (with the saved brief), recent history, then the new message.
    const history = (await listMessages(trip.id)).filter((m) => m.id !== userMessage.id).slice(-HISTORY_LIMIT);
    // Destination suggestions are offered to the model only when the traveler asked for them. Someone who says they know where
    // they want to go is asked where, never handed a list.
    // Tools are offered only when the message asks for facts. A message that just gives trip details ("India", "two adults",
    // "5000 EUR") gets an acknowledgement and the next question, not a search the traveler did not ask for.
    const tools = asksForFacts(text) ? chatToolDefinitions().filter((t) => t.function.name !== 'recommend_destinations' || trip.recommendRequested) : [];
    const messages: OllamaMessage[] = [
      {
        role: 'system',
        content: buildSystemPrompt({ trip, missing: missingMinimum(trip), rejected: Object.fromEntries(Object.entries(rejected).filter(([, v]) => !v.startsWith('Note: '))), today, toolNames: tools.map((t) => t.function.name), childAges: trip.childrenAges.length === 0 ? childrenMention([...earlier, textForKids]) : { mentioned: false, count: null } }),
      },
      ...history.map<OllamaMessage>((m) => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: text },
    ];

    // 3. Tool loop.
    const cards: ResultCard[] = [];
    let reply = '';
    // "I know where I want to go" with no destination saved yet always gets the same smooth, friendly question (no model wording).
    const knowsDestination = /\b(know|have)\b.{0,25}\b(where|destination|place)\b/i.test(text);
    if (!trip.destination && !trip.recommendRequested && knowsDestination && !asksForFacts(text.replace(/\bwhere\b/gi, ''))) {
      reply = 'Wonderful! Where are you dreaming of going?';
    }
    // A half answer ("in December" with no length, "ten days" with no time) is always followed up on, in fixed friendly words, so the
    // conversation never skips ahead. It asks at most twice in a row; after that the model takes over.
    const gap = halfAnswered(trip)[0];
    if (reply === '' && gap && !asksForFacts(text)) {
      const question = gap.startsWith('how many') ? 'How many days or nights would you like to stay?' : 'Roughly when would you like to go?';
      const lead = gap.startsWith('how many') ? 'That sounds lovely!' : 'Great, thank you!';
      const full = `${lead} ${question}`;
      const recentAgent = history.filter((m) => m.role === 'agent').slice(-2);
      const askedTwice = recentAgent.length === 2 && recentAgent.every((m) => m.content.includes(question));
      if (!askedTwice) reply = full;
    }
    // Children mentioned, no ages yet: always the same question, always saying "children" (never "babies" or "infants").
    const kids = childrenMention([...earlier, textForKids]);
    if (reply === '' && trip.childrenAges.length === 0 && kids.mentioned && !asksForFacts(text)) {
      const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
      const count = kids.count !== null && kids.count >= 1 && kids.count <= 10 ? kids.count : null;
      const question = count === null ? 'How old are your children?' : count === 1 ? 'How old is your child?' : `How old are your ${WORDS[count]} children?`;
      const recentAgent = history.filter((m) => m.role === 'agent').slice(-2);
      if (!(recentAgent.length === 2 && recentAgent.every((m) => m.content.includes('children?') || m.content.includes('your child?')))) reply = `How lovely! ${question}`;
    }
    // Adults are known but the traveler has never said anything about children: ask once, in fixed friendly words.
    if (reply === '' && trip.adults && !kids.mentioned && kids.count === null && !asksForFacts(text) && !history.some((m) => m.role === 'agent' && m.content.includes(CHILD_Q))) {
      reply = `Lovely! ${CHILD_Q} (Say 0 if none.)`;
    }
    // The remaining intake questions (when, adults, budget, transport, interests) follow a fixed order, one at a time. The model only
    // answers the traveler's own questions, so it cannot skip ahead, repeat or ask two things at once.
    if (reply === '' && !asksForFacts(text) && !(kids.mentioned && trip.childrenAges.length === 0)) {
      const q = nextIntakeQuestion({ trip, agentMessages: history.filter((m) => m.role === 'agent').map((m) => m.content), recommendRequested: trip.recommendRequested, currency: countryCurrency });
      if (q) reply = `${lead(history.filter((m) => m.role === 'agent').length)} ${q}`;
    }
    for (let round = 0; reply === '' && round <= MAX_TOOL_ROUNDS; round++) {
      const message = await ollamaChat({ messages, tools: round < MAX_TOOL_ROUNDS ? tools : [], temperature: 0.2 });
      const calls = message.tool_calls ?? [];
      if (calls.length === 0 || round === MAX_TOOL_ROUNDS) {
        reply = oneQuestion(message.content.trim());
        break;
      }
      messages.push({ role: 'assistant', content: message.content, tool_calls: calls });
      for (const call of calls) {
        const name = call.function.name;
        const def = getTool(name);
        if (!def || !def.chatCallable) {
          messages.push({ role: 'tool', tool_name: name, content: untrusted(name, 'unavailable', { error: 'This tool is not available.' }) });
          continue;
        }
        const args = def.schema.safeParse(call.function.arguments);
        if (!args.success) {
          console.warn(`Tool ${name}: invalid arguments ${JSON.stringify(call.function.arguments)}`);
          messages.push({ role: 'tool', tool_name: name, content: untrusted(name, 'unavailable', { error: `The tool arguments were not valid (${args.error.issues.map((i) => `${i.path.join('.') || 'arguments'}: ${i.message}`).join('; ')}). Call the tool again with corrected arguments.` }) });
          continue;
        }
        try {
          const result = await def.handler(args.data, { tripId: trip.id, userId });
          messages.push({ role: 'tool', tool_name: name, content: untrusted(result.source, result.certainty, result) });
          const card = result.ok ? def.toCard?.(result) : null;
          if (card) cards.push(card);
        } catch (err) {
          console.warn(`Tool ${name} failed:`, err instanceof Error ? err.message : err);
          messages.push({ role: 'tool', tool_name: name, content: untrusted(name, 'unavailable', { error: 'The lookup failed.' }) });
        }
      }
    }

    if (!reply) throw new AgentUnavailableError('The assistant did not produce a reply.');

    const noticeText = notices.map((n) => (n.startsWith('Note: ') ? n.slice(6) : `Not saved: ${n}`)).join('\n');
    const withNotices = notices.length > 0 ? `${reply}\n\n${noticeText}` : reply;
    const agentMessage = await insertMessage(trip.id, 'agent', withNotices, cards.length > 0 ? cards : null);
    const fresh = await getTripForOwner(trip.id, owner);
    return { userMessage, agentMessage, trip: fresh, missing: missingMinimum(fresh) };
  } catch (err) {
    if (err instanceof AgentUnavailableError) {
      throw new AgentTurnError(err.timeout ? 504 : 502, `${err.message} Your message was saved. Try again.`, userMessage);
    }
    throw err;
  }
}

/** The last traveler message that has no agent reply after it (for Retry), if any. */
export async function lastUnansweredMessage(tripId: string): Promise<StoredMessage | null> {
  const all = await listMessages(tripId);
  const last = all[all.length - 1];
  return last && last.role === 'user' ? last : null;
}
