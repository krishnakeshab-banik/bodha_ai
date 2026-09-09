import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { Logo } from './Logo';

export function Footer() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <footer className="mt-20 border-t border-rule bg-paper">
      <div className="section-shell flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-display text-base font-semibold tracking-tight text-ink">
              Bodha<span className="text-brand-600"> AI</span>
            </span>
          </div>
          <p className="text-sm leading-relaxed text-ink-muted">{t('footer.blurb')}</p>
        </div>

        <nav aria-label="Footer" className="flex gap-12">
          <div className="space-y-2.5">
            <h2 className="kicker">
              {t('footer.product')}
            </h2>
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>
                <Link to="/" className="rounded transition hover:text-brand-700">
                  {t('common.home')}
                </Link>
              </li>
              {user && (
                <>
                  <li>
                    <Link to="/analyze" className="rounded transition hover:text-brand-700">
                      {t('common.analyze')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/dashboard" className="rounded transition hover:text-brand-700">
                      {t('common.dashboard')}
                    </Link>
                  </li>
                </>
              )}
              <li>
                <Link to="/pricing" className="rounded transition hover:text-brand-700">
                  {t('common.pricing')}
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h2 className="kicker">
              {t('footer.marketplaces')}
            </h2>
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>Amazon</li>
              <li>Flipkart</li>
              <li>Snapdeal</li>
              <li>Alibaba</li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="border-t border-rule">
        <div className="section-shell flex flex-col gap-1.5 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
          <p>{t('footer.dataNote')}</p>
        </div>
      </div>
    </footer>
  );
}
