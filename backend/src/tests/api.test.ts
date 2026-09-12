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
// Fixture value, set before `config/env.js` loads, so these tests don't
// depend on whatever ELEVENLABS_TOOL_SECRET (if any) happens to be in a
// developer's local `.env` — `.env` is gitignored and absent in CI.
process.env.ELEVENLABS_TOOL_SECRET = 'fixture_tool_secret_never_real';
const TOOL_SECRET_HEADER = { 'x-tool-secret': process.env.ELEVENLABS_TOOL_SECRET };

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

    // The stored record round-trips through GET /:id unchanged, for the
    // seller who owns it.
    const fetched = await agent.get('/api/products/' + response.body.productId).expect(200);
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
    const response = await agent.get('/api/products/does-not-exist').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects an unauthenticated request with a 401', async () => {
    await request(app).get('/api/products/does-not-exist').expect(401);
  });

  it("returns 404 (not another seller's data) when the product belongs to someone else", async () => {
    // Dedicated sellers so this doesn't spend the shared `agent`'s free-analysis credits.
    const owner = request.agent(app);
    await owner.post('/api/auth/signup').send({
      email: 'owner-seller@example.com',
      password: 'password12',
      name: 'Owner Seller',
    });
    const created = await owner.post('/api/products/analyze').send(validBody).expect(201);

    const otherAgent = request.agent(app);
    await otherAgent.post('/api/auth/signup').send({
      email: 'other-seller@example.com',
      password: 'password12',
      name: 'Other Seller',
    });

    const response = await otherAgent.get('/api/products/' + created.body.productId).expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/products/:id/pdf', () => {
  it('requires a session', async () => {
    await request(app).get('/api/products/does-not-exist/pdf').expect(401);
  });

  it("returns a PDF for the report's owner, and 404 for anyone else", async () => {
    const owner = request.agent(app);
    await owner.post('/api/auth/signup').send({
      email: 'pdf-owner@example.com',
      password: 'password12',
      name: 'PDF Owner',
    });
    const created = await owner.post('/api/products/analyze').send(validBody).expect(201);

    const response = await owner
      .get('/api/products/' + created.body.productId + '/pdf')
      .expect(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.body.slice(0, 4).toString('latin1')).toBe('%PDF');

    const otherAgent = request.agent(app);
    await otherAgent.post('/api/auth/signup').send({
      email: 'pdf-other@example.com',
      password: 'password12',
      name: 'PDF Other',
    });
    const denied = await otherAgent
      .get('/api/products/' + created.body.productId + '/pdf')
      .expect(404);
    expect(denied.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /', () => {
  it('returns API status instead of a 404', async () => {
    const response = await request(app).get('/').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.health).toBe('/api/health');
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

describe('GET /api/voice-tools/*', () => {
  it('reads the stored report summary and price explanation without scraping', async () => {
    const created = await agent.post('/api/products/analyze').send(validBody).expect(201);
    const productId = created.body.productId as string;
    const winner = created.body.platforms.find(
      (platform: { id: string }) => platform.id === created.body.recommendedPlatform,
    );

    const summary = await request(app)
      .get('/api/voice-tools/report-summary')
      .set(TOOL_SECRET_HEADER)
      .query({ productId, language: 'en' })
      .expect(200);

    expect(summary.body).toEqual({
      available: true,
      recommendedPlatform: winner.name,
      recommendedPrice: winner.recommendedPrice,
      fitScore: winner.fitScore,
    });

    const price = await request(app)
      .get('/api/voice-tools/price-explanation')
      .set(TOOL_SECRET_HEADER)
      .query({ productId, language: 'hi' })
      .expect(200);

    expect(price.body.available).toBe(true);
    expect(price.body.breakEvenPrice).toBe(winner.breakEvenPrice);
    expect(price.body.marketRange).toEqual(winner.marketPriceRange);
    expect(price.body.priceAction).toBe(winner.priceAction);
    expect(price.body.explanation).toMatch(/माँग|लाभ|कीमत/);
  });

  it('returns a language-aware not-available payload when a section was never stored', async () => {
    const created = await agent.post('/api/products/analyze').send(validBody).expect(201);
    const productId = created.body.productId as string;

    const competitors = await request(app)
      .get('/api/voice-tools/competitor-analysis')
      .set(TOOL_SECRET_HEADER)
      .query({ productId, language: 'en' })
      .expect(200);
    expect(competitors.body).toEqual({
      available: false,
      message: 'Competitor analysis is not available for this product.',
    });

    const reviews = await request(app)
      .get('/api/voice-tools/review-sentiment')
      .set(TOOL_SECRET_HEADER)
      .query({ productId, language: 'ta' })
      .expect(200);
    expect(reviews.body.available).toBe(false);
    expect(reviews.body.message).toMatch(/விமர்சன/);

    const demand = await request(app)
      .get('/api/voice-tools/regional-demand')
      .set(TOOL_SECRET_HEADER)
      .query({ productId, language: 'hi' })
      .expect(200);
    expect(demand.body.available).toBe(false);
    expect(demand.body.message).toMatch(/माँग/);
  });

  it('returns stored competitor, review and demand sections when they exist', async () => {
    const created = await agent.post('/api/products/analyze').send(validBody).expect(201);
    const { updateInsights } = await import('../models/productRepository.js');
    updateInsights(created.body.productId, {
      language: 'en',
      competitors: [
        {
          title: 'Cable Pro',
          price: 999,
          rating: 4.5,
          reviewCount: 1200,
          url: 'https://example.com/cable',
          thumbnail: null,
          strengths: ['4.5 rating from 1,200 reviews'],
          weaknesses: ['Priced above the seller'],
        },
      ],
      reviewSentiment: {
        available: true,
        topPraises: ['fast charge'],
        topComplaints: ['short cable'],
      },
      regionalDemand: { available: true, states: [{ state: 'Maharashtra', interest: 88 }] },
      platformBenefits: [],
    });

    const competitors = await request(app)
      .get('/api/voice-tools/competitor-analysis')
      .set(TOOL_SECRET_HEADER)
      .query({ productId: created.body.productId, language: 'en' })
      .expect(200);
    expect(competitors.body).toMatchObject({
      available: true,
      competitors: [{ title: 'Cable Pro', price: 999, rating: 4.5 }],
    });

    const reviews = await request(app)
      .get('/api/voice-tools/review-sentiment')
      .set(TOOL_SECRET_HEADER)
      .query({ productId: created.body.productId })
      .expect(200);
    expect(reviews.body).toEqual({
      available: true,
      topPraises: ['fast charge'],
      topComplaints: ['short cable'],
    });

    const demand = await request(app)
      .get('/api/voice-tools/regional-demand')
      .set(TOOL_SECRET_HEADER)
      .query({ productId: created.body.productId })
      .expect(200);
    expect(demand.body).toEqual({
      available: true,
      topStates: [{ state: 'Maharashtra', relativeInterest: 88 }],
    });
  });

  it('does not invent data for a missing productId', async () => {
    const response = await request(app)
      .get('/api/voice-tools/report-summary')
      .set(TOOL_SECRET_HEADER)
      .query({ language: 'en' })
      .expect(200);

    expect(response.body).toEqual({
      available: false,
      message: 'No stored report is available for this product.',
    });
  });

  it('rejects a call with a missing or wrong x-tool-secret header', async () => {
    await request(app).get('/api/voice-tools/report-summary').query({ language: 'en' }).expect(401);

    await request(app)
      .get('/api/voice-tools/report-summary')
      .set({ 'x-tool-secret': 'not-the-real-secret' })
      .query({ language: 'en' })
      .expect(401);
  });

  it('returns a public agent id when no ElevenLabs API key is configured', async () => {
    const response = await request(app).get('/api/voice/session').expect(200);
    expect(response.body.agentId).toEqual(expect.any(String));
    expect(response.body.agentId.startsWith('agent_')).toBe(true);
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

  it('answers a site question without a live LLM', async () => {
    const response = await request(app)
      .post('/api/voice/query')
      .send({ text: 'How does Bodha AI work?', language: 'en' })
      .expect(200);

    expect(response.body.source).toBe('fallback');
    expect(response.body.language).toBe('en');
    expect(response.body.answer).toMatch(/Bodha AI/i);
  });

  it('uses the stored report when the seller is signed in', async () => {
    const created = await agent.post('/api/products/analyze').send(validBody).expect(201);
    const response = await agent
      .post('/api/voice/query')
      .send({
        text: 'Why did you recommend this marketplace?',
        language: 'en',
        context: { productId: created.body.productId },
      })
      .expect(200);

    expect(response.body.source).toBe('fallback');
    expect(response.body.language).toBe('en');
    expect(response.body.answer).toMatch(/fit|₹|Amazon|Flipkart|Snapdeal|USB/i);
  });

  it('answers an English price question in English from the latest analysis', async () => {
    await agent.post('/api/products/analyze').send(validBody).expect(201);
    const response = await agent
      .post('/api/voice/query')
      .send({ text: 'What price should I sell this product at?', language: 'hi' })
      .expect(200);

    expect(response.body.language).toBe('en');
    expect(response.body.answer).toMatch(/₹|USB|Amazon|Flipkart|Snapdeal/i);
    expect(response.body.answer).not.toMatch(/ब्रेक|के लिए/);
  });
});
