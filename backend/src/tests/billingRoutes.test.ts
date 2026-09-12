/**
 * Integration tests for the Razorpay checkout flow.
 *
 * Uses fixture credentials injected via `process.env` *before* `config/env.js`
 * is imported, rather than whatever real keys happen to be in a developer's
 * local `.env` — `.env` is gitignored and never present in CI or a fresh
 * clone, so a test that depended on it would be flaky by environment. This
 * also means the real Razorpay secret never needs to appear anywhere in this
 * file. `/order` mocks `global.fetch` (no network call, no real order created
 * per test run); `/verify`'s HMAC check is exercised against the fixture
 * secret set below.
 */

import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodha-billing-test-'));
process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
process.env.RAZORPAY_KEY_ID = 'rzp_test_fixture_key_id';
process.env.RAZORPAY_KEY_SECRET = 'fixture_test_secret_never_real';

let app: Express;
let closeDatabase: () => void;
let env: typeof import('../config/env.js').env;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  const [{ createApp }, dbModule, envModule] = await Promise.all([
    import('../app.js'),
    import('../models/db.js'),
    import('../config/env.js'),
  ]);
  app = createApp();
  closeDatabase = dbModule.closeDatabase;
  env = envModule.env;

  agent = request.agent(app);
  await agent.post('/api/auth/signup').send({
    email: 'billing-test@example.com',
    password: 'password12',
    name: 'Billing Tester',
  });
});

afterAll(() => {
  closeDatabase?.();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/billing/plan', () => {
  it('requires a session', async () => {
    await request(app).get('/api/billing/plan').expect(401);
  });

  it('reports the free plan and whether Razorpay is configured', async () => {
    const response = await agent.get('/api/billing/plan').expect(200);
    expect(response.body).toMatchObject({ plan: 'free', currency: 'INR' });
    expect(response.body.razorpayConfigured).toBe(
      Boolean(env.razorpayKeyId && env.razorpayKeySecret),
    );
  });
});

describe('POST /api/billing/order', () => {
  it('requires a session', async () => {
    await request(app).post('/api/billing/order').expect(401);
  });

  it('creates a real order via the Razorpay API (mocked) when keys are configured', async () => {
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => ({
      ok: true,
      json: async () => ({ id: 'order_mocked_123' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await agent.post('/api/billing/order').expect(200);
    expect(response.body).toMatchObject({
      mock: false,
      orderId: 'order_mocked_123',
      currency: 'INR',
      keyId: env.razorpayKeyId,
    });

    // Basic auth header must be base64(keyId:keySecret) — verified without
    // ever writing the secret into this file.
    const [, options] = fetchMock.mock.calls[0];
    const authHeader = (options.headers as Record<string, string>).Authorization;
    const expectedAuth =
      'Basic ' + Buffer.from(env.razorpayKeyId + ':' + env.razorpayKeySecret).toString('base64');
    expect(authHeader).toBe(expectedAuth);
  });

  it('surfaces a Razorpay error as a 400 instead of a raw 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: { description: 'Invalid currency' } }),
      })),
    );

    const response = await agent.post('/api/billing/order').expect(400);
    expect(response.body.error.message).toMatch(/invalid currency/i);
  });
});

describe('POST /api/billing/verify', () => {
  it('requires a session', async () => {
    await request(app).post('/api/billing/verify').expect(401);
  });

  it('rejects when the fields are missing', async () => {
    const response = await agent.post('/api/billing/verify').send({}).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('activates Pro when the HMAC signature matches', async () => {
    const orderId = 'order_test_abc';
    const paymentId = 'pay_test_xyz';
    // Computed from the same secret the server holds — never hardcoded here.
    const signature = createHmac('sha256', env.razorpayKeySecret)
      .update(orderId + '|' + paymentId)
      .digest('hex');

    const response = await agent
      .post('/api/billing/verify')
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      })
      .expect(200);

    expect(response.body.user.plan).toBe('pro');
    expect(response.body.user.credits.plan).toBe('pro');
  });

  it('rejects a forged or mismatched signature', async () => {
    const response = await agent
      .post('/api/billing/verify')
      .send({
        razorpay_order_id: 'order_test_abc',
        razorpay_payment_id: 'pay_test_xyz',
        razorpay_signature: 'not-the-real-signature',
      })
      .expect(400);

    expect(response.body.error.message).toMatch(/did not match/i);
  });

  it('does not grant Pro via the dev-order bypass once a real secret is configured', async () => {
    const response = await agent
      .post('/api/billing/verify')
      .send({
        razorpay_order_id: 'order_dev_should-not-work',
        razorpay_payment_id: 'pay_x',
        razorpay_signature: 'anything',
      })
      .expect(400);

    expect(response.body.error.message).toMatch(/did not match/i);
  });
});
