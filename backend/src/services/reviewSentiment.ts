/**
 * Review snippets from competitor product pages + theme-level sentiment.
 *
 * Collection is attempted per platform against that run's real comparable
 * listing URLs. Gemini is called only when the real snippet count meets
 * MIN_REVIEW_SNIPPETS. There is no hardcoded praise/complaint fallback —
 * insufficient or failed collection yields an honest empty state.
 */

import type { ComparableListing, PlatformId, ReviewSentiment, UiLanguage } from '../types/index.js';
import { agentLog, agentWarn } from './agentLog.js';
import { newScrapeContext } from './scraper/browserPool.js';
import { enqueueForPlatform } from './scraper/queue.js';
import { generateJson, hasGeminiKey } from './geminiService.js';

const LANGUAGE_NAME: Record<UiLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
};

/** Gemini runs only when at least this many distinct real snippets exist. */
export const MIN_REVIEW_SNIPPETS = 4;

const REVIEW_SELECTORS = [
  '[data-hook="review-body"] span',
  '[data-hook="review-body"]',
  '[data-hook="review-collapsed"]',
  '[data-hook="cr-original-review-content"]',
  '.review-text-content',
  '.cr-original-review-text',
  '._11pzQk',
  '.t-ZTKy',
  '.ZmyHeo',
  'div.ZmyHeo',
  '.user-review',
  '.user-review-txt',
  '.review-text',
  '.reviewText',
  '.cust-revw',
  '[class*="user-review"]',
  '[class*="review-text"]',
];

const PAGE_TIMEOUT_MS = 15_000;
const WAIT_FOR_REVIEW_MS = 7_000;
const TOTAL_BUDGET_MS = 40_000;
const MAX_URLS_PER_PLATFORM = 4;
const MAX_SNIPPETS = 24;

export function usableSnippetCount(snippets: string[]): number {
  return uniqueSnippets(snippets).filter((text) => text.length >= 20).length;
}

export function meetsReviewThreshold(snippetCount: number): boolean {
  return snippetCount >= MIN_REVIEW_SNIPPETS;
}

/** Prefer the dedicated reviews URL so collection is not stuck on a PDP hero. */
export function toReviewPageUrl(platformId: PlatformId, url: string): string {
  if (!url) return url;

  if (platformId === 'amazon') {
    const asin = url.match(/\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})/i)?.[1];
    if (asin) return 'https://www.amazon.in/product-reviews/' + asin;
  }

  if (platformId === 'flipkart' && /\/p\//i.test(url)) {
    return url.replace(/\/p\//i, '/product-reviews/');
  }

  return url;
}

export async function collectReviewSnippets(
  platformId: PlatformId,
  listings: ComparableListing[],
): Promise<string[]> {
  const urls = listings
    .map((listing) => listing.url)
    .filter((url): url is string => Boolean(url))
    .slice(0, MAX_URLS_PER_PLATFORM);

  agentLog(platformId, 'review collection start', {
    listingCount: listings.length,
    urlCount: urls.length,
    sampleTitles: listings.slice(0, 3).map((listing) => listing.title),
    fromCards: listings.flatMap((listing) => listing.reviewSnippets ?? []).length,
  });

  if (urls.length === 0) {
    agentLog(platformId, 'review collection skipped', {
      reason: 'no listing urls on this run',
      snippetCount: 0,
    });
    return [];
  }

  const started = Date.now();
  const snippets: string[] = [];

  for (const url of urls) {
    if (Date.now() - started > TOTAL_BUDGET_MS || snippets.length >= MAX_SNIPPETS) break;
    const reviewUrl = toReviewPageUrl(platformId, url);
    try {
      const found = await enqueueForPlatform(platformId, () => scrapeReviewPage(reviewUrl));
      snippets.push(...found);
      agentLog(platformId, 'review page', {
        url: reviewUrl,
        sourceProductUrl: url,
        snippetCount: found.length,
        samples: found.slice(0, 2),
      });
    } catch (error) {
      agentWarn(platformId, 'review scrape skipped', {
        url: reviewUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const unique = uniqueSnippets(snippets).slice(0, MAX_SNIPPETS);
  agentLog(platformId, 'review collection done', {
    rawSnippetCount: snippets.length,
    uniqueSnippetCount: unique.length,
    samples: unique.slice(0, 3),
  });
  return unique;
}

async function scrapeReviewPage(url: string): Promise<string[]> {
  const context = await newScrapeContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.locator('#sp-cc-accept').click({ timeout: 1500 }).catch(() => undefined);
    await page
      .waitForSelector(REVIEW_SELECTORS.join(', '), { timeout: WAIT_FOR_REVIEW_MS })
      .catch(() => undefined);
    await page.evaluate(() => {
      const view = (globalThis as { window?: { scrollBy: (x: number, y: number) => void } }).window;
      view?.scrollBy(0, 900);
    });

    const texts = await page.evaluate((selectors: string[]) => {
      const out: string[] = [];
      const root = (
        globalThis as {
          document?: {
            querySelectorAll: (selector: string) => Iterable<{ textContent?: string | null }>;
          };
        }
      ).document;
      if (!root) return out;
      for (const selector of selectors) {
        for (const node of Array.from(root.querySelectorAll(selector))) {
          const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (text.length >= 20 && text.length <= 400) out.push(text);
        }
      }
      return out;
    }, REVIEW_SELECTORS);
    return uniqueSnippets(texts).slice(0, 8);
  } finally {
    await context.close();
  }
}

export async function analyzeReviewSentiment(
  snippets: string[],
  language: UiLanguage,
): Promise<ReviewSentiment> {
  const usable = uniqueSnippets(snippets).filter((text) => text.length >= 20);
  const proceedToGemini = meetsReviewThreshold(usable.length);

  console.log(
    '[bodha-ai ' +
      new Date().toISOString() +
      '] review threshold check ' +
      JSON.stringify({
        uniqueSnippetCount: usable.length,
        minimum: MIN_REVIEW_SNIPPETS,
        proceedToGemini,
        samples: usable.slice(0, 3),
      }),
  );

  if (!proceedToGemini) {
    return { available: false, topPraises: [], topComplaints: [] };
  }

  if (!hasGeminiKey()) {
    console.log(
      '[bodha-ai ' +
        new Date().toISOString() +
        '] review Gemini skipped ' +
        JSON.stringify({ reason: 'GEMINI_API_KEY missing', uniqueSnippetCount: usable.length }),
    );
    return { available: false, topPraises: [], topComplaints: [] };
  }

  try {
    const payload = await generateJson<{ topPraises?: string[]; topComplaints?: string[] }>(
      [
        'Summarise buyer review themes for an Indian marketplace seller.',
        'Write short theme phrases in ' + LANGUAGE_NAME[language] + ' (2-5 words each).',
        'Use ONLY the review snippets below. Do not invent themes that are not supported by them.',
        'Do not quote full reviews. No names, no order IDs.',
        'Return JSON: { topPraises: string[3-6], topComplaints: string[3-6] }',
        'Reviews:',
        ...usable.slice(0, 16).map((text, index) => String(index + 1) + '. ' + text),
      ].join('\n'),
    );

    const praises = cleanThemes(payload.topPraises);
    const complaints = cleanThemes(payload.topComplaints);
    console.log(
      '[bodha-ai ' +
        new Date().toISOString() +
        '] review Gemini result ' +
        JSON.stringify({
          uniqueSnippetCount: usable.length,
          praiseCount: praises.length,
          complaintCount: complaints.length,
          topPraises: praises,
          topComplaints: complaints,
        }),
    );
    if (praises.length === 0 && complaints.length === 0) {
      return { available: false, topPraises: [], topComplaints: [] };
    }
    return { available: true, topPraises: praises, topComplaints: complaints };
  } catch (error) {
    console.warn('[bodha-ai] review sentiment Gemini failed:', error);
    return { available: false, topPraises: [], topComplaints: [] };
  }
}

function cleanThemes(values: string[] | undefined): string[] {
  return (values ?? [])
    .map((item) => String(item).trim())
    .filter((item) => item.length >= 2 && item.length <= 48)
    .slice(0, 6);
}

function uniqueSnippets(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
