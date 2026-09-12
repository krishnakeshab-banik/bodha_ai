/**
 * analysisService - orchestration layer.
 *
 * Composes the two pure modules (pricingEngine, listingOptimizer) with
 * persistence and the live/cached marketplace data provider. This is the only
 * place that knows about clocks, IDs, the database and scraping.
 */

import { randomUUID } from 'node:crypto';

import { PLATFORMS } from '../data/platformConfig.js';
import { DEMO_SELLER_ID } from '../models/db.js';
import {
  findAnalysisById,
  findAnalysisOwner,
  listHistory,
  saveAnalysis,
  updateInsights,
} from '../models/productRepository.js';
import { localizePlatformExplanations } from './explanationI18n.js';
import {
  buildDistinctInsights,
  describeCompetitors,
  insightsAreDistinct,
  rankCompetitors,
} from './competitorAnalysis.js';
import { findBestCachedListings, writeCache } from './cacheService.js';
import { filterRelevantListings } from './listingRelevance.js';
import { getCachedListings, getMarketData } from './marketplaceDataProvider.js';
import { optimizeListing } from './listingOptimizer.js';
import { analyzePricing } from './pricingEngine.js';
import { fetchRegionalDemand } from './regionalDemandService.js';
import { analyzeReviewSentiment, collectReviewSnippets } from './reviewSentiment.js';
import { hasLiveScraper, scrapeComparableListings } from './scraper/scraperService.js';
import type {
  AnalysisRecord,
  CategoryId,
  ComparableListing,
  HistoryItem,
  PlatformId,
  ReportInsights,
  UiLanguage,
} from '../types/index.js';
import type { AnalyzeRequest } from '../utils/validation.js';

/** Run a full analysis and persist it, returning the stored record. */
export async function createAnalysis(
  request: AnalyzeRequest,
  sellerId: string = DEMO_SELLER_ID,
): Promise<AnalysisRecord> {
  const market = await getMarketData({
    title: request.title,
    category: request.category as CategoryId,
    platforms: request.platforms as PlatformId[],
    currentPrice: request.currentPrice,
  });

  const language: UiLanguage = request.language ?? 'en';

  const pricing = analyzePricing(
    {
      manufacturingCost: request.manufacturingCost,
      currentPrice: request.currentPrice,
      category: request.category as CategoryId,
      selectedPlatforms: request.platforms as PlatformId[],
    },
    market.snapshots,
  );

  const platforms = localizePlatformExplanations(pricing.platforms, language, request.currentPrice);

  const winner =
    platforms.find((platform) => platform.id === pricing.recommendedPlatform) ?? platforms[0];

  const insights = await buildInsights({
    title: request.title,
    category: request.category as CategoryId,
    recommendedPlatform: pricing.recommendedPlatform,
    selectedPlatforms: request.platforms as PlatformId[],
    listingsByPlatform: market.listings,
    language,
    currentPrice: request.currentPrice,
  });

  const optimizedListing = await optimizeListing({
    title: request.title,
    description: request.description,
    category: request.category as CategoryId,
    recommendedPlatform: pricing.recommendedPlatform,
    recommendedPrice: winner.recommendedPrice || request.currentPrice,
    language,
    complaintsToAvoid: insights.reviewSentiment.topComplaints,
  });

  const record: AnalysisRecord = {
    productId: randomUUID(),
    title: request.title,
    description: request.description,
    category: request.category as CategoryId,
    imageUrl: request.imageUrl ?? null,
    manufacturingCost: request.manufacturingCost,
    currentPrice: request.currentPrice,
    recommendedPlatform: pricing.recommendedPlatform,
    recommendedPrice: winner.recommendedPrice,
    platforms,
    optimizedListing,
    insights,
    createdAt: new Date().toISOString(),
  };

  saveAnalysis(record, sellerId);
  return record;
}

async function buildInsights(input: {
  title: string;
  category: CategoryId;
  recommendedPlatform: PlatformId;
  selectedPlatforms: PlatformId[];
  listingsByPlatform?: Partial<Record<PlatformId, ComparableListing[]>>;
  language: UiLanguage;
  currentPrice?: number;
}): Promise<ReportInsights> {
  const resolved = await resolveCompetitorListings(input);
  const top = rankCompetitors(resolved.listings, 5);

  const [snippets, regionalDemand] = await Promise.all([
    collectReviewSnippets(resolved.platformId, top),
    fetchRegionalDemand(input.title, input.category),
  ]);

  const fromCards = top.flatMap((listing) => listing.reviewSnippets ?? []);
  const reviewSentiment = await analyzeReviewSentiment([...snippets, ...fromCards], input.language);
  const competitors = await describeCompetitors(top, reviewSentiment, input.language, {
    sellerPrice: input.currentPrice,
  });

  return {
    language: input.language,
    competitors,
    reviewSentiment,
    regionalDemand,
    platformBenefits: PLATFORMS[input.recommendedPlatform].benefits,
    competitorPlatform: resolved.platformId,
  };
}

function matchListings(
  listings: ComparableListing[],
  title: string,
  currentPrice?: number,
): ComparableListing[] {
  return filterRelevantListings(listings, title, { anchorPrice: currentPrice });
}

async function resolveCompetitorListings(input: {
  title: string;
  category: CategoryId;
  recommendedPlatform: PlatformId;
  selectedPlatforms: PlatformId[];
  listingsByPlatform?: Partial<Record<PlatformId, ComparableListing[]>>;
  currentPrice?: number;
}): Promise<{ platformId: PlatformId; listings: ComparableListing[] }> {
  const order = [
    input.recommendedPlatform,
    ...input.selectedPlatforms.filter((id) => id !== input.recommendedPlatform),
  ];

  for (const platformId of order) {
    const live = matchListings(
      input.listingsByPlatform?.[platformId] ?? [],
      input.title,
      input.currentPrice,
    );
    if (live.length > 0) return { platformId, listings: live };
  }

  for (const platformId of order) {
    const cached = matchListings(
      getCachedListings(platformId, input.category, input.title),
      input.title,
      input.currentPrice,
    );
    if (cached.length > 0) return { platformId, listings: cached };
  }

  const best = findBestCachedListings(input.category, input.title, order);
  if (best && best.listings.length > 0) {
    const matched = matchListings(best.listings, input.title, input.currentPrice);
    if (matched.length > 0) return { platformId: best.platformId, listings: matched };
  }

  const shortTitle = shortenTitle(input.title);
  const scrapePlatform = order.find((id) => hasLiveScraper(id));
  if (scrapePlatform && shortTitle) {
    try {
      const listings = await scrapeComparableListings(scrapePlatform, shortTitle, input.category);
      writeCache(scrapePlatform, input.category, shortTitle, listings);
      const matched = matchListings(listings, input.title, input.currentPrice);
      if (matched.length > 0) return { platformId: scrapePlatform, listings: matched };
    } catch (error) {
      console.warn('[bodha-ai] insight scrape fallback failed:', error);
    }
  }

  return { platformId: input.recommendedPlatform, listings: [] };
}

function shortenTitle(title: string): string {
  const first = title.split(/[,|/]/)[0]?.replace(/\s+/g, ' ').trim() ?? title;
  return first.split(' ').slice(0, 6).join(' ');
}

/** The seller who owns a product, or null if it does not exist. */
export function getAnalysisOwner(productId: string): string | null {
  return findAnalysisOwner(productId);
}

export async function getAnalysis(productId: string): Promise<AnalysisRecord | null> {
  const record = findAnalysisById(productId);
  if (!record) return null;

  if (record.insights.competitors.length > 0) {
    if (!insightsAreDistinct(record.insights.competitors)) {
      record.insights.competitors = buildDistinctInsights(
        record.insights.competitors.map((card) => ({
          title: card.title,
          price: card.price,
          rating: card.rating ?? undefined,
          reviewCount: card.reviewCount ?? undefined,
          url: card.url,
          thumbnail: card.thumbnail ?? undefined,
        })),
        record.insights.reviewSentiment,
        record.insights.language ?? 'en',
        record.currentPrice,
      );
      updateInsights(record.productId, record.insights);
    }
    return record;
  }

  const selected = record.platforms.map((platform) => platform.id);
  const rebuilt = await buildInsights({
    title: record.title,
    category: record.category,
    recommendedPlatform: record.recommendedPlatform,
    selectedPlatforms: selected.length ? selected : [record.recommendedPlatform],
    language: record.insights.language ?? 'en',
    currentPrice: record.currentPrice,
  });

  if (
    rebuilt.competitors.length > 0 ||
    rebuilt.reviewSentiment.available ||
    rebuilt.regionalDemand.available
  ) {
    record.insights = rebuilt;
    updateInsights(record.productId, rebuilt);
  }

  return record;
}

export function getHistory(sellerId: string = DEMO_SELLER_ID): HistoryItem[] {
  return listHistory(sellerId);
}
