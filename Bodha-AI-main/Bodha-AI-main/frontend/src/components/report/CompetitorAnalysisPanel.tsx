import { useTranslation } from 'react-i18next';

import type { CompetitorInsight } from '../../types';
import { formatCurrency } from '../../utils/format';

interface CompetitorAnalysisPanelProps {
  competitors: CompetitorInsight[];
  platformName: string;
}

export function CompetitorAnalysisPanel({ competitors, platformName }: CompetitorAnalysisPanelProps) {
  const { t } = useTranslation();

  if (competitors.length === 0) {
    return (
      <p className="border-t border-rule pt-6 text-sm text-ink-muted">{t('report.competitorsEmpty')}</p>
    );
  }

  return (
    <section aria-labelledby="competitors-heading">
      <h2 id="competitors-heading" className="font-display text-title font-medium text-ink">
        {t('report.competitorsTitle', { name: platformName })}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">{t('report.competitorsLead')}</p>

      <ul className="mt-6 divide-y divide-rule border-y border-rule">
        {competitors.map((competitor) => (
          <li key={competitor.url + competitor.title} className="grid gap-4 py-6 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
            {competitor.thumbnail ? (
              <img
                src={competitor.thumbnail}
                alt=""
                className="h-20 w-20 bg-paper object-contain"
              />
            ) : (
              <div
                className="h-20 w-20 border-b border-rule"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, transparent, transparent 7px, rgba(207,200,186,0.6) 8px)',
                }}
                aria-hidden="true"
              />
            )}

            <div>
              <h3 className="break-words font-display text-base font-medium text-ink">{competitor.title}</h3>
              <p className="figure mt-1 text-sm text-ink">
                {formatCurrency(competitor.price)}
                {competitor.rating != null && (
                  <span className="text-ink-muted">
                    {' '}
                    · {competitor.rating.toFixed(1)}
                  </span>
                )}
                {competitor.reviewCount != null && (
                  <span className="text-ink-muted"> · {competitor.reviewCount.toLocaleString('en-IN')}</span>
                )}
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="kicker">{t('report.competitorStrengths')}</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink">
                    {competitor.strengths.map((item, index) => (
                      <li key={competitor.url + '-s-' + index}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="kicker">{t('report.competitorWeaknesses')}</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
                    {competitor.weaknesses.map((item, index) => (
                      <li key={competitor.url + '-w-' + index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
