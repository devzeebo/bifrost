import type { Config } from 'vike/types';
import vikeReact from 'vike-react/config';

const config: Config = {
  extends: [vikeReact],
  ssr: true,
  passToClient: ['pageProps'],
};

export default config;
