import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { useAuth } from '../hooks/useAuth';
import { ApiError, api } from '../services/api';

export function SignupPage() {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.signup({ name, email, password });
      setUser(result.user);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.signupFail'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section-shell max-w-lg py-14">
      <p className="kicker">{t('auth.signupKicker')}</p>
      <h1 className="mt-2 font-display text-headline font-medium text-ink">{t('auth.signupTitle')}</h1>
      <p className="mt-3 text-sm text-ink-muted">{t('auth.signupLead')}</p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-5">
        <FormField id="name" label={t('auth.name')} error={error ?? undefined}>
          {({ id }) => (
            <input
              id={id}
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field"
              required
            />
          )}
        </FormField>
        <FormField id="email" label={t('auth.email')}>
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
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field"
              required
            />
          )}
        </FormField>
        <Button type="submit" size="lg" loading={busy} className="w-full">
          {t('auth.signupSubmit')}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        {t('auth.hasAccount')}{' '}
        <Link to="/login" className="font-medium text-brand-700 underline underline-offset-4">
          {t('auth.loginLink')}
        </Link>
      </p>
    </div>
  );
}
