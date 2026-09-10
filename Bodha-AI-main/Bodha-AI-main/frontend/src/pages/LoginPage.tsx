import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { useAuth } from '../hooks/useAuth';
import { ApiError, api } from '../services/api';

export function LoginPage() {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/analyze';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login({ email, password });
      setUser(result.user);
      navigate(result.user.onboarded ? from : '/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.loginFail'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section-shell max-w-lg py-8 sm:py-14">
      <p className="kicker">{t('auth.loginKicker')}</p>
      <h1 className="mt-2 font-display text-headline font-medium text-ink">{t('auth.loginTitle')}</h1>
      <p className="mt-3 text-sm text-ink-muted">{t('auth.loginLead')}</p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-5">
        <FormField id="email" label={t('auth.email')} error={error ?? undefined}>
          {({ id }) => (
            <input
              id={id}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field"
              required
            />
          )}
        </FormField>
        <FormField id="password" label={t('auth.password')}>
          {({ id }) => (
            <input
              id={id}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field"
              required
            />
          )}
        </FormField>
        <Button type="submit" size="lg" loading={busy} className="w-full">
          {t('auth.loginSubmit')}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        {t('auth.noAccount')}{' '}
        <Link to="/signup" className="font-medium text-brand-700 underline underline-offset-4">
          {t('auth.signupLink')}
        </Link>
      </p>
    </div>
  );
}
