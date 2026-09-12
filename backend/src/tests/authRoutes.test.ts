/**
 * Integration tests for signup/login/session lifecycle.
 * Runs against a throwaway SQLite file so it never touches demo data.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Keeps the one test below that calls /api/products/analyze fast and
// deterministic — same mocks as api.test.ts, needed here only to attach a
// product to a seller so we can prove Google sign-in finds their history.
vi.mock('../services/regionalDemandService.js', () => ({
  fetchRegionalDemand: async () => ({ available: false, states: [] }),
}));

vi.mock('../services/reviewSentiment.js', () => ({
  collectReviewSnippets: async () => [],
  analyzeReviewSentiment: async () => ({ available: false, topPraises: [], topComplaints: [] }),
}));

vi.mock('../services/scraper/scraperService.js', () => ({
  hasLiveScraper: () => false,
  scrapeComparableListings: async () => [],
}));

vi.mock('../services/marketplaceDataProvider.js', () => {
  const snapshot = {
    comparablePrices: [899, 949, 999, 1099, 1199],
    demandIndex: 80,
    competitionIndex: 70,
    dataFreshness: 'live' as const,
    lastUpdated: '2026-01-01T00:00:00.000Z',
    listingCount: 5,
    unavailable: false,
  };
  return {
    getMarketSnapshots: async () => ({ amazon: snapshot }),
    getMarketData: async () => ({ snapshots: { amazon: snapshot }, listings: { amazon: [] } }),
    getCachedListings: () => [],
  };
});

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodha-auth-test-'));
process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
// Fixture value, set before `config/env.js` loads, so these tests don't
// depend on whatever GOOGLE_CLIENT_ID (if any) happens to be in a
// developer's local `.env` — `.env` is gitignored and absent in CI.
process.env.GOOGLE_CLIENT_ID = 'fixture-client-id.apps.googleusercontent.com';

let app: Express;
let closeDatabase: () => void;

beforeAll(async () => {
  const [{ createApp }, dbModule] = await Promise.all([
    import('../app.js'),
    import('../models/db.js'),
  ]);
  app = createApp();
  closeDatabase = dbModule.closeDatabase;
});

afterAll(() => {
  closeDatabase?.();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stubs the tokeninfo call Google's own SDK would otherwise trigger. */
function mockGoogleTokenInfo(claims: Record<string, string>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => claims,
    })),
  );
}

const credentials = {
  email: 'signup-test@example.com',
  password: 'password12',
  name: 'Signup Tester',
};

describe('POST /api/auth/signup', () => {
  it('creates an account, starts a session and never returns the password hash', async () => {
    const response = await request(app).post('/api/auth/signup').send(credentials).expect(201);

    expect(response.body.user).toMatchObject({
      email: credentials.email,
      displayName: credentials.name,
      plan: 'free',
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.headers['set-cookie']?.[0]).toMatch(/bodha_session=/);
  });

  it('rejects a duplicate email with a 400', async () => {
    const response = await request(app).post('/api/auth/signup').send(credentials).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toMatch(/already exists/i);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'short@example.com', password: 'abc123', name: 'Short Pw' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid email', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'password12', name: 'Bad Email' })
      .expect(400);
  });
});

describe('POST /api/auth/login', () => {
  it('signs in with the right password and starts a fresh session', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);

    expect(response.body.user.email).toBe(credentials.email);
    expect(response.headers['set-cookie']?.[0]).toMatch(/bodha_session=/);
  });

  it('rejects the wrong password with a 401 and a generic message', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' })
      .expect(401);
    // Deliberately vague — does not reveal whether the email exists.
    expect(response.body.error.message).toMatch(/email or password is incorrect/i);
  });

  it('rejects an unknown email with the same generic 401', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password12' })
      .expect(401);
    expect(response.body.error.message).toMatch(/email or password is incorrect/i);
  });
});

describe('session lifecycle', () => {
  it('GET /me reflects the signed-in user via the session cookie, then null after logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(credentials).expect(200);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user?.email).toBe(credentials.email);

    await agent.post('/api/auth/logout').expect(204);

    const loggedOut = await agent.get('/api/auth/me').expect(200);
    expect(loggedOut.body.user).toBeNull();
  });

  it('GET /credits requires a session', async () => {
    await request(app).get('/api/auth/credits').expect(401);
  });

  it('GET /credits reports the free-plan limit for a signed-in seller', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(credentials).expect(200);

    const response = await agent.get('/api/auth/credits').expect(200);
    expect(response.body).toMatchObject({ plan: 'free', used: 0 });
    expect(response.body.limit).toBeGreaterThan(0);
  });
});

describe('POST /api/auth/onboarding', () => {
  it('requires a session', async () => {
    await request(app)
      .post('/api/auth/onboarding')
      .send({ storeName: 'Test Store', storeCity: 'Mumbai', storeCategory: 'apparel' })
      .expect(401);
  });

  it('saves the store profile and marks the seller onboarded', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(credentials).expect(200);

    const response = await agent
      .post('/api/auth/onboarding')
      .send({ storeName: 'Test Store', storeCity: 'Mumbai', storeCategory: 'apparel' })
      .expect(200);

    expect(response.body.user).toMatchObject({
      storeName: 'Test Store',
      storeCity: 'Mumbai',
      storeCategory: 'apparel',
      onboarded: true,
    });
  });

  it('rejects an unknown store category', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(credentials).expect(200);

    await agent
      .post('/api/auth/onboarding')
      .send({ storeName: 'Test Store', storeCity: 'Mumbai', storeCategory: 'not-a-category' })
      .expect(400);
  });
});

describe('POST /api/auth/google', () => {
  it('rejects a request with no credential', async () => {
    const response = await request(app).post('/api/auth/google').send({}).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it("rejects a token whose audience doesn't match this app's client id", async () => {
    mockGoogleTokenInfo({
      aud: 'someone-elses-client-id.apps.googleusercontent.com',
      email: 'google-user@example.com',
      email_verified: 'true',
      name: 'Google User',
      sub: 'google-sub-1',
    });

    const response = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'fake-jwt' })
      .expect(401);
    expect(response.body.error.message).toMatch(/not issued for this app/i);
  });

  it('rejects a token with an unverified email', async () => {
    mockGoogleTokenInfo({
      aud: 'fixture-client-id.apps.googleusercontent.com',
      email: 'unverified@example.com',
      email_verified: 'false',
      name: 'Unverified',
      sub: 'google-sub-2',
    });

    const response = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'fake-jwt' })
      .expect(401);
    expect(response.body.error.message).toMatch(/verified/i);
  });

  it('creates a new account on first Google sign-in', async () => {
    mockGoogleTokenInfo({
      aud: 'fixture-client-id.apps.googleusercontent.com',
      email: 'new-google-seller@example.com',
      email_verified: 'true',
      name: 'New Google Seller',
      sub: 'google-sub-3',
    });

    const response = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'fake-jwt' })
      .expect(200);

    expect(response.body.user).toMatchObject({
      email: 'new-google-seller@example.com',
      displayName: 'New Google Seller',
      plan: 'free',
      onboarded: false,
    });
    expect(response.headers['set-cookie']?.[0]).toMatch(/bodha_session=/);
  });

  it('signs the seller into their existing account, and their history is still there', async () => {
    const passwordAgent = request.agent(app);
    const email = 'linked-seller@example.com';
    await passwordAgent
      .post('/api/auth/signup')
      .send({ email, password: 'password12', name: 'Linked Seller' })
      .expect(201);

    const analyze = await passwordAgent.post('/api/products/analyze').send({
      title: 'USB C Fast Charging Cable',
      description: 'Nylon braided 1.5m cable supporting 65W fast charge and data sync.',
      category: 'electronics-accessories',
      imageUrl: null,
      manufacturingCost: 400,
      currentPrice: 800,
      platforms: ['amazon'],
    });
    expect(analyze.status).toBe(201);

    mockGoogleTokenInfo({
      aud: 'fixture-client-id.apps.googleusercontent.com',
      email,
      email_verified: 'true',
      name: 'Linked Seller',
      sub: 'google-sub-4',
    });

    const googleAgent = request.agent(app);
    const googleLogin = await googleAgent
      .post('/api/auth/google')
      .send({ credential: 'fake-jwt' })
      .expect(200);
    expect(googleLogin.body.user.email).toBe(email);

    const history = await googleAgent.get('/api/products/history').expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].productId).toBe(analyze.body.productId);
  });
});
