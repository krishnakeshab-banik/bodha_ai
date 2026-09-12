import type { Page } from 'playwright';

import { env } from '../../config/env.js';
import { assertNotBlocked } from './antiBot.js';
import { newScrapeContext } from './browserPool.js';
import { randomDelay } from './delay.js';
import { ScraperError } from './errors.js';
import { assertSearchAllowed } from './robots.js';

interface RunSearchOptions {
  platformName: string;
  origin: string;
  url: string;
  pathWithQuery: string;
  resultSelector: string;
  extract: (page: Page) => Promise<number>;
}

/**
 * Shared Playwright lifecycle for one search: robots check → fresh context →
 * goto → randomised pause → wait for the results grid → CAPTCHA short-circuit
 * → extract → always close the context.
 */
export async function runSearchPage(options: RunSearchOptions): Promise<void> {
  await assertSearchAllowed(options.origin, options.pathWithQuery);

  const context = await newScrapeContext();
  const page = await context.newPage();

  try {
    await randomDelay(250, 700);

    let response;
    try {
      response = await page.goto(options.url, {
        waitUntil: 'domcontentloaded',
        timeout: env.scrapeTimeoutMs,
      });
    } catch (error) {
      throw new ScraperError(
        'timeout',
        'Timed out loading ' + options.platformName + ' search results.',
        error,
      );
    }

    if (response && response.status() >= 400) {
      throw new ScraperError(
        'blocked',
        options.platformName + ' returned HTTP ' + response.status(),
      );
    }

    await randomDelay(400, 1100);
    await assertNotBlocked(page, options.platformName);

    try {
      await page.waitForSelector(options.resultSelector, {
        timeout: Math.min(12_000, env.scrapeTimeoutMs),
        state: 'visible',
      });
    } catch (error) {
      await assertNotBlocked(page, options.platformName);
      throw new ScraperError(
        'selector-not-found',
        'Could not find the ' +
          options.platformName +
          ' results grid (' +
          options.resultSelector +
          '). The page structure may have changed.',
        error,
      );
    }

    await randomDelay(200, 500);
    const count = await options.extract(page);
    if (count === 0) {
      throw new ScraperError(
        'empty-results',
        options.platformName + ' rendered a results grid but no priced listings could be parsed.',
      );
    }
  } finally {
    await context.close().catch(() => undefined);
  }
}
