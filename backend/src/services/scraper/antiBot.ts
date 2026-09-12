import type { Page } from 'playwright';

import { ScraperError, scraperErrorFromClassification } from './errors.js';
import {
  classifySearchFailure,
  detectBlockedSignal,
  type PageSignals,
} from './pageState.js';

const CHALLENGE_SELECTORS = [
  '#captcha',
  'form[action*="validateCaptcha"]',
  'iframe[src*="captcha"]',
  'iframe[src*="recaptcha"]',
  'input[name="captcha"]',
  'img[src*="captcha"]',
].join(', ');

export async function collectPageSignals(
  page: Page,
  httpStatus?: number | null,
): Promise<PageSignals> {
  const title = await page.title().catch(() => '');
  const url = page.url();
  const challengeVisible = await page
    .locator(CHALLENGE_SELECTORS)
    .filter({ visible: true })
    .count()
    .catch(() => 0);
  const body = (
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  ).slice(0, 2500);

  return { title, url, body, httpStatus, challengeVisible };
}

export function logBlockedSignal(platformName: string, signal: string): void {
  console.warn(
    '[bodha-ai] ' +
      platformName +
      ' classified as BLOCKED (signal: ' +
      signal +
      ') — not a timeout',
  );
}

/**
 * Detect a CAPTCHA / bot wall / download interstitial so we can fall back
 * immediately rather than retrying against a block (which the brief forbids
 * bypassing).
 */
export async function assertNotBlocked(
  page: Page,
  platformName: string,
  httpStatus?: number | null,
): Promise<void> {
  const signals = await collectPageSignals(page, httpStatus);
  // Ignore in-page CAPTCHA widgets until the results grid is missing — a
  // hidden reCAPTCHA on a real SERP is not a block.
  const signal = detectBlockedSignal({ ...signals, challengeVisible: 0 });
  if (signal) {
    logBlockedSignal(platformName, signal);
    throw new ScraperError(
      'blocked',
      platformName +
        ' presented a bot-check, CAPTCHA, or interstitial page (' +
        signal +
        ') — falling back without retrying.',
      undefined,
      signal,
    );
  }
}

/** Inspect whatever landed in the tab and throw BLOCKED / TIMEOUT / NOT_FOUND. */
export async function throwClassifiedFailure(
  page: Page,
  platformName: string,
  context: {
    navigationTimedOut?: boolean;
    selectorTimedOut?: boolean;
    httpStatus?: number | null;
    extraMessage?: string;
    cause?: unknown;
  },
): Promise<never> {
  const signals = await collectPageSignals(page, context.httpStatus);
  const classification = classifySearchFailure(signals, {
    navigationTimedOut: context.navigationTimedOut,
    selectorTimedOut: context.selectorTimedOut,
  });

  if (classification.kind === 'BLOCKED' && classification.signal) {
    logBlockedSignal(platformName, classification.signal);
  } else if (classification.kind === 'TIMEOUT') {
    console.warn('[bodha-ai] ' + platformName + ' classified as TIMEOUT (no blocked-page signal)');
  } else {
    console.warn(
      '[bodha-ai] ' +
        platformName +
        ' classified as NOT_FOUND' +
        (classification.signal ? ' (signal: ' + classification.signal + ')' : ''),
    );
  }

  throw scraperErrorFromClassification(
    classification,
    platformName,
    context.extraMessage,
    context.cause,
  );
}
