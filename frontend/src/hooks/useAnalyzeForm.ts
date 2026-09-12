/**
 * Form state and validation for the analyze screen.
 *
 * Validation rules deliberately mirror `backend/src/utils/validation.ts` so the
 * seller sees the same wording whichever side rejects the input.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { resolveAppLanguage } from '../i18n';
import type { AnalyzeRequest, CategoryId, PlatformId } from '../types';

export interface AnalyzeFormValues {
  title: string;
  description: string;
  category: CategoryId | '';
  manufacturingCost: string;
  currentPrice: string;
  platforms: PlatformId[];
  imageUrl: string | null;
}

export type AnalyzeFormErrors = Partial<Record<keyof AnalyzeFormValues, string>>;

export const INITIAL_VALUES: AnalyzeFormValues = {
  title: '',
  description: '',
  category: '',
  manufacturingCost: '',
  currentPrice: '',
  platforms: ['amazon', 'flipkart', 'snapdeal', 'alibaba'],
  imageUrl: null,
};

function parseMoney(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

export function validate(values: AnalyzeFormValues, t: (key: string) => string): AnalyzeFormErrors {
  const errors: AnalyzeFormErrors = {};

  if (values.title.trim().length < 3) {
    errors.title = t('analyze.errors.titleMin');
  }
  if (values.description.trim().length < 10) {
    errors.description = t('analyze.errors.descMin');
  }
  if (!values.category) {
    errors.category = t('analyze.errors.category');
  }

  const cost = parseMoney(values.manufacturingCost);
  const price = parseMoney(values.currentPrice);

  if (Number.isNaN(cost)) {
    errors.manufacturingCost = t('analyze.errors.costRequired');
  } else if (cost <= 0) {
    errors.manufacturingCost = t('analyze.errors.costPositive');
  }

  if (Number.isNaN(price)) {
    errors.currentPrice = t('analyze.errors.priceRequired');
  } else if (price <= 0) {
    errors.currentPrice = t('analyze.errors.pricePositive');
  }

  if (!errors.manufacturingCost && !errors.currentPrice && cost >= price) {
    errors.manufacturingCost = t('analyze.errors.costBelowPrice');
  }

  if (values.platforms.length === 0) {
    errors.platforms = t('analyze.errors.platforms');
  }

  return errors;
}

export function useAnalyzeForm() {
  const { t, i18n } = useTranslation();
  const [values, setValues] = useState<AnalyzeFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<AnalyzeFormErrors>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (hasSubmitted) setErrors(validate(values, t));
    // Re-run labels when the site language changes after a failed submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, t]);

  const setValue = useCallback(
    <K extends keyof AnalyzeFormValues>(key: K, value: AnalyzeFormValues[K]) => {
      setValues((current) => {
        const next = { ...current, [key]: value };
        if (hasSubmitted) setErrors(validate(next, t));
        return next;
      });
    },
    [hasSubmitted, t],
  );

  const togglePlatform = useCallback(
    (platform: PlatformId) => {
      setValues((current) => {
        const platforms = current.platforms.includes(platform)
          ? current.platforms.filter((id) => id !== platform)
          : [...current.platforms, platform];

        const next = { ...current, platforms };
        if (hasSubmitted) setErrors(validate(next, t));
        return next;
      });
    },
    [hasSubmitted, t],
  );

  const submit = useCallback((): AnalyzeRequest | null => {
    setHasSubmitted(true);
    const nextErrors = validate(values, t);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return null;

    return {
      title: values.title.trim(),
      description: values.description.trim(),
      category: values.category as CategoryId,
      imageUrl: values.imageUrl,
      manufacturingCost: Number(values.manufacturingCost),
      currentPrice: Number(values.currentPrice),
      platforms: values.platforms,
      language: resolveAppLanguage(i18n.resolvedLanguage ?? i18n.language),
    };
  }, [i18n.language, i18n.resolvedLanguage, t, values]);

  const reset = useCallback(() => {
    setValues(INITIAL_VALUES);
    setErrors({});
    setHasSubmitted(false);
  }, []);

  return { values, errors, setValue, togglePlatform, submit, reset };
}
