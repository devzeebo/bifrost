import type { Config } from 'vike/types';

// Opt out of pre-rendering for parameterized routes
// These pages will be resolved client-side
const config: Config = {
  prerender: false,
};

export default config;
