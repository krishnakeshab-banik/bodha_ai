import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '../../i18n';
import type { PlatformRecommendation } from '../../types';
import { DataFreshnessBadge } from './DataFreshnessBadge';
import { PlatformComparison } from './PlatformComparison';

function platform(partial: Partial<PlatformRecommendation> = {}): PlatformRecommendation {
  return {
    id: 'amazon',
    name: 'Amazon',
    feePercent: 0.18,
    avgShippingFee: 60,
    isBulkMarketplace: false,
    marketPrice: 999,
    marketPriceRange: [899, 1199],
    breakEvenPrice: 548,
    recommendedPrice: 999,
    estimatedProfit: 170,
    profitMargin: 0.21,
    profitAvailable: true,
    profitError: null,
    competitionIndex: 70,
    demandIndex: 80,
    competition: 'High',
    demand: 'High',
    fitScore: 74.8,
    priceAction: 'increase',
    explanation: 'Test explanation',
    lossRiskAvoided: false,
    unavailable: false,
    dataFreshness: 'live',
    dataSource: 'live',
    scrapeStatus: 'OK',
    lastUpdated: '2026-01-01T00:00:00.000Z',
    listingCount: 5,
    ...partial,
  };
}

describe('DataFreshnessBadge', () => {
  it('shows live prices for a fresh scrape', () => {
    render(
      <DataFreshnessBadge
        freshness="live"
        lastUpdated="2026-01-01T00:00:00.000Z"
        platformName="Amazon"
        scrapeStatus="OK"
      />,
    );
    const badge = screen.getByTestId('platform-data-status');
    expect(badge).toHaveAttribute('data-freshness', 'live');
    expect(badge).toHaveTextContent(/live prices/i);
  });

  it('shows an honest Gemini-fallback badge, not a timeout', () => {
    render(
      <DataFreshnessBadge
        freshness="gemini"
        lastUpdated={null}
        platformName="Amazon"
        scrapeStatus="BLOCKED"
      />,
    );
    const badge = screen.getByTestId('platform-data-status');
    expect(badge).toHaveAttribute('data-freshness', 'gemini');
    expect(badge).toHaveAttribute('data-scrape-status', 'BLOCKED');
    expect(badge).toHaveTextContent(/live data unavailable, showing Gemini-sourced estimate/i);
    expect(badge).not.toHaveTextContent(/timed out/i);
  });

  it('shows cached data with a timestamp', () => {
    render(
      <DataFreshnessBadge
        freshness="cached"
        lastUpdated="2026-01-01T00:00:00.000Z"
        platformName="Amazon"
        scrapeStatus="BLOCKED"
      />,
    );
    const badge = screen.getByTestId('platform-data-status');
    expect(badge).toHaveAttribute('data-freshness', 'cached');
    expect(badge).toHaveTextContent(/Amazon: showing cached data from/i);
  });

  it('shows a clear unavailable label instead of blank/zero copy', () => {
    render(
      <DataFreshnessBadge
        freshness="unavailable"
        lastUpdated={null}
        platformName="Amazon"
        scrapeStatus="BLOCKED"
      />,
    );
    const badge = screen.getByTestId('platform-data-status');
    expect(badge).toHaveTextContent('Amazon data temporarily unavailable');
    expect(badge).not.toHaveTextContent(/timed out/i);
  });
});

describe('PlatformComparison status badges', () => {
  it('renders the correct honest status for live, Gemini, cached and unavailable', () => {
    const platforms = [
      platform({
        id: 'amazon',
        name: 'Amazon',
        dataFreshness: 'live',
        dataSource: 'live',
        scrapeStatus: 'OK',
      }),
      platform({
        id: 'flipkart',
        name: 'Flipkart',
        dataFreshness: 'gemini',
        dataSource: 'gemini',
        scrapeStatus: 'BLOCKED',
      }),
      platform({
        id: 'snapdeal',
        name: 'Snapdeal',
        dataFreshness: 'cached',
        dataSource: 'cached',
        scrapeStatus: 'BLOCKED',
        lastUpdated: '2026-01-01T00:00:00.000Z',
      }),
      platform({
        id: 'alibaba',
        name: 'Alibaba',
        unavailable: true,
        dataFreshness: 'unavailable',
        dataSource: 'unavailable',
        scrapeStatus: 'NOT_FOUND',
        marketPrice: 0,
        marketPriceRange: [0, 0],
        recommendedPrice: 0,
        listingCount: 0,
      }),
    ];

    render(
      <PlatformComparison
        platforms={platforms}
        recommendedPlatform="amazon"
        currentPrice={800}
      />,
    );

    const badges = screen.getAllByTestId('platform-data-status');
    expect(badges).toHaveLength(8); // desktop table + mobile cards
    expect(screen.getAllByText(/live prices/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Flipkart: live data unavailable, showing Gemini-sourced estimate/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Snapdeal: showing cached data from/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alibaba data temporarily unavailable').length).toBeGreaterThan(0);
    expect(screen.queryByText(/timed out/i)).not.toBeInTheDocument();
  });

  it('always renders Snapdeal with its own status and labels fee-based profit when unavailable', () => {
    const platforms = [
      platform({
        id: 'amazon',
        name: 'Amazon',
        unavailable: true,
        dataFreshness: 'unavailable',
        dataSource: 'unavailable',
        scrapeStatus: 'BLOCKED',
        estimatedProfit: 377.6,
        profitAvailable: true,
        profitBasis: 'seller-fees',
        marketPrice: 0,
        marketPriceRange: [0, 0],
        recommendedPrice: 0,
        listingCount: 0,
      }),
      platform({
        id: 'flipkart',
        name: 'Flipkart',
        unavailable: true,
        dataFreshness: 'unavailable',
        dataSource: 'unavailable',
        scrapeStatus: 'TIMEOUT',
        estimatedProfit: 423,
        profitAvailable: true,
        profitBasis: 'seller-fees',
        marketPrice: 0,
        marketPriceRange: [0, 0],
        recommendedPrice: 0,
        listingCount: 0,
      }),
      platform({
        id: 'snapdeal',
        name: 'Snapdeal',
        dataFreshness: 'live',
        dataSource: 'live',
        scrapeStatus: 'OK',
        estimatedProfit: 487,
      }),
    ];

    const { container } = render(
      <PlatformComparison
        platforms={platforms}
        recommendedPlatform="snapdeal"
        currentPrice={1000}
      />,
    );

    expect(container.querySelectorAll('[data-platform-id="amazon"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-platform-id="flipkart"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-platform-id="snapdeal"]').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/based on your cost and this platform's fees/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/₹377.60/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹423.00/).length).toBeGreaterThan(0);
  });
});
