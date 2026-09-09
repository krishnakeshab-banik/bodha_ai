/**
 * Snapdeal search scraper.
 *
 * Selectors verified 2026-09-09 against
 * https://www.snapdeal.com/search?keyword=USB+C+Fast+Charging+Cable&sort=rlvncy
 *   card:    .product-tuple-listing     (20 on page 1)
 *   title:   p.product-title[title]
 *   price:   span.product-price[data-price]
 *   reviews: p.product-rating-count     ("(75)")
 *   rating:  .filled-stars width %  →  stars = width/20
 *   url:     a.dp-widget-link[href]
 *
 * Snapdeal's robots.txt is itself behind CloudFront and 403s from some
 * networks; assertSearchAllowed logs a warning and proceeds in that case.
 */

import { env } from '../../config/env.js';
import type { ComparableListing } from '../../types/index.js';
import { ScraperError } from './errors.js';
import { parseCount } from './parse.js';
import { runSearchPage } from './runSearchPage.js';
import type { MarketplaceScraper } from './types.js';

const ORIGIN = 'https://www.snapdeal.com';
const CARD = '.product-tuple-listing';

function buildSearchUrl(query: string): { url: string; pathWithQuery: string } {
  const pathWithQuery =
    '/search?keyword=' + encodeURIComponent(query) + '&sort=rlvncy';
  return { url: ORIGIN + pathWithQuery, pathWithQuery };
}

export class SnapdealScraper implements MarketplaceScraper {
  readonly id = 'snapdeal' as const;
  readonly origin = ORIGIN;

  async search(query: string, _category: string): Promise<ComparableListing[]> {
    const listings: ComparableListing[] = [];
    const { url, pathWithQuery } = buildSearchUrl(query);

    await runSearchPage({
      platformName: 'Snapdeal',
      origin: ORIGIN,
      url,
      pathWithQuery,
      resultSelector: CARD,
      extract: async (page) => {
        const max = env.scrapeMaxResults;
        const raw = await page.$$eval(CARD, (cards, cap) => {
          return cards.slice(0, cap).map((card) => {
            const titleEl = card.querySelector('.product-title');
            const title =
              (titleEl?.getAttribute('title') ?? titleEl?.textContent ?? '')
                .replace(/\s+/g, ' ')
                .trim();
            const priceEl = card.querySelector('.product-price');
            const priceAttr = priceEl?.getAttribute('data-price') ?? priceEl?.textContent ?? '';
            const reviewEl = card.querySelector('.product-rating-count');
            const reviewText = reviewEl?.textContent ?? '';
            const filled = card.querySelector('.filled-stars') as HTMLElement | null;
            const width = filled?.style.width ?? '';
            const link = card.querySelector('a.dp-widget-link') as HTMLAnchorElement | null;
            const href = link?.getAttribute('href') ?? '';
            const img = card.querySelector('img') as HTMLImageElement | null;
            const thumbnail = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
            return { title, priceAttr, reviewText, width, href, thumbnail };
          });
        }, max);

        for (const row of raw) {
          if (!row.title) continue;
          const price = Number(String(row.priceAttr).replace(/[^\d.]/g, ''));
          if (!Number.isFinite(price) || price <= 0) continue;

          const widthMatch = String(row.width).match(/(\d+(?:\.\d+)?)/);
          const rating = widthMatch ? Math.round((Number(widthMatch[1]) / 20) * 10) / 10 : undefined;

          listings.push({
            title: row.title,
            price,
            rating: rating && rating > 0 && rating <= 5 ? rating : undefined,
            reviewCount: parseCount(row.reviewText) ?? undefined,
            url: row.href || ORIGIN,
            thumbnail: row.thumbnail || undefined,
          });
        }

        return listings.length;
      },
    });

    if (listings.length === 0) {
      throw new ScraperError('empty-results', 'Snapdeal returned no priced comparable listings.');
    }

    return listings.slice(0, env.scrapeMaxResults);
  }
}
