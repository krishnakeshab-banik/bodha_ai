import type { NextFunction, Request, Response } from 'express';

import { findUserBySession, type UserRecord } from '../models/userRepository.js';
import { HttpError } from '../utils/httpError.js';

export const SESSION_COOKIE = 'bodha_session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- required shape for augmenting Express's Request type
  namespace Express {
    interface Request {
      user?: UserRecord;
    }
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = decodeURIComponent(part.slice(index + 1).trim());
    if (key) out[key] = value;
  }
  return out;
}

export function readSessionToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE];
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const token = readSessionToken(req);
  if (token) {
    const user = findUserBySession(token);
    if (user) req.user = user;
  }
  next();
}

export function requireUser(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(HttpError.unauthorized());
    return;
  }
  next();
}

export function sessionCookie(token: string): string {
  return (
    SESSION_COOKIE +
    '=' +
    encodeURIComponent(token) +
    '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' +
    String(30 * 24 * 60 * 60)
  );
}

export function clearSessionCookie(): string {
  return SESSION_COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}
