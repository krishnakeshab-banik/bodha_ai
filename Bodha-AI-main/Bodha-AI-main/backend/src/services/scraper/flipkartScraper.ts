/**
 * Flipkart search scraper.
 *
 * Selectors verified 2026-09-09 against
 * https://www.flipkart.com/search?q=USB+C+Fast+Charging+Cable
 *   card:  div[data-id]                 (40 on page 1)
 *   link:  a[href*="/p/"]
 *   title: img[alt] (hashed class names like Nx9bqj / KzDlHZ were *gone*)
 *   price / rating / reviews: parsed from the card's innerText
 *     e.g. "3.9(33,705)" and "₹198₹1,89989% off"
 *
 * Hashed Flipkart class names rotate; do not depend on them.
 */

import { env } from '../../config/env.js';
import type { ComparableListing } from '../../types/index.js';
import { ScraperError } from './errors.js';
import { absoluteUrl, parseCount, parseInr, parseRating } from './parse.js';
import { runSearchPage } from './runSearchPage.js';
import type { MarketplaceScraper } from './types.js';

const ORIGIN = 'https://www.flipkart.com';
const CARD = 'div[data-id]';

function buildSearchUrl(query: string): { url: string; pathWithQuery: string } {
  const pathWithQuery = '/search?q=' + encodeURIComponent(query);
  return { url: ORIGIN + pathWithQuery, pathWithQuery };
}

export class FlipkartScraper implements MarketplaceScraper {
  readonly id = 'flipkart' as const;
  readonly origin = ORIGIN;

  async search(query: string, _category: string): Promise<ComparableListing[]> {
    const listings: ComparableListing[] = [];
    const { url, pathWithQuery } = buildSearchUrl(query);

    await runSearchPage({
      platformName: 'Flipkart',
      origin: ORIGIN,
      url,
      pathWithQuery,
      resultSelector: CARD,
      extract: async (page) => {
        const origin = ORIGIN;
        const max = env.scrapeMaxResults;
        const raw = await page.$$eval(CARD, (cards, cap) => {
          return cards.slice(0, cap).map((card) => {
            const img = card.querySelector('img[alt]') as HTMLImageElement | null;
            const title = (img?.alt ?? '').replace(/\s+/g, ' ').trim();
            const link = card.querySelector('a[href*="/p/"]') as HTMLAnchorElement | null;
            const href = link?.getAttribute('href') ?? '';
            const text = (card.textContent ?? '').replace(/\s+/g, ' ').trim();
            return { title, href, text, thumbnail: img?.src ?? '' };
          });
        }, max);

        for (const row of raw) {
          if (!row.title || !row.href) continue;
          const priceMatch = row.text.match(/₹\s*[\d,]+/);
          const price = parseInr(priceMatch?.[0] ?? '');
          if (!price) continue;

          const ratingReviews = row.text.match(/(\d(?:\.\d)?)\s*\(([\d,]+)\)/);
          listings.push({
            title: row.title,
            price,
            rating: parseRating(ratingReviews?.[1]) ?? undefined,
            reviewCount: parseCount(ratingReviews?.[2]) ?? undefined,
            url: absoluteUrl(row.href, origin),
            thumbnail: row.thumbnail || undefined,
          });
        }

        return listings.length;
      },
    });

    if (listings.length === 0) {
      throw new ScraperError('empty-results', 'Flipkart returned no priced comparable listings.');
    }

    return listings.slice(0, env.scrapeMaxResults);
  }
}
