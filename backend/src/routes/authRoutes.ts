import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import { clearSessionCookie, requireUser, sessionCookie } from '../middleware/auth.js';
import {
  createSession,
  createUser,
  creditStatus,
  deleteSession,
  findOrCreateGoogleUser,
  findUserByEmail,
  saveStoreProfile,
  verifyPassword,
} from '../models/userRepository.js';
import { readSessionToken } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';

export const authRoutes = Router();

const signupSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  name: z.string().trim().min(2).max(80),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function publicUser(req: Request) {
  if (!req.user) return null;
  return {
    ...req.user,
    credits: creditStatus(req.user),
  };
}

authRoutes.post('/signup', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw HttpError.badRequest('Enter a valid name, email and password (8+ characters)');
    }
    if (findUserByEmail(parsed.data.email)) {
      throw HttpError.badRequest('An account with that email already exists');
    }
    const user = createUser({
      id: randomUUID(),
      email: parsed.data.email,
      password: parsed.data.password,
      displayName: parsed.data.name,
    });
    const token = createSession(user.id);
    req.user = user;
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.status(201).json({ user: publicUser(req), token });
  } catch (error) {
    next(error);
  }
});

authRoutes.post('/login', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw HttpError.badRequest('Enter your email and password');
    }
    const existing = findUserByEmail(parsed.data.email);
    if (!existing || !verifyPassword(parsed.data.password, existing.passwordHash)) {
      throw HttpError.unauthorized('Email or password is incorrect');
    }
    const { passwordHash: _hash, ...user } = existing;
    const token = createSession(user.id);
    req.user = user;
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.json({ user: publicUser(req), token });
  } catch (error) {
    next(error);
  }
});

interface GoogleTokenInfo {
  aud?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  sub?: string;
}

/**
 * "Sign in with Google" via Google Identity Services: the frontend obtains an
 * ID token (a signed JWT) from Google's own button and posts it here as-is.
 * Verification is delegated to Google's tokeninfo endpoint rather than a
 * local JWKS/JWT library, matching how this backend already verifies
 * third-party tokens elsewhere (ElevenLabs, Razorpay) with plain `fetch`
 * instead of an SDK. The account is matched by email, so a seller who
 * originally signed up with a password sees the same history when they
 * later use "Sign in with Google" on that address.
 */
authRoutes.post(
  '/google',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const credential = typeof req.body?.credential === 'string' ? req.body.credential.trim() : '';
      if (!credential) {
        throw HttpError.badRequest('Missing Google sign-in credential');
      }
      if (!env.googleClientId) {
        throw HttpError.badRequest('Google sign-in is not configured for this deployment');
      }

      const verifyResponse = await fetch(
        'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential),
      );
      if (!verifyResponse.ok) {
        throw HttpError.unauthorized('Could not verify the Google sign-in token');
      }
      const claims = (await verifyResponse.json()) as GoogleTokenInfo;

      if (claims.aud !== env.googleClientId) {
        throw HttpError.unauthorized('This Google sign-in token was not issued for this app');
      }
      if (!claims.email || claims.email_verified !== 'true') {
        throw HttpError.unauthorized('Your Google account email must be verified to sign in');
      }

      const user = findOrCreateGoogleUser({
        email: claims.email,
        name: claims.name?.trim() || claims.email.split('@')[0],
        googleId: claims.sub ?? '',
      });
      const token = createSession(user.id);
      req.user = user;
      res.setHeader('Set-Cookie', sessionCookie(token));
      res.json({ user: publicUser(req), token });
    } catch (error) {
      next(error);
    }
  },
);

authRoutes.post('/logout', (req: Request, res: Response): void => {
  const token = readSessionToken(req);
  if (token) deleteSession(token);
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.status(204).end();
});

authRoutes.get('/me', (req: Request, res: Response): void => {
  res.json({ user: publicUser(req) });
});

authRoutes.get('/credits', requireUser, (req: Request, res: Response): void => {
  res.json(creditStatus(req.user!));
});

const onboardingSchema = z.object({
  storeName: z.string().trim().min(2).max(80),
  storeCity: z.string().trim().min(2).max(80),
  storeCategory: z.enum([
    'electronics-accessories',
    'apparel',
    'home-kitchen',
    'beauty-personal-care',
    'toys',
  ]),
});

authRoutes.post(
  '/onboarding',
  requireUser,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = onboardingSchema.safeParse(req.body);
      if (!parsed.success) {
        throw HttpError.badRequest('Tell us your store name, city and main category');
      }
      const user = saveStoreProfile(req.user!.id, parsed.data);
      req.user = user;
      res.json({ user: publicUser(req) });
    } catch (error) {
      next(error);
    }
  },
);
