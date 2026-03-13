import type { Config } from 'vike/types';
import vikeReact from 'vike-react/config';

const config: Config = {
  extends: [vikeReact],
  ssr: false, // SPA mode - no server-side rendering
  prerender: {
    noExtraDir: true, // Generate index.html instead of index/index.html
  },
  passToClient: ['pageProps'],
};

export default config;
