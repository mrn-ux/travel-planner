import { AgentUnavailableError, ollamaEmbed } from '../agent/ollama.js';

export const EMBEDDING_DIMENSIONS = 768;
const BATCH = 16;

// nomic-embed-text is trained with task prefixes: documents and queries must be marked differently or the
// similarity scores are noticeably worse. (Another model ignores them harmlessly.)
const DOCUMENT_PREFIX = 'search_document: ';
const QUERY_PREFIX = 'search_query: ';

let verified = false;

function check(vectors: number[][]): void {
  for (const v of vectors) {
    if (v.length !== EMBEDDING_DIMENSIONS) {
      throw new AgentUnavailableError(
        `The embedding model returns ${v.length} dimensions but the knowledge base is built for ${EMBEDDING_DIMENSIONS}. ` +
          'Set OLLAMA_EMBED_MODEL to a 768-dimension model such as nomic-embed-text.',
      );
    }
  }
  verified = true;
}

/** Embed chunk text (batches of 16). Throws AgentUnavailableError when Ollama fails or the vector size is wrong. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH).map((t) => DOCUMENT_PREFIX + t);
    const vectors = await ollamaEmbed(batch);
    if (!verified) check(vectors);
    out.push(...vectors);
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await ollamaEmbed([QUERY_PREFIX + text]);
  if (!vector) throw new AgentUnavailableError('The embedding model returned nothing.');
  if (!verified) check([vector]);
  return vector;
}

/** pgvector text form: '[0.1,0.2,...]' */
export const toVectorLiteral = (v: number[]): string => `[${v.join(',')}]`;
