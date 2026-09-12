import { describe, expect, it, vi } from 'vitest';

import {
  analyzeReviewSentiment,
  meetsReviewThreshold,
  MIN_REVIEW_SNIPPETS,
  toReviewPageUrl,
  usableSnippetCount,
} from '../services/reviewSentiment.js';

vi.mock('../services/geminiService.js', () => ({
  hasGeminiKey: () => false,
  generateJson: async () => {
    throw new Error('Gemini must not run in this test');
  },
}));

describe('review sentiment threshold', () => {
  it('uses a defined minimum of 3–5 real snippets', () => {
    expect(MIN_REVIEW_SNIPPETS).toBeGreaterThanOrEqual(3);
    expect(MIN_REVIEW_SNIPPETS).toBeLessThanOrEqual(5);
    expect(meetsReviewThreshold(MIN_REVIEW_SNIPPETS - 1)).toBe(false);
    expect(meetsReviewThreshold(MIN_REVIEW_SNIPPETS)).toBe(true);
  });

  it('counts only distinct snippets of usable length', () => {
    expect(
      usableSnippetCount(['too short', 'A real buyer snippet about cable quality.', 'A real buyer snippet about cable quality.']),
    ).toBe(1);
  });

  it('returns an honest empty state below the threshold — no hardcoded themes', async () => {
    const result = await analyzeReviewSentiment(
      ['Great build quality and fast charging for daily use.', 'Stopped working after a week of light use.'],
      'en',
    );
    expect(result).toEqual({ available: false, topPraises: [], topComplaints: [] });
  });

  it('does not invent praises when Gemini is unavailable even with enough snippets', async () => {
    const result = await analyzeReviewSentiment(
      [
        'The cable feels sturdy and charges my phone quickly every day.',
        'Packaging was neat but delivery took longer than promised here.',
        'Value for money is good compared with other USB-C cables I own.',
        'The connector got loose after two weeks of regular office use.',
      ],
      'en',
    );
    expect(result.available).toBe(false);
    expect(result.topPraises).toEqual([]);
    expect(result.topComplaints).toEqual([]);
  });
});

describe('toReviewPageUrl', () => {
  it('maps Amazon product URLs onto the reviews page', () => {
    expect(toReviewPageUrl('amazon', 'https://www.amazon.in/foo/dp/B0ABCD1234/ref=sr')).toBe(
      'https://www.amazon.in/product-reviews/B0ABCD1234',
    );
  });

  it('maps Flipkart product URLs onto the reviews page', () => {
    expect(
      toReviewPageUrl(
        'flipkart',
        'https://www.flipkart.com/boat-cable/p/itmabc123?pid=ACC',
      ),
    ).toBe('https://www.flipkart.com/boat-cable/product-reviews/itmabc123?pid=ACC');
  });
});
