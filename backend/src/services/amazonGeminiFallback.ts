/**
 * Gemini + Google Search grounding fallback for Amazon.in listings.
 * Used only when the live Playwright scrape is classified as BLOCKED.
 */

import { env } from '../config/env.js';
import type { CategoryId, ComparableListing } from '../types/index.js';
import { generateGroundedJson, hasGeminiKey } from './geminiService.js';
import { parseCount, parseInr, parseRating } from './scraper/parse.js';

const AMAZON_ORIGIN = 'https://www.amazon.in';

interface GeminiListingRow {
  title?: unknown;
  price?: unknown;
  rating?: unknown;
  reviewCount?: unknown;
  url?: unknown;
}

interface GeminiListingsResponse {
  listings?: GeminiListingRow[];
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function listingFromRow(row: GeminiListingRow, query: string): ComparableListing | null {
  const title = asText(row.title).replace(/\s+/g, ' ').trim();
  const price = typeof row.price === 'number' ? row.price : parseInr(asText(row.price));
  if (!title || !price || price <= 0) return null;

  const href = asText(row.url);
  const url =
    href && /amazon\.in/i.test(href)
      ? href
      : AMAZON_ORIGIN + '/s?k=' + encodeURIComponent(query);

  return {
    title,
    price,
    rating: parseRating(asText(row.rating)) ?? undefined,
    reviewCount: parseCount(asText(row.reviewCount)) ?? undefined,
    url,
  };
}

export async function fetchAmazonListingsViaGemini(
  query: string,
  category: CategoryId | string,
): Promise<ComparableListing[]> {
  if (!hasGeminiKey()) {
    console.warn('[bodha-ai] Amazon Gemini fallback skipped — GEMINI_API_KEY is not configured');
    return [];
  }

  const prompt =
    'Find current comparable product listings sold on Amazon.in for this search query: "' +
    query +
    '". Category: ' +
    category +
    '. Return up to ' +
    env.scrapeMaxResults +
    ' real listings as JSON of the form ' +
    '{ "listings": [{ "title": string, "price": number (INR), "rating": number, "reviewCount": number, "url": string }] }. ' +
    'Use only Amazon.in prices in Indian rupees. Skip ads, accessories that are not the product, and anything without a price.';

  const response = await generateGroundedJson<GeminiListingsResponse>(prompt);
  const rows = Array.isArray(response.listings) ? response.listings : [];
  const listings: ComparableListing[] = [];

  for (const row of rows) {
    const listing = listingFromRow(row, query);
    if (listing) listings.push(listing);
    if (listings.length >= env.scrapeMaxResults) break;
  }

  return listings;
}
