/**
 * Identify the exact product (brand + model number) from a seller title and
 * keep only marketplace cards for that product or a close equivalent.
 *
 * Without this, a search for "Sony WH-1000XM5" plus a category label like
 * "Electronics Accessories" pulls earpads, cases and generic headphones, and
 * the median collapses to a few hundred rupees.
 */

import { CATEGORIES } from '../data/categories.js';
import type { CategoryId, ComparableListing } from '../types/index.js';

export interface ProductIdentity {
  brand: string | null;
  modelTokens: string[];
  modelFamily: string | null;
  hasSpecificModel: boolean;
  queryIsAccessory: boolean;
}

export interface RelevanceOptions {
  /** Seller's listed price — used as a sanity band when titles are messy. */
  anchorPrice?: number;
}

const KNOWN_BRANDS = new Set([
  'sony',
  'bose',
  'jbl',
  'sennheiser',
  'apple',
  'samsung',
  'boat',
  'boult',
  'oneplus',
  'xiaomi',
  'redmi',
  'realme',
  'nothing',
  'google',
  'microsoft',
  'dell',
  'hp',
  'lenovo',
  'asus',
  'acer',
  'lg',
  'panasonic',
  'philips',
  'canon',
  'nikon',
  'gopro',
  'dji',
  'nintendo',
  'logitech',
  'razer',
  'anker',
  'noise',
  'ptron',
  'zebronics',
  'infinity',
  'marshall',
  'skullcandy',
  'beats',
  'jabra',
  'huawei',
  'oppo',
  'vivo',
  'motorola',
  'nokia',
  'honor',
  'iqoo',
  'poco',
  'fireboltt',
  'crossbeats',
  'oraimo',
]);

const GENERIC_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'wireless',
  'bluetooth',
  'headphones',
  'headphone',
  'headset',
  'earbuds',
  'earbud',
  'earphones',
  'earphone',
  'cancelling',
  'canceling',
  'over',
  'ear',
  'pro',
  'max',
  'plus',
  'new',
  'original',
  'official',
  'india',
  'black',
  'white',
  'silver',
  'blue',
  'red',
]);

/**
 * Accessory / spare-part cards that share a model number but are not the product.
 * If the seller's own title is an accessory, we leave those cards in.
 */
const ACCESSORY_RE =
  /\b(ear\s*pads?|earpads?|ear\s*cups?|earcups?|ear\s*cushions?|carrying\s*case|hard\s*case|travel\s*case|protective\s*case|silicone\s*case|case|cover|pouch|replacement|charging\s*stand|headset\s*stand|skin|sticker|screen\s*protector|charger|charging\s*cable|usb(\s|-)?c\s+cable|adapter|foam\s*tips?|ear\s*tips?)\b/i;

/** WH-1000XM5, CH720N, 1000xm5 — not "usb-c" or a bare year. */
const MODEL_TOKEN_RE = /^(?:[a-z]{1,6}-?\d{2,}[a-z0-9-]*|\d{3,5}[a-z]{2,}\d{0,2})$/i;

const SCORE_EXACT = 100;
const SCORE_EQUIVALENT = 70;

export function compactToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function tokenizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9+\-./]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function familyFromModel(model: string): string | null {
  const match = model.match(/(\d{3,5}[a-z]{2,})/);
  return match?.[1] ?? null;
}

export function extractProductIdentity(title: string): ProductIdentity {
  const tokens = tokenizeTitle(title);

  let brand: string | null = null;
  for (const token of tokens) {
    const compact = compactToken(token);
    if (KNOWN_BRANDS.has(compact)) {
      brand = compact;
      break;
    }
  }
  if (!brand) {
    for (const token of tokens) {
      const compact = compactToken(token);
      if (
        compact.length >= 3 &&
        /^[a-z]+$/.test(compact) &&
        !GENERIC_WORDS.has(compact) &&
        !MODEL_TOKEN_RE.test(token)
      ) {
        brand = compact;
        break;
      }
    }
  }

  const modelTokens: string[] = [];
  for (const token of tokens) {
    if (!MODEL_TOKEN_RE.test(token)) continue;
    const compact = compactToken(token);
    if (compact.length >= 5 && !modelTokens.includes(compact)) {
      modelTokens.push(compact);
    }
  }

  return {
    brand,
    modelTokens,
    modelFamily: modelTokens[0] ? familyFromModel(modelTokens[0]) : null,
    hasSpecificModel: modelTokens.length > 0,
    queryIsAccessory: ACCESSORY_RE.test(title),
  };
}

export function hasSpecificProductIdentity(title: string): boolean {
  return extractProductIdentity(title).hasSpecificModel;
}

/**
 * Search query sent to the marketplace.
 *
 * Generic titles ("braided cable") still get the category label so the page
 * is not a grab-bag. A branded model number ("Sony WH-1000XM5") must stay
 * exact — appending "Electronics Accessories" pulls earpads and cases.
 */
export function composeSearchQuery(title: string, category: CategoryId): string {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  if (hasSpecificProductIdentity(cleaned)) return cleaned;
  const label = CATEGORIES[category]?.label ?? '';
  if (!label) return cleaned;
  if (cleaned.toLowerCase().includes(label.toLowerCase())) return cleaned;
  return cleaned + ' ' + label;
}

export function isAccessoryListing(listingTitle: string, identity: ProductIdentity): boolean {
  if (identity.queryIsAccessory) return false;
  return ACCESSORY_RE.test(listingTitle);
}

export function scoreListingTitle(listingTitle: string, identity: ProductIdentity): number {
  if (isAccessoryListing(listingTitle, identity)) return 0;

  const haystack = compactToken(listingTitle);
  let score = 0;
  if (identity.brand && haystack.includes(identity.brand)) score += 40;

  const hasExactModel = identity.modelTokens.some((model) => haystack.includes(model));
  if (hasExactModel) return score + 60;

  if (
    identity.modelFamily &&
    identity.modelFamily.length >= 5 &&
    haystack.includes(identity.modelFamily) &&
    identity.brand &&
    haystack.includes(identity.brand)
  ) {
    return Math.max(score, SCORE_EQUIVALENT);
  }

  return score;
}

function medianPrice(prices: number[]): number {
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Restrict scraped cards to the seller's product (or closest true equivalents).
 * Generic titles with no model number are left unchanged so cables / apparel
 * keep the previous category-wide sample.
 */
export function filterRelevantListings(
  listings: ComparableListing[],
  queryTitle: string,
  options: RelevanceOptions = {},
): ComparableListing[] {
  const identity = extractProductIdentity(queryTitle);
  if (!identity.hasSpecificModel) return listings;

  const scored = listings.map((listing) => ({
    listing,
    score: scoreListingTitle(listing.title, identity),
  }));

  let kept = scored.filter((row) => row.score >= SCORE_EXACT).map((row) => row.listing);
  if (kept.length < 2) {
    kept = scored.filter((row) => row.score >= SCORE_EQUIVALENT).map((row) => row.listing);
  }

  const anchor =
    options.anchorPrice && options.anchorPrice > 0
      ? options.anchorPrice
      : kept.length > 0
        ? medianPrice(kept.map((listing) => listing.price).filter((price) => price > 0))
        : 0;

  if (anchor > 0 && kept.length > 0) {
    const banded = kept.filter(
      (listing) => listing.price >= anchor * 0.4 && listing.price <= anchor * 2.5,
    );
    if (banded.length > 0) kept = banded;
  }

  if (kept.length === 0 && anchor > 0) {
    kept = listings.filter((listing) => {
      if (isAccessoryListing(listing.title, identity)) return false;
      return listing.price >= anchor * 0.45 && listing.price <= anchor * 1.8;
    });
  }

  return kept;
}
