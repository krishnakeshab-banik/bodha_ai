import { describe, expect, it } from 'vitest';

import { INITIAL_VALUES, validate } from './useAnalyzeForm';
import type { AnalyzeFormValues } from './useAnalyzeForm';

// Mirrors what react-i18next's t() does in tests: return the key itself,
// so assertions can check which error key fired without a full i18n setup.
const t = (key: string) => key;

function values(overrides: Partial<AnalyzeFormValues> = {}): AnalyzeFormValues {
  return {
    ...INITIAL_VALUES,
    title: 'USB C Fast Charging Cable',
    description: 'Nylon braided 1.5m cable supporting 65W fast charge.',
    category: 'electronics-accessories',
    manufacturingCost: '400',
    currentPrice: '800',
    ...overrides,
  };
}

describe('validate', () => {
  it('accepts a fully valid form', () => {
    expect(validate(values(), t)).toEqual({});
  });

  it('rejects a title shorter than 3 characters', () => {
    expect(validate(values({ title: 'ab' }), t).title).toBe('analyze.errors.titleMin');
  });

  it('rejects a description shorter than 10 characters', () => {
    expect(validate(values({ description: 'too short' }), t).description).toBe(
      'analyze.errors.descMin',
    );
  });

  it('requires a category', () => {
    expect(validate(values({ category: '' }), t).category).toBe('analyze.errors.category');
  });

  it('requires a numeric, positive manufacturing cost', () => {
    expect(validate(values({ manufacturingCost: '' }), t).manufacturingCost).toBe(
      'analyze.errors.costRequired',
    );
    expect(validate(values({ manufacturingCost: '0' }), t).manufacturingCost).toBe(
      'analyze.errors.costPositive',
    );
    expect(validate(values({ manufacturingCost: '-5' }), t).manufacturingCost).toBe(
      'analyze.errors.costPositive',
    );
  });

  it('requires a numeric, positive current price', () => {
    expect(validate(values({ currentPrice: '' }), t).currentPrice).toBe(
      'analyze.errors.priceRequired',
    );
    expect(validate(values({ currentPrice: '0' }), t).currentPrice).toBe(
      'analyze.errors.pricePositive',
    );
  });

  it('rejects a manufacturing cost equal to or above the selling price', () => {
    expect(
      validate(values({ manufacturingCost: '800', currentPrice: '800' }), t).manufacturingCost,
    ).toBe('analyze.errors.costBelowPrice');
    expect(
      validate(values({ manufacturingCost: '900', currentPrice: '800' }), t).manufacturingCost,
    ).toBe('analyze.errors.costBelowPrice');
  });

  it('requires at least one selected marketplace', () => {
    expect(validate(values({ platforms: [] }), t).platforms).toBe('analyze.errors.platforms');
  });
});
