import { useEffect, useRef } from 'react';

import { ApiError, api } from '../../services/api';
import type { AuthUser } from '../../types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/** Whether the Google button (and anything framing it, like an "or" divider) should render at all. */
export const isGoogleSignInEnabled = Boolean(CLIENT_ID);

interface GoogleSignInButtonProps {
  onSuccess: (user: AuthUser) => void;
  onError: (message: string) => void;
}

/**
 * Renders Google's own "Sign in with Google" button via Google Identity
 * Services (index.html loads https://accounts.google.com/gsi/client). Hidden
 * entirely when VITE_GOOGLE_CLIENT_ID isn't configured, so the rest of the
 * login/signup pages work unchanged without it.
 */
export function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keeps the effect below a one-time mount with no re-init churn, while
  // still always calling whichever onSuccess/onError the page passed most
  // recently (they're often fresh arrow functions on every render).
  const handlersRef = useRef({ onSuccess, onError });
  handlersRef.current = { onSuccess, onError };

  useEffect(() => {
    if (!CLIENT_ID) return;
    const clientId = CLIENT_ID;

    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | undefined;

    async function handleCredential(response: GoogleCredentialResponse) {
      try {
        const result = await api.loginWithGoogle(response.credential);
        handlersRef.current.onSuccess(result.user);
      } catch (err) {
        handlersRef.current.onError(
          err instanceof ApiError
            ? err.message
            : 'Could not sign in with Google. Please try again.',
        );
      }
    }

    function render() {
      if (cancelled || !window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => void handleCredential(response),
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 360,
      });
    }

    if (window.google) {
      render();
    } else {
      // index.html loads the GIS script with async/defer, so it may not have
      // run yet on mount; poll briefly rather than relying on load-event timing.
      pollId = setInterval(() => {
        if (window.google) {
          if (pollId) clearInterval(pollId);
          render();
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
    };
  }, []);

  if (!CLIENT_ID) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
