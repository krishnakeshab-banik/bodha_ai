/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the Bodha AI API. Empty in dev so the Vite proxy handles it. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
