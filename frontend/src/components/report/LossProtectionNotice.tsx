import { useTranslation } from 'react-i18next';

import type { PlatformRecommendation } from '../../types';
import { formatCurrency, formatCurrencyPrecise } from '../../utils/format';

/**
 * Shown whenever `lossRiskAvoided` is true - i.e. the going market rate sat
 * below the break-even floor and Bodha AI refused to follow it down.
 */
export function LossProtectionNotice({ platform }: { platform: PlatformRecommendation }) {
  const { t } = useTranslation();
  return (
    <div role="note" className="mt-6 border-l-2 border-risk-600 pl-4">
      <p className="text-sm font-medium text-risk-700">{t('report.lossTitle')}</p>
      <p className="mt-1 text-sm leading-relaxed text-risk-700/90">
        {t('report.lossBody', {
          name: platform.name,
          market: formatCurrency(platform.marketPrice),
          floor: formatCurrencyPrecise(platform.breakEvenPrice),
        })}
      </p>
    </div>
  );
}

/** Compact inline badge used in the comparison table and platform cards. */
export function LossProtectionBadge({ marketPrice }: { marketPrice: number }) {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.1em] text-risk-700"
      title={
        'The market rate here (' +
        formatCurrency(marketPrice) +
        ') is below your break-even, so the price was floored instead of lowered.'
      }
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l8 3.5v5c0 4.6-3.4 8.4-8 9.5-4.6-1.1-8-4.9-8-9.5v-5L12 3z" />
      </svg>
      {t('common.lossProtected')}
    </span>
  );
}
