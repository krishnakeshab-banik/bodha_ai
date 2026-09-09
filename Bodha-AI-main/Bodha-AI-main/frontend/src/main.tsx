import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { ToastProvider } from './components/ui/ToastProvider';
import { AuthProvider } from './hooks/useAuth';
import './i18n';
import './index.css';

function lockPageChrome() {
  const block = (event: DragEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-dropzone]')) return;
    event.preventDefault();
  };
  window.addEventListener('dragover', block);
  window.addEventListener('drop', block);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Analyses are immutable once written, so aggressive refetching is waste.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

lockPageChrome();

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
