import { describe, expect, it } from 'vitest';

import {
  cx,
  formatCurrency,
  formatCurrencyPrecise,
  formatPercent,
  formatRelativeTime,
  indexLevelClasses,
} from './format';

describe('formatCurrency', () => {
  it('formats whole rupees with no decimals and the Indian grouping', () => {
    expect(formatCurrency(1299)).toBe('₹1,299');
    expect(formatCurrency(125000)).toBe('₹1,25,000');
  });
});

describe('formatCurrencyPrecise', () => {
  it('always shows exactly two decimal places', () => {
    expect(formatCurrencyPrecise(547.8)).toBe('₹547.80');
    expect(formatCurrencyPrecise(400)).toBe('₹400.00');
  });
});

describe('formatPercent', () => {
  it('converts a fraction to a whole-number percentage by default', () => {
    expect(formatPercent(0.18)).toBe('18%');
  });

  it('respects the requested decimal precision', () => {
    expect(formatPercent(0.2124, 2)).toBe('21.24%');
  });
});

describe('formatRelativeTime', () => {
  it('returns "unknown" for a null timestamp', () => {
    expect(formatRelativeTime(null)).toBe('unknown');
  });

  it('buckets recent times into minutes, hours and days', () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 10_000).toISOString())).toBe('just now');
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString())).toBe('5 min ago');
    expect(formatRelativeTime(new Date(now - 60 * 60_000).toISOString())).toBe('1 hour ago');
    expect(formatRelativeTime(new Date(now - 3 * 60 * 60_000).toISOString())).toBe('3 hours ago');
    expect(formatRelativeTime(new Date(now - 24 * 60 * 60_000).toISOString())).toBe('1 day ago');
    expect(formatRelativeTime(new Date(now - 2 * 24 * 60 * 60_000).toISOString())).toBe(
      '2 days ago',
    );
  });

  it('falls back to an absolute date/time for a future or invalid timestamp', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(formatRelativeTime(future)).not.toMatch(/ago|just now/);
    expect(formatRelativeTime('not-a-date')).not.toMatch(/ago|just now/);
  });
});

describe('indexLevelClasses', () => {
  it('treats High demand as positive but High competition as negative', () => {
    expect(indexLevelClasses('High', 'demand')).toBe('text-profit-700');
    expect(indexLevelClasses('High', 'competition')).toBe('text-danger-700');
  });

  it('treats Low demand as negative but Low competition as positive', () => {
    expect(indexLevelClasses('Low', 'demand')).toBe('text-danger-700');
    expect(indexLevelClasses('Low', 'competition')).toBe('text-profit-700');
  });

  it('is always neutral for Medium, regardless of kind', () => {
    expect(indexLevelClasses('Medium', 'demand')).toBe('text-risk-700');
    expect(indexLevelClasses('Medium', 'competition')).toBe('text-risk-700');
  });
});

describe('cx', () => {
  it('joins truthy class names and drops falsy ones', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
    expect(cx()).toBe('');
  });
});
