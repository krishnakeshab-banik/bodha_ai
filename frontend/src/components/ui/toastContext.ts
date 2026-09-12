import { createContext } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

export interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

/**
 * Kept in its own module so `ToastProvider.tsx` exports only a component -
 * which is what lets Vite's fast refresh work on it.
 */
export const ToastContext = createContext<ToastContextValue | null>(null);
