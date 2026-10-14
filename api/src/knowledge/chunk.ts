import { createHash } from 'node:crypto';

const TARGET_CHARS = 800;
const OVERLAP_CHARS = 100;

export interface Chunk {
  text: string;
  contentHash: string;
}

/**
 * Split text on blank lines and headings into chunks of about 800 characters, each carrying the last 100
 * characters of the one before it so a sentence cut at a boundary is still found.
 */
export function splitText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}|\n(?==+ )/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let current = '';
  let fresh = false; // true once `current` holds text beyond the carried-over overlap

  for (const para of paragraphs) {
    // A paragraph longer than the target is cut at sentence ends.
    const pieces = para.length > TARGET_CHARS ? para.split(/(?<=[.!?])\s+/) : [para];
    for (const piece of pieces) {
      if (fresh && current.length + piece.length + 1 > TARGET_CHARS) {
        chunks.push(current.trim());
        current = current.slice(-OVERLAP_CHARS);
        fresh = false;
      }
      current = current.length > 0 ? `${current}\n${piece}` : piece;
      fresh = true;
    }
  }
  if (fresh && current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}

export function contentHash(source: string, destination: string, title: string, text: string): string {
  return createHash('sha256').update([source, destination, title, text].join('\n')).digest('hex');
}

export function chunkDocument(source: string, destination: string, title: string, text: string): Chunk[] {
  const seen = new Set<string>();
  const out: Chunk[] = [];
  for (const piece of splitText(text)) {
    const hash = contentHash(source, destination, title, piece);
    if (seen.has(hash)) continue; // the unique key is (source, destination, hash)
    seen.add(hash);
    out.push({ text: piece, contentHash: hash });
  }
  return out;
}
