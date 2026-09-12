/**
 * AmazonAgent — live Amazon.in scrape with an explicit fallback chain when
 * the marketplace returns a BLOCKED page (bot-check / CAPTCHA / download
 * interstitial):
 *
 *   1. Gemini API + Google Search grounding
 *   2. Most recent cached listings for this category/title
 *   3. Unavailable (empty listings)
 *
 * Timeouts and not-found failures skip Gemini and go straight to cache, then
 * unavailable. Dependencies are injectable so the chain can be unit-tested
 * without a real block or a live Gemini call.
 */

import type { CategoryId, ComparableListing, DataSource } from '../types/index.js';
import { agentLog, agentWarn } from './agentLog.js';
import { fetchAmazonListingsViaGemini } from './amazonGeminiFallback.js';
import { readCache, type CachedListings } from './cacheService.js';
import { isScraperError, scrapeStatusFromError, sharedBrowserErrorSignal } from './scraper/errors.js';
import type { ScrapeStatus } from './scraper/pageState.js';

export interface AmazonSearchResult {
  listings: ComparableListing[];
  dataSource: DataSource;
  scrapeStatus: ScrapeStatus;
  blockedSignal: string | null;
}

export interface AmazonAgentDeps {
  searchLive: (title: string, category: CategoryId) => Promise<ComparableListing[]>;
  searchGemini: (title: string, category: CategoryId | string) => Promise<ComparableListing[]>;
  readCached: (category: CategoryId, title: string) => CachedListings | null;
}

async function defaultLiveSearch(
  title: string,
  category: CategoryId,
): Promise<ComparableListing[]> {
  const { scrapeComparableListings } = await import('./scraper/scraperService.js');
  return scrapeComparableListings('amazon', title, category);
}

const defaultDeps: AmazonAgentDeps = {
  searchLive: defaultLiveSearch,
  searchGemini: fetchAmazonListingsViaGemini,
  readCached: (category, title) => readCache('amazon', category, title),
};

function usable(listings: ComparableListing[] | null | undefined): listings is ComparableListing[] {
  return Array.isArray(listings) && listings.length > 0;
}

export class AmazonAgent {
  private readonly deps: AmazonAgentDeps;

  constructor(deps: Partial<AmazonAgentDeps> = {}) {
    this.deps = { ...defaultDeps, ...deps };
  }

  async search(title: string, category: CategoryId): Promise<AmazonSearchResult> {
    agentLog('amazon', 'live attempt start', { title, category });
    try {
      const listings = await this.deps.searchLive(title, category);
      if (usable(listings)) {
        agentLog('amazon', 'live attempt result', {
          status: 'OK',
          listings: listings.length,
        });
        agentLog('amazon', 'final status', {
          dataSource: 'live',
          scrapeStatus: 'OK',
          listings: listings.length,
        });
        return {
          listings,
          dataSource: 'live',
          scrapeStatus: 'OK',
          blockedSignal: null,
        };
      }
      agentWarn('amazon', 'live attempt result', { status: 'NOT_FOUND', listings: 0 });
      return this.cacheOrUnavailable(title, category, 'NOT_FOUND', null);
    } catch (error) {
      const scrapeStatus = scrapeStatusFromError(error) ?? 'TIMEOUT';
      const blockedSignal =
        (isScraperError(error) ? error.signal : null) ?? sharedBrowserErrorSignal(error);
      agentWarn('amazon', 'live attempt result', {
        status: scrapeStatus,
        signal: blockedSignal,
        message: error instanceof Error ? error.message : String(error),
      });

      if (scrapeStatus === 'BLOCKED') {
        return this.blockedFallback(title, category, blockedSignal);
      }

      return this.cacheOrUnavailable(title, category, scrapeStatus, blockedSignal);
    }
  }

  private async blockedFallback(
    title: string,
    category: CategoryId,
    blockedSignal: string | null,
  ): Promise<AmazonSearchResult> {
    agentWarn('amazon', 'fallback triggered', { reason: 'BLOCKED', signal: blockedSignal, next: 'gemini' });

    try {
      const gemini = await this.deps.searchGemini(title, category);
      if (usable(gemini)) {
        agentLog('amazon', 'fallback result', { source: 'gemini', listings: gemini.length });
        return {
          listings: gemini,
          dataSource: 'gemini',
          scrapeStatus: 'BLOCKED',
          blockedSignal,
        };
      }
      agentWarn('amazon', 'fallback result', { source: 'gemini', listings: 0 });
    } catch (error) {
      agentWarn('amazon', 'fallback result', {
        source: 'gemini',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return this.cacheOrUnavailable(title, category, 'BLOCKED', blockedSignal);
  }

  private cacheOrUnavailable(
    title: string,
    category: CategoryId,
    scrapeStatus: ScrapeStatus,
    blockedSignal: string | null,
  ): AmazonSearchResult {
    const cached = this.deps.readCached(category, title);
    if (cached && usable(cached.listings)) {
      agentLog('amazon', 'fallback triggered', {
        next: 'cache',
        listings: cached.listings.length,
        fetchedAt: cached.fetchedAt,
        after: scrapeStatus,
      });
      agentLog('amazon', 'final status', {
        dataSource: 'cached',
        scrapeStatus,
        signal: blockedSignal,
        listings: cached.listings.length,
      });
      return {
        listings: cached.listings,
        dataSource: 'cached',
        scrapeStatus,
        blockedSignal,
      };
    }

    agentWarn('amazon', 'final status', {
      dataSource: 'unavailable',
      scrapeStatus,
      signal: blockedSignal,
      listings: 0,
    });
    return {
      listings: [],
      dataSource: 'unavailable',
      scrapeStatus,
      blockedSignal,
    };
  }
}

let defaultAgent: AmazonAgent | undefined;

export function getAmazonAgent(): AmazonAgent {
  return defaultAgent ?? (defaultAgent = new AmazonAgent());
}

/** Test helper — pass null to restore the default agent on the next call. */
export function setAmazonAgentForTests(agent: AmazonAgent | null): void {
  defaultAgent = agent ?? undefined;
}
