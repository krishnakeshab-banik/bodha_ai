import { useTranslation } from 'react-i18next';

import type { DataConfidence } from '../../types';
import { cx } from '../../utils/format';

interface ConfidenceBadgeProps {
  confidence: DataConfidence;
  compact?: boolean;
  onDark?: boolean;
}

const LEVEL_CLASS: Record<DataConfidence['level'], string> = {
  High: 'text-profit-700',
  Medium: 'text-brand-700',
  Low: 'text-danger-700',
};

const LEVEL_CLASS_DARK: Record<DataConfidence['level'], string> = {
  High: 'text-profit-200',
  Medium: 'text-brand-300',
  Low: 'text-risk-200',
};

const DOT_CLASS: Record<DataConfidence['level'], string> = {
  High: 'bg-profit-600',
  Medium: 'bg-brand-600',
  Low: 'bg-danger-600',
};

export function ConfidenceBadge({ confidence, compact, onDark }: ConfidenceBadgeProps) {
  const { t } = useTranslation();
  const label =
    confidence.level === 'High'
      ? t('report.confidenceHigh')
      : confidence.level === 'Medium'
        ? t('report.confidenceMedium')
        : t('report.confidenceLow');
  const matchKey =
    confidence.titleMatch === 'exact'
      ? 'report.confidenceMatchExact'
      : confidence.titleMatch === 'close'
        ? 'report.confidenceMatchClose'
        : 'report.confidenceMatchCategory';
  const freshnessKey =
    confidence.freshness === 'live'
      ? 'common.live'
      : confidence.freshness === 'gemini'
        ? 'report.statusGeminiFallbackShort'
        : confidence.freshness === 'cached'
          ? 'common.cached'
          : 'common.unavailable';

  return (
    <span
      className={cx(
        'inline-flex flex-col items-start gap-0.5 text-[11px] font-medium',
        onDark ? LEVEL_CLASS_DARK[confidence.level] : LEVEL_CLASS[confidence.level],
        confidence.level === 'Low' &&
          (onDark ? 'border-l-2 border-risk-200 pl-2' : 'border-l-2 border-danger-600 pl-2'),
      )}
      data-testid="data-confidence"
      data-confidence={confidence.level}
      data-title-match={confidence.titleMatch}
      data-listing-count={confidence.listingCount}
      title={t('report.confidenceReason', {
        count: confidence.listingCount,
        match: t(matchKey),
        freshness: t(freshnessKey),
      })}
    >
      <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.12em]">
        <span className={cx('h-1.5 w-1.5', DOT_CLASS[confidence.level])} aria-hidden="true" />
        {label}
      </span>
      {!compact && (
        <span className="normal-case tracking-normal leading-snug text-current/80">
          {t('report.confidenceReason', {
            count: confidence.listingCount,
            match: t(matchKey),
            freshness: t(freshnessKey),
          })}
        </span>
      )}
    </span>
  );
}
