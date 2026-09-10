/**
 * Stored-report payloads for the ElevenLabs server tools.
 * These never scrape or re-run analysis.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnalysisRecord, CompetitorInsight, PlatformRecommendation } from '../types/index.js';

const findAnalysisById = vi.fn();

vi.mock('../models/productRepository.js', () => ({
  findAnalysisById: (...args: unknown[]) => findAnalysisById(...args),
}));

const { getCompetitorAnalysis, getPriceExplanation, getRegionalDemand, getReportSummary, getReviewSentiment } =
  await import('../services/voiceToolsService.js');

function platform(partial: Partial<PlatformRecommendation> = {}): PlatformRecommendation {
  return {
    id: 'amazon',
    name: 'Amazon',
    feePercent: 0.18,
    avgShippingFee: 60,
    isBulkMarketplace: false,
    marketPrice: 999,
    marketPriceRange: [899, 1199],
    breakEvenPrice: 547.8,
    recommendedPrice: 999,
    estimatedProfit: 359.18,
    profitMargin: 0.359,
    profitAvailable: true,
    profitError: null,
    competitionIndex: 70,
    demandIndex: 80,
    competition: 'High',
    demand: 'High',
    fitScore: 74.8,
    priceAction: 'increase',
    explanation:
      'Similar products on Amazon sell for around ₹999 (median of 5 live listings), but you are listed at ₹800.',
    lossRiskAvoided: false,
    unavailable: false,
    dataFreshness: 'live',
    lastUpdated: '2026-01-01T00:00:00.000Z',
    listingCount: 5,
    ...partial,
  };
}

function competitor(partial: Partial<CompetitorInsight> = {}): CompetitorInsight {
  return {
    title: 'USB C Cable Pro',
    price: 999,
    rating: 4.5,
    reviewCount: 1200,
    url: 'https://example.com/cable',
    thumbnail: null,
    strengths: ['4.5 rating from 1,200 reviews'],
    weaknesses: ['Priced above the seller at ₹999'],
    ...partial,
  };
}

function record(partial: Partial<AnalysisRecord> = {}): AnalysisRecord {
  return {
    productId: 'prod-1',
    title: 'USB C Fast Charging Cable',
    description: 'Nylon braided 1.5m cable.',
    category: 'electronics-accessories',
    imageUrl: null,
    manufacturingCost: 400,
    currentPrice: 800,
    recommendedPlatform: 'amazon',
    recommendedPrice: 999,
    platforms: [platform()],
    optimizedListing: { title: 'USB C cable', description: 'Fast charge.', keywords: ['usb-c'] },
    insights: {
      language: 'en',
      competitors: [],
      reviewSentiment: { available: false, topPraises: [], topComplaints: [] },
      regionalDemand: { available: false, states: [] },
      platformBenefits: ['FBA'],
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

beforeEach(() => {
  findAnalysisById.mockReset();
});

describe('voice tool payloads', () => {
  it('returns stored summary numbers from the winning platform', () => {
    findAnalysisById.mockReturnValue(record());

    expect(getReportSummary('prod-1', 'en')).toEqual({
      available: true,
      recommendedPlatform: 'Amazon',
      recommendedPrice: 999,
      fitScore: 74.8,
    });
  });

  it('rebuilds the price explanation in Hindi from stored numbers', () => {
    findAnalysisById.mockReturnValue(record());

    const payload = getPriceExplanation('prod-1', 'hi');
    expect(payload.available).toBe(true);
    if (!payload.available) return;
    expect(payload.breakEvenPrice).toBe(547.8);
    expect(payload.marketRange).toEqual([899, 1199]);
    expect(payload.priceAction).toBe('increase');
    expect(payload.explanation).toMatch(/माँग|लाभ|कीमत/);
    expect(payload.explanation).toContain('₹999');
  });

  it('returns stored competitors, and localizes SWOT when the language differs', () => {
    findAnalysisById.mockReturnValue(
      record({
        insights: {
          language: 'en',
          competitors: [
            competitor(),
            competitor({
              title: 'Budget USB C Cable',
              price: 399,
              rating: 3.8,
              reviewCount: 40,
              strengths: ['Lowest price in the set'],
              weaknesses: ['Thin review history'],
            }),
          ],
          reviewSentiment: { available: true, topPraises: ['fast charge'], topComplaints: ['short cable'] },
          regionalDemand: { available: false, states: [] },
          platformBenefits: [],
        },
      }),
    );

    const english = getCompetitorAnalysis('prod-1', 'en');
    expect(english.available).toBe(true);
    if (english.available) {
      expect(english.competitors[0]?.title).toBe('USB C Cable Pro');
      expect(english.competitors[0]?.strengths[0]).toBe('4.5 rating from 1,200 reviews');
    }

    const hindi = getCompetitorAnalysis('prod-1', 'hi');
    expect(hindi.available).toBe(true);
    if (hindi.available) {
      expect(hindi.competitors).toHaveLength(2);
      expect(hindi.competitors.some((card) => card.strengths.join(' ').match(/₹|रेटिंग|समीक्षा/))).toBe(true);
    }
  });

  it('returns a clear not-available payload when a section was never stored', () => {
    findAnalysisById.mockReturnValue(record());

    expect(getCompetitorAnalysis('prod-1', 'en')).toEqual({
      available: false,
      message: 'Competitor analysis is not available for this product.',
    });
    expect(getReviewSentiment('prod-1', 'ta')).toEqual({
      available: false,
      message: 'இந்தத் தயாரிப்புக்கான விமர்சன உணர்வு இல்லை.',
    });
    expect(getRegionalDemand('prod-1', 'hi')).toEqual({
      available: false,
      message: 'इस उत्पाद के लिए क्षेत्रीय माँग उपलब्ध नहीं है।',
    });
  });

  it('returns stored review and demand sections when they exist', () => {
    findAnalysisById.mockReturnValue(
      record({
        insights: {
          language: 'en',
          competitors: [],
          reviewSentiment: {
            available: true,
            topPraises: ['fast charge'],
            topComplaints: ['short cable'],
          },
          regionalDemand: {
            available: true,
            states: [
              { state: 'Maharashtra', interest: 88 },
              { state: 'Karnataka', interest: 71 },
            ],
          },
          platformBenefits: [],
        },
      }),
    );

    expect(getReviewSentiment('prod-1', 'en')).toEqual({
      available: true,
      topPraises: ['fast charge'],
      topComplaints: ['short cable'],
    });
    expect(getRegionalDemand('prod-1', 'en')).toEqual({
      available: true,
      topStates: [
        { state: 'Maharashtra', relativeInterest: 88 },
        { state: 'Karnataka', relativeInterest: 71 },
      ],
    });
  });

  it('does not fabricate a report for an unknown or missing productId', () => {
    findAnalysisById.mockReturnValue(null);

    expect(getReportSummary('', 'en')).toMatchObject({ available: false });
    expect(getReportSummary('missing', 'en')).toEqual({
      available: false,
      message: 'No stored report is available for this product.',
    });
    expect(findAnalysisById).toHaveBeenCalledTimes(1);
  });
});
