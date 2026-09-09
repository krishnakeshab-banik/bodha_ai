import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { cx } from '../../utils/format';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';

/** Persistent top navigation, collapsing to a disclosure menu on mobile. */
export function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const links = user
    ? [
        { to: '/', label: t('common.home'), end: true },
        { to: '/analyze', label: t('common.analyze'), end: false },
        { to: '/dashboard', label: t('common.dashboard'), end: false },
        { to: '/pricing', label: t('common.pricing'), end: false },
      ]
    : [
        { to: '/', label: t('common.home'), end: true },
        { to: '/pricing', label: t('common.pricing'), end: false },
      ];

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    cx(
      'shrink-0 px-2 py-2 text-sm font-medium leading-snug transition',
      isActive
        ? 'text-ink underline decoration-[#0d6b4c] decoration-2 underline-offset-8'
        : 'text-ink-muted hover:text-ink',
    );

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur-md">
      <nav className="section-shell flex min-h-16 min-w-0 items-center justify-between gap-3 py-2" aria-label="Main">
        <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label={t('nav.homeAria')}>
          <Logo className="h-8 w-8 shrink-0" />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            Bodha<span className="text-brand-600"> AI</span>
          </span>
        </Link>

        <div className="hidden min-w-0 flex-wrap items-center justify-end gap-x-1 gap-y-1 lg:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClasses}>
              {link.label}
            </NavLink>
          ))}
          <LanguageSwitcher />
          {user ? (
            <>
              <span className="ml-2 max-w-[10rem] truncate text-xs text-ink-muted">
                {user.plan === 'pro'
                  ? t('billing.proBadge')
                  : t('billing.creditsLeft', { count: user.credits.remaining ?? 0 })}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="px-2 py-2 text-sm font-medium text-ink-muted hover:text-ink"
              >
                {t('auth.logout')}
              </button>
              <Link
                to="/analyze"
                className="ml-2 rounded-sm bg-[#0d6b4c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0a5540]"
              >
                {t('common.newAnalysis')}
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="px-2 py-2 text-sm font-medium text-ink-muted hover:text-ink">
                {t('auth.loginLink')}
              </Link>
              <Link
                to="/signup"
                className="ml-2 rounded-sm bg-[#0d6b4c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0a5540]"
              >
                {t('auth.signupLink')}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="p-2 text-ink-muted hover:text-ink lg:hidden"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls="mobile-nav"
          aria-label={isOpen ? t('common.closeMenu') : t('common.openMenu')}
        >
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {isOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {isOpen && (
        <div id="mobile-nav" className="border-t border-rule bg-paper lg:hidden">
          <div className="section-shell flex flex-col gap-1 py-3">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={linkClasses}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
            <div className="px-1 py-2">
              <LanguageSwitcher compact />
            </div>
            {user ? (
              <button
                type="button"
                className="px-2 py-2 text-left text-sm font-medium text-ink-muted"
                onClick={() => {
                  setIsOpen(false);
                  void logout();
                }}
              >
                {t('auth.logout')}
              </button>
            ) : (
              <Link to="/login" className="px-2 py-2 text-sm font-medium text-ink" onClick={() => setIsOpen(false)}>
                {t('auth.loginLink')}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
