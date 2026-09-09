import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AnalyzingSkeleton } from '../components/report/AnalyzingSkeleton';
import { ComparisonEvidence } from '../components/report/ComparisonEvidence';
import { CompetitorAnalysisPanel } from '../components/report/CompetitorAnalysisPanel';
import { OptimizedListingPanel } from '../components/report/OptimizedListingPanel';
import { PlatformBenefitsList } from '../components/report/PlatformBenefitsList';
import { PlatformProfiles } from '../components/report/PlatformProfiles';
import { PlatformCharts } from '../components/report/PlatformCharts';
import { PlatformComparison } from '../components/report/PlatformComparison';
import { PriceRecommendationPanel } from '../components/report/PriceRecommendationPanel';
import { RecommendationBanner } from '../components/report/RecommendationBanner';
import { ReportSectionNav } from '../components/report/ReportSectionNav';
import { ReviewDemandPanel } from '../components/report/ReviewDemandPanel';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useProduct } from '../hooks/useProducts';
import { resolveAppLanguage } from '../i18n';
import { ApiError, api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { formatCurrency } from '../utils/format';
import { reportInsights, type ReportSectionId } from '../utils/insights';

export function ReportPage() {
  const { t, i18n } = useTranslation();
  const { productId } = useParams<{ productId: string }>();
  const { data: analysis, isLoading, isError, error } = useProduct(productId);
  const { showToast } = useToast();
  const [section, setSection] = useState<ReportSectionId>('overview');
  const [pdfBusy, setPdfBusy] = useState(false);

  if (isLoading) {
    return <AnalyzingSkeleton />;
  }

  if (isError || !analysis) {
    const isMissing = error instanceof ApiError && error.status === 404;

    return (
      <div className="section-shell py-16">
        <EmptyState
          title={isMissing ? t('report.missingTitle') : t('report.loadFail')}
          description={
            isMissing
              ? t('report.missingBody')
              : error instanceof Error
                ? error.message
                : t('report.loadFail')
          }
          action={
            <div className="flex gap-3">
              <Link to="/dashboard">
                <Button variant="secondary">{t('report.back')}</Button>
              </Link>
              <Link to="/analyze">
                <Button>{t('report.new')}</Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const report = analysis;
  const winner =
    report.platforms.find((platform) => platform.id === report.recommendedPlatform) ??
    report.platforms[0];
  const insights = reportInsights(report);
  const productIdForPdf = report.productId;

  async function handlePdf() {
    setPdfBusy(true);
    try {
      await api.downloadReportPdf(
        productIdForPdf,
        resolveAppLanguage(i18n.resolvedLanguage ?? i18n.language),
      );
    } catch (downloadError) {
      showToast(
        downloadError instanceof Error ? downloadError.message : t('report.pdfFail'),
        'error',
      );
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="section-shell py-8 sm:py-12">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex min-w-0 max-w-full items-center gap-1.5 text-sm text-ink-muted">
          <Link to="/dashboard" className="shrink-0 rounded font-medium transition hover:text-brand-700">
            {t('report.breadcrumb')}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="min-w-0 truncate font-medium text-ink" title={report.title}>
            {report.title}
          </span>
        </nav>

        <Button variant="secondary" onClick={() => void handlePdf()} loading={pdfBusy}>
          {t('report.downloadPdf')}
        </Button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
        <div className="sticky top-16 z-10 -mx-1 bg-[#f3efe6]/95 px-1 pb-3 backdrop-blur-sm lg:top-24 lg:mx-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:backdrop-blur-none">
          <ReportSectionNav active={section} onChange={setSection} />
        </div>

        <div className="min-w-0">
          {section === 'overview' && (
            <div className="space-y-8">
              <RecommendationBanner analysis={report} winner={winner} />
              <div>
                <h2 className="font-display text-title font-medium text-ink">
                  {t('report.evidenceTitle')}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink">
                  {winner.explanation}
                </p>
              </div>
              <PlatformBenefitsList name={winner.name} benefits={insights.platformBenefits} />
              <ProductSummaryCard analysis={report} />
            </div>
          )}

          {section === 'pricing' && (
            <PriceRecommendationPanel platform={winner} currentPrice={report.currentPrice} />
          )}

          {section === 'comparison' && (
            <div className="space-y-10">
              <ComparisonEvidence
                platforms={report.platforms}
                recommendedPlatform={report.recommendedPlatform}
                currentPrice={report.currentPrice}
              />
              <PlatformComparison
                platforms={report.platforms}
                recommendedPlatform={report.recommendedPlatform}
                currentPrice={report.currentPrice}
              />
              <PlatformCharts platforms={report.platforms} />
              <PlatformProfiles platforms={report.platforms.map((platform) => platform.id)} />
            </div>
          )}

          {section === 'competitors' && (
            <CompetitorAnalysisPanel
              competitors={insights.competitors}
              platformName={
                report.platforms.find((platform) => platform.id === insights.competitorPlatform)?.name ??
                winner.name
              }
            />
          )}

          {section === 'reviews' && (
            <ReviewDemandPanel
              sentiment={insights.reviewSentiment}
              demand={insights.regionalDemand}
            />
          )}

          {section === 'listing' && (
            <OptimizedListingPanel
              listing={report.optimizedListing}
              complaints={insights.reviewSentiment.available ? insights.reviewSentiment.topComplaints : []}
            />
          )}

          <div className="mt-10 flex flex-wrap gap-3 border-t border-rule pt-6">
            <Link to="/analyze">
              <Button>{t('report.another')}</Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="secondary">{t('report.all')}</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductSummaryCard({
  analysis,
}: {
  analysis: NonNullable<ReturnType<typeof useProduct>['data']>;
}) {
  const { t } = useTranslation();

  return (
    <aside className="border-t border-rule pt-6" aria-label={t('report.summary')}>
      {analysis.imageUrl ? (
        <img
          src={analysis.imageUrl}
          alt={analysis.title}
          className="h-40 w-full bg-paper object-contain"
        />
      ) : (
        <div className="flex h-24 items-end border-b border-rule px-1 py-3 text-ink-muted">
          <span className="sr-only">{t('report.noImage')}</span>
        </div>
      )}

      <div className="space-y-4 pt-4">
        <div>
          <h2 className="font-display text-base font-medium text-ink">{analysis.title}</h2>
          <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-ink-muted">
            {analysis.description}
          </p>
        </div>

        <dl className="space-y-2 border-t border-rule pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t('report.category')}</dt>
            <dd className="text-right font-medium text-ink">
              {t('categories.' + analysis.category, { defaultValue: analysis.category })}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t('report.cost')}</dt>
            <dd className="figure font-medium text-ink">
              {formatCurrency(analysis.manufacturingCost)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t('report.current')}</dt>
            <dd className="figure font-medium text-ink">
              {formatCurrency(analysis.currentPrice)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t('report.compared')}</dt>
            <dd className="figure font-medium text-ink">{analysis.platforms.length}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
