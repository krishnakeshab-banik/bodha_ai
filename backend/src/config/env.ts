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
  corsOrigins: (
    process.env.CORS_ORIGIN ??
    'http://localhost:5173,http://localhost:4000,https://localhost,capacitor://localhost'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  databasePath:
    process.env.DATABASE_PATH ?? (process.env.VERCEL ? '/tmp/bodha.db' : './data/bodha.db'),
  /** MongoDB connection string (e.g. mongodb+srv://... or mongodb://localhost:27017/bodha_ai). */
  mongodbUri: process.env.MONGODB_URI ?? '',
  useMongo: Boolean(process.env.MONGODB_URI),
  /** Empty in the demo - the rule-based listing optimizer is used instead. */
  llmApiKey: process.env.LLM_API_KEY ?? '',
  llmModel: process.env.LLM_MODEL ?? 'claude-sonnet-5',
  /** Gemini powers language-aware listing copy when set. */
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  /**
   * OAuth 2.0 Client ID from Google Cloud Console ("Sign in with Google").
   * Public by design — it's also embedded in the frontend bundle as
   * VITE_GOOGLE_CLIENT_ID. Verifies the `aud` claim on every Google ID token;
   * leave empty to disable Google sign-in (POST /api/auth/google then 400s).
   */
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  /** Used only server-side to mint ElevenLabs conversation tokens / signed URLs. */
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? '',
  elevenLabsAgentId: process.env.ELEVENLABS_AGENT_ID ?? 'agent_3301m2486d2qecasbeht51m4ef4t',
  elevenLabsBranchId: process.env.ELEVENLABS_BRANCH_ID ?? 'agtbrch_7501m2486ek8erka0cw0dy0y87d2',
  /**
   * Shared secret ElevenLabs sends back on every server-tool webhook call
   * (configure the same value as a custom header on each tool in the
   * ElevenLabs dashboard). Empty in local dev, where the tools stay open;
   * set it before deploying so `/api/voice-tools/*` cannot be queried by
   * anyone who finds the URL and a productId.
   */
  elevenLabsToolSecret: process.env.ELEVENLABS_TOOL_SECRET ?? '',
  /** How long a scrape is reused before we hit the marketplace again. */
  cacheTtlHours: readNumber('CACHE_TTL_HOURS', 3),
  scrapeTimeoutMs: readNumber('SCRAPE_TIMEOUT_MS', 25000),
  scrapeMaxResults: Math.min(20, Math.max(8, Math.round(readNumber('SCRAPE_MAX_RESULTS', 20)))),
  scrapeHeadless: readBoolean('SCRAPE_HEADLESS', true),
  scrapeUserAgent:
    process.env.SCRAPE_USER_AGENT ??
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  /** $10 / month, billed in INR paise for Razorpay test checkout. */
  proPricePaise: readNumber('PRO_PRICE_PAISE', 83000),
  freeAnalysesPerMonth: readNumber('FREE_ANALYSES_PER_MONTH', 6),
} as const;
