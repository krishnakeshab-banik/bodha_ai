/**
 * Review snippets from competitor product pages + theme-level sentiment.
 */

import type { ComparableListing, PlatformId, ReviewSentiment, UiLanguage } from '../types/index.js';
import { newScrapeContext } from './scraper/browserPool.js';
import { enqueueForPlatform } from './scraper/queue.js';
import { generateJson, hasGeminiKey } from './geminiService.js';

const LANGUAGE_NAME: Record<UiLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
};

const REVIEW_SELECTORS = [
  '[data-hook="review-body"]',
  '[data-hook="review-collapsed"]',
  '._11pzQk',
  '.t-ZTKy',
  '.user-review',
  '.review-text',
  '.reviewText',
  '[class*="review"] p',
];

const PAGE_TIMEOUT_MS = 10_000;
const TOTAL_BUDGET_MS = 22_000;
const MAX_SNIPPETS = 24;

export async function collectReviewSnippets(
  platformId: PlatformId,
  listings: ComparableListing[],
): Promise<string[]> {
  const urls = listings.map((listing) => listing.url).filter(Boolean).slice(0, 5);
  if (urls.length === 0) return [];

  const started = Date.now();
  const snippets: string[] = [];

  for (const url of urls) {
    if (Date.now() - started > TOTAL_BUDGET_MS || snippets.length >= MAX_SNIPPETS) break;
    try {
      const found = await enqueueForPlatform(platformId, () => scrapeReviewPage(url));
      snippets.push(...found);
    } catch (error) {
      console.warn('[bodha-ai] review scrape skipped:', url, error);
    }
  }

  return uniqueSnippets(snippets).slice(0, MAX_SNIPPETS);
}

async function scrapeReviewPage(url: string): Promise<string[]> {
  const context = await newScrapeContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
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
          if (text.length >= 24 && text.length <= 400) out.push(text);
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
  if (usable.length < 3) {
    return { available: false, topPraises: [], topComplaints: [] };
  }

  if (!hasGeminiKey()) {
    return ruleThemes(usable, language);
  }

  try {
    const payload = await generateJson<{ topPraises?: string[]; topComplaints?: string[] }>(
      [
        'Summarise buyer review themes for an Indian marketplace seller.',
        'Write short theme phrases in ' + LANGUAGE_NAME[language] + ' (2-5 words each).',
        'Do not quote full reviews. No names, no order IDs.',
        'Return JSON: { topPraises: string[3-6], topComplaints: string[3-6] }',
        'Reviews:',
        ...usable.slice(0, 16).map((text, index) => String(index + 1) + '. ' + text),
      ].join('\n'),
    );

    const praises = cleanThemes(payload.topPraises);
    const complaints = cleanThemes(payload.topComplaints);
    if (praises.length === 0 && complaints.length === 0) {
      return { available: false, topPraises: [], topComplaints: [] };
    }
    return { available: true, topPraises: praises, topComplaints: complaints };
  } catch (error) {
    console.warn('[bodha-ai] review sentiment Gemini failed:', error);
    return ruleThemes(usable, language);
  }
}

function ruleThemes(snippets: string[], language: UiLanguage): ReviewSentiment {
  const blob = snippets.join(' ').toLowerCase();
  const praiseKeys = ['quality', 'fast', 'value', 'durable', 'fit', 'battery', 'packaging'];
  const complaintKeys = ['late', 'broken', 'small', 'cheap', 'fake', 'slow', 'damage'];
  const praises = praiseKeys.filter((word) => blob.includes(word)).slice(0, 4);
  const complaints = complaintKeys.filter((word) => blob.includes(word)).slice(0, 4);
  if (praises.length === 0 && complaints.length === 0) {
    return { available: false, topPraises: [], topComplaints: [] };
  }

  const labels: Record<UiLanguage, Record<string, string>> = {
    en: {
      quality: 'Build quality',
      fast: 'Fast delivery',
      value: 'Value for money',
      durable: 'Durability',
      fit: 'Fit / sizing',
      battery: 'Battery life',
      packaging: 'Packaging',
      late: 'Late delivery',
      broken: 'Arrived damaged',
      small: 'Sizing runs small',
      cheap: 'Feels cheap',
      fake: 'Authenticity doubts',
      slow: 'Slow charging / performance',
      damage: 'Packaging damage',
    },
    hi: {
      quality: 'बनावट',
      fast: 'तेज़ डिलीवरी',
      value: 'कीमत के मुताबिक',
      durable: 'टिकाऊपन',
      fit: 'फिट / साइज़',
      battery: 'बैटरी लाइफ',
      packaging: 'पैकिंग',
      late: 'देर से डिलीवरी',
      broken: 'टूटा हुआ मिला',
      small: 'साइज़ छोटा',
      cheap: 'सस्ता लगता है',
      fake: 'असली होने की शंका',
      slow: 'धीमा प्रदर्शन',
      damage: 'पैकिंग खराब',
    },
    ta: {
      quality: 'கட்டமைப்பு தரம்',
      fast: 'விரைவு டெலிவரி',
      value: 'விலைக்கு மதிப்பு',
      durable: 'நீடித்து நிற்றல்',
      fit: 'பொருத்தம்',
      battery: 'பேட்டரி ஆயுள்',
      packaging: 'பேக்கிங்',
      late: 'தாமத டெலிவரி',
      broken: 'உடைந்து வந்தது',
      small: 'அளவு சிறியது',
      cheap: 'மலிவாகத் தெரிகிறது',
      fake: 'உண்மை சந்தேகம்',
      slow: 'மெதுவான செயல்',
      damage: 'பேக்கிங் சேதம்',
    },
  };

  return {
    available: true,
    topPraises: praises.map((key) => labels[language][key] ?? key),
    topComplaints: complaints.map((key) => labels[language][key] ?? key),
  };
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
