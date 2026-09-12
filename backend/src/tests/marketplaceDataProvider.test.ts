/**
 * Heuristic tests for listings → market snapshot.
 * No network. Fixtures only.
 */

import { describe, expect, it } from 'vitest';

import { COMPETITION_RESULT_CAP, listingsToSnapshot } from '../services/snapshotFromListings.js';
import type { ComparableListing } from '../types/index.js';

function listing(price: number, extras: Partial<ComparableListing> = {}): ComparableListing {
  return {
    title: 'Test listing',
    price,
    url: 'https://example.com/p',
    ...extras,
  };
}

describe('listingsToSnapshot', () => {
  it('takes comparable prices straight from the listings', () => {
    const snapshot = listingsToSnapshot(
      [listing(899), listing(999), listing(1199)],
      'live',
      '2026-01-01T00:00:00.000Z',
    );
    expect(snapshot.unavailable).toBe(false);
    expect(snapshot.comparablePrices).toEqual([899, 999, 1199]);
    expect(snapshot.dataFreshness).toBe('live');
    expect(snapshot.listingCount).toBe(3);
  });

  it('maps average reviewCount onto demandIndex with a log scale', () => {
    const none = listingsToSnapshot([listing(100), listing(200)], 'live', null);
    // No reviews and no ratings → conservative Medium floor of 40.
    expect(none.demandIndex).toBe(40);

    const high = listingsToSnapshot(
      [listing(100, { reviewCount: 8000 }), listing(200, { reviewCount: 12000 })],
      'live',
      null,
    );
    expect(high.demandIndex).toBeGreaterThanOrEqual(70);
  });

  it('maps listing count onto competitionIndex against the scrape cap', () => {
    const few = listingsToSnapshot([listing(100), listing(200), listing(300)], 'cached', null);
    expect(few.competitionIndex).toBeCloseTo((100 * 3) / COMPETITION_RESULT_CAP, 1);

    const many = listingsToSnapshot(
      Array.from({ length: 20 }, (_, index) => listing(500 + index)),
      'live',
      null,
    );
    expect(many.competitionIndex).toBe(100);
  });

  it('drops extreme outlier prices before building the snapshot', () => {
    const snapshot = listingsToSnapshot(
      [listing(180), listing(200), listing(220), listing(199), listing(47399)],
      'live',
      null,
    );
    expect(snapshot.comparablePrices).not.toContain(47399);
    expect(snapshot.listingCount).toBe(4);
  });

  it('returns unavailable when every listing lacks a price', () => {
    const snapshot = listingsToSnapshot([], 'live', null);
    expect(snapshot.unavailable).toBe(true);
    expect(snapshot.dataFreshness).toBe('unavailable');
  });

  it('drops accessory and generic cards when the query is Sony WH-1000XM5', () => {
    const snapshot = listingsToSnapshot(
      [
        listing(26_990, { title: 'Sony WH-1000XM5 Wireless Headphones' }),
        listing(24_990, { title: 'Sony WH-1000XM5' }),
        listing(22_990, { title: 'Sony WH-1000XM5 Midnight Blue' }),
        listing(397, { title: 'Replacement Ear Pads for Sony WH-1000XM5' }),
        listing(1_299, { title: 'Generic Bluetooth Headphones' }),
      ],
      'live',
      null,
      { queryTitle: 'Sony WH-1000XM5', anchorPrice: 24_990 },
    );

    expect(snapshot.unavailable).toBe(false);
    expect(Math.min(...snapshot.comparablePrices)).toBeGreaterThanOrEqual(18_000);
    expect(Math.max(...snapshot.comparablePrices)).toBeLessThanOrEqual(30_000);
    expect(snapshot.comparablePrices).not.toContain(397);
  });
});
