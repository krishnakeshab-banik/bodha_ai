/**
 * Photo-to-listing suggestions. Never written straight into a submitted
 * analysis — the seller must see and edit the fields first.
 */

import { CATEGORY_IDS } from '../data/categories.js';
import type { CategoryId, UiLanguage } from '../types/index.js';
import { generateVisionJson, hasGeminiKey } from './geminiService.js';

export interface AutoInsightResult {
  confident: boolean;
  suggestedTitle: string | null;
  suggestedDescription: string | null;
  suggestedCategory: CategoryId | null;
}

const LANGUAGE_NAME: Record<UiLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
};

interface VisionPayload {
  confident?: boolean;
  suggestedTitle?: string;
  suggestedDescription?: string;
  suggestedCategory?: string;
}

export async function inferListingFromPhoto(
  imageUrl: string,
  language: UiLanguage = 'en',
): Promise<AutoInsightResult> {
  if (!imageUrl.startsWith('data:image/')) {
    return emptyInsight();
  }

  if (!hasGeminiKey()) {
    return emptyInsight();
  }

  try {
    const raw = await generateVisionJson<VisionPayload>(
      imageUrl,
      [
        'You identify products in seller photos for Indian marketplaces.',
        'Write suggestedTitle and suggestedDescription in ' + LANGUAGE_NAME[language] + ' only.',
        'suggestedCategory must be exactly one of: ' + CATEGORY_IDS.join(', ') + '.',
        'Set confident=true only if the photo clearly shows a sellable product you can name.',
        'If the photo is blurry, a screenshot of UI, a person with no product, or you are guessing, set confident=false and leave the other fields empty.',
        'Return JSON: { confident, suggestedTitle, suggestedDescription, suggestedCategory }.',
        'Title max 80 characters. Description 1-3 short sentences, no marketing fluff.',
      ].join('\n'),
    );

    if (raw.confident !== true) {
      return emptyInsight();
    }

    const title = String(raw.suggestedTitle ?? '').trim();
    const description = String(raw.suggestedDescription ?? '').trim();
    const category = CATEGORY_IDS.includes(raw.suggestedCategory as CategoryId)
      ? (raw.suggestedCategory as CategoryId)
      : null;

    if (title.length < 3 || description.length < 10 || !category) {
      return emptyInsight();
    }

    return {
      confident: true,
      suggestedTitle: title.slice(0, 200),
      suggestedDescription: description.slice(0, 4000),
      suggestedCategory: category,
    };
  } catch (error) {
    console.warn('[bodha-ai] auto insight failed:', error);
    return emptyInsight();
  }
}

function emptyInsight(): AutoInsightResult {
  return {
    confident: false,
    suggestedTitle: null,
    suggestedDescription: null,
    suggestedCategory: null,
  };
}
