import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

export function NotFoundPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="section-shell flex flex-col items-center py-24 text-center">
      <p className="figure text-6xl font-medium tracking-tight text-brand-700">404</p>
      <h1 className="mt-4 font-display text-headline font-medium tracking-tight text-ink">
        {t('notFound.title')}
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-ink-muted">{t('notFound.body')}</p>

      <div className="mt-8 flex gap-3">
        <Link to="/">
          <Button variant="secondary">{t('common.goHome')}</Button>
        </Link>
        <Link to={user ? '/analyze' : '/signup'}>
          <Button>{user ? t('notFound.analyze') : t('auth.signupLink')}</Button>
        </Link>
      </div>
    </div>
  );
}
