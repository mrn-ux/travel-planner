import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/**
 * An error with an HTTP status. The response body is always { error: string } (see CLAUDE.md conventions);
 * `extra` adds structured fields next to `error` (for example per-field validation messages).
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

// Express recognises error handlers by their four-argument signature.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ ...err.extra, error: err.message });
    return;
  }
  // Malformed JSON in a request body is the caller's mistake, not a server fault.
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'The request body is not valid JSON.' });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? 'The request was not valid.' });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
