/**
 * Shared domain types for Bodha AI.
 *
 * These types are the contract between the pricing engine, the listing
 * optimizer, the persistence layer and the REST API. The frontend mirrors the
 * response-facing subset in `frontend/src/types/index.ts`.
 */

export type PlatformId = 'amazon' | 'flipkart' | 'snapdeal' | 'alibaba';

export type CategoryId =
  'electronics-accessories' | 'apparel' | 'home-kitchen' | 'beauty-personal-care' | 'toys';

export type IndexLevel = 'Low' | 'Medium' | 'High';

export type PriceAction = 'increase' | 'decrease' | 'hold';

/** Whether a platform's market numbers came from a live scrape or the cache. */
export type DataFreshness = 'live' | 'cached' | 'unavailable';

/** UI and AI-generation language. All three are left-to-right. */
export type UiLanguage = 'en' | 'hi' | 'ta';

/** Static, per-platform commercial configuration (fees / shipping). */
export interface PlatformConfig {
  id: PlatformId;
  name: string;
  /** Commission taken by the marketplace, as a fraction (0.18 === 18%). */
  feePercent: number;
  /** Flat per-unit logistics cost the seller absorbs, in rupees. */
  avgShippingFee: number;
  /** True for B2B/bulk marketplaces where quoted prices are volume based. */
  isBulkMarketplace: boolean;
  tagline: string;
  accentColor: string;
  /** Qualitative, non-price reasons a seller might choose this platform. */
  benefits: string[];
}

/** One comparable product card scraped from a marketplace search page. */
export interface ComparableListing {
  title: string;
  price: number;
  rating?: number;
  reviewCount?: number;
  /** Proxy for competition, where the page exposes it. */
  sellerCount?: number;
  url: string;
  thumbnail?: string;
  reviewSnippets?: string[];
}

/**
 * Per category × platform market snapshot fed into the pricing engine.
 *
 * comparablePrices come from live/cached listings. demandIndex and
 * competitionIndex are *heuristics* derived from those listings — platforms
 * do not publish these scores. See marketplaceDataProvider.ts.
 */
export interface MarketSnapshot {
  /** 3–20 comparable listing prices for similar products, in rupees. */
  comparablePrices: number[];
  /** 0-100, higher means buyers are actively searching for this category. */
  demandIndex: number;
  /** 0-100, higher means more sellers fighting over the same buyers. */
  competitionIndex: number;
  dataFreshness: DataFreshness;
  lastUpdated: string | null;
  listingCount: number;
  unavailable: boolean;
}

export interface Category {
  id: CategoryId;
  label: string;
  /** Seed keywords used by the rule-based listing optimizer. */
  keywordSeeds: string[];
}

/** Input accepted by the pure pricing engine. */
export interface PricingInput {
  manufacturingCost: number;
  currentPrice: number;
  category: CategoryId;
  selectedPlatforms: PlatformId[];
}

/** Per-platform result produced by the pricing engine. */
export interface PlatformRecommendation {
  id: PlatformId;
  name: string;
  feePercent: number;
  avgShippingFee: number;
  isBulkMarketplace: boolean;
  /** Median of the comparable listing prices for this category x platform. */
  marketPrice: number;
  marketPriceRange: [number, number];
  /** Lowest price that still covers cost + commission + shipping. */
  breakEvenPrice: number;
  recommendedPrice: number;
  /** Net profit at the seller's listed price after this platform's fees. */
  estimatedProfit: number;
  /** estimatedProfit / currentPrice, as a fraction. */
  profitMargin: number;
  /** False when cost or selling price was missing — never treat ₹0 as a real profit. */
  profitAvailable: boolean;
  profitError: string | null;
  competitionIndex: number;
  demandIndex: number;
  competition: IndexLevel;
  demand: IndexLevel;
  fitScore: number;
  priceAction: PriceAction;
  explanation: string;
  /** True when the market price sat below break-even and the floor was applied. */
  lossRiskAvoided: boolean;
  unavailable: boolean;
  dataFreshness: DataFreshness;
  lastUpdated: string | null;
  listingCount: number;
}

export interface PricingResult {
  recommendedPlatform: PlatformId;
  platforms: PlatformRecommendation[];
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

export interface RegionalInterest {
  state: string;
  interest: number;
}

export interface RegionalDemand {
  available: boolean;
  states: RegionalInterest[];
}

export interface ReportInsights {
  language: UiLanguage;
  competitors: CompetitorInsight[];
  reviewSentiment: ReviewSentiment;
  regionalDemand: RegionalDemand;
  platformBenefits: string[];
  /** Platform the competitor cards were taken from (may differ if the winner had no listings). */
  competitorPlatform?: PlatformId;
}

/** Full analysis persisted in SQLite and returned by the API. */
export interface AnalysisRecord {
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
  insights: ReportInsights;
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
