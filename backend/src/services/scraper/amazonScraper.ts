/**
 * Amazon.in search scraper.
 *
 * Selectors verified 2026-09-09 against
 * https://www.amazon.in/s?k=USB+C+Fast+Charging+Cable
 *   card:   [data-component-type="s-search-result"]  (22 on page 1)
 *   title:  h2 span
 *   price:  .a-price .a-offscreen  /  .a-price-whole
 *   rating: .a-icon-alt  ("4.5 out of 5 stars")
 *   reviews: parenthetical next to the stars ("(6K)")
 *
 * robots.txt allows `/s?k=`; we do not add `rh=` filter params (those collide
 * with a Disallow rule).
 */

import { env } from '../../config/env.js';
import type { ComparableListing } from '../../types/index.js';
import { ScraperError } from './errors.js';
import { absoluteUrl, parseCount, parseInr, parseRating } from './parse.js';
import { runSearchPage } from './runSearchPage.js';
import type { MarketplaceScraper } from './types.js';

const ORIGIN = 'https://www.amazon.in';
const CARD = '[data-component-type="s-search-result"]';

function buildSearchUrl(query: string): { url: string; pathWithQuery: string } {
  const pathWithQuery = '/s?k=' + encodeURIComponent(query);
  return { url: ORIGIN + pathWithQuery, pathWithQuery };
}

export class AmazonScraper implements MarketplaceScraper {
  readonly id = 'amazon' as const;
  readonly origin = ORIGIN;

  async search(query: string, _category: string): Promise<ComparableListing[]> {
    const listings: ComparableListing[] = [];
    const { url, pathWithQuery } = buildSearchUrl(query);

    await runSearchPage({
      platformName: 'Amazon.in',
      origin: ORIGIN,
      url,
      pathWithQuery,
      resultSelector: CARD,
      extract: async (page) => {
        const origin = ORIGIN;
        const max = env.scrapeMaxResults;
        const raw = await page.$$eval(
          CARD,
          (cards, cap) => {
            return cards.slice(0, cap).map((card) => {
              const asin = card.getAttribute('data-asin') ?? '';
              const titleEl = card.querySelector('h2 span');
              const title = (titleEl?.textContent ?? '').replace(/\s+/g, ' ').trim();
              const priceOffscreen = card.querySelector('.a-price .a-offscreen');
              const priceWhole = card.querySelector('.a-price-whole');
              const priceText =
                (priceOffscreen?.textContent ?? '').trim() ||
                (priceWhole?.textContent ?? '').trim();
              const ratingEl = card.querySelector('.a-icon-alt');
              const ratingText = ratingEl?.textContent ?? '';
              const reviewEl =
                card.querySelector('a[href*="customerReviews"] span') ??
                card.querySelector('span.a-size-base.s-underline-text') ??
                card.querySelector('[aria-label*="ratings"]');
              const reviewText =
                (reviewEl?.textContent ?? reviewEl?.getAttribute('aria-label') ?? '').trim() ||
                ((card.textContent ?? '').match(/\(([\d.,]+\s*[KkMm]?)\)/)?.[1] ?? '');
              const link = card.querySelector('h2 a') as HTMLAnchorElement | null;
              const href = link?.getAttribute('href') ?? '';
              const img = card.querySelector('img') as HTMLImageElement | null;
              const thumbnail = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
              return { asin, title, priceText, ratingText, reviewText, href, thumbnail };
            });
          },
          max,
        );

        for (const row of raw) {
          if (!row.asin || !row.title) continue;
          const price = parseInr(row.priceText);
          if (!price) continue;
          listings.push({
            title: row.title,
            price,
            rating: parseRating(row.ratingText) ?? undefined,
            reviewCount: parseCount(row.reviewText) ?? undefined,
            url: absoluteUrl(row.href, origin),
            thumbnail: row.thumbnail || undefined,
          });
        }

        return listings.length;
      },
    });

    if (listings.length === 0) {
      throw new ScraperError('empty-results', 'Amazon.in returned no priced comparable listings.');
    }

    return listings.slice(0, env.scrapeMaxResults);
  }
}
