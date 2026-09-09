import { useTranslation } from 'react-i18next';

import { LANGUAGE_LABELS, resolveAppLanguage, type AppLanguage } from '../../i18n';
import { cx } from '../../utils/format';

const OPTIONS: AppLanguage[] = ['en', 'hi', 'ta'];

/** Navbar language switcher. Choice persists in localStorage via i18next. */
export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const current = resolveAppLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <label className={cx('flex items-center gap-2', compact && 'w-full')}>
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={current}
        onChange={(event) => {
          void i18n.changeLanguage(event.target.value);
        }}
        aria-label={t('common.language')}
        className={cx(
          'rounded-sm border border-rule bg-[#faf8f3] px-2.5 py-1.5 text-sm font-medium text-ink',
          'hover:border-ink/30',
          compact && 'w-full',
        )}
      >
        {OPTIONS.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
