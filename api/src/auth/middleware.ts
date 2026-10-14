import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors.js';
import { lookupSession, type AuthUser } from './sessions.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionToken?: string;
    }
  }
}

function bearerToken(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  return m ? (m[1] as string) : null;
}

/** Attaches req.user when a valid session token is presented; otherwise continues as a visitor. */
export const optionalUser: RequestHandler = (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) return next();
  lookupSession(token)
    .then((user) => {
      if (user) {
        req.user = user;
        req.sessionToken = token;
      }
      next();
    })
    .catch(next);
};

/** Requires a valid session: responds 401 { error } otherwise. */
export const requireUser: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const token = bearerToken(req);
  if (!token) return next(new AppError(401, 'Please log in to continue.'));
  lookupSession(token)
    .then((user) => {
      if (!user) return next(new AppError(401, 'Your session has ended. Please log in again.'));
      req.user = user;
      req.sessionToken = token;
      next();
    })
    .catch(next);
};
