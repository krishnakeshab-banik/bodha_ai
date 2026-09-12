/**
 * Brand + model matching: a Sony WH-1000XM5 must not be compared to ₹399 earpads.
 */

import { describe, expect, it } from 'vitest';

import {
  composeSearchQuery,
  extractProductIdentity,
  filterRelevantListings,
  hasSpecificProductIdentity,
  scoreListingTitle,
} from '../services/listingRelevance.js';
import { listingsToSnapshot } from '../services/snapshotFromListings.js';
import type { ComparableListing } from '../types/index.js';

function listing(title: string, price: number): ComparableListing {
  return { title, price, url: 'https://example.com/p' };
}

const SONY_TITLE = 'Sony WH-1000XM5';

const MIXED_SONY_RESULTS = [
  listing('Sony WH-1000XM5 Wireless Noise Cancelling Headphones', 26_990),
  listing('Sony WH-1000XM5, Black', 24_990),
  listing('Sony WH-1000XM5 Headphones Midnight Blue', 22_990),
  listing('Sony WH-1000XM5', 29_990),
  listing('Sony WH-1000XM4 Wireless Headphones', 19_990),
  listing('Replacement Ear Pads for Sony WH-1000XM5', 397),
  listing('Sony WH-1000XM5 Carrying Case', 899),
  listing('Silicone Ear Cushions WH-1000XM5', 1_200),
  listing('boAt Bassheads 100 Wired Earphones', 399),
  listing('Generic Bluetooth Headphones', 1_299),
  listing('USB C Fast Charging Cable', 499),
];

describe('extractProductIdentity', () => {
  it('reads brand + model from Sony WH-1000XM5, not just the category', () => {
    const identity = extractProductIdentity(SONY_TITLE);
    expect(identity.brand).toBe('sony');
    expect(identity.modelTokens).toContain('wh1000xm5');
    expect(identity.hasSpecificModel).toBe(true);
    expect(hasSpecificProductIdentity(SONY_TITLE)).toBe(true);
  });

  it('does not treat a generic cable as a specific model', () => {
    expect(hasSpecificProductIdentity('Braided USB-C Fast Charging Cable')).toBe(false);
  });
});

describe('composeSearchQuery', () => {
  it('does not append Electronics Accessories to a branded model', () => {
    expect(composeSearchQuery(SONY_TITLE, 'electronics-accessories')).toBe(SONY_TITLE);
  });

  it('still appends the category label for generic titles', () => {
    expect(composeSearchQuery('Braided charging cable', 'electronics-accessories')).toBe(
      'Braided charging cable Electronics Accessories',
    );
  });
});

describe('filterRelevantListings — Sony WH-1000XM5', () => {
  it('keeps the headphones and drops earpads, cases and generic cheap cards', () => {
    const kept = filterRelevantListings(MIXED_SONY_RESULTS, SONY_TITLE, { anchorPrice: 24_990 });
    const prices = kept.map((row) => row.price).sort((a, b) => a - b);

    expect(prices.every((price) => price >= 18_000)).toBe(true);
    expect(prices.every((price) => price <= 30_000)).toBe(true);
    expect(prices).not.toContain(397);
    expect(prices).not.toContain(899);
    expect(prices).not.toContain(1_299);
    expect(prices.length).toBeGreaterThanOrEqual(3);

    const titles = kept.map((row) => row.title.toLowerCase()).join(' | ');
    expect(titles).toMatch(/wh-1000xm5/);
    expect(titles).not.toMatch(/ear pads|carrying case|boat|usb c/);
  });

  it('scores an exact XM5 above a previous-gen equivalent, and accessories at 0', () => {
    const identity = extractProductIdentity(SONY_TITLE);
    expect(scoreListingTitle('Sony WH-1000XM5 Wireless Headphones', identity)).toBe(100);
    expect(scoreListingTitle('Sony WH-1000XM4 Wireless Headphones', identity)).toBe(70);
    expect(scoreListingTitle('Replacement Ear Pads for Sony WH-1000XM5', identity)).toBe(0);
    expect(scoreListingTitle('boAt Rockerz 255', identity)).toBe(0);
  });

  it('builds a snapshot in the premium-headphone band, not ₹397–₹1,900', () => {
    const snapshot = listingsToSnapshot(MIXED_SONY_RESULTS, 'live', '2026-01-01T00:00:00.000Z', {
      queryTitle: SONY_TITLE,
      anchorPrice: 24_990,
    });

    expect(snapshot.unavailable).toBe(false);
    const [min, max] = [
      Math.min(...snapshot.comparablePrices),
      Math.max(...snapshot.comparablePrices),
    ];
    expect(min).toBeGreaterThanOrEqual(18_000);
    expect(max).toBeLessThanOrEqual(30_000);
    expect(min).toBeGreaterThan(1_900);
    expect(snapshot.comparablePrices).not.toContain(397);
    const mid = [...snapshot.comparablePrices].sort((a, b) => a - b)[
      Math.floor(snapshot.comparablePrices.length / 2)
    ];
    expect(mid).toBeGreaterThan(18_000);
  });
});
