import * as Rolldown from "@voidzero-dev/vite-plus-core/rolldown";
import { BuildOptions, ChecksOptions, ExternalOption, InputOptions, InternalModuleFormat, MinifyOptions, ModuleFormat, ModuleTypes, OutputAsset, OutputChunk, OutputOptions, Plugin, RolldownPlugin, TreeshakingOptions } from "@voidzero-dev/vite-plus-core/rolldown";
import { StartOptions } from "@vitejs/devtools/cli-commands";
import { CheckPackageOptions } from "@arethetypeswrong/core";
import { Options } from "publint";
import { TransformOptions } from "lightningcss";
import { FileExtensionInfo } from "typescript";
import { IsolatedDeclarationsOptions } from "@voidzero-dev/vite-plus-core/rolldown/experimental";
import { Options as UnusedOptions } from "unplugin-unused";
//#region ../../node_modules/.pnpm/hookable@6.1.1/node_modules/hookable/dist/index.d.mts
type HookCallback = (...arguments_: any) => Promise<void> | void;
type HookKeys<T> = keyof T & string;
type DeprecatedHook<T> = {
  message?: string;
  to: HookKeys<T>;
};
type ValueOf<C> = C extends Record<any, any> ? C[keyof C] : never;
type Strings<T> = Exclude<keyof T, number | symbol>;
type KnownKeys<T> = keyof { [K in keyof T as string extends K ? never : number extends K ? never : K]: never; };
type StripGeneric<T> = Pick<T, KnownKeys<T> extends keyof T ? KnownKeys<T> : never>;
type OnlyGeneric<T> = Omit<T, KnownKeys<T> extends keyof T ? KnownKeys<T> : never>;
type Namespaces<T> = ValueOf<{ [key in Strings<T>]: key extends `${infer Namespace}:${string}` ? Namespace : never; }>;
type BareHooks<T> = ValueOf<{ [key in Strings<T>]: key extends `${string}:${string}` ? never : key; }>;
type HooksInNamespace<T, Namespace extends string> = ValueOf<{ [key in Strings<T>]: key extends `${Namespace}:${infer HookName}` ? HookName : never; }>;
type WithoutNamespace<T, Namespace extends string> = { [key in HooksInNamespace<T, Namespace>]: `${Namespace}:${key}` extends keyof T ? T[`${Namespace}:${key}`] : never; };
type NestedHooks<T> = (Partial<StripGeneric<T>> | Partial<OnlyGeneric<T>>) & Partial<{ [key in Namespaces<StripGeneric<T>>]: NestedHooks<WithoutNamespace<T, key>>; }> & Partial<{ [key in BareHooks<StripGeneric<T>>]: T[key]; }>;
type InferCallback<HT, HN extends keyof HT> = HT[HN] extends HookCallback ? HT[HN] : never;
type InferSpyEvent<HT extends Record<string, any>> = { [key in keyof HT]: {
  name: key;
  args: Parameters<HT[key]>;
  context: Record<string, any>;
}; }[keyof HT];
declare class Hookable<HooksT extends Record<string, any> = Record<string, HookCallback>, HookNameT extends HookKeys<HooksT> = HookKeys<HooksT>> {
  private _hooks;
  private _before?;
  private _after?;
  private _deprecatedHooks;
  private _deprecatedMessages?;
  constructor();
  hook<NameT extends HookNameT>(name: NameT, function_: InferCallback<HooksT, NameT>, options?: {
    allowDeprecated?: boolean;
  }): () => void;
  hookOnce<NameT extends HookNameT>(name: NameT, function_: InferCallback<HooksT, NameT>): () => void;
  removeHook<NameT extends HookNameT>(name: NameT, function_: InferCallback<HooksT, NameT>): void;
  clearHook<NameT extends HookNameT>(name: NameT): void;
  deprecateHook<NameT extends HookNameT>(name: NameT, deprecated: HookKeys<HooksT> | DeprecatedHook<HooksT>): void;
  deprecateHooks(deprecatedHooks: Partial<Record<HookNameT, DeprecatedHook<HooksT>>>): void;
  addHooks(configHooks: NestedHooks<HooksT>): () => void;
  removeHooks(configHooks: NestedHooks<HooksT>): void;
  removeAllHooks(): void;
  callHook<NameT extends HookNameT>(name: NameT, ...args: Parameters<InferCallback<HooksT, NameT>>): Promise<any> | void;
  callHookParallel<NameT extends HookNameT>(name: NameT, ...args: Parameters<InferCallback<HooksT, NameT>>): Promise<any[]> | void;
  callHookWith<NameT extends HookNameT, CallFunction extends (hooks: HookCallback[], args: Parameters<InferCallback<HooksT, NameT>>, name: NameT) => any>(caller: CallFunction, name: NameT, args: Parameters<InferCallback<HooksT, NameT>>): ReturnType<CallFunction>;
  beforeEach(function_: (event: InferSpyEvent<HooksT>) => void): () => void;
  afterEach(function_: (event: InferSpyEvent<HooksT>) => void): () => void;
}
type CreateTask = (name?: string) => {
  run: (function_: () => Promise<any> | any) => Promise<any> | any;
};
declare global {
  interface Console {
    createTask?: CreateTask;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@tsdown+exe@0.22.14_tsdown@0.22.14/node_modules/@tsdown/exe/dist/index.d.mts
//#region src/platform.d.ts
type ExePlatform = "win" | "darwin" | "linux";
type ExeArch = "x64" | "arm64";
interface ExeTarget {
  platform: ExePlatform;
  arch: ExeArch;
  /**
   * Node.js version to use for the executable.
   *
   * Accepts a valid semver string (e.g., `"25.7.0"`), or the special values
   * `"latest"` / `"latest-lts"` which resolve the version automatically from
   * {@link https://nodejs.org/dist/index.json}.
   *
   * The minimum required version is 25.7.0, which is when ESM entry point
   * support was added to Node.js SEA.
   */
  nodeVersion: (string & {}) | "latest" | "latest-lts" | `${string}.${string}.${string}`;
}
interface ExeExtensionOptions {
  /**
   * Cross-platform targets for building executables.
   * Requires `@tsdown/exe` to be installed.
   * When specified, builds an executable for each target platform/arch combination.
   *
   * @example
   * ```ts
   * targets: [
   *   { platform: 'linux', arch: 'x64', nodeVersion: '25.7.0' },
   *   { platform: 'darwin', arch: 'arm64', nodeVersion: '25.7.0' },
   *   { platform: 'win', arch: 'x64', nodeVersion: '25.7.0' },
   * ]
   * ```
   */
  targets?: ExeTarget[];
  getDownloadUrl?: (target: ExeTarget) => string | Promise<string>;
  /**
   * @default 'https://nodejs.org/dist/index.json'
   */
  nodeDistIndexUrl?: string;
}
//#endregion
//#region ../../node_modules/.pnpm/@tsdown+css@0.22.14_jiti@2.7.0_postcss-import@16.2.0_postcss@8.5.26__postcss@8.5.26_sas_b5ecbe85e36c638c226bc310ff1da39e/node_modules/@tsdown/css/dist/index.d.mts
//#region src/options.d.ts
type LightningCSSOptions = Omit<TransformOptions<any>, "filename" | "code">;
interface CSSModulesOptions {
  /**
   * Controls the scoping behavior.
   * @default 'local'
   */
  scopeBehaviour?: "global" | "local";
  /**
   * File paths matching these patterns will use global scoping.
   */
  globalModulePaths?: RegExp[];
  /**
   * Pattern or function to generate scoped class names.
   * When using `transformer: 'lightningcss'`, only string patterns are supported.
   */
  generateScopedName?: string | ((name: string, filename: string, css: string) => string);
  /**
   * Prefix added to hashes when generating scoped names.
   */
  hashPrefix?: string;
  /**
   * Transform convention for exported class names.
   */
  localsConvention?: "camelCase" | "camelCaseOnly" | "dashes" | "dashesOnly";
  /**
   * Whether to include global class names in the export.
   */
  exportGlobals?: boolean;
  /**
   * Callback to receive the generated class name mappings.
   */
  getJSON?: (cssFileName: string, json: Record<string, string>, outputFileName: string) => void;
}
interface CssOptions {
  /**
   * Enable/disable CSS code splitting.
   * When set to `false`, all CSS in the entire project will be extracted into
   * a single CSS file named by {@linkcode fileName}.
   * When set to `true`, CSS imported in async JS chunks will be preserved as chunks.
   *
   * Defaults to `false`, but if `unbundle` is `true`, it defaults to `true` to preserve chunk splitting.
   */
  splitting?: boolean;
  /**
   * Specify the name of the CSS file generated when {@linkcode splitting} is
   * `false`.
   *
   * @default 'style.css'
   */
  fileName?: string;
  /**
   * Set the target environment for CSS syntax lowering.
   * Accepts esbuild-style target strings (e.g., `'chrome99'`, `'safari16.2'`).
   * Defaults to the top-level `target` option.
   *
   * @see https://vite.dev/config/build-options#build-csstarget
   * @default tsdownConfig.target
   */
  target?: string | string[] | false;
  /**
   * Options for CSS preprocessors (Sass/Less/Stylus).
   *
   * In addition to options specific to each processor, `additionalData` option
   * can be used to inject extra code for each style content.
   */
  preprocessorOptions?: PreprocessorOptions;
  /**
   * Enable/disable CSS minification.
   *
   * @default false
   */
  minify?: boolean;
  /**
   * Lightning CSS options for CSS syntax lowering and transformations.
   */
  lightningcss?: LightningCSSOptions;
  /**
   * PostCSS configuration.
   *
   * - `string`: Path to the directory to search for PostCSS config files.
   * - `object`: Inline PostCSS options with optional `plugins` array.
   * - Omitted: Auto-detect PostCSS config from the project root.
   *
   * Only used when {@linkcode transformer} is `'postcss'`.
   * Requires `postcss` to be installed.
   *
   * @see https://github.com/postcss/postcss
   */
  postcss?: PostCSSOptions;
  /**
   * When enabled, JS output preserves import statements pointing to emitted CSS files.
   * Consumers of the library will automatically import the CSS alongside the JS.
   *
   * @default false
   */
  inject?: boolean;
  /**
   * CSS modules configuration.
   * When not `false`, `.module.css` files (and preprocessor variants) are
   * treated as CSS modules with scoped class names.
   *
   * @see https://github.com/css-modules/css-modules
   *
   * @default {}
   */
  modules?: CSSModulesOptions | false;
  /**
   * CSS transformer to use. Controls how CSS is processed:
   *
   * - `'lightningcss'` (default): `@import` handled by Lightning CSS
   *   `bundleAsync()`, PostCSS is **not** used at all.
   * - `'postcss'`: `@import` handled by `postcss-import`,
   *   PostCSS plugins applied, Lightning CSS used only for final
   *   targets/minify transform.
   *
   * @default 'lightningcss'
   * @see https://vite.dev/config/shared-options#css-transformer
   */
  transformer?: "postcss" | "lightningcss";
}
type PostCSSOptions = string | (Record<string, any> & {
  plugins?: any[];
});
interface PreprocessorOptions {
  scss?: SassPreprocessorOptions;
  sass?: SassPreprocessorOptions;
  less?: LessPreprocessorOptions;
  styl?: StylusPreprocessorOptions;
  stylus?: StylusPreprocessorOptions;
}
type PreprocessorAdditionalDataResult = string | {
  content: string;
  map?: any;
};
type PreprocessorAdditionalData = string | ((source: string, filename: string) => PreprocessorAdditionalDataResult | Promise<PreprocessorAdditionalDataResult>);
interface SassPreprocessorOptions {
  additionalData?: PreprocessorAdditionalData;
  [key: string]: any;
}
interface LessPreprocessorOptions {
  additionalData?: PreprocessorAdditionalData;
  math?: any;
  paths?: string[];
  plugins?: any[];
  [key: string]: any;
}
interface StylusPreprocessorOptions {
  additionalData?: PreprocessorAdditionalData;
  define?: Record<string, any>;
  paths?: string[];
  [key: string]: any;
}
//#endregion
//#region ../../node_modules/.pnpm/rolldown-plugin-dts@0.27.13_@typescript+native-preview@7.0.0-dev.20260605.1_oxc-resolve_19173df252fb1b72b750fe1e656588b8/node_modules/rolldown-plugin-dts/dist/volar-Cxz5qLKE.d.mts
//#region src/volar.d.ts
interface VolarPlugin {
  extensionPatterns: RegExp[];
  tsFileExtensionInfos?: FileExtensionInfo[];
  volarTypeScript?: typeof import("@volar/typescript");
  create?: Parameters<(typeof import("@volar/typescript"))["proxyCreateProgram"]>[2];
  toTsFilename?: (id: string) => string;
}
//#endregion
//#region ../../node_modules/.pnpm/get-tsconfig@5.0.0-beta.5/node_modules/get-tsconfig/dist/index.d.mts
declare namespace TsConfigJson {
  namespace CompilerOptions {
    type JSX = 'preserve' | 'react' | 'react-jsx' | 'react-jsxdev' | 'react-native';
    type Module = 'CommonJS' | 'AMD' | 'System' | 'UMD' | 'ES6' | 'ES2015' | 'ES2020' | 'ES2022' | 'ESNext' | 'Node16' | 'Node18' | 'Node20' | 'NodeNext' | 'Preserve' | 'None' |
    // Lowercase alternatives
    'commonjs' | 'amd' | 'system' | 'umd' | 'es6' | 'es2015' | 'es2020' | 'es2022' | 'esnext' | 'node16' | 'node18' | 'node20' | 'nodenext' | 'preserve' | 'none';
    type NewLine = 'CRLF' | 'LF' |
    // Lowercase alternatives
    'crlf' | 'lf';
    type Target = 'ES3' | 'ES5' | 'ES6' | 'ES2015' | 'ES2016' | 'ES2017' | 'ES2018' | 'ES2019' | 'ES2020' | 'ES2021' | 'ES2022' | 'ES2023' | 'ES2024' | 'ESNext' |
    // Lowercase alternatives
    'es3' | 'es5' | 'es6' | 'es2015' | 'es2016' | 'es2017' | 'es2018' | 'es2019' | 'es2020' | 'es2021' | 'es2022' | 'es2023' | 'es2024' | 'esnext';
    type Lib = 'ES5' | 'ES6' | 'ES7' | 'ES2015' | 'ES2015.Collection' | 'ES2015.Core' | 'ES2015.Generator' | 'ES2015.Iterable' | 'ES2015.Promise' | 'ES2015.Proxy' | 'ES2015.Reflect' | 'ES2015.Symbol.WellKnown' | 'ES2015.Symbol' | 'ES2016' | 'ES2016.Array.Include' | 'ES2017' | 'ES2017.ArrayBuffer' | 'ES2017.Date' | 'ES2017.Intl' | 'ES2017.Object' | 'ES2017.SharedMemory' | 'ES2017.String' | 'ES2017.TypedArrays' | 'ES2018' | 'ES2018.AsyncGenerator' | 'ES2018.AsyncIterable' | 'ES2018.Intl' | 'ES2018.Promise' | 'ES2018.Regexp' | 'ES2019' | 'ES2019.Array' | 'ES2019.Intl' | 'ES2019.Object' | 'ES2019.String' | 'ES2019.Symbol' | 'ES2020' | 'ES2020.BigInt' | 'ES2020.Date' | 'ES2020.Intl' | 'ES2020.Number' | 'ES2020.Promise' | 'ES2020.SharedMemory' | 'ES2020.String' | 'ES2020.Symbol.WellKnown' | 'ES2021' | 'ES2021.Intl' | 'ES2021.Promise' | 'ES2021.String' | 'ES2021.WeakRef' | 'ES2022' | 'ES2022.Array' | 'ES2022.Error' | 'ES2022.Intl' | 'ES2022.Object' | 'ES2022.RegExp' | 'ES2022.SharedMemory' | 'ES2022.String' | 'ES2023' | 'ES2023.Array' | 'ES2023.Collection' | 'ES2023.Intl' | 'ES2024' | 'ES2024.ArrayBuffer' | 'ES2024.Collection' | 'ES2024.Object' | 'ES2024.Promise' | 'ES2024.Regexp' | 'ES2024.SharedMemory' | 'ES2024.String' | 'ESNext' | 'ESNext.Array' | 'ESNext.AsyncIterable' | 'ESNext.BigInt' | 'ESNext.Collection' | 'ESNext.Decorators' | 'ESNext.Disposable' | 'ESNext.Error' | 'ESNext.Intl' | 'ESNext.Iterator' | 'ESNext.Object' | 'ESNext.Promise' | 'ESNext.Regexp' | 'ESNext.String' | 'ESNext.Symbol' | 'ESNext.WeakRef' | 'DOM' | 'DOM.AsyncIterable' | 'DOM.Iterable' | 'Decorators' | 'Decorators.Legacy' | 'ScriptHost' | 'WebWorker' | 'WebWorker.AsyncIterable' | 'WebWorker.ImportScripts' | 'WebWorker.Iterable' |
    // Lowercase alternatives
    'es5' | 'es6' | 'es7' | 'es2015' | 'es2015.collection' | 'es2015.core' | 'es2015.generator' | 'es2015.iterable' | 'es2015.promise' | 'es2015.proxy' | 'es2015.reflect' | 'es2015.symbol.wellknown' | 'es2015.symbol' | 'es2016' | 'es2016.array.include' | 'es2017' | 'es2017.arraybuffer' | 'es2017.date' | 'es2017.intl' | 'es2017.object' | 'es2017.sharedmemory' | 'es2017.string' | 'es2017.typedarrays' | 'es2018' | 'es2018.asyncgenerator' | 'es2018.asynciterable' | 'es2018.intl' | 'es2018.promise' | 'es2018.regexp' | 'es2019' | 'es2019.array' | 'es2019.intl' | 'es2019.object' | 'es2019.string' | 'es2019.symbol' | 'es2020' | 'es2020.bigint' | 'es2020.date' | 'es2020.intl' | 'es2020.number' | 'es2020.promise' | 'es2020.sharedmemory' | 'es2020.string' | 'es2020.symbol.wellknown' | 'es2021' | 'es2021.intl' | 'es2021.promise' | 'es2021.string' | 'es2021.weakref' | 'es2022' | 'es2022.array' | 'es2022.error' | 'es2022.intl' | 'es2022.object' | 'es2022.regexp' | 'es2022.sharedmemory' | 'es2022.string' | 'es2023' | 'es2023.array' | 'es2023.collection' | 'es2023.intl' | 'es2024' | 'es2024.arraybuffer' | 'es2024.collection' | 'es2024.object' | 'es2024.promise' | 'es2024.regexp' | 'es2024.sharedmemory' | 'es2024.string' | 'esnext' | 'esnext.array' | 'esnext.asynciterable' | 'esnext.bigint' | 'esnext.collection' | 'esnext.decorators' | 'esnext.disposable' | 'esnext.error' | 'esnext.intl' | 'esnext.iterator' | 'esnext.object' | 'esnext.promise' | 'esnext.regexp' | 'esnext.string' | 'esnext.symbol' | 'esnext.weakref' | 'dom' | 'dom.asynciterable' | 'dom.iterable' | 'decorators' | 'decorators.legacy' | 'scripthost' | 'webworker' | 'webworker.asynciterable' | 'webworker.importscripts' | 'webworker.iterable';
    type Plugin = {
      /**
			Plugin name.
			*/
      name: string;
    };
    type ImportsNotUsedAsValues = 'remove' | 'preserve' | 'error';
    type FallbackPolling = 'fixedPollingInterval' | 'priorityPollingInterval' | 'dynamicPriorityPolling' | 'fixedInterval' | 'priorityInterval' | 'dynamicPriority' | 'fixedChunkSize';
    type WatchDirectory = 'useFsEvents' | 'fixedPollingInterval' | 'dynamicPriorityPolling' | 'fixedChunkSizePolling';
    type WatchFile = 'fixedPollingInterval' | 'priorityPollingInterval' | 'dynamicPriorityPolling' | 'useFsEvents' | 'useFsEventsOnParentDirectory' | 'fixedChunkSizePolling';
    type ModuleResolution = 'classic' | 'node' | 'node10' | 'node16' | 'nodenext' | 'bundler' |
    // Pascal-cased alternatives
    'Classic' | 'Node' | 'Node10' | 'Node16' | 'NodeNext' | 'Bundler';
    type ModuleDetection = 'auto' | 'legacy' | 'force';
    type IgnoreDeprecations = '5.0';
  }
  type CompilerOptions = {
    /**
		The character set of the input files.

		@default 'utf8'
		@deprecated This option will be removed in TypeScript 5.5.
		*/
    charset?: string;
    /**
		Enables building for project references.

		@default true
		*/
    composite?: boolean;
    /**
		Generates corresponding d.ts files.

		@default false
		*/
    declaration?: boolean;
    /**
		Specify output directory for generated declaration files.
		*/
    declarationDir?: string;
    /**
		Show diagnostic information.

		@default false
		*/
    diagnostics?: boolean;
    /**
		Reduce the number of projects loaded automatically by TypeScript.

		@default false
		*/
    disableReferencedProjectLoad?: boolean;
    /**
		Enforces using indexed accessors for keys declared using an indexed type.

		@default false
		*/
    noPropertyAccessFromIndexSignature?: boolean;
    /**
		Emit a UTF-8 Byte Order Mark (BOM) in the beginning of output files.

		@default false
		*/
    emitBOM?: boolean;
    /**
		Only emit `.d.ts` declaration files.

		@default false
		*/
    emitDeclarationOnly?: boolean;
    /**
		Differentiate between undefined and not present when type checking.

		@default false
		*/
    exactOptionalPropertyTypes?: boolean;
    /**
		Enable incremental compilation.

		@default `composite`
		*/
    incremental?: boolean;
    /**
		Specify file to store incremental compilation information.

		@default '.tsbuildinfo'
		*/
    tsBuildInfoFile?: string;
    /**
		Emit a single file with source maps instead of having a separate file.

		@default false
		*/
    inlineSourceMap?: boolean;
    /**
		Emit the source alongside the sourcemaps within a single file.

		Requires `--inlineSourceMap` to be set.

		@default false
		*/
    inlineSources?: boolean;
    /**
		Specify what JSX code is generated.

		@default 'preserve'
		*/
    jsx?: CompilerOptions.JSX;
    /**
		Specifies the object invoked for `createElement` and `__spread` when targeting `'react'` JSX emit.

		@default 'React'
		*/
    reactNamespace?: string;
    /**
		Specify the JSX factory function to use when targeting React JSX emit, e.g. `React.createElement` or `h`.

		@default 'React.createElement'
		*/
    jsxFactory?: string;
    /**
		Specify the JSX Fragment reference used for fragments when targeting React JSX emit e.g. 'React.Fragment' or 'Fragment'.

		@default 'React.Fragment'
		*/
    jsxFragmentFactory?: string;
    /**
		Specify module specifier used to import the JSX factory functions when using `jsx: react-jsx*`.

		@default 'react'
		*/
    jsxImportSource?: string;
    /**
		Print names of files part of the compilation.

		@default false
		*/
    listFiles?: boolean;
    /**
		Specifies the location where debugger should locate map files instead of generated locations.
		*/
    mapRoot?: string;
    /**
		Specify module code generation: 'None', 'CommonJS', 'AMD', 'System', 'UMD', 'ES6', 'ES2015' or 'ESNext'. Only 'AMD' and 'System' can be used in conjunction with `--outFile`. 'ES6' and 'ES2015' values may be used when targeting 'ES5' or lower.

		@default ['ES3', 'ES5'].includes(target) ? 'CommonJS' : 'ES6'
		*/
    module?: CompilerOptions.Module;
    /**
		Specifies module resolution strategy: 'node' (Node) or 'classic' (TypeScript pre 1.6).

		@default ['AMD', 'System', 'ES6'].includes(module) ? 'classic' : 'node'
		*/
    moduleResolution?: CompilerOptions.ModuleResolution;
    /**
		Specifies the end of line sequence to be used when emitting files: 'crlf' (Windows) or 'lf' (Unix).

		@default 'LF'
		*/
    newLine?: CompilerOptions.NewLine;
    /**
		Disable full type checking (only critical parse and emit errors will be reported).

		@default false
		*/
    noCheck?: boolean;
    /**
		Do not emit output.

		@default false
		*/
    noEmit?: boolean;
    /**
		Do not generate custom helper functions like `__extends` in compiled output.

		@default false
		*/
    noEmitHelpers?: boolean;
    /**
		Do not emit outputs if any type checking errors were reported.

		@default false
		*/
    noEmitOnError?: boolean;
    /**
		Warn on expressions and declarations with an implied 'any' type.

		@default false
		*/
    noImplicitAny?: boolean;
    /**
		Raise error on 'this' expressions with an implied any type.

		@default false
		*/
    noImplicitThis?: boolean;
    /**
		Report errors on unused locals.

		@default false
		*/
    noUnusedLocals?: boolean;
    /**
		Report errors on unused parameters.

		@default false
		*/
    noUnusedParameters?: boolean;
    /**
		Do not include the default library file (lib.d.ts).

		@default false
		*/
    noLib?: boolean;
    /**
		Do not add triple-slash references or module import targets to the list of compiled files.

		@default false
		*/
    noResolve?: boolean;
    /**
		Disable strict checking of generic signatures in function types.

		@default false
		@deprecated This option will be removed in TypeScript 5.5.
		*/
    noStrictGenericChecks?: boolean;
    /**
		@deprecated use `skipLibCheck` instead.
		*/
    skipDefaultLibCheck?: boolean;
    /**
		Skip type checking of declaration files.

		@default false
		*/
    skipLibCheck?: boolean;
    /**
		Concatenate and emit output to single file.
		*/
    outFile?: string;
    /**
		Redirect output structure to the directory.
		*/
    outDir?: string;
    /**
		Do not erase const enum declarations in generated code.

		@default false
		*/
    preserveConstEnums?: boolean;
    /**
		Do not resolve symlinks to their real path; treat a symlinked file like a real one.

		@default false
		*/
    preserveSymlinks?: boolean;
    /**
		Keep outdated console output in watch mode instead of clearing the screen.

		@default false
		*/
    preserveWatchOutput?: boolean;
    /**
		Stylize errors and messages using color and context (experimental).

		@default true // Unless piping to another program or redirecting output to a file.
		*/
    pretty?: boolean;
    /**
		Do not emit comments to output.

		@default false
		*/
    removeComments?: boolean;
    /**
		Rewrite '.ts', '.tsx', '.mts', and '.cts' file extensions in relative import paths to their JavaScript equivalent in output files.

		@default false
		*/
    rewriteRelativeImportExtensions?: boolean;
    /**
		Specifies the root directory of input files.

		Use to control the output directory structure with `--outDir`.
		*/
    rootDir?: string;
    /**
		Unconditionally emit imports for unresolved files.

		@default false
		*/
    isolatedModules?: boolean;
    /**
		Require sufficient annotation on exports so other tools can trivially generate declaration files.

		@default false
		*/
    isolatedDeclarations?: boolean;
    /**
		Generates corresponding '.map' file.

		@default false
		*/
    sourceMap?: boolean;
    /**
		Specifies the location where debugger should locate TypeScript files instead of source locations.
		*/
    sourceRoot?: string;
    /**
		Suppress excess property checks for object literals.

		@default false
		@deprecated This option will be removed in TypeScript 5.5.
		*/
    suppressExcessPropertyErrors?: boolean;
    /**
		Suppress noImplicitAny errors for indexing objects lacking index signatures.

		@default false
		@deprecated This option will be removed in TypeScript 5.5.
		*/
    suppressImplicitAnyIndexErrors?: boolean;
    /**
		Do not emit declarations for code that has an `@internal` annotation.
		*/
    stripInternal?: boolean;
    /**
		Specify ECMAScript target version.

		@default 'es3'
		*/
    target?: CompilerOptions.Target;
    /**
		Default catch clause variables as `unknown` instead of `any`.

		@default false
		*/
    useUnknownInCatchVariables?: boolean;
    /**
		Watch input files.

		@default false
		@deprecated Use watchOptions instead.
		*/
    watch?: boolean;
    /**
		Specify the polling strategy to use when the system runs out of or doesn't support native file watchers.

		@deprecated Use watchOptions.fallbackPolling instead.
		*/
    fallbackPolling?: CompilerOptions.FallbackPolling;
    /**
		Specify the strategy for watching directories under systems that lack recursive file-watching functionality.

		@default 'useFsEvents'
		@deprecated Use watchOptions.watchDirectory instead.
		*/
    watchDirectory?: CompilerOptions.WatchDirectory;
    /**
		Specify the strategy for watching individual files.

		@default 'useFsEvents'
		@deprecated Use watchOptions.watchFile instead.
		*/
    watchFile?: CompilerOptions.WatchFile;
    /**
		Enables experimental support for ES7 decorators.

		@default false
		*/
    experimentalDecorators?: boolean;
    /**
		Emit design-type metadata for decorated declarations in source.

		@default false
		*/
    emitDecoratorMetadata?: boolean;
    /**
		Do not report errors on unused labels.

		@default false
		*/
    allowUnusedLabels?: boolean;
    /**
		Report error when not all code paths in function return a value.

		@default false
		*/
    noImplicitReturns?: boolean;
    /**
		Add `undefined` to a type when accessed using an index.

		@default false
		*/
    noUncheckedIndexedAccess?: boolean;
    /**
		Report error if failed to find a source file for a side effect import.

		@default false
		*/
    noUncheckedSideEffectImports?: boolean;
    /**
		Report errors for fallthrough cases in switch statement.

		@default false
		*/
    noFallthroughCasesInSwitch?: boolean;
    /**
		Ensure overriding members in derived classes are marked with an override modifier.

		@default false
		*/
    noImplicitOverride?: boolean;
    /**
		Do not report errors on unreachable code.

		@default false
		*/
    allowUnreachableCode?: boolean;
    /**
		Disallow inconsistently-cased references to the same file.

		@default true
		*/
    forceConsistentCasingInFileNames?: boolean;
    /**
		Emit a v8 CPU profile of the compiler run for debugging.

		@default 'profile.cpuprofile'
		*/
    generateCpuProfile?: string;
    /**
		Generates an event trace and a list of types.
		*/
    generateTrace?: boolean;
    /**
		Base directory to resolve non-relative module names.
		*/
    baseUrl?: string;
    /**
		Specify path mapping to be computed relative to baseUrl option.
		*/
    paths?: Record<string, string[]>;
    /**
		List of TypeScript language server plugins to load.
		*/
    plugins?: CompilerOptions.Plugin[];
    /**
		Specify list of root directories to be used when resolving modules.
		*/
    rootDirs?: string[];
    /**
		Specify list of directories for type definition files to be included.
		*/
    typeRoots?: string[];
    /**
		Type declaration files to be included in compilation.
		*/
    types?: string[];
    /**
		Enable tracing of the name resolution process.

		@default false
		*/
    traceResolution?: boolean;
    /**
		Allow javascript files to be compiled.

		@default false
		*/
    allowJs?: boolean;
    /**
		Do not truncate error messages.

		@default false
		*/
    noErrorTruncation?: boolean;
    /**
		Allow default imports from modules with no default export. This does not affect code emit, just typechecking.

		@default module === 'system' || esModuleInterop
		*/
    allowSyntheticDefaultImports?: boolean;
    /**
		Do not emit `'use strict'` directives in module output.

		@default false
		@deprecated This option will be removed in TypeScript 5.5.
		*/
    noImplicitUseStrict?: boolean;
    /**
		Enable to list all emitted files.

		@default false
		*/
    listEmittedFiles?: boolean;
    /**
		Disable size limit for JavaScript project.

		@default false
		*/
    disableSizeLimit?: boolean;
    /**
		List of library files to be included in the compilation.
		*/
    lib?: CompilerOptions.Lib[];
    /**
		Enable strict null checks.

		@default false
		*/
    strictNullChecks?: boolean;
    /**
		The maximum dependency depth to search under `node_modules` and load JavaScript files. Only applicable with `--allowJs`.

		@default 0
		*/
    maxNodeModuleJsDepth?: number;
    /**
		Import emit helpers (e.g. `__extends`, `__rest`, etc..) from tslib.

		@default false
		*/
    importHelpers?: boolean;
    /**
		Specify emit/checking behavior for imports that are only used for types.

		@default 'remove'
		@deprecated Use `verbatimModuleSyntax` instead.
		*/
    importsNotUsedAsValues?: CompilerOptions.ImportsNotUsedAsValues;
    /**
		Parse in strict mode and emit `'use strict'` for each source file.

		@default false
		*/
    alwaysStrict?: boolean;
    /**
		Enable all strict type checking options.

		@default false
		*/
    strict?: boolean;
    /**
		Enable stricter checking of of the `bind`, `call`, and `apply` methods on functions.

		@default false
		*/
    strictBindCallApply?: boolean;
    /**
		Provide full support for iterables in `for-of`, spread, and destructuring when targeting `ES5` or `ES3`.

		@default false
		*/
    downlevelIteration?: boolean;
    /**
		Report errors in `.js` files.

		@default false
		*/
    checkJs?: boolean;
    /**
		Built-in iterators are instantiated with a `TReturn` type of undefined instead of `any`.

		@default false
		*/
    strictBuiltinIteratorReturn?: boolean;
    /**
		Disable bivariant parameter checking for function types.

		@default false
		*/
    strictFunctionTypes?: boolean;
    /**
		Ensure non-undefined class properties are initialized in the constructor.

		@default false
		*/
    strictPropertyInitialization?: boolean;
    /**
		Emit `__importStar` and `__importDefault` helpers for runtime Babel ecosystem compatibility and enable `--allowSyntheticDefaultImports` for typesystem compatibility.

		@default false
		*/
    esModuleInterop?: boolean;
    /**
		Allow accessing UMD globals from modules.

		@default false
		*/
    allowUmdGlobalAccess?: boolean;
    /**
		Resolve `keyof` to string valued property names only (no numbers or symbols).

		@default false
		@deprecated This option will be removed in TypeScript 5.5.
		*/
    keyofStringsOnly?: boolean;
    /**
		Emit ECMAScript standard class fields.

		@default false
		*/
    useDefineForClassFields?: boolean;
    /**
		Generates a sourcemap for each corresponding `.d.ts` file.

		@default false
		*/
    declarationMap?: boolean;
    /**
		Include modules imported with `.json` extension.

		@default false
		*/
    resolveJsonModule?: boolean;
    /**
		Have recompiles in '--incremental' and '--watch' assume that changes within a file will only affect files directly depending on it.

		@default false
		*/
    assumeChangesOnlyAffectDirectDependencies?: boolean;
    /**
		Output more detailed compiler performance information after building.

		@default false
		*/
    extendedDiagnostics?: boolean;
    /**
		Print names of files that are part of the compilation and then stop processing.

		@default false
		*/
    listFilesOnly?: boolean;
    /**
		Disable preferring source files instead of declaration files when referencing composite projects.

		@default true if composite, false otherwise
		*/
    disableSourceOfProjectReferenceRedirect?: boolean;
    /**
		Opt a project out of multi-project reference checking when editing.

		@default false
		*/
    disableSolutionSearching?: boolean;
    /**
		Print names of files which TypeScript sees as a part of your project and the reason they are part of the compilation.

		@default false
		*/
    explainFiles?: boolean;
    /**
		Preserve unused imported values in the JavaScript output that would otherwise be removed.

		@default true
		@deprecated Use `verbatimModuleSyntax` instead.
		*/
    preserveValueImports?: boolean;
    /**
		List of file name suffixes to search when resolving a module.
		*/
    moduleSuffixes?: string[];
    /**
		Control what method is used to detect module-format JS files.

		@default 'auto'
		*/
    moduleDetection?: CompilerOptions.ModuleDetection;
    /**
		Allows TypeScript files to import each other with a TypeScript-specific extension like .ts, .mts, or .tsx.

		@default false
		*/
    allowImportingTsExtensions?: boolean;
    /**
		Forces TypeScript to consult the exports field of package.json files if it ever reads from a package in node_modules.

		@default false
		*/
    resolvePackageJsonExports?: boolean;
    /**
		Forces TypeScript to consult the imports field of package.json files when performing a lookup that starts with # from a file whose ancestor directory contains a package.json.

		@default false
		*/
    resolvePackageJsonImports?: boolean;
    /**
		Suppress errors for file formats that TypeScript does not understand.

		@default false
		*/
    allowArbitraryExtensions?: boolean;
    /**
		List of additional conditions that should succeed when TypeScript resolves from package.json.
		*/
    customConditions?: string[];
    /**
		Anything that uses the type modifier is dropped entirely.

		@default false
		*/
    verbatimModuleSyntax?: boolean;
    /**
		Suppress deprecation warnings
		*/
    ignoreDeprecations?: CompilerOptions.IgnoreDeprecations;
    /**
		Do not allow runtime constructs that are not part of ECMAScript.

		@default false
		*/
    erasableSyntaxOnly?: boolean;
    /**
		Enable lib replacement.

		@default true
		*/
    libReplacement?: boolean;
  };
  namespace WatchOptions {
    type WatchFileKind = 'FixedPollingInterval' | 'PriorityPollingInterval' | 'DynamicPriorityPolling' | 'FixedChunkSizePolling' | 'UseFsEvents' | 'UseFsEventsOnParentDirectory';
    type WatchDirectoryKind = 'UseFsEvents' | 'FixedPollingInterval' | 'DynamicPriorityPolling' | 'FixedChunkSizePolling';
    type PollingWatchKind = 'FixedInterval' | 'PriorityInterval' | 'DynamicPriority' | 'FixedChunkSize';
  }
  type WatchOptions = {
    /**
		Specify the strategy for watching individual files.

		@default 'UseFsEvents'
		*/
    watchFile?: WatchOptions.WatchFileKind | Lowercase<WatchOptions.WatchFileKind>;
    /**
		Specify the strategy for watching directories under systems that lack recursive file-watching functionality.

		@default 'UseFsEvents'
		*/
    watchDirectory?: WatchOptions.WatchDirectoryKind | Lowercase<WatchOptions.WatchDirectoryKind>;
    /**
		Specify the polling strategy to use when the system runs out of or doesn't support native file watchers.
		*/
    fallbackPolling?: WatchOptions.PollingWatchKind | Lowercase<WatchOptions.PollingWatchKind>;
    /**
		Enable synchronous updates on directory watchers for platforms that don't support recursive watching natively.
		*/
    synchronousWatchDirectory?: boolean;
    /**
		Specifies a list of directories to exclude from watch.
		*/
    excludeDirectories?: string[];
    /**
		Specifies a list of files to exclude from watch.
		*/
    excludeFiles?: string[];
  };
  /**
	Auto type (.d.ts) acquisition options for this project.
	*/
  type TypeAcquisition = {
    /**
		Enable auto type acquisition.
		*/
    enable?: boolean;
    /**
		Specifies a list of type declarations to be included in auto type acquisition. For example, `['jquery', 'lodash']`.
		*/
    include?: string[];
    /**
		Specifies a list of type declarations to be excluded from auto type acquisition. For example, `['jquery', 'lodash']`.
		*/
    exclude?: string[];
    /**
		Disable infering what types should be added based on filenames in a project.
		*/
    disableFilenameBasedTypeAcquisition?: boolean;
  };
  type References = {
    /**
		A normalized path on disk.
		*/
    path: string;
    /**
		The path as the user originally wrote it.
		*/
    originalPath?: string;
    /**
		True if the output of this reference should be prepended to the output of this project.

		Only valid for `--outFile` compilations.
		@deprecated This option will be removed in TypeScript 5.5.
		*/
    prepend?: boolean;
    /**
		True if it is intended that this reference form a circularity.
		*/
    circular?: boolean;
  };
}
/**
Type for [TypeScript's `tsconfig.json` file](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) (TypeScript 3.7).

@category File
*/
type TsConfigJson = {
  /**
	Instructs the TypeScript compiler how to compile `.ts` files.
	*/
  compilerOptions?: TsConfigJson.CompilerOptions;
  /**
	Instructs the TypeScript compiler how to watch files.
	*/
  watchOptions?: TsConfigJson.WatchOptions;
  /**
	Auto type (.d.ts) acquisition options for this project.
	*/
  typeAcquisition?: TsConfigJson.TypeAcquisition;
  /**
	Enable Compile-on-Save for this project.
	*/
  compileOnSave?: boolean;
  /**
	Path to base configuration file to inherit from.
	*/
  extends?: string | string[];
  /**
	If no `files` or `include` property is present in a `tsconfig.json`, the compiler defaults to including all files in the containing directory and subdirectories except those specified by `exclude`. When a `files` property is specified, only those files and those specified by `include` are included.
	*/
  files?: string[];
  /**
	Specifies a list of files to be excluded from compilation. The `exclude` property only affects the files included via the `include` property and not the `files` property.

	Glob patterns require TypeScript version 2.0 or later.
	*/
  exclude?: string[];
  /**
	Specifies a list of glob patterns that match files to be included in compilation.

	If no `files` or `include` property is present in a `tsconfig.json`, the compiler defaults to including all files in the containing directory and subdirectories except those specified by `exclude`.
	*/
  include?: string[];
  /**
	Referenced projects.
	*/
  references?: TsConfigJson.References[];
};
//#endregion
//#region ../../node_modules/.pnpm/rolldown-plugin-dts@0.27.13_@typescript+native-preview@7.0.0-dev.20260605.1_oxc-resolve_19173df252fb1b72b750fe1e656588b8/node_modules/rolldown-plugin-dts/dist/index.d.mts
//#region src/options.d.ts
interface Logger$1 {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}
interface GeneralOptions {
  /**
   * The generator used to produce `.d.ts` files.
   *
   * - `'tsc'`: The TypeScript 5.x/6.x compiler. Supports all TypeScript features.
   * - `'oxc'`: {@link https://oxc.rs Oxc}'s isolated declaration generator. Much
   *   faster than `tsc`, but only supports code that satisfies
   *   [`isolatedDeclarations`](https://www.typescriptlang.org/tsconfig/#isolatedDeclarations).
   * - `'tsgo'`: **[Experimental]** The TypeScript Go compiler
   *   ({@link https://github.com/microsoft/typescript-go tsgo}). May not support
   *   all TypeScript features yet.
   *
   * When unset, the generator is inferred:
   * - `'oxc'` if {@link Options.oxc oxc} options are provided or
   *   `isolatedDeclarations` is enabled in `compilerOptions`.
   * - `'tsgo'` if TypeScript 7.0 (or `@typescript/native-preview`) is installed,
   *   or {@link Options.tsgo tsgo} options are provided.
   * - `'tsc'` otherwise, and always when {@link TscOptions.vue vue} is enabled.
   *
   * @default 'tsc'
   */
  generator?: "tsc" | "oxc" | "tsgo";
  /**
   * Glob pattern(s) to filter which entry files get `.d.ts` generation.
   *
   * When specified, only entry files matching these patterns will emit `.d.ts` chunks.
   * When not specified, all entries get `.d.ts` generation.
   *
   * Supports negation patterns (e.g., `['**', '!src/icons/**']`) for exclusion.
   * Patterns are matched against file paths relative to `cwd`.
   *
   * @example
   * entry: 'src/index.ts'
   * entry: ['src/*.ts', '!src/internal/**']
   */
  entry?: string | string[];
  /**
   * The directory in which the plugin will search for the `tsconfig.json` file.
   */
  cwd?: string;
  /**
   * Set to `true` if your entry files are `.d.ts` files instead of `.ts` files.
   *
   * When enabled, the plugin will skip generating a `.d.ts` file for the entry point.
   */
  dtsInput?: boolean;
  /**
   * If `true`, the plugin will emit only `.d.ts` files and remove all other output chunks.
   *
   * This is especially useful when generating `.d.ts` files for the CommonJS format as part of a separate build step.
   */
  emitDtsOnly?: boolean;
  /**
   * The path to the `tsconfig.json` file.
   *
   * If set to `false`, the plugin will ignore any `tsconfig.json` file.
   * You can still specify `compilerOptions` directly in the options.
   *
   * @default 'tsconfig.json'
   */
  tsconfig?: string | boolean;
  /**
   * Pass a raw `tsconfig.json` object directly to the plugin.
   *
   * @see https://www.typescriptlang.org/tsconfig
   */
  tsconfigRaw?: Omit<TsConfigJson, "compilerOptions">;
  /**
   * Override the `compilerOptions` specified in `tsconfig.json`.
   *
   * @see https://www.typescriptlang.org/tsconfig/#compilerOptions
   */
  compilerOptions?: TsConfigJson.CompilerOptions;
  /**
   * If `true`, the plugin will generate declaration maps (`.d.ts.map`) for `.d.ts` files.
   */
  sourcemap?: boolean;
  /**
   * Specifies a resolver to resolve type definitions, especially for `node_modules`.
   *
   * - `'oxc'`: Uses Oxc's module resolution, which is faster and more efficient.
   * - `'tsc'`: Uses TypeScript's native module resolution, which may be more compatible with complex setups, but slower.
   *
   * @default 'oxc'
   */
  resolver?: "oxc" | "tsc";
  /**
   * Determines how the default export is emitted.
   *
   * If set to `true`, and you are only exporting a single item using `export default ...`,
   * the output will use `export = ...` instead of the standard ES module syntax.
   * This is useful for compatibility with CommonJS.
   * This only controls the output format and does not enable support for
   * CommonJS-style `.d.ts` input.
   */
  cjsDefault?: boolean;
  /**
   * Indicates whether the generated `.d.ts` files have side effects.
   * - If set to `true`, Rolldown will treat the `.d.ts` files as having side effects during tree-shaking.
   * - If set to `false`, Rolldown may consider the `.d.ts` files as side-effect-free, potentially removing them if they are not imported.
   *
   * @default false
   */
  sideEffects?: boolean;
  logger?: Logger$1;
}
interface TscOptions {
  /**
   * Build mode for the TypeScript compiler:
   *
   * - If `true`, the plugin will use [`tsc -b`](https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript) to build the project and all referenced projects before emitting `.d.ts` files.
   * - If `false`, the plugin will use [`tsc`](https://www.typescriptlang.org/docs/handbook/compiler-options.html) to emit `.d.ts` files without building referenced projects.
   *
   * @default false
   */
  build?: boolean;
  /**
   * If your tsconfig.json has
   * [`references`](https://www.typescriptlang.org/tsconfig/#references) option,
   * `rolldown-plugin-dts` will use [`tsc
   * -b`](https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript)
   * to build the project and all referenced projects before emitting `.d.ts`
   * files.
   *
   * In such case, if this option is `true`, `rolldown-plugin-dts` will write
   * down all built files into your disk, including
   * [`.tsbuildinfo`](https://www.typescriptlang.org/tsconfig/#tsBuildInfoFile)
   * and other built files. This is equivalent to running `tsc -b` in your
   * project.
   *
   * Otherwise, if this option is `false`, `rolldown-plugin-dts` will write
   * built files only into memory and leave a small footprint in your disk.
   *
   * Enabling this option will decrease the build time by caching previous build
   * results. This is helpful when you have a large project with multiple
   * referenced projects.
   *
   * By default, `incremental` is `true` if your tsconfig has
   * [`incremental`](https://www.typescriptlang.org/tsconfig/#incremental) or
   * [`tsBuildInfoFile`](https://www.typescriptlang.org/tsconfig/#tsBuildInfoFile)
   * enabled.
   *
   * This option is only used when {@link Options.oxc} is
   * `false`.
   */
  incremental?: boolean;
  /**
   * If `true`, the plugin will generate `.d.ts` files using `vue-tsc`.
   */
  vue?: boolean;
  /**
   * If `true`, the plugin will launch a separate process for `tsc` or `vue-tsc`.
   * This enables processing multiple projects in parallel.
   */
  parallel?: boolean;
  /**
   * If `true`, the plugin will prepare all files listed in `tsconfig.json` for `tsc` or `vue-tsc`.
   *
   * This is especially useful when you have a single `tsconfig.json` for multiple projects in a monorepo.
   */
  eager?: boolean;
  /**
   * If `true`, the plugin will create a new isolated context for each build,
   * ensuring that previously generated `.d.ts` code and caches are not reused.
   *
   * By default, the plugin may reuse internal caches or incremental build artifacts
   * to speed up repeated builds. Enabling this option forces a clean context,
   * guaranteeing that all type definitions are generated from scratch.
   *
   * @default false
   */
  newContext?: boolean;
  /**
   * If `true`, the plugin will emit `.d.ts` files for `.js` files as well.
   * This is useful when you want to generate type definitions for JavaScript files with JSDoc comments.
   *
   * Enabled by default when `allowJs` in compilerOptions is `true`.
   * This option is only used when {@link Options.oxc} is
   * `false`.
   */
  emitJs?: boolean;
}
interface Options$1 extends GeneralOptions, TscOptions {
  /**
   * If `true`, the plugin will generate `.d.ts` files using Oxc,
   * which is significantly faster than the TypeScript compiler.
   *
   * This option is automatically enabled when `isolatedDeclarations` in `compilerOptions` is set to `true`.
   */
  oxc?: boolean | Omit<IsolatedDeclarationsOptions, "sourcemap">;
  /**
   * **[Experimental]** Enables DTS generation using `tsgo`.
   *
   * This is automatically enabled when the TypeScript Go compiler (v7+) is
   * installed as the `typescript` package. Otherwise, make sure
   * `@typescript/native-preview` is installed as a dependency, or provide a
   * custom path to the `tsgo` binary using the `path` option.
   *
   * **Note:** TypeScript 7.0 does not yet have a stable API and is experimental.
   * This option is not yet recommended for production environments, and some
   * options (such as `tsconfigRaw` and `isolatedDeclarations`) will be
   * unavailable when it is enabled.
   *
   *
   * ```ts
   * // Use tsgo from `@typescript/native-preview` dependency
   * tsgo: true
   *
   * // Use custom tsgo path (e.g., managed by Nix)
   * tsgo: { path: '/path/to/tsgo' }
   * ```
   */
  tsgo?: boolean | TsgoOptions;
  /**
   * Registers custom {@link https://volarjs.dev Volar} language plugins,
   * allowing the `tsc` generator to process non-standard file types (such as
   * `.vue`) when generating `.d.ts` files. Multiple plugins can be provided and
   * are applied together.
   *
   * Enabling this option forces the `tsc` generator and is not supported with
   * TypeScript 7.0.
   *
   * @experimental The API may change in future versions.
   */
  volarPlugins?: VolarPlugin[];
}
interface TsgoOptions {
  /**
   * Custom path to the `tsgo` binary.
   */
  path?: string;
}
//#endregion
//#region ../../node_modules/.pnpm/tsdown@0.22.14_@arethetypeswrong+core@0.18.2_@tsdown+css@0.22.14_@tsdown+exe@0.22.14_@t_4084c24f9f44f250d2b604ebc16f10f3/node_modules/tsdown/dist/types-DP3_0kws.d.mts
//#region src/utils/types.d.ts
type Overwrite<T, U> = Omit<T, keyof U> & U;
type Awaitable<T> = T | Promise<T>;
type MarkPartial<T, K extends keyof T> = Omit<Required<T>, K> & Partial<Pick<T, K>>;
type Arrayable<T> = T | T[];
//#endregion
//#region src/features/copy.d.ts
interface CopyEntry {
  /**
   * Source path or glob pattern.
   */
  from: string | string[];
  /**
   * Destination path.
   * If not specified, defaults to the output directory ("outDir").
   */
  to?: string;
  /**
   * Whether to flatten the copied files (not preserving directory structure).
   *
   * @default true
   */
  flatten?: boolean;
  /**
   * Output copied items to console.
   * @default false
   */
  verbose?: boolean;
  /**
   * Change destination file or folder name.
   */
  rename?: string | ((name: string, extension: string, fullPath: string) => string);
}
type CopyOptions = Arrayable<string | CopyEntry>;
type CopyOptionsFn = (options: ResolvedConfig) => Awaitable<CopyOptions>;
//#endregion
//#region src/utils/chunks.d.ts
type RolldownChunk = (OutputChunk | OutputAsset) & {
  outDir: string;
};
type ChunksByFormat = Partial<Record<NormalizedFormat, RolldownChunk[]>>;
interface TsdownBundle extends AsyncDisposable {
  chunks: RolldownChunk[];
  config: ResolvedConfig;
  inlinedDeps: Map<string, Set<string>>;
}
//#endregion
//#region src/utils/logger.d.ts
type LogType = "error" | "warn" | "info";
type LogLevel = LogType | "silent";
interface LoggerOptions {
  allowClearScreen?: boolean;
  customLogger?: Logger;
  console?: Console;
  failOnWarn?: boolean;
  suppressWarnings?: Arrayable<RegExp | string> | ((msg: string) => boolean);
}
interface Logger {
  level: LogLevel;
  options?: LoggerOptions;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  warnOnce: (...args: any[]) => void;
  error: (...args: any[]) => void;
  success: (...args: any[]) => void;
  clearScreen: (type: LogType) => void;
}
declare const globalLogger: Logger;
//#endregion
//#region src/features/deps.d.ts
type NoExternalFn = (id: string, importer: string | undefined) => boolean | null | undefined | void;
interface DepsConfig {
  /**
   * Mark dependencies as external (not bundled).
   * Accepts strings, regular expressions, or Rolldown's
   * {@linkcode ExternalOption}.
   *
   * Set to `true` to externalize **all** dependencies: every import that
   * follows npm package naming conventions is marked as external as written,
   * without resolving it. Other non-relative imports (e.g. `#` subpath
   * imports and path aliases like `~/`) are resolved, and kept external
   * only if they resolve into `node_modules`; otherwise the resolved local
   * file is bundled.
   *
   * Use {@linkcode alwaysBundle} to opt specific imports back into the bundle.
   */
  neverBundle?: true | ExternalOption;
  /**
   * Force dependencies to be bundled, even if they are in `dependencies`, `peerDependencies`, or `optionalDependencies`.
   */
  alwaysBundle?: Arrayable<string | RegExp> | NoExternalFn;
  /**
   * Whitelist of dependencies allowed to be bundled from `node_modules`.
   * Throws an error if any unlisted dependency is bundled.
   *
   * - `undefined` (default): Show warnings for bundled dependencies.
   * - `false`: Suppress all warnings about bundled dependencies.
   *
   * Note: Be sure to include all required sub-dependencies as well.
   */
  onlyBundle?: Arrayable<string | RegExp> | false;
  /**
   * Whitelist of packages that the emitted output is allowed to import.
   * Matched against the package name, so subpath imports (e.g. `cac/deno`)
   * are covered by listing the package (e.g. `cac`).
   * Node built-in modules are always allowed to be imported
   * when `platform` is `node`.
   *
   * Note: ES imports and dynamic import expressions are checked. CJS
   * `require` calls are not detected.
   */
  onlyImport?: Arrayable<string | RegExp>;
  /**
   * @deprecated Use {@linkcode onlyBundle} instead.
   */
  onlyAllowBundle?: Arrayable<string | RegExp> | false;
  /**
   * Skip bundling all `node_modules` dependencies.
   *
   * **Note:** This option cannot be used together with {@linkcode alwaysBundle}.
   *
   * @default false
   * @deprecated Use {@linkcode neverBundle | neverBundle: true} instead.
   */
  skipNodeModulesBundle?: boolean;
  /**
   * Resolve dependency subpath imports to their actual package-relative paths
   * when externalizing packages without an `exports` field.
   *
   * @default true
   */
  resolveDepSubpath?: boolean;
  /**
   * Override dependency bundling options for declaration file generation.
   */
  dts?: Pick<DepsConfig, "alwaysBundle" | "neverBundle">;
}
interface ResolvedDepsConfig extends Pick<DepsConfig, "neverBundle" | "skipNodeModulesBundle" | "resolveDepSubpath"> {
  alwaysBundle?: NoExternalFn;
  onlyBundle?: Array<string | RegExp> | false;
  onlyImport?: Array<string | RegExp>;
  /**
   * Override dependency bundling options for declaration file generation.
   */
  dts: Pick<ResolvedDepsConfig, "alwaysBundle" | "neverBundle">;
}
//#endregion
//#region src/features/devtools.d.ts
interface DevtoolsOptions extends NonNullable<InputOptions["devtools"]> {
  /**
   * **[experimental]** Enable devtools integration. `@vitejs/devtools` must be installed as a dependency.
   *
   * Defaults to true, if `@vitejs/devtools` is installed.
   */
  ui?: boolean | Partial<StartOptions>;
  /**
   * Clean devtools stale sessions.
   *
   * @default true
   */
  clean?: boolean;
}
interface ExeOptions extends ExeExtensionOptions {
  seaConfig?: Omit<SeaConfig, "main" | "output" | "mainFormat">;
  /**
   * Output file name without any suffix or extension.
   * For example, do not include `.exe`, platform suffixes, or architecture suffixes.
   */
  fileName?: string | ((chunk: RolldownChunk) => string);
  /**
   * Output directory for executables.
   * @default 'build'
   */
  outDir?: string;
}
/**
 * See also [Node.js SEA Documentation](https://nodejs.org/api/single-executable-applications.html#generating-single-executable-applications-with---build-sea)
 *
 * Note some default values are different from Node.js defaults to optimize for typical use cases (e.g. disabling experimental warning, enabling code cache). These can be overridden.
 */
interface SeaConfig {
  main?: string;
  /**
   * Optional, if not specified, uses the current Node.js binary
   */
  executable?: string;
  output?: string;
  /**
   * @default tsdownConfig.format === 'es' ? 'module' : 'commonjs'
   */
  mainFormat?: "commonjs" | "module";
  /**
   * @default true
   */
  disableExperimentalSEAWarning?: boolean;
  /**
   * @default false
   */
  useSnapshot?: boolean;
  /**
   * @default false
   */
  useCodeCache?: boolean;
  execArgv?: string[];
  /**
   * @default 'env'
   */
  execArgvExtension?: "none" | "env" | "cli";
  assets?: Record<string, string>;
}
//#endregion
//#region src/features/hooks.d.ts
interface BuildContext {
  options: ResolvedConfig;
  hooks: Hookable<TsdownHooks>;
}
interface RolldownContext {
  buildOptions: BuildOptions;
}
/**
 * Hooks for tsdown.
 */
interface TsdownHooks {
  /**
   * Invoked before each tsdown build starts.
   * Use this hook to perform setup or preparation tasks.
   */
  "build:prepare": (ctx: BuildContext) => void | Promise<void>;
  /**
   * Invoked before each Rolldown build.
   * For dual-format builds, this hook is called for each format.
   * Useful for configuring or modifying the build context before bundling.
   */
  "build:before": (ctx: BuildContext & RolldownContext) => void | Promise<void>;
  /**
   * Invoked after each tsdown build completes.
   * Use this hook for cleanup or post-processing tasks.
   */
  "build:done": (ctx: BuildContext & {
    chunks: RolldownChunk[];
  }) => void | Promise<void>;
}
//#endregion
//#region node_modules/.pnpm/pkg-types@2.3.1/node_modules/pkg-types/dist/index.d.mts
//#endregion
//#region src/packagejson/types.d.ts
interface PackageJson {
  /**
   * The name is what your thing is called.
   * Some rules:
   * - The name must be less than or equal to 214 characters. This includes the scope for scoped packages.
   * - The name can’t start with a dot or an underscore.
   * - New packages must not have uppercase letters in the name.
   * - The name ends up being part of a URL, an argument on the command line, and a folder name. Therefore, the name can’t contain any non-URL-safe characters.
   */
  name?: string;
  /**
   * Version must be parseable by `node-semver`, which is bundled with npm as a dependency. (`npm install semver` to use it yourself.)
   */
  version?: string;
  /**
   * Put a description in it. It’s a string. This helps people discover your package, as it’s listed in `npm search`.
   */
  description?: string;
  /**
   * Put keywords in it. It’s an array of strings. This helps people discover your package as it’s listed in `npm search`.
   */
  keywords?: string[];
  /**
   * The url to the project homepage.
   */
  homepage?: string;
  /**
   * The url to your project’s issue tracker and / or the email address to which issues should be reported. These are helpful for people who encounter issues with your package.
   */
  bugs?: string | {
    url?: string;
    email?: string;
  };
  /**
   * You should specify a license for your package so that people know how they are permitted to use it, and any restrictions you’re placing on it.
   */
  license?: string;
  /**
   * Specify the place where your code lives. This is helpful for people who want to contribute. If the git repo is on GitHub, then the `npm docs` command will be able to find you.
   * For GitHub, GitHub gist, Bitbucket, or GitLab repositories you can use the same shortcut syntax you use for npm install:
   */
  repository?: string | {
    type: string;
    url: string;
    /**
     * If the `package.json` for your package is not in the root directory (for example if it is part of a monorepo), you can specify the directory in which it lives:
     */
    directory?: string;
  };
  /**
   * The `scripts` field is a dictionary containing script commands that are run at various times in the lifecycle of your package.
   */
  scripts?: PackageJsonScripts;
  /**
   * If you set `"private": true` in your package.json, then npm will refuse to publish it.
   */
  private?: boolean;
  /**
   * The “author” is one person.
   */
  author?: PackageJsonPerson;
  /**
   * “contributors” is an array of people.
   */
  contributors?: PackageJsonPerson[];
  /**
   * An object containing a URL that provides up-to-date information
   * about ways to help fund development of your package,
   * a string URL, or an array of objects and string URLs
   */
  funding?: PackageJsonFunding | PackageJsonFunding[];
  /**
   * The optional `files` field is an array of file patterns that describes the entries to be included when your package is installed as a dependency. File patterns follow a similar syntax to `.gitignore`, but reversed: including a file, directory, or glob pattern (`*`, `**\/*`, and such) will make it so that file is included in the tarball when it’s packed. Omitting the field will make it default to `["*"]`, which means it will include all files.
   */
  files?: string[];
  /**
   * The main field is a module ID that is the primary entry point to your program. That is, if your package is named `foo`, and a user installs it, and then does `require("foo")`, then your main module’s exports object will be returned.
   * This should be a module ID relative to the root of your package folder.
   * For most modules, it makes the most sense to have a main script and often not much else.
   */
  main?: string;
  /**
   * If your module is meant to be used client-side the browser field should be used instead of the main field. This is helpful to hint users that it might rely on primitives that aren’t available in Node.js modules. (e.g. window)
   */
  browser?: string | Record<string, string | false>;
  /**
   * The `unpkg` field is used to specify the URL to a UMD module for your package. This is used by default in the unpkg.com CDN service.
   */
  unpkg?: string;
  /**
   * A map of command name to local file name. On install, npm will symlink that file into `prefix/bin` for global installs, or `./node_modules/.bin/` for local installs.
   */
  bin?: string | Record<string, string>;
  /**
   * Specify either a single file or an array of filenames to put in place for the `man` program to find.
   */
  man?: string | string[];
  /**
   * Dependencies are specified in a simple object that maps a package name to a version range. The version range is a string which has one or more space-separated descriptors. Dependencies can also be identified with a tarball or git URL.
   */
  dependencies?: Record<string, string>;
  /**
   * If someone is planning on downloading and using your module in their program, then they probably don’t want or need to download and build the external test or documentation framework that you use.
   * In this case, it’s best to map these additional items in a `devDependencies` object.
   */
  devDependencies?: Record<string, string>;
  /**
   * If a dependency can be used, but you would like npm to proceed if it cannot be found or fails to install, then you may put it in the `optionalDependencies` object. This is a map of package name to version or url, just like the `dependencies` object. The difference is that build failures do not cause installation to fail.
   */
  optionalDependencies?: Record<string, string>;
  /**
   * In some cases, you want to express the compatibility of your package with a host tool or library, while not necessarily doing a `require` of this host. This is usually referred to as a plugin. Notably, your module may be exposing a specific interface, expected and specified by the host documentation.
   */
  peerDependencies?: Record<string, string>;
  /**
   * TypeScript typings, typically ending by `.d.ts`.
   */
  types?: string;
  /**
   * This field is synonymous with `types`.
   */
  typings?: string;
  /**
   * Non-Standard Node.js alternate entry-point to main.
   * An initial implementation for supporting CJS packages (from main), and use module for ESM modules.
   */
  module?: string;
  /**
   * Make main entry-point be loaded as an ESM module, support "export" syntax instead of "require"
   *
   * Docs:
   * - https://nodejs.org/docs/latest-v14.x/api/esm.html#esm_package_json_type_field
   *
   * @default 'commonjs'
   * @since Node.js v14
   */
  type?: "module" | "commonjs";
  /**
   * Alternate and extensible alternative to "main" entry point.
   *
   * When using `{type: "module"}`, any ESM module file MUST end with `.mjs` extension.
   *
   * Docs:
   * - https://nodejs.org/docs/latest-v14.x/api/esm.html#esm_exports_sugar
   *
   * @since Node.js v12.7
   */
  exports?: PackageJsonExports;
  /**
   *  Docs:
   *  - https://nodejs.org/api/packages.html#imports
   */
  imports?: Record<string, string | Record<string, string>>;
  /**
   * The field is used to define a set of sub-packages (or workspaces) within a monorepo.
   *
   * This field is an array of glob patterns or an object with specific configurations for managing
   * multiple packages in a single repository.
   */
  workspaces?: string[] | {
    /**
     * Workspace package paths. Glob patterns are supported.
     */
    packages?: string[];
    /**
     * Packages to block from hoisting to the workspace root.
     * Uses glob patterns to match module paths in the dependency tree.
     *
     * Docs:
     * - https://classic.yarnpkg.com/blog/2018/02/15/nohoist/
     */
    nohoist?: string[];
  };
  /**
   * The field is used to specify different TypeScript declaration files for
   * different versions of TypeScript, allowing for version-specific type definitions.
   */
  typesVersions?: Record<string, Record<string, string[]>>;
  /**
   * You can specify which operating systems your module will run on:
   * ```json
   * {
   *   "os": ["darwin", "linux"]
   * }
   * ```
   * You can also block instead of allowing operating systems, just prepend the blocked os with a '!':
   * ```json
   * {
   *   "os": ["!win32"]
   * }
   * ```
   * The host operating system is determined by `process.platform`
   * It is allowed to both block and allow an item, although there isn't any good reason to do this.
   */
  os?: string[];
  /**
   * If your code only runs on certain cpu architectures, you can specify which ones.
   * ```json
   * {
   *   "cpu": ["x64", "ia32"]
   * }
   * ```
   * Like the `os` option, you can also block architectures:
   * ```json
   * {
   *   "cpu": ["!arm", "!mips"]
   * }
   * ```
   * The host architecture is determined by `process.arch`
   */
  cpu?: string[];
  /**
   * This is a set of config values that will be used at publish-time.
   */
  publishConfig?: {
    /**
     * The registry that will be used if the package is published.
     */
    registry?: string;
    /**
     * The tag that will be used if the package is published.
     */
    tag?: string;
    /**
     * The access level that will be used if the package is published.
     */
    access?: "public" | "restricted";
    /**
     * **pnpm-only**
     *
     * By default, for portability reasons, no files except those listed in
     * the bin field will be marked as executable in the resulting package
     * archive. The executableFiles field lets you declare additional fields
     * that must have the executable flag (+x) set even if
     * they aren't directly accessible through the bin field.
     */
    executableFiles?: string[];
    /**
     * **pnpm-only**
     *
     * You also can use the field `publishConfig.directory` to customize
     * the published subdirectory relative to the current `package.json`.
     *
     * It is expected to have a modified version of the current package in
     * the specified directory (usually using third party build tools).
     */
    directory?: string;
    /**
     * **pnpm-only**
     *
     * When set to `true`, the project will be symlinked from the
     * `publishConfig.directory` location during local development.
     * @default true
     */
    linkDirectory?: boolean;
  } & Pick<PackageJson, "bin" | "main" | "exports" | "types" | "typings" | "module" | "browser" | "unpkg" | "typesVersions" | "os" | "cpu">;
  /**
   * See: https://nodejs.org/api/packages.html#packagemanager
   * This field defines which package manager is expected to be used when working on the current project.
   * Should be of the format: `<name>@<version>[#hash]`
   */
  packageManager?: string;
  [key: string]: any;
}
/**
 * See: https://docs.npmjs.com/cli/v11/using-npm/scripts#pre--post-scripts
 */
type PackageJsonScriptWithPreAndPost<S extends string> = S | `${"pre" | "post"}${S}`;
/**
 * See: https://docs.npmjs.com/cli/v11/using-npm/scripts#life-cycle-operation-order
 */
type PackageJsonNpmLifeCycleScripts = "dependencies" | "prepublishOnly" | PackageJsonScriptWithPreAndPost<"install" | "pack" | "prepare" | "publish" | "restart" | "start" | "stop" | "test" | "version">;
/**
 * See: https://pnpm.io/scripts#lifecycle-scripts
 */
type PackageJsonPnpmLifeCycleScripts = "pnpm:devPreinstall";
type PackageJsonCommonScripts = "build" | "coverage" | "deploy" | "dev" | "format" | "lint" | "preview" | "release" | "typecheck" | "watch";
type PackageJsonScriptName = PackageJsonCommonScripts | PackageJsonNpmLifeCycleScripts | PackageJsonPnpmLifeCycleScripts | (string & {});
type PackageJsonScripts = { [P in PackageJsonScriptName]?: string; };
/**
 * A “person” is an object with a “name” field and optionally “url” and “email”. Or you can shorten that all into a single string, and npm will parse it for you.
 */
type PackageJsonPerson = string | {
  name: string;
  email?: string;
  url?: string;
};
type PackageJsonFunding = string | {
  url: string;
  type?: string;
};
type PackageJsonExportKey = "." | "import" | "require" | "types" | "node" | "browser" | "default" | (string & {});
type PackageJsonExportsObject = { [P in PackageJsonExportKey]?: string | PackageJsonExportsObject | Array<string | PackageJsonExportsObject>; };
type PackageJsonExports = string | PackageJsonExportsObject | Array<string | PackageJsonExportsObject>;
//#endregion
//#region src/utils/package.d.ts
interface PackageJsonWithPath extends PackageJson {
  packageJsonPath: string;
}
type PackageType = "module" | "commonjs" | undefined;
//#endregion
//#region src/features/output.d.ts
interface OutExtensionContext {
  options: InputOptions;
  format: NormalizedFormat;
  /**
   * `"type"` field in project's `package.json`.
   */
  pkgType?: PackageType;
}
interface OutExtensionObject {
  js?: string;
  dts?: string;
}
type OutExtensionFactory = (context: OutExtensionContext) => OutExtensionObject | undefined;
interface ChunkAddonObject {
  js?: string;
  css?: string;
  dts?: string;
}
type ChunkAddonFunction = (ctx: {
  format: Format;
  fileName: string;
}) => ChunkAddonObject | string | undefined;
type ChunkAddon = ChunkAddonObject | ChunkAddonFunction | string;
//#endregion
//#region src/features/pkg/attw.d.ts
interface AttwOptions extends CheckPackageOptions {
  module?: typeof import("@arethetypeswrong/core");
  /**
   * Profiles select a set of resolution modes to require/ignore. All are evaluated but failures outside
   * of those required are ignored.
   *
   * The available profiles are:
   * - `strict`: requires all resolutions
   * - `node16`: ignores node10 resolution failures
   * - `esm-only`: ignores CJS resolution failures
   *
   * @default 'strict'
   */
  profile?: "strict" | "node16" | "esm-only";
  /**
   * The level of the check.
   *
   * The available levels are:
   * - `error`: fails the build
   * - `warn`: warns the build
   *
   * @default 'warn'
   */
  level?: "error" | "warn";
  /**
   * List of problem types to ignore by rule name.
   *
   * The available values are:
   * - `no-resolution`
   * - `untyped-resolution`
   * - `false-cjs`
   * - `false-esm`
   * - `cjs-resolves-to-esm`
   * - `fallback-condition`
   * - `cjs-only-exports-default`
   * - `named-exports`
   * - `false-export-default`
   * - `missing-export-equals`
   * - `unexpected-module-syntax`
   * - `internal-resolution-error`
   *
   * @example
   * ```ts
   * ignoreRules: ['no-resolution', 'false-cjs']
   * ```
   *
   * @default []
   *
   * @uniqueItems
   */
  ignoreRules?: ("no-resolution" | "untyped-resolution" | "false-cjs" | "false-esm" | "cjs-resolves-to-esm" | "fallback-condition" | "cjs-only-exports-default" | "named-exports" | "false-export-default" | "missing-export-equals" | "unexpected-module-syntax" | "internal-resolution-error" | (string & {}))[];
}
//#endregion
//#region src/features/pkg/exports.d.ts
interface ExportsOptions {
  /**
   * Generate exports that link to source code during development.
   * - `string`: add as a custom condition.
   * - `true`: all conditions point to source files, and add `dist` exports to `publishConfig`.
   */
  devExports?: boolean | string;
  /**
   * Generate `exports` for `package.json` file.
   *
   * @example
   * ```json
   * {
   *   "exports": {
   *      ".": {
   *         "types": "./dist/index.d.mts",
   *         "import": "./dist/index.mjs"
   *      },
   *     "./package.json": "./package.json"
   *   }
   * }
   * ```
   *
   * @default true
   */
  packageJson?: boolean;
  /**
   * Generate `exports` for all files.
   *
   * @example
   * ```json
   * {
   *   "exports": {
   *    "./*": "./*"
   *   }
   * }
   * ```
   *
   * @default false
   */
  all?: boolean;
  /**
   * Specifies file patterns (as glob patterns or regular expressions) to exclude from package exports.
   * Use this to prevent certain files from being included in the exported package, such as test files, binaries, or internal utilities.
   *
   * **Note:** Do not include file extensions, and paths should be relative to the dist directory.
   *
   * @example
   * ```ts
   * exclude: ['cli', '**\/*.test', /internal/]
   * ```
   */
  exclude?: (RegExp | string)[];
  /**
   * Generate legacy fields (`main` and `module`) for older Node.js and bundlers
   * that do not support package `exports` field.
   *
   * Defaults to false, if only ESM builds are included, true otherwise.
   *
   * @see {@link https://github.com/publint/publint/issues/24}
   */
  legacy?: boolean;
  /**
   * Specifies custom exports to add to the package exports in addition to the ones generated by tsdown.
   * Use this to add additional exports in the exported package, such as workers or assets.
   *
   * @example
   * ```ts
   * customExports(exports) {
   *   exports['./worker.js'] = './dist/worker.js';
   *   return exports;
   * }
   * ```
   *
   * @example
   * ```jsonc
   * {
   *   "customExports": {
   *     "./worker.js": {
   *       "types": "./dist/worker.d.ts",
   *       "default": "./dist/worker.js"
   *     }
   *   }
   * }
   * ```
   */
  customExports?: Record<string, any> | ((exports: Record<string, any>, context: {
    pkg: PackageJson;
    chunks: ChunksByFormat;
    isPublish: boolean;
  }) => Awaitable<Record<string, any>>);
  /**
   * Generate `inlinedDependencies` field in `package.json`.
   * Lists dependencies that are physically inlined into the bundle with their exact versions.
   *
   * @default true
   * @see {@link https://github.com/e18e/ecosystem-issues/issues/237}
   */
  inlinedDependencies?: boolean;
  /**
   * Add file extensions to subpath export keys.
   *
   * When enabled, all subpath exports (except the root `"."`) will include
   * a `.js` extension in the key (e.g., `"./utils.js"` instead of `"./utils"`).
   *
   * This follows the Node.js recommendation for subpath exports:
   * @see {@link https://nodejs.org/api/packages.html#extensions-in-subpaths}
   *
   * @default false
   */
  extensions?: boolean;
  /**
   * Generate the `bin` field in `package.json` for CLI executables.
   *
   * Behavior depends on the value:
   *
   * - *Unset* (default): Soft auto-detect. Scans entry chunks for shebangs
   *   (e.g. `#!/usr/bin/env node`). If exactly one is found, it is used as
   *   the bin entry. If multiple are found, a warning is shown and no `bin`
   *   field is written. If none are found, nothing happens silently.
   * - `true`: Strict auto-detect. Same as the default, but throws if
   *   multiple shebang entries are found, and warns if none are found.
   *   Use this when your package is known to ship a CLI and you want to
   *   fail fast on misconfiguration.
   * - `false`: Disable bin generation entirely, even if shebangs are
   *   present.
   * - `string`: Use the given source file path (relative to `cwd`) as the
   *   CLI entry. The command name is derived from the package name without
   *   its scope. Warns if the source file does not contain a shebang.
   * - `Record<string, string>`: Explicitly map command names to source file
   *   paths (relative to `cwd`). Warns for each source file that does not
   *   contain a shebang.
   *
   * When {@link ExportsOptions.devExports} is enabled, the `bin` field in
   * `package.json` points to source files during local development, while
   * `publishConfig.bin` points to built output paths for publishing.
   *
   * @example
   * <caption>Auto-detect a CLI entry from a shebang</caption>
   *
   * ```ts
   * {
   *   bin: true
   * }
   * ```
   *
   * @example
   * <caption>Single CLI command with an explicit source entry</caption>
   *
   * ```ts
   * {
   *   bin: './src/cli.ts'
   * }
   * ```
   *
   * @example
   * <caption>Multiple named CLI commands</caption>
   *
   * ```ts
   * {
   *   bin: {
   *     tool: './src/cli.ts',
   *     serve: './src/cli-extra.ts',
   *   },
   * }
   * ```
   *
   * @see {@link https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin | npm documentation for the `bin` field}
   */
  bin?: boolean | string | Record<string, string>;
}
//#endregion
//#region src/features/pkg/publint.d.ts
interface PublintOptions extends Omit<Options, "pack" | "pkgDir"> {
  module?: [typeof import("publint"), typeof import("publint/utils")];
}
//#endregion
//#region src/features/plugin.d.ts
/**
 * A tsdown-aware plugin. Extends Rolldown's {@linkcode Plugin} with
 * tsdown-specific lifecycle hooks.
 *
 * Plugins that only use Rolldown's own lifecycle continue to work unchanged;
 * tsdown detects these optional methods via runtime duck-typing.
 */
interface TsdownPlugin<A = any> extends Plugin<A> {
  /**
   * Modify tsdown's user config before it is resolved. Analogous to Vite's
   * [`config`](https://vite.dev/guide/api-plugin.html#config) hook.
   *
   * The hook may mutate {@linkcode config} in place, or return a partial
   * {@linkcode UserConfig} that will be deep-merged into the current config.
   * Array fields are replaced (not concatenated) during merging — to append
   * plugins, mutate {@linkcode UserConfig.plugins | config.plugins} in place.
   *
   * The second argument is the original {@linkcode InlineConfig} passed to
   * {@linkcode build | build()} (typically the CLI flags), useful for
   * distinguishing values that came from the command line vs. the config file.
   *
   * Plugins injected via {@linkcode UserConfig.fromVite | fromVite} do not
   * receive this hook, because they are loaded after the
   * {@linkcode tsdownConfig} phase. Likewise, new plugins added by another
   * plugin's {@linkcode tsdownConfig} do not themselves receive this hook
   * (plugins are snapshotted before dispatch).
   */
  tsdownConfig?: (config: UserConfig, inlineConfig: InlineConfig) => Awaitable<UserConfig | void | null>;
  /**
   * Called after tsdown has fully resolved the user config. Analogous to
   * Vite's [`configResolved`](https://vite.dev/guide/api-plugin.html#configresolved)
   * hook.
   *
   * This hook fires once per produced {@linkcode ResolvedConfig} — i.e. once
   * per output format when {@linkcode UserConfig.format | format} is an array.
   * Typical usage is to stash the resolved config for later use in
   * Rolldown hooks. Mutations made to {@linkcode resolvedConfig} here are
   * not supported.
   */
  tsdownConfigResolved?: (resolvedConfig: ResolvedConfig) => Awaitable<void>;
}
/**
 * A tsdown plugin slot — accepts tsdown plugins, any Rolldown plugin form,
 * `null`/`undefined`/`false`, {@linkcode Promise | promises}, and
 * nested arrays. Mirrors Rolldown's {@linkcode RolldownPluginOption} but with
 * {@linkcode TsdownPlugin} as the atom so that tsdown-specific hooks are
 * type-checked.
 */
type TsdownPluginOption<A = any> = Awaitable<TsdownPlugin<A> | RolldownPlugin<A> | {
  name: string;
} | undefined | null | void | false | TsdownPluginOption<A>[]>;
//#endregion
//#region src/features/report.d.ts
interface ReportOptions {
  /**
   * Enable/disable gzip-compressed size reporting.
   * Compressing large output files can be slow, so disabling this may increase build performance for large projects.
   *
   * @default true
   */
  gzip?: boolean;
  /**
   * Enable/disable brotli-compressed size reporting.
   * Compressing large output files can be slow, so disabling this may increase build performance for large projects.
   *
   * @default false
   */
  brotli?: boolean;
  /**
   * Skip reporting compressed size for files larger than this size.
   * @default 1_000_000 // 1 MB
   */
  maxCompressSize?: number;
}
type ConcurrencyExecutor = <T>(task: () => Promise<T>) => Promise<T>;
//#endregion
//#region src/config/types.d.ts
interface DtsOptions extends Options$1 {
  /**
   * When building dual ESM+CJS formats, generate a `.d.cts` re-export stub
   * instead of running a full second TypeScript compilation pass.
   *
   * The stub re-exports everything from the corresponding `.d.mts` file,
   * ensuring CJS and ESM consumers share the same type declarations. This
   * eliminates the TypeScript "dual module hazard" where separate `.d.cts`
   * and `.d.mts` declarations cause `TS2352` ("neither type sufficiently
   * overlaps") errors when casting between types derived from the same class.
   *
   * Only applies when building both `esm` and `cjs` formats simultaneously.
   *
   * @remarks
   * The generated `.d.cts` stub uses a relative path to re-export from the
   * corresponding `.d.mts` file, so both formats must be emitted to the
   * **same** `outDir`. Splitting CJS and ESM outputs into separate
   * format-specific directories (e.g. `dist/cjs` and `dist/esm`) is not
   * supported with this option, because the re-export path would be invalid.
   *
   * @default false
   */
  cjsReexport?: boolean;
}
type Sourcemap = boolean | "inline" | "hidden";
type Format = ModuleFormat;
type NormalizedFormat = InternalModuleFormat;
/**
 * Extended input option that supports glob negation patterns.
 *
 * When using object form, values can be:
 * - A single glob pattern string
 * - An array of glob patterns, including negation patterns (prefixed with `!`)
 *
 * @example
 * ```ts
 * entry: {
 *   // Single pattern
 *   "utils/*": "./src/utils/*.ts",
 *   // Array with negation pattern to exclude files
 *   "hooks/*": ["./src/hooks/*.ts", "!./src/hooks/index.ts"],
 * }
 * ```
 */
type TsdownInputOption = Arrayable<string | Record<string, Arrayable<string>>>;
interface Workspace {
  /**
   * Workspace directories. Glob patterns are supported.
   * - `auto`: Automatically detect `package.json` files in the workspace.
   * @default 'auto'
   */
  include?: "auto" | (string & {}) | string[];
  /**
   * Exclude directories from workspace.
   * Defaults to all `node_modules`, `dist`, `test`, `tests`, `temp`, and `tmp` directories.
   *
   * @default ['**\/node_modules/**', '**\/dist/**', '**\/test?(s)/**', '**\/t?(e)mp/**']
   */
  exclude?: Arrayable<string>;
  /**
   * Path to the workspace configuration file.
   */
  config?: boolean | string;
}
type CIOption = "ci-only" | "local-only";
type WithEnabled<T> = boolean | undefined | CIOption | (T & {
  /**
   * @default true
   */
  enabled?: boolean | CIOption;
});
/**
 * Options for tsdown.
 */
interface UserConfig {
  /**
   * Defaults to `'src/index.ts'` if it exists.
   *
   * Supports glob patterns with negation to exclude files:
   * @example
   * ```ts
   * entry: {
   *   "hooks/*": ["./src/hooks/*.ts", "!./src/hooks/index.ts"],
   * }
   * ```
   *
   * @default { index: 'src/index.ts'}
   */
  entry?: TsdownInputOption;
  /**
   * Dependency handling options.
   */
  deps?: DepsConfig;
  alias?: Record<string, string>;
  /**
   * @default true
   */
  tsconfig?: string | boolean;
  /**
   * Specifies the target runtime platform for the build.
   *
   * - `node`: Node.js and compatible runtimes (e.g., Deno, Bun).
   *   For CJS format, this is always set to `node` and cannot be changed.
   * - `neutral`: A platform-agnostic target with no specific runtime assumptions.
   * - `browser`: Web browsers.
   *
   * @default 'node'
   * @see https://tsdown.dev/options/platform
   */
  platform?: "node" | "neutral" | "browser";
  /**
   * Specifies the compilation target environment(s).
   *
   * Determines the JavaScript version or runtime(s) for which the code should be compiled.
   * If not set, defaults to the value of `engines.node` in your project's `package.json`.
   * If no `engines.node` field exists, no syntax transformations are applied.
   *
   * Accepts a single target (e.g., `'es2020'`, `'node18'`, `'baseline-widely-available'`), an array of targets, or `false` to disable all transformations.
   *
   * @see {@link https://tsdown.dev/options/target#supported-targets} for a list of valid targets and more details.
   *
   * @example
   * ```jsonc
   * // Target a single environment
   * { "target": "node18" }
   * ```
   *
   * @example
   * ```jsonc
   * // Target multiple environments
   * { "target": ["node18", "es2020"] }
   * ```
   *
   * @example
   * ```jsonc
   * // Disable all syntax transformations
   * { "target": false }
   * ```
   */
  target?: string | string[] | false;
  /**
   * Compile-time env variables, which can be accessed via `import.meta.env` or `process.env`.
   * @example
   * ```json
   * {
   *   "DEBUG": true,
   *   "NODE_ENV": "production"
   * }
   * ```
   *
   * @default {}
   */
  env?: Record<string, any>;
  /**
   * Path to env file providing compile-time env variables.
   * @example
   * `.env`, `.env.production`, etc.
   */
  envFile?: string;
  /**
   * When loading env variables from `envFile`, only include variables with these prefixes.
   * @default 'TSDOWN_'
   */
  envPrefix?: string | string[];
  define?: Record<string, string>;
  /**
   * @default false
   */
  shims?: boolean;
  /**
   * Configure tree shaking options.
   * @see {@link https://rolldown.rs/reference/InputOptions.treeshake} for more details.
   * @default true
   */
  treeshake?: boolean | TreeshakingOptions;
  /**
   * Sets how input files are processed.
   * For example, use 'js' to treat files as JavaScript or 'base64' for images.
   * Lets you import or require files like images or fonts.
   * @example
   * ```json
   * { ".jpg": "asset", ".png": "base64" }
   * ```
   */
  loader?: ModuleTypes;
  /**
   * Control whether built-in Node.js module imports use the `node:` protocol.
   *
   * - `true`: Add the `node:` prefix to built-in module imports.
   * - `'strip'`: Remove the `node:` prefix from built-in module imports.
   * - `false`: Do not transform built-in module imports.
   *
   * @default false
   *
   * @example
   * <caption>`nodeProtocol: true` — add the `node:` prefix</caption>
   *
   * ```ts
   * // Input
   * import 'fs'
   *
   * // Output
   * import 'node:fs'
   * ```
   *
   * @example
   * <caption>`nodeProtocol: 'strip'` — remove the `node:` prefix</caption>
   *
   * ```ts
   * // Input
   * import 'node:fs'
   *
   * // Output
   * import 'fs'
   * ```
   *
   * @example
   * <caption>`nodeProtocol: false` — do not transform imports</caption>
   *
   * ```ts
   * // Input
   * import 'node:fs'
   *
   * // Output
   * import 'node:fs'
   * ```
   */
  nodeProtocol?: "strip" | boolean;
  /**
   * Controls which warnings are emitted during the build process. Each option can be set to `true` (emit warning) or `false` (suppress warning).
   */
  checks?: ChecksOptions & {
    /**
     * If the config includes the `cjs` format and
     * one of its target >= node 20.19.0 / 22.12.0,
     * warn the user about the deprecation of CommonJS.
     *
     * @default true
     */
    legacyCjs?: boolean;
  };
  plugins?: TsdownPluginOption;
  /**
   * Use with caution; ensure you understand the implications.
   */
  inputOptions?: InputOptions | ((options: InputOptions, format: NormalizedFormat, context: {
    cjsDts: boolean;
  }) => Awaitable<InputOptions | void | null>);
  /**
   * Output format(s). Available formats are
   * - `esm`: ESM
   * - `cjs`: CommonJS
   * - `iife`: IIFE
   * - `umd`: UMD
   *
   * @default 'esm'
   */
  format?: Format | Format[] | Partial<Record<Format, Partial<ResolvedConfig>>>;
  globalName?: string;
  /**
   * @default 'dist'
   */
  outDir?: string;
  /**
   * Whether to write the files to disk.
   * This option is incompatible with watch mode.
   * @default true
   */
  write?: boolean;
  /**
   * Whether to generate source map files.
   *
   * Note that this option will always be `true` if you have
   * {@link https://www.typescriptlang.org/tsconfig/#declarationMap | `declarationMap`}
   * option enabled in your `tsconfig.json`.
   *
   * @default false
   */
  sourcemap?: Sourcemap;
  /**
   * Clean directories before build.
   *
   * Default to output directory.
   * @default true
   */
  clean?: boolean | string[];
  /**
   * @default false
   */
  minify?: boolean | "dce-only" | MinifyOptions;
  footer?: ChunkAddon;
  banner?: ChunkAddon;
  /**
   * Determines whether `unbundle` is enabled.
   * When set to `true`, the output files will mirror the input file structure.
   * @default false
   */
  unbundle?: boolean;
  /**
   * Specifies the root directory of input files, similar to TypeScript's `rootDir`.
   * This determines the output directory structure.
   *
   * By default, the root is computed as the common base directory of all entry files.
   *
   * @see https://www.typescriptlang.org/tsconfig/#rootDir
   */
  root?: string;
  /**
   * Use a fixed extension for output files.
   * The extension will always be `.cjs` or `.mjs`.
   * Otherwise, it will depend on the package type.
   *
   * Defaults to `true` if {@linkcode platform} is set to `node`,
   * `false` otherwise.
   *
   * @default platform === 'node'
   */
  fixedExtension?: boolean;
  /**
   * Custom extensions for output files.
   * {@linkcode fixedExtension} will be overridden by this option.
   */
  outExtensions?: OutExtensionFactory;
  /**
   * If enabled, appends hash to chunk filenames.
   * @default true
   */
  hash?: boolean;
  /**
   * Converts a single default export from an explicit CJS entry module to
   * `module.exports`. It does not apply to non-entry chunks emitted in
   * unbundle mode.
   *
   * @default true
   */
  cjsDefault?: boolean;
  /**
   * Use with caution; ensure you understand the implications.
   */
  outputOptions?: OutputOptions | ((options: OutputOptions, format: NormalizedFormat, context: {
    cjsDts: boolean;
  }) => Awaitable<OutputOptions | void | null>);
  /**
   * The working directory of the config file.
   * - Defaults to {@linkcode process.cwd | process.cwd()} for root config.
   * - Defaults to the package directory for {@linkcode workspace} config.
   *
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * The name to show in CLI output. This is useful for monorepos or workspaces.
   * When using workspace mode, this option defaults to the package name from package.json.
   * In non-workspace mode, this option must be set explicitly for the name to show in the CLI output.
   */
  name?: string;
  /**
   * Log level.
   * @default 'info'
   */
  logLevel?: LogLevel;
  /**
   * If true, fails the build on warnings.
   * @default false
   */
  failOnWarn?: boolean | CIOption;
  /**
   * Suppress warnings whose message matches the given pattern(s).
   *
   * Accepts a string (substring match), a `RegExp`, an array of either, or a
   * predicate function. Matched warnings are dropped before `failOnWarn` is
   * applied, so they won't fail the build.
   */
  suppressWarnings?: Arrayable<RegExp | string> | ((msg: string) => boolean);
  /**
   * Custom logger.
   */
  customLogger?: Logger;
  /**
   * Reuse config from Vite or Vitest (experimental)
   * @default false
   */
  fromVite?: boolean | "vitest";
  /**
   * @default false
   */
  watch?: boolean | Arrayable<string>;
  /**
   * Files or patterns to not watch while in watch mode.
   */
  ignoreWatch?: Arrayable<string | RegExp>;
  /**
   * **[experimental]** Enable devtools.
   *
   * DevTools is still under development, and this is for early testers only.
   *
   * This may slow down the build process significantly.
   *
   * @default false
   */
  devtools?: WithEnabled<DevtoolsOptions>;
  /**
   * You can specify command to be executed after a successful build, specially useful for Watch mode
   */
  onSuccess?: string | ((config: ResolvedConfig, signal: AbortSignal) => void | Promise<void>);
  /**
   * Enables generation of TypeScript declaration files (`.d.ts`).
   *
   * By default, this option is auto-detected based on your project's `package.json`:
   * - If {@linkcode exe} is enabled, declaration file generation is disabled by default.
   * - If the `types` field is present, or if the main `exports` contains a `types` entry, declaration file generation is enabled by default.
   * - Otherwise, declaration file generation is disabled by default.
   */
  dts?: WithEnabled<DtsOptions>;
  /**
   * Enable unused dependencies check with `unplugin-unused`
   * Requires `unplugin-unused` to be installed.
   * @default false
   */
  unused?: WithEnabled<UnusedOptions>;
  /**
   * Run `publint` after bundling.
   * Requires `publint` to be installed.
   * @default false
   */
  publint?: WithEnabled<PublintOptions>;
  /**
   * Run `arethetypeswrong` after bundling.
   * Requires `@arethetypeswrong/core` to be installed.
   *
   * @default false
   * @see https://github.com/arethetypeswrong/arethetypeswrong.github.io
   */
  attw?: WithEnabled<AttwOptions>;
  /**
   * Enable size reporting after bundling.
   * @default true
   */
  report?: WithEnabled<ReportOptions>;
  /**
   * `import.meta.glob` support.
   * @see https://vite.dev/guide/features.html#glob-import
   * @default true
   */
  globImport?: boolean;
  /**
   * Generate package exports for `package.json`.
   *
   * This will set the `exports` field in `package.json` to point to the
   * generated files.
   *
   * @default false
   */
  exports?: WithEnabled<ExportsOptions>;
  /**
   * **[experimental]** CSS options.
   * Requires `@tsdown/css` to be installed.
   */
  css?: CssOptions;
  /**
   * Copy files to another directory.
   * @example
   * ```ts
   * [
   *   'src/assets',
   *   'src/env.d.ts',
   *   'src/styles/**\/*.css',
   *   { from: 'src/assets', to: 'dist/assets' },
   *   { from: 'src/styles/**\/*.css', to: 'dist', flatten: true },
   * ]
   * ```
   */
  copy?: CopyOptions | CopyOptionsFn;
  hooks?: Partial<TsdownHooks> | ((hooks: Hookable<TsdownHooks>) => Awaitable<void>);
  /**
   * **[experimental]** Bundle as executable using Node.js SEA (Single Executable Applications).
   *
   * This will bundle the output into a single executable file using Node.js SEA.
   * Note that this is only supported on Node.js 25.7.0 and later, and is not supported in Bun or Deno.
   *
   * @default false
   */
  exe?: WithEnabled<ExeOptions>;
  /**
   * **[experimental]** Enable workspace mode.
   * This allows you to build multiple packages in a monorepo.
   */
  workspace?: Workspace | Arrayable<string> | true;
  /**
   * @deprecated Use {@linkcode DepsConfig.neverBundle | deps.neverBundle} instead.
   */
  external?: ExternalOption;
  /**
   * @deprecated Use {@linkcode DepsConfig.alwaysBundle | deps.alwaysBundle} instead.
   */
  noExternal?: Arrayable<string | RegExp> | NoExternalFn;
  /**
   * @deprecated Use {@linkcode DepsConfig.onlyBundle | deps.onlyBundle} instead.
   */
  inlineOnly?: Arrayable<string | RegExp> | false;
  /**
   * @deprecated Use {@linkcode DepsConfig.neverBundle | deps.neverBundle: true} instead.
   * @default false
   */
  skipNodeModulesBundle?: boolean;
  /**
   * Remove the `node:` prefix from built-in Node.js module imports.
   * When enabled, rewrites import sources like `node:fs` to `fs`.
   *
   * @default false
   * @deprecated Use {@linkcode nodeProtocol | nodeProtocol: 'strip'} instead.
   *
   * @example
   * <caption>`removeNodeProtocol: true` — remove the `node:` prefix</caption>
   *
   * ```ts
   * // Input
   * import 'node:fs'
   *
   * // Output
   * import 'fs'
   * ```
   */
  removeNodeProtocol?: boolean;
  /**
   * @deprecated Use {@linkcode unbundle} instead.
   * @default true
   */
  bundle?: boolean;
  /**
   * @deprecated Use {@linkcode outExtensions} instead.
   */
  outExtension?: OutExtensionFactory;
  /**
   * @deprecated Use {@linkcode CssOptions.inject | css.inject} instead.
   */
  injectStyle?: boolean;
  /**
   * @alias copy
   * @deprecated Alias for {@linkcode copy}, will be removed in the future.
   */
  publicDir?: CopyOptions | CopyOptionsFn;
}
interface InlineConfig extends UserConfig {
  /**
   * Config file path
   */
  config?: boolean | string;
  /**
   * Config loader to use. It can only be set via CLI or API.
   * @default 'auto'
   */
  configLoader?: "auto" | "native" | "tsx" | "unrun";
  /**
   * Filter configs by cwd or name.
   */
  filter?: RegExp | Arrayable<string>;
  /**
   * Maximum number of Rolldown builds to run in parallel.
   */
  concurrency?: number;
}
type UserConfigFn = (inlineConfig: InlineConfig, context: {
  ci: boolean;
  rootConfig?: UserConfig;
}) => Awaitable<Arrayable<UserConfig>>;
type UserConfigExport = Awaitable<Arrayable<UserConfig> | UserConfigFn>;
type ResolvedConfig = Overwrite<MarkPartial<Omit<UserConfig, "workspace" | "fromVite" | "publicDir" | "bundle" | "injectStyle" | "removeNodeProtocol" | "outExtension" | "external" | "noExternal" | "inlineOnly" | "skipNodeModulesBundle" | "logLevel" | "failOnWarn" | "suppressWarnings" | "customLogger" | "envFile" | "envPrefix">, "globalName" | "inputOptions" | "outputOptions" | "minify" | "define" | "alias" | "onSuccess" | "outExtensions" | "hooks" | "copy" | "loader" | "name" | "banner" | "footer" | "checks" | "css">, {
  /**
   * Resolved entry map (after glob expansion)
   */
  entry: Record<string, string>;
  /**
   * Original entry config before glob resolution (for watch mode re-globbing)
   */
  rawEntry?: TsdownInputOption;
  nameLabel: string | undefined;
  format: NormalizedFormat;
  target?: string[];
  clean: string[];
  pkg?: PackageJsonWithPath;
  nodeProtocol: "strip" | boolean;
  logger: Logger;
  ignoreWatch: Array<string | RegExp>;
  deps: ResolvedDepsConfig;
  /**
   * Resolved root directory of input files
   */
  root: string;
  configDeps: Set<string>;
  runBuild: ConcurrencyExecutor;
  dts: false | DtsOptions;
  report: false | ReportOptions;
  tsconfig: false | string;
  exports: false | ExportsOptions;
  devtools: false | DevtoolsOptions;
  publint: false | PublintOptions;
  attw: false | AttwOptions;
  unused: false | UnusedOptions;
  exe: false | ExeOptions;
}>;
//#endregion
//#region ../../node_modules/.pnpm/tsdown@0.22.14_@arethetypeswrong+core@0.18.2_@tsdown+css@0.22.14_@tsdown+exe@0.22.14_@t_4084c24f9f44f250d2b604ebc16f10f3/node_modules/tsdown/dist/config-Dnbs_AoW.d.mts
//#region src/config/options.d.ts
/**
 * Resolve user config into resolved configs
 *
 * **Internal API, not for public use**
 * @private
 */
declare function resolveUserConfig(userConfig: UserConfig, inlineConfig: InlineConfig, configDeps: Set<string>, runBuild?: ConcurrencyExecutor): Promise<ResolvedConfig[]>;
declare function mergeConfig(defaults: UserConfig, ...overrides: UserConfig[]): UserConfig;
declare function mergeConfig(defaults: InlineConfig, ...overrides: InlineConfig[]): InlineConfig;
//#endregion
//#region src/config.d.ts
/**
 * Defines the configuration for tsdown.
 */
declare function defineConfig(options: UserConfig): UserConfig;
declare function defineConfig(options: UserConfig[]): UserConfig[];
declare function defineConfig(options: UserConfigFn): UserConfigFn;
declare function defineConfig(options: UserConfigExport): UserConfigExport;
//#endregion
//#region ../../node_modules/.pnpm/tsdown@0.22.14_@arethetypeswrong+core@0.18.2_@tsdown+css@0.22.14_@tsdown+exe@0.22.14_@t_4084c24f9f44f250d2b604ebc16f10f3/node_modules/tsdown/dist/index.d.mts
//#region src/build.d.ts
/**
 * Build with tsdown.
 */
declare function build$1(inlineConfig?: InlineConfig): Promise<TsdownBundle[]>;
/**
 * Build with `ResolvedConfigs`.
 *
 * **Internal API, not for public use**
 * @private
 */
declare function buildWithConfigs(configs: ResolvedConfig[], configDeps: Set<string>, _restart: () => void): Promise<TsdownBundle[]>;
//#endregion
//#region src/features/debug.d.ts
declare function enableDebug(debug?: boolean | Arrayable<string>): void;
//#endregion
//#region src/index.d.ts
declare const version: string;
//#endregion
export { type AttwOptions, type BuildContext, CIOption, type ChunkAddon, type ChunkAddonFunction, type ChunkAddonObject, type CopyEntry, type CopyOptions, type CopyOptionsFn, type DepsConfig, type DevtoolsOptions, DtsOptions, type ExeOptions, type ExportsOptions, Format, InlineConfig, type Logger, type NoExternalFn, NormalizedFormat, type OutExtensionContext, type OutExtensionFactory, type OutExtensionObject, type PackageJsonWithPath, type PackageType, type PublintOptions, type ReportOptions, ResolvedConfig, type ResolvedDepsConfig, Rolldown, type RolldownChunk, type RolldownContext, type SeaConfig, Sourcemap, type TreeshakingOptions, type TsdownBundle, type TsdownHooks, TsdownInputOption, type TsdownPlugin, type TsdownPluginOption, type UnusedOptions, UserConfig, UserConfigExport, UserConfigFn, WithEnabled, Workspace, build$1 as build, buildWithConfigs, defineConfig, enableDebug, globalLogger, mergeConfig, resolveUserConfig, version };