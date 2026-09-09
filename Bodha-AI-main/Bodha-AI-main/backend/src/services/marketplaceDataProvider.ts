/**
 * MarketplaceDataProvider — the only module the analysis service goes through
 * for comparable-listing numbers. It never reads hardcoded prices.
 *
 * Flow per platform:
 *   fresh cache (< CACHE_TTL_HOURS)  → use it, dataFreshness: "cached"
 *   otherwise scrape live            → store, dataFreshness: "live"
 *   scrape fails + stale cache       → use stale, dataFreshness: "cached"
 *   scrape fails + no cache          → unavailable
 *
 * demandIndex / competitionIndex derivation is documented in snapshotFromListings.ts.
 */

import type { CategoryId, ComparableListing, MarketSnapshot, PlatformId } from '../types/index.js';
import { readCache, writeCache } from './cacheService.js';
import { filterRelevantListings, hasSpecificProductIdentity } from './listingRelevance.js';
import { isScraperError } from './scraper/errors.js';
import { hasLiveScraper, scrapeComparableListings } from './scraper/scraperService.js';
import { emptySnapshot, listingsToSnapshot } from './snapshotFromListings.js';

export interface SnapshotRequest {
  title: string;
  category: CategoryId;
  platforms: PlatformId[];
  /** Seller's listed price — keeps comparables in the right price band. */
  currentPrice?: number;
}

export interface MarketData {
  snapshots: Record<PlatformId, MarketSnapshot>;
  listings: Partial<Record<PlatformId, ComparableListing[]>>;
}

export { listingsToSnapshot, emptySnapshot, DEMAND_REVIEW_SATURATION, COMPETITION_RESULT_CAP } from './snapshotFromListings.js';

function prepareListings(
  listings: ComparableListing[],
  title: string,
  currentPrice?: number,
): ComparableListing[] {
  return filterRelevantListings(listings, title, { anchorPrice: currentPrice });
}

function toSnapshot(
  listings: ComparableListing[],
  freshness: 'live' | 'cached',
  lastUpdated: string | null,
  title: string,
  currentPrice?: number,
): { snapshot: MarketSnapshot; listings: ComparableListing[] } {
  const relevant = prepareListings(listings, title, currentPrice);
  return {
    snapshot: listingsToSnapshot(relevant, freshness, lastUpdated, {
      queryTitle: title,
      anchorPrice: currentPrice,
    }),
    listings: relevant,
  };
}

async function dataForPlatform(
  platformId: PlatformId,
  title: string,
  category: CategoryId,
  currentPrice?: number,
): Promise<{ snapshot: MarketSnapshot; listings: ComparableListing[] }> {
  if (!hasLiveScraper(platformId)) {
    return { snapshot: emptySnapshot('unavailable', null), listings: [] };
  }

  const cached = readCache(platformId, category, title);
  if (cached?.fresh) {
    const prepared = toSnapshot(cached.listings, 'cached', cached.fetchedAt, title, currentPrice);
    const cacheIsJunk =
      hasSpecificProductIdentity(title) &&
      cached.listings.length > 0 &&
      prepared.listings.length === 0;
    if (!cacheIsJunk) {
      console.log(
        '[bodha-ai] cache HIT (fresh) ' +
          platformId +
          ' (' +
          prepared.listings.length +
          ' matched / ' +
          cached.listings.length +
          ' raw)',
      );
      return prepared;
    }
    console.log('[bodha-ai] cache HIT but 0 matched listings for "' + title + '" — re-scraping ' + platformId);
  }

  try {
    console.log('[bodha-ai] scraping LIVE ' + platformId + ' for "' + title + '"');
    const listings = await scrapeComparableListings(platformId, title, category);
    const fetchedAt = new Date().toISOString();
    writeCache(platformId, category, title, listings, fetchedAt);
    const prepared = toSnapshot(listings, 'live', fetchedAt, title, currentPrice);
    console.log(
      '[bodha-ai] scrape OK ' +
        platformId +
        ' — ' +
        prepared.listings.length +
        ' matched / ' +
        listings.length +
        ' raw',
    );
    return prepared;
  } catch (error) {
    const reason = isScraperError(error) ? error.code + ': ' + error.message : String(error);
    console.warn('[bodha-ai] scrape FAIL ' + platformId + ' — ' + reason);

    if (cached) {
      console.log('[bodha-ai] cache FALLBACK (stale) ' + platformId);
      return toSnapshot(cached.listings, 'cached', cached.fetchedAt, title, currentPrice);
    }

    return { snapshot: emptySnapshot('unavailable', null), listings: [] };
  }
}

/** Fetch snapshots and the raw listings the pricing engine was built from. */
export async function getMarketData(request: SnapshotRequest): Promise<MarketData> {
  const entries = await Promise.all(
    request.platforms.map(async (platformId) => {
      const result = await dataForPlatform(
        platformId,
        request.title,
        request.category,
        request.currentPrice,
      );
      return [platformId, result] as const;
    }),
  );

  const snapshots = {} as Record<PlatformId, MarketSnapshot>;
  const listings: Partial<Record<PlatformId, ComparableListing[]>> = {};
  for (const [platformId, result] of entries) {
    snapshots[platformId] = result.snapshot;
    listings[platformId] = result.listings;
  }
  return { snapshots, listings };
}

/** Fetch a snapshot for every requested marketplace, in parallel across hosts. */
export async function getMarketSnapshots(request: SnapshotRequest): Promise<
  Record<PlatformId, MarketSnapshot>
> {
  return (await getMarketData(request)).snapshots;
}

/** Raw listings already in cache after getMarketSnapshots (or a prior run). */
export function getCachedListings(
  platformId: PlatformId,
  category: CategoryId,
  title: string,
): ComparableListing[] {
  return readCache(platformId, category, title)?.listings ?? [];
}

export function unavailableSnapshot(): MarketSnapshot {
  return emptySnapshot('unavailable', null);
}
