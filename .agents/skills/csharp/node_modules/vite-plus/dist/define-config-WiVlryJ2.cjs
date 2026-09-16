//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esmMin = (fn, res, err) => () => {
	if (err) throw err[0];
	try {
		return fn && (res = fn(fn = 0)), res;
	} catch (e) {
		throw err = [e], e;
	}
};
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toCommonJS = (mod) => __hasOwnProp.call(mod, "module.exports") ? mod["module.exports"] : __copyProps(__defProp({}, "__esModule", { value: true }), mod);
//#endregion
let node_fs = require("node:fs");
let node_module = require("node:module");
let node_url = require("node:url");
let vitest_config = require("vitest/config");
//#region package.json
var version = "0.3.0", VITE_PLUS_VERSION, VITEST_VERSION, CONFIG_METADATA_ENV;
var init_constants = __esmMin((() => {
	VITE_PLUS_VERSION = process.env.VP_VERSION || version;
	VITEST_VERSION = "4.1.11";
	process.env.VP_OVERRIDE_PACKAGES ? JSON.parse(process.env.VP_OVERRIDE_PACKAGES) : `${VITE_PLUS_VERSION}`;
	(0, node_module.createRequire)(require("url").pathToFileURL(__filename).href);
	process.versions.node, process.release.name;
	CONFIG_METADATA_ENV = "VP_RESOLVING_CONFIG_METADATA";
}));
//#endregion
//#region src/define-config.ts
var define_config_exports = /* @__PURE__ */ __exportAll({
	AUTO_INLINE_DEPS: () => AUTO_INLINE_DEPS,
	assertCoverageProviderVersionMatch: () => assertCoverageProviderVersionMatch,
	checkCoverageProviderVersion: () => checkCoverageProviderVersion,
	computeAutoInlineList: () => computeAutoInlineList,
	defineConfig: () => defineConfig,
	defineProject: () => defineProject,
	isVitestFamilySpecifier: () => isVitestFamilySpecifier,
	lazyPlugins: () => lazyPlugins,
	resolveCoverageProviderToCheck: () => resolveCoverageProviderToCheck,
	withConfigMetadataResolution: () => withConfigMetadataResolution
});
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
function computeAutoInlineList(existingInline, projectRoot, _createRequire = node_module.createRequire) {
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
function bundledVitestAnchor() {
	if (bundledVitestAnchorCache === void 0) try {
		bundledVitestAnchorCache = (0, node_module.createRequire)(require("url").pathToFileURL(__filename).href).resolve("vitest/package.json");
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
function readInstalledCoverageProviderVersion(providerPackageName, projectRoot, _createRequire = node_module.createRequire, _readFile = (path) => (0, node_fs.readFileSync)(path, "utf8")) {
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
function defineConfig(config) {
	return (0, vitest_config.defineConfig)(injectPluginIntoConfig(config));
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
function defineProject(config) {
	return (0, vitest_config.defineProject)(injectPluginIntoProjectExport(config));
}
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
var vitePlusRequire, vitePlusModuleFile, vitestAnchor, AUTO_INLINE_DEPS, KNOWN_COVERAGE_PROVIDERS, bundledVitestAnchorCache, coverageGuardedVitestInstances, configMetadataDepth, configMetadataSavedValue;
var init_define_config = __esmMin((() => {
	init_constants();
	vitePlusRequire = (0, node_module.createRequire)(typeof __dirname !== "undefined" ? __dirname : require("url").pathToFileURL(__filename).href);
	vitePlusModuleFile = (0, node_url.fileURLToPath)(require("url").pathToFileURL(__filename).href);
	AUTO_INLINE_DEPS = [
		"@testing-library/jest-dom",
		"@storybook/test",
		"jest-extended"
	];
	KNOWN_COVERAGE_PROVIDERS = /* @__PURE__ */ new Set(["v8", "istanbul"]);
	coverageGuardedVitestInstances = /* @__PURE__ */ new WeakSet();
	configMetadataDepth = 0;
}));
//#endregion
Object.defineProperty(exports, "AUTO_INLINE_DEPS", {
	enumerable: true,
	get: function() {
		return AUTO_INLINE_DEPS;
	}
});
Object.defineProperty(exports, "__toCommonJS", {
	enumerable: true,
	get: function() {
		return __toCommonJS;
	}
});
Object.defineProperty(exports, "assertCoverageProviderVersionMatch", {
	enumerable: true,
	get: function() {
		return assertCoverageProviderVersionMatch;
	}
});
Object.defineProperty(exports, "checkCoverageProviderVersion", {
	enumerable: true,
	get: function() {
		return checkCoverageProviderVersion;
	}
});
Object.defineProperty(exports, "computeAutoInlineList", {
	enumerable: true,
	get: function() {
		return computeAutoInlineList;
	}
});
Object.defineProperty(exports, "defineConfig", {
	enumerable: true,
	get: function() {
		return defineConfig;
	}
});
Object.defineProperty(exports, "defineProject", {
	enumerable: true,
	get: function() {
		return defineProject;
	}
});
Object.defineProperty(exports, "define_config_exports", {
	enumerable: true,
	get: function() {
		return define_config_exports;
	}
});
Object.defineProperty(exports, "init_define_config", {
	enumerable: true,
	get: function() {
		return init_define_config;
	}
});
Object.defineProperty(exports, "isVitestFamilySpecifier", {
	enumerable: true,
	get: function() {
		return isVitestFamilySpecifier;
	}
});
Object.defineProperty(exports, "lazyPlugins", {
	enumerable: true,
	get: function() {
		return lazyPlugins;
	}
});
Object.defineProperty(exports, "resolveCoverageProviderToCheck", {
	enumerable: true,
	get: function() {
		return resolveCoverageProviderToCheck;
	}
});
Object.defineProperty(exports, "withConfigMetadataResolution", {
	enumerable: true,
	get: function() {
		return withConfigMetadataResolution;
	}
});
