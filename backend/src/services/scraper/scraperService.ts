/**
 * scraperService — public façade over the per-platform Playwright adapters.
 *
 * Every call is serialised per platform (see queue.ts) so we never fire two
 * Amazon (or Flipkart, or Snapdeal) scrapes at once.
 */

import type { CategoryId, ComparableListing, PlatformId } from '../../types/index.js';
import { composeSearchQuery } from '../listingRelevance.js';
import { AmazonScraper } from './amazonScraper.js';
import { ScraperError } from './errors.js';
import { FlipkartScraper } from './flipkartScraper.js';
import { enqueueForPlatform } from './queue.js';
import { SnapdealScraper } from './snapdealScraper.js';
import type { MarketplaceScraper } from './types.js';

const scrapers: Record<'amazon' | 'flipkart' | 'snapdeal', MarketplaceScraper> = {
  amazon: new AmazonScraper(),
  flipkart: new FlipkartScraper(),
  snapdeal: new SnapdealScraper(),
};

export function hasLiveScraper(
  platformId: PlatformId,
): platformId is 'amazon' | 'flipkart' | 'snapdeal' {
  return platformId === 'amazon' || platformId === 'flipkart' || platformId === 'snapdeal';
}

export { composeSearchQuery };

export async function scrapeComparableListings(
  platformId: PlatformId,
  title: string,
  category: CategoryId,
): Promise<ComparableListing[]> {
  if (!hasLiveScraper(platformId)) {
    throw new ScraperError(
      'unsupported-platform',
      platformId + ' has no live search scraper in this build.',
    );
  }

  const scraper = scrapers[platformId];
  const query = composeSearchQuery(title, category);

  return enqueueForPlatform(platformId, () => scraper.search(query, category));
}

export { scrapers };
