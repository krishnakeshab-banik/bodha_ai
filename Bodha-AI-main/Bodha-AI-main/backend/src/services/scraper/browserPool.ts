/**
 * Shared headless Chromium instance. Launching a browser per request is the
 * slowest part of Playwright; we reuse one process and open a fresh context
 * per scrape so cookies/storage never leak across marketplaces.
 */

import { chromium, type Browser, type BrowserContext } from 'playwright';

import { env } from '../../config/env.js';
import { DEFAULT_VIEWPORT, DESKTOP_USER_AGENT } from './types.js';

let browser: Browser | null = null;
let launching: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  if (launching) return launching;

  launching = chromium.launch({
    headless: env.scrapeHeadless,
  });

  try {
    browser = await launching;
    browser.on('disconnected', () => {
      browser = null;
    });
    return browser;
  } finally {
    launching = null;
  }
}

export async function newScrapeContext(): Promise<BrowserContext> {
  const instance = await getBrowser();
  return instance.newContext({
    userAgent: env.scrapeUserAgent || DESKTOP_USER_AGENT,
    locale: 'en-IN',
    viewport: DEFAULT_VIEWPORT,
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
}

export async function closeBrowser(): Promise<void> {
  if (!browser) return;
  const current = browser;
  browser = null;
  await current.close().catch(() => undefined);
}
