import type { Trip } from '../trips/service.js';

/**
 * The trip-intake questions, in order, one at a time, in fixed friendly words. The chat model is good at conversation but drifts when it
 * has to remember what is still missing (it skips ahead, repeats, or asks two things), so the order lives here. The model is used for
 * questions the traveler asks (weather, safety, places) and for anything outside this script.
 */
const LEADS = ['Great!', 'Lovely!', 'Wonderful!', 'Perfect!', 'Thank you!'];

export interface IntakeContext {
  trip: Trip;
  /** What the agent has said so far, oldest first. */
  agentMessages: string[];
  /** The traveler asked for destination suggestions. */
  recommendRequested: boolean;
  /** The currency of the destination country, for the budget question's example. */
  currency?: string | null;
}

const asked = (ctx: IntakeContext, text: string): number => ctx.agentMessages.filter((m) => m.includes(text)).length;

/** The next question to ask, or null when the script has nothing left (or has asked a question twice already). */
export function nextIntakeQuestion(ctx: IntakeContext): string | null {
  const { trip } = ctx;
  const steps: Array<{ when: boolean; question: string; max: number; match?: string }> = [
    { when: !trip.destination, question: 'Where are you dreaming of going?', max: 2 },
    { when: Boolean(trip.destination) && !trip.startDate && !trip.dateWindowText && !trip.durationDays, question: 'Roughly when would you like to go?', max: 2 },
    { when: Boolean(trip.destination) && (!trip.startDate || !trip.endDate), question: 'What are your start and end dates? (For example 5 June to 12 June 2027.)', max: 2 },
    { when: Boolean(trip.destination) && (!trip.adults || trip.adults < 1), question: 'How many adults will be travelling?', max: 2 },
    { when: Boolean(trip.destination) && !trip.budget, question: `What's your approximate total budget for the trip? (For example 3000 ${ctx.currency ?? 'EUR'}.)`, max: 2, match: 'approximate total budget for the trip' },
    { when: Boolean(trip.destination) && !trip.transportPreference, question: 'How would you like to travel there: flight, train, bus or car?', max: 1 },
    { when: Boolean(trip.destination) && !trip.accommodationPreference, question: 'Where would you like to stay: a hotel, villa, cottage, guest house or apartment?', max: 1 },
    { when: Boolean(trip.destination) && !trip.interests, question: 'What would you love to do or see there? (For example food, beaches, museums or hiking.)', max: 1 },
    { when: Boolean(trip.destination) && !trip.specialRequirements, question: 'Do you have any special requirements, such as accessibility needs, dietary needs or travelling with a pet? (Say none if not.)', max: 1 },
  ];
  for (const s of steps) {
    if (s.when && asked(ctx, s.match ?? s.question) < s.max) return s.question;
  }
  const done = 'I have what I need. Press See results whenever you are ready, or tell me anything else you would like to change.';
  return asked(ctx, done) >= 1 ? null : done;
}

/** A short warm opening, varied by how far the conversation has got. */
export function lead(agentMessageCount: number): string {
  return LEADS[agentMessageCount % LEADS.length] as string;
}
