import { useTranslation } from 'react-i18next';

import { LossProtectionBadge } from './LossProtectionNotice';
import { DataFreshnessBadge } from './DataFreshnessBadge';
import type { PlatformId, PlatformRecommendation } from '../../types';
import {
  cx,
  formatCurrency,
  formatCurrencyPrecise,
  indexLevelClasses,
  PLATFORM_COLORS,
} from '../../utils/format';

interface PlatformComparisonProps {
  platforms: PlatformRecommendation[];
  recommendedPlatform: PlatformId;
  currentPrice: number;
}

/**
 * Side-by-side marketplace comparison: a table on desktop where scanning
 * columns is natural, and stacked cards on small screens where it is not.
 */
function vsRangeKey(price: number, range: [number, number]) {
  if (price < range[0]) return 'sellerVsRangeBelow' as const;
  if (price > range[1]) return 'sellerVsRangeAbove' as const;
  return 'sellerVsRangeWithin' as const;
}

function adviceKey(action: PlatformRecommendation['priceAction']) {
  if (action === 'increase') return 'priceAdviceIncrease' as const;
  if (action === 'decrease') return 'priceAdviceDecrease' as const;
  return 'priceAdviceHold' as const;
}

export function PlatformComparison({
  platforms,
  recommendedPlatform,
  currentPrice,
}: PlatformComparisonProps) {
  const { t } = useTranslation();

  return (
    <section className="opacity-90" aria-labelledby="comparison-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="comparison-heading" className="font-display text-base font-medium text-ink-muted">
            {t('report.comparisonTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t('report.comparisonLead')}</p>
        </div>
      </div>

      <div className="hidden max-w-full overflow-x-auto border-t border-rule lg:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t('report.evidenceTableCaption')}</caption>
          <thead>
            <tr className="border-b border-rule text-[11px] uppercase tracking-wide text-ink-muted">
              <th scope="col" className="px-4 py-3 font-medium">
                {t('report.marketplace')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('common.fee')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('report.listings')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('report.marketRange')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('report.competition')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('report.demand')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('report.recommended')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('report.profitUnit')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('report.fit')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {platforms.map((platform) => {
              const isWinner = platform.id === recommendedPlatform;
              const unavailable = platform.unavailable === true;

              return (
                <tr key={platform.id} className={unavailable ? 'text-ink-muted/70' : undefined}>
                  <th scope="row" className="px-4 py-3.5 font-medium text-ink">
                    <span className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 shrink-0"
                        style={{ backgroundColor: PLATFORM_COLORS[platform.id] }}
                        aria-hidden="true"
                      />
                      <span>
                        {platform.name}
                        {isWinner && !unavailable && (
                          <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.12em] text-brand-700">
                            {t('common.bestFit')}
                          </span>
                        )}
                        {platform.isBulkMarketplace && (
                          <span className="mt-0.5 block text-[11px] font-normal text-ink-muted">
                            {t('report.volumeNote')}
                          </span>
                        )}
                        <span className="mt-1.5 block">
                          <DataFreshnessBadge
                            freshness={platform.dataFreshness ?? 'unavailable'}
                            lastUpdated={platform.lastUpdated}
                            compact
                          />
                        </span>
                      </span>
                    </span>
                  </th>
                  {unavailable ? (
                    <td colSpan={8} className="px-4 py-3.5 text-sm text-ink-muted">
                      <p>{t('report.marketDataMissing')}</p>
                      <p className="mt-1">
                        {platform.profitAvailable === false
                          ? t('report.profitMissing')
                          : t('report.profitUnit') + ' ' + formatCurrencyPrecise(platform.estimatedProfit)}
                      </p>
                    </td>
                  ) : (
                    <>
                      <td className="figure px-4 py-3.5 text-right text-ink-muted">
                        {(platform.feePercent * 100).toFixed(1)}%
                      </td>
                      <td className="figure px-4 py-3.5 text-right text-ink-muted">
                        {platform.listingCount}
                      </td>
                      <td className="px-4 py-3.5 text-right text-ink-muted">
                        <span className="figure block">
                          {formatCurrency(platform.marketPriceRange[0])} –{' '}
                          {formatCurrency(platform.marketPriceRange[1])}
                        </span>
                        <span className="mt-1 block text-[11px]">
                          {t('report.medianPrice')} {formatCurrency(platform.marketPrice)}
                        </span>
                        <span className="mt-1 block text-[11px]">
                          {t('report.' + vsRangeKey(currentPrice, platform.marketPriceRange), {
                            price: formatCurrency(currentPrice),
                            min: formatCurrency(platform.marketPriceRange[0]),
                            max: formatCurrency(platform.marketPriceRange[1]),
                          })}
                        </span>
                      </td>
                      <td
                        className={cx(
                          'px-4 py-3.5 text-right text-xs font-medium',
                          indexLevelClasses(platform.competition, 'competition'),
                        )}
                      >
                        {t('levels.' + platform.competition)}
                      </td>
                      <td
                        className={cx(
                          'px-4 py-3.5 text-right text-xs font-medium',
                          indexLevelClasses(platform.demand, 'demand'),
                        )}
                      >
                        {t('levels.' + platform.demand)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="figure block font-medium text-ink">
                          {formatCurrency(platform.recommendedPrice)}
                        </span>
                        {platform.lossRiskAvoided && (
                          <span className="mt-1 inline-block">
                            <LossProtectionBadge marketPrice={platform.marketPrice} />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {platform.profitAvailable === false ? (
                          <span className="text-xs text-danger-600">{t('report.profitMissing')}</span>
                        ) : (
                          <>
                            <span
                              className={cx(
                                'figure block font-medium',
                                platform.estimatedProfit > 0 ? 'text-profit-600' : 'text-danger-600',
                              )}
                            >
                              {formatCurrencyPrecise(platform.estimatedProfit)}
                            </span>
                            <span className="mt-1 block text-[11px] font-medium text-ink">
                              {t('report.' + adviceKey(platform.priceAction), {
                                price: formatCurrency(currentPrice),
                              })}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <FitScoreCell score={platform.fitScore} />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-8 lg:hidden">
        {platforms.map((platform) => (
          <PlatformCard
            key={platform.id}
            platform={platform}
            isWinner={platform.id === recommendedPlatform}
            currentPrice={currentPrice}
          />
        ))}
      </div>
    </section>
  );
}

function FitScoreCell({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-[3px] w-12 overflow-hidden bg-rule">
        <span className="block h-full bg-ink" style={{ width: score + '%' }} />
      </span>
      <span className="figure w-9 text-right font-medium text-ink">{score.toFixed(1)}</span>
    </span>
  );
}

function PlatformCard({
  platform,
  isWinner,
  currentPrice,
}: {
  platform: PlatformRecommendation;
  isWinner: boolean;
  currentPrice: number;
}) {
  const { t } = useTranslation();
  const unavailable = platform.unavailable === true;

  return (
    <article
      className={cx(
        'border-t border-rule py-5',
        isWinner && !unavailable && 'border-t-2 border-t-brand-600',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0"
            style={{ backgroundColor: PLATFORM_COLORS[platform.id] }}
            aria-hidden="true"
          />
          <h3 className="font-display text-base font-medium text-ink">{platform.name}</h3>
        </div>
        {isWinner && !unavailable && (
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-brand-700">
            {t('common.bestFit')}
          </span>
        )}
      </div>

      <div className="mt-3">
        <DataFreshnessBadge
          freshness={platform.dataFreshness ?? 'unavailable'}
          lastUpdated={platform.lastUpdated}
        />
      </div>

      {unavailable ? (
        <div className="mt-4 text-sm leading-relaxed text-ink-muted">
          <p>{t('report.marketDataMissing')}</p>
          <p className="mt-2 text-ink">
            {platform.profitAvailable === false
              ? t('report.profitMissing')
              : t('report.profitUnit') + ' ' + formatCurrencyPrecise(platform.estimatedProfit)}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="figure text-2xl font-medium tracking-tight text-ink">
              {formatCurrency(platform.recommendedPrice)}
            </span>
            <span className="figure text-xs text-ink-muted">
              fit {platform.fitScore.toFixed(1)}
            </span>
          </div>

          {platform.lossRiskAvoided && (
            <div className="mt-2">
              <LossProtectionBadge marketPrice={platform.marketPrice} />
            </div>
          )}

          <p className="mt-4 text-xs text-ink-muted">
            <span className={indexLevelClasses(platform.demand, 'demand')}>
              {t('levels.' + platform.demand)} {t('report.demand')}
            </span>
            <span className="mx-2 text-rule">·</span>
            <span className={indexLevelClasses(platform.competition, 'competition')}>
              {t('levels.' + platform.competition)} {t('report.competition')}
            </span>
          </p>

          <dl className="mt-4 space-y-1.5 border-t border-rule pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('common.fee')}</dt>
              <dd className="figure font-medium text-ink">
                {(platform.feePercent * 100).toFixed(1)}%
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('report.medianPrice')}</dt>
              <dd className="figure font-medium text-ink">{formatCurrency(platform.marketPrice)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('report.marketRange')}</dt>
              <dd className="figure font-medium text-ink">
                {formatCurrency(platform.marketPriceRange[0])} –{' '}
                {formatCurrency(platform.marketPriceRange[1])}
              </dd>
            </div>
            <p className="text-xs text-ink">
              {t('report.' + vsRangeKey(currentPrice, platform.marketPriceRange), {
                price: formatCurrency(currentPrice),
                min: formatCurrency(platform.marketPriceRange[0]),
                max: formatCurrency(platform.marketPriceRange[1]),
              })}
            </p>
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('report.profitUnit')}</dt>
              <dd
                className={cx(
                  'figure font-medium',
                  platform.profitAvailable === false
                    ? 'text-danger-600'
                    : platform.estimatedProfit > 0
                      ? 'text-profit-600'
                      : 'text-danger-600',
                )}
              >
                {platform.profitAvailable === false
                  ? t('report.profitMissing')
                  : formatCurrencyPrecise(platform.estimatedProfit)}
              </dd>
            </div>
            <p className="text-xs font-medium text-ink">
              {t('report.' + adviceKey(platform.priceAction), { price: formatCurrency(currentPrice) })}
            </p>
          </dl>

          {platform.isBulkMarketplace && (
            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
              {t('report.alibabaNote')}
            </p>
          )}
        </>
      )}
    </article>
  );
}
