import { z } from 'zod';
import type { OllamaTool } from './ollama.js';
import type { ResultCard, ToolResult } from './envelope.js';

/** The fixed tool set. No other tool can be registered. */
export const TOOL_NAMES = [
  'search_knowledge',
  'recommend_destinations',
  'search_attractions',
  'get_weather',
  'get_travel_advisory',
  'convert_currency',
  'search_hotels',
  'search_transport',
  'check_hotel_availability',
  'calculate_budget',
  'create_itinerary',
  'create_hotel_booking',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export interface ToolContext {
  tripId: string;
  userId: string | null;
}

export interface ToolDef {
  name: ToolName;
  description: string;
  /** JSON Schema sent to Ollama. */
  parameters: Record<string, unknown>;
  /** Arguments are validated with this before the handler runs. */
  schema: z.ZodTypeAny;
  /** false = never offered to the chat model (create_hotel_booking is run by the booking API only). */
  chatCallable: boolean;
  handler: (args: unknown, ctx: ToolContext) => Promise<ToolResult>;
  /** Turns a successful result into a card shown beneath the agent's message (with provenance). Optional. */
  toCard?: (result: ToolResult) => ResultCard | null;
}

const tools = new Map<ToolName, ToolDef>();

/** Later plans register their tools here (search_hotels in plan 005, create_itinerary in plan 006, ...). */
export function registerTool(def: ToolDef): void {
  if (!TOOL_NAMES.includes(def.name)) throw new Error(`Unknown tool: ${def.name}`);
  if (def.name === 'create_hotel_booking' && def.chatCallable) {
    throw new Error('create_hotel_booking must not be callable from chat');
  }
  tools.set(def.name, def);
}

export function getTool(name: string): ToolDef | undefined {
  return tools.get(name as ToolName);
}

/** The tools the chat model may call: registered AND chat-callable. */
export function chatToolDefinitions(): OllamaTool[] {
  return [...tools.values()]
    .filter((t) => t.chatCallable)
    .map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
}
