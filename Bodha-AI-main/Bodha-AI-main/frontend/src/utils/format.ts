/** Shared formatting and presentation helpers. */

import type { IndexLevel, PlatformId, PriceAction } from '../types';

const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const rupeeFormatterPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "₹1,299" - the default for prices shown to sellers. */
export function formatCurrency(value: number): string {
  return rupeeFormatter.format(value);
}

/** "₹1,299.45" - used where the paise actually matter (profit, break-even). */
export function formatCurrencyPrecise(value: number): string {
  return rupeeFormatterPrecise.format(value);
}

/** 0.18 -> "18%" */
export function formatPercent(fraction: number, decimals = 0): string {
  return (fraction * 100).toFixed(decimals) + '%';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'unknown';
  const deltaMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return formatDateTime(iso);
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + ' min ago';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  const days = Math.round(hours / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Tailwind classes for a Low / Medium / High status word (text only, not a pill). */
export function indexLevelClasses(level: IndexLevel, kind: 'demand' | 'competition'): string {
  // High demand is good; high competition is bad - so the same word flips colour.
  const isPositive = kind === 'demand' ? level === 'High' : level === 'Low';
  const isNegative = kind === 'demand' ? level === 'Low' : level === 'High';

  if (isPositive) return 'text-profit-700';
  if (isNegative) return 'text-danger-700';
  return 'text-risk-700';
}

export const PRICE_ACTION_LABELS: Record<PriceAction, string> = {
  increase: 'Raise your price',
  decrease: 'Lower your price',
  hold: 'Hold your price',
};

/**
 * Categorical palette identifying each marketplace, in fixed order.
 *
 * Colour follows the platform, never its rank - re-sorting the report never
 * repaints a bar. Validated for colour-vision deficiency across all pairs
 * (worst adjacent ΔE 10.3, deutan), because bars re-sort by fit score and any
 * two can end up side by side. Emerald is deliberately absent: it is reserved
 * throughout the app to mean "profit".
 */
export const PLATFORM_COLORS: Record<PlatformId, string> = {
  amazon: '#f59e0b',
  flipkart: '#1d4ed8',
  snapdeal: '#db2777',
  alibaba: '#0891b2',
};

export const PLATFORM_NAMES: Record<PlatformId, string> = {
  amazon: 'Amazon',
  flipkart: 'Flipkart',
  snapdeal: 'Snapdeal',
  alibaba: 'Alibaba',
};

export const CATEGORY_LABELS: Record<string, string> = {
  'electronics-accessories': 'Electronics Accessories',
  apparel: 'Apparel',
  'home-kitchen': 'Home & Kitchen',
  'beauty-personal-care': 'Beauty & Personal Care',
  toys: 'Toys',
};

/** Join class names, dropping falsy entries. */
export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
