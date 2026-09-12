/**
 * Category catalogue used by the analyze form and the rule-based listing
 * optimizer. Keyword seeds are copy-writing hints, not market prices.
 */

import type { Category, CategoryId } from '../types/index.js';

export const CATEGORY_IDS = [
  'electronics-accessories',
  'apparel',
  'home-kitchen',
  'beauty-personal-care',
  'toys',
] as const;

export const CATEGORIES: Record<CategoryId, Category> = {
  'electronics-accessories': {
    id: 'electronics-accessories',
    label: 'Electronics Accessories',
    keywordSeeds: ['fast charging', 'usb-c cable', 'braided', 'data sync'],
  },
  apparel: {
    id: 'apparel',
    label: 'Apparel',
    keywordSeeds: ['cotton', 'everyday wear', 'breathable', 'regular fit'],
  },
  'home-kitchen': {
    id: 'home-kitchen',
    label: 'Home & Kitchen',
    keywordSeeds: ['kitchen essential', 'space saving', 'easy clean', 'durable'],
  },
  'beauty-personal-care': {
    id: 'beauty-personal-care',
    label: 'Beauty & Personal Care',
    keywordSeeds: ['gentle formula', 'daily use', 'all skin types', 'dermatologically tested'],
  },
  toys: {
    id: 'toys',
    label: 'Toys',
    keywordSeeds: ['kids toy', 'safe play', 'unbreakable', 'gift'],
  },
};
