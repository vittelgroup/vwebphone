/// <reference types="vite/client" />
interface ImportMetaEnv extends Readonly<Record<string, string>> {
  readonly VITE_JANUS_HOST: string;
  readonly VITE_JANUS_PROTOCOL: string;
  readonly VITE_JANUS_PORT: string;
  readonly VITE_VCM_API_URL: string;
  readonly VITE_SIP_DOMAIN: string;
  readonly VITE_SIP_EXTENSION: string;
  readonly VITE_SIP_SECRET: string;
  readonly VITE_SIP_PORT: string;

  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
