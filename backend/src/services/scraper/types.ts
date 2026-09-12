import type { ComparableListing } from '../../types/index.js';

export interface MarketplaceScraper {
  readonly id: 'amazon' | 'flipkart' | 'snapdeal';
  readonly origin: string;
  search(query: string, category: string): Promise<ComparableListing[]>;
}

export const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const DEFAULT_VIEWPORT = { width: 1366, height: 768 } as const;
