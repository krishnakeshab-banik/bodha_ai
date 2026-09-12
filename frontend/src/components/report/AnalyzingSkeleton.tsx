import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const STEP_INTERVAL_MS = 4500;

export function AnalyzingSkeleton() {
  const { t } = useTranslation();
  const steps = [t('analyzing.s1'), t('analyzing.s2'), t('analyzing.s3'), t('analyzing.s4')];
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    }, STEP_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="section-shell py-10 sm:py-14" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <svg
          className="h-5 w-5 animate-spin text-brand-600"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
          />
        </svg>
        <div>
          <h1 className="font-display text-title font-medium text-ink">{t('analyzing.title')}</h1>
          <p className="text-sm text-ink-muted">{steps[stepIndex]}</p>
          <p className="mt-1 text-xs text-ink-muted">{t('analyzing.hint')}</p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <div className="skeleton h-36" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton h-56" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="skeleton h-72" />
          <div className="skeleton h-72" />
        </div>
      </div>
    </div>
  );
}
