import { useTranslation } from 'react-i18next';

import type { OptimizedListing } from '../../types';
import { CopyButton } from '../ui/CopyButton';

interface OptimizedListingPanelProps {
  listing: OptimizedListing;
  complaints?: string[];
}

/** Marketplace-ready copy, each block independently copyable. */
export function OptimizedListingPanel({ listing, complaints = [] }: OptimizedListingPanelProps) {
  const { t } = useTranslation();
  return (
    <section className="border-t border-rule pt-8" aria-labelledby="listing-heading">
      <div className="flex items-start gap-3">
        <div>
          <h2 id="listing-heading" className="font-display text-title font-medium text-ink">
            {t('report.listingTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t('report.listingLead')}</p>
        </div>
      </div>

      {complaints.length > 0 && (
        <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-muted">
          {t('report.listingComplaints')} {complaints.join(' · ')}
        </p>
      )}

      <div className="mt-6 space-y-5">
        <ListingBlock label={t('report.listingTitleLabel')} copyValue={listing.title}>
          <p className="text-sm font-medium leading-relaxed text-ink">{listing.title}</p>
        </ListingBlock>

        <ListingBlock label={t('report.listingDescLabel')} copyValue={listing.description}>
          <div className="space-y-2.5">
            {listing.description.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-sm leading-relaxed text-ink-muted">
                {paragraph}
              </p>
            ))}
          </div>
        </ListingBlock>

        <ListingBlock label={t('report.listingKwLabel')} copyValue={listing.keywords.join(', ')}>
          <p className="text-sm leading-relaxed text-ink">
            {listing.keywords.join(' · ')}
          </p>
        </ListingBlock>
      </div>
    </section>
  );
}

function ListingBlock({
  label,
  copyValue,
  children,
}: {
  label: string;
  copyValue: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-rule pt-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">{label}</h3>
        <CopyButton value={copyValue} label={label} />
      </div>
      {children}
    </div>
  );
}
