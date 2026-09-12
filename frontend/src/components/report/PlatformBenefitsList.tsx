import { useTranslation } from 'react-i18next';

interface PlatformBenefitsListProps {
  name: string;
  benefits: string[];
}

export function PlatformBenefitsList({ name, benefits }: PlatformBenefitsListProps) {
  const { t } = useTranslation();

  if (benefits.length === 0) return null;

  return (
    <section className="border-t border-rule pt-6">
      <h2 className="font-display text-title font-medium text-ink">
        {t('report.benefitsTitle', { name })}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{t('report.benefitsLead')}</p>
      <ul className="mt-4 space-y-2">
        {benefits.map((benefit) => (
          <li key={benefit} className="flex gap-2 text-sm text-ink">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#0d6b4c]" aria-hidden="true" />
            {benefit}
          </li>
        ))}
      </ul>
    </section>
  );
}
