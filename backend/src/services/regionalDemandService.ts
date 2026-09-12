/**
 * India-only Google Trends interest-by-state. This is a search-interest
 * proxy, not sales. Failures return an empty available=false payload.
 */

import { createRequire } from 'node:module';

import { CATEGORIES } from '../data/categories.js';
import type { CategoryId, RegionalDemand } from '../types/index.js';

const require = createRequire(import.meta.url);

interface TrendRow {
  geoName?: string;
  value?: number[];
}

export async function fetchRegionalDemand(
  title: string,
  category: CategoryId,
): Promise<RegionalDemand> {
  const keyword = pickKeyword(title, category);

  try {
    const googleTrends = require('google-trends-api') as {
      interestByRegion: (options: Record<string, unknown>) => Promise<string>;
    };

    const raw = await Promise.race([
      googleTrends.interestByRegion({
        keyword,
        startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        geo: 'IN',
        resolution: 'REGION',
      }),
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('trends timeout')), 12_000);
      }),
    ]);

    const parsed = JSON.parse(raw) as { default?: { geoMapData?: TrendRow[] } };
    const rows = (parsed.default?.geoMapData ?? [])
      .map((row) => ({
        state: String(row.geoName ?? '').trim(),
        interest: Number(row.value?.[0] ?? 0),
      }))
      .filter((row) => row.state && Number.isFinite(row.interest) && row.interest > 0)
      .sort((a, b) => b.interest - a.interest)
      .slice(0, 8);

    if (rows.length === 0) {
      return { available: false, states: [] };
    }

    return { available: true, states: rows };
  } catch (error) {
    console.warn('[bodha-ai] Google Trends unavailable:', error);
    return { available: false, states: [] };
  }
}

function pickKeyword(title: string, category: CategoryId): string {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  if (cleaned.length >= 4 && cleaned.length <= 40) return cleaned;
  return CATEGORIES[category].keywordSeeds[0] ?? CATEGORIES[category].label;
}
