import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { ApiError, api } from '../services/api';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

async function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay'));
    document.body.appendChild(script);
  });
}

export function PricingPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function subscribe() {
    if (!user) return;
    setBusy(true);
    try {
      const order = await api.createBillingOrder();
      if (order.mock) {
        const result = await api.verifyPayment({
          razorpay_order_id: order.orderId,
          razorpay_payment_id: 'pay_dev',
          razorpay_signature: 'dev',
        });
        setUser(result.user);
        showToast(t('billing.success'), 'success');
        return;
      }

      await loadRazorpay();
      const RazorpayCheckout = window.Razorpay;
      if (!RazorpayCheckout) throw new Error('Razorpay unavailable');

      await new Promise<void>((resolve, reject) => {
        const checkout = new RazorpayCheckout({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'Bodha AI',
          description: t('billing.proName'),
          order_id: order.orderId,
          prefill: { email: user.email, name: user.displayName },
          theme: { color: '#0d6b4c' },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const result = await api.verifyPayment(response);
              setUser(result.user);
              showToast(t('billing.success'), 'success');
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          modal: { ondismiss: () => resolve() },
        });
        checkout.open();
      });
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t('billing.fail'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section-shell py-8 sm:py-14">
      <p className="kicker">{t('billing.kicker')}</p>
      <h1 className="mt-2 max-w-2xl font-display text-headline font-medium text-ink">
        {t('billing.title')}
      </h1>
      <p className="mt-3 max-w-2xl text-base text-ink-muted">{t('billing.lead')}</p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <article className="border border-rule p-6">
          <h2 className="font-display text-title font-medium text-ink">{t('billing.freeName')}</h2>
          <p className="figure mt-2 text-3xl text-ink">$0</p>
          <p className="mt-2 text-sm text-ink-muted">{t('billing.freeLead')}</p>
          <ul className="mt-4 space-y-2 text-sm text-ink">
            <li>{t('billing.free1')}</li>
            <li>{t('billing.free2')}</li>
            <li>{t('billing.free3')}</li>
          </ul>
        </article>

        <article className="border border-ink/20 bg-[#faf8f3] p-6">
          <h2 className="font-display text-title font-medium text-ink">{t('billing.proName')}</h2>
          <p className="figure mt-2 text-3xl text-ink">
            $10<span className="text-base text-ink-muted">/{t('billing.month')}</span>
          </p>
          <p className="mt-2 text-sm text-ink-muted">{t('billing.proLead')}</p>
          <ul className="mt-4 space-y-2 text-sm text-ink">
            <li>{t('billing.pro1')}</li>
            <li>{t('billing.pro2')}</li>
            <li>{t('billing.pro3')}</li>
          </ul>
          {user ? (
            user.plan === 'pro' ? (
              <p className="mt-6 text-sm font-medium text-brand-700">{t('billing.alreadyPro')}</p>
            ) : (
              <Button className="mt-6" size="lg" loading={busy} onClick={() => void subscribe()}>
                {t('billing.subscribe')}
              </Button>
            )
          ) : (
            <Link to="/signup" className="mt-6 inline-flex">
              <Button size="lg">{t('auth.signupSubmit')}</Button>
            </Link>
          )}
          <p className="mt-3 text-xs text-ink-muted">{t('billing.testNote')}</p>
        </article>
      </div>
    </div>
  );
}
