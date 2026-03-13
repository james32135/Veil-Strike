/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PROGRAM_ID: string;
  readonly VITE_NETWORK: string;
  readonly VITE_ALEO_ENDPOINT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
