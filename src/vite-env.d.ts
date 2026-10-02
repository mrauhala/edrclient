/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CARTO_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface RuntimeConfig {
  readonly VITE_CARTO_API_KEY?: string;
}

interface Window {
  __RUNTIME_CONFIG__?: RuntimeConfig;
}
