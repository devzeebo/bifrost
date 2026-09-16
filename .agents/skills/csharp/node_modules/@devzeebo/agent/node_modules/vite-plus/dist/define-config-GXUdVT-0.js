import { c as VITEST_VERSION, r as CONFIG_METADATA_ENV } from "./constants-Bn-U8o4v.js";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { defineConfig, defineProject } from "vitest/config";
//#region ../../node_modules/.pnpm/tsdown@0.22.14_@arethetypeswrong+core@0.18.2_@tsdown+css@0.22.14_@tsdown+exe@0.22.14_@t_4084c24f9f44f250d2b604ebc16f10f3/node_modules/tsdown/esm-shims.js
const getFilename = () => fileURLToPath(import.meta.url);
const getDirname = () => path.dirname(getFilename());
const __dirname = /* @__PURE__ */ getDirname();
//#endregion
//#region src/define-config.ts
/**
* `require` anchored at THIS module's location so `require.resolve` reaches
* the `vitest` / `@vitest/*` family that the `vite-plus` package directly
* depends on — even from a consumer project where they are only transitive.
* Used to locate the bundled `vitest` package (its `package.json`), NOT to
* resolve module ENTRIES: `require.resolve` applies the `require` export
* condition, which selects Vitest's CJS entries — for the bare `vitest` root
* a throw-stub (`index.cjs` — "Vitest cannot be imported … using require()"),
* and for subpaths the CJS build (e.g. `vitest/config` → `config.cjs`) rather
* than the ESM entry the test server's module graph needs. Module entries are
* resolved through Vite's own resolver instead (see
* [[vitePlusVitestResolverPlugin]]), which honours ESM conditions.
*
* `define-config.ts` is bundled by tsdown in BOTH formats: ESM (`shims: true`,
* which defines a module-scoped `__dirname`) and CJS (where `__dirname` is the
* Node global). The guard picks `__dirname` whenever it exists and otherwise
* falls back to `import.meta.url`; tsdown rewrites the latter to
* `pathToFileURL(__filename).href` in the CJS bundle, so it is safe in both.
*/
const vitePlusRequire = createRequire(typeof __dirname !== "undefined" ? __dirname : import.meta.url);
/**
* Absolute path to THIS module, used as a `this.resolve` importer so Vite's
* resolver roots the `vitest` / `@vitest/*` family at `vite-plus`'s own
* location — reaching its direct deps (`vitest`, `vitest/*`, `@vitest/browser*`)
* even from a consumer project where they are only transitive.
*
* `import.meta.url` is native in the ESM bundle and rewritten by tsdown to
* `pathToFileURL(__filename).href` in the CJS bundle, so it is a valid file URL
* in both.
*/
const vitePlusModuleFile = fileURLToPath(import.meta.url);
/**
* Absolute path to the bundled `vitest` package's `package.json`, used as a
* second `this.resolve` importer. The nested `@vitest/*` family (`@vitest/expect`,
* `@vitest/runner`, `@vitest/snapshot`, …) are dependencies of `vitest` itself —
* not direct deps of `vite-plus` — so under pnpm's isolated layout they are
* reachable from `vitest`'s location but not from [[vitePlusModuleFile]].
* Resolving `package.json` is condition-agnostic, so this is safe with
* `require.resolve`. Cached; `null` once an attempt has failed so we never retry.
*/
let vitestAnchor;
function getVitestAnchor() {
	if (vitestAnchor !== void 0) return vitestAnchor;
	try {
		vitestAnchor = vitePlusRequire.resolve("vitest/package.json");
	} catch {
		vitestAnchor = null;
	}
	return vitestAnchor;
}
/**
* Match the `vitest` / `@vitest/*` family of bare specifiers — the imports a
* browser-mode Vite dev server must resolve. Any query string is stripped
* first; relative (`./`), absolute (`/`), and virtual (`\0`) ids never match.
*
* Exported for unit testing.
*/
function isVitestFamilySpecifier(id) {
	const bare = id.split("?")[0];
	if (bare.startsWith(".") || bare.startsWith("/") || bare.startsWith("\0")) return false;
	return bare === "vitest" || bare.startsWith("vitest/") || bare === "@vitest/browser" || bare.startsWith("@vitest/");
}
/**
* Rescue `vitest` / `@vitest/*` resolution for browser-mode tests.
*
* In an established project that depends only on `vite-plus`, both `vitest`
* and `@vitest/browser` are transitive deps. pnpm's isolated layout only
* exposes a package's *direct* deps, so the browser-mode Vite dev server
* (rooted at the consumer project) cannot resolve `vitest/internal/browser`,
* `@vitest/expect`, etc. Non-browser tests are unaffected — vitest's own
* module runner handles resolution there.
*
* This plugin re-resolves the `vitest` / `@vitest/*` family through Vite's OWN
* resolver, but ROOTED at `vite-plus`'s location ([[vitePlusModuleFile]]) and
* then the bundled `vitest`'s location ([[getVitestAnchor]]) BEFORE the
* project. So every such import binds to the same physical (pinned) Vitest that
* `vp test` spawns as the runner (see `resolveBundled` in `resolve-test.ts`)
* and that the `vite-plus/test*` shims re-export. Were a project-local Vitest
* preferred instead, a project that keeps its own `vitest` dependency would
* split the run across two physical Vitest module instances — the runner
* (bundled) vs. the test files' `vi`/`expect`/runner internals (project) — a
* classic source of internal-state and mock-hoisting mismatches. For the common
* migrated layout (a project depending only on `vite-plus`) nothing in this
* family is resolvable from the project root under pnpm's isolated layout
* anyway, so default resolution would return `null` there regardless;
* bundle-first only changes the project-keeps-its-own-`vitest` case, which is
* exactly the case we want pinned.
*
* Resolution goes through `this.resolve` (NOT [[vitePlusRequire]].resolve) so
* Vite's ESM export conditions are honoured: a raw `require.resolve` would pick
* Vitest's CJS `require`-condition entry — a throw-stub for the bare `vitest`
* root (`index.cjs`), and the CJS build for subpaths (e.g. `vitest/config` →
* `config.cjs`) instead of the ESM entry. Two bundled anchors are tried because `@vitest/browser*` are
* direct deps of `vite-plus` (reachable from [[vitePlusModuleFile]]) while the
* nested `@vitest/*` family are deps of `vitest` (reachable only from the
* `vitest` anchor). The project root remains the last resort for any family id
* the bundled tree cannot resolve, so this is never worse than deferring first.
*
* Two intentional limits of routing through `this.resolve`:
*   - An EXPLICIT project `resolve.alias` / `resolve.dedupe` on the vitest
*     family takes precedence (Vite's pipeline applies it even from a bundled
*     anchor). Neither is set by default in Vitest 4.x, so this only affects
*     projects that deliberately re-point the family — treated as an opt-out of
*     pinning, not defeated silently.
*   - Coverage providers (`@vitest/coverage-v8` / `-istanbul`) are NOT shipped
*     with `vite-plus`, so they hit the project fallback below. Under
*     `--coverage`, a project-installed provider of a different version pairs
*     with the bundled runner; Vitest only WARNS on the version skew and then
*     runs mixed versions (its provider `_initialize` logs and continues, it
*     does not throw), which silently yields unreliable coverage — so
*     [[vitePlusCoverageVersionGuardPlugin]] fails fast on a mismatch instead.
*/
function vitePlusVitestResolverPlugin() {
	return {
		name: "vite-plus:vitest-resolver",
		enforce: "pre",
		async resolveId(id, importer, options) {
			if (!isVitestFamilySpecifier(id)) return null;
			if (id.includes("?")) return null;
			const vitestAnchorPath = getVitestAnchor();
			const bundledAnchors = vitestAnchorPath ? [vitePlusModuleFile, vitestAnchorPath] : [vitePlusModuleFile];
			for (const anchor of bundledAnchors) {
				const resolved = await this.resolve(id, anchor, {
					...options,
					skipSelf: true
				});
				if (resolved) return resolved;
			}
			return this.resolve(id, importer, {
				...options,
				skipSelf: true
			});
		}
	};
}
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
const AUTO_INLINE_DEPS = [
	"@testing-library/jest-dom",
	"@storybook/test",
	"jest-extended"
];
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
function computeAutoInlineList(existingInline, projectRoot, _createRequire = createRequire) {
	if (existingInline === true) return null;
	const projectRequire = _createRequire(`${projectRoot}/package.json`);
	const merged = Array.isArray(existingInline) ? [...existingInline] : [];
	for (const pkg of AUTO_INLINE_DEPS) {
		if (merged.some((entry) => entry === pkg || entry instanceof RegExp && entry.test(pkg))) continue;
		try {
			projectRequire.resolve(pkg);
		} catch {
			continue;
		}
		merged.push(pkg);
	}
	const hadEntries = Array.isArray(existingInline) ? existingInline.length : 0;
	if (merged.length === hadEntries) return null;
	return merged;
}
function vitePlusAutoInlineMatcherPlugin() {
	return {
		name: "vite-plus:auto-inline-matcher-deps",
		enforce: "pre",
		configResolved(resolvedConfig) {
			const testConfig = resolvedConfig.test;
			const merged = computeAutoInlineList(testConfig?.server?.deps?.inline, resolvedConfig.root);
			if (merged === null) return;
			if (!testConfig) resolvedConfig.test = { server: { deps: { inline: merged } } };
			else {
				if (!testConfig.server) testConfig.server = {};
				if (!testConfig.server.deps) testConfig.server.deps = {};
				testConfig.server.deps.inline = merged;
			}
		}
	};
}
/** Coverage providers vite-plus can version-check against the bundled runner. */
const KNOWN_COVERAGE_PROVIDERS = /* @__PURE__ */ new Set(["v8", "istanbul"]);
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
function resolveCoverageProviderToCheck(coverage) {
	if (!coverage?.enabled) return null;
	const name = coverage.provider ?? "v8";
	return KNOWN_COVERAGE_PROVIDERS.has(name) ? `@vitest/coverage-${name}` : null;
}
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
function assertCoverageProviderVersionMatch(providerPackageName, installedVersion, expectedVersion = VITEST_VERSION) {
	if (installedVersion && installedVersion !== expectedVersion) throw new Error(`vite-plus bundles vitest@${expectedVersion}, but ${providerPackageName}@${installedVersion} is installed. A coverage provider must match the test runner version: Vitest only prints a warning on a mismatch and then runs mixed versions, which produces unreliable coverage. Pin ${providerPackageName} to ${expectedVersion} in your dependencies.`);
}
/**
* The bundled vitest's `package.json` path — the SAME anchor Vitest's own
* `import('@vitest/coverage-*')` resolves against (its dist walks up from here).
* Used as a fallback resolution anchor for the coverage guard. Lazily computed
* and cached; `null` when the bundled vitest is somehow unreachable, in which
* case the guard simply relies on the project-root anchor.
*/
let bundledVitestAnchorCache;
function bundledVitestAnchor() {
	if (bundledVitestAnchorCache === void 0) try {
		bundledVitestAnchorCache = createRequire(import.meta.url).resolve("vitest/package.json");
	} catch {
		bundledVitestAnchorCache = null;
	}
	return bundledVitestAnchorCache;
}
/**
* Read a project-installed coverage provider's version, mirroring how Vitest
* itself resolves the provider. Vitest install-checks it from BOTH the runner
* root AND its own bundled dir (`isPackageExists(dep, {paths:[root, vitestDir]})`)
* and then loads it via a bare `import('@vitest/coverage-*')` anchored at that
* bundled dir. So the guard tries the project root FIRST — the supported layout
* where a directly-declared provider is symlinked at the root, the same copy the
* bundled vitest walks up to — then falls back to the bundled-vitest anchor,
* which catches hoisted / pnpm peer-set layouts where the provider lives next to
* vitest but is not resolvable from the project root (a silent skip otherwise).
* `@vitest/coverage-*`'s exports map has a `"./*": "./*"` catch-all, so
* `./package.json` is resolvable. Returns `null` when no anchor can resolve it —
* Vitest then emits its own (already clear) missing-provider error.
*
* The `_createRequire` / `_readFile` parameters let tests inject controlled
* resolvers without spying on Node's module/fs namespaces.
*/
function readInstalledCoverageProviderVersion(providerPackageName, projectRoot, _createRequire = createRequire, _readFile = (path) => readFileSync(path, "utf8")) {
	const anchors = [`${projectRoot}/package.json`, bundledVitestAnchor()];
	for (const anchor of anchors) {
		if (!anchor) continue;
		try {
			const pkgJsonPath = _createRequire(anchor).resolve(`${providerPackageName}/package.json`);
			const parsed = JSON.parse(_readFile(pkgJsonPath));
			if (parsed.version) return parsed.version;
		} catch {}
	}
	return null;
}
/**
* Orchestrates the coverage version guard: detect the active provider from
* Vitest's resolved coverage options, read its installed version from the
* project root, and throw on a mismatch. A no-op when coverage is off or the
* provider is not installed.
*
* Exported (with injectable `deps`) for unit testing.
*/
function checkCoverageProviderVersion(coverage, projectRoot, deps = {}) {
	const providerPackageName = resolveCoverageProviderToCheck(coverage);
	if (!providerPackageName) return;
	assertCoverageProviderVersionMatch(providerPackageName, readInstalledCoverageProviderVersion(providerPackageName, projectRoot, deps.createRequire, deps.readFile));
}
/**
* Vitest instances the guard has already handled. The `configureVitest` hook
* fires once PER PROJECT but `vitest` is shared and coverage is global, so this
* runs the whole guard exactly once per instance (and never leaks, since it is
* keyed weakly on identity).
*/
const coverageGuardedVitestInstances = /* @__PURE__ */ new WeakSet();
function vitePlusCoverageVersionGuardPlugin() {
	return {
		name: "vite-plus:coverage-version-guard",
		configureVitest(context) {
			const { vitest } = context;
			if (coverageGuardedVitestInstances.has(vitest)) return;
			coverageGuardedVitestInstances.add(vitest);
			checkCoverageProviderVersion(vitest.config.coverage, vitest.config.root);
			const enableCoverage = vitest.enableCoverage.bind(vitest);
			vitest.enableCoverage = async () => {
				checkCoverageProviderVersion({
					enabled: true,
					provider: vitest.config.coverage?.provider
				}, vitest.config.root);
				return enableCoverage();
			};
		}
	};
}
/**
* Inject the vitest resolver plugin, the auto-inline matcher plugin, and the
* coverage version guard into a single inline project config. Used both for
* root configs and for object-shaped entries inside `test.projects`.
*
* The shapes overlap (both have an optional top-level `plugins` array and
* an optional `test.server.deps.inline`), so a shared helper keeps the
* wiring consistent.
*/
function injectPluginIntoInlineConfig(config) {
	return {
		...config,
		plugins: [
			vitePlusVitestResolverPlugin(),
			vitePlusAutoInlineMatcherPlugin(),
			vitePlusCoverageVersionGuardPlugin(),
			...config.plugins ?? []
		]
	};
}
/**
* Walk `config.test?.projects` and inject the vite-plus plugins into each
* project entry. Vitest spins up an independent Vite pipeline per project, so
* root-level plugins do NOT propagate — without this, files matched by a
* project's `include` glob never get the vitest resolver / auto-inline plugins.
*
* Entry shapes (from `TestProjectConfiguration`):
*   - string  (glob path like `'./packages/*'`)  → passed through unchanged.
*   - object  (inline config with `test: {...}`) → clone and prepend plugin.
*   - function (sync or async)                   → wrap so its result is injected.
*   - Promise (resolves to inline config)        → chain `.then(injectPlugin)`.
*
* String/glob entries cannot be cloned, so they carry no injected plugin. This
* only weakens the COVERAGE guard, and only narrowly: coverage is global, and
* the migration rewrites every nested config file to vite-plus
* `defineConfig`/`defineProject` (which re-inject the guard), so a migrated
* workspace still fires it from its resolved projects. The residual gap is a
* hand-authored workspace whose string globs resolve to raw `vitest/config`
* sub-configs or bare directory projects — there a provider/runner skew falls
* back to Vitest's own (softer) warning instead of the guard's hard error.
*/
function injectPluginIntoProject(project) {
	if (typeof project === "string") return project;
	if (typeof project === "function") {
		const wrapped = (env) => {
			const result = project(env);
			if (result instanceof Promise) return result.then(injectPluginIntoInlineConfig);
			return injectPluginIntoInlineConfig(result);
		};
		return wrapped;
	}
	if (project instanceof Promise) return project.then(injectPluginIntoInlineConfig);
	if (typeof project === "object" && project !== null) return injectPluginIntoInlineConfig(project);
	return project;
}
function injectPlugin(config) {
	const injected = injectPluginIntoInlineConfig(config);
	const projects = injected.test?.projects;
	if (!projects || projects.length === 0) return injected;
	return {
		...injected,
		test: {
			...injected.test,
			projects: projects.map(injectPluginIntoProject)
		}
	};
}
function injectPluginIntoConfig(config) {
	if (typeof config === "function") return (env) => {
		const result = config(env);
		if (result instanceof Promise) return result.then(injectPlugin);
		return injectPlugin(result);
	};
	if (config instanceof Promise) return config.then(injectPlugin);
	return injectPlugin(config);
}
function defineConfig$1(config) {
	return defineConfig(injectPluginIntoConfig(config));
}
/**
* Inject the vite-plus plugins into a `defineProject` export. A project config
* (`UserWorkspaceConfig`) cannot itself nest `test.projects`, so this only
* touches the top-level `plugins` array (no project recursion like
* [[injectPluginIntoConfig]] does).
*/
function injectPluginIntoProjectExport(config) {
	if (typeof config === "function") return (env) => {
		const result = config(env);
		return result instanceof Promise ? result.then(injectPluginIntoInlineConfig) : injectPluginIntoInlineConfig(result);
	};
	if (config instanceof Promise) return config.then(injectPluginIntoInlineConfig);
	return injectPluginIntoInlineConfig(config);
}
function defineProject$1(config) {
	return defineProject(injectPluginIntoProjectExport(config));
}
let configMetadataDepth = 0;
let configMetadataSavedValue;
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
async function withConfigMetadataResolution(fn) {
	if (configMetadataDepth === 0) {
		configMetadataSavedValue = process.env[CONFIG_METADATA_ENV];
		process.env[CONFIG_METADATA_ENV] = "1";
	}
	configMetadataDepth++;
	try {
		return await fn();
	} finally {
		configMetadataDepth--;
		if (configMetadataDepth === 0) {
			if (configMetadataSavedValue === void 0) delete process.env[CONFIG_METADATA_ENV];
			else process.env[CONFIG_METADATA_ENV] = configMetadataSavedValue;
			configMetadataSavedValue = void 0;
		}
	}
}
function lazyPlugins(cb) {
	if (process.env["VP_RESOLVING_CONFIG_METADATA"] === "1") return;
	const result = cb();
	if (result instanceof Promise) return [result];
	return result;
}
//#endregion
export { defineConfig$1 as a, lazyPlugins as c, computeAutoInlineList as i, resolveCoverageProviderToCheck as l, assertCoverageProviderVersionMatch as n, defineProject$1 as o, checkCoverageProviderVersion as r, isVitestFamilySpecifier as s, AUTO_INLINE_DEPS as t, withConfigMetadataResolution as u };
