import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { ToastContext } from './toastContext';
import type { Toast, ToastContextValue, ToastTone } from './toastContext';
import { cx } from '../../utils/format';

const AUTO_DISMISS_MS = 5000;

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-profit-200 bg-profit-50 text-profit-700',
  error: 'border-danger-500/30 bg-danger-50 text-danger-700',
  info: 'border-brand-200 bg-brand-50 text-brand-700',
};

const TONE_ICONS: Record<ToastTone, string> = {
  success: 'M4.5 12.75l6 6 9-13.5',
  error:
    'M12 9v3.75m0 3.75h.008M10.34 3.94l-8.02 13.9A1.5 1.5 0 003.62 20h16.76a1.5 1.5 0 001.3-2.16l-8.02-13.9a1.5 1.5 0 00-2.6 0z',
  info: 'M11.25 11.25h1.5v5.25h-1.5zM12 7.5h.008v.008H12z',
};

/**
 * App-wide snackbar notifications.
 *
 * Rendered in an `aria-live` region so screen readers announce results without
 * moving focus away from whatever the seller is doing.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current;
      nextId.current += 1;

      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
        role="region"
        aria-label="Notifications"
      >
        <div aria-live="polite" aria-atomic="false" className="contents">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={cx(
                'pointer-events-auto flex w-full max-w-sm animate-slide-in items-start gap-3 rounded-sm border px-4 py-3',
                TONE_STYLES[toast.tone],
              )}
            >
              <svg
                className="mt-0.5 h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={TONE_ICONS[toast.tone]} />
              </svg>

              <p className="flex-1 text-sm font-medium">{toast.message}</p>

              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-md p-0.5 opacity-60 transition hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
