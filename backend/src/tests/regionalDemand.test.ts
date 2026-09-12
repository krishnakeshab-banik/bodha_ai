import { describe, expect, it } from 'vitest';

import {
  detectSeasonalPattern,
  parseRegionalStates,
  parseTimeline,
  pickTrendsKeyword,
} from '../services/regionalDemandService.js';
import type { TrendPoint } from '../types/index.js';

const INDIAN_STATES = [
  'Maharashtra',
  'Karnataka',
  'Delhi',
  'Tamil Nadu',
  'Uttar Pradesh',
  'Gujarat',
  'West Bengal',
  'Rajasthan',
  'Kerala',
  'Punjab',
  'Telangana',
];

describe('pickTrendsKeyword', () => {
  it('uses the product title, not a category seed list', () => {
    expect(pickTrendsKeyword('USB C Fast Charging Cable')).toBe('USB C Fast Charging Cable');
    expect(pickTrendsKeyword("Men's Running Shoes")).toBe("Men's Running Shoes");
    expect(pickTrendsKeyword('USB C Fast Charging Cable')).not.toBe('fast charging');
  });
});

describe('parseRegionalStates', () => {
  it('keeps only states and scores from the raw Trends payload', () => {
    const raw = JSON.stringify({
      default: {
        geoMapData: [
          { geoName: 'Goa', value: [97] },
          { geoName: 'Sikkim', value: [41] },
          { geoName: '', value: [10] },
          { geoName: 'Ghost', value: [0] },
        ],
      },
    });
    expect(parseRegionalStates(raw)).toEqual([
      { state: 'Goa', interest: 97 },
      { state: 'Sikkim', interest: 41 },
    ]);
    const names = parseRegionalStates(raw).map((row) => row.state);
    expect(names).not.toEqual(INDIAN_STATES.slice(0, names.length));
  });

  it('returns empty when the API payload has no usable geo rows', () => {
    expect(parseRegionalStates(JSON.stringify({ default: { geoMapData: [] } }))).toEqual([]);
  });
});

describe('detectSeasonalPattern', () => {
  function monthPoint(month: number, interest: number): TrendPoint {
    return {
      time: new Date(Date.UTC(2025, month, 15)).toISOString(),
      label: 'm' + month,
      interest,
      month,
      year: 2025,
    };
  }

  it('detects a standout month from the real series', () => {
    const points = Array.from({ length: 12 }, (_, month) =>
      monthPoint(month, month === 10 ? 90 : 30),
    );
    const result = detectSeasonalPattern(points);
    expect(result.available).toBe(true);
    expect(result.patternDetected).toBe(true);
    expect(result.peakMonth).toBe(10);
  });

  it('says no pattern when the series is flat', () => {
    const points = Array.from({ length: 12 }, (_, month) => monthPoint(month, 48 + (month % 2)));
    const result = detectSeasonalPattern(points);
    expect(result.available).toBe(true);
    expect(result.patternDetected).toBe(false);
    expect(result.peakMonth).toBeNull();
  });
});

describe('parseTimeline', () => {
  it('reads interest values only from the raw timeline payload', () => {
    const raw = JSON.stringify({
      default: {
        timelineData: [
          { time: '1735689600', formattedTime: 'Jan 1, 2025', value: [12] },
          { time: '1738368000', formattedTime: 'Feb 1, 2025', value: [88] },
        ],
      },
    });
    const points = parseTimeline(raw);
    expect(points.map((point) => point.interest)).toEqual([12, 88]);
  });
});
