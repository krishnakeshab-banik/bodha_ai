import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { GoogleSignInButton, isGoogleSignInEnabled } from '../components/auth/GoogleSignInButton';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { PasswordInput } from '../components/ui/PasswordInput';
import { useAuth } from '../hooks/useAuth';
import { ApiError, api } from '../services/api';
import type { AuthUser } from '../types';

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

  function handleGoogleSuccess(user: AuthUser) {
    setError(null);
    setUser(user);
    navigate(user.onboarded ? from : '/onboarding', { replace: true });
  }

  return (
    <div className="section-shell max-w-lg py-8 sm:py-14">
      <p className="kicker">{t('auth.loginKicker')}</p>
      <h1 className="mt-2 font-display text-headline font-medium text-ink">
        {t('auth.loginTitle')}
      </h1>
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
            <PasswordInput
              id={id}
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              required
            />
          )}
        </FormField>
        <Button type="submit" size="lg" loading={busy} className="w-full">
          {t('auth.loginSubmit')}
        </Button>
      </form>

      {isGoogleSignInEnabled && (
        <>
          <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-ink-muted">
            <span className="h-px flex-1 bg-rule" aria-hidden="true" />
            {t('auth.orDivider')}
            <span className="h-px flex-1 bg-rule" aria-hidden="true" />
          </div>
          <div className="mt-6">
            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={(message) => setError(message)}
            />
          </div>
        </>
      )}

      <p className="mt-6 text-sm text-ink-muted">
        {t('auth.noAccount')}{' '}
        <Link to="/signup" className="font-medium text-brand-700 underline underline-offset-4">
          {t('auth.signupLink')}
        </Link>
      </p>
    </div>
  );
}
