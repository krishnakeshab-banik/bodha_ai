import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ImageUpload } from '../components/analyze/ImageUpload';
import { PlatformChips } from '../components/analyze/PlatformChips';
import { AnalyzingSkeleton } from '../components/report/AnalyzingSkeleton';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { useAnalyzeForm } from '../hooks/useAnalyzeForm';
import { useAuth } from '../hooks/useAuth';
import { useAnalyzeProduct, useMeta } from '../hooks/useProducts';
import { useToast } from '../hooks/useToast';
import { resolveAppLanguage } from '../i18n';
import { ApiError, api } from '../services/api';
import type { CategoryId } from '../types';
import { cx } from '../utils/format';

export function AnalyzePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refresh } = useAuth();
  const { values, errors, setValue, togglePlatform, submit } = useAnalyzeForm();
  const { data: meta, isLoading: isMetaLoading, isError: isMetaError } = useMeta();
  const analyzeMutation = useAnalyzeProduct();
  const [copyMode, setCopyMode] = useState<'manual' | 'auto'>('manual');
  const [insightBusy, setInsightBusy] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (insightBusy) return;

    const payload = submit();
    if (!payload) {
      showToast(t('analyze.toastFix'), 'error');
      return;
    }

    analyzeMutation.mutate(payload, {
      onSuccess: (analysis) => {
        void refresh();
        showToast(t('analyze.toastOk'), 'success');
        navigate('/report/' + analysis.productId);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 402) {
          showToast(t('billing.outOfCredits'), 'error');
          navigate('/pricing');
          return;
        }
        const message = error instanceof ApiError ? error.message : t('analyze.toastFail');
        showToast(message, 'error');
      },
    });
  }

  async function applyInsight(imageUrl: string) {
    setInsightBusy(true);
    setInsightError(null);
    try {
      const result = await api.inferFromPhoto({
        imageUrl,
        language: resolveAppLanguage(i18n.resolvedLanguage ?? i18n.language),
      });
      if (!result.confident) {
        setInsightError(t('analyze.insightFail'));
        return;
      }
      if (result.suggestedTitle) setValue('title', result.suggestedTitle);
      if (result.suggestedDescription) setValue('description', result.suggestedDescription);
      if (result.suggestedCategory) setValue('category', result.suggestedCategory);
    } catch (error) {
      setInsightError(error instanceof ApiError ? error.message : t('analyze.insightFail'));
    } finally {
      setInsightBusy(false);
    }
  }

  function handleImageChange(url: string | null) {
    setValue('imageUrl', url);
    setInsightError(null);
    if (copyMode === 'auto' && url) void applyInsight(url);
  }

  function handleCopyMode(mode: 'manual' | 'auto') {
    setCopyMode(mode);
    setInsightError(null);
    if (mode === 'auto' && values.imageUrl) void applyInsight(values.imageUrl);
  }

  if (analyzeMutation.isPending) {
    return <AnalyzingSkeleton />;
  }

  return (
    <div className="section-shell py-10 sm:py-14">
      <header className="max-w-2xl">
        <p className="kicker">{t('analyze.kicker')}</p>
        <h1 className="mt-2 font-display text-headline font-medium text-ink">
          {t('analyze.title')}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-muted">{t('analyze.lead')}</p>
      </header>

      {isMetaError && (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700"
        >
          {t('analyze.metaError')}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start"
      >
        <div className="panel grid gap-0 overflow-hidden rounded-sm lg:grid-cols-2 lg:divide-x lg:divide-rule">
          <section className="space-y-5 border-b border-rule p-6 sm:p-8 lg:border-b-0">
            <div className="flex items-center gap-3">
              <span className="figure flex h-7 w-7 items-center justify-center text-sm font-medium text-brand-700 ring-1 ring-rule">
                1
              </span>
              <h2 className="font-display text-title font-medium text-ink">{t('analyze.details')}</h2>
            </div>

            <ImageUpload value={values.imageUrl} onChange={handleImageChange} />

            <fieldset className="border-t border-rule pt-4">
              <legend className="label-text">{t('analyze.copyMode')}</legend>
              <div className="mt-2 flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2 text-ink">
                  <input
                    type="radio"
                    name="copyMode"
                    checked={copyMode === 'auto'}
                    onChange={() => handleCopyMode('auto')}
                  />
                  {t('analyze.copyModeAuto')}
                </label>
                <label className="flex items-center gap-2 text-ink">
                  <input
                    type="radio"
                    name="copyMode"
                    checked={copyMode === 'manual'}
                    onChange={() => handleCopyMode('manual')}
                  />
                  {t('analyze.copyModeManual')}
                </label>
              </div>
              {insightBusy && <p className="mt-2 text-sm text-brand-700">{t('analyze.insightBusy')}</p>}
              {insightError && (
                <p role="alert" className="mt-2 text-sm font-medium text-danger-600">
                  {insightError}
                </p>
              )}
              <p className="mt-2 text-xs text-ink-muted">{t('analyze.insightHint')}</p>
            </fieldset>

            <FormField id="title" label={t('analyze.titleLabel')} error={errors.title}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  type="text"
                  value={values.title}
                  onChange={(event) => setValue('title', event.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  placeholder={t('analyze.titlePlaceholder')}
                  className={cx('field', invalid && 'field-invalid')}
                />
              )}
            </FormField>

            <FormField
              id="description"
              label={t('analyze.descLabel')}
              hint={t('analyze.descHint')}
              error={errors.description}
            >
              {({ id, describedBy, invalid }) => (
                <textarea
                  id={id}
                  rows={5}
                  value={values.description}
                  onChange={(event) => setValue('description', event.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  placeholder={t('analyze.descPlaceholder')}
                  className={cx('field resize-y', invalid && 'field-invalid')}
                />
              )}
            </FormField>

            <FormField id="category" label={t('analyze.category')} error={errors.category}>
              {({ id, describedBy, invalid }) => (
                <select
                  id={id}
                  value={values.category}
                  onChange={(event) => setValue('category', event.target.value as CategoryId)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  disabled={isMetaLoading}
                  className={cx('field', invalid && 'field-invalid')}
                >
                  <option value="">
                    {isMetaLoading ? t('analyze.loadingCategories') : t('analyze.selectCategory')}
                  </option>
                  {meta?.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {t('categories.' + category.id, { defaultValue: category.label })}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </section>

          <div className="space-y-0">
            <section className="space-y-5 border-b border-rule p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="figure flex h-7 w-7 items-center justify-center text-sm font-medium text-brand-700 ring-1 ring-rule">
                  2
                </span>
                <div>
                  <h2 className="font-display text-title font-medium text-ink">{t('analyze.economics')}</h2>
                  <p className="mt-1 text-sm text-ink-muted">{t('analyze.economicsHint')}</p>
                </div>
              </div>

              <FormField
                id="manufacturingCost"
                label={t('analyze.cost')}
                error={errors.manufacturingCost}
              >
                {({ id, describedBy, invalid }) => (
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-medium text-ink-muted"
                      aria-hidden="true"
                    >
                      ₹
                    </span>
                    <input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={values.manufacturingCost}
                      onChange={(event) => setValue('manufacturingCost', event.target.value)}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                      placeholder="400"
                      className={cx('field pl-8', invalid && 'field-invalid')}
                    />
                  </div>
                )}
              </FormField>

              <FormField id="currentPrice" label={t('analyze.price')} error={errors.currentPrice}>
                {({ id, describedBy, invalid }) => (
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-medium text-ink-muted"
                      aria-hidden="true"
                    >
                      ₹
                    </span>
                    <input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={values.currentPrice}
                      onChange={(event) => setValue('currentPrice', event.target.value)}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                      placeholder="800"
                      className={cx('field pl-8', invalid && 'field-invalid')}
                    />
                  </div>
                )}
              </FormField>
            </section>

            <section className="p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="figure flex h-7 w-7 items-center justify-center text-sm font-medium text-brand-700 ring-1 ring-rule">
                  3
                </span>
                <h2 className="font-display text-title font-medium text-ink">{t('analyze.platforms')}</h2>
              </div>
              <PlatformChips
                platforms={meta?.platforms ?? []}
                selected={values.platforms}
                onToggle={togglePlatform}
                error={errors.platforms}
              />

              {isMetaLoading && (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((index) => (
                    <div key={index} className="skeleton h-[74px]" />
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-col gap-3 border-t border-rule px-6 py-5 sm:flex-row sm:items-center sm:justify-end sm:px-8">
              <p className="text-xs text-ink-muted sm:mr-auto">{t('analyze.submitHint')}</p>
              <Button
                type="submit"
                size="lg"
                loading={analyzeMutation.isPending}
                disabled={insightBusy}
              >
                {t('analyze.submit')}
              </Button>
            </div>
          </div>
        </div>

        <aside className="hidden border-l border-rule pl-6 pt-1 lg:sticky lg:top-24 lg:block">
          <h2 className="kicker">{t('analyze.methodTitle')}</h2>
          <ol className="mt-4 space-y-4">
            {[t('analyze.method1'), t('analyze.method2'), t('analyze.method3'), t('analyze.method4')].map(
              (item, index) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                  <span className="figure mt-0.5 w-4 shrink-0 text-[11px] text-ink">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ),
            )}
          </ol>
        </aside>
      </form>
    </div>
  );
}
