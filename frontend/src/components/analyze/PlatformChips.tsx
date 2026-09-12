import { useTranslation } from 'react-i18next';

import type { PlatformId, PlatformMeta } from '../../types';
import { cx, formatPercent } from '../../utils/format';

interface PlatformChipsProps {
  platforms: PlatformMeta[];
  selected: PlatformId[];
  onToggle: (platform: PlatformId) => void;
  error?: string;
}

/** Multi-select marketplace chips, exposed as an accessible checkbox group. */
export function PlatformChips({ platforms, selected, onToggle, error }: PlatformChipsProps) {
  const { t } = useTranslation();

  return (
    <fieldset>
      <legend className="sr-only">{t('analyze.platforms')}</legend>
      <p className="mb-3 text-xs text-ink-muted">{t('analyze.platformsHint')}</p>

      <div className="grid gap-0 border-t border-rule sm:grid-cols-2 sm:gap-x-6">
        {platforms.map((platform) => {
          const isSelected = selected.includes(platform.id);

          return (
            <label
              key={platform.id}
              className={cx(
                'group relative flex cursor-pointer items-start gap-3 border-b border-rule py-3.5 transition',
                isSelected ? 'bg-brand-50/40' : 'hover:bg-[#faf8f3]',
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(platform.id)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-rule text-brand-600 focus:ring-brand-600"
              />

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span
                    className="h-2 w-2 shrink-0 self-center"
                    style={{ backgroundColor: platform.accentColor }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-ink">{platform.name}</span>
                  <span className="figure text-[11px] text-ink-muted">
                    {t('analyze.fee', { percent: formatPercent(platform.feePercent, 1) })}
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                  {platform.tagline}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
