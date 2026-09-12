/**
 * Classify marketplace search-page failures from URL / title / body / HTTP
 * status — without Playwright — so a bot-check or "Download is starting"
 * interstitial is reported as BLOCKED, not a generic timeout.
 */

import type { ScrapeStatus } from '../../types/index.js';

export type { ScrapeStatus };

export interface PageSignals {
  url?: string;
  title?: string;
  body?: string;
  httpStatus?: number | null;
  challengeVisible?: number;
}

export interface BlockedClassification {
  kind: 'BLOCKED';
  signal: string;
}

export interface SearchFailureClassification {
  kind: ScrapeStatus;
  signal?: string;
}

const BLOCKED_TITLES: { re: RegExp; signal: string }[] = [
  { re: /robot check/i, signal: 'title:robot-check' },
  { re: /enter the characters/i, signal: 'title:captcha-characters' },
  { re: /access denied/i, signal: 'title:access-denied' },
  { re: /unusual traffic/i, signal: 'title:unusual-traffic' },
  { re: /\bcaptcha\b/i, signal: 'title:captcha' },
  { re: /automated access/i, signal: 'title:automated-access' },
  { re: /download is starting/i, signal: 'title:download-interstitial' },
];

const BLOCKED_URLS: { re: RegExp; signal: string }[] = [
  { re: /\/sorry\//i, signal: 'url:sorry-redirect' },
  { re: /validatecaptcha/i, signal: 'url:validate-captcha' },
  { re: /showcaptcha/i, signal: 'url:show-captcha' },
  { re: /\/checkpoint(?:\/|$|\?)/i, signal: 'url:checkpoint' },
  { re: /\/errors\/validatecaptcha/i, signal: 'url:errors-captcha' },
  { re: /opfcaptcha/i, signal: 'url:opf-captcha' },
];

const BLOCKED_BODIES: { re: RegExp; signal: string }[] = [
  // Amazon's anti-bot interstitial — not the everyday "Download the App" CTA.
  { re: /download is starting/i, signal: 'body:download-interstitial' },
  { re: /your download will start/i, signal: 'body:download-interstitial' },
  { re: /enter the characters you see/i, signal: 'body:captcha-characters' },
  { re: /type the characters you see/i, signal: 'body:captcha-characters' },
  { re: /sorry, we just need to make sure you/i, signal: 'body:bot-check' },
  { re: /to discuss automated access to amazon/i, signal: 'body:automated-access' },
  { re: /click the button below to continue shopping/i, signal: 'body:continue-shopping-wall' },
];

function firstMatch(
  value: string | undefined,
  rules: { re: RegExp; signal: string }[],
): string | null {
  if (!value) return null;
  for (const rule of rules) {
    if (rule.re.test(value)) return rule.signal;
  }
  return null;
}

/**
 * Return the first blocked-state signal found on the page, or null when the
 * page looks like a normal (or merely empty) search result.
 *
 * Deliberately does NOT match a bare "robot" substring — Amazon search pages
 * mention robots.txt in the footer and that is not a challenge.
 */
export function detectBlockedSignal(page: PageSignals): string | null {
  const status = page.httpStatus ?? 0;
  if (status === 403 || status === 429 || status === 503) {
    return 'http:' + status;
  }

  const titleSignal = firstMatch(page.title, BLOCKED_TITLES);
  if (titleSignal) return titleSignal;

  const urlSignal = firstMatch(page.url, BLOCKED_URLS);
  if (urlSignal) return urlSignal;

  // Only a *visible* challenge counts. Search pages often embed a hidden
  // reCAPTCHA / login iframe; treating those as BLOCKED aborted live scrapes
  // on Amazon and Flipkart at the same time.
  if ((page.challengeVisible ?? 0) > 0) {
    return 'dom:captcha-challenge';
  }

  const body = (page.body ?? '').slice(0, 2500);
  const bodySignal = firstMatch(body, BLOCKED_BODIES);
  if (bodySignal) return bodySignal;

  if (body.includes('unusual traffic') && body.includes('captcha')) {
    return 'body:unusual-traffic-captcha';
  }

  return null;
}

export function isNotFoundStatus(httpStatus: number | null | undefined): boolean {
  return httpStatus === 404 || httpStatus === 410;
}

/**
 * Decide BLOCKED vs TIMEOUT vs NOT_FOUND from page signals *before* falling
 * through to a generic timeout. A blocked interstitial that happens to stall
 * navigation is still BLOCKED.
 */
export function classifySearchFailure(
  page: PageSignals,
  context: { navigationTimedOut?: boolean; selectorTimedOut?: boolean } = {},
): SearchFailureClassification {
  const signal = detectBlockedSignal(page);
  if (signal) {
    return { kind: 'BLOCKED', signal };
  }

  if (isNotFoundStatus(page.httpStatus)) {
    return { kind: 'NOT_FOUND', signal: 'http:' + page.httpStatus };
  }

  if (context.navigationTimedOut) {
    return { kind: 'TIMEOUT' };
  }

  return { kind: 'NOT_FOUND', signal: context.selectorTimedOut ? 'selector-missing' : undefined };
}
