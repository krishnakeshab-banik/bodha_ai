/**
 * SQLite persistence, backed by Node's built-in `node:sqlite` module.
 *
 * Using the runtime's own driver keeps the demo free of native build steps
 * (no node-gyp, no prebuilt binary mismatch) while still writing to a real
 * file on disk - so history survives a server restart.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { env } from '../config/env.js';

/**
 * `node:sqlite` type alias, resolved lazily inside `getDatabase()` — not here
 * at module load — so importing this module never crashes at cold start on a
 * runtime where the built-in isn't available yet (e.g. Vercel serverless);
 * only actually opening the database does. `createRequire` also keeps the
 * specifier opaque to bundlers that strip the `node:` prefix before their
 * builtin check (Vite, and therefore Vitest) and would otherwise try to
 * resolve a non-existent "sqlite" package.
 */
type DatabaseSync = InstanceType<(typeof import('node:sqlite'))['DatabaseSync']>;

let database: DatabaseSync | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sellers (
    id          TEXT PRIMARY KEY,
    displayName TEXT NOT NULL,
    createdAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id                TEXT PRIMARY KEY,
    sellerId          TEXT NOT NULL,
    title             TEXT NOT NULL,
    description       TEXT NOT NULL,
    category          TEXT NOT NULL,
    imageUrl          TEXT,
    manufacturingCost REAL NOT NULL,
    currentPrice      REAL NOT NULL,
    createdAt         TEXT NOT NULL,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );

  CREATE TABLE IF NOT EXISTS analyses (
    productId          TEXT PRIMARY KEY,
    recommendedPlatform TEXT NOT NULL,
    recommendedPrice   REAL NOT NULL,
    platformsJson      TEXT NOT NULL,
    listingJson        TEXT NOT NULL,
    createdAt          TEXT NOT NULL,
    FOREIGN KEY (productId) REFERENCES products(id)
  );

  CREATE INDEX IF NOT EXISTS idx_products_seller_created
    ON products (sellerId, createdAt DESC);

  CREATE TABLE IF NOT EXISTS listing_cache (
    cacheKey     TEXT PRIMARY KEY,
    platformId   TEXT NOT NULL,
    category     TEXT NOT NULL,
    query        TEXT NOT NULL,
    listingsJson TEXT NOT NULL,
    fetchedAt    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_listing_cache_platform_fetched
    ON listing_cache (platformId, fetchedAt DESC);

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    passwordHash  TEXT NOT NULL,
    displayName   TEXT NOT NULL,
    plan          TEXT NOT NULL DEFAULT 'free',
    planExpiresAt TEXT,
    createdAt     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token     TEXT PRIMARY KEY,
    userId    TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (userId);
`;

/**
 * Authentication is out of scope for this demo, so every analysis is attributed
 * to one mock seller session.
 */
export const DEMO_SELLER_ID = 'demo-seller';

/** Open (and on first call, create and migrate) the SQLite database. */
export function getDatabase(): DatabaseSync {
  if (database) return database;

  const require = createRequire(import.meta.url);
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

  const dbPath = path.resolve(env.databasePath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  database = new DatabaseSync(dbPath);
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(SCHEMA);
  ensureColumn(database, 'analyses', 'insightsJson', 'TEXT');
  ensureColumn(database, 'users', 'storeName', 'TEXT');
  ensureColumn(database, 'users', 'storeCity', 'TEXT');
  ensureColumn(database, 'users', 'storeCategory', 'TEXT');
  ensureColumn(database, 'users', 'onboardedAt', 'TEXT');
  ensureColumn(database, 'users', 'authProvider', "TEXT NOT NULL DEFAULT 'password'");
  ensureColumn(database, 'users', 'googleId', 'TEXT');

  database
    .prepare('INSERT OR IGNORE INTO sellers (id, displayName, createdAt) VALUES (?, ?, ?)')
    .run(DEMO_SELLER_ID, 'Demo Seller', new Date().toISOString());

  return database;
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string): void {
  const rows = db.prepare('PRAGMA table_info(' + table + ')').all() as { name: string }[];
  if (rows.some((row) => row.name === column)) return;
  db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition);
}

/** Close the handle - used by tests and graceful shutdown. */
export function closeDatabase(): void {
  database?.close();
  database = null;
}
