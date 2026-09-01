interface ImportMetaEnv {
  readonly VITE_UI_WS_URL?: string;
  readonly VITE_UI_FIXTURES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css" {}
