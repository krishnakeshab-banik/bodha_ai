import { useTranslation } from 'react-i18next';

import type { ReportSectionId } from '../../utils/insights';
import { REPORT_SECTIONS } from '../../utils/insights';
import { cx } from '../../utils/format';

interface ReportSectionNavProps {
  active: ReportSectionId;
  onChange: (section: ReportSectionId) => void;
}

export function ReportSectionNav({ active, onChange }: ReportSectionNavProps) {
  const { t } = useTranslation();

  return (
    <>
      <label className="block lg:hidden">
        <span className="sr-only">{t('report.sectionNav')}</span>
        <select
          value={active}
          onChange={(event) => onChange(event.target.value as ReportSectionId)}
          className="field"
        >
          {REPORT_SECTIONS.map((section) => (
            <option key={section} value={section}>
              {t('report.sections.' + section)}
            </option>
          ))}
        </select>
      </label>

      <nav className="hidden lg:block" aria-label={t('report.sectionNav')}>
        <p className="kicker">{t('report.sectionNav')}</p>
        <ul className="mt-4 space-y-1">
          {REPORT_SECTIONS.map((section, index) => (
            <li key={section}>
              <button
                type="button"
                onClick={() => onChange(section)}
                className={cx(
                  'flex w-full items-baseline gap-3 px-0 py-2 text-left text-sm transition',
                  active === section
                    ? 'font-medium text-ink underline decoration-[#0d6b4c] decoration-2 underline-offset-4'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                <span className="figure w-4 text-[11px] text-ink">{index + 1}</span>
                {t('report.sections.' + section)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
