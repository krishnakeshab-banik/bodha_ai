import { useTranslation } from 'react-i18next';

import type { RegionalDemand, ReviewSentiment } from '../../types';

interface ReviewDemandPanelProps {
  sentiment: ReviewSentiment;
  demand: RegionalDemand;
}

export function ReviewDemandPanel({ sentiment, demand }: ReviewDemandPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-10">
      <section aria-labelledby="sentiment-heading">
        <h2 id="sentiment-heading" className="font-display text-title font-medium text-ink">
          {t('report.sentimentTitle')}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{t('report.sentimentLead')}</p>

        {sentiment.available ? (
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            <ThemeColumn title={t('report.praises')} items={sentiment.topPraises} />
            <ThemeColumn title={t('report.complaints')} items={sentiment.topComplaints} />
          </div>
        ) : (
          <p className="mt-6 border-t border-rule pt-4 text-sm text-ink-muted">
            {t('report.sentimentEmpty')}
          </p>
        )}
      </section>

      <section aria-labelledby="demand-heading">
        <h2 id="demand-heading" className="font-display text-title font-medium text-ink">
          {t('report.demandTitle')}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{t('report.demandLead')}</p>

        {demand.available && demand.states.length > 0 ? (
          <ol className="mt-6 space-y-3">
            {demand.states.map((row) => (
              <li
                key={row.state}
                className="grid grid-cols-[8rem_minmax(0,1fr)_2rem] items-center gap-3"
              >
                <span className="text-sm text-ink">{row.state}</span>
                <span className="h-[3px] bg-rule">
                  <span
                    className="block h-full bg-[#0d6b4c]"
                    style={{ width: Math.max(4, row.interest) + '%' }}
                  />
                </span>
                <span className="figure text-right text-sm text-ink">{row.interest}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-6 border-t border-rule pt-4 text-sm text-ink-muted">
            {t('report.demandEmpty')}
          </p>
        )}
      </section>
    </div>
  );
}

function ThemeColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border-t border-rule pt-4">
      <h3 className="kicker">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
