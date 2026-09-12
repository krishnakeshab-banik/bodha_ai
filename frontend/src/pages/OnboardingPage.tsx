import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { useAuth } from '../hooks/useAuth';
import { useMeta } from '../hooks/useProducts';
import { ApiError, api } from '../services/api';
import type { CategoryId } from '../types';

export function OnboardingPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { data: meta } = useMeta();
  const [storeName, setStoreName] = useState(user?.storeName ?? '');
  const [storeCity, setStoreCity] = useState(user?.storeCity ?? '');
  const [storeCategory, setStoreCategory] = useState(user?.storeCategory ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user?.onboarded) {
    return <Navigate to="/analyze" replace />;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.completeOnboarding({
        storeName: storeName.trim(),
        storeCity: storeCity.trim(),
        storeCategory,
      });
      setUser(result.user);
      navigate('/analyze', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('onboarding.fail'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section-shell max-w-lg py-10 sm:py-14">
      <p className="kicker">{t('onboarding.kicker')}</p>
      <h1 className="mt-2 font-display text-headline font-medium leading-tight text-ink">
        {t('onboarding.title')}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t('onboarding.lead')}</p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-5">
        <FormField id="storeName" label={t('onboarding.storeName')} error={error ?? undefined}>
          {({ id }) => (
            <input
              id={id}
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              className="field"
              autoComplete="organization"
              required
              minLength={2}
            />
          )}
        </FormField>
        <FormField id="storeCity" label={t('onboarding.storeCity')}>
          {({ id }) => (
            <input
              id={id}
              value={storeCity}
              onChange={(event) => setStoreCity(event.target.value)}
              className="field"
              autoComplete="address-level2"
              required
              minLength={2}
            />
          )}
        </FormField>
        <FormField id="storeCategory" label={t('onboarding.storeCategory')}>
          {({ id }) => (
            <select
              id={id}
              value={storeCategory}
              onChange={(event) => setStoreCategory(event.target.value)}
              className="field"
              required
            >
              <option value="">{t('analyze.selectCategory')}</option>
              {meta?.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {t('categories.' + (category.id as CategoryId), { defaultValue: category.label })}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <Button type="submit" size="lg" loading={busy} className="w-full">
          {t('onboarding.submit')}
        </Button>
      </form>
    </div>
  );
}
