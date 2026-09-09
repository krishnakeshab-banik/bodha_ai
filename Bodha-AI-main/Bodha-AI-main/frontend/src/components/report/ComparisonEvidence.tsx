import { useTranslation } from 'react-i18next';

import type { PlatformId, PlatformRecommendation, PriceAction } from '../../types';
import { cx, formatCurrency, formatCurrencyPrecise, PLATFORM_COLORS } from '../../utils/format';

interface ComparisonEvidenceProps {
  platforms: PlatformRecommendation[];
  recommendedPlatform: PlatformId;
  currentPrice: number;
}

const TARGET_PROFIT_MARGIN = 0.35;

function profitComponent(platform: PlatformRecommendation): number {
  if (platform.profitAvailable === false) return 0;
  return Math.min(100, Math.max(0, (platform.profitMargin / TARGET_PROFIT_MARGIN) * 100));
}

function reconstructedFit(platform: PlatformRecommendation): number {
  return 0.4 * profitComponent(platform) + 0.3 * (100 - platform.competitionIndex) + 0.3 * platform.demandIndex;
}

function vsRangeKey(price: number, range: [number, number]): 'sellerVsRangeBelow' | 'sellerVsRangeWithin' | 'sellerVsRangeAbove' {
  if (price < range[0]) return 'sellerVsRangeBelow';
  if (price > range[1]) return 'sellerVsRangeAbove';
  return 'sellerVsRangeWithin';
}

function adviceKey(action: PriceAction): 'priceAdviceIncrease' | 'priceAdviceDecrease' | 'priceAdviceHold' {
  if (action === 'increase') return 'priceAdviceIncrease';
  if (action === 'decrease') return 'priceAdviceDecrease';
  return 'priceAdviceHold';
}

/**
 * The “why this marketplace” panel: same formula for every platform, with the
 * live listing counts and score components that produced the ranking.
 */
export function ComparisonEvidence({
  platforms,
  recommendedPlatform,
  currentPrice,
}: ComparisonEvidenceProps) {
  const { t } = useTranslation();
  const available = platforms.filter((platform) => !platform.unavailable);
  const winner = available.find((platform) => platform.id === recommendedPlatform) ?? available[0];
  const runner = available.find((platform) => platform.id !== winner?.id);

  if (!winner) return null;

  const reasons: string[] = [];
  if (runner) {
    if (winner.estimatedProfit > runner.estimatedProfit) {
      reasons.push(t('report.evidenceReasonProfit'));
    }
    if (winner.demandIndex > runner.demandIndex) {
      reasons.push(t('report.evidenceReasonDemand'));
    }
    if (winner.competitionIndex < runner.competitionIndex) {
      reasons.push(t('report.evidenceReasonComp'));
    }
    if (winner.listingCount > runner.listingCount) {
      reasons.push(t('report.evidenceReasonListings', { count: winner.listingCount }));
    }
    if (winner.feePercent < runner.feePercent) {
      reasons.push(t('report.evidenceReasonFee', { percent: (winner.feePercent * 100).toFixed(1) }));
    }
  }
  if (winner.lossRiskAvoided) {
    reasons.push(t('report.evidenceReasonFloor'));
  }

  return (
    <section className="border-t border-rule pt-8" aria-labelledby="evidence-heading">
      <div className="max-w-3xl">
        <p className="kicker">{t('report.recommendedMarketplace')}</p>
        <h2 id="evidence-heading" className="mt-2 font-display text-title font-medium text-ink">
          {t('report.evidenceTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t('report.evidenceLead')}</p>
        <p className="figure mt-3 text-xs text-ink">{t('report.evidenceFormula')}</p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5 border-b border-rule py-6 lg:border-b-0 lg:border-r lg:pr-8">
          <div className="flex items-center gap-3">
            <span
              className="h-3.5 w-3.5 rounded-full"
              style={{ backgroundColor: PLATFORM_COLORS[winner.id] }}
              aria-hidden="true"
            />
            <div>
              <p className="font-display text-lg font-medium text-ink">{winner.name}</p>
              <p className="figure text-sm text-ink-muted">
                {t('report.fitScore')} {winner.fitScore.toFixed(1)}
              </p>
            </div>
          </div>

          <ul className="space-y-2 text-sm text-ink">
            <li>{t('report.evidenceListings', { count: winner.listingCount })}</li>
            <li>{t('report.evidenceMedian', { price: formatCurrency(winner.marketPrice) })}</li>
            <li>
              {t('report.evidenceRange', {
                min: formatCurrency(winner.marketPriceRange[0]),
                max: formatCurrency(winner.marketPriceRange[1]),
              })}
            </li>
            <li>
              {t('report.' + vsRangeKey(currentPrice, winner.marketPriceRange), {
                price: formatCurrency(currentPrice),
                min: formatCurrency(winner.marketPriceRange[0]),
                max: formatCurrency(winner.marketPriceRange[1]),
              })}
            </li>
            <li>
              {winner.profitAvailable === false
                ? t('report.profitMissing')
                : t('report.profitUnit') + ' ' + formatCurrencyPrecise(winner.estimatedProfit)}
            </li>
            <li>
              {t('report.' + adviceKey(winner.priceAction), { price: formatCurrency(currentPrice) })}
            </li>
          </ul>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
              {t('report.evidenceComponents', { name: winner.name })}
            </p>
            <dl className="mt-3 space-y-3">
              <ScoreBar
                label={t('report.evidenceProfit')}
                value={profitComponent(winner)}
                tone="profit"
              />
              <ScoreBar
                label={t('report.evidenceComp')}
                value={winner.competitionIndex}
                tone="risk"
              />
              <ScoreBar
                label={t('report.evidenceDemand')}
                value={winner.demandIndex}
                tone="brand"
              />
            </dl>
            <p className="figure mt-2 text-[11px] text-ink-muted">
              {t('report.fitScore')} ≈ {reconstructedFit(winner).toFixed(1)}
            </p>
          </div>
        </div>

        <div className="py-6 lg:pl-8">
          <h3 className="text-sm font-medium text-ink">
            {t('report.evidenceWhy', { name: winner.name })}
          </h3>
          {runner ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {t('report.evidenceVs', {
                name: winner.name,
                score: winner.fitScore.toFixed(1),
                other: runner.name,
                otherScore: runner.fitScore.toFixed(1),
              })}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{winner.explanation}</p>
          )}

          {reasons.length > 0 && (
            <ul className="mt-4 space-y-2">
              {reasons.map((reason) => (
                <li key={reason} className="flex gap-2 text-sm text-ink">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                  {reason}
                </li>
              ))}
            </ul>
          )}

          {platforms.some((platform) => platform.unavailable) && (
            <p className="mt-4 text-xs leading-relaxed text-ink-muted">
              {t('report.evidenceUnavailableSkip')}
            </p>
          )}

          <div className="mt-6 space-y-4 border-t border-rule pt-4">
            {platforms.map((platform) => (
              <MarketplaceMatchCard
                key={platform.id}
                platform={platform}
                currentPrice={currentPrice}
                isWinner={platform.id === recommendedPlatform && !platform.unavailable}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketplaceMatchCard({
  platform,
  currentPrice,
  isWinner,
}: {
  platform: PlatformRecommendation;
  currentPrice: number;
  isWinner: boolean;
}) {
  const { t } = useTranslation();
  const unavailable = platform.unavailable === true;

  return (
    <article className={cx('border-t border-rule pt-3', isWinner && 'border-t-brand-600')}>
      <p className="text-sm font-medium text-ink">
        {platform.name}
        {isWinner && (
          <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.12em] text-brand-700">
            {t('common.bestFit')}
          </span>
        )}
      </p>
      {unavailable ? (
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t('report.marketDataMissing')}</p>
      ) : (
        <ul className="mt-1 space-y-1 text-xs text-ink-muted">
          <li>{t('report.evidenceMedian', { price: formatCurrency(platform.marketPrice) })}</li>
          <li>
            {t('report.evidenceRange', {
              min: formatCurrency(platform.marketPriceRange[0]),
              max: formatCurrency(platform.marketPriceRange[1]),
            })}
          </li>
          <li>
            {t('report.' + vsRangeKey(currentPrice, platform.marketPriceRange), {
              price: formatCurrency(currentPrice),
              min: formatCurrency(platform.marketPriceRange[0]),
              max: formatCurrency(platform.marketPriceRange[1]),
            })}
          </li>
        </ul>
      )}
      <p className="mt-2 text-xs text-ink">
        {platform.profitAvailable === false ? (
          t('report.profitMissing')
        ) : (
          <>
            {t('report.profitUnit')}{' '}
            <span
              className={cx(
                'figure font-medium',
                platform.estimatedProfit > 0 ? 'text-profit-600' : 'text-danger-600',
              )}
            >
              {formatCurrencyPrecise(platform.estimatedProfit)}
            </span>
          </>
        )}
      </p>
      {!unavailable && (
        <p className="mt-1 text-xs font-medium text-ink">
          {t('report.' + adviceKey(platform.priceAction), { price: formatCurrency(currentPrice) })}
        </p>
      )}
    </article>
  );
}

function ScoreBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'profit' | 'risk' | 'brand';
}) {
  const fills = {
    profit: 'bg-profit-500',
    risk: 'bg-risk-500',
    brand: 'bg-brand-500',
  } as const;

  return (
    <div>
      <div className="mb-1 flex justify-between gap-3 text-xs">
        <dt className="font-medium text-ink-muted">{label}</dt>
        <dd className="figure font-medium text-ink">{value.toFixed(0)}</dd>
      </div>
      <div className="h-[3px] overflow-hidden bg-rule">
        <div className={cx('h-full', fills[tone])} style={{ width: Math.min(100, value) + '%' }} />
      </div>
    </div>
  );
}
