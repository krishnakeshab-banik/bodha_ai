/**
 * Centralised environment configuration.
 *
 * Values come from `.env` (see `.env.example`). No secret is ever hardcoded;
 * the LLM key is read here and nowhere else.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Minimal .env loader. Avoids pulling in `dotenv` for four variables and keeps
 * process.env as the single source of truth.
 */
function loadDotEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

function readNumber(key: string, fallback: number): number {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
}

export const env = {
  port: readNumber('PORT', 4000),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  databasePath:
    process.env.DATABASE_PATH ??
    (process.env.VERCEL ? '/tmp/bodha.db' : './data/bodha.db'),
  /** Empty in the demo - the rule-based listing optimizer is used instead. */
  llmApiKey: process.env.LLM_API_KEY ?? '',
  llmModel: process.env.LLM_MODEL ?? 'claude-sonnet-5',
  /** Gemini powers the voice agent and language-aware listing copy when set. */
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  /** How long a scrape is reused before we hit the marketplace again. */
  cacheTtlHours: readNumber('CACHE_TTL_HOURS', 3),
  scrapeTimeoutMs: readNumber('SCRAPE_TIMEOUT_MS', 25000),
  scrapeMaxResults: Math.min(20, Math.max(8, Math.round(readNumber('SCRAPE_MAX_RESULTS', 20)))),
  scrapeHeadless: readBoolean('SCRAPE_HEADLESS', true),
  scrapeUserAgent:
    process.env.SCRAPE_USER_AGENT ??
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  sessionSecret: process.env.SESSION_SECRET ?? 'bodha-dev-session-secret',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  /** $10 / month, billed in INR paise for Razorpay test checkout. */
  proPricePaise: readNumber('PRO_PRICE_PAISE', 83000),
  freeAnalysesPerMonth: readNumber('FREE_ANALYSES_PER_MONTH', 6),
} as const;
