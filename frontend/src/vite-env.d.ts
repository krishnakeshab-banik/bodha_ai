/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the Bodha AI API. Empty in dev so the Vite proxy handles it. */
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ELEVENLABS_AGENT_ID?: string;
  readonly VITE_ELEVENLABS_BRANCH_ID?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Minimal ambient types for the Google Identity Services script
 * (https://accounts.google.com/gsi/client, loaded in index.html). No
 * official/complete `@types` package exists for it, so only the surface this
 * app actually uses is declared here.
 */
interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
}

interface GoogleButtonConfiguration {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  width?: number;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: GoogleIdConfiguration) => void;
        renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void;
        prompt: () => void;
        cancel: () => void;
      };
    };
  };
}
