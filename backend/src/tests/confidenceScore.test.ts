import { describe, expect, it } from 'vitest';

import {
  attachConfidenceScores,
  classifyTitleMatch,
  confidenceLevel,
  computeDataConfidence,
} from '../services/confidenceScore.js';
import type { ComparableListing, PlatformRecommendation } from '../types/index.js';

function listing(title: string): ComparableListing {
  return { title, price: 999, url: 'https://www.amazon.in/dp/B0TEST0001' };
}

function platform(partial: Partial<PlatformRecommendation> = {}): PlatformRecommendation {
  return {
    id: 'amazon',
    name: 'Amazon',
    feePercent: 0.18,
    avgShippingFee: 60,
    isBulkMarketplace: false,
    marketPrice: 999,
    marketPriceRange: [899, 1199],
    breakEvenPrice: 548,
    recommendedPrice: 999,
    estimatedProfit: 170,
    profitMargin: 0.21,
    profitAvailable: true,
    profitError: null,
    competitionIndex: 40,
    demandIndex: 60,
    competition: 'Medium',
    demand: 'Medium',
    fitScore: 70,
    priceAction: 'hold',
    explanation: 'test',
    lossRiskAvoided: false,
    unavailable: false,
    dataFreshness: 'live',
    dataSource: 'live',
    scrapeStatus: 'OK',
    lastUpdated: '2026-09-13T00:00:00.000Z',
    listingCount: 16,
    ...partial,
  };
}

describe('confidence from real listing data', () => {
  it('scores High when many live listings closely match a branded model', () => {
    const listings = Array.from({ length: 16 }, () => listing('Sony WH-1000XM5 Wireless Headphones'));
    const result = computeDataConfidence('Sony WH-1000XM5', 16, 'live', listings);
    expect(result.level).toBe('High');
    expect(result.titleMatch).toBe('exact');
    expect(result.listingCount).toBe(16);
    expect(result.freshness).toBe('live');
  });

  it('scores Low when few cached listings are only category-level', () => {
    const listings = [
      listing('Generic gadget accessory pack'),
      listing('Home electronics bundle'),
      listing('Daily use item'),
    ];
    const result = computeDataConfidence('USB C Fast Charging Cable', 3, 'cached', listings);
    expect(result.level).toBe('Low');
    expect(result.titleMatch).toBe('category');
    expect(confidenceLevel(3, 'category', 'cached')).toBe('Low');
  });

  it('classifies USB-C cable titles with shared tokens as closer than unrelated cards', () => {
    const close = classifyTitleMatch('USB C Fast Charging Cable', [
      listing('USB C Fast Charging Cable 1m Braided'),
      listing('USB-C Fast Charging Cable Nylon'),
    ]);
    const far = classifyTitleMatch('USB C Fast Charging Cable', [
      listing('Cotton kitchen towel set'),
      listing('Kids puzzle toy box'),
    ]);
    expect(close.titleMatch).not.toBe('category');
    expect(far.titleMatch).toBe('category');
    expect(close.avgTokenOverlap).toBeGreaterThan(far.avgTokenOverlap);
  });

  it('attaches per-platform confidence from that run’s listings', () => {
    const scored = attachConfidenceScores(
      [
        platform({ id: 'amazon', listingCount: 16 }),
        platform({
          id: 'flipkart',
          name: 'Flipkart',
          listingCount: 3,
          dataFreshness: 'cached',
          dataSource: 'cached',
        }),
      ],
      'Sony WH-1000XM5',
      {
        amazon: Array.from({ length: 16 }, () => listing('Sony WH-1000XM5 Headphones')),
        flipkart: [listing('Phone case'), listing('Charger stand'), listing('Earpads')],
      },
    );
    expect(scored[0].confidence?.level).toBe('High');
    expect(scored[1].confidence?.level).toBe('Low');
  });
});
