import { useContext } from 'react';

import { ToastContext } from '../components/ui/toastContext';
import type { ToastContextValue } from '../components/ui/toastContext';

/** Access the app-wide snackbar. Must be used under a <ToastProvider>. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
