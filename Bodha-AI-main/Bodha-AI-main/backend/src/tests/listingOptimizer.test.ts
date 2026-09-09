/** Unit tests for the pure, rule-based listing optimizer. */

import { describe, expect, it } from 'vitest';

import { isUsingMockOptimizer, optimizeListing } from '../services/listingOptimizer.js';
import type { ListingOptimizerInput } from '../services/listingOptimizer.js';

const input: ListingOptimizerInput = {
  title: 'usb c fast charging cable',
  description: 'Nylon braided 1.5m cable that supports 65W charging and data transfer.',
  category: 'electronics-accessories',
  recommendedPlatform: 'amazon',
  recommendedPrice: 999,
};

describe('listingOptimizer', () => {
  it('runs the documented rule-based stub while no LLM key is configured', () => {
    expect(isUsingMockOptimizer()).toBe(true);
  });

  it('produces an SEO-shaped title within the marketplace character budget', async () => {
    const listing = await optimizeListing(input);

    expect(listing.title.length).toBeLessThanOrEqual(120);
    expect(listing.title).toMatch(/Electronics Accessories$/);
    expect(listing.title).toContain('Usb C Fast Charging Cable');
    expect(listing.title).not.toBe(input.title);
  });

  it('writes a three-part description that names the platform and price', async () => {
    const listing = await optimizeListing(input);

    expect(listing.description.split('\n\n')).toHaveLength(3);
    expect(listing.description).toContain('Amazon');
    expect(listing.description).toContain('999');
    expect(listing.description).toContain('65W charging');
  });

  it('returns between 3 and 5 unique keywords', async () => {
    const listing = await optimizeListing(input);

    expect(listing.keywords.length).toBeGreaterThanOrEqual(3);
    expect(listing.keywords.length).toBeLessThanOrEqual(5);
    expect(new Set(listing.keywords).size).toBe(listing.keywords.length);
    expect(listing.keywords).toContain('fast charging');
  });

  it('still meets the keyword floor for very sparse input', async () => {
    const listing = await optimizeListing({ ...input, title: 'Toy', description: 'A toy.' });
    expect(listing.keywords.length).toBeGreaterThanOrEqual(3);
  });

  it('writes Hindi benefit copy when language is hi', async () => {
    const listing = await optimizeListing({ ...input, language: 'hi' });
    expect(listing.description).toMatch(/रोज़मर्रा|श्रेणी|खरीदारों/);
    expect(listing.description).toContain('Amazon');
    expect(listing.description).toContain('999');
  });

  it('is pure - identical input always yields identical output', async () => {
    const first = await optimizeListing(input);
    const second = await optimizeListing(input);
    expect(first).toEqual(second);
  });
});
