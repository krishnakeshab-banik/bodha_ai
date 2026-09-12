import { useTranslation } from 'react-i18next';

import { useMeta } from '../../hooks/useProducts';
import type { PlatformId } from '../../types';

interface PlatformProfilesProps {
  platforms: PlatformId[];
}

/** Static qualitative profiles from GET /api/meta — not scored into price. */
export function PlatformProfiles({ platforms }: PlatformProfilesProps) {
  const { t } = useTranslation();
  const { data: meta } = useMeta();

  const rows = (meta?.platforms ?? []).filter(
    (platform) => platforms.includes(platform.id) && (platform.benefits?.length ?? 0) > 0,
  );

  if (rows.length === 0) return null;

  return (
    <section className="border-t border-rule pt-8" aria-labelledby="profiles-heading">
      <h2 id="profiles-heading" className="font-display text-title font-medium text-ink">
        {t('report.profilesTitle')}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">{t('report.profilesLead')}</p>

      <ul className="mt-6 grid gap-6 sm:grid-cols-2">
        {rows.map((platform) => (
          <li key={platform.id} className="border-t border-rule pt-4">
            <h3 className="font-display text-base font-medium text-ink">{platform.name}</h3>
            <ul className="mt-3 space-y-2">
              {(platform.benefits ?? []).map((benefit) => (
                <li key={benefit} className="flex gap-2 text-sm text-ink">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#0d6b4c]" aria-hidden="true" />
                  {benefit}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
