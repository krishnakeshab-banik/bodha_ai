/**
 * MarketplaceDataProvider — the only module the analysis service goes through
 * for comparable-listing numbers. It never reads hardcoded prices.
 *
 * Flow per platform (live-first):
 *   scrape live                      → store, dataSource: "live"
 *   Amazon BLOCKED                   → Gemini grounding, else cache, else unavailable
 *   other scrape fails + any cache   → dataSource: "cached"
 *   scrape fails + no cache          → unavailable
 *
 * demandIndex / competitionIndex derivation is documented in snapshotFromListings.ts.
 */

import type {
  CategoryId,
  ComparableListing,
  DataSource,
  MarketSnapshot,
  PlatformId,
  ScrapeStatus,
} from '../types/index.js';
import { agentLog, agentWarn } from './agentLog.js';
import { getAmazonAgent } from './amazonAgent.js';
import { readCache, writeCache } from './cacheService.js';
import { filterRelevantListings } from './listingRelevance.js';
import { isScraperError, scrapeStatusFromError } from './scraper/errors.js';
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

export {
  listingsToSnapshot,
  emptySnapshot,
  DEMAND_REVIEW_SATURATION,
  COMPETITION_RESULT_CAP,
} from './snapshotFromListings.js';

function prepareListings(
  listings: ComparableListing[],
  title: string,
  currentPrice?: number,
): ComparableListing[] {
  return filterRelevantListings(listings, title, { anchorPrice: currentPrice });
}

function toSnapshot(
  listings: ComparableListing[],
  freshness: DataSource,
  lastUpdated: string | null,
  title: string,
  currentPrice?: number,
  extras?: { scrapeStatus?: ScrapeStatus | null; blockedSignal?: string | null },
): { snapshot: MarketSnapshot; listings: ComparableListing[] } {
  const relevant = prepareListings(listings, title, currentPrice);
  return {
    snapshot: listingsToSnapshot(relevant, freshness, lastUpdated, {
      queryTitle: title,
      anchorPrice: currentPrice,
      dataSource: freshness,
      scrapeStatus: extras?.scrapeStatus,
      blockedSignal: extras?.blockedSignal,
    }),
    listings: relevant,
  };
}

async function dataForAmazon(
  title: string,
  category: CategoryId,
  currentPrice?: number,
): Promise<{ snapshot: MarketSnapshot; listings: ComparableListing[] }> {
  agentLog('amazon', 'request start', { title, category, currentPrice });
  const cached = readCache('amazon', category, title);

  const result = await getAmazonAgent().search(title, category);
  if (result.dataSource === 'live' && result.listings.length > 0) {
    const fetchedAt = new Date().toISOString();
    writeCache('amazon', category, title, result.listings, fetchedAt);
    const prepared = toSnapshot(result.listings, 'live', fetchedAt, title, currentPrice, {
      scrapeStatus: result.scrapeStatus,
      blockedSignal: result.blockedSignal,
    });
    agentLog('amazon', 'provider snapshot', {
      dataSource: 'live',
      listings: prepared.listings.length,
      raw: result.listings.length,
    });
    return prepared;
  }

  if (result.listings.length === 0) {
    agentWarn('amazon', 'provider snapshot', {
      dataSource: 'unavailable',
      scrapeStatus: result.scrapeStatus,
      signal: result.blockedSignal,
    });
    return {
      snapshot: emptySnapshot('unavailable', cached?.fetchedAt ?? null, {
        dataSource: 'unavailable',
        scrapeStatus: result.scrapeStatus,
        blockedSignal: result.blockedSignal,
      }),
      listings: [],
    };
  }

  const fetchedAt =
    result.dataSource === 'cached' ? (cached?.fetchedAt ?? new Date().toISOString()) : new Date().toISOString();
  agentLog('amazon', 'provider snapshot', {
    dataSource: result.dataSource,
    scrapeStatus: result.scrapeStatus,
    listings: result.listings.length,
  });
  return toSnapshot(result.listings, result.dataSource, fetchedAt, title, currentPrice, {
    scrapeStatus: result.scrapeStatus,
    blockedSignal: result.blockedSignal,
  });
}

async function dataForPlatform(
  platformId: PlatformId,
  title: string,
  category: CategoryId,
  currentPrice?: number,
): Promise<{ snapshot: MarketSnapshot; listings: ComparableListing[] }> {
  if (platformId === 'amazon') {
    return dataForAmazon(title, category, currentPrice);
  }

  agentLog(platformId, 'request start', { title, category, currentPrice });

  if (!hasLiveScraper(platformId)) {
    agentLog(platformId, 'final status', {
      dataSource: 'unavailable',
      reason: 'no-live-scraper',
    });
    return { snapshot: emptySnapshot('unavailable', null), listings: [] };
  }

  const cached = readCache(platformId, category, title);

  try {
    agentLog(platformId, 'live attempt start', { title });
    const listings = await scrapeComparableListings(platformId, title, category);
    const fetchedAt = new Date().toISOString();
    writeCache(platformId, category, title, listings, fetchedAt);
    const prepared = toSnapshot(listings, 'live', fetchedAt, title, currentPrice, {
      scrapeStatus: 'OK',
    });
    agentLog(platformId, 'live attempt result', {
      status: 'OK',
      listings: prepared.listings.length,
      raw: listings.length,
    });
    agentLog(platformId, 'final status', {
      dataSource: 'live',
      scrapeStatus: 'OK',
      listings: prepared.listings.length,
    });
    return prepared;
  } catch (error) {
    const reason = isScraperError(error) ? error.code + ': ' + error.message : String(error);
    const scrapeStatus = scrapeStatusFromError(error);
    const blockedSignal = isScraperError(error) ? (error.signal ?? null) : null;
    agentWarn(platformId, 'live attempt result', {
      status: scrapeStatus ?? 'unknown',
      signal: blockedSignal,
      reason,
    });

    if (cached) {
      agentLog(platformId, 'fallback triggered', { next: 'cache', fetchedAt: cached.fetchedAt });
      agentLog(platformId, 'final status', {
        dataSource: 'cached',
        scrapeStatus,
        listings: cached.listings.length,
      });
      return toSnapshot(cached.listings, 'cached', cached.fetchedAt, title, currentPrice, {
        scrapeStatus,
        blockedSignal,
      });
    }

    agentWarn(platformId, 'final status', {
      dataSource: 'unavailable',
      scrapeStatus,
      signal: blockedSignal,
    });
    return {
      snapshot: emptySnapshot('unavailable', null, { scrapeStatus, blockedSignal }),
      listings: [],
    };
  }
}

/** Fetch snapshots and the raw listings the pricing engine was built from. */
export async function getMarketData(request: SnapshotRequest): Promise<MarketData> {
  const entries = await Promise.all(
    request.platforms.map(async (platformId) => {
      try {
        const result = await dataForPlatform(
          platformId,
          request.title,
          request.category,
          request.currentPrice,
        );
        return [platformId, result] as const;
      } catch (error) {
        // One agent's unexpected throw must not mark sibling platforms unavailable.
        agentWarn(platformId, 'isolated failure', {
          message: error instanceof Error ? error.message : String(error),
        });
        return [
          platformId,
          {
            snapshot: emptySnapshot('unavailable', null, {
              dataSource: 'unavailable',
              scrapeStatus: scrapeStatusFromError(error),
            }),
            listings: [] as ComparableListing[],
          },
        ] as const;
      }
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
export async function getMarketSnapshots(
  request: SnapshotRequest,
): Promise<Record<PlatformId, MarketSnapshot>> {
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
