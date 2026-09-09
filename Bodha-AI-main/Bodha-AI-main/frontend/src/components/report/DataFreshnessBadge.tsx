import { useTranslation } from 'react-i18next';

import type { DataFreshness } from '../../types';

interface DataFreshnessBadgeProps {
  freshness: DataFreshness;
  lastUpdated: string | null;
  compact?: boolean;
}

const STYLES: Record<DataFreshness, string> = {
  live: 'text-profit-700',
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
export function DataFreshnessBadge({ freshness, lastUpdated, compact }: DataFreshnessBadgeProps) {
  const { t } = useTranslation();
  const relative = useRelativeTime(lastUpdated);

  const label =
    freshness === 'unavailable'
      ? t('common.unavailable')
      : freshness === 'live'
        ? t('common.live')
        : compact
          ? t('common.cached')
          : t('common.lastUpdated', { time: relative });

  return (
    <span
      className={
        'inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] ' +
        STYLES[freshness]
      }
      title={freshness === 'cached' ? (lastUpdated ?? undefined) : undefined}
    >
      <span
        className={
          'h-1.5 w-1.5 ' +
          (freshness === 'live' ? 'bg-profit-600' : freshness === 'cached' ? 'bg-brand-600' : 'bg-ink-muted')
        }
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
