import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import {
  clearSessionCookie,
  requireUser,
  sessionCookie,
} from '../middleware/auth.js';
import {
  createSession,
  createUser,
  creditStatus,
  deleteSession,
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
    res.status(201).json({ user: publicUser(req) });
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
    res.json({ user: publicUser(req) });
  } catch (error) {
    next(error);
  }
});

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

authRoutes.post('/onboarding', requireUser, (req: Request, res: Response, next: NextFunction): void => {
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
});
