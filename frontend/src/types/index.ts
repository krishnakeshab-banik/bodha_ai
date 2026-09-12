/**
 * Response-facing types, mirroring `backend/src/types/index.ts`.
 * Kept as a hand-maintained copy so the frontend builds independently.
 */

export type PlatformId = 'amazon' | 'flipkart' | 'snapdeal' | 'alibaba';

export type CategoryId =
  'electronics-accessories' | 'apparel' | 'home-kitchen' | 'beauty-personal-care' | 'toys';

export type IndexLevel = 'Low' | 'Medium' | 'High';

export type PriceAction = 'increase' | 'decrease' | 'hold';

export type DataFreshness = 'live' | 'cached' | 'gemini' | 'unavailable';

export type DataSource = DataFreshness;

export type ScrapeStatus = 'OK' | 'BLOCKED' | 'TIMEOUT' | 'NOT_FOUND';

export interface PlatformRecommendation {
  id: PlatformId;
  name: string;
  feePercent: number;
  avgShippingFee: number;
  isBulkMarketplace: boolean;
  marketPrice: number;
  marketPriceRange: [number, number];
  breakEvenPrice: number;
  recommendedPrice: number;
  estimatedProfit: number;
  profitMargin: number;
  profitAvailable?: boolean;
  profitError?: string | null;
  profitBasis?: 'seller-fees' | 'market-and-fees';
  competitionIndex: number;
  demandIndex: number;
  competition: IndexLevel;
  demand: IndexLevel;
  fitScore: number;
  priceAction: PriceAction;
  explanation: string;
  lossRiskAvoided: boolean;
  unavailable: boolean;
  dataFreshness: DataFreshness;
  dataSource?: DataSource;
  scrapeStatus?: ScrapeStatus | null;
  blockedSignal?: string | null;
  lastUpdated: string | null;
  listingCount: number;
  confidence?: DataConfidence;
}

export interface OptimizedListing {
  title: string;
  description: string;
  keywords: string[];
}

export interface CompetitorInsight {
  title: string;
  price: number;
  rating: number | null;
  reviewCount: number | null;
  url: string;
  thumbnail: string | null;
  strengths: string[];
  weaknesses: string[];
}

export interface ReviewSentiment {
  available: boolean;
  topPraises: string[];
  topComplaints: string[];
}

export type TitleMatchQuality = 'exact' | 'close' | 'category';

export interface DataConfidence {
  level: IndexLevel;
  listingCount: number;
  titleMatch: TitleMatchQuality;
  freshness: DataFreshness;
}

export interface SeasonalTiming {
  available: boolean;
  patternDetected: boolean;
  peakMonth: number | null;
  peakInterest: number | null;
  medianInterest: number | null;
  pointCount: number;
}

export interface RegionalDemand {
  available: boolean;
  states: { state: string; interest: number }[];
  seasonalTiming?: SeasonalTiming;
}

export interface ReportInsights {
  language?: 'en' | 'hi' | 'ta';
  competitors: CompetitorInsight[];
  reviewSentiment: ReviewSentiment;
  regionalDemand: RegionalDemand;
  platformBenefits: string[];
  competitorPlatform?: PlatformId;
}

export interface AutoInsightResponse {
  confident: boolean;
  suggestedTitle: string | null;
  suggestedDescription: string | null;
  suggestedCategory: CategoryId | null;
}

export interface AnalysisResponse {
  productId: string;
  title: string;
  description: string;
  category: CategoryId;
  imageUrl: string | null;
  manufacturingCost: number;
  currentPrice: number;
  recommendedPlatform: PlatformId;
  recommendedPrice: number;
  platforms: PlatformRecommendation[];
  optimizedListing: OptimizedListing;
  insights?: ReportInsights;
  createdAt: string;
}

export interface HistoryItem {
  productId: string;
  title: string;
  thumbnail: string | null;
  category: CategoryId;
  recommendedPlatform: PlatformId;
  recommendedPrice: number;
  createdAt: string;
}

export interface AnalyzeRequest {
  title: string;
  description: string;
  category: CategoryId;
  imageUrl: string | null;
  manufacturingCost: number;
  currentPrice: number;
  platforms: PlatformId[];
  language?: 'en' | 'hi' | 'ta';
}

export interface PlatformMeta {
  id: PlatformId;
  name: string;
  feePercent: number;
  tagline: string;
  isBulkMarketplace: boolean;
  accentColor: string;
  benefits?: string[];
}

export interface CategoryMeta {
  id: CategoryId;
  label: string;
}

export interface MetaResponse {
  categories: CategoryMeta[];
  platforms: PlatformMeta[];
}

export interface VoiceSessionResponse {
  agentId: string;
  branchId?: string;
  conversationToken?: string;
  signedUrl?: string;
}

export interface VoiceQueryResponse {
  answer: string;
  language: 'en' | 'hi' | 'ta' | 'hinglish';
  source: 'gemini' | 'fallback';
}

export interface CreditStatus {
  plan: 'free' | 'pro';
  used: number;
  limit: number | null;
  remaining: number | null;
  planExpiresAt: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  plan: 'free' | 'pro';
  planExpiresAt: string | null;
  createdAt: string;
  credits: CreditStatus;
  storeName: string | null;
  storeCity: string | null;
  storeCategory: string | null;
  onboarded: boolean;
}

export interface BillingPlan {
  plan: 'free' | 'pro';
  used: number;
  limit: number | null;
  remaining: number | null;
  planExpiresAt: string | null;
  amountPaise: number;
  amountUsd: number;
  currency: string;
  razorpayConfigured: boolean;
}

export interface BillingOrder {
  mock: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}
