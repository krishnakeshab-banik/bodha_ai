import { describe, expect, it, vi } from 'vitest';

import { AmazonAgent } from '../services/amazonAgent.js';
import { ScraperError } from '../services/scraper/errors.js';
import type { ComparableListing } from '../types/index.js';

const listing = (price: number, title = 'USB-C Cable'): ComparableListing => ({
  title,
  price,
  url: 'https://www.amazon.in/dp/B00TEST',
});

const blocked = (signal = 'body:download-interstitial') =>
  new ScraperError(
    'blocked',
    'Amazon.in presented a blocked or interstitial page (' + signal + ')',
    undefined,
    signal,
  );

const timeout = () => new ScraperError('timeout', 'Timed out loading Amazon.in search results.');

describe('AmazonAgent fallback chain', () => {
  it('returns live listings when the scrape succeeds', async () => {
    const gemini = vi.fn();
    const readCached = vi.fn();
    const agent = new AmazonAgent({
      searchLive: async () => [listing(499)],
      searchGemini: gemini,
      readCached,
    });

    const result = await agent.search('USB C Cable', 'electronics-accessories');
    expect(result).toMatchObject({
      dataSource: 'live',
      scrapeStatus: 'OK',
      blockedSignal: null,
    });
    expect(result.listings).toHaveLength(1);
    expect(gemini).not.toHaveBeenCalled();
    expect(readCached).not.toHaveBeenCalled();
  });

  it('classifies an injected BLOCKED scrape as BLOCKED and tries Gemini first', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const gemini = vi.fn(async () => [listing(599, 'Gemini USB-C Cable')]);
    const readCached = vi.fn();
    const agent = new AmazonAgent({
      searchLive: async () => {
        throw blocked('body:download-interstitial');
      },
      searchGemini: gemini,
      readCached,
    });

    const result = await agent.search('USB C Cable', 'electronics-accessories');
    expect(result.scrapeStatus).toBe('BLOCKED');
    expect(result.scrapeStatus).not.toBe('TIMEOUT');
    expect(result.dataSource).toBe('gemini');
    expect(result.blockedSignal).toBe('body:download-interstitial');
    expect(result.listings[0]?.title).toContain('Gemini');
    expect(gemini).toHaveBeenCalledOnce();
    expect(readCached).not.toHaveBeenCalled();
    expect(warn.mock.calls.some((call) => String(call[0]).includes('body:download-interstitial'))).toBe(
      true,
    );
    warn.mockRestore();
    log.mockRestore();
  });

  it('falls back to cache when BLOCKED and Gemini returns nothing', async () => {
    const fetchedAt = '2026-01-02T00:00:00.000Z';
    const agent = new AmazonAgent({
      searchLive: async () => {
        throw blocked('url:validate-captcha');
      },
      searchGemini: async () => [],
      readCached: () => ({ listings: [listing(450)], fetchedAt, fresh: false }),
    });

    const result = await agent.search('USB C Cable', 'electronics-accessories');
    expect(result).toMatchObject({
      dataSource: 'cached',
      scrapeStatus: 'BLOCKED',
      blockedSignal: 'url:validate-captcha',
    });
    expect(result.listings[0]?.price).toBe(450);
  });

  it('falls back to cache when BLOCKED and Gemini throws', async () => {
    const agent = new AmazonAgent({
      searchLive: async () => {
        throw blocked();
      },
      searchGemini: async () => {
        throw new Error('Gemini quota exceeded');
      },
      readCached: () => ({
        listings: [listing(399)],
        fetchedAt: '2026-01-01T00:00:00.000Z',
        fresh: false,
      }),
    });

    const result = await agent.search('USB C Cable', 'electronics-accessories');
    expect(result.dataSource).toBe('cached');
    expect(result.scrapeStatus).toBe('BLOCKED');
  });

  it('returns unavailable when BLOCKED and both Gemini and cache are empty', async () => {
    const agent = new AmazonAgent({
      searchLive: async () => {
        throw blocked('dom:captcha-challenge');
      },
      searchGemini: async () => [],
      readCached: () => null,
    });

    const result = await agent.search('USB C Cable', 'electronics-accessories');
    expect(result).toEqual({
      listings: [],
      dataSource: 'unavailable',
      scrapeStatus: 'BLOCKED',
      blockedSignal: 'dom:captcha-challenge',
    });
  });

  it('does not call Gemini on a true TIMEOUT — cache then unavailable', async () => {
    const gemini = vi.fn();
    const agent = new AmazonAgent({
      searchLive: async () => {
        throw timeout();
      },
      searchGemini: gemini,
      readCached: () => ({
        listings: [listing(299)],
        fetchedAt: '2026-01-01T00:00:00.000Z',
        fresh: false,
      }),
    });

    const result = await agent.search('USB C Cable', 'electronics-accessories');
    expect(result.scrapeStatus).toBe('TIMEOUT');
    expect(result.dataSource).toBe('cached');
    expect(gemini).not.toHaveBeenCalled();
  });

  it('returns TIMEOUT + unavailable when a timeout has no cache', async () => {
    const agent = new AmazonAgent({
      searchLive: async () => {
        throw timeout();
      },
      searchGemini: async () => [listing(1)],
      readCached: () => null,
    });

    const result = await agent.search('USB C Cable', 'electronics-accessories');
    expect(result).toMatchObject({
      dataSource: 'unavailable',
      scrapeStatus: 'TIMEOUT',
      listings: [],
    });
  });
});
