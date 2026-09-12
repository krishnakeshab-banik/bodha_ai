/**
 * Seeds a demo account with 5 realistic analyses, one per category.
 *
 * Uses the app's own pure/rule-based functions (analyzePricing,
 * optimizeListing, rankCompetitors, describeCompetitors) with hand-supplied
 * comparable-listing data instead of a live scrape or Gemini call — so this
 * is fast, deterministic, and safe to re-run (network-free, no API keys
 * needed). Review sentiment and regional demand are hand-authored for the
 * same reason (the real services call a live review-page scrape / Google
 * Trends).
 *
 * Run with: npx tsx scripts/seed-demo.ts
 */

import { randomUUID } from 'node:crypto';

import { PLATFORMS } from '../src/data/platformConfig.js';
import { getDatabase } from '../src/models/db.js';
import { listHistory, saveAnalysis } from '../src/models/productRepository.js';
import { createUser, findUserByEmail, saveStoreProfile } from '../src/models/userRepository.js';
import { describeCompetitors, rankCompetitors } from '../src/services/competitorAnalysis.js';
import { optimizeListing } from '../src/services/listingOptimizer.js';
import { analyzePricing } from '../src/services/pricingEngine.js';
import type {
  AnalysisRecord,
  CategoryId,
  ComparableListing,
  PlatformId,
  RegionalDemand,
  ReviewSentiment,
} from '../src/types/index.js';

const DEMO_EMAIL = 'bodhaai.test@gmail.com';
const DEMO_PASSWORD = 'qwerty123';
const DEMO_NAME = 'Bodha AI Demo Seller';

interface DemoProduct {
  title: string;
  description: string;
  category: CategoryId;
  manufacturingCost: number;
  currentPrice: number;
  platforms: PlatformId[];
  listingsByPlatform: Partial<Record<PlatformId, ComparableListing[]>>;
  reviewSentiment: ReviewSentiment;
  regionalDemand: RegionalDemand;
  demand: Partial<Record<PlatformId, number>>;
  competition: Partial<Record<PlatformId, number>>;
}

function listing(
  title: string,
  price: number,
  rating: number,
  reviewCount: number,
  url: string,
): ComparableListing {
  return { title, price, rating, reviewCount, url, thumbnail: undefined };
}

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    description:
      'Industry-leading active noise cancellation, 30-hour battery life, and multipoint Bluetooth pairing for calls and music.',
    category: 'electronics-accessories',
    manufacturingCost: 18000,
    currentPrice: 24990,
    platforms: ['amazon', 'flipkart', 'snapdeal'],
    listingsByPlatform: {
      amazon: [
        listing('Sony WH-1000XM5 Wireless Headphones, Black', 24990, 4.6, 8200, 'https://amazon.in/dp/sony-xm5-black'),
        listing('Sony WH-1000XM5 Wireless Headphones, Silver', 26990, 4.5, 3100, 'https://amazon.in/dp/sony-xm5-silver'),
        listing('Sony WH-1000XM4 Wireless Headphones', 19990, 4.4, 15400, 'https://amazon.in/dp/sony-xm4'),
      ],
      flipkart: [
        listing('Sony WH-1000XM5 Bluetooth Headset', 24490, 4.5, 2200, 'https://flipkart.com/sony-xm5'),
        listing('Sony WH-1000XM4 Bluetooth Headset', 20990, 4.4, 6100, 'https://flipkart.com/sony-xm4'),
      ],
      snapdeal: [listing('Sony WH-1000XM5 Headphones', 25490, 4.3, 340, 'https://snapdeal.com/sony-xm5')],
    },
    reviewSentiment: {
      available: true,
      topPraises: ['best-in-class noise cancellation', '30-hour battery life', 'comfortable for long flights'],
      topComplaints: ['touch controls feel finicky', 'case is bulkier than the XM4'],
    },
    regionalDemand: {
      available: true,
      states: [
        { state: 'Maharashtra', interest: 92 },
        { state: 'Karnataka', interest: 88 },
        { state: 'Delhi', interest: 81 },
        { state: 'Telangana', interest: 74 },
      ],
    },
    demand: { amazon: 85, flipkart: 78, snapdeal: 50 },
    competition: { amazon: 60, flipkart: 55, snapdeal: 35 },
  },
  {
    title: "Men's Cotton Casual Full Sleeve Shirt",
    description:
      '100% breathable cotton, regular fit, machine washable. Available in navy, olive and white.',
    category: 'apparel',
    manufacturingCost: 350,
    currentPrice: 799,
    platforms: ['amazon', 'flipkart', 'snapdeal'],
    listingsByPlatform: {
      amazon: [
        listing("Men's Cotton Casual Shirt, Navy", 799, 4.2, 1900, 'https://amazon.in/dp/shirt-navy'),
        listing("Men's Cotton Casual Shirt, Olive", 749, 4.1, 1200, 'https://amazon.in/dp/shirt-olive'),
        listing("Men's Slim Fit Cotton Shirt", 899, 4.3, 3400, 'https://amazon.in/dp/shirt-slim'),
      ],
      flipkart: [
        listing("Men's Casual Cotton Shirt", 699, 4.0, 2600, 'https://flipkart.com/shirt-casual'),
        listing("Men's Regular Fit Shirt", 649, 3.9, 980, 'https://flipkart.com/shirt-regular'),
      ],
      snapdeal: [listing("Men's Cotton Shirt Combo", 599, 3.8, 410, 'https://snapdeal.com/shirt-combo')],
    },
    reviewSentiment: {
      available: true,
      topPraises: ['fabric feels premium', 'true to size', 'good for daily office wear'],
      topComplaints: ['colour slightly different from photos', 'buttons loosen after a few washes'],
    },
    regionalDemand: {
      available: true,
      states: [
        { state: 'Uttar Pradesh', interest: 79 },
        { state: 'Maharashtra', interest: 73 },
        { state: 'Gujarat', interest: 68 },
        { state: 'Rajasthan', interest: 61 },
      ],
    },
    demand: { amazon: 70, flipkart: 65, snapdeal: 42 },
    competition: { amazon: 75, flipkart: 80, snapdeal: 60 },
  },
  {
    title: 'Stainless Steel Insulated Water Bottle 1 Litre',
    description:
      'Double-wall vacuum insulation keeps drinks cold for 24 hours or hot for 12. Leak-proof lid, wide mouth for ice cubes.',
    category: 'home-kitchen',
    manufacturingCost: 180,
    currentPrice: 499,
    platforms: ['amazon', 'flipkart', 'snapdeal', 'alibaba'],
    listingsByPlatform: {
      amazon: [
        listing('Steel Insulated Water Bottle 1L, Matte Black', 499, 4.4, 5200, 'https://amazon.in/dp/bottle-black'),
        listing('Steel Insulated Water Bottle 1L, Blue', 479, 4.3, 3100, 'https://amazon.in/dp/bottle-blue'),
        listing('Steel Insulated Water Bottle 750ml', 399, 4.2, 4400, 'https://amazon.in/dp/bottle-750'),
      ],
      flipkart: [
        listing('Vacuum Insulated Steel Bottle 1L', 449, 4.2, 2800, 'https://flipkart.com/bottle-1l'),
        listing('Insulated Steel Flask 1L', 429, 4.1, 1500, 'https://flipkart.com/bottle-flask'),
      ],
      snapdeal: [listing('Steel Water Bottle 1L', 349, 3.9, 620, 'https://snapdeal.com/bottle-1l')],
      alibaba: [listing('Bulk Insulated Steel Bottle 1L (min. 100 units)', 240, 4.0, 90, 'https://alibaba.com/bottle-bulk')],
    },
    reviewSentiment: {
      available: true,
      topPraises: ['keeps water cold all day', 'no metallic taste', 'sturdy build'],
      topComplaints: ['a bit heavy to carry', 'lid gasket needs replacing after a year'],
    },
    regionalDemand: {
      available: true,
      states: [
        { state: 'Karnataka', interest: 76 },
        { state: 'Tamil Nadu', interest: 71 },
        { state: 'Maharashtra', interest: 69 },
        { state: 'Kerala', interest: 58 },
      ],
    },
    demand: { amazon: 72, flipkart: 66, snapdeal: 40, alibaba: 55 },
    competition: { amazon: 68, flipkart: 62, snapdeal: 45, alibaba: 20 },
  },
  {
    title: 'Vitamin C Brightening Face Serum 30ml',
    description:
      '20% Vitamin C with hyaluronic acid and vitamin E. Reduces dark spots and evens skin tone with daily use.',
    category: 'beauty-personal-care',
    manufacturingCost: 120,
    currentPrice: 399,
    platforms: ['amazon', 'flipkart', 'snapdeal'],
    listingsByPlatform: {
      amazon: [
        listing('Vitamin C Face Serum 30ml, Brightening', 399, 4.3, 6700, 'https://amazon.in/dp/serum-vitc'),
        listing('Vitamin C + Niacinamide Serum 30ml', 449, 4.4, 4100, 'https://amazon.in/dp/serum-niacinamide'),
        listing('Vitamin C Serum 20ml Travel Size', 249, 4.1, 1800, 'https://amazon.in/dp/serum-travel'),
      ],
      flipkart: [
        listing('Vitamin C Brightening Serum 30ml', 349, 4.1, 3200, 'https://flipkart.com/serum-30ml'),
        listing('Vitamin C Face Serum for Glowing Skin', 299, 3.9, 1900, 'https://flipkart.com/serum-glow'),
      ],
      snapdeal: [listing('Vitamin C Serum 30ml', 249, 3.8, 380, 'https://snapdeal.com/serum-30ml')],
    },
    reviewSentiment: {
      available: true,
      topPraises: ['visible glow within two weeks', 'lightweight, non-greasy', 'absorbs quickly'],
      topComplaints: ['slight tingling on sensitive skin', 'bottle dropper leaks a little'],
    },
    regionalDemand: {
      available: true,
      states: [
        { state: 'Delhi', interest: 84 },
        { state: 'Maharashtra', interest: 80 },
        { state: 'Karnataka', interest: 77 },
        { state: 'West Bengal', interest: 63 },
      ],
    },
    demand: { amazon: 80, flipkart: 70, snapdeal: 44 },
    competition: { amazon: 78, flipkart: 72, snapdeal: 50 },
  },
  {
    title: 'Wooden Building Blocks Set for Kids (100 pieces)',
    description:
      'Non-toxic, splinter-free wooden blocks in assorted shapes and colours. Encourages creativity and motor skills for ages 3+.',
    category: 'toys',
    manufacturingCost: 250,
    currentPrice: 599,
    platforms: ['amazon', 'flipkart', 'alibaba'],
    listingsByPlatform: {
      amazon: [
        listing('Wooden Building Blocks Set, 100 pcs', 599, 4.5, 2400, 'https://amazon.in/dp/blocks-100'),
        listing('Wooden Building Blocks Set, 150 pcs', 799, 4.6, 1600, 'https://amazon.in/dp/blocks-150'),
        listing('Wooden Alphabet Blocks Set', 449, 4.3, 3100, 'https://amazon.in/dp/blocks-alphabet'),
      ],
      flipkart: [
        listing('Wooden Blocks Learning Set 100 pcs', 549, 4.3, 1400, 'https://flipkart.com/blocks-100'),
        listing('Wooden Educational Blocks Set', 499, 4.2, 890, 'https://flipkart.com/blocks-edu'),
      ],
      alibaba: [listing('Bulk Wooden Building Blocks (min. 200 sets)', 180, 4.1, 60, 'https://alibaba.com/blocks-bulk')],
    },
    reviewSentiment: {
      available: true,
      topPraises: ['kids love the bright colours', 'smooth, splinter-free edges', 'good value for the piece count'],
      topComplaints: ['storage box lid is flimsy', 'a few pieces arrived chipped'],
    },
    regionalDemand: {
      available: true,
      states: [
        { state: 'Maharashtra', interest: 70 },
        { state: 'Tamil Nadu', interest: 66 },
        { state: 'Karnataka', interest: 64 },
        { state: 'Punjab', interest: 52 },
      ],
    },
    demand: { amazon: 65, flipkart: 58, alibaba: 48 },
    competition: { amazon: 55, flipkart: 50, alibaba: 18 },
  },
];

function buildSnapshots(product: DemoProduct) {
  const snapshots: Record<string, ReturnType<typeof snapshotFor>> = {};
  for (const platformId of product.platforms) {
    snapshots[platformId] = snapshotFor(product, platformId);
  }
  return snapshots;
}

function snapshotFor(product: DemoProduct, platformId: PlatformId) {
  const listings = product.listingsByPlatform[platformId] ?? [];
  return {
    comparablePrices: listings.map((item) => item.price),
    demandIndex: product.demand[platformId] ?? 50,
    competitionIndex: product.competition[platformId] ?? 50,
    dataFreshness: 'cached' as const,
    lastUpdated: new Date().toISOString(),
    listingCount: listings.length,
    unavailable: listings.length === 0,
  };
}

/**
 * Demo history should read as past usage, not five analyses run in the same
 * second — and backdating it out of the current calendar month keeps it from
 * silently eating into the free-plan quota `creditStatus` counts per month.
 */
function backdatedCreatedAt(offsetDays: number): string {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - 1, 3 + offsetDays);
  return date.toISOString();
}

async function buildRecord(product: DemoProduct, index: number): Promise<AnalysisRecord> {
  const pricing = analyzePricing(
    {
      manufacturingCost: product.manufacturingCost,
      currentPrice: product.currentPrice,
      category: product.category,
      selectedPlatforms: product.platforms,
    },
    buildSnapshots(product),
  );

  const winner =
    pricing.platforms.find((platform) => platform.id === pricing.recommendedPlatform) ??
    pricing.platforms[0];

  const competitorListings = product.listingsByPlatform[pricing.recommendedPlatform] ?? [];
  const ranked = rankCompetitors(competitorListings, 5);
  const competitors = await describeCompetitors(ranked, product.reviewSentiment, 'en', {
    sellerPrice: product.currentPrice,
  });

  const optimizedListing = await optimizeListing({
    title: product.title,
    description: product.description,
    category: product.category,
    recommendedPlatform: pricing.recommendedPlatform,
    recommendedPrice: winner.recommendedPrice || product.currentPrice,
    language: 'en',
    complaintsToAvoid: product.reviewSentiment.topComplaints,
  });

  return {
    productId: randomUUID(),
    title: product.title,
    description: product.description,
    category: product.category,
    imageUrl: null,
    manufacturingCost: product.manufacturingCost,
    currentPrice: product.currentPrice,
    recommendedPlatform: pricing.recommendedPlatform,
    recommendedPrice: winner.recommendedPrice,
    platforms: pricing.platforms,
    optimizedListing,
    insights: {
      language: 'en',
      competitors,
      reviewSentiment: product.reviewSentiment,
      regionalDemand: product.regionalDemand,
      platformBenefits: PLATFORMS[pricing.recommendedPlatform].benefits,
      competitorPlatform: pricing.recommendedPlatform,
    },
    createdAt: backdatedCreatedAt(index),
  };
}

async function main() {
  getDatabase();

  let demoUser = findUserByEmail(DEMO_EMAIL);
  if (!demoUser) {
    demoUser = createUser({
      id: randomUUID(),
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: DEMO_NAME,
    });
    console.log('Created demo account:', DEMO_EMAIL);
  } else {
    console.log('Demo account already exists:', DEMO_EMAIL);
  }

  if (!demoUser.onboarded) {
    demoUser = saveStoreProfile(demoUser.id, {
      storeName: 'Bodha AI Demo Store',
      storeCity: 'Bengaluru',
      storeCategory: 'electronics-accessories',
    });
    console.log('Onboarded demo account so it lands on the dashboard, not the setup form.');
  }

  const existingHistory = listHistory(demoUser.id, 100);
  if (existingHistory.length >= DEMO_PRODUCTS.length) {
    console.log(
      'Demo account already has ' + existingHistory.length + ' analyses — skipping reseed.',
    );
    console.log('\nDemo login: ' + DEMO_EMAIL + ' / ' + DEMO_PASSWORD);
    return;
  }

  for (const [index, product] of DEMO_PRODUCTS.entries()) {
    const record = await buildRecord(product, index);
    saveAnalysis(record, demoUser.id);
    console.log('Seeded: ' + record.title + ' -> ' + record.recommendedPlatform + ' @ ₹' + record.recommendedPrice);
  }

  console.log('\nDemo login: ' + DEMO_EMAIL + ' / ' + DEMO_PASSWORD);
}

await main();
