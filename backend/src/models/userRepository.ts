import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

import { env } from '../config/env.js';
import { getDatabase } from './db.js';
import { isMongoConnected, SessionModel, UserModel } from './mongo.js';

export type UserPlan = 'free' | 'pro';

export interface StoreProfile {
  storeName: string;
  storeCity: string;
  storeCategory: string;
}

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  plan: UserPlan;
  planExpiresAt: string | null;
  createdAt: string;
  storeName: string | null;
  storeCity: string | null;
  storeCategory: string | null;
  onboarded: boolean;
}

export interface CreditStatus {
  plan: UserPlan;
  used: number;
  limit: number | null;
  remaining: number | null;
  planExpiresAt: string | null;
}

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  plan: string;
  planExpiresAt: string | null;
  createdAt: string;
  storeName: string | null;
  storeCity: string | null;
  storeCategory: string | null;
  onboardedAt: string | null;
}

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return salt + ':' + hash;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, SCRYPT_KEYLEN);
  const prev = Buffer.from(hash, 'hex');
  return prev.length === next.length && timingSafeEqual(prev, next);
}

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    plan: isPro(row) ? 'pro' : 'free',
    planExpiresAt: row.planExpiresAt,
    createdAt: row.createdAt,
    storeName: row.storeName ?? null,
    storeCity: row.storeCity ?? null,
    storeCategory: row.storeCategory ?? null,
    onboarded: Boolean(row.onboardedAt && row.storeName),
  };
}

function isPro(row: Pick<UserRow, 'plan' | 'planExpiresAt'>): boolean {
  if (row.plan !== 'pro') return false;
  if (!row.planExpiresAt) return true;
  return new Date(row.planExpiresAt).getTime() > Date.now();
}

export function createUser(input: {
  id: string;
  email: string;
  password: string;
  displayName: string;
}): UserRecord {
  const createdAt = new Date().toISOString();
  const passwordHash = hashPassword(input.password);
  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO sellers (id, displayName, createdAt) VALUES (?, ?, ?)').run(
    input.id,
    input.displayName,
    createdAt,
  );
  db.prepare(
    `INSERT INTO users (id, email, passwordHash, displayName, plan, planExpiresAt, createdAt)
     VALUES (?, ?, ?, ?, 'free', NULL, ?)`,
  ).run(input.id, input.email.toLowerCase().trim(), passwordHash, input.displayName, createdAt);

  if (isMongoConnected()) {
    UserModel.updateOne(
      { _id: input.id },
      {
        $set: {
          email: input.email.toLowerCase().trim(),
          passwordHash,
          displayName: input.displayName,
          plan: 'free',
          planExpiresAt: null,
          createdAt,
          authProvider: 'password',
        },
      },
      { upsert: true },
    ).catch((err) => console.error('[bodha-ai] Mongo sync user error:', err));
  }

  return {
    id: input.id,
    email: input.email.toLowerCase().trim(),
    displayName: input.displayName,
    plan: 'free',
    planExpiresAt: null,
    createdAt,
    storeName: null,
    storeCity: null,
    storeCategory: null,
    onboarded: false,
  };
}

/**
 * Sign in with Google: match the account by email (the same address the
 * seller already used, so their existing analyses/history stay attached),
 * or create a fresh free-plan account. Google-only accounts get a random,
 * never-shown password hash so `passwordHash NOT NULL` is satisfied without
 * giving them a usable password sign-in.
 */
export function findOrCreateGoogleUser(input: {
  email: string;
  name: string;
  googleId: string;
}): UserRecord {
  const email = input.email.toLowerCase().trim();
  const db = getDatabase();

  const existing = findUserByEmail(email);
  if (existing) {
    db.prepare('UPDATE users SET googleId = COALESCE(googleId, ?) WHERE id = ?').run(
      input.googleId,
      existing.id,
    );
    if (isMongoConnected()) {
      UserModel.updateOne({ _id: existing.id }, { $set: { googleId: input.googleId } }).catch(
        (err) => console.error('[bodha-ai] Mongo sync error:', err),
      );
    }
    const { passwordHash: _hash, ...user } = existing;
    return user;
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const passwordHash = hashPassword(randomBytes(24).toString('hex'));
  db.prepare('INSERT OR IGNORE INTO sellers (id, displayName, createdAt) VALUES (?, ?, ?)').run(
    id,
    input.name,
    createdAt,
  );
  db.prepare(
    `INSERT INTO users
       (id, email, passwordHash, displayName, plan, planExpiresAt, createdAt, authProvider, googleId)
     VALUES (?, ?, ?, ?, 'free', NULL, ?, 'google', ?)`,
  ).run(id, email, passwordHash, input.name, createdAt, input.googleId);

  if (isMongoConnected()) {
    UserModel.updateOne(
      { _id: id },
      {
        $set: {
          email,
          passwordHash,
          displayName: input.name,
          plan: 'free',
          planExpiresAt: null,
          createdAt,
          authProvider: 'google',
          googleId: input.googleId,
        },
      },
      { upsert: true },
    ).catch((err) => console.error('[bodha-ai] Mongo sync user error:', err));
  }

  const created = findUserById(id);
  if (!created) throw new Error('User missing after Google sign-in');
  return created;
}

export function saveStoreProfile(userId: string, profile: StoreProfile): UserRecord {
  const onboardedAt = new Date().toISOString();
  getDatabase()
    .prepare(
      `UPDATE users SET storeName = ?, storeCity = ?, storeCategory = ?, onboardedAt = ? WHERE id = ?`,
    )
    .run(profile.storeName, profile.storeCity, profile.storeCategory, onboardedAt, userId);
  if (isMongoConnected()) {
    UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          storeName: profile.storeName,
          storeCity: profile.storeCity,
          storeCategory: profile.storeCategory,
          onboardedAt,
        },
      },
    ).catch((err) => console.error('[bodha-ai] Mongo sync profile error:', err));
  }
  const user = findUserById(userId);
  if (!user) throw new Error('User missing after onboarding');
  return user;
}

export function findUserByEmail(email: string): (UserRecord & { passwordHash: string }) | null {
  const row = getDatabase()
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.toLowerCase().trim()) as UserRow | undefined;
  if (!row) return null;
  return { ...toUser(row), passwordHash: row.passwordHash };
}

export function findUserById(id: string): UserRecord | null {
  const row = getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(id) as
    UserRow | undefined;
  return row ? toUser(row) : null;
}

export function createSession(userId: string): string {
  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  getDatabase()
    .prepare('INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)')
    .run(token, userId, expiresAt);
  if (isMongoConnected()) {
    SessionModel.updateOne({ _id: token }, { $set: { userId, expiresAt } }, { upsert: true }).catch(
      (err) => console.error('[bodha-ai] Mongo sync session error:', err),
    );
  }
  return token;
}

export function findUserBySession(token: string): UserRecord | null {
  const row = getDatabase()
    .prepare(
      `SELECT u.* FROM users u
       JOIN sessions s ON s.userId = u.id
       WHERE s.token = ? AND s.expiresAt > ?`,
    )
    .get(token, new Date().toISOString()) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function deleteSession(token: string): void {
  getDatabase().prepare('DELETE FROM sessions WHERE token = ?').run(token);
  if (isMongoConnected()) {
    SessionModel.deleteOne({ _id: token }).catch((err) =>
      console.error('[bodha-ai] Mongo delete session error:', err),
    );
  }
}

export function monthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function countAnalysesSince(sellerId: string, sinceIso: string): number {
  const row = getDatabase()
    .prepare('SELECT COUNT(*) AS n FROM products WHERE sellerId = ? AND createdAt >= ?')
    .get(sellerId, sinceIso) as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export function creditStatus(user: UserRecord): CreditStatus {
  if (user.plan === 'pro') {
    return {
      plan: 'pro',
      used: countAnalysesSince(user.id, monthStartIso()),
      limit: null,
      remaining: null,
      planExpiresAt: user.planExpiresAt,
    };
  }
  const used = countAnalysesSince(user.id, monthStartIso());
  const limit = env.freeAnalysesPerMonth;
  return {
    plan: 'free',
    used,
    limit,
    remaining: Math.max(0, limit - used),
    planExpiresAt: null,
  };
}

export function activatePro(userId: string, days = 31): UserRecord {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  getDatabase()
    .prepare('UPDATE users SET plan = ?, planExpiresAt = ? WHERE id = ?')
    .run('pro', expires, userId);
  if (isMongoConnected()) {
    UserModel.updateOne({ _id: userId }, { $set: { plan: 'pro', planExpiresAt: expires } }).catch(
      (err) => console.error('[bodha-ai] Mongo activate pro error:', err),
    );
  }
  const user = findUserById(userId);
  if (!user) throw new Error('User missing after upgrade');
  return user;
}
