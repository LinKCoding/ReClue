/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the ReClue Node API (no trailing slash). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
