import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useHistory } from '../hooks/useProducts';
import type { HistoryItem } from '../types';
import { formatCurrency, formatDate, PLATFORM_COLORS, PLATFORM_NAMES } from '../utils/format';

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: history, isLoading, isError, error } = useHistory();
  const latest = history?.[0];

  return (
    <div className="section-shell py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-headline font-medium text-ink">
            {t('dashboard.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-muted">{t('dashboard.lead')}</p>
        </div>

        <Link to="/analyze">
          <Button
            icon={
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            }
          >
            {t('common.newAnalysis')}
          </Button>
        </Link>
      </header>

      {!isLoading && !isError && history && (
        <dl className="mt-8 grid gap-0 border-y border-rule sm:grid-cols-2 sm:divide-x sm:divide-rule">
          <div className="py-5 sm:pr-8">
            <dt className="kicker">{t('dashboard.statTotal')}</dt>
            <dd className="figure mt-2 text-4xl font-medium text-ink">{history.length}</dd>
          </div>
          <div className="border-t border-rule py-5 sm:border-t-0 sm:pl-8">
            <dt className="kicker">{t('dashboard.statLatest')}</dt>
            <dd className="mt-2 font-display text-lg font-medium text-ink">
              {latest
                ? PLATFORM_NAMES[latest.recommendedPlatform] +
                  ' · ' +
                  formatCurrency(latest.recommendedPrice)
                : t('dashboard.statNone')}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-8">
        {isLoading && <HistorySkeleton />}

        {isError && (
          <div
            role="alert"
            className="rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700"
          >
            {error instanceof Error ? error.message : t('dashboard.loadError')}
          </div>
        )}

        {!isLoading && !isError && history?.length === 0 && (
          <EmptyState
            title={t('dashboard.emptyTitle')}
            description={t('dashboard.emptyBody')}
            action={
              <Link to="/analyze">
                <Button size="lg">{t('dashboard.emptyCta')}</Button>
              </Link>
            }
          />
        )}

        {!isLoading && !isError && history && history.length > 0 && (
          <>
            <p className="mb-4 text-sm text-ink-muted">
              {t('dashboard.saved', { count: history.length })}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((item) => (
                <li key={item.productId}>
                  <HistoryCard item={item} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function HistoryCard({ item }: { item: HistoryItem }) {
  const { t } = useTranslation();
  const hasPhoto = Boolean(item.thumbnail);

  return (
    <Link
      to={'/report/' + item.productId}
      className={
        hasPhoto
          ? 'group flex h-full flex-col overflow-hidden border border-ink/20 bg-[#faf8f3] transition hover:border-ink'
          : 'group flex h-full flex-col overflow-hidden border border-rule bg-transparent transition hover:border-ink/40'
      }
    >
      {item.thumbnail ? (
        <img
          src={item.thumbnail}
          alt=""
          className="h-48 w-full bg-paper object-contain"
          loading="lazy"
        />
      ) : (
        <div
          className="flex h-24 items-end border-b border-rule px-5 py-4"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent, transparent 11px, rgba(207,200,186,0.5) 12px)',
          }}
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            {t('categories.' + item.category, { defaultValue: item.category })}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        {hasPhoto && (
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            {t('categories.' + item.category, { defaultValue: item.category })}
          </p>
        )}

        <h2 className="mt-2 line-clamp-2 font-display text-base font-medium text-ink transition group-hover:text-brand-700">
          {item.title}
        </h2>

        <div className="mt-auto space-y-3 pt-4">
          <div className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PLATFORM_COLORS[item.recommendedPlatform] }}
              aria-hidden="true"
            />
            <span className="font-medium text-ink">{PLATFORM_NAMES[item.recommendedPlatform]}</span>
            <span className="figure ml-auto text-base font-medium text-brand-600">
              {formatCurrency(item.recommendedPrice)}
            </span>
          </div>

          <p className="border-t border-rule pt-3 text-xs text-ink-muted">
            {formatDate(item.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function HistorySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div key={index} className="skeleton h-72" />
      ))}
    </div>
  );
}
