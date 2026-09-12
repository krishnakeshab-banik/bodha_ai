/**
 * CacheService — SQLite-backed listing cache.
 *
 * Cache-first with live refresh:
 *   1. If a row for this platform/category/query is younger than CACHE_TTL_HOURS,
 *      return it and skip the scrape.
 *   2. Otherwise scrape, write the row, return live data.
 *   3. If the scrape fails, return the most recent row even if stale, so the
 *      demo degrades to "Prices last updated N hours ago" instead of crashing.
 */

import { env } from '../config/env.js';
import type { CategoryId, ComparableListing, PlatformId } from '../types/index.js';
import { getDatabase } from '../models/db.js';
import { isMongoConnected, ListingCacheModel } from '../models/mongo.js';

export interface CachedListings {
  listings: ComparableListing[];
  fetchedAt: string;
  fresh: boolean;
}

interface CacheRow {
  listingsJson: string;
  fetchedAt: string;
}

export function cacheKey(platformId: PlatformId, category: CategoryId, query: string): string {
  return [platformId, category, normalizeQuery(query)].join('::');
}

export function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 120);
}

function ttlMs(): number {
  return env.cacheTtlHours * 60 * 60 * 1000;
}

export function readCache(
  platformId: PlatformId,
  category: CategoryId,
  query: string,
): CachedListings | null {
  const row = getDatabase()
    .prepare(`SELECT listingsJson, fetchedAt FROM listing_cache WHERE cacheKey = ?`)
    .get(cacheKey(platformId, category, query)) as CacheRow | undefined;

  if (!row) return null;

  const listings = JSON.parse(row.listingsJson) as ComparableListing[];
  if (!Array.isArray(listings) || listings.length === 0) return null;

  const age = Date.now() - new Date(row.fetchedAt).getTime();
  return {
    listings,
    fetchedAt: row.fetchedAt,
    fresh: Number.isFinite(age) && age >= 0 && age < ttlMs(),
  };
}

export function writeCache(
  platformId: PlatformId,
  category: CategoryId,
  query: string,
  listings: ComparableListing[],
  fetchedAt: string = new Date().toISOString(),
): void {
  const key = cacheKey(platformId, category, query);
  const normalized = normalizeQuery(query);
  const listingsJson = JSON.stringify(listings);

  getDatabase()
    .prepare(
      `INSERT INTO listing_cache (cacheKey, platformId, category, query, listingsJson, fetchedAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(cacheKey) DO UPDATE SET
         listingsJson = excluded.listingsJson,
         fetchedAt = excluded.fetchedAt,
         query = excluded.query`,
    )
    .run(key, platformId, category, normalized, listingsJson, fetchedAt);

  if (isMongoConnected()) {
    ListingCacheModel.updateOne(
      { _id: key },
      {
        $set: {
          platformId,
          category,
          query: normalized,
          listingsJson,
          fetchedAt,
        },
      },
      { upsert: true },
    ).catch((err) => console.error('[bodha-ai] Mongo sync listing cache error:', err));
  }
}

export function clearCache(): number {
  const result = getDatabase().prepare('DELETE FROM listing_cache').run();
  if (isMongoConnected()) {
    ListingCacheModel.deleteMany({}).catch((err) =>
      console.error('[bodha-ai] Mongo clear listing cache error:', err),
    );
  }
  return Number(result.changes ?? 0);
}

/** Best cached listings for this product across scrapable platforms. */
export function findBestCachedListings(
  category: CategoryId,
  title: string,
  platforms: PlatformId[],
): { platformId: PlatformId; listings: ComparableListing[] } | null {
  const queries = uniqueQueries(title);
  let best: { platformId: PlatformId; listings: ComparableListing[] } | null = null;

  for (const platformId of platforms) {
    for (const query of queries) {
      const cached = readCache(platformId, category, query);
      if (!cached) continue;
      if (!best || cached.listings.length > best.listings.length) {
        best = { platformId, listings: cached.listings };
      }
    }
  }

  return best;
}

function uniqueQueries(title: string): string[] {
  const full = title.replace(/\s+/g, ' ').trim();
  const short = full.split(/[,|/]/)[0]?.trim() ?? full;
  const words = short.split(' ').slice(0, 6).join(' ');
  return [...new Set([full, short, words].filter((value) => value.length >= 4))];
}

export function cacheEntryCount(): number {
  const row = getDatabase().prepare('SELECT COUNT(*) AS n FROM listing_cache').get() as
    { n: number } | undefined;
  return Number(row?.n ?? 0);
}
