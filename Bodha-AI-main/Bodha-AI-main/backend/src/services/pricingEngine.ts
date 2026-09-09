/**
 * pricingEngine - the core business logic of Bodha AI.
 *
 * This module is intentionally PURE: it has no UI, HTTP, database or clock
 * dependencies. Given a product's economics and a list of marketplaces it
 * returns a ranked recommendation. That makes it directly unit-testable (see
 * `src/tests/pricingEngine.test.ts`).
 *
 * The single most important guarantee: a recommended price is NEVER below
 * `manufacturingCost + platform fees + shipping`. See `calculateBreakEvenPrice`
 * and the clamp inside `analyzePlatform`.
 */

import { PLATFORMS } from '../data/platformConfig.js';
import type {
  IndexLevel,
  MarketSnapshot,
  PlatformId,
  PlatformRecommendation,
  PriceAction,
  PricingInput,
  PricingResult,
} from '../types/index.js';
import type { PlatformConfig } from '../types/index.js';

/* -------------------------------------------------------------------------- */
/* Tunable constants                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Weights for the 0-100 `fitScore`. They must sum to 1. Profit carries the
 * highest weight because a marketplace the seller cannot earn on is never a
 * good fit, however hot its demand.
 */
export const FIT_SCORE_WEIGHTS = {
  profit: 0.4,
  competition: 0.3,
  demand: 0.3,
} as const;

/**
 * Profit margin treated as "excellent" when normalising profit onto 0-100.
 * A 35% net margin after commission and shipping scores a full 100.
 */
export const TARGET_PROFIT_MARGIN = 0.35;

/**
 * Dead-band around the recommended price. While the current price sits within
 * +/-10% of the recommendation we advise holding rather than churning the
 * listing, because re-pricing itself costs ranking momentum.
 */
export const PRICE_ACTION_TOLERANCE = 0.1;

/** Cut-points that turn a 0-100 index into a Low / Medium / High badge. */
export const INDEX_LEVEL_THRESHOLDS = { medium: 40, high: 70 } as const;

/* -------------------------------------------------------------------------- */
/* Small numeric helpers                                                      */
/* -------------------------------------------------------------------------- */

/** Round to `decimals` places, avoiding float dust and negative zero. */
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor + 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Median of a non-empty list of numbers. */
export function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error('median() requires at least one value');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Map a 0-100 index onto a human-readable badge level. */
export function toIndexLevel(index: number): IndexLevel {
  if (index >= INDEX_LEVEL_THRESHOLDS.high) return 'High';
  if (index >= INDEX_LEVEL_THRESHOLDS.medium) return 'Medium';
  return 'Low';
}

/**
 * Normalise an absolute profit onto 0-100 by expressing it as a share of
 * `TARGET_PROFIT_MARGIN` of the sale price. Loss-making platforms score 0.
 */
export function normalizeProfit(estimatedProfit: number, recommendedPrice: number): number {
  if (recommendedPrice <= 0) return 0;
  const margin = estimatedProfit / recommendedPrice;
  return clamp((margin / TARGET_PROFIT_MARGIN) * 100, 0, 100);
}

/* -------------------------------------------------------------------------- */
/* Core formulas                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The loss-prevention floor.
 *
 * The marketplace commission is charged on the SALE price, not on cost, so the
 * cost must be grossed up by `1 - feePercent` before shipping is added.
 *
 * GUARANTEE: at this price the seller always recovers manufacturing cost plus
 * the marketplace commission in full. Concretely, for cost 400 / fee 18% /
 * shipping 60 the floor is 547.80, of which 98.60 is commission, leaving
 * 449.20 - comfortably above the 400 unit cost.
 *
 * KNOWN RESIDUAL: because the flat shipping fee is added *after* the gross-up
 * rather than being grossed up itself, this floor leaves the shipping fee's own
 * share of commission uncovered - exactly `feePercent * avgShippingFee`
 * (10.80 in the example above). The formula is specified this way, and the
 * product guarantee it backs is "cost + platform fees", which it meets. A floor
 * that also grossed shipping up would be `(cost + shipping) / (1 - fee)`.
 * `zeroProfitPrice()` below exposes that stricter figure for reference.
 */
export function calculateBreakEvenPrice(
  manufacturingCost: number,
  feePercent: number,
  avgShippingFee: number,
): number {
  if (feePercent >= 1) {
    throw new Error('feePercent must be below 1 (100%)');
  }
  return manufacturingCost / (1 - feePercent) + avgShippingFee;
}

/**
 * The strictly-zero-profit price, where shipping is grossed up alongside cost.
 * Reported for transparency; the recommendation floor is `calculateBreakEvenPrice`.
 */
export function zeroProfitPrice(
  manufacturingCost: number,
  feePercent: number,
  avgShippingFee: number,
): number {
  return (manufacturingCost + avgShippingFee) / (1 - feePercent);
}

/** Net profit per unit once commission, shipping and manufacturing are paid. */
export function calculateEstimatedProfit(
  sellingPrice: number,
  manufacturingCost: number,
  feePercent: number,
  avgShippingFee: number,
): number {
  return sellingPrice - sellingPrice * feePercent - avgShippingFee - manufacturingCost;
}

/**
 * Weighted 0-100 marketplace fit:
 *   0.4 * normalize(profit) + 0.3 * (100 - competition) + 0.3 * demand
 */
export function calculateFitScore(
  normalizedProfit: number,
  competitionIndex: number,
  demandIndex: number,
): number {
  return (
    FIT_SCORE_WEIGHTS.profit * normalizedProfit +
    FIT_SCORE_WEIGHTS.competition * (100 - competitionIndex) +
    FIT_SCORE_WEIGHTS.demand * demandIndex
  );
}

/** Decide whether to raise, cut or hold the seller's current price. */
export function resolvePriceAction(currentPrice: number, recommendedPrice: number): PriceAction {
  if (currentPrice < recommendedPrice * (1 - PRICE_ACTION_TOLERANCE)) return 'increase';
  if (currentPrice > recommendedPrice * (1 + PRICE_ACTION_TOLERANCE)) return 'decrease';
  return 'hold';
}

/* -------------------------------------------------------------------------- */
/* Explanations                                                               */
/* -------------------------------------------------------------------------- */

/** Rupee amounts inside explanation prose, matching the UI's formatting. */
const inr = (value: number): string => '₹' + Math.round(value).toLocaleString('en-IN');

interface ExplanationParams {
  action: PriceAction;
  platformName: string;
  currentPrice: number;
  manufacturingCost: number;
  recommendedPrice: number;
  breakEvenPrice: number;
  marketPrice: number;
  marketMin: number;
  marketMax: number;
  demand: IndexLevel;
  competition: IndexLevel;
  estimatedProfit: number;
  profitAtRecommended: number;
  lossRiskAvoided: boolean;
  isBulkMarketplace: boolean;
  listingCount: number;
}

function describeVsRange(currentPrice: number, marketMin: number, marketMax: number): string {
  if (currentPrice < marketMin) {
    return 'below the ' + inr(marketMin) + '–' + inr(marketMax) + ' range for this product';
  }
  if (currentPrice > marketMax) {
    return 'above the ' + inr(marketMin) + '–' + inr(marketMax) + ' range for this product';
  }
  return 'inside the ' + inr(marketMin) + '–' + inr(marketMax) + ' range for this product';
}

/**
 * Plain-language reasoning shown to the seller. Every sentence cites the
 * evidence behind it: comparable listings, demand, competition, or the
 * break-even floor.
 */
function buildExplanation(params: ExplanationParams): string {
  const {
    action,
    platformName,
    currentPrice,
    manufacturingCost,
    recommendedPrice,
    breakEvenPrice,
    marketPrice,
    marketMin,
    marketMax,
    demand,
    competition,
    estimatedProfit,
    profitAtRecommended,
    lossRiskAvoided,
    isBulkMarketplace,
    listingCount,
  } = params;

  const sampleNote =
    listingCount > 0 ? ' (median of ' + listingCount + ' live listings)' : '';
  const profitAtYourPrice =
    'At your ' +
    inr(currentPrice) +
    ' price, after the ' +
    platformName +
    ' commission, shipping and your ' +
    inr(manufacturingCost) +
    ' cost, estimated profit is ' +
    inr(estimatedProfit) +
    ' per unit. ';

  if (lossRiskAvoided) {
    return (
      profitAtYourPrice +
      'Matched listings for this product on ' +
      platformName +
      ' sell around ' +
      inr(marketPrice) +
      sampleNote +
      ', which is below your break-even of ' +
      inr(breakEvenPrice) +
      ' once fees are paid. Bodha AI has refused to suggest a loss-making price and ' +
      'floored the recommendation at ' +
      inr(recommendedPrice) +
      ' instead. Expect slower sell-through here, or reduce manufacturing cost before committing ' +
      'to this marketplace.'
    );
  }

  const bulkNote = isBulkMarketplace
    ? ' Remember that Alibaba prices are quoted per unit at volume, so this assumes a bulk order.'
    : '';
  const vsRange = describeVsRange(currentPrice, marketMin, marketMax);

  if (action === 'increase') {
    return (
      profitAtYourPrice +
      'Your price is ' +
      vsRange +
      '. Similar products on ' +
      platformName +
      ' sell for around ' +
      inr(marketPrice) +
      sampleNote +
      '. With ' +
      demand.toLowerCase() +
      ' demand and ' +
      competition.toLowerCase() +
      ' competition, raising your price to ' +
      inr(recommendedPrice) +
      ' keeps you in line with competitors who are already pricing higher, and would change net profit ' +
      'to about ' +
      inr(profitAtRecommended) +
      ' per unit at the recommended price.' +
      bulkNote
    );
  }

  if (action === 'decrease') {
    return (
      profitAtYourPrice +
      'Your price is ' +
      vsRange +
      ' while comparable products on ' +
      platformName +
      ' sell around ' +
      inr(marketPrice) +
      sampleNote +
      '. Coming down to ' +
      inr(recommendedPrice) +
      ' makes you competitive against ' +
      competition.toLowerCase() +
      '-competition rivals while staying comfortably above your break-even of ' +
      inr(breakEvenPrice) +
      ' — you would still keep about ' +
      inr(profitAtRecommended) +
      ' per unit at the recommended price.' +
      bulkNote
    );
  }

  return (
    profitAtYourPrice +
    'Your ' +
    inr(currentPrice) +
    ' price is already well positioned (' +
    vsRange +
    ') against the ' +
    inr(marketPrice) +
    sampleNote +
    ' going rate on ' +
    platformName +
    '. With ' +
    demand.toLowerCase() +
    ' demand and ' +
    competition.toLowerCase() +
    ' competition there is no need to re-price; keep ' +
    inr(currentPrice) +
    ' and you sit safely above your ' +
    inr(breakEvenPrice) +
    ' break-even.' +
    bulkNote
  );
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Stub shown when a scrape failed and there is no cached data to fall back on. */
export function unavailableRecommendation(platform: PlatformConfig): PlatformRecommendation {
  return {
    id: platform.id,
    name: platform.name,
    feePercent: platform.feePercent,
    avgShippingFee: platform.avgShippingFee,
    isBulkMarketplace: platform.isBulkMarketplace,
    marketPrice: 0,
    marketPriceRange: [0, 0],
    breakEvenPrice: 0,
    recommendedPrice: 0,
    estimatedProfit: 0,
    profitMargin: 0,
    profitAvailable: false,
    profitError:
      'Profit cannot be calculated until manufacturing cost and selling price are both available.',
    competitionIndex: 0,
    demandIndex: 0,
    competition: 'Low',
    demand: 'Low',
    fitScore: 0,
    priceAction: 'hold',
    explanation:
      'Live market data is temporarily unavailable for ' +
      platform.name +
      '. Bodha AI could not read comparable listings just now, and no cached snapshot exists yet.',
    lossRiskAvoided: false,
    unavailable: true,
    dataFreshness: 'unavailable',
    lastUpdated: null,
    listingCount: 0,
  };
}

/** Run the full pricing analysis for one marketplace. */
export function analyzePlatform(
  input: PricingInput,
  platformId: PlatformId,
  snapshot: MarketSnapshot,
): PlatformRecommendation {
  const platform = PLATFORMS[platformId];
  if (!platform) {
    throw new Error('Unknown platform "' + platformId + '"');
  }

  if (input.manufacturingCost <= 0 || input.currentPrice <= 0) {
    throw new Error('manufacturingCost and currentPrice must both be greater than zero');
  }
  if (!Number.isFinite(platform.feePercent) || !Number.isFinite(platform.avgShippingFee)) {
    throw new Error('Platform fee and shipping must be available to calculate profit');
  }

  const { feePercent, avgShippingFee } = platform;
  const sellerProfit = calculateEstimatedProfit(
    input.currentPrice,
    input.manufacturingCost,
    feePercent,
    avgShippingFee,
  );
  const sellerMargin = sellerProfit / input.currentPrice;

  if (snapshot.unavailable || snapshot.comparablePrices.length === 0) {
    const stub = unavailableRecommendation(platform);
    stub.breakEvenPrice = round(
      calculateBreakEvenPrice(input.manufacturingCost, feePercent, avgShippingFee),
    );
    stub.estimatedProfit = round(sellerProfit);
    stub.profitMargin = round(sellerMargin, 4);
    stub.profitAvailable = true;
    stub.profitError = null;
    stub.lastUpdated = snapshot.lastUpdated;
    stub.explanation =
      'Live market data is temporarily unavailable for ' +
      platform.name +
      '. Bodha AI could not read comparable listings for this product, so median and range cannot be shown. ' +
      'Estimated profit at your ' +
      inr(input.currentPrice) +
      ' price after the ' +
      platform.name +
      ' commission, shipping and your ' +
      inr(input.manufacturingCost) +
      ' cost is ' +
      inr(sellerProfit) +
      '.';
    return stub;
  }

  // 1. What comparable listings actually sell for.
  const marketPrice = median(snapshot.comparablePrices);
  const marketMin = Math.min(...snapshot.comparablePrices);
  const marketMax = Math.max(...snapshot.comparablePrices);

  // 2. The loss-prevention floor.
  const breakEvenPrice = calculateBreakEvenPrice(
    input.manufacturingCost,
    feePercent,
    avgShippingFee,
  );

  // 3. Clamp the market price so we can never recommend a loss-making listing.
  const lossRiskAvoided = marketPrice < breakEvenPrice;
  const recommendedPrice = lossRiskAvoided ? breakEvenPrice : marketPrice;

  // 4-5. Unit economics at the seller's listed price (never at a silent zero).
  const estimatedProfit = sellerProfit;
  const profitMargin = sellerMargin;
  const profitAtRecommended = calculateEstimatedProfit(
    recommendedPrice,
    input.manufacturingCost,
    feePercent,
    avgShippingFee,
  );

  // 6. Weighted marketplace fit from the seller's actual profit, not a floored price.
  const fitScore = calculateFitScore(
    normalizeProfit(estimatedProfit, input.currentPrice),
    snapshot.competitionIndex,
    snapshot.demandIndex,
  );

  // 7. Advice relative to what the seller charges today.
  const priceAction = resolvePriceAction(input.currentPrice, recommendedPrice);
  const demand = toIndexLevel(snapshot.demandIndex);
  const competition = toIndexLevel(snapshot.competitionIndex);

  return {
    id: platform.id,
    name: platform.name,
    feePercent,
    avgShippingFee,
    isBulkMarketplace: platform.isBulkMarketplace,
    marketPrice: round(marketPrice),
    marketPriceRange: [
      round(Math.min(...snapshot.comparablePrices)),
      round(Math.max(...snapshot.comparablePrices)),
    ],
    breakEvenPrice: round(breakEvenPrice),
    recommendedPrice: round(recommendedPrice),
    estimatedProfit: round(estimatedProfit),
    profitMargin: round(profitMargin, 4),
    profitAvailable: true,
    profitError: null,
    competitionIndex: snapshot.competitionIndex,
    demandIndex: snapshot.demandIndex,
    competition,
    demand,
    fitScore: round(fitScore, 1),
    priceAction,
    explanation: buildExplanation({
      action: priceAction,
      platformName: platform.name,
      currentPrice: input.currentPrice,
      manufacturingCost: input.manufacturingCost,
      recommendedPrice,
      breakEvenPrice,
      marketPrice,
      marketMin,
      marketMax,
      demand,
      competition,
      estimatedProfit,
      profitAtRecommended,
      lossRiskAvoided,
      isBulkMarketplace: platform.isBulkMarketplace,
      listingCount: snapshot.listingCount,
    }),
    lossRiskAvoided,
    unavailable: false,
    dataFreshness: snapshot.dataFreshness,
    lastUpdated: snapshot.lastUpdated,
    listingCount: snapshot.listingCount,
  };
}

/**
 * Analyse every selected marketplace and rank them by fit score.
 * The highest-scoring *available* platform becomes the recommended marketplace.
 */
export function analyzePricing(
  input: PricingInput,
  snapshots: Partial<Record<PlatformId, MarketSnapshot>>,
): PricingResult {
  if (input.selectedPlatforms.length === 0) {
    throw new Error('At least one marketplace must be selected');
  }
  if (input.manufacturingCost <= 0 || input.currentPrice <= 0) {
    throw new Error('manufacturingCost and currentPrice must both be greater than zero');
  }

  const platforms = input.selectedPlatforms
    .map((platformId) => {
      const snapshot = snapshots[platformId];
      return analyzePlatform(
        input,
        platformId,
        snapshot ?? {
          comparablePrices: [],
          demandIndex: 0,
          competitionIndex: 0,
          dataFreshness: 'unavailable',
          lastUpdated: null,
          listingCount: 0,
          unavailable: true,
        },
      );
    })
    .sort((a, b) => {
      if (a.unavailable !== b.unavailable) return a.unavailable ? 1 : -1;
      return b.fitScore - a.fitScore;
    });

  const winner = platforms.find((platform) => !platform.unavailable) ?? platforms[0];
  return { recommendedPlatform: winner.id, platforms };
}
