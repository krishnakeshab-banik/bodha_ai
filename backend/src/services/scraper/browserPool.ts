/**
 * Shared Chromium instance for marketplace scrapes.
 *
 * Launch order:
 *   1. Playwright's bundled Chromium
 *   2. Installed Google Chrome (`channel: 'chrome'`)
 *   3. Microsoft Edge
 *   4. A well-known Windows / macOS / Linux Chrome path
 *
 * One process is reused; each scrape still gets a fresh context so cookies
 * never leak across Amazon / Flipkart / Snapdeal.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { chromium, type Browser, type BrowserContext, type LaunchOptions } from 'playwright';

import { env } from '../../config/env.js';
import { agentWarn } from '../agentLog.js';
import { sharedBrowserErrorSignal } from './errors.js';
import { DEFAULT_VIEWPORT, DESKTOP_USER_AGENT } from './types.js';

export { sharedBrowserErrorSignal };

let browser: Browser | null = null;
let launching: Promise<Browser> | null = null;

const LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-features=IsolateOrigins,site-per-process',
];

function existingFile(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  try {
    return fs.existsSync(filePath) ? filePath : undefined;
  } catch {
    return undefined;
  }
}

function systemBrowserPath(): string | undefined {
  const home = os.homedir();
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PLAYWRIGHT_CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const candidate of candidates) {
    const found = existingFile(candidate);
    if (found) return found;
  }
  return undefined;
}

function baseLaunchOptions(overrides: LaunchOptions = {}): LaunchOptions {
  return {
    headless: env.scrapeHeadless,
    args: LAUNCH_ARGS,
    timeout: 30_000,
    ...overrides,
  };
}

async function launchChromium(): Promise<Browser> {
  const attempts: { label: string; options: LaunchOptions }[] = [
    { label: 'bundled-chromium', options: baseLaunchOptions() },
    { label: 'channel-chrome', options: baseLaunchOptions({ channel: 'chrome' }) },
    { label: 'channel-msedge', options: baseLaunchOptions({ channel: 'msedge' }) },
  ];

  const executablePath = systemBrowserPath();
  if (executablePath) {
    attempts.push({
      label: 'executable:' + executablePath,
      options: baseLaunchOptions({ executablePath }),
    });
  }

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const instance = await chromium.launch(attempt.options);
      console.log('[bodha-ai] Playwright launched via ' + attempt.label);
      return instance;
    } catch (error) {
      lastError = error;
      agentWarn('browser', 'launch attempt failed', {
        via: attempt.label,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Could not launch Chromium, Chrome, or Edge for marketplace scrapes');
}

export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;

  const inFlight = launching;
  if (inFlight) {
    try {
      return await inFlight;
    } catch {
      // Sibling launch failed — retry independently.
    }
  }

  launching = launchChromium();

  try {
    browser = await launching;
    browser.on('disconnected', () => {
      browser = null;
    });
    return browser;
  } catch (error) {
    browser = null;
    throw error;
  } finally {
    launching = null;
  }
}

export async function newScrapeContext(): Promise<BrowserContext> {
  const instance = await getBrowser();
  return instance.newContext({
    userAgent: env.scrapeUserAgent || DESKTOP_USER_AGENT,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    viewport: DEFAULT_VIEWPORT,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    },
  });
}

export async function closeBrowser(): Promise<void> {
  if (!browser) return;
  const current = browser;
  browser = null;
  await current.close().catch(() => undefined);
}
