import { t as PackUserConfig } from "./pack-PvUg_xpv.js";
import { ConfigEnv, UserProjectConfigExport, UserProjectConfigFn, UserWorkspaceConfig } from "vitest/config";
import { PluginOption, UserConfig } from "@voidzero-dev/vite-plus-core";
import { OxfmtConfig } from "oxfmt";
import { OxlintConfig } from "oxlint";
import { InlineConfig } from "vitest/node";
//#region src/create/org-manifest.d.ts
/**
 * A single template entry shared by org manifests (`createConfig.templates`)
 * and local monorepo config (`create.templates` in `vite.config.ts`).
 */
interface CreateTemplateEntry {
  name: string;
  description: string;
  template: string;
}
//#endregion
//#region src/run-config.d.ts
type AutoTracking = {
  /**
   * Enable automatic file tracking for this input or output list.
   */
  auto: boolean;
};
type Command = string | Array<string>;
type DependencyType = "dependencies" | "devDependencies" | "peerDependencies";
type DependsOnEntry = string | UserPackageDependency;
type DependsOnFrom = DependencyType | Array<DependencyType>;
type GlobWithBase = {
  /**
   * The glob pattern (positive or negative starting with `!`)
   */
  pattern: string;
  /**
   * The base directory for resolving the pattern
   */
  base: InputBase;
};
type InputBase = "package" | "workspace";
type Task = {
  /**
   * Command to run, or an array of commands to run in order.
   */
  command: Command;
  /**
   * The working directory for the task, relative to the package root (not workspace root).
   */
  cwd?: string;
  /**
   * Tasks that must run before this task.
   *
   * - A string runs one named task, such as `"build"` in the same package or
   *   `"package-name#build"` in another package.
   * - An object runs a task in direct workspace dependency packages selected
   *   from package.json fields. For example,
   *   `{ "task": "build", "from": "dependencies" }` runs `build` in each
   *   direct workspace dependency that defines a `build` task.
   */
  dependsOn?: Array<DependsOnEntry>;
} & ({
  /**
   * Whether to cache the task
   */
  cache?: true;
  /**
   * Environment variable names to be fingerprinted and passed to the task.
   */
  env?: Array<string>;
  /**
   * Environment variable names to be passed to the task without fingerprinting.
   */
  untrackedEnv?: Array<string>;
  /**
   * Files to include in the cache fingerprint.
   *
   * - Omitted: automatically tracks which files the task reads
   * - `[]` (empty): disables file tracking entirely
   * - Glob patterns (e.g. `"src/**"`) select specific files, relative to the package directory
   * - `{pattern: "...", base: "workspace" | "package"}` specifies a glob with an explicit base directory
   * - `{auto: true}` enables automatic file tracking
   * - Negative patterns (e.g. `"!dist/**"`) exclude matched files
   */
  input?: Array<string | GlobWithBase | AutoTracking>;
  /**
   * Output files to archive and restore on cache hit.
   *
   * - Omitted: automatically tracks which files the task writes
   * - `[]` (empty): disables output restoration entirely
   * - Glob patterns (e.g. `"dist/**"`) select specific output files, relative to the package directory
   * - `{pattern: "...", base: "workspace" | "package"}` specifies a glob with an explicit base directory
   * - `{auto: true}` enables automatic output tracking
   * - Negative patterns (e.g. `"!dist/cache/**"`) exclude matched files
   */
  output?: Array<string | GlobWithBase | AutoTracking>;
} | {
  /**
   * Whether to cache the task
   */
  cache: false;
});
type TaskDefinition = Task | Command;
type UserGlobalCacheConfig = boolean | {
  /**
   * Enable caching for package.json scripts not defined in the `tasks` map.
   *
   * When `false`, package.json scripts will not be cached.
   * When `true`, package.json scripts will be cached with default settings.
   *
   * Default: `false`
   */
  scripts?: boolean;
  /**
   * Global cache kill switch for task entries.
   *
   * When `false`, overrides all tasks to disable caching, even tasks with `cache: true`.
   * When `true`, respects each task's individual `cache` setting
   * (each task's `cache` defaults to `true` if omitted).
   *
   * Default: `true`
   */
  tasks?: boolean;
};
type UserPackageDependency = {
  /**
   * Task name to run in dependency packages.
   */
  task: string;
  /**
   * Package.json dependency field or fields to use when selecting direct dependency packages.
   */
  from: DependsOnFrom;
};
type RunConfig = {
  /**
   * Root-level cache configuration.
   *
   * This option can only be set in the workspace root's config file.
   * Setting it in a package's config will result in an error.
   */
  cache?: UserGlobalCacheConfig;
  /**
   * Task definitions: full task objects, command strings, or command string arrays.
   */
  tasks?: { [key in string]: TaskDefinition; };
  /**
   * Whether to automatically run `preX`/`postX` package.json scripts as
   * lifecycle hooks when script `X` is executed.
   *
   * When `true` (the default), running script `test` will automatically
   * run `pretest` before and `posttest` after, if they exist.
   *
   * This option can only be set in the workspace root's config file.
   * Setting it in a package's config will result in an error.
   */
  enablePrePostScripts?: boolean;
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/index.d.ts
type SyncGenerateTask = (stagedFileNames: readonly string[]) => string | string[];
type AsyncGenerateTask = (stagedFileNames: readonly string[]) => Promise<string | string[]>;
type GenerateTask = SyncGenerateTask | AsyncGenerateTask;
type TaskFunction = {
  title: string;
  task: (stagedFileNames: readonly string[]) => void | Promise<void>;
};
type Configuration = Record<string, string | TaskFunction | GenerateTask | (string | GenerateTask)[]> | GenerateTask;
//#endregion
//#region src/staged-config.d.ts
type StagedConfig = Configuration;
//#endregion
//#region src/define-config.d.ts
declare module '@voidzero-dev/vite-plus-core' {
  interface UserConfig {
    /**
     * Options for oxlint
     */
    lint?: OxlintConfig;
    fmt?: OxfmtConfig;
    /**
     * Defaults for the `vp check` composite command. Each flag mirrors the
     * matching CLI option (`--no-fmt` / `--no-lint`) and only affects
     * `vp check`; standalone `vp fmt` / `vp lint` are unaffected.
     */
    check?: {
      /**
       * Run the format step in `vp check`.
       * @default true
       */
      fmt?: boolean;
      /**
       * Run the lint step in `vp check`. Type-check still runs when both
       * `lint.options.typeAware` and `lint.options.typeCheck` are enabled.
       * @default true
       */
      lint?: boolean;
    };
    pack?: PackUserConfig | PackUserConfig[];
    /**
     * Default target directory for `vp dev` / `build` / `preview` / `pack`
     * when invoked bare in the directory containing this config (an implicit
     * `vp -C <dir>`). A string targets all four commands; an object maps
     * commands individually, and a command absent from the object falls
     * through to the normal picker/listing resolution. Paths are relative to
     * the config file's directory. vp reads them without executing the
     * config, so this also works at roots with no vite-plus dependency; the
     * static read is why the values must stay plain string literals.
     */
    defaultPackage?: string | {
      dev?: string;
      build?: string;
      preview?: string;
      pack?: string;
    };
    run?: RunConfig;
    staged?: StagedConfig;
    /**
     * Options for `vp create`.
     *
     * See `rfcs/create-org-default-templates.md` for the full specification.
     */
    create?: {
      /**
       * When `vp create` is invoked with no template argument, use this
       * value as if the user had typed it — typically a scope like
       * `'@your-org'` paired with a `@your-org/create` package that exposes a
       * `createConfig.templates` manifest. Can also name a local
       * `create.templates` entry.
       */
      defaultTemplate?: string;
      /**
       * Local templates available to `vp create` inside this monorepo. Each
       * entry is shown in the `vp create` picker by `name`/`description`; its
       * `template` resolves like any specifier (a workspace package name, a
       * relative `./path`, a `vite:*` builtin, a GitHub URL, or an npm package).
       */
      templates?: CreateTemplateEntry[];
    };
    /**
     * Vitest test configuration.
     *
     * Vitest augments vite's `UserConfig` with a `test` field via
     * `declare module 'vite'`, but vite-plus-core is a fork of vite so that
     * augmentation does not apply here. Re-declare it locally so user
     * configs like `defineConfig({ test: { globals: true } })` typecheck.
     */
    test?: InlineConfig;
  }
}
type ViteUserConfigFnObject = (env: ConfigEnv) => UserConfig;
type ViteUserConfigFnPromise = (env: ConfigEnv) => Promise<UserConfig>;
type ViteUserConfigFn = (env: ConfigEnv) => UserConfig | Promise<UserConfig>;
type ViteUserConfigExport = UserConfig | Promise<UserConfig> | ViteUserConfigFnObject | ViteUserConfigFnPromise | ViteUserConfigFn;
/**
 * Match the `vitest` / `@vitest/*` family of bare specifiers — the imports a
 * browser-mode Vite dev server must resolve. Any query string is stripped
 * first; relative (`./`), absolute (`/`), and virtual (`\0`) ids never match.
 *
 * Exported for unit testing.
 */
declare function isVitestFamilySpecifier(id: string): boolean;
/**
 * Packages that register Vitest `expect` matchers via `expect.extend()` from
 * a side-effect import. When Vite serves these from a separate module graph
 * than the test runtime, the matchers register on a different `expect`
 * instance and `expect(...).<matcher>` is undefined at call time (vitest
 * issue #897). Inlining them into the test server's module graph forces
 * registration on the same instance.
 *
 * Only packages that are **installed** in the consumer project are inlined.
 * Absent packages are silently skipped so the server-deps optimizer never
 * tries to resolve a name that does not exist in the project's node_modules.
 *
 * The check is deferred to a `configResolved` plugin hook so that
 * `resolvedConfig.root` points at the actual project root (the value vite has
 * already normalised), rather than relying on `process.cwd()` at config-load
 * time (which can differ in workspace / monorepo setups).
 *
 * Exported for unit testing.
 */
declare const AUTO_INLINE_DEPS: ReadonlyArray<string>;
/**
 * Compute the merged `test.server.deps.inline` list for a given project root,
 * appending only those entries from [[AUTO_INLINE_DEPS]] that are actually
 * installed in the project.
 *
 * Returns `null` when nothing needs to change (either `inline: true` or an
 * empty result), so the caller can skip the mutation step.
 *
 * Exported for unit testing. The `_createRequire` parameter lets tests inject
 * a controlled resolver without needing to spy on Node's ESM module namespace.
 */
declare function computeAutoInlineList(existingInline: (string | RegExp)[] | true | undefined, projectRoot: string, _createRequire?: (from: string) => {
  resolve: (id: string) => string;
}): (string | RegExp)[] | null;
/**
 * Resolve the coverage provider package name that should be version-checked, or
 * `null` when no check applies (coverage off, or a `custom`/unknown provider
 * vite-plus does not bundle a runner for).
 *
 * Takes Vitest's OWN resolved coverage options (`enabled`/`provider`), which the
 * `configureVitest` hook exposes AFTER Vitest's CLI parser has run — so the
 * `--coverage` family of flags is already folded into `enabled`/`provider` and
 * we never re-parse `process.argv` ourselves. Unset `provider` defaults to `v8`
 * (Vitest's default).
 *
 * Exported for unit testing.
 */
declare function resolveCoverageProviderToCheck(coverage: {
  enabled?: boolean;
  provider?: string;
} | undefined): string | null;
/**
 * vite-plus bundles `vitest@VITEST_VERSION` as the test runner, but coverage
 * providers (`@vitest/coverage-v8` / `-istanbul`) are project-installed peer
 * deps it does not ship. Vitest only PRINTS A WARNING on a provider/runner
 * version skew and then runs mixed versions (verified in 4.1.9: the provider's
 * `_initialize` calls `logger.warn`, it never throws), silently producing
 * unreliable coverage. Fail fast instead.
 *
 * Exported for unit testing.
 */
declare function assertCoverageProviderVersionMatch(providerPackageName: string, installedVersion: string | null | undefined, expectedVersion?: string): void;
/**
 * Orchestrates the coverage version guard: detect the active provider from
 * Vitest's resolved coverage options, read its installed version from the
 * project root, and throw on a mismatch. A no-op when coverage is off or the
 * provider is not installed.
 *
 * Exported (with injectable `deps`) for unit testing.
 */
declare function checkCoverageProviderVersion(coverage: {
  enabled?: boolean;
  provider?: string;
} | undefined, projectRoot: string, deps?: {
  createRequire?: (from: string) => {
    resolve: (id: string) => string;
  };
  readFile?: (path: string) => string;
}): void;
declare function defineConfig$1(config: UserConfig): UserConfig;
declare function defineConfig$1(config: Promise<UserConfig>): Promise<UserConfig>;
declare function defineConfig$1(config: ViteUserConfigFnObject): ViteUserConfigFnObject;
declare function defineConfig$1(config: ViteUserConfigFnPromise): ViteUserConfigFnPromise;
declare function defineConfig$1(config: ViteUserConfigExport): ViteUserConfigExport;
/**
 * `defineProject` counterpart of [[defineConfig]]. A migrated project config
 * that uses `defineProject({ test: { browser: ... } })` — e.g. a file named by
 * a string `test.projects` entry — must still receive the vite-plus resolver /
 * auto-inline plugins, or a browser project can fail to resolve `vitest` /
 * `@vitest/*` from its own root under pnpm strict / Yarn PnP. The raw
 * `vitest/config` helper does not add them.
 */
declare function defineProject$1(config: UserWorkspaceConfig): UserWorkspaceConfig;
declare function defineProject$1(config: Promise<UserWorkspaceConfig>): Promise<UserWorkspaceConfig>;
declare function defineProject$1(config: UserProjectConfigFn): UserProjectConfigFn;
declare function defineProject$1(config: UserProjectConfigExport): UserProjectConfigExport;
/**
 * Run a config-metadata resolution (a `resolveConfig` call that loads the
 * user's config purely to read a non-plugin block) with the metadata marker
 * set, so any `lazyPlugins` evaluated during it skips the plugin factory.
 *
 * The marker is scoped in time, not by command name: it is set only while at
 * least one resolution is in flight (ref-counted so overlapping/nested
 * resolutions compose) and the prior value is restored afterwards. By the time
 * the task runner spawns a child (a verbatim `vp run` build, a `vp exec`
 * child), the marker is already gone, so those builds correctly load plugins.
 * Keying on the resolution itself — rather than guessing from the command
 * name — also means command aliases (`vp format`) and not-yet-known commands
 * all load plugins.
 */
declare function withConfigMetadataResolution<T>(fn: () => Promise<T>): Promise<T>;
declare function lazyPlugins(cb: () => PluginOption[]): PluginOption[] | undefined;
declare function lazyPlugins(cb: () => Promise<PluginOption[]>): PluginOption[] | undefined;
//#endregion
export { defineConfig$1 as a, lazyPlugins as c, computeAutoInlineList as i, resolveCoverageProviderToCheck as l, assertCoverageProviderVersionMatch as n, defineProject$1 as o, checkCoverageProviderVersion as r, isVitestFamilySpecifier as s, AUTO_INLINE_DEPS as t, withConfigMetadataResolution as u };