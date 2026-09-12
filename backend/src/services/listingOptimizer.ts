/**
 * listingOptimizer - turns a seller's raw listing into a marketplace-ready one.
 *
 * ============================================================================
 * MOCKED vs REAL
 * ============================================================================
 * No LLM API key ships with this demo, so the default implementation is
 * `ruleBasedOptimizer` - a deterministic, template-driven rewriter. It is pure
 * (no network, no UI, no database), which is what makes it unit-testable.
 *
 * It deliberately has the SAME signature as a real LLM-backed implementation
 * would:
 *
 *     (input: ListingOptimizerInput) => Promise<OptimizedListing>
 *
 * To switch to a live LLM, implement `llmOptimizer` with that signature and
 * change the ONE line marked `SWAP POINT` at the bottom of this file. Nothing
 * else in the codebase needs to change - `analysisService` only ever calls
 * `optimizeListing`.
 * ============================================================================
 */

import { CATEGORIES } from '../data/categories.js';
import { PLATFORMS } from '../data/platformConfig.js';
import { generateJson, hasGeminiKey } from './geminiService.js';
import type { CategoryId, OptimizedListing, PlatformId, UiLanguage } from '../types/index.js';

export interface ListingOptimizerInput {
  title: string;
  description: string;
  category: CategoryId;
  recommendedPlatform: PlatformId;
  recommendedPrice: number;
  language?: UiLanguage;
  complaintsToAvoid?: string[];
}

/** Max characters for a marketplace title before it gets truncated in search. */
const MAX_TITLE_LENGTH = 120;
const MIN_KEYWORDS = 3;
const MAX_KEYWORDS = 5;

/** Filler words that waste characters in a search-indexed title. */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'for',
  'with',
  'this',
  'that',
  'is',
  'are',
  'it',
  'to',
  'in',
  'on',
  'very',
  'nice',
  'good',
  'best',
  'quality',
]);

/** Benefit phrases the rule-based writer appends per category. */
const CATEGORY_BENEFITS: Record<UiLanguage, Record<CategoryId, string>> = {
  en: {
    'electronics-accessories':
      'Built for daily use with reliable performance and wide device compatibility.',
    apparel: 'Cut for everyday comfort with fabric that holds its shape wash after wash.',
    'home-kitchen': 'Designed to save counter space while standing up to daily kitchen use.',
    'beauty-personal-care': 'Gentle enough for daily use and suitable for all skin types.',
    toys: 'Safe, sturdy and built to survive real play, not just the unboxing.',
  },
  hi: {
    'electronics-accessories':
      'रोज़मर्रा के इस्तेमाल के लिए बनाया गया, भरोसेमंद प्रदर्शन और व्यापक डिवाइस सपोर्ट के साथ।',
    apparel: 'हर दिन के आराम के लिए कटाई, कपड़ा बार-बार धोने पर भी आकार बनाए रखता है।',
    'home-kitchen': 'काउंटर जगह बचाता है और रोज़ की रसोई के उपयोग को सहता है।',
    'beauty-personal-care': 'रोज़ के उपयोग के लिए कोमल, हर त्वचा प्रकार के लिए उपयुक्त।',
    toys: 'सुरक्षित, मज़बूत और असली खेल के लिए बना — सिर्फ़ अनबॉक्सिंग के लिए नहीं।',
  },
  ta: {
    'electronics-accessories':
      'தினசரி பயன்பாட்டுக்கு உருவாக்கப்பட்டது, நம்பகமான செயல்திறன் மற்றும் பரந்த சாதன ஆதரவுடன்.',
    apparel: 'அன்றாட வசதிக்காக வெட்டப்பட்டது, துணி மீண்டும் மீண்டும் துவைத்தும் வடிவம் மாறாது.',
    'home-kitchen': 'மேசை இடத்தைச் சேமித்து தினசரி சமையலறை பயன்பாட்டைத் தாங்கும்.',
    'beauty-personal-care': 'தினசரி பயன்பாட்டுக்கு மென்மையானது, அனைத்து தோல் வகைகளுக்கும் ஏற்றது.',
    toys: 'பாதுகாப்பானது, உறுதியானது, உண்மையான விளையாட்டுக்கு உருவாக்கப்பட்டது — அன் பாக்சிங்கிற்கு மட்டும் அல்ல.',
  },
};

const CATEGORY_LABELS_I18N: Record<UiLanguage, Record<CategoryId, string>> = {
  en: {
    'electronics-accessories': 'Electronics Accessories',
    apparel: 'Apparel',
    'home-kitchen': 'Home & Kitchen',
    'beauty-personal-care': 'Beauty & Personal Care',
    toys: 'Toys',
  },
  hi: {
    'electronics-accessories': 'इलेक्ट्रॉनिक्स एक्सेसरीज़',
    apparel: 'परिधान',
    'home-kitchen': 'घर और रसोई',
    'beauty-personal-care': 'सौंदर्य और व्यक्तिगत देखभाल',
    toys: 'खिलौने',
  },
  ta: {
    'electronics-accessories': 'எலக்ட்ரானிக்ஸ் அணுகுபொருட்கள்',
    apparel: 'ஆடை',
    'home-kitchen': 'வீடு மற்றும் சமையலறை',
    'beauty-personal-care': 'அழகு மற்றும் தனிப்பட்ட பராமரிப்பு',
    toys: 'பொம்மைகள்',
  },
};

const LANGUAGE_NAME: Record<UiLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
};

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Pull the most meaningful words out of the seller's own copy. */
function extractSalientTerms(source: string, limit: number): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const rawWord of collapseWhitespace(source).split(' ')) {
    const word = rawWord.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    if (word.length < 4 || STOP_WORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    terms.push(word);
    if (terms.length >= limit) break;
  }

  return terms;
}

/**
 * Build an SEO-shaped title: <Product> - <benefit hook> | <Category>.
 * Truncates on a word boundary so it never gets cut mid-word in search.
 */
function buildTitle(input: ListingOptimizerInput): string {
  const language = input.language ?? 'en';
  const categoryLabel = CATEGORY_LABELS_I18N[language][input.category];
  // Title-case the seller's words, but leave acronyms (USB) and spec tokens
  // (65W, 1.5m) exactly as typed - re-casing those hurts search matching.
  const base = collapseWhitespace(input.title)
    .split(' ')
    .map((word) => {
      const hasDigit = /\d/.test(word);
      const isAcronym = word.length > 1 && word === word.toUpperCase();
      return hasDigit || isAcronym ? word : titleCase(word);
    })
    .join(' ');

  const hook = CATEGORIES[input.category].keywordSeeds[0];
  const composed = base + ' - ' + titleCase(hook) + ' | ' + categoryLabel;

  if (composed.length <= MAX_TITLE_LENGTH) return composed;

  const truncated = composed.slice(0, MAX_TITLE_LENGTH);
  return truncated.slice(0, truncated.lastIndexOf(' ')).replace(/[-|,\s]+$/, '');
}

/**
 * Rewrite the description into a scannable, three-part block: a benefit-led
 * opening, the seller's own detail, and a closing trust line naming the
 * recommended marketplace.
 */
function buildDescription(input: ListingOptimizerInput): string {
  const language = input.language ?? 'en';
  const platformName = PLATFORMS[input.recommendedPlatform].name;
  const categoryLabel = CATEGORY_LABELS_I18N[language][input.category];
  const sellerCopy = collapseWhitespace(input.description);
  const detail = sellerCopy.endsWith('.') ? sellerCopy : sellerCopy + '.';
  const price = '₹' + Math.round(input.recommendedPrice).toLocaleString('en-IN');

  const closing =
    language === 'hi'
      ? categoryLabel +
        ' श्रेणी में सूचीबद्ध, ' +
        platformName +
        ' खरीदारों के लिए ' +
        price +
        ' पर। सुरक्षित पैकिंग के साथ जल्दी डिस्पैच।'
      : language === 'ta'
        ? categoryLabel +
          ' வகையில் பட்டியலிடப்பட்டு, ' +
          platformName +
          ' வாங்குபவர்களுக்கு ' +
          price +
          'க்கு விலை. பாதுகாப்பான பொதியுடன் விரைவாக அனுப்பப்படும்.'
        : 'Listed in ' +
          CATEGORIES[input.category].label.toLowerCase() +
          ' and priced for ' +
          platformName +
          ' buyers at ' +
          price +
          '. Dispatched quickly with secure packaging.';

  const complaintLine = input.complaintsToAvoid?.length
    ? language === 'hi'
      ? 'खरीदार अक्सर इन बातों की शिकायत करते हैं — अपनी लिस्टिंग में स्पष्ट करें: ' +
        input.complaintsToAvoid.slice(0, 3).join(', ') +
        '.'
      : language === 'ta'
        ? 'வாங்குபவர் இவற்றை அடிக்கடி குறை கூறுகிறார் — உங்கள் பட்டியலில் தெளிவுபடுத்துங்கள்: ' +
          input.complaintsToAvoid.slice(0, 3).join(', ') +
          '.'
        : 'Buyers often mention these issues — address them in your listing: ' +
          input.complaintsToAvoid.slice(0, 3).join(', ') +
          '.'
    : '';

  return [CATEGORY_BENEFITS[language][input.category], detail, closing, complaintLine]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Blend category seed keywords with terms lifted from the seller's own copy,
 * always returning between MIN_KEYWORDS and MAX_KEYWORDS entries.
 */
function buildKeywords(input: ListingOptimizerInput): string[] {
  const seeds = CATEGORIES[input.category].keywordSeeds;
  const fromSeller = extractSalientTerms(input.title + ' ' + input.description, MAX_KEYWORDS);

  const merged: string[] = [];
  const seen = new Set<string>();

  for (const candidate of [...seeds, ...fromSeller]) {
    const keyword = candidate.toLowerCase().trim();
    if (!keyword || seen.has(keyword)) continue;

    // Skip a single word that a longer phrase already covers ("charging" when
    // "fast charging" is present) - marketplaces index the phrase either way.
    if (merged.some((existing) => existing.split(' ').includes(keyword))) continue;

    seen.add(keyword);
    merged.push(keyword);
    if (merged.length >= MAX_KEYWORDS) break;
  }

  // Guarantee the documented floor even for very sparse seller input.
  while (merged.length < MIN_KEYWORDS) {
    merged.push(CATEGORIES[input.category].label.toLowerCase());
  }

  return merged.slice(0, MAX_KEYWORDS);
}

/**
 * Deterministic, dependency-free listing rewriter. Pure function: same input
 * always yields the same output, which is what the unit tests rely on.
 */
export async function ruleBasedOptimizer(input: ListingOptimizerInput): Promise<OptimizedListing> {
  return {
    title: buildTitle(input),
    description: buildDescription(input),
    keywords: buildKeywords(input),
  };
}

async function geminiOptimizer(input: ListingOptimizerInput): Promise<OptimizedListing> {
  const language = input.language ?? 'en';
  const platformName = PLATFORMS[input.recommendedPlatform].name;

  const listing = await generateJson<OptimizedListing>(
    [
      "You are Bodha AI's listing optimizer for Indian marketplaces (Amazon, Flipkart, Snapdeal, Alibaba).",
      'Write marketplace listing copy in ' +
        LANGUAGE_NAME[language] +
        ' only. Do not mix languages.',
      'Return JSON with keys: title (string, max 120 chars), description (string, 2-4 short paragraphs separated by blank lines), keywords (array of 3 to 5 short phrases).',
      'Keep product specs, brand tokens and model numbers (USB-C, 65W, 1.5m) unchanged.',
      'Name the recommended marketplace (' +
        platformName +
        ') and price ₹' +
        Math.round(input.recommendedPrice).toLocaleString('en-IN') +
        ' in the description.',
      'Category: ' + CATEGORY_LABELS_I18N[language][input.category],
      input.complaintsToAvoid?.length
        ? 'Address these common buyer complaints without sounding defensive: ' +
          input.complaintsToAvoid.join('; ')
        : '',
      'Seller title: ' + input.title,
      'Seller description: ' + input.description,
    ].join('\n'),
  );

  const title = collapseWhitespace(String(listing.title ?? '')).slice(0, MAX_TITLE_LENGTH);
  const description = String(listing.description ?? '').trim();
  const keywords = (Array.isArray(listing.keywords) ? listing.keywords : [])
    .map((keyword) => String(keyword).trim())
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS);

  if (!title || !description || keywords.length < MIN_KEYWORDS) {
    throw new Error('Gemini listing output failed validation');
  }

  return { title, description, keywords };
}

/**
 * Gemini when a key is configured; otherwise the deterministic templates.
 * Failures fall back to templates so an analysis never dies on the LLM.
 */
export async function optimizeListing(input: ListingOptimizerInput): Promise<OptimizedListing> {
  const language = input.language ?? 'en';
  const withLanguage = { ...input, language };

  if (hasGeminiKey()) {
    try {
      return await geminiOptimizer(withLanguage);
    } catch (error) {
      console.warn('[bodha-ai] Gemini listing optimizer failed, using templates:', error);
    }
  }

  return ruleBasedOptimizer(withLanguage);
}

/** True when listing copy is generated by templates rather than a live model. */
export const isUsingMockOptimizer = (): boolean => !hasGeminiKey();
