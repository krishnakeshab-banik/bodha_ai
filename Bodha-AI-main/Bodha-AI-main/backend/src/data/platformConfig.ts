/**
 * Static *commercial* configuration for each marketplace: commission, shipping
 * the seller absorbs, display name, and brand colour.
 *
 * This is NOT comparable-listing data. Fees are the marketplace's published
 * band (Amazon 15–20%, Flipkart 12–18%, Snapdeal 8–12%, Alibaba 3–6%) and are
 * not something a search-results scrape can observe. Live prices, demand and
 * competition come from scraperService at query time.
 */

import type { PlatformConfig, PlatformId } from '../types/index.js';

export const PLATFORM_IDS = ['amazon', 'flipkart', 'snapdeal', 'alibaba'] as const;

/** Platforms we scrape live. Alibaba is B2B and out of scope for this layer. */
export const SCRAPABLE_PLATFORM_IDS = ['amazon', 'flipkart', 'snapdeal'] as const;

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  amazon: {
    id: 'amazon',
    name: 'Amazon',
    feePercent: 0.18,
    avgShippingFee: 60,
    isBulkMarketplace: false,
    tagline: 'Highest demand, highest fees',
    accentColor: '#f59e0b',
    benefits: [
      'Wide national reach and high buyer trust',
      'Prime fast-delivery visibility for eligible listings',
      'FBA fulfilment option if you do not want to ship yourself',
    ],
  },
  flipkart: {
    id: 'flipkart',
    name: 'Flipkart',
    feePercent: 0.15,
    avgShippingFee: 50,
    isBulkMarketplace: false,
    tagline: 'Strong Indian retail, mid-range fees',
    accentColor: '#1d4ed8',
    benefits: [
      'Strong penetration in tier-2 and tier-3 India',
      'Flipkart Assured badge for eligible sellers',
      'Festive-sale spikes (Big Billion Days) drive short bursts of demand',
    ],
  },
  snapdeal: {
    id: 'snapdeal',
    name: 'Snapdeal',
    feePercent: 0.1,
    avgShippingFee: 45,
    isBulkMarketplace: false,
    tagline: 'Lower fees, thinner catalogue',
    accentColor: '#db2777',
    benefits: [
      'Lower commission than the larger marketplaces',
      'Simpler onboarding for newer sellers',
      'Better fit for value-conscious and budget segments',
    ],
  },
  alibaba: {
    id: 'alibaba',
    name: 'Alibaba',
    feePercent: 0.045,
    avgShippingFee: 25,
    isBulkMarketplace: true,
    tagline: 'B2B / bulk — live scrape not available',
    accentColor: '#0891b2',
    benefits: [
      'Volume pricing for bulk / B2B orders',
      'Lower marketplace take-rate',
      'Useful as a wholesale channel alongside Indian retail',
    ],
  },
};
