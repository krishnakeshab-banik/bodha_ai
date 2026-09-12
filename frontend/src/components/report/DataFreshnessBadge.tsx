import { useTranslation } from 'react-i18next';

import type { DataFreshness, ScrapeStatus } from '../../types';

interface DataFreshnessBadgeProps {
  freshness: DataFreshness;
  lastUpdated: string | null;
  compact?: boolean;
  platformName?: string;
  scrapeStatus?: ScrapeStatus | null;
}

const STYLES: Record<DataFreshness, string> = {
  live: 'text-profit-700',
  gemini: 'text-brand-700',
  cached: 'text-brand-700',
  unavailable: 'text-ink-muted',
};

function useRelativeTime(iso: string | null): string {
  const { t } = useTranslation();
  if (!iso) return t('common.unavailable');
  const deltaMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return iso;
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return t('freshness.justNow');
  if (minutes < 60) return t('freshness.minAgo', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('freshness.hourAgo', { count: hours });
  const days = Math.round(hours / 24);
  return t('freshness.dayAgo', { count: days });
}

/** Real data-status marker — not a decorative pill. */
export function DataFreshnessBadge({
  freshness,
  lastUpdated,
  compact,
  platformName,
  scrapeStatus,
}: DataFreshnessBadgeProps) {
  const { t } = useTranslation();
  const relative = useRelativeTime(lastUpdated);
  const name = platformName ?? '';

  let label: string;
  if (freshness === 'unavailable') {
    label = name
      ? t('report.statusUnavailable', { name })
      : t('common.unavailable');
  } else if (freshness === 'live') {
    label = t('common.live');
  } else if (freshness === 'gemini') {
    label = name
      ? t('report.statusGeminiFallback', { name })
      : t('report.statusGeminiFallbackShort');
  } else if (name) {
    label = t('report.statusCached', { name, time: relative });
  } else {
    label = compact ? t('common.cached') : t('common.lastUpdated', { time: relative });
  }

  const isShort = freshness === 'live' || (!name && freshness !== 'gemini');

  return (
    <span
      className={
        'inline-flex items-center gap-1.5 text-[11px] font-medium ' +
        (isShort ? 'uppercase tracking-[0.12em] ' : 'normal-case tracking-normal leading-snug ') +
        STYLES[freshness]
      }
      title={freshness === 'cached' ? (lastUpdated ?? undefined) : undefined}
      data-testid="platform-data-status"
      data-freshness={freshness}
      data-scrape-status={scrapeStatus ?? ''}
    >
      <span
        className={
          'h-1.5 w-1.5 ' +
          (freshness === 'live'
            ? 'bg-profit-600'
            : freshness === 'cached' || freshness === 'gemini'
              ? 'bg-brand-600'
              : 'bg-ink-muted')
        }
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
