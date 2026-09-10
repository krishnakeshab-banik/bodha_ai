import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { cx } from '../../utils/format';

function HomeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 11.5L12 5l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-8.5z" />
    </svg>
  );
}

function AnalyzeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 5h7v7H4V5zM13 5h7v4h-7V5zM13 12h7v7h-7v-7zM4 15h7v4H4v-4z" />
    </svg>
  );
}

function PricingIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.2 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19c1.4-3.2 3.8-4.8 7-4.8S17.6 15.8 19 19" />
    </svg>
  );
}

/** Phone-only tab bar. Desktop keeps the top navbar. */
export function BottomNav() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const tabs = user
    ? [
        { to: '/', label: t('common.home'), end: true, icon: <HomeIcon /> },
        { to: '/analyze', label: t('common.analyze'), end: false, icon: <AnalyzeIcon /> },
        { to: '/dashboard', label: t('common.dashboard'), end: false, icon: <DashboardIcon /> },
        { to: '/pricing', label: t('common.pricing'), end: false, icon: <PricingIcon /> },
      ]
    : [
        { to: '/', label: t('common.home'), end: true, icon: <HomeIcon /> },
        { to: '/pricing', label: t('common.pricing'), end: false, icon: <PricingIcon /> },
        { to: '/login', label: t('auth.loginLink'), end: false, icon: <AccountIcon /> },
      ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'var(--sab)' }}
      aria-label="Primary"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cx(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium leading-tight',
                  isActive ? 'text-brand-700' : 'text-ink-muted',
                )
              }
            >
              {tab.icon}
              <span className="max-w-full truncate">{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
