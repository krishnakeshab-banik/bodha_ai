/**
 * LIVE scrape integration test — skipped in CI / default `npm test`.
 *
 * Run sparingly (marketplaces will block a tight loop):
 *
 *   PowerShell:  $env:LIVE_SCRAPE=1; npm run test:live-scrape
 *   bash:        LIVE_SCRAPE=1 npm run test:live-scrape
 *
 * Imports are dynamic so the default unit-test run does not boot Playwright.
 */

import { afterAll, describe, expect, it } from 'vitest';

const live = process.env.LIVE_SCRAPE === '1';

describe.skipIf(!live)('live scrape integration (set LIVE_SCRAPE=1)', () => {
  afterAll(async () => {
    const { closeBrowser } = await import('../services/scraper/browserPool.js');
    await closeBrowser();
  });

  const query = 'USB C Fast Charging Cable';
  const category = 'electronics-accessories';

  it(
    'Amazon.in returns at least one priced listing',
    async () => {
      const { AmazonScraper } = await import('../services/scraper/amazonScraper.js');
      const listings = await new AmazonScraper().search(query, category);
      expect(listings.length).toBeGreaterThan(0);
      expect(listings[0].price).toBeGreaterThan(0);
      expect(listings[0].title.length).toBeGreaterThan(3);
      expect(listings[0].url).toMatch(/amazon\.in/i);
    },
    60_000,
  );

  it(
    'Flipkart returns at least one priced listing',
    async () => {
      const { FlipkartScraper } = await import('../services/scraper/flipkartScraper.js');
      const listings = await new FlipkartScraper().search(query, category);
      expect(listings.length).toBeGreaterThan(0);
      expect(listings[0].price).toBeGreaterThan(0);
      expect(listings[0].title.length).toBeGreaterThan(3);
      expect(listings[0].url).toMatch(/flipkart\.com/i);
    },
    60_000,
  );

  it(
    'Snapdeal returns at least one priced listing',
    async () => {
      const { SnapdealScraper } = await import('../services/scraper/snapdealScraper.js');
      const listings = await new SnapdealScraper().search(query, category);
      expect(listings.length).toBeGreaterThan(0);
      expect(listings[0].price).toBeGreaterThan(0);
      expect(listings[0].title.length).toBeGreaterThan(3);
    },
    60_000,
  );
});
