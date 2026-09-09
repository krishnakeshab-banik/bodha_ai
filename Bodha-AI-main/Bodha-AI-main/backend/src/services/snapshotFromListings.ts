/**
 * Turn scraped ComparableListing[] into the MarketSnapshot the pricing engine
 * consumes. Pure — no HTTP, no Playwright, no database.
 *
 * Heuristics (NOT published by the marketplaces):
 *
 * demandIndex (0–100)
 *   Average `reviewCount` across listings that expose one, mapped with a log
 *   scale so a handful of reviews does not look like "High" demand:
 *
 *     demandIndex = 100 * log10(1 + avgReviewCount) / log10(1 + 10000)
 *
 *   0 reviews → 0 (Low), ~400 reviews → ~40 (Medium), ~2000 → ~70 (High),
 *   10 000+ saturates at 100. If no listing has a review count we fall back
 *   to average star rating scaled onto 0–50 (ratings-only never claims High).
 *   If neither field is present we use 40 — a conservative Medium — rather
 *   than pretending we observed demand.
 *
 * competitionIndex (0–100)
 *   How many comparable listings we actually extracted, against the scrape
 *   cap of 20 (page-1 density is the signal we can observe without paging):
 *
 *     competitionIndex = 100 * listingCount / 20
 *
 *   3 results → 15 (Low), 8 → 40 (Medium), 14+ → 70+ (High). When listings
 *   expose `sellerCount` we blend 50/50 with normalize(avg sellerCount, cap 40).
 */

import type {
  ComparableListing,
  DataFreshness,
  MarketSnapshot,
} from '../types/index.js';
import { filterRelevantListings } from './listingRelevance.js';

export interface SnapshotFromListingsOptions {
  queryTitle?: string;
  anchorPrice?: number;
}

/** Review-count that saturates demandIndex at 100 on the log scale. */
export const DEMAND_REVIEW_SATURATION = 10_000;

/** listingCount that saturates competitionIndex at 100. Matches scrape cap. */
export const COMPETITION_RESULT_CAP = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor + 0;
}

export function emptySnapshot(
  freshness: DataFreshness,
  lastUpdated: string | null,
): MarketSnapshot {
  return {
    comparablePrices: [],
    demandIndex: 0,
    competitionIndex: 0,
    dataFreshness: freshness,
    lastUpdated,
    listingCount: 0,
    unavailable: true,
  };
}

export function listingsToSnapshot(
  listings: ComparableListing[],
  freshness: DataFreshness,
  lastUpdated: string | null,
  options?: SnapshotFromListingsOptions,
): MarketSnapshot {
  const scoped = options?.queryTitle
    ? filterRelevantListings(listings, options.queryTitle, { anchorPrice: options.anchorPrice })
    : listings;
  const prices = scoped.map((listing) => listing.price).filter((price) => price > 0);
  if (prices.length === 0) {
    return emptySnapshot('unavailable', lastUpdated);
  }

  // Drop extreme outliers (bundles, wrong-category cards) before the median.
  // Keep listings whose price sits between 15% and 8× the raw median.
  const mid = [...prices].sort((a, b) => a - b)[Math.floor(prices.length / 2)];
  const filtered = scoped.filter(
    (listing) => listing.price >= mid * 0.15 && listing.price <= mid * 8,
  );
  const usable = filtered.length >= 3 ? filtered : scoped;
  const comparablePrices = usable.map((listing) => listing.price);

  const reviewCounts = usable
    .map((listing) => listing.reviewCount)
    .filter((value): value is number => typeof value === 'number' && value >= 0);

  let demandIndex = 40;
  if (reviewCounts.length > 0) {
    const average = reviewCounts.reduce((sum, value) => sum + value, 0) / reviewCounts.length;
    demandIndex = clamp(
      (100 * Math.log10(1 + average)) / Math.log10(1 + DEMAND_REVIEW_SATURATION),
      0,
      100,
    );
  } else {
    const ratings = usable
      .map((listing) => listing.rating)
      .filter((value): value is number => typeof value === 'number' && value > 0);
    if (ratings.length > 0) {
      const average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
      demandIndex = clamp((average / 5) * 50, 0, 50);
    }
  }

  let competitionIndex = clamp((100 * usable.length) / COMPETITION_RESULT_CAP, 0, 100);
  const sellerCounts = usable
    .map((listing) => listing.sellerCount)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  if (sellerCounts.length > 0) {
    const average = sellerCounts.reduce((sum, value) => sum + value, 0) / sellerCounts.length;
    const sellerIndex = clamp((100 * average) / 40, 0, 100);
    competitionIndex = (competitionIndex + sellerIndex) / 2;
  }

  return {
    comparablePrices,
    demandIndex: round(demandIndex, 1),
    competitionIndex: round(competitionIndex, 1),
    dataFreshness: freshness,
    lastUpdated,
    listingCount: usable.length,
    unavailable: false,
  };
}
