import { useTranslation } from 'react-i18next';

import { DataFreshnessBadge } from './DataFreshnessBadge';
import type { AnalysisResponse, PlatformRecommendation } from '../../types';
import { formatCurrency, formatDateTime, PLATFORM_COLORS } from '../../utils/format';

interface RecommendationBannerProps {
  analysis: AnalysisResponse;
  winner: PlatformRecommendation;
}

export function RecommendationBanner({ analysis, winner }: RecommendationBannerProps) {
  const { t } = useTranslation();
  const delta = winner.recommendedPrice - analysis.currentPrice;
  const deltaPercent = (delta / analysis.currentPrice) * 100;

  let summary = t('report.summaryHold', {
    price: formatCurrency(analysis.currentPrice),
    competition: t('levels.' + winner.competition),
  });
  if (winner.lossRiskAvoided) {
    summary = t('report.summaryLoss', { price: formatCurrency(winner.recommendedPrice) });
  } else if (winner.priceAction === 'increase') {
    summary = t('report.summaryIncrease', {
      from: formatCurrency(analysis.currentPrice),
      to: formatCurrency(winner.recommendedPrice),
      demand: t('levels.' + winner.demand),
    });
  } else if (winner.priceAction === 'decrease') {
    summary = t('report.summaryDecrease', {
      from: formatCurrency(analysis.currentPrice),
      to: formatCurrency(winner.recommendedPrice),
    });
  }

  return (
    <section className="bg-[#141814] px-6 py-8 text-[#f3efe6] sm:px-10 sm:py-10" aria-labelledby="recommendation-heading">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
          <span className="inline-flex items-center gap-2 text-white/80">
            <span
              className="h-2 w-2"
              style={{ backgroundColor: PLATFORM_COLORS[winner.id] }}
              aria-hidden="true"
            />
            {t('report.recommendedMarketplace')}
          </span>
          <span>{t('categories.' + analysis.category, { defaultValue: analysis.category })}</span>
        </div>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1
              id="recommendation-heading"
              className="font-display text-3xl font-medium tracking-tight text-white sm:text-4xl"
            >
              {winner.unavailable
                ? t('report.unavailableTitle')
                : t('report.sellOn', {
                    name: winner.name,
                    price: formatCurrency(winner.recommendedPrice),
                  })}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70">
              {winner.unavailable ? t('report.unavailableBody') : summary}
            </p>
            <div className="mt-4">
              <DataFreshnessBadge
                freshness={winner.dataFreshness ?? 'unavailable'}
                lastUpdated={winner.lastUpdated}
              />
            </div>
          </div>

          <dl className="flex shrink-0 gap-8">
            <BannerStat label={t('report.yourPrice')} value={formatCurrency(analysis.currentPrice)} />
            <BannerStat
              label={t('report.recommended')}
              value={formatCurrency(winner.recommendedPrice)}
              emphasis
            />
            <BannerStat
              label={t('report.change')}
              value={(delta >= 0 ? '+' : '−') + Math.abs(deltaPercent).toFixed(1) + '%'}
              tone={Math.abs(deltaPercent) < 10 ? 'neutral' : delta > 0 ? 'up' : 'down'}
            />
          </dl>
        </div>

        <p className="mt-8 border-t border-white/15 pt-4 text-xs text-white/45">
          {analysis.title} · {formatDateTime(analysis.createdAt)}
        </p>
      </div>
    </section>
  );
}

function BannerStat({
  label,
  value,
  emphasis,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: 'neutral' | 'up' | 'down';
}) {
  const TONES = {
    neutral: 'text-white',
    up: 'text-profit-200',
    down: 'text-risk-200',
  } as const;

  return (
    <div className={emphasis ? 'text-right' : 'text-right'}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">{label}</dt>
      <dd
        className={
          'figure mt-1 tracking-tight ' +
          (emphasis ? 'text-3xl font-medium text-brand-300' : 'text-xl ' + TONES[tone])
        }
      >
        {value}
      </dd>
    </div>
  );
}
