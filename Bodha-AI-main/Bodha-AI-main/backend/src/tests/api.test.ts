/**
 * Integration tests for the REST contract (Section 7 of the spec).
 * Runs against a throwaway SQLite file so it never touches demo data.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

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
  const snapshot = (prices: number[]) => ({
    comparablePrices: prices,
    demandIndex: 80,
    competitionIndex: 70,
    dataFreshness: 'live' as const,
    lastUpdated: '2026-01-01T00:00:00.000Z',
    listingCount: prices.length,
    unavailable: false,
  });

  const table = {
    amazon: snapshot([899, 949, 999, 1099, 1199]),
    flipkart: snapshot([879, 929, 989, 1049, 1099]),
    snapdeal: snapshot([799, 849, 949, 999, 1049]),
    alibaba: snapshot([499, 549, 640, 699, 749]),
  };

  return {
    getMarketSnapshots: async ({ platforms }: { platforms: Array<keyof typeof table> }) => {
      const out: Record<string, (typeof table)[keyof typeof table]> = {};
      for (const platform of platforms) {
        out[platform] = table[platform] ?? table.amazon;
      }
      return out;
    },
    getMarketData: async ({ platforms }: { platforms: Array<keyof typeof table> }) => {
      const snapshots: Record<string, (typeof table)[keyof typeof table]> = {};
      const listings: Record<string, never[]> = {};
      for (const platform of platforms) {
        snapshots[platform] = table[platform] ?? table.amazon;
        listings[platform] = [];
      }
      return { snapshots, listings };
    },
    getCachedListings: () => [],
  };
});

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodha-test-'));
process.env.DATABASE_PATH = path.join(tempDir, 'test.db');

let app: Express;
let closeDatabase: () => void;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  // Imported after DATABASE_PATH is set so the test DB is used.
  const [{ createApp }, dbModule] = await Promise.all([
    import('../app.js'),
    import('../models/db.js'),
  ]);
  app = createApp();
  closeDatabase = dbModule.closeDatabase;
  agent = request.agent(app);
  await agent.post('/api/auth/signup').send({
    email: 'seller@example.com',
    password: 'password12',
    name: 'Test Seller',
  });
});

afterAll(() => {
  closeDatabase?.();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const validBody = {
  title: 'USB C Fast Charging Cable',
  description: 'Nylon braided 1.5m cable supporting 65W fast charge and data sync.',
  category: 'electronics-accessories',
  imageUrl: null,
  manufacturingCost: 400,
  currentPrice: 800,
  platforms: ['amazon', 'flipkart', 'snapdeal', 'alibaba'],
};

describe('POST /api/products/analyze', () => {
  it('returns the documented response shape and persists the analysis', async () => {
    const response = await agent.post('/api/products/analyze').send(validBody).expect(201);

    expect(response.body).toMatchObject({
      productId: expect.any(String),
      recommendedPlatform: expect.any(String),
      optimizedListing: {
        title: expect.any(String),
        description: expect.any(String),
        keywords: expect.any(Array),
      },
    });
    expect(response.body.platforms).toHaveLength(4);
    expect(response.body.insights).toMatchObject({
      competitors: [],
      reviewSentiment: { available: false, topPraises: [], topComplaints: [] },
      regionalDemand: { available: false, states: [] },
      platformBenefits: expect.any(Array),
    });
    expect(response.body.insights.platformBenefits.length).toBeGreaterThan(0);

    for (const platform of response.body.platforms) {
      expect(platform).toMatchObject({
        name: expect.any(String),
        feePercent: expect.any(Number),
        marketPriceRange: expect.any(Array),
        recommendedPrice: expect.any(Number),
        breakEvenPrice: expect.any(Number),
        estimatedProfit: expect.any(Number),
        profitMargin: expect.any(Number),
        competition: expect.stringMatching(/^(Low|Medium|High)$/),
        demand: expect.stringMatching(/^(Low|Medium|High)$/),
        fitScore: expect.any(Number),
        priceAction: expect.stringMatching(/^(increase|decrease|hold)$/),
        explanation: expect.any(String),
        lossRiskAvoided: expect.any(Boolean),
        dataFreshness: expect.stringMatching(/^(live|cached|unavailable)$/),
        unavailable: expect.any(Boolean),
      });
      expect(platform.marketPriceRange).toHaveLength(2);
      if (!platform.unavailable) {
        expect(platform.recommendedPrice).toBeGreaterThanOrEqual(platform.breakEvenPrice - 0.01);
      }
    }

    // The stored record round-trips through GET /:id unchanged.
    const fetched = await request(app)
      .get('/api/products/' + response.body.productId)
      .expect(200);
    expect(fetched.body.productId).toBe(response.body.productId);
    expect(fetched.body.platforms).toEqual(response.body.platforms);

    // ...and shows up in history.
    const history = await agent.get('/api/products/history').expect(200);
    const entry = history.body.find(
      (item: { productId: string }) => item.productId === response.body.productId,
    );
    expect(entry).toMatchObject({
      title: validBody.title,
      recommendedPlatform: response.body.recommendedPlatform,
      recommendedPrice: response.body.recommendedPrice,
    });
  });

  it('rejects a manufacturing cost above the selling price with a 400', async () => {
    const response = await agent
      .post('/api/products/analyze')
      .send({ ...validBody, manufacturingCost: 900, currentPrice: 800 })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toMatch(/lower than the current selling price/i);
  });

  it('rejects an empty marketplace selection with a 400', async () => {
    const response = await agent
      .post('/api/products/analyze')
      .send({ ...validBody, platforms: [] })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toMatch(/at least one marketplace/i);
  });

  it('rejects negative money values with a 400', async () => {
    await agent
      .post('/api/products/analyze')
      .send({ ...validBody, manufacturingCost: -1 })
      .expect(400);
  });
});

describe('GET /api/products/:id', () => {
  it('returns a structured 404 for an unknown product', async () => {
    const response = await request(app).get('/api/products/does-not-exist').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/meta', () => {
  it('lists the five seeded categories and four marketplaces', async () => {
    const response = await request(app).get('/api/meta').expect(200);
    expect(response.body.categories).toHaveLength(5);
    expect(response.body.platforms).toHaveLength(4);
    expect(response.body.platforms[0].benefits.length).toBeGreaterThan(0);
  });
});

describe('POST /api/products/insight', () => {
  it('returns a non-confident result without fabricating a listing', async () => {
    const response = await agent
      .post('/api/products/insight')
      .send({ imageUrl: 'https://example.com/not-a-product-photo.jpg', language: 'en' })
      .expect(200);

    expect(response.body).toEqual({
      confident: false,
      suggestedTitle: null,
      suggestedDescription: null,
      suggestedCategory: null,
    });
  });
});

describe('POST /api/voice/query', () => {
  it('rejects an empty question with a 400', async () => {
    const response = await request(app)
      .post('/api/voice/query')
      .send({ text: '', language: 'en' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('answers a scoped marketplace question without calling a live LLM', async () => {
    const created = await agent.post('/api/products/analyze').send(validBody).expect(201);

    const response = await agent
      .post('/api/voice/query')
      .send({
        text: 'Why did you recommend this marketplace?',
        language: 'en',
        context: { productId: created.body.productId, page: 'report' },
      })
      .expect(200);

    expect(response.body.answer).toEqual(expect.any(String));
    expect(response.body.answer.length).toBeGreaterThan(20);
    expect(response.body.language).toBe('en');
    expect(response.body.source).toBe('fallback');
    expect(response.body.answer).toMatch(/fit score|40%/i);
  });

  it('declines an off-topic question', async () => {
    const response = await request(app)
      .post('/api/voice/query')
      .send({ text: 'What is the capital of France?', language: 'en' })
      .expect(200);

    expect(response.body.answer).toMatch(/only help with Bodha AI/i);
  });
});
