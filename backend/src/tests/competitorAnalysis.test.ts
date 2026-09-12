import { describe, expect, it } from 'vitest';

import {
  buildDistinctInsights,
  insightsAreDistinct,
  provenScore,
  rankCompetitors,
} from '../services/competitorAnalysis.js';
import type { ComparableListing, ReviewSentiment } from '../types/index.js';

function listing(
  partial: Partial<ComparableListing> & { title: string; price: number },
): ComparableListing {
  return { url: 'https://example.com/' + partial.title, ...partial };
}

describe('rankCompetitors', () => {
  it('prefers proven listings over cheap unreviewed ones', () => {
    const ranked = rankCompetitors([
      listing({ title: 'Cheap cable', price: 99, rating: 3.2, reviewCount: 4 }),
      listing({ title: 'Established cable', price: 499, rating: 4.4, reviewCount: 12000 }),
      listing({ title: 'Mid cable', price: 299, rating: 4.1, reviewCount: 80 }),
    ]);

    expect(ranked[0]?.title).toBe('Established cable');
    expect(provenScore(ranked[0]!)).toBeGreaterThan(provenScore(ranked[1]!));
    expect(ranked).toHaveLength(3);
  });
});

describe('buildDistinctInsights', () => {
  const sentiment: ReviewSentiment = {
    available: true,
    topPraises: ['battery life', 'comfort'],
    topComplaints: ['earpad wear', 'app pairing'],
  };

  it('gives each Sony competitor different strengths and weaknesses', () => {
    const cards = buildDistinctInsights(
      [
        listing({
          title: 'Sony WH-1000XM5 Wireless Headphones',
          price: 26_990,
          rating: 4.6,
          reviewCount: 12_400,
        }),
        listing({
          title: 'Sony WH-1000XM5 Midnight Blue',
          price: 22_990,
          rating: 4.4,
          reviewCount: 3_200,
        }),
        listing({
          title: 'Sony WH-1000XM4 Wireless Headphones',
          price: 19_990,
          rating: 4.5,
          reviewCount: 8_000,
        }),
      ],
      sentiment,
      'en',
      24_990,
    );

    expect(cards).toHaveLength(3);
    expect(insightsAreDistinct(cards)).toBe(true);

    const strengths = cards.map((card) => card.strengths.join(' | '));
    const weaknesses = cards.map((card) => card.weaknesses.join(' | '));
    expect(new Set(strengths).size).toBe(3);
    expect(new Set(weaknesses).size).toBe(3);

    expect(cards[0].strengths.join(' ')).toMatch(/4\.6|12,400|12.400|reviewed|rating/i);
    expect(cards[2].weaknesses.join(' ')).toMatch(/XM4|older|19,990|19.990/i);
    expect(cards.every((card) => card.strengths.length >= 2)).toBe(true);
    expect(cards.every((card) => card.weaknesses.length >= 2)).toBe(true);
  });
});
