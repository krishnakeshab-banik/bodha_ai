/**
 * India-only Google Trends: interest-by-state and 12-month interest-over-time.
 * Failures and empty API payloads return an honest unavailable state.
 * State lists and seasonal claims are parsed only from that run's raw response.
 */

import { createRequire } from 'node:module';

import type { CategoryId, RegionalDemand, SeasonalTiming, TrendPoint } from '../types/index.js';

const require = createRequire(import.meta.url);

interface TrendRow {
  geoName?: string;
  value?: number[];
}

interface TimelineRow {
  time?: string;
  formattedTime?: string;
  formattedAxisTime?: string;
  value?: number[];
}

const TRENDS_TIMEOUT_MS = 12_000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function pickTrendsKeyword(title: string): string {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length <= 8) return cleaned;
  return words.slice(0, 8).join(' ');
}

export function parseRegionalStates(raw: string): { state: string; interest: number }[] {
  const parsed = JSON.parse(raw) as { default?: { geoMapData?: TrendRow[] } };
  return (parsed.default?.geoMapData ?? [])
    .map((row) => ({
      state: String(row.geoName ?? '').trim(),
      interest: Number(row.value?.[0] ?? 0),
    }))
    .filter((row) => row.state && Number.isFinite(row.interest) && row.interest > 0)
    .sort((a, b) => b.interest - a.interest)
    .slice(0, 8);
}

export function parseTimeline(raw: string): TrendPoint[] {
  const parsed = JSON.parse(raw) as { default?: { timelineData?: TimelineRow[] } };
  return (parsed.default?.timelineData ?? [])
    .map((row) => {
      const interest = Number(row.value?.[0] ?? Number.NaN);
      const epochSeconds = Number(row.time);
      const fromEpoch = Number.isFinite(epochSeconds) ? new Date(epochSeconds * 1000) : null;
      const fromLabel = parseTrendsDate(row.formattedTime ?? row.formattedAxisTime ?? '');
      const when = fromEpoch && !Number.isNaN(fromEpoch.getTime()) ? fromEpoch : fromLabel;
      if (!when || !Number.isFinite(interest)) return null;
      return {
        time: when.toISOString(),
        label: row.formattedTime ?? row.formattedAxisTime ?? when.toISOString(),
        interest,
        month: when.getUTCMonth(),
        year: when.getUTCFullYear(),
      } satisfies TrendPoint;
    })
    .filter((row): row is TrendPoint => row !== null);
}

function parseTrendsDate(label: string): Date | null {
  const parsed = Date.parse(label);
  if (Number.isFinite(parsed)) return new Date(parsed);
  return null;
}

/**
 * A spike is "seasonal" only when one month stands clearly above the rest of
 * this series. Flat or noisy series → no pattern. Thresholds are applied to
 * this run's numbers, not a pre-written calendar of festivals.
 */
export function detectSeasonalPattern(points: TrendPoint[]): SeasonalTiming {
  if (points.length < 8) {
    return {
      available: false,
      patternDetected: false,
      peakMonth: null,
      peakInterest: null,
      medianInterest: null,
      pointCount: points.length,
    };
  }

  const byMonth = new Map<number, number[]>();
  for (const point of points) {
    const bucket = byMonth.get(point.month) ?? [];
    bucket.push(point.interest);
    byMonth.set(point.month, bucket);
  }

  const monthly = [...byMonth.entries()].map(([month, values]) => ({
    month,
    avg: values.reduce((sum, value) => sum + value, 0) / values.length,
  }));
  const averages = monthly.map((row) => row.avg);
  const medianInterest = median(averages);
  const peak = monthly.reduce((best, row) => (row.avg > best.avg ? row : best));
  const spread = Math.max(...averages) - Math.min(...averages);
  const patternDetected =
    peak.avg >= medianInterest * 1.5 && peak.avg - medianInterest >= 15 && spread >= 20;

  return {
    available: true,
    patternDetected,
    peakMonth: patternDetected ? peak.month : null,
    peakInterest: Math.round(peak.avg),
    medianInterest: Math.round(medianInterest),
    pointCount: points.length,
  };
}

export function emptySeasonalTiming(): SeasonalTiming {
  return {
    available: false,
    patternDetected: false,
    peakMonth: null,
    peakInterest: null,
    medianInterest: null,
    pointCount: 0,
  };
}

export async function fetchRegionalDemand(
  title: string,
  category: CategoryId,
): Promise<RegionalDemand> {
  const keyword = pickTrendsKeyword(title);
  const startTimeRegion = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const startTimeSeries = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const request = {
    keyword,
    category,
    geo: 'IN',
    resolution: 'REGION',
    regionStartTime: startTimeRegion.toISOString(),
    seriesStartTime: startTimeSeries.toISOString(),
  };

  console.log(
    '[bodha-ai ' + new Date().toISOString() + '] [trends] request ' + JSON.stringify(request),
  );

  try {
    const googleTrends = require('google-trends-api') as {
      interestByRegion: (options: Record<string, unknown>) => Promise<string>;
      interestOverTime: (options: Record<string, unknown>) => Promise<string>;
    };

    const [regionResult, seriesResult] = await Promise.allSettled([
      withTimeout(
        googleTrends.interestByRegion({
          keyword,
          startTime: startTimeRegion,
          geo: 'IN',
          resolution: 'REGION',
        }),
      ),
      withTimeout(
        googleTrends.interestOverTime({
          keyword,
          startTime: startTimeSeries,
          geo: 'IN',
        }),
      ),
    ]);

    let states: { state: string; interest: number }[] = [];
    if (regionResult.status === 'fulfilled') {
      console.log(
        '[bodha-ai ' +
          new Date().toISOString() +
          '] [trends:region] rawResponse ' +
          summarizeTrendsRaw(regionResult.value),
      );
      states = parseRegionalStates(regionResult.value);
      console.log(
        '[bodha-ai ' +
          new Date().toISOString() +
          '] [trends:region] parsedStates ' +
          JSON.stringify({ keyword, category, states }),
      );
    } else {
      console.warn(
        '[bodha-ai] [trends:region] failed',
        regionResult.reason instanceof Error ? regionResult.reason.message : regionResult.reason,
      );
    }

    let seasonalTiming = emptySeasonalTiming();
    if (seriesResult.status === 'fulfilled') {
      const points = parseTimeline(seriesResult.value);
      console.log(
        '[bodha-ai ' +
          new Date().toISOString() +
          '] [trends:overtime] rawSeries ' +
          JSON.stringify({
            keyword,
            category,
            pointCount: points.length,
            series: points.map((point) => ({
              time: point.time,
              label: point.label,
              interest: point.interest,
            })),
          }),
      );
      seasonalTiming = detectSeasonalPattern(points);
      console.log(
        '[bodha-ai ' +
          new Date().toISOString() +
          '] [trends:overtime] pattern ' +
          JSON.stringify({ keyword, category, seasonalTiming }),
      );
    } else {
      console.warn(
        '[bodha-ai] [trends:overtime] failed',
        seriesResult.reason instanceof Error ? seriesResult.reason.message : seriesResult.reason,
      );
    }

    if (states.length === 0) {
      return { available: false, states: [], seasonalTiming };
    }

    return { available: true, states, seasonalTiming };
  } catch (error) {
    console.warn('[bodha-ai] Google Trends unavailable:', error);
    return { available: false, states: [], seasonalTiming: emptySeasonalTiming() };
  }
}

function withTimeout(task: Promise<string>): Promise<string> {
  return Promise.race([
    task,
    new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('trends timeout')), TRENDS_TIMEOUT_MS);
    }),
  ]);
}

function summarizeTrendsRaw(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      default?: { geoMapData?: TrendRow[]; timelineData?: TimelineRow[] };
    };
    return JSON.stringify({
      geoMapData: parsed.default?.geoMapData ?? [],
      timelineDataCount: parsed.default?.timelineData?.length ?? 0,
    });
  } catch {
    return raw.slice(0, 2000);
  }
}
