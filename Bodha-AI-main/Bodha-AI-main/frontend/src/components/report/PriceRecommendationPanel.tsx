import { useTranslation } from 'react-i18next';

import { DataFreshnessBadge } from './DataFreshnessBadge';
import { LossProtectionNotice } from './LossProtectionNotice';
import type { PlatformRecommendation } from '../../types';
import { cx, formatCurrency, formatCurrencyPrecise } from '../../utils/format';

interface PriceRecommendationPanelProps {
  platform: PlatformRecommendation;
  currentPrice: number;
}

const ACTION_STYLES: Record<PlatformRecommendation['priceAction'], string> = {
  increase: 'text-profit-700',
  decrease: 'text-risk-700',
  hold: 'text-brand-700',
};

/**
 * The price panel: current vs recommended vs break-even on one axis, so the
 * seller can see at a glance how much headroom sits above the loss floor.
 */
export function PriceRecommendationPanel({
  platform,
  currentPrice,
}: PriceRecommendationPanelProps) {
  const { t } = useTranslation();
  const actionLabels = {
    increase: t('report.raise'),
    decrease: t('report.lower'),
    hold: t('report.hold'),
  } as const;

  if (platform.unavailable) {
    return (
      <section className="border-t border-rule pt-6" aria-labelledby="price-panel-heading">
        <h2 id="price-panel-heading" className="font-display text-title font-medium text-ink">
          {t('report.priceTitle')}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          {t('report.priceUnavailable', { name: platform.name })}
        </p>
      </section>
    );
  }

  const { breakEvenPrice, recommendedPrice, priceAction, lossRiskAvoided } = platform;

  // Scale: from just below break-even to just above the highest marker, so all
  // three markers always sit comfortably inside the track.
  const highest = Math.max(currentPrice, recommendedPrice, breakEvenPrice);
  const min = Math.max(0, breakEvenPrice * 0.75);
  const max = highest * 1.12;
  const span = Math.max(max - min, 1);

  const toPercent = (value: number) => Math.min(100, Math.max(0, ((value - min) / span) * 100));

  const markers = [
    {
      key: 'breakEven',
      label: t('report.breakEven'),
      value: breakEvenPrice,
      color: 'bg-danger-500',
      text: 'text-danger-700',
    },
    {
      key: 'current',
      label: t('report.yourPrice'),
      value: currentPrice,
      color: 'bg-ink',
      text: 'text-ink',
    },
    {
      key: 'recommended',
      label: t('report.recommended'),
      value: recommendedPrice,
      color: 'bg-profit-600',
      text: 'text-profit-700',
    },
  ];

  // Two markers can land on top of each other - most obviously when loss
  // protection floors the recommendation onto the break-even price. Walk them
  // left to right and drop any that crowd their neighbour onto a lower row so
  // the labels stack instead of overprinting.
  const MIN_LABEL_GAP_PERCENT = 18;
  const LABEL_ROW_HEIGHT_PX = 34;

  const positioned = markers
    .map((marker) => ({ ...marker, percent: toPercent(marker.value) }))
    .sort((a, b) => a.percent - b.percent)
    .reduce<((typeof markers)[number] & { percent: number; row: number })[]>((placed, marker) => {
      const previous = placed[placed.length - 1];
      const crowded = previous && marker.percent - previous.percent < MIN_LABEL_GAP_PERCENT;
      placed.push({ ...marker, row: crowded ? previous.row + 1 : 0 });
      return placed;
    }, []);

  const labelRows = Math.max(...positioned.map((marker) => marker.row)) + 1;

  return (
    <section className="border-t-2 border-ink pt-6" aria-labelledby="price-panel-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="price-panel-heading" className="font-display text-title font-medium text-ink">
            {t('report.priceTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t('report.priceOn', { name: platform.name })}
          </p>
        </div>

        <p className={cx('kicker', ACTION_STYLES[priceAction])}>{actionLabels[priceAction]}</p>
      </div>

      <div className="mt-3">
        <DataFreshnessBadge
          freshness={platform.dataFreshness ?? 'live'}
          lastUpdated={platform.lastUpdated}
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <PriceStat label={t('report.breakEven')} value={breakEvenPrice} tone="danger" precise />
        <PriceStat label={t('report.yourPrice')} value={currentPrice} tone="neutral" />
        <PriceStat label={t('report.recommended')} value={recommendedPrice} tone="profit" emphasis />
      </div>

      <div className="mt-8 pt-2" style={{ paddingBottom: 28 + labelRows * LABEL_ROW_HEIGHT_PX }}>
        <div className="relative h-1.5 bg-rule/60">
          <div
            className="absolute inset-y-0 left-0 bg-danger-100"
            style={{ width: toPercent(breakEvenPrice) + '%' }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 bg-profit-100"
            style={{
              left: toPercent(breakEvenPrice) + '%',
              width: Math.max(0, toPercent(recommendedPrice) - toPercent(breakEvenPrice)) + '%',
            }}
            aria-hidden="true"
          />

          {positioned.map((marker) => (
            <div
              key={marker.key}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: marker.percent + '%' }}
            >
              <span
                className={cx('block h-3.5 w-3.5 ring-4 ring-paper', marker.color)}
                aria-hidden="true"
              />
              <span
                className={cx(
                  'absolute left-1/2 w-28 -translate-x-1/2 text-center text-xs font-medium',
                  marker.text,
                )}
                style={{ top: 28 + marker.row * LABEL_ROW_HEIGHT_PX }}
              >
                <span className="block">{marker.label}</span>
                <span className="figure mt-0.5 block text-ink-muted">
                  {formatCurrency(marker.value)}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {lossRiskAvoided && <LossProtectionNotice platform={platform} />}

      <p className="mt-6 border-l-2 border-brand-600 pl-4 text-sm leading-relaxed text-ink">
        {platform.explanation}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <SummaryStat label={t('report.commission')} value={(platform.feePercent * 100).toFixed(1) + '%'} />
        <SummaryStat label={t('report.shipping')} value={formatCurrency(platform.avgShippingFee)} />
        <SummaryStat
          label={t('report.netProfit')}
          value={
            platform.profitAvailable === false
              ? t('report.profitMissing')
              : formatCurrencyPrecise(platform.estimatedProfit)
          }
          tone={
            platform.profitAvailable === false
              ? 'loss'
              : platform.estimatedProfit > 0
                ? 'profit'
                : 'loss'
          }
        />
        <SummaryStat
          label={t('report.margin')}
          value={(platform.profitMargin * 100).toFixed(1) + '%'}
          tone={platform.profitMargin > 0 ? 'profit' : 'loss'}
        />
      </dl>
    </section>
  );
}

function PriceStat({
  label,
  value,
  tone,
  emphasis,
  precise,
}: {
  label: string;
  value: number;
  tone: 'danger' | 'neutral' | 'profit';
  emphasis?: boolean;
  precise?: boolean;
}) {
  const TONES = {
    danger: 'text-danger-600',
    neutral: 'text-ink',
    profit: 'text-profit-600',
  } as const;

  return (
    <div className={emphasis ? 'border-t-2 border-brand-600 pt-3 text-center' : 'pt-3 text-center'}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p
        className={cx(
          'figure mt-1 tracking-tight',
          emphasis ? 'text-2xl font-medium' : 'text-xl',
          TONES[tone],
        )}
      >
        {precise ? formatCurrencyPrecise(value) : formatCurrency(value)}
      </p>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'loss';
}) {
  const TONES = {
    profit: 'text-profit-600',
    loss: 'text-danger-600',
  } as const;

  return (
    <div>
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className={cx('figure mt-0.5 text-base font-medium', tone ? TONES[tone] : 'text-ink')}>
        {value}
      </dd>
    </div>
  );
}
