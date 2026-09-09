import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../hooks/useAuth';
import type { PlatformId } from '../types';
import { formatCurrency, PLATFORM_COLORS } from '../utils/format';

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const features = [
    {
      title: t('home.feat1Title'),
      description: t('home.feat1Body'),
      icon: <path d="M3 3v18h18M7 15l3.5-4 3 3L21 6" />,
    },
    {
      title: t('home.feat2Title'),
      description: t('home.feat2Body'),
      icon: (
        <>
          <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-7.2-7.2a2 2 0 01-.6-1.4V4.5a1.5 1.5 0 011.5-1.5h7.5a2 2 0 011.4.6l7.4 7.4a2 2 0 010 2.4z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </>
      ),
    },
    {
      title: t('home.feat3Title'),
      description: t('home.feat3Body'),
      icon: <path d="M4 6h16M4 12h10M4 18h7M16.5 15.5l2 2 4-4.5" />,
    },
  ];

  const method = [
    { title: t('home.how1Title'), body: t('home.how1Body') },
    { title: t('home.how2Title'), body: t('home.how2Body') },
    { title: t('home.how3Title'), body: t('home.how3Body') },
    { title: t('home.how4Title'), body: t('home.how4Body') },
  ];

  const stats = [
    { value: '4', label: t('home.statMarkets') },
    { value: '5', label: t('home.statCats') },
    { value: '₹0', label: t('home.statLoss') },
  ];

  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="section-shell py-14 lg:py-20">
          <div className="lg:grid lg:grid-cols-12">
            <div className="animate-fade-up lg:col-span-7 lg:border-r lg:border-rule lg:pr-14">
              <p className="kicker">{t('home.badge')}</p>

              <h1 className="mt-5 font-display text-4xl font-medium leading-[1.12] text-ink sm:text-display">
                {t('home.headlineBefore')}{' '}
                <em className="not-italic text-[#0d6b4c]">{t('home.headlineAccent')}</em>{' '}
                {t('home.headlineAfter')}
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
                {t('home.subhead')}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-sm bg-[#0d6b4c] px-6 py-3.5 text-base font-medium text-white transition hover:bg-[#0a5540]"
                >
                  {t('home.ctaPrimary')}
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>

                <Link
                  to={user ? '/dashboard' : '/login'}
                  className="inline-flex items-center justify-center rounded-sm px-6 py-3.5 text-base font-medium text-ink ring-1 ring-inset ring-rule transition hover:bg-[#faf8f3]"
                >
                  {user ? t('home.ctaSecondary') : t('auth.loginLink')}
                </Link>
              </div>

              <p className="mt-8 max-w-lg text-sm leading-relaxed text-ink-muted">
                {t('home.trustLive')}
                <span className="mx-2 text-rule" aria-hidden="true">
                  ·
                </span>
                {t('home.trustFloor')}
                <span className="mx-2 text-rule" aria-hidden="true">
                  ·
                </span>
                {t('home.trustCompare')}
              </p>
            </div>

            <div
              className="mt-12 animate-fade-up lg:col-span-5 lg:mt-0 lg:pl-14"
              style={{ animationDelay: '80ms' }}
            >
              <HeroPreviewCard />
            </div>
          </div>

          <dl className="mt-14 grid grid-cols-3 divide-x divide-rule border-y border-rule">
            {stats.map((stat) => (
              <div key={stat.label} className="border-rule px-2 py-6 first:pl-0 last:pr-0 sm:px-8 sm:first:pl-0">
                <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                  {stat.label}
                </dt>
                <dd className="figure mt-2 text-3xl font-medium text-ink sm:text-4xl">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="font-display text-headline font-medium text-ink">{t('home.howTitle')}</h2>
          <p className="mt-3 text-base leading-relaxed text-ink-muted">{t('home.howLead')}</p>
        </div>

        <ol className="mt-10 divide-y divide-rule border-y border-rule">
          {method.map((item) => (
            <li key={item.title} className="grid gap-3 py-7 sm:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] sm:gap-10">
              <h3 className="font-display text-lg font-medium text-ink">{item.title}</h3>
              <p className="text-sm leading-relaxed text-ink-muted sm:text-base">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-rule bg-[#faf8f3]">
        <div className="section-shell py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-headline font-medium text-ink">{t('home.featuresTitle')}</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">{t('home.featuresLead')}</p>
          </div>

          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-rule">
            {features.map((feature) => (
              <article key={feature.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
                <svg
                  className="h-5 w-5 text-ink"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {feature.icon}
                </svg>
                <h3 className="mt-4 font-display text-title font-medium text-ink">{feature.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="font-display text-headline font-medium text-ink">{t('home.seoTitle')}</h2>
          <p className="mt-3 text-base leading-relaxed text-ink-muted">{t('home.seoLead')}</p>
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <article className="border-t border-rule pt-5">
            <h3 className="font-display text-title font-medium text-ink">{t('home.seoWhoTitle')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t('home.seoWhoBody')}</p>
          </article>
          <article className="border-t border-rule pt-5">
            <h3 className="font-display text-title font-medium text-ink">{t('home.seoWhereTitle')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t('home.seoWhereBody')}</p>
          </article>
        </div>
      </section>

      <section className="border-y border-rule bg-[#faf8f3]">
        <div className="section-shell py-16 sm:py-20">
          <h2 className="font-display text-headline font-medium text-ink">{t('home.pricingTitle')}</h2>
          <p className="mt-3 max-w-2xl text-base text-ink-muted">{t('home.pricingLead')}</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="border border-rule bg-paper p-6">
              <p className="kicker">{t('billing.freeName')}</p>
              <p className="mt-2 font-display text-2xl text-ink">{t('home.pricingFree')}</p>
              <p className="mt-2 text-sm text-ink-muted">{t('billing.freeLead')}</p>
            </div>
            <div className="border border-ink/20 bg-paper p-6">
              <p className="kicker">{t('billing.proName')}</p>
              <p className="mt-2 font-display text-2xl text-ink">{t('home.pricingPro')}</p>
              <p className="mt-2 text-sm text-ink-muted">{t('billing.proLead')}</p>
              <Link to="/pricing" className="mt-4 inline-flex text-sm font-medium text-brand-700 underline underline-offset-4">
                {t('home.pricingCta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#141814] text-[#f3efe6]">
        <div className="section-shell grid gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-brand-300">
              {t('home.guaranteeBadge')}
            </p>
            <h2 className="mt-4 font-display text-headline font-medium tracking-tight text-white">
              {t('home.guaranteeTitle')}
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-white/70">{t('home.guaranteeBody')}</p>
            <Link
              to={user ? '/analyze' : '/signup'}
              className="mt-8 inline-flex items-center gap-2 border-b border-brand-400 pb-0.5 text-sm font-medium text-white transition hover:border-white"
            >
              {t('home.guaranteeCta')}
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>

          <div className="border-t border-white/15 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">
              {t('home.floorLabel')}
            </p>
            <p className="figure mt-4 text-sm text-white/90">cost ÷ (1 − fee) + shipping</p>
            <div className="mt-6 space-y-3 text-sm">
              {[
                [t('home.floorCost'), formatCurrency(400)],
                [t('home.floorFee'), '18%'],
                [t('home.floorShip'), formatCurrency(60)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-white/65">
                  <span>{label}</span>
                  <span className="figure text-white">{value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-white/15 pt-4 text-white">
                <span>{t('home.floorNever')}</span>
                <span className="figure text-2xl font-medium text-brand-300">₹547.80</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function HeroPreviewCard() {
  const { t } = useTranslation();
  const rows: { id: PlatformId; name: string; fit: number; price: number }[] = [
    { id: 'amazon', name: 'Amazon', fit: 74.8, price: 999 },
    { id: 'flipkart', name: 'Flipkart', fit: 73.3, price: 989 },
    { id: 'snapdeal', name: 'Snapdeal', fit: 71.2, price: 949 },
    { id: 'alibaba', name: 'Alibaba', fit: 64.8, price: 640 },
  ];

  return (
    <div>
      <div className="flex items-end justify-between gap-4 border-b border-rule pb-4">
        <div>
          <p className="kicker">{t('home.previewRecommended')}</p>
          <p className="mt-2 font-display text-2xl font-medium text-ink">Amazon</p>
        </div>
        <div className="text-right">
          <p className="kicker">{t('home.previewPrice')}</p>
          <p className="figure mt-2 text-2xl font-medium text-brand-600">₹999</p>
        </div>
      </div>

      <div className="space-y-4 pt-6">
        {rows.map((row) => (
          <div key={row.id}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-ink">{row.name}</span>
              <span className="figure text-ink-muted">
                {formatCurrency(row.price)} · {row.fit}
              </span>
            </div>
            <div className="h-[3px] overflow-hidden bg-rule">
              <div
                className="h-full"
                style={{ width: row.fit + '%', backgroundColor: PLATFORM_COLORS[row.id] }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-muted">{t('home.previewNote')}</p>
    </div>
  );
}
