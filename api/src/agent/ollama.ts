import { getConfig } from '../config.js';
import { fetchJson } from '../http.js';

// Ollama is called from the server only. Its URL and model names never reach the browser.

export interface ToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  /** For role 'tool': which tool produced this result. */
  tool_name?: string;
}

export interface OllamaTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** The assistant could not be reached or did not answer. `timeout` maps to HTTP 504, anything else to 502. */
export class AgentUnavailableError extends Error {
  constructor(
    message: string,
    public readonly timeout = false,
  ) {
    super(message);
    this.name = 'AgentUnavailableError';
  }
}

const CHAT_TIMEOUT_MS = 120_000;
const EMBED_TIMEOUT_MS = 60_000;

export interface ChatRequest {
  messages: OllamaMessage[];
  tools?: OllamaTool[];
  /** JSON Schema for structured output. Not combined with tools in one call (interaction is undocumented). */
  format?: Record<string, unknown>;
  temperature?: number;
}

/** POST /api/chat with stream:false. The context window is set explicitly: small defaults truncate tool definitions. */
export async function ollamaChat(req: ChatRequest): Promise<OllamaMessage> {
  const { ollama } = getConfig();
  const body: Record<string, unknown> = {
    model: ollama.model,
    messages: req.messages,
    stream: false,
    options: { num_ctx: ollama.numCtx, ...(req.temperature !== undefined ? { temperature: req.temperature } : {}) },
  };
  if (req.tools && req.tools.length > 0) body['tools'] = req.tools;
  if (req.format) body['format'] = req.format;

  const res = await fetchJson<{ message?: OllamaMessage }>(`${ollama.baseUrl.replace(/\/$/, '')}/api/chat`, {
    provider: 'ollama',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: CHAT_TIMEOUT_MS,
    ttlMs: 0,
  });
  if (!res.ok) {
    throw new AgentUnavailableError(
      res.reason === 'timeout' ? 'The assistant took too long to reply.' : 'The assistant could not be reached.',
      res.reason === 'timeout',
    );
  }
  const message = res.body.message;
  if (!message || typeof message.content !== 'string') {
    throw new AgentUnavailableError('The assistant returned an unreadable reply.');
  }
  return message;
}

/** POST /api/embed. Vectors are L2-normalised, so cosine similarity applies. Used by the knowledge base (plan 004). */
export async function ollamaEmbed(texts: string[]): Promise<number[][]> {
  const { ollama } = getConfig();
  const res = await fetchJson<{ embeddings?: number[][] }>(`${ollama.baseUrl.replace(/\/$/, '')}/api/embed`, {
    provider: 'ollama',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ollama.embedModel, input: texts }),
    timeoutMs: EMBED_TIMEOUT_MS,
    ttlMs: 0,
  });
  if (!res.ok || !Array.isArray(res.body.embeddings) || res.body.embeddings.length !== texts.length) {
    throw new AgentUnavailableError('The embedding model could not be reached.', !res.ok && res.reason === 'timeout');
  }
  return res.body.embeddings;
}
