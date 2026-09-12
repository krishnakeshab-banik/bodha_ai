/** Unit tests for language-aware pricing explanations. */

import { describe, expect, it } from 'vitest';

import { localizeExplanation } from '../services/explanationI18n.js';
import type { PlatformRecommendation } from '../types/index.js';

const platform: PlatformRecommendation = {
  id: 'flipkart',
  name: 'Flipkart',
  feePercent: 0.15,
  avgShippingFee: 50,
  isBulkMarketplace: false,
  marketPrice: 989,
  marketPriceRange: [879, 1099],
  breakEvenPrice: 520.59,
  recommendedPrice: 989,
  estimatedProfit: 390.65,
  profitMargin: 0.395,
  profitAvailable: true,
  profitError: null,
  competitionIndex: 55,
  demandIndex: 80,
  competition: 'Medium',
  demand: 'High',
  fitScore: 78.4,
  priceAction: 'increase',
  explanation:
    'Similar products on Flipkart sell for around ₹989 (median of 12 live listings), but you are listed at ₹800.',
  lossRiskAvoided: false,
  unavailable: false,
  dataFreshness: 'live',
  lastUpdated: '2026-01-01T00:00:00.000Z',
  listingCount: 12,
};

describe('localizeExplanation', () => {
  it('keeps the English engine paragraph for en', () => {
    expect(localizeExplanation(platform, 'en', 800)).toBe(platform.explanation);
  });

  it('rebuilds Hindi copy from the same numbers, not a post-hoc translation of English prose', () => {
    const hindi = localizeExplanation(platform, 'hi', 800);
    expect(hindi).toContain('Flipkart');
    expect(hindi).toContain('₹989');
    expect(hindi).toContain('12');
    expect(hindi).toMatch(/माँग|लाभ|कीमत/);
    expect(hindi).not.toMatch(/raising your price/i);
  });

  it('rebuilds Tamil copy from the same numbers', () => {
    const tamil = localizeExplanation(platform, 'ta', 800);
    expect(tamil).toContain('Flipkart');
    expect(tamil).toContain('₹989');
    expect(tamil).toMatch(/தேவை|லாபம்|விலை/);
    expect(tamil).not.toMatch(/raising your price/i);
  });
});
