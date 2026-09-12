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
import { listingsFromFlipkartRows } from './flipkartParse.js';
import { runSearchPage } from './runSearchPage.js';
import type { MarketplaceScraper } from './types.js';

const ORIGIN = 'https://www.flipkart.com';
const CARD = 'div[data-id], a[href*="/p/"]';

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
      platformId: 'flipkart',
      platformName: 'Flipkart',
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
              const img = card.querySelector('img[alt]') as HTMLImageElement | null;
              const nestedLink = card.querySelector(
                'a[href*="/p/"], a[href*="/itm"], a[href*="/product/"]',
              ) as HTMLAnchorElement | null;
              const selfLink = card.matches('a[href]') ? (card as HTMLAnchorElement) : null;
              const link = nestedLink ?? selfLink;
              const heading = card.querySelector('a[title], div[title], span[title]');
              const title = (
                img?.alt ||
                heading?.getAttribute('title') ||
                link?.getAttribute('title') ||
                link?.textContent ||
                ''
              )
                .replace(/\s+/g, ' ')
                .trim();
              const href = link?.getAttribute('href') ?? '';
              const text = (card.textContent ?? '').replace(/\s+/g, ' ').trim();
              return { title, href, text, thumbnail: img?.src ?? '' };
            });
          },
          max,
        );

        const parsed = listingsFromFlipkartRows(raw, origin);
        listings.push(...parsed);
        return listings.length;
      },
    });

    if (listings.length === 0) {
      throw new ScraperError('empty-results', 'Flipkart returned no priced comparable listings.');
    }

    return listings.slice(0, env.scrapeMaxResults);
  }
}
