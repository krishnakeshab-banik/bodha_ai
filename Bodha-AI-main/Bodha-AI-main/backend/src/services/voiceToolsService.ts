/**
 * Read-only payloads for the ElevenLabs Conversational AI server tools.
 *
 * Every function loads the already-stored analysis for `productId`. Nothing
 * here re-scrapes a marketplace or re-runs the pricing engine.
 */

import { findAnalysisById } from '../models/productRepository.js';
import type {
  AnalysisRecord,
  CompetitorInsight,
  PlatformRecommendation,
  UiLanguage,
} from '../types/index.js';
import { buildDistinctInsights } from './competitorAnalysis.js';
import { localizeExplanation } from './explanationI18n.js';

export type VoiceToolLanguage = UiLanguage;

export interface VoiceToolUnavailable {
  available: false;
  message: string;
}

export interface ReportSummaryPayload {
  available: true;
  recommendedPlatform: string;
  recommendedPrice: number;
  fitScore: number;
}

export interface PriceExplanationPayload {
  available: true;
  breakEvenPrice: number;
  marketRange: [number, number];
  priceAction: 'increase' | 'decrease' | 'hold';
  explanation: string;
}

export interface CompetitorAnalysisPayload {
  available: true;
  competitors: Array<{
    title: string;
    price: number;
    rating: number | null;
    strengths: string[];
    weaknesses: string[];
  }>;
}

export interface ReviewSentimentPayload {
  available: true;
  topPraises: string[];
  topComplaints: string[];
}

export interface RegionalDemandPayload {
  available: true;
  topStates: Array<{ state: string; relativeInterest: number }>;
}

const COPY: Record<
  VoiceToolLanguage,
  {
    noProduct: string;
    noSummary: string;
    noPrice: string;
    noCompetitors: string;
    noReviews: string;
    noDemand: string;
  }
> = {
  en: {
    noProduct: 'No stored report is available for this product.',
    noSummary: 'A platform recommendation is not available for this product.',
    noPrice: 'Price explanation is not available for this product.',
    noCompetitors: 'Competitor analysis is not available for this product.',
    noReviews: 'Review sentiment is not available for this product.',
    noDemand: 'Regional demand is not available for this product.',
  },
  hi: {
    noProduct: 'इस उत्पाद की सहेजी गई रिपोर्ट उपलब्ध नहीं है।',
    noSummary: 'इस उत्पाद के लिए प्लेटफ़ॉर्म सुझाव उपलब्ध नहीं है।',
    noPrice: 'इस उत्पाद के लिए कीमत की व्याख्या उपलब्ध नहीं है।',
    noCompetitors: 'इस उत्पाद के लिए प्रतियोगी विश्लेषण उपलब्ध नहीं है।',
    noReviews: 'इस उत्पाद के लिए समीक्षा भावना उपलब्ध नहीं है।',
    noDemand: 'इस उत्पाद के लिए क्षेत्रीय माँग उपलब्ध नहीं है।',
  },
  ta: {
    noProduct: 'இந்தத் தயாரிப்புக்கான சேமிக்கப்பட்ட அறிக்கை இல்லை.',
    noSummary: 'இந்தத் தயாரிப்புக்கான தளப் பரிந்துரை இல்லை.',
    noPrice: 'இந்தத் தயாரிப்புக்கான விலை விளக்கம் இல்லை.',
    noCompetitors: 'இந்தத் தயாரிப்புக்கான போட்டியாளர் பகுப்பாய்வு இல்லை.',
    noReviews: 'இந்தத் தயாரிப்புக்கான விமர்சன உணர்வு இல்லை.',
    noDemand: 'இந்தத் தயாரிப்புக்கான பிராந்திய தேவை இல்லை.',
  },
};

export function parseVoiceToolLanguage(value: unknown): VoiceToolLanguage {
  return value === 'hi' || value === 'ta' ? value : 'en';
}

function unavailable(language: VoiceToolLanguage, key: keyof (typeof COPY)['en']): VoiceToolUnavailable {
  return { available: false, message: COPY[language][key] };
}

function loadRecord(productId: string): AnalysisRecord | null {
  const id = productId.trim();
  if (!id) return null;
  return findAnalysisById(id);
}

function winnerOf(record: AnalysisRecord): PlatformRecommendation | null {
  return record.platforms.find((platform) => platform.id === record.recommendedPlatform) ?? record.platforms[0] ?? null;
}

export function getReportSummary(
  productId: string,
  language: VoiceToolLanguage,
): ReportSummaryPayload | VoiceToolUnavailable {
  const record = loadRecord(productId);
  if (!record) return unavailable(language, 'noProduct');

  const winner = winnerOf(record);
  if (!winner || !Number.isFinite(winner.recommendedPrice) || !Number.isFinite(winner.fitScore)) {
    return unavailable(language, 'noSummary');
  }

  return {
    available: true,
    recommendedPlatform: winner.name,
    recommendedPrice: winner.recommendedPrice,
    fitScore: winner.fitScore,
  };
}

export function getPriceExplanation(
  productId: string,
  language: VoiceToolLanguage,
): PriceExplanationPayload | VoiceToolUnavailable {
  const record = loadRecord(productId);
  if (!record) return unavailable(language, 'noProduct');

  const winner = winnerOf(record);
  if (
    !winner ||
    winner.unavailable ||
    !Array.isArray(winner.marketPriceRange) ||
    winner.marketPriceRange.length !== 2
  ) {
    return unavailable(language, 'noPrice');
  }

  return {
    available: true,
    breakEvenPrice: winner.breakEvenPrice,
    marketRange: winner.marketPriceRange,
    priceAction: winner.priceAction,
    explanation: localizeExplanation(winner, language, record.currentPrice),
  };
}

export function getCompetitorAnalysis(
  productId: string,
  language: VoiceToolLanguage,
): CompetitorAnalysisPayload | VoiceToolUnavailable {
  const record = loadRecord(productId);
  if (!record) return unavailable(language, 'noProduct');

  const stored = record.insights.competitors.filter((card) => card.title && Number.isFinite(card.price));
  if (stored.length === 0) return unavailable(language, 'noCompetitors');

  const cards =
    record.insights.language === language
      ? stored
      : buildDistinctInsights(
          stored.map((card) => ({
            title: card.title,
            price: card.price,
            rating: card.rating ?? undefined,
            reviewCount: card.reviewCount ?? undefined,
            url: card.url,
            thumbnail: card.thumbnail ?? undefined,
          })),
          record.insights.reviewSentiment,
          language,
          record.currentPrice,
        );

  return {
    available: true,
    competitors: cards.map((card: CompetitorInsight) => ({
      title: card.title,
      price: card.price,
      rating: card.rating,
      strengths: card.strengths,
      weaknesses: card.weaknesses,
    })),
  };
}

export function getReviewSentiment(
  productId: string,
  language: VoiceToolLanguage,
): ReviewSentimentPayload | VoiceToolUnavailable {
  const record = loadRecord(productId);
  if (!record) return unavailable(language, 'noProduct');

  const sentiment = record.insights.reviewSentiment;
  if (!sentiment.available || (sentiment.topPraises.length === 0 && sentiment.topComplaints.length === 0)) {
    return unavailable(language, 'noReviews');
  }

  return {
    available: true,
    topPraises: sentiment.topPraises,
    topComplaints: sentiment.topComplaints,
  };
}

export function getRegionalDemand(
  productId: string,
  language: VoiceToolLanguage,
): RegionalDemandPayload | VoiceToolUnavailable {
  const record = loadRecord(productId);
  if (!record) return unavailable(language, 'noProduct');

  const demand = record.insights.regionalDemand;
  if (!demand.available || demand.states.length === 0) {
    return unavailable(language, 'noDemand');
  }

  return {
    available: true,
    topStates: demand.states.slice(0, 8).map((entry) => ({
      state: entry.state,
      relativeInterest: entry.interest,
    })),
  };
}
