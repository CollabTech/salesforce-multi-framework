/// <reference types="vite/client" />

/** Salesforce API version injected at build time by the Vite define plugin. */
declare const __SF_API_VERSION__: string;

interface ImportMetaEnv {
  /** Git commit injected at build time (VITE_BUILD_COMMIT=$(git rev-parse --short HEAD) npm run build). */
  readonly VITE_BUILD_COMMIT?: string;
}
