/**
 * Per-platform data-quality / confidence from this analysis run's listings.
 * No product-specific lookup table — only listing count, title overlap, and
 * the freshness tag already attached to that platform's snapshot.
 */

import type {
  ComparableListing,
  DataConfidence,
  DataFreshness,
  IndexLevel,
  PlatformId,
  PlatformRecommendation,
  TitleMatchQuality,
} from '../types/index.js';
import { agentLog } from './agentLog.js';
import {
  extractProductIdentity,
  scoreListingTitle,
  tokenizeTitle,
} from './listingRelevance.js';

const GENERIC_TOKENS = new Set([
  'the',
  'and',
  'for',
  'with',
  'new',
  'original',
  'official',
  'india',
]);

export function classifyTitleMatch(
  productTitle: string,
  listings: ComparableListing[],
): { titleMatch: TitleMatchQuality; avgTokenOverlap: number; exactMatchCount: number } {
  if (listings.length === 0) {
    return { titleMatch: 'category', avgTokenOverlap: 0, exactMatchCount: 0 };
  }

  const identity = extractProductIdentity(productTitle);
  if (identity.hasSpecificModel) {
    const scores = listings.map((listing) => scoreListingTitle(listing.title, identity));
    const exactMatchCount = scores.filter((score) => score >= 100).length;
    const closeCount = scores.filter((score) => score >= 70).length;
    const titleMatch: TitleMatchQuality =
      exactMatchCount >= listings.length / 2
        ? 'exact'
        : closeCount >= listings.length / 2
          ? 'close'
          : 'category';
    return { titleMatch, avgTokenOverlap: exactMatchCount / listings.length, exactMatchCount };
  }

  const queryTokens = significantTokens(productTitle);
  const overlaps = listings.map((listing) => tokenOverlap(queryTokens, listing.title));
  const avgTokenOverlap =
    overlaps.reduce((sum, value) => sum + value, 0) / Math.max(overlaps.length, 1);
  const titleMatch: TitleMatchQuality =
    avgTokenOverlap >= 0.6 ? 'exact' : avgTokenOverlap >= 0.35 ? 'close' : 'category';
  return { titleMatch, avgTokenOverlap, exactMatchCount: 0 };
}

export function confidenceLevel(
  listingCount: number,
  titleMatch: TitleMatchQuality,
  freshness: DataFreshness,
): IndexLevel {
  if (listingCount <= 0 || freshness === 'unavailable') return 'Low';

  let score = 0;
  if (listingCount >= 15) score += 2;
  else if (listingCount >= 6) score += 1;

  if (titleMatch === 'exact') score += 2;
  else if (titleMatch === 'close') score += 1;

  if (freshness === 'live') score += 2;
  else if (freshness === 'gemini') score += 1;

  if (score >= 5) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
}

export function computeDataConfidence(
  productTitle: string,
  listingCount: number,
  freshness: DataFreshness,
  listings: ComparableListing[],
): DataConfidence {
  const match = classifyTitleMatch(productTitle, listings);
  return {
    level: confidenceLevel(listingCount, match.titleMatch, freshness),
    listingCount,
    titleMatch: match.titleMatch,
    freshness,
  };
}

export function attachConfidenceScores(
  platforms: PlatformRecommendation[],
  productTitle: string,
  listingsByPlatform: Partial<Record<PlatformId, ComparableListing[]>>,
): PlatformRecommendation[] {
  return platforms.map((platform) => {
    const listings = listingsByPlatform[platform.id] ?? [];
    const freshness = platform.dataSource ?? platform.dataFreshness ?? 'unavailable';
    const listingCount = platform.unavailable ? 0 : platform.listingCount;
    const match = classifyTitleMatch(productTitle, listings);
    const confidence = computeDataConfidence(productTitle, listingCount, freshness, listings);
    agentLog(platform.id, 'confidence', {
      level: confidence.level,
      listingCount,
      titleMatch: match.titleMatch,
      freshness,
      exactMatchCount: match.exactMatchCount,
      avgTokenOverlap: Number(match.avgTokenOverlap.toFixed(3)),
      sampleTitles: listings.slice(0, 3).map((listing) => listing.title),
    });
    return { ...platform, confidence };
  });
}

function significantTokens(title: string): string[] {
  return tokenizeTitle(title)
    .map((token) => token.replace(/[^a-z0-9]/g, ''))
    .filter((token) => token.length >= 2 && !GENERIC_TOKENS.has(token));
}

function tokenOverlap(queryTokens: string[], listingTitle: string): number {
  if (queryTokens.length === 0) return 0;
  const haystack = new Set(significantTokens(listingTitle));
  const hits = queryTokens.filter((token) => haystack.has(token)).length;
  return hits / queryTokens.length;
}
