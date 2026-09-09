import { describe, expect, it } from 'vitest';

import { parseCount, parseInr, parseRating } from '../services/scraper/parse.js';

describe('scraper parsers', () => {
  it('parses Indian rupee strings', () => {
    expect(parseInr('₹699')).toBe(699);
    expect(parseInr('₹1,799')).toBe(1799);
    expect(parseInr('Rs.  161')).toBe(161);
    expect(parseInr('free')).toBeNull();
  });

  it('parses abbreviated review counts', () => {
    expect(parseCount('(6K)')).toBe(6000);
    expect(parseCount('3.3k')).toBe(3300);
    expect(parseCount('(33,705)')).toBe(33705);
    expect(parseCount('(75)')).toBe(75);
  });

  it('parses star ratings', () => {
    expect(parseRating('4.5 out of 5 stars')).toBe(4.5);
    expect(parseRating('3.9')).toBe(3.9);
    expect(parseRating('not a rating')).toBeNull();
  });
});
