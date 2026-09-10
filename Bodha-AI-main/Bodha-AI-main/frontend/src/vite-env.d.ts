/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the Bodha AI API. Empty in dev so the Vite proxy handles it. */
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ELEVENLABS_AGENT_ID?: string;
  readonly VITE_ELEVENLABS_BRANCH_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
