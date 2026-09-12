/**
 * Flipkart card text parsing. Rating/review formats drift; a failed parse
 * must not drop a listing that still has a title and price.
 */

import type { ComparableListing } from '../../types/index.js';
import { absoluteUrl, parseCount, parseInr, parseRating } from './parse.js';

export interface FlipkartCardRow {
  title: string;
  href: string;
  text: string;
  thumbnail?: string;
}

export interface FlipkartRatingParse {
  rating: number | null;
  reviewCount: number | null;
  parsed: boolean;
}

const RATING_REVIEW_PATTERNS: RegExp[] = [
  // "3.9(33,705)" / "3.9 (33,705)" / "3.9★ (1.2k)"
  /(\d(?:\.\d)?)\s*[★*]?\s*\(\s*([\d,.]+(?:\s*[kmb])?)\s*\)/i,
  // "4.2/5 (1,234)" / "4.2 out of 5 • 890 reviews"
  /(\d(?:\.\d)?)\s*(?:\/\s*5|out of 5)[^\d₹]{0,24}([\d,.]+(?:\s*[kmb])?)/i,
  // "4★ 1.2k Ratings" / "4.1 stars, 2,340 reviews"
  /(\d(?:\.\d)?)\s*(?:[★*]+|stars?)[^\d₹]{0,16}([\d,.]+(?:\s*[kmb])?)/i,
  // "1.2k Ratings 4.1" is unusual; "★★★★ 4.1 | 2,340 Ratings"
  /[★*]{2,5}\s*(\d(?:\.\d)?)\s*[|·•,\-–]\s*([\d,.]+(?:\s*[kmb])?)/i,
  // "Rated 4.2/5 from 890 reviews"
  /rated\s+(\d(?:\.\d)?)\s*(?:\/\s*5)?[^\d₹]{0,24}([\d,.]+(?:\s*[kmb])?)/i,
  // Trailing "ratings" / "reviews" label, e.g. "4.1 | 2,340 Ratings"
  /(\d(?:\.\d)?)\s*[|·•,\-–]\s*([\d,.]+(?:\s*[kmb])?)\s*(?:ratings?|reviews?)/i,
];

export function parseFlipkartRatingReviews(text: string): FlipkartRatingParse {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { rating: null, reviewCount: null, parsed: false };
  }

  for (const pattern of RATING_REVIEW_PATTERNS) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const rating = parseRating(match[1]);
    const reviewCount = parseCount(match[2]);
    if (rating !== null || reviewCount !== null) {
      return { rating, reviewCount, parsed: true };
    }
  }

  const ratingOnly = normalized.match(/\b(\d(?:\.\d)?)\s*(?:\/\s*5|out of 5|★)/i);
  if (ratingOnly) {
    return { rating: parseRating(ratingOnly[1]), reviewCount: null, parsed: true };
  }

  return { rating: null, reviewCount: null, parsed: false };
}

export function listingsFromFlipkartRows(
  rows: FlipkartCardRow[],
  origin: string,
): ComparableListing[] {
  const listings: ComparableListing[] = [];

  for (const row of rows) {
    if (!row.title) continue;
    if (!row.href && !row.text.includes('₹')) continue;
    const priceMatch = row.text.match(/₹\s*[\d,]+/);
    const price = parseInr(priceMatch?.[0] ?? '');
    if (!price) continue;

    const parsed = parseFlipkartRatingReviews(row.text);
    if (!parsed.parsed) {
      console.warn(
        '[bodha-ai] Flipkart rating/review parse failed for listing "' +
          row.title +
          '" — keeping the product with rating/reviewCount unset',
      );
    }

    listings.push({
      title: row.title,
      price,
      rating: parsed.rating,
      reviewCount: parsed.reviewCount,
      url: row.href ? absoluteUrl(row.href, origin) : origin + '/search?q=' + encodeURIComponent(row.title),
      thumbnail: row.thumbnail || undefined,
    });
  }

  return listings;
}
