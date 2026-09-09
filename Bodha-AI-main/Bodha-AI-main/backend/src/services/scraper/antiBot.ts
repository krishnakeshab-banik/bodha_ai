import type { Page } from 'playwright';

import { ScraperError } from './errors.js';

/**
 * Detect a CAPTCHA / bot wall so we can fall back immediately rather than
 * retrying against a block (which the brief forbids bypassing).
 *
 * Deliberately does NOT match a bare "robot" substring — Amazon search pages
 * mention robots.txt in the footer and that is not a challenge.
 */
export async function assertNotBlocked(page: Page, platformName: string): Promise<void> {
  const title = (await page.title()).toLowerCase();
  const url = page.url().toLowerCase();

  const titleBlocked =
    /robot check|enter the characters|access denied|unusual traffic|captcha/.test(title);
  const urlBlocked = /\/sorry\/|validatecaptcha|showcaptcha|checkpoint/.test(url);

  const challengeVisible = await page
    .locator(
      [
        '#captcha',
        'form[action*="validateCaptcha"]',
        'iframe[src*="captcha"]',
        'iframe[src*="recaptcha"]',
        'input[name="captcha"]',
        'img[src*="captcha"]',
      ].join(', '),
    )
    .count();

  const bodySnippet = (
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
    .slice(0, 1500)
    .toLowerCase();

  const bodyBlocked =
    bodySnippet.includes('enter the characters you see') ||
    bodySnippet.includes('type the characters you see') ||
    bodySnippet.includes('sorry, we just need to make sure you') ||
    (bodySnippet.includes('unusual traffic') && bodySnippet.includes('captcha'));

  if (titleBlocked || urlBlocked || challengeVisible > 0 || bodyBlocked) {
    throw new ScraperError(
      'blocked',
      platformName + ' presented a bot-check or CAPTCHA page — falling back without retrying.',
    );
  }
}
