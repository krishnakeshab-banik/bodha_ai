/**
 * Unit tests for the pure pricing engine.
 *
 * Snapshots are INJECTED — these tests never scrape and never read a mock
 * price table. The numbers below are fixture ComparableListing medians.
 */

import { describe, expect, it } from 'vitest';

import { CATEGORY_IDS } from '../data/categories.js';
import { PLATFORMS, PLATFORM_IDS } from '../data/platformConfig.js';
import {
  analyzePlatform,
  analyzePricing,
  calculateBreakEvenPrice,
  calculateEstimatedProfit,
  calculateFitScore,
  round,
  FIT_SCORE_WEIGHTS,
  median,
  normalizeProfit,
  resolvePriceAction,
  toIndexLevel,
  zeroProfitPrice,
} from '../services/pricingEngine.js';
import type { MarketSnapshot, PlatformId, PricingInput } from '../types/index.js';

/** Electronics Accessories on Amazon: comparables median to Rs.999. */
const ELECTRONICS_AMAZON_MEDIAN = 999;

function snapshot(prices: number[], extras: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    comparablePrices: prices,
    demandIndex: 80,
    competitionIndex: 75,
    dataFreshness: 'live',
    lastUpdated: '2026-01-01T00:00:00.000Z',
    listingCount: prices.length,
    unavailable: false,
    ...extras,
  };
}

const ELECTRONICS_AMAZON = snapshot([899, 949, 999, 1099, 1199]);
const ELECTRONICS_FLIPKART = snapshot([879, 929, 989, 1049, 1099], { demandIndex: 72 });
const ELECTRONICS_SNAPDEAL = snapshot([799, 849, 949, 999, 1049], { demandIndex: 60 });
const ELECTRONICS_ALIBABA = snapshot([499, 549, 640, 699, 749], { demandIndex: 50 });
const APPAREL_AMAZON = snapshot([649, 749, 829, 949, 1049], {
  demandIndex: 55,
  competitionIndex: 60,
});
const TOYS_ALIBABA = snapshot([250, 300, 350], { demandIndex: 25, competitionIndex: 20 });

const ELECTRONICS_ALL: Partial<Record<PlatformId, MarketSnapshot>> = {
  amazon: ELECTRONICS_AMAZON,
  flipkart: ELECTRONICS_FLIPKART,
  snapdeal: ELECTRONICS_SNAPDEAL,
  alibaba: ELECTRONICS_ALIBABA,
};

describe('Section 2.4 - required worked examples', () => {
  it('case 1: recommends INCREASING a Rs.800 price toward the ~Rs.1000 market rate', () => {
    const input: PricingInput = {
      manufacturingCost: 400,
      currentPrice: 800,
      category: 'electronics-accessories',
      selectedPlatforms: ['amazon', 'flipkart', 'snapdeal', 'alibaba'],
    };

    const result = analyzePricing(input, ELECTRONICS_ALL);
    const amazon = result.platforms.find((platform) => platform.id === 'amazon');

    expect(amazon).toBeDefined();
    if (!amazon) return;

    expect(amazon.marketPrice).toBe(ELECTRONICS_AMAZON_MEDIAN);
    expect(amazon.recommendedPrice).toBe(ELECTRONICS_AMAZON_MEDIAN);
    expect(amazon.recommendedPrice).toBeGreaterThan(950);
    expect(amazon.recommendedPrice).toBeLessThan(1050);
    expect(amazon.dataFreshness).toBe('live');
    expect(amazon.unavailable).toBe(false);

    expect(amazon.priceAction).toBe('increase');
    expect(amazon.lossRiskAvoided).toBe(false);
    expect(amazon.recommendedPrice).toBeGreaterThan(amazon.breakEvenPrice);

    expect(amazon.breakEvenPrice).toBeCloseTo(567.87, 1);
    // Profit is always at the seller's listed price (₹800), not the recommended ₹999.
    expect(amazon.estimatedProfit).toBeCloseTo(170.08, 2);
    expect(amazon.profitMargin).toBeCloseTo(0.2126, 3);
    expect(amazon.profitAvailable).toBe(true);
    expect(amazon.profitError).toBeNull();

    expect(amazon.demand).toBe('High');
    expect(amazon.explanation).toMatch(/high demand/i);
    expect(amazon.explanation).toMatch(/competitors who are already pricing higher/i);
    expect(amazon.explanation).toContain('999');

    expect(result.platforms).toHaveLength(4);
    expect(result.recommendedPlatform).toBe(result.platforms[0].id);
    for (let i = 1; i < result.platforms.length; i += 1) {
      expect(result.platforms[i - 1].fitScore).toBeGreaterThanOrEqual(result.platforms[i].fitScore);
    }
  });

  it('case 2: recommends DECREASING a Rs.1400 price, staying above break-even', () => {
    const input: PricingInput = {
      manufacturingCost: 400,
      currentPrice: 1400,
      category: 'electronics-accessories',
      selectedPlatforms: ['amazon', 'flipkart'],
    };

    const result = analyzePricing(input, {
      amazon: ELECTRONICS_AMAZON,
      flipkart: ELECTRONICS_FLIPKART,
    });

    for (const platform of result.platforms) {
      expect(platform.priceAction).toBe('decrease');
      expect(platform.recommendedPrice).toBeGreaterThan(platform.breakEvenPrice * 1.5);
      expect(platform.estimatedProfit).toBeGreaterThan(0);
      expect(platform.lossRiskAvoided).toBe(false);
      expect(platform.explanation).toMatch(/competitive/i);
      expect(platform.explanation).toMatch(/break-even/i);
    }

    const amazon = result.platforms.find((platform) => platform.id === 'amazon');
    expect(amazon?.recommendedPrice).toBe(ELECTRONICS_AMAZON_MEDIAN);
    expect(amazon?.breakEvenPrice).toBeCloseTo(567.87, 1);
  });

  it('case 3: never recommends below break-even when the market price is too low', () => {
    const input: PricingInput = {
      manufacturingCost: 900,
      currentPrice: 1000,
      category: 'toys',
      selectedPlatforms: ['alibaba'],
    };

    const result = analyzePricing(input, { alibaba: TOYS_ALIBABA });
    const alibaba = result.platforms[0];

    const expectedBreakEven = calculateBreakEvenPrice(
      900,
      PLATFORMS.alibaba.feePercent,
      PLATFORMS.alibaba.avgShippingFee,
    );

    expect(alibaba.marketPrice).toBe(300);
    expect(alibaba.marketPrice).toBeLessThan(alibaba.breakEvenPrice);
    expect(alibaba.recommendedPrice).toBe(alibaba.breakEvenPrice);
    expect(alibaba.recommendedPrice).toBeCloseTo(expectedBreakEven, 2);
    expect(alibaba.lossRiskAvoided).toBe(true);

    const commission = alibaba.recommendedPrice * PLATFORMS.alibaba.feePercent;
    expect(alibaba.recommendedPrice - commission).toBeGreaterThanOrEqual(900);

    // Profit stays on the seller's ₹1,000 list price (cost ₹900), not the floored recommendation.
    expect(alibaba.estimatedProfit).toBeCloseTo(21.9, 2);
    expect(alibaba.profitAvailable).toBe(true);

    expect(alibaba.explanation).toMatch(/refused to suggest a loss-making price/i);
  });
});

describe('loss prevention holds across every category and platform', () => {
  it('never returns a recommended price below break-even for any combination', () => {
    for (const category of CATEGORY_IDS) {
      for (const platform of PLATFORM_IDS) {
        for (const manufacturingCost of [50, 400, 900, 2500]) {
          const recommendation = analyzePlatform(
            {
              manufacturingCost,
              currentPrice: manufacturingCost * 2,
              category,
              selectedPlatforms: [platform],
            },
            platform,
            snapshot([100, 250, 400, 800, 1200]),
          );

          expect(recommendation.recommendedPrice).toBeGreaterThanOrEqual(
            recommendation.breakEvenPrice - 0.01,
          );

          const netOfCommission = recommendation.recommendedPrice * (1 - recommendation.feePercent);
          expect(netOfCommission).toBeGreaterThanOrEqual(manufacturingCost - 0.01);
        }
      }
    }
  });
});

describe('formula helpers', () => {
  it('median handles odd and even length inputs', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrow(/at least one value/);
  });

  it('grosses the manufacturing cost up by the commission plus GST on that commission, then adds shipping', () => {
    expect(calculateBreakEvenPrice(400, 0.18, 60)).toBeCloseTo(567.87, 1);
    expect(calculateBreakEvenPrice(400, 0, 0)).toBe(400);
    expect(() => calculateBreakEvenPrice(400, 1, 0)).toThrow(/below 1/);
  });

  it('computes profit net of commission, GST on that commission, shipping and cost', () => {
    expect(calculateEstimatedProfit(1000, 400, 0.2, 50)).toBeCloseTo(314, 5);

    const breakEven = calculateBreakEvenPrice(400, 0.18, 60);
    expect(calculateEstimatedProfit(breakEven, 400, 0.18, 60)).toBeCloseTo(-12.744, 3);

    const zeroProfit = zeroProfitPrice(400, 0.18, 60);
    expect(calculateEstimatedProfit(zeroProfit, 400, 0.18, 60)).toBeCloseTo(0, 6);
    expect(zeroProfit).toBeGreaterThan(breakEven);
  });

  it('weights fit score 40/30/30 across profit, competition and demand', () => {
    expect(
      FIT_SCORE_WEIGHTS.profit + FIT_SCORE_WEIGHTS.competition + FIT_SCORE_WEIGHTS.demand,
    ).toBeCloseTo(1, 10);

    expect(calculateFitScore(100, 0, 100)).toBeCloseTo(100, 6);
    expect(calculateFitScore(0, 100, 0)).toBeCloseTo(0, 6);
    expect(calculateFitScore(50, 60, 60)).toBeCloseTo(50, 6);
  });

  it('normalises profit against the target margin and clamps to 0-100', () => {
    expect(normalizeProfit(350, 1000)).toBeCloseTo(100, 6);
    expect(normalizeProfit(175, 1000)).toBeCloseTo(50, 6);
    expect(normalizeProfit(-100, 1000)).toBe(0);
    expect(normalizeProfit(1000, 1000)).toBe(100);
    expect(normalizeProfit(10, 0)).toBe(0);
  });

  it('applies a +/-10% dead-band before advising a re-price', () => {
    expect(resolvePriceAction(800, 1000)).toBe('increase');
    expect(resolvePriceAction(899, 1000)).toBe('increase');
    expect(resolvePriceAction(900, 1000)).toBe('hold');
    expect(resolvePriceAction(1000, 1000)).toBe('hold');
    expect(resolvePriceAction(1100, 1000)).toBe('hold');
    expect(resolvePriceAction(1101, 1000)).toBe('decrease');
  });

  it('buckets 0-100 indices into Low / Medium / High', () => {
    expect(toIndexLevel(0)).toBe('Low');
    expect(toIndexLevel(39)).toBe('Low');
    expect(toIndexLevel(40)).toBe('Medium');
    expect(toIndexLevel(69)).toBe('Medium');
    expect(toIndexLevel(70)).toBe('High');
    expect(toIndexLevel(100)).toBe('High');
  });
});

describe('analyzePricing input guards', () => {
  const base: PricingInput = {
    manufacturingCost: 400,
    currentPrice: 800,
    category: 'apparel',
    selectedPlatforms: ['amazon'],
  };

  it('rejects an empty marketplace selection', () => {
    expect(() => analyzePricing({ ...base, selectedPlatforms: [] }, {})).toThrow(/at least one/i);
  });

  it('rejects non-positive money values', () => {
    expect(() =>
      analyzePricing({ ...base, manufacturingCost: 0 }, { amazon: APPAREL_AMAZON }),
    ).toThrow(/greater than zero/i);
    expect(() => analyzePricing({ ...base, currentPrice: -5 }, { amazon: APPAREL_AMAZON })).toThrow(
      /greater than zero/i,
    );
  });

  it('reports the marketplace price range from the comparable listings', () => {
    const [amazon] = analyzePricing(base, { amazon: APPAREL_AMAZON }).platforms;
    expect(amazon.marketPriceRange).toEqual([649, 1049]);
    expect(amazon.marketPrice).toBe(829);
  });

  it('marks a platform unavailable instead of inventing zeros as a recommendation', () => {
    const [amazon] = analyzePricing(base, {
      amazon: {
        comparablePrices: [],
        demandIndex: 0,
        competitionIndex: 0,
        dataFreshness: 'unavailable',
        lastUpdated: null,
        listingCount: 0,
        unavailable: true,
      },
    }).platforms;
    expect(amazon.unavailable).toBe(true);
    expect(amazon.recommendedPrice).toBe(0);
    expect(amazon.explanation).toMatch(/temporarily unavailable/i);
    // Missing market data is not a fake ₹0 profit — seller cost/price still compute.
    expect(amazon.profitAvailable).toBe(true);
    expect(amazon.estimatedProfit).toBeCloseTo(170.08, 2);
    expect(amazon.explanation).toMatch(/estimated profit/i);
  });
});

describe('Sony WH-1000XM5 — seller price and matched-product market', () => {
  const SONY: PricingInput = {
    manufacturingCost: 18_000,
    currentPrice: 24_990,
    category: 'electronics-accessories',
    selectedPlatforms: ['amazon', 'flipkart', 'snapdeal'],
  };

  const SONY_PRICES = [19_990, 22_990, 24_990, 26_990, 29_990];

  it('uses the seller cost and ₹24,990 price for profit, never a silent zero', () => {
    const result = analyzePricing(SONY, {
      amazon: snapshot(SONY_PRICES, { demandIndex: 85, competitionIndex: 60 }),
      flipkart: snapshot([21_990, 23_990, 24_990, 26_490], {
        demandIndex: 78,
        competitionIndex: 55,
      }),
      snapdeal: snapshot([19_490, 22_490, 24_490], { demandIndex: 50, competitionIndex: 35 }),
    });

    const amazon = result.platforms.find((platform) => platform.id === 'amazon');
    expect(amazon).toBeDefined();
    if (!amazon) return;

    expect(amazon.marketPrice).toBe(24_990);
    expect(amazon.marketPriceRange[0]).toBeGreaterThanOrEqual(18_000);
    expect(amazon.marketPriceRange[1]).toBeLessThanOrEqual(30_000);
    expect(amazon.marketPriceRange[0]).not.toBeLessThan(10_000);

    const expectedAmazonProfit = calculateEstimatedProfit(
      24_990,
      18_000,
      PLATFORMS.amazon.feePercent,
      PLATFORMS.amazon.avgShippingFee,
    );
    expect(amazon.estimatedProfit).toBeCloseTo(expectedAmazonProfit, 2);
    expect(amazon.estimatedProfit).toBeCloseTo(1622.12, 1);
    expect(amazon.estimatedProfit).not.toBe(0);
    expect(amazon.profitAvailable).toBe(true);
    expect(amazon.profitMargin).toBeGreaterThan(0);
    expect(amazon.priceAction).toBe('hold');
    expect(amazon.fitScore).toBeGreaterThan(20);

    for (const platform of result.platforms) {
      expect(platform.profitAvailable).toBe(true);
      expect(platform.estimatedProfit).toBe(
        round(
          calculateEstimatedProfit(24_990, 18_000, platform.feePercent, platform.avgShippingFee),
        ),
      );
      expect(platform.marketPriceRange[0]).toBeGreaterThanOrEqual(18_000);
    }

    expect(result.recommendedPlatform).toBe(result.platforms[0].id);
    expect(result.platforms[0].unavailable).toBe(false);
  });
});
