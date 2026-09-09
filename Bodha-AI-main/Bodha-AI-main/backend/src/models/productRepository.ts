/**
 * Data access for products and their analyses. All SQL lives here so services
 * and routes stay free of persistence details.
 */

import { DEMO_SELLER_ID, getDatabase } from './db.js';
import { PLATFORMS } from '../data/platformConfig.js';
import type {
  AnalysisRecord,
  CategoryId,
  HistoryItem,
  OptimizedListing,
  PlatformId,
  PlatformRecommendation,
  ReportInsights,
} from '../types/index.js';

interface ProductRow {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string | null;
  manufacturingCost: number;
  currentPrice: number;
  createdAt: string;
  recommendedPlatform: string;
  recommendedPrice: number;
  platformsJson: string;
  listingJson: string;
  insightsJson: string | null;
}

interface HistoryRow {
  id: string;
  title: string;
  imageUrl: string | null;
  category: string;
  recommendedPlatform: string;
  recommendedPrice: number;
  createdAt: string;
}

const SELECT_FULL = `
  SELECT p.id, p.title, p.description, p.category, p.imageUrl,
         p.manufacturingCost, p.currentPrice, p.createdAt,
         a.recommendedPlatform, a.recommendedPrice, a.platformsJson, a.listingJson,
         a.insightsJson
  FROM products p
  JOIN analyses a ON a.productId = p.id
`;

function toAnalysisRecord(row: ProductRow): AnalysisRecord {
  return {
    productId: row.id,
    title: row.title,
    description: row.description,
    category: row.category as CategoryId,
    imageUrl: row.imageUrl,
    manufacturingCost: row.manufacturingCost,
    currentPrice: row.currentPrice,
    recommendedPlatform: row.recommendedPlatform as PlatformId,
    recommendedPrice: row.recommendedPrice,
    platforms: JSON.parse(row.platformsJson) as PlatformRecommendation[],
    optimizedListing: JSON.parse(row.listingJson) as OptimizedListing,
    insights: parseInsights(row.insightsJson, row.recommendedPlatform as PlatformId),
    createdAt: row.createdAt,
  };
}

function parseInsights(raw: string | null, platformId: PlatformId): ReportInsights {
  const benefits = PLATFORMS[platformId]?.benefits ?? [];
  if (!raw) {
    return {
      language: 'en',
      competitors: [],
      reviewSentiment: { available: false, topPraises: [], topComplaints: [] },
      regionalDemand: { available: false, states: [] },
      platformBenefits: benefits,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ReportInsights>;
    return {
      language: parsed.language === 'hi' || parsed.language === 'ta' ? parsed.language : 'en',
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
      reviewSentiment: parsed.reviewSentiment ?? {
        available: false,
        topPraises: [],
        topComplaints: [],
      },
      regionalDemand: parsed.regionalDemand ?? { available: false, states: [] },
      platformBenefits: parsed.platformBenefits?.length ? parsed.platformBenefits : benefits,
    };
  } catch {
    return {
      language: 'en',
      competitors: [],
      reviewSentiment: { available: false, topPraises: [], topComplaints: [] },
      regionalDemand: { available: false, states: [] },
      platformBenefits: benefits,
    };
  }
}

/** Persist a product plus its analysis in a single transaction. */
export function saveAnalysis(record: AnalysisRecord, sellerId: string = DEMO_SELLER_ID): void {
  const db = getDatabase();

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO products
         (id, sellerId, title, description, category, imageUrl, manufacturingCost, currentPrice, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.productId,
      sellerId,
      record.title,
      record.description,
      record.category,
      record.imageUrl,
      record.manufacturingCost,
      record.currentPrice,
      record.createdAt,
    );

    db.prepare(
      `INSERT INTO analyses
         (productId, recommendedPlatform, recommendedPrice, platformsJson, listingJson, insightsJson, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.productId,
      record.recommendedPlatform,
      record.recommendedPrice,
      JSON.stringify(record.platforms),
      JSON.stringify(record.optimizedListing),
      JSON.stringify(record.insights),
      record.createdAt,
    );

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Full stored analysis for one product, or null when it does not exist. */
export function findAnalysisById(productId: string): AnalysisRecord | null {
  const row = getDatabase()
    .prepare(SELECT_FULL + ' WHERE p.id = ?')
    .get(productId) as unknown as ProductRow | undefined;

  return row ? toAnalysisRecord(row) : null;
}

/** Newest-first history summary for the seller's dashboard. */
export function listHistory(sellerId: string = DEMO_SELLER_ID, limit = 50): HistoryItem[] {
  const rows = getDatabase()
    .prepare(
      `SELECT p.id, p.title, p.imageUrl, p.category,
              a.recommendedPlatform, a.recommendedPrice, p.createdAt
       FROM products p
       JOIN analyses a ON a.productId = p.id
       WHERE p.sellerId = ?
       ORDER BY p.createdAt DESC
       LIMIT ?`,
    )
    .all(sellerId, limit) as unknown as HistoryRow[];

  return rows.map((row) => ({
    productId: row.id,
    title: row.title,
    thumbnail: row.imageUrl,
    category: row.category as CategoryId,
    recommendedPlatform: row.recommendedPlatform as PlatformId,
    recommendedPrice: row.recommendedPrice,
    createdAt: row.createdAt,
  }));
}

export function updateInsights(productId: string, insights: ReportInsights): void {
  getDatabase()
    .prepare('UPDATE analyses SET insightsJson = ? WHERE productId = ?')
    .run(JSON.stringify(insights), productId);
}
