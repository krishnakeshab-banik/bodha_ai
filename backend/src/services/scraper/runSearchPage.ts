import type { Page, Response } from 'playwright';

import { env } from '../../config/env.js';
import { agentLog, agentWarn } from '../agentLog.js';
import { assertNotBlocked, throwClassifiedFailure } from './antiBot.js';
import { newScrapeContext, sharedBrowserErrorSignal } from './browserPool.js';
import { randomDelay } from './delay.js';
import { ScraperError } from './errors.js';
import { isNotFoundStatus } from './pageState.js';
import { assertSearchAllowed } from './robots.js';

interface RunSearchOptions {
  platformId?: string;
  platformName: string;
  origin: string;
  url: string;
  pathWithQuery: string;
  resultSelector: string;
  extract: (page: Page) => Promise<number>;
}

const NAVIGATION_ATTEMPTS = 2;

function isRetryableNavigation(error: unknown, pageUrl: string): boolean {
  if (pageUrl === 'about:blank' || pageUrl.startsWith('chrome-error://')) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /Timeout|ERR_CONNECTION|ERR_ABORTED|ERR_FAILED|ERR_TIMED_OUT|net::|Target closed/i.test(
    message,
  );
}

async function gotoSearchPage(
  page: Page,
  url: string,
  platformName: string,
  agentId: string,
): Promise<Response | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= NAVIGATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: env.scrapeTimeoutMs,
      });
      if (page.url() === 'about:blank' && attempt < NAVIGATION_ATTEMPTS) {
        agentWarn(agentId, 'navigation landed on about:blank — retrying', { attempt });
        await randomDelay(400, 800);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      const pageUrl = page.url();
      if (attempt < NAVIGATION_ATTEMPTS && isRetryableNavigation(error, pageUrl)) {
        agentWarn(agentId, 'navigation retry', {
          attempt,
          url: pageUrl,
          message: error instanceof Error ? error.message : String(error),
        });
        await randomDelay(500, 1000);
        continue;
      }
      agentWarn(agentId, 'navigation failed — classifying page', { url: pageUrl, attempt });
      await throwClassifiedFailure(page, platformName, {
        navigationTimedOut: /Timeout|timed out/i.test(
          error instanceof Error ? error.message : String(error),
        ),
        extraMessage: 'Timed out loading ' + platformName + ' search results.',
        cause: error,
      });
    }
  }

  return throwClassifiedFailure(page, platformName, {
    navigationTimedOut: true,
    extraMessage: 'Timed out loading ' + platformName + ' search results.',
    cause: lastError,
  });
}

/**
 * Shared Playwright lifecycle for one search: robots check → fresh context →
 * goto (with one retry) → randomised pause → wait for the results grid →
 * CAPTCHA short-circuit → extract → always close the context.
 */
export async function runSearchPage(options: RunSearchOptions): Promise<void> {
  const agentId = options.platformId ?? options.platformName;
  agentLog(agentId, 'live attempt start', { url: options.url });

  await assertSearchAllowed(options.origin, options.pathWithQuery);

  let context;
  try {
    context = await newScrapeContext();
  } catch (error) {
    const signal = sharedBrowserErrorSignal(error) ?? 'shared-browser-launch';
    agentWarn(agentId, 'browser launch failed', {
      signal,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new ScraperError(
      'timeout',
      'Could not start a browser for ' + options.platformName + '.',
      error,
      signal,
    );
  }
  const page = await context.newPage();

  try {
    await randomDelay(200, 500);

    const response = await gotoSearchPage(page, options.url, options.platformName, agentId);
    const httpStatus = response ? response.status() : null;
    agentLog(agentId, 'navigation complete', { httpStatus, url: page.url() });

    if (isNotFoundStatus(httpStatus)) {
      throw new ScraperError(
        'not-found',
        options.platformName + ' returned HTTP ' + httpStatus,
        undefined,
        'http:' + httpStatus,
      );
    }

    if (httpStatus !== null && httpStatus >= 400) {
      await throwClassifiedFailure(page, options.platformName, {
        httpStatus,
        extraMessage: options.platformName + ' returned HTTP ' + httpStatus,
      });
    }

    await randomDelay(300, 800);
    await assertNotBlocked(page, options.platformName, httpStatus);

    try {
      await page.waitForSelector(options.resultSelector, {
        timeout: Math.min(15_000, env.scrapeTimeoutMs),
        state: 'visible',
      });
    } catch (error) {
      await throwClassifiedFailure(page, options.platformName, {
        selectorTimedOut: true,
        httpStatus,
        extraMessage:
          'Could not find the ' +
          options.platformName +
          ' results grid (' +
          options.resultSelector +
          '). The page structure may have changed.',
        cause: error,
      });
    }

    await page.evaluate(() => window.scrollTo(0, Math.min(document.body.scrollHeight, 1600)));
    await randomDelay(250, 500);
    const count = await options.extract(page);
    agentLog(agentId, 'extract complete', { pricedListings: count });
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
