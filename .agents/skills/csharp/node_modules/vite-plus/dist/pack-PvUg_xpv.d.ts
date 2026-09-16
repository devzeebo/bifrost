import { UserConfig } from "@voidzero-dev/vite-plus-core/pack";
//#region src/pack.d.ts
interface PackUserConfig extends UserConfig {
  /**
   * When loading env variables from `envFile`, only include variables with these prefixes.
   * @default ['VITE_PACK_', 'TSDOWN_']
   */
  envPrefix?: string | string[];
}
//#endregion
export { PackUserConfig as t };