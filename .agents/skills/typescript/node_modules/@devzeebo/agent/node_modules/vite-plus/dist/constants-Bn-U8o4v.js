import { createRequire } from "node:module";
//#region package.json
var version = "0.3.0";
//#endregion
//#region src/utils/constants.ts
const VITE_PLUS_NAME = "vite-plus";
const VITE_PLUS_VERSION = process.env.VP_VERSION || version;
const VITE_CONFIG_FILES = [
	"vite.config.js",
	"vite.config.mjs",
	"vite.config.ts",
	"vite.config.cjs",
	"vite.config.mts",
	"vite.config.cts"
];
const VITEST_VERSION = "4.1.11";
const TSDOWN_MIGRATE_VERSION = "0.23.0-rc.0";
const TSDOWN_MIGRATION_SKILL_URL = "https://github.com/rolldown/tsdown/blob/main/skills/tsdown-migrate/SKILL.md";
const VITE_PLUS_OVERRIDE_PACKAGES = process.env.VP_OVERRIDE_PACKAGES ? JSON.parse(process.env.VP_OVERRIDE_PACKAGES) : {
	vite: `npm:@voidzero-dev/vite-plus-core@${VITE_PLUS_VERSION}`,
	vitest: VITEST_VERSION
};
/**
* Package-name patterns the migrator exempts from a package manager's
* "minimum release age" gate (pnpm `minimumReleaseAgeExclude` / Yarn
* `npmPreapprovedPackages`).
*
* Vite+ pins `vitest` to an exact, sometimes freshly published version, and the
* in-tree `@vitest/*` siblings install transitively at that same version, so an
* age gate would otherwise quarantine the Vite+-managed family and break
* `vp install`. The `@vitest/*` glob also covers the optional `@vitest/browser-*`
* peers the migrator pins for browser projects. This does NOT pin or manage any
* package — it only lets the chosen versions through the user's gate, including
* the `@vitest/coverage-*` version the coverage guard asks the user to align to
* the bundled vitest.
*/
const VITEST_AGE_GATE_EXEMPT_PACKAGES = ["vitest", "@vitest/*"];
/**
* When VP_FORCE_MIGRATE is set, force full dependency rewriting
* even for projects already using vite-plus. Used by ecosystem CI to
* override dependencies with locally built tgz packages.
*/
function isForceOverrideMode() {
	return process.env.VP_FORCE_MIGRATE === "1";
}
const require = createRequire(import.meta.url);
function resolve(path) {
	return require.resolve(path, { paths: [process.cwd(), import.meta.dirname] });
}
/**
* Like {@link resolve}, but prefers the copy shipped with the CLI
* (`import.meta.dirname`) over the project's (`process.cwd()`).
*
* Use this for runtime modules that MUST match what `vite-plus/test*`
* imports resolve to — chiefly the Vitest runner binary. The `vite-plus/test`
* shims `export * from 'vitest'`, which Node resolves to vite-plus's own
* bundled (pinned) Vitest. If `vp test` instead spawned a project-local
* Vitest (a different physical copy/version), the runner and the imported
* `vi`/`expect`/runner internals would come from two distinct Vitest
* modules — a classic source of Vitest internal-state and mock-hoisting
* mismatches. `process.cwd()` stays as a fallback for layouts where the
* bundled copy is somehow unreachable, so this is never worse than {@link resolve}.
*/
function resolveBundled(path) {
	return require.resolve(path, { paths: [import.meta.dirname, process.cwd()] });
}
const BASEURL_TSCONFIG_WARNING = "Skipped typeAware/typeCheck: a tsconfig file contains baseUrl which is not yet supported by the oxlint type checker.\n  Run `vp dlx @andrewbranch/ts5to6 --fixBaseUrl <tsconfig path>` to remove baseUrl from your tsconfig.";
const BASEURL_TSCONFIG_FIX_PACKAGE = "@andrewbranch/ts5to6";
const BASEURL_TSCONFIG_FIX_FLAG = "--fixBaseUrl";
function createBaseUrlTsconfigFixArgs(target = ".") {
	return [BASEURL_TSCONFIG_FIX_FLAG, target];
}
const DEFAULT_ENVS = {
	JS_RUNTIME_VERSION: process.versions.node,
	JS_RUNTIME_NAME: process.release.name,
	NODE_PACKAGE_MANAGER: "vite-plus"
};
const CONFIG_METADATA_ENV = "VP_RESOLVING_CONFIG_METADATA";
//#endregion
export { version as _, TSDOWN_MIGRATE_VERSION as a, VITEST_VERSION as c, VITE_PLUS_OVERRIDE_PACKAGES as d, VITE_PLUS_VERSION as f, resolveBundled as g, resolve as h, DEFAULT_ENVS as i, VITE_CONFIG_FILES as l, isForceOverrideMode as m, BASEURL_TSCONFIG_WARNING as n, TSDOWN_MIGRATION_SKILL_URL as o, createBaseUrlTsconfigFixArgs as p, CONFIG_METADATA_ENV as r, VITEST_AGE_GATE_EXEMPT_PACKAGES as s, BASEURL_TSCONFIG_FIX_PACKAGE as t, VITE_PLUS_NAME as u };
