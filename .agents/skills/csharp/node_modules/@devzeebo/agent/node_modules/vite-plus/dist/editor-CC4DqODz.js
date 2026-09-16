import { r as __toESM } from "./rolldown-runtime-CMFfr-1z.js";
import { a as TSDOWN_MIGRATE_VERSION, c as VITEST_VERSION, d as VITE_PLUS_OVERRIDE_PACKAGES, f as VITE_PLUS_VERSION, l as VITE_CONFIG_FILES, m as isForceOverrideMode, n as BASEURL_TSCONFIG_WARNING, o as TSDOWN_MIGRATION_SKILL_URL, s as VITEST_AGE_GATE_EXEMPT_PACKAGES, u as VITE_PLUS_NAME } from "./constants-Bn-U8o4v.js";
import { i as ensureVitePlusImportRuleDefaults, r as createDefaultVitePlusLintConfig } from "./oxlint-plugin-config-DX5ezKbB.js";
import { A as isCancel, C as log, E as select, _ as getSpinner, b as require_semver, d as readYamlFile, f as scalarString, g as getSilentSpinner, t as cancelAndExit, u as editYamlFile, w as multiselect, x as confirm, y as PackageManager } from "./prompts-DF3yU-eU.js";
import { a as writeJsonFile, c as parse, i as readJsonFile, n as editJsonFile, o as applyEdits, r as isJsonFile, s as modify, t as detectFormattingOptions } from "./json-cULBl7Pi.js";
import { n as detectPackageMetadata, r as getScopeFromPackageName } from "./package-CBe9EWPY.js";
import { l as displayRelative, u as rulesDir } from "./agent-Wqx0MPk0.js";
import { n as addMigrationWarning, t as addManualStep } from "./report-ZNR1Mk6h.js";
import { n as runCommandSilently, r as require_cross_spawn } from "./command-CguLh2KL.js";
import { t as require_dist } from "./dist-BDYZP12R.js";
import { a as hasBaseUrlInTsconfig, c as hasVitestTypesInTsconfig, l as removeDeprecatedTsconfigFalseOption, n as findTsconfigFiles, s as hasTypesToRewriteInTsconfig, u as rewriteTypesInTsconfig } from "./tsconfig-LD2QhQ0O.js";
import { a as findUnsafeHookInstallPath, n as SUPPORTED_GIT_HOOK_NAMES } from "./hooks-DFqViZqZ.js";
import path, { posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { detectWorkspace, getVpDirs, hasConfigKey, mergeJsonConfig, mergeTsdownConfig, rewriteEslint, rewriteImportsInDirectory, rewritePrettier, rewriteScripts, wrapLazyPlugins } from "../binding/index.js";
import { styleText } from "node:util";
import * as actualFS from "node:fs";
import fs from "node:fs";
import os from "node:os";
import "oxlint";
import { lstatSync as lstatSync$1, readdir, readdirSync as readdirSync$1, readlinkSync, realpathSync as realpathSync$1 } from "fs";
import fsPromises, { lstat, readdir as readdir$1, readlink, realpath } from "node:fs/promises";
import { EventEmitter } from "node:events";
import Stream from "node:stream";
import { StringDecoder } from "node:string_decoder";
//#region src/migration/migrator/shared.ts
var import_semver = /* @__PURE__ */ __toESM(require_semver(), 1);
const LINT_STAGED_JSON_CONFIG_FILES = [".lintstagedrc.json", ".lintstagedrc"];
const LINT_STAGED_OTHER_CONFIG_FILES = [
	".lintstagedrc.yaml",
	".lintstagedrc.yml",
	".lintstagedrc.mjs",
	"lint-staged.config.mjs",
	".lintstagedrc.cjs",
	"lint-staged.config.cjs",
	".lintstagedrc.js",
	"lint-staged.config.js",
	".lintstagedrc.ts",
	"lint-staged.config.ts",
	".lintstagedrc.mts",
	"lint-staged.config.mts",
	".lintstagedrc.cts",
	"lint-staged.config.cts"
];
const LINT_STAGED_ALL_CONFIG_FILES = [...LINT_STAGED_JSON_CONFIG_FILES, ...LINT_STAGED_OTHER_CONFIG_FILES];
const REMOVE_PACKAGES = [
	"oxlint",
	"oxlint-tsgolint",
	"oxfmt",
	"tsdown",
	"@vitest/browser",
	"@vitest/browser-preview"
];
const WEBDRIVERIO_PROVIDER = "@vitest/browser-webdriverio";
const PLAYWRIGHT_PROVIDER = "@vitest/browser-playwright";
const OPT_IN_BROWSER_PROVIDERS = [WEBDRIVERIO_PROVIDER, PLAYWRIGHT_PROVIDER];
const PROVIDER_OVERRIDE_DROP_NAMES = [...REMOVE_PACKAGES, ...OPT_IN_BROWSER_PROVIDERS];
const BROWSER_PROVIDER_PEER_DEPS = {
	"@vitest/browser-playwright": "playwright",
	"@vitest/browser-webdriverio": "webdriverio"
};
const PROVIDER_PEER_VERSION_SIBLINGS = {
	playwright: ["@playwright/test"],
	webdriverio: ["@wdio/cli", "@wdio/globals"]
};
function findDeclaredSpec(pkg, name) {
	return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? pkg.peerDependencies?.[name] ?? pkg.optionalDependencies?.[name];
}
function resolveProviderPeerSpec(pkg, peer, supportCatalog, catalogDependencyResolver) {
	if (supportCatalog && catalogDependencyResolver?.("catalog:", peer) !== void 0) return "catalog:";
	for (const sibling of PROVIDER_PEER_VERSION_SIBLINGS[peer] ?? []) {
		const spec = findDeclaredSpec(pkg, sibling);
		const resolved = spec?.startsWith("catalog:") ? catalogDependencyResolver?.(spec, sibling) : spec;
		if (resolved && !resolved.includes(":")) return resolved;
	}
	return "*";
}
const VITEST_BROWSER_DEP_NAMES = [
	"@vitest/browser",
	"@vitest/browser-preview",
	"@vitest/browser-playwright",
	"@vitest/browser-webdriverio"
];
const VITEST_IS_MANAGED_OVERRIDE = "vitest" in VITE_PLUS_OVERRIDE_PACKAGES;
const LEGACY_WRAPPER_FALLBACK_VERSIONS = { vitest: VITEST_VERSION };
/**
* Managed pnpm override keys use an explicit `@*` range, not a bare package
* name: `vite@*`, not `vite`.
*
* pnpm applies overrides through a read-package hook. The hook replaces the
* declared spec on every manifest, importer manifests included, before
* resolution runs. A bare override key has no range, and pnpm treats a key with
* no range as a match for every declared spec. That includes `catalog:`. An
* importer that declares `vite: "catalog:"` therefore loses its link to the
* catalog during resolution, and `pnpm update` then writes the resolved core
* alias into that importer's package.json (issue #2309).
*
* The `@*` range keeps the override on the declared semver ranges that
* transitive and peer `vite` declarations use. Those declarations are the
* reason this override exists. The range leaves `catalog:` specs alone, because
* `catalog:` is not a valid semver range, so pnpm's `isIntersectingRange`
* rejects it before it compares anything. The installed result does not change:
* an importer that references the catalog already resolves to the aliased core
* through its catalog entry.
*
* Known gap on pnpm 9 to 11: a declaration that pins an EXACT prerelease, such
* as `vite: "8.0.0-beta.18"`, escapes the override. pnpm compares with
* `semver.intersects(declaredSpec, keyRange)`. That call is asymmetric for
* prereleases: it returns false for an exact prerelease against a wildcard
* range. The reversed argument order returns true. No range string avoids
* this, because node-semver only admits a prerelease when a comparator carries
* the same version tuple. A prerelease RANGE such as `^8.0.0-beta.1` still
* matches. pnpm 12 matches the exact form too. A bare key would cover this
* case, but a bare key is what clobbers `catalog:` specs. Below pnpm 12,
* prerelease coverage and `catalog:` safety cannot both hold.
*
* This applies to pnpm only. npm and bun `overrides`, and yarn `resolutions`,
* keep bare keys. Those package managers have no `catalog:` importer specs to
* lose. Bun catalogs live in package.json, and bun resolves them before it
* applies overrides.
*/
function pnpmOverrideKey(dependencyName) {
	return `${dependencyName}@*`;
}
function managedOverrideKey(dependencyName, keyStyle) {
	return keyStyle === "pnpm-ranged" ? pnpmOverrideKey(dependencyName) : dependencyName;
}
function warnMigration(message, report) {
	addMigrationWarning(report, message);
	if (!report) log.warn(message);
}
function infoMigration(message, report) {
	addManualStep(report, message);
	if (!report) log.info(message);
}
function checkViteVersion(projectPath) {
	return checkPackageVersion(projectPath, "vite", "7.0.0");
}
function checkVitestVersion(projectPath) {
	return checkPackageVersion(projectPath, "vitest", "4.0.0");
}
/**
* Check the package version is supported by auto migration
* @param projectPath - The path to the project
* @param name - The name of the package
* @param minVersion - The minimum version of the package
* @returns true if the package version is supported by auto migration
*/
function checkPackageVersion(projectPath, name, minVersion) {
	const metadata = detectPackageMetadata(projectPath, name);
	if (!metadata || metadata.name !== name) return true;
	if (import_semver.default.satisfies(metadata.version, `<${minVersion}`)) {
		const packageJsonFilePath = path.join(projectPath, "package.json");
		log.error(`✘ ${name}@${metadata.version} in ${displayRelative(packageJsonFilePath)} is not supported by auto migration`);
		log.info(`Please upgrade ${name} to version >=${minVersion} first`);
		return false;
	}
	return true;
}
function isPlainRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function readPackageJsonIfExists(packageJsonPath) {
	if (!fs.existsSync(packageJsonPath)) return;
	try {
		return readJsonFile(packageJsonPath);
	} catch {
		return;
	}
}
function pnpmMajor(version) {
	const coerced = version ? import_semver.default.coerce(version)?.version : void 0;
	return coerced ? import_semver.default.major(coerced) : void 0;
}
//#endregion
//#region src/migration/detector.ts
const PRETTIER_PACKAGE_JSON_CONFIG = "package.json#prettier";
const TSUP_PACKAGE_JSON_CONFIG = "package.json#tsup";
const TSUP_CONFIG_FILES = [
	"tsup.config.ts",
	"tsup.config.mts",
	"tsup.config.cts",
	"tsup.config.js",
	"tsup.config.mjs",
	"tsup.config.cjs",
	"tsup.config.json"
];
const PRETTIER_CONFIG_FILES = [
	".prettierrc",
	".prettierrc.json",
	".prettierrc.jsonc",
	".prettierrc.yaml",
	".prettierrc.yml",
	".prettierrc.toml",
	".prettierrc.js",
	".prettierrc.cjs",
	".prettierrc.mjs",
	".prettierrc.ts",
	".prettierrc.cts",
	".prettierrc.mts",
	"prettier.config.js",
	"prettier.config.cjs",
	"prettier.config.mjs",
	"prettier.config.ts",
	"prettier.config.cts",
	"prettier.config.mts"
];
function detectConfigs(projectPath) {
	const configs = {};
	for (const config of VITE_CONFIG_FILES) if (fs.existsSync(path.join(projectPath, config))) {
		configs.viteConfig = config;
		break;
	}
	for (const config of [
		"vitest.config.ts",
		"vitest.config.mts",
		"vitest.config.cts",
		"vitest.config.js",
		"vitest.config.mjs",
		"vitest.config.cjs"
	]) if (fs.existsSync(path.join(projectPath, config))) {
		configs.vitestConfig = config;
		break;
	}
	for (const config of [
		"tsdown.config.ts",
		"tsdown.config.mts",
		"tsdown.config.cts",
		"tsdown.config.js",
		"tsdown.config.mjs",
		"tsdown.config.cjs",
		"tsdown.config.json",
		"tsdown.config"
	]) if (fs.existsSync(path.join(projectPath, config))) {
		configs.tsdownConfig = config;
		break;
	}
	for (const config of TSUP_CONFIG_FILES) if (fs.existsSync(path.join(projectPath, config))) {
		configs.tsupConfig = config;
		break;
	}
	for (const config of [".oxlintrc.json", ".oxlintrc.jsonc"]) if (fs.existsSync(path.join(projectPath, config))) {
		configs.oxlintConfig = config;
		break;
	}
	for (const config of [".oxfmtrc.json", ".oxfmtrc.jsonc"]) if (fs.existsSync(path.join(projectPath, config))) {
		configs.oxfmtConfig = config;
		break;
	}
	for (const config of [
		"eslint.config.js",
		"eslint.config.mjs",
		"eslint.config.cjs",
		"eslint.config.ts",
		"eslint.config.mts",
		"eslint.config.cts"
	]) if (fs.existsSync(path.join(projectPath, config))) {
		configs.eslintConfig = config;
		break;
	}
	for (const config of [
		".eslintrc",
		".eslintrc.json",
		".eslintrc.js",
		".eslintrc.cjs",
		".eslintrc.yaml",
		".eslintrc.yml"
	]) if (fs.existsSync(path.join(projectPath, config))) {
		configs.eslintLegacyConfig = config;
		break;
	}
	for (const config of PRETTIER_CONFIG_FILES) if (fs.existsSync(path.join(projectPath, config))) {
		configs.prettierConfig = config;
		break;
	}
	if (fs.existsSync(path.join(projectPath, ".prettierignore"))) configs.prettierIgnore = true;
	if (fs.existsSync(path.join(projectPath, ".nvmrc"))) configs.nvmrcFile = true;
	const packageJsonPath = path.join(projectPath, "package.json");
	if (fs.existsSync(packageJsonPath)) try {
		const content = fs.readFileSync(packageJsonPath, "utf8");
		const pkg = JSON.parse(content);
		if (!configs.prettierConfig && pkg.prettier) configs.prettierConfig = PRETTIER_PACKAGE_JSON_CONFIG;
		if (!configs.tsupConfig && pkg.tsup) configs.tsupConfig = TSUP_PACKAGE_JSON_CONFIG;
		const voltaNode = pkg.volta?.node;
		if (typeof voltaNode === "string") configs.voltaNode = voltaNode;
	} catch {}
	return configs;
}
//#endregion
//#region src/migration/migrator/eslint.ts
const OXLINT_NATIVE_PLUGINS = /* @__PURE__ */ new Set([
	"eslint",
	"react",
	"unicorn",
	"typescript",
	"oxc",
	"import",
	"jsdoc",
	"jest",
	"vitest",
	"jsx-a11y",
	"nextjs",
	"react-perf",
	"promise",
	"node",
	"vue"
]);
function detectEslintProject(projectPath, packages) {
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return { hasDependency: false };
	const pkg = readJsonFile(packageJsonPath);
	let hasDependency = !!(pkg.devDependencies?.eslint || pkg.dependencies?.eslint);
	const configs = detectConfigs(projectPath);
	let configFile = configs.eslintConfig;
	const legacyConfigFile = configs.eslintLegacyConfig;
	if (!hasDependency && packages) for (const wp of packages) {
		const pkgJsonPath = path.join(projectPath, wp.path, "package.json");
		if (!fs.existsSync(pkgJsonPath)) continue;
		const wpPkg = readJsonFile(pkgJsonPath);
		if (wpPkg.devDependencies?.eslint || wpPkg.dependencies?.eslint) {
			hasDependency = true;
			break;
		}
	}
	return {
		hasDependency,
		configFile,
		legacyConfigFile
	};
}
/**
* Run a `vp dlx @oxlint/migrate` step with graceful error handling.
* Returns true on success, false on failure (spawn error or non-zero exit).
*/
async function runOxlintMigrateStep(vpBin, cwd, migratePackage, args, spinner, failMessage, manualHint) {
	try {
		const result = await runCommandSilently({
			command: vpBin,
			args: [
				"dlx",
				migratePackage,
				...args
			],
			cwd,
			envs: process.env
		});
		if (result.exitCode !== 0) {
			spinner.stop(failMessage);
			const stderr = result.stderr.toString().trim();
			if (stderr) log.warn(`⚠ ${stderr}`);
			log.info(manualHint);
			return false;
		}
		return true;
	} catch {
		spinner.stop(failMessage);
		log.info(manualHint);
		return false;
	}
}
async function migrateEslintToOxlint(projectPath, interactive, eslintConfigFile, packages, options) {
	const vpBin = process.env.VP_CLI_BIN ?? "vp";
	const spinner = options?.silent ? getSilentSpinner() : getSpinner(interactive);
	if (eslintConfigFile) {
		const { versions } = await import("./versions.js");
		const migratePackage = `@oxlint/migrate@${versions.oxlint}`;
		const migrateArgs = [
			"--merge",
			...!hasBaseUrlInTsconfig(projectPath) ? ["--type-aware"] : [],
			"--with-nursery",
			"--details"
		];
		spinner.start("Migrating ESLint config to Oxlint...");
		if (!await runOxlintMigrateStep(vpBin, projectPath, migratePackage, migrateArgs, spinner, "ESLint migration failed", `You can run \`vp dlx ${migratePackage} ${migrateArgs.join(" ")}\` manually later`)) return false;
		spinner.stop("ESLint config migrated to .oxlintrc.json");
		spinner.start("Replacing ESLint comments with Oxlint equivalents...");
		if (await runOxlintMigrateStep(vpBin, projectPath, migratePackage, ["--replace-eslint-comments"], spinner, "ESLint comment replacement failed", `You can run \`vp dlx ${migratePackage} --replace-eslint-comments\` manually later`)) spinner.stop("ESLint comments replaced");
	}
	if (options?.report) options.report.eslintMigrated = true;
	const preserveJsPlugins = collectJsPluginPackageNames(projectPath);
	const cleanupTargets = [projectPath, ...(packages ?? []).map((p) => path.join(projectPath, p.path))];
	for (const target of cleanupTargets) {
		if (!fs.existsSync(path.join(target, "package.json"))) continue;
		deleteEslintConfigFiles(target, options?.report, options?.silent);
		rewriteEslintPackageJson(path.join(target, "package.json"), preserveJsPlugins);
		rewriteEslintLintStagedConfigFiles(target, options?.report);
	}
	return true;
}
/**
* Read `<projectPath>/.oxlintrc.json` (if any) and collect the package
* names referenced via `lint.jsPlugins[]` string entries. Object-form
* entries (`{ name, specifier }`) and local-path specifiers (`./X`,
* `../X`, `/X`) are excluded — neither maps to a `package.json` entry
* we'd accidentally strip.
*/
function collectJsPluginPackageNames(projectPath) {
	const out = /* @__PURE__ */ new Set();
	const oxlintConfigPath = path.join(projectPath, ".oxlintrc.json");
	if (!fs.existsSync(oxlintConfigPath)) return out;
	let config;
	try {
		config = readJsonFile(oxlintConfigPath, true);
	} catch {
		return out;
	}
	const collectFrom = (jsPlugins) => {
		for (const entry of jsPlugins ?? []) {
			if (typeof entry !== "string") continue;
			if (entry.startsWith("./") || entry.startsWith("../") || entry.startsWith("/")) continue;
			out.add(entry);
		}
	};
	collectFrom(config.jsPlugins);
	if (Array.isArray(config.overrides)) for (const override of config.overrides) collectFrom(override.jsPlugins);
	return out;
}
function deleteEslintConfigFiles(basePath, report, silent = false) {
	const configs = detectConfigs(basePath);
	for (const file of [configs.eslintConfig, configs.eslintLegacyConfig]) if (file) {
		const configPath = path.join(basePath, file);
		if (fs.existsSync(configPath)) {
			fs.unlinkSync(configPath);
			if (report) report.removedConfigCount++;
			if (!silent) log.success(`✔ Removed ${displayRelative(configPath)}`);
		}
	}
}
const ESLINT_ECOSYSTEM_NAMES = /* @__PURE__ */ new Set([
	"eslint",
	"typescript-eslint",
	"eslintrc",
	"eslint-utils",
	"eslint-visitor-keys",
	"eslint-scope",
	"eslint-define-config",
	"eslint-doc-generator",
	"@typescript-eslint/eslint-plugin",
	"@typescript-eslint/parser",
	"@typescript-eslint/rule-tester"
]);
const ESLINT_ECOSYSTEM_PREFIXES = [
	"eslint-plugin-",
	"eslint-config-",
	"eslint-formatter-"
];
const ESLINT_ECOSYSTEM_SCOPES = [
	"@eslint/",
	"@eslint-community/",
	"@angular-eslint/"
];
/**
* Decide whether a dependency entry should be removed alongside `eslint`
* itself. The set is intentionally broad: anything whose only purpose is
* to extend, configure, format, or wire ESLint becomes dead weight after
* migration. `@types/<X>` packages are checked symmetrically with `<X>`
* so type-only counterparts of removed runtime packages also go.
*/
function isEslintEcosystemDep(name) {
	const stripped = name.startsWith("@types/") ? name.slice(7) : name;
	if (ESLINT_ECOSYSTEM_NAMES.has(stripped)) return true;
	if (ESLINT_ECOSYSTEM_PREFIXES.some((p) => stripped.startsWith(p))) return true;
	if (ESLINT_ECOSYSTEM_SCOPES.some((s) => stripped.startsWith(s))) return true;
	//   @vitest/eslint-plugin
	if (/^@[^/]+\/eslint-(plugin|config|formatter)(-.+)?$/.test(stripped)) return true;
	return false;
}
/**
* Rewrite a project's `package.json` after ESLint has been migrated to
* Oxlint: drop every ESLint-ecosystem dependency (see
* `isEslintEcosystemDep`), strip empty containers, and rewrite eslint
* tokens in scripts / lint-staged. Applied uniformly to the root and to
* every workspace package — the migration treats the whole workspace as
* in scope for adoption, so a half-cleanup at the workspace level would
* be inconsistent with the rest of the flow (which already replaces
* vite-related overrides and adds vite-plus across all packages).
*
* `preserveJsPlugins` names packages that `@oxlint/migrate` referenced
* via `lint.jsPlugins` and that Oxlint will need to `import()` at lint
* time. They override `isEslintEcosystemDep` so the generated config
* isn't immediately invalidated by the cleanup step.
*/
function rewriteEslintPackageJson(packageJsonPath, preserveJsPlugins = /* @__PURE__ */ new Set()) {
	editJsonFile(packageJsonPath, (pkg) => {
		let changed = false;
		for (const field of [
			"devDependencies",
			"dependencies",
			"peerDependencies",
			"optionalDependencies"
		]) {
			const deps = pkg[field];
			if (!deps) continue;
			let removedAny = false;
			for (const name of Object.keys(deps)) {
				if (preserveJsPlugins.has(name)) continue;
				if (isEslintEcosystemDep(name)) {
					delete deps[name];
					changed = true;
					removedAny = true;
				}
			}
			if (removedAny && Object.keys(deps).length === 0) delete pkg[field];
		}
		if (pkg.scripts) {
			const updated = rewriteEslint(JSON.stringify(pkg.scripts));
			if (updated) {
				pkg.scripts = JSON.parse(updated);
				changed = true;
			}
		}
		if (pkg["lint-staged"]) {
			const updated = rewriteEslint(JSON.stringify(pkg["lint-staged"]));
			if (updated) {
				pkg["lint-staged"] = JSON.parse(updated);
				changed = true;
			}
		}
		return changed ? pkg : void 0;
	});
}
/**
* Rewrite tool references in lint-staged config files (JSON ones are rewritten,
* non-JSON ones get a warning).
*/
function rewriteToolLintStagedConfigFiles(projectPath, rewriteFn, toolName, report) {
	for (const filename of LINT_STAGED_JSON_CONFIG_FILES) {
		const configPath = path.join(projectPath, filename);
		if (!fs.existsSync(configPath)) continue;
		if (filename === ".lintstagedrc" && !isJsonFile(configPath)) {
			warnMigration(`${displayRelative(configPath)} is not JSON — please update ${toolName} references manually`, report);
			continue;
		}
		editJsonFile(configPath, (config) => {
			const updated = rewriteFn(JSON.stringify(config));
			if (updated) return JSON.parse(updated);
		});
	}
	for (const filename of LINT_STAGED_OTHER_CONFIG_FILES) {
		const configPath = path.join(projectPath, filename);
		if (!fs.existsSync(configPath)) continue;
		warnMigration(`${displayRelative(configPath)} — please update ${toolName} references manually`, report);
	}
}
function rewriteEslintLintStagedConfigFiles(projectPath, report) {
	rewriteToolLintStagedConfigFiles(projectPath, rewriteEslint, "eslint", report);
}
/**
* Best-effort: derive the Oxlint rule-namespace a JS plugin package
* contributes. Mirrors the conventions @oxlint/migrate uses when
* translating ESLint configs, and the conventions Oxlint-native plugin
* authors use (`oxlint-plugin-<name>` — see posva/pinia-colada in the
* wild):
*   `eslint-plugin-unocss`         → `unocss`        (rules: `unocss/order`)
*   `oxlint-plugin-posva`          → `posva`         (rules: `posva/foo`)
*   `@stylistic/eslint-plugin`     → `@stylistic`    (rules: `@stylistic/indent`)
*   `@stylistic/eslint-plugin-ts`  → `@stylistic/ts` (rules: `@stylistic/ts/indent`)
*   `@scope/oxlint-plugin-x`       → `@scope/x`
*   anything else                  → the package name verbatim
*/
function deriveJsPluginNamespace(packageName) {
	for (const prefix of ["eslint-plugin-", "oxlint-plugin-"]) if (packageName.startsWith(prefix)) return packageName.slice(prefix.length) || packageName;
	const scoped = packageName.match(/^(@[^/]+)\/(?:eslint|oxlint)-plugin(?:-(.+))?$/);
	if (scoped) return scoped[2] ? `${scoped[1]}/${scoped[2]}` : scoped[1];
	return packageName;
}
/**
* Collect every dependency name declared across the root + workspace
* `package.json` files after the ESLint cleanup has run. Used to verify
* that JS plugins referenced by the generated `.oxlintrc.json` are
* actually installable.
*/
function collectInstalledPackageNames(projectPath, packages) {
	const names = /* @__PURE__ */ new Set();
	const paths = [projectPath, ...(packages ?? []).map((p) => path.join(projectPath, p.path))];
	for (const dir of paths) {
		const pkgJsonPath = path.join(dir, "package.json");
		if (!fs.existsSync(pkgJsonPath)) continue;
		let pkg;
		try {
			pkg = readJsonFile(pkgJsonPath);
		} catch {
			continue;
		}
		for (const field of [
			"devDependencies",
			"dependencies",
			"optionalDependencies"
		]) {
			const deps = pkg[field];
			if (deps) for (const name of Object.keys(deps)) names.add(name);
		}
	}
	return names;
}
/**
* Test whether a rule key (e.g. `@stylistic/ts/indent`) belongs to any
* namespace in `namespaces`. We can't just split on the first `/` —
* `@stylistic/eslint-plugin-ts` contributes the multi-segment namespace
* `@stylistic/ts`, so the lookup has to try progressively longer
* prefixes until one matches or we run out of slashes.
*/
function ruleKeyMatchesNamespace(key, namespaces) {
	if (!key.includes("/")) return true;
	let idx = key.indexOf("/");
	while (idx !== -1) {
		if (namespaces.has(key.slice(0, idx))) return true;
		idx = key.indexOf("/", idx + 1);
	}
	return false;
}
/** Filter a rules object to only entries whose namespace is recognized. */
function filterRulesAgainstNamespaces(rules, namespaces) {
	const out = {};
	for (const [key, value] of Object.entries(rules)) if (ruleKeyMatchesNamespace(key, namespaces)) out[key] = value;
	return out;
}
/**
* Sort a jsPlugins array into installed entries (kept) and string
* entries for packages that aren't present in the workspace. Object-form
* entries (`{ name, specifier }`) and string entries that look like
* local paths (`./X`, `/X`, `../X`) are passed through — Oxlint resolves
* them itself.
*/
function partitionJsPlugins(entries, availablePackages) {
	const kept = [];
	const dropped = [];
	for (const entry of entries) {
		if (typeof entry !== "string") {
			kept.push(entry);
			continue;
		}
		if (entry.startsWith("./") || entry.startsWith("../") || entry.startsWith("/")) {
			kept.push(entry);
			continue;
		}
		if (availablePackages.has(entry)) kept.push(entry);
		else dropped.push(entry);
	}
	return {
		kept,
		dropped
	};
}
/** Build the set of rule-key namespaces backed by a given jsPlugins set. */
function jsPluginsToNamespaces(entries) {
	const ns = /* @__PURE__ */ new Set();
	for (const entry of entries) if (typeof entry === "string") ns.add(deriveJsPluginNamespace(entry));
	else if (entry && typeof entry === "object" && "name" in entry && entry.name) ns.add(entry.name);
	ns.delete("");
	return ns;
}
/**
* Sanitize the `.oxlintrc.json` produced by `@oxlint/migrate` (in-place)
* before it gets merged into `vite.config.ts`. Drop references that
* won't resolve at lint time and warn the user.
*
* Why: `@oxlint/migrate` can emit `jsPlugins[]` / `plugins[]` / `rules`
* entries referring to packages the user never installed (e.g.
* translating `@unocss/eslint-config` into `eslint-plugin-unocss`),
* to plugins outside Oxlint's native set, or under namespaces no
* surviving plugin contributes. Without sanitization, `vp lint` aborts
* with "Failed to load JS plugin" / "Plugin not found" before running
* any rule. This produces a degraded-but-functional config instead.
*
* Per-override entries (`overrides[].jsPlugins`, `.plugins`, `.rules`)
* are sanitized independently — an override can introduce its own
* jsPlugin, so namespace availability is computed per-override (base
* namespaces ∪ the override's own surviving jsPlugins' namespaces).
*/
function sanitizeMigratedOxlintConfig(config, availablePackages, report) {
	const allDroppedJsPlugins = /* @__PURE__ */ new Set();
	const allDroppedPlugins = /* @__PURE__ */ new Set();
	const baseSplit = partitionJsPlugins(config.jsPlugins ?? [], availablePackages);
	for (const n of baseSplit.dropped) allDroppedJsPlugins.add(n);
	if (config.jsPlugins && baseSplit.dropped.length > 0) config.jsPlugins = baseSplit.kept;
	const baseNamespaces = new Set(OXLINT_NATIVE_PLUGINS);
	for (const ns of jsPluginsToNamespaces(baseSplit.kept)) baseNamespaces.add(ns);
	if (config.plugins) {
		const keptPlugins = [];
		for (const p of config.plugins) if (baseNamespaces.has(p)) keptPlugins.push(p);
		else allDroppedPlugins.add(p);
		if (keptPlugins.length !== config.plugins.length) config.plugins = keptPlugins;
	}
	if (config.rules) {
		const filtered = filterRulesAgainstNamespaces(config.rules, baseNamespaces);
		if (Object.keys(filtered).length !== Object.keys(config.rules).length) config.rules = filtered;
	}
	if (Array.isArray(config.overrides)) for (const override of config.overrides) {
		let overrideSurvivors = [];
		if (override.jsPlugins) {
			const split = partitionJsPlugins(override.jsPlugins, availablePackages);
			for (const n of split.dropped) allDroppedJsPlugins.add(n);
			if (split.dropped.length > 0) override.jsPlugins = split.kept;
			overrideSurvivors = split.kept;
		}
		const overrideNamespaces = new Set(baseNamespaces);
		for (const ns of jsPluginsToNamespaces(overrideSurvivors)) overrideNamespaces.add(ns);
		if (override.plugins) {
			const keptOverridePlugins = [];
			for (const p of override.plugins) if (overrideNamespaces.has(p)) keptOverridePlugins.push(p);
			else allDroppedPlugins.add(p);
			if (keptOverridePlugins.length !== override.plugins.length) override.plugins = keptOverridePlugins;
		}
		if (override.rules) {
			const filtered = filterRulesAgainstNamespaces(override.rules, overrideNamespaces);
			if (Object.keys(filtered).length !== Object.keys(override.rules).length) override.rules = filtered;
		}
	}
	if (allDroppedJsPlugins.size > 0) warnMigration(`Stripped JS plugin reference(s) from the generated lint config: ${[...allDroppedJsPlugins].join(", ")}. No matching package is present in this workspace, so loading them at lint time would fail. If you want their Oxlint coverage back, install each package (e.g. \`vp install <name>\`) and add its name back to \`lint.jsPlugins\` in vite.config.ts.`, report);
	if (allDroppedPlugins.size > 0) warnMigration(`Stripped unknown plugin reference(s) from the generated lint config: ${[...allDroppedPlugins].join(", ")}. These aren't native Oxlint plugins and no surviving JS plugin contributes them.`, report);
}
function warnPackageLevelEslint() {
	log.warn("ESLint detected in workspace packages but no root config found. Package-level ESLint must be migrated manually.");
}
const INCOMPATIBLE_ESLINT_INTEGRATIONS = ["@nuxt/eslint"];
/**
* Detect framework-ESLint integration packages whose ESLint migration is
* known to be incompatible. Returns the offending package name, or
* `undefined` if none is present.
*/
function detectIncompatibleEslintIntegration(projectPath, packages) {
	const candidates = [projectPath, ...(packages ?? []).map((p) => path.join(projectPath, p.path))];
	for (const candidate of candidates) {
		const pkgJsonPath = path.join(candidate, "package.json");
		if (!fs.existsSync(pkgJsonPath)) continue;
		let pkg;
		try {
			pkg = readJsonFile(pkgJsonPath);
		} catch {
			continue;
		}
		for (const name of INCOMPATIBLE_ESLINT_INTEGRATIONS) if (pkg.devDependencies?.[name] || pkg.dependencies?.[name]) return name;
	}
}
function warnIncompatibleEslintIntegration(name) {
	log.warn(`${name} detected — automatic ESLint migration is skipped. ${name} wires ESLint into a framework-specific flow that Vite+ cannot migrate cleanly yet. Your ESLint setup is preserved. To migrate manually, remove ${name} from package.json and re-run \`vp migrate\`.`);
}
function warnLegacyEslintConfig(legacyConfigFile) {
	log.warn(`Legacy ESLint configuration detected (${legacyConfigFile}). Automatic migration to Oxlint requires ESLint v9+ with flat config format (eslint.config.*). Please upgrade to ESLint v9 first: https://eslint.org/docs/latest/use/migrate-to-9.0.0`);
}
async function confirmEslintMigration(interactive) {
	if (interactive) {
		const confirmed = await confirm({
			message: "Migrate ESLint rules to Oxlint using @oxlint/migrate?\n  " + styleText("gray", "Oxlint is Vite+'s built-in linter — significantly faster than ESLint with compatible rule support. @oxlint/migrate converts your existing rules automatically."),
			initialValue: true
		});
		if (isCancel(confirmed)) cancelAndExit();
		return confirmed;
	}
	return true;
}
async function promptEslintMigration(projectPath, interactive, packages) {
	const incompatible = detectIncompatibleEslintIntegration(projectPath, packages);
	if (incompatible) {
		warnIncompatibleEslintIntegration(incompatible);
		return false;
	}
	const eslintProject = detectEslintProject(projectPath, packages);
	if (eslintProject.hasDependency && !eslintProject.configFile && eslintProject.legacyConfigFile) {
		warnLegacyEslintConfig(eslintProject.legacyConfigFile);
		return false;
	}
	if (!eslintProject.hasDependency) return false;
	if (!eslintProject.configFile) {
		warnPackageLevelEslint();
		return false;
	}
	if (!await confirmEslintMigration(interactive)) return false;
	if (!await migrateEslintToOxlint(projectPath, interactive, eslintProject.configFile, packages)) cancelAndExit("ESLint migration failed.", 1);
	return true;
}
//#endregion
//#region src/migration/migrator/prettier.ts
function detectPrettierProject(projectPath, packages) {
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return { hasDependency: false };
	const pkg = readJsonFile(packageJsonPath);
	let hasDependency = !!(pkg.devDependencies?.prettier || pkg.dependencies?.prettier);
	const configFile = detectConfigs(projectPath).prettierConfig;
	if (!hasDependency && packages) for (const wp of packages) {
		const pkgJsonPath = path.join(projectPath, wp.path, "package.json");
		if (!fs.existsSync(pkgJsonPath)) continue;
		const wpPkg = readJsonFile(pkgJsonPath);
		if (wpPkg.devDependencies?.prettier || wpPkg.dependencies?.prettier) {
			hasDependency = true;
			break;
		}
	}
	return {
		hasDependency,
		configFile
	};
}
/**
* Run `vp fmt --migrate=prettier` step with graceful error handling.
* Returns true on success, false on failure.
*/
async function runPrettierMigrateStep(vpBin, cwd, spinner, failMessage, manualHint) {
	try {
		const result = await runCommandSilently({
			command: vpBin,
			args: ["fmt", "--migrate=prettier"],
			cwd,
			envs: process.env
		});
		if (result.exitCode !== 0) {
			spinner.stop(failMessage);
			const stderr = result.stderr.toString().trim();
			if (stderr) log.warn(`⚠ ${stderr}`);
			log.info(manualHint);
			return false;
		}
		return true;
	} catch {
		spinner.stop(failMessage);
		log.info(manualHint);
		return false;
	}
}
async function migratePrettierToOxfmt(projectPath, interactive, prettierConfigFile, packages, options) {
	const vpBin = process.env.VP_CLI_BIN ?? "vp";
	const spinner = options?.silent ? getSilentSpinner() : getSpinner(interactive);
	if (prettierConfigFile) {
		let tempPrettierConfig;
		if (prettierConfigFile === "package.json#prettier") {
			const packageJsonPath = path.join(projectPath, "package.json");
			const pkg = readJsonFile(packageJsonPath);
			if (pkg.prettier) {
				tempPrettierConfig = path.join(projectPath, ".prettierrc.json");
				fs.writeFileSync(tempPrettierConfig, JSON.stringify(pkg.prettier, null, 2));
			} else return true;
		}
		try {
			spinner.start("Migrating Prettier config to Oxfmt...");
			if (!await runPrettierMigrateStep(vpBin, projectPath, spinner, "Prettier migration failed", "You can run `vp fmt --migrate=prettier` manually later")) return false;
			spinner.stop("Prettier config migrated to .oxfmtrc.json");
		} finally {
			if (tempPrettierConfig) try {
				fs.unlinkSync(tempPrettierConfig);
			} catch {}
		}
	}
	if (options?.report) options.report.prettierMigrated = true;
	deletePrettierConfigFiles(projectPath, options?.report, options?.silent);
	rewritePrettierPackageJson(path.join(projectPath, "package.json"));
	if (packages) for (const pkg of packages) rewritePrettierPackageJson(path.join(projectPath, pkg.path, "package.json"));
	rewritePrettierLintStagedConfigFiles(projectPath, options?.report);
	const prettierIgnorePath = path.join(projectPath, ".prettierignore");
	if (fs.existsSync(prettierIgnorePath)) warnMigration(`${displayRelative(prettierIgnorePath)} found — Oxfmt supports .prettierignore, but using the \`ignorePatterns\` option is recommended.`, options?.report);
	return true;
}
function deletePrettierConfigFiles(basePath, report, silent = false) {
	const configs = detectConfigs(basePath);
	if (configs.prettierConfig && configs.prettierConfig !== "package.json#prettier") {
		const configPath = path.join(basePath, configs.prettierConfig);
		if (fs.existsSync(configPath)) {
			fs.unlinkSync(configPath);
			if (report) report.removedConfigCount++;
			if (!silent) log.success(`✔ Removed ${displayRelative(configPath)}`);
		}
	}
	for (const file of PRETTIER_CONFIG_FILES) {
		if (file === configs.prettierConfig) continue;
		const configPath = path.join(basePath, file);
		if (fs.existsSync(configPath)) {
			fs.unlinkSync(configPath);
			if (report) report.removedConfigCount++;
			if (!silent) log.success(`✔ Removed ${displayRelative(configPath)}`);
		}
	}
	editJsonFile(path.join(basePath, "package.json"), (pkg) => {
		if (pkg.prettier) {
			delete pkg.prettier;
			return pkg;
		}
	});
}
function rewritePrettierPackageJson(packageJsonPath) {
	if (!fs.existsSync(packageJsonPath)) return;
	editJsonFile(packageJsonPath, (pkg) => {
		let changed = false;
		if (pkg.devDependencies) {
			for (const dep of Object.keys(pkg.devDependencies)) if (dep === "prettier" || dep.startsWith("prettier-plugin-")) {
				delete pkg.devDependencies[dep];
				changed = true;
			}
		}
		if (pkg.dependencies) {
			for (const dep of Object.keys(pkg.dependencies)) if (dep === "prettier" || dep.startsWith("prettier-plugin-")) {
				delete pkg.dependencies[dep];
				changed = true;
			}
		}
		if (pkg.scripts) {
			const updated = rewritePrettier(JSON.stringify(pkg.scripts));
			if (updated) {
				pkg.scripts = JSON.parse(updated);
				changed = true;
			}
		}
		if (pkg["lint-staged"]) {
			const updated = rewritePrettier(JSON.stringify(pkg["lint-staged"]));
			if (updated) {
				pkg["lint-staged"] = JSON.parse(updated);
				changed = true;
			}
		}
		return changed ? pkg : void 0;
	});
}
function rewritePrettierLintStagedConfigFiles(projectPath, report) {
	rewriteToolLintStagedConfigFiles(projectPath, rewritePrettier, "prettier", report);
}
function warnPackageLevelPrettier() {
	log.warn("Prettier detected in workspace packages but no root config found. Package-level Prettier must be migrated manually.");
}
async function confirmPrettierMigration(interactive) {
	if (interactive) {
		const confirmed = await confirm({
			message: "Migrate Prettier to Oxfmt?\n  " + styleText("gray", "Oxfmt is Vite+'s built-in formatter that replaces Prettier with faster performance. Your configuration will be converted automatically."),
			initialValue: true
		});
		if (isCancel(confirmed)) cancelAndExit();
		return confirmed;
	}
	log.info("Prettier configuration detected. Auto-migrating to Oxfmt...");
	return true;
}
async function promptPrettierMigration(projectPath, interactive, packages) {
	const prettierProject = detectPrettierProject(projectPath, packages);
	if (!prettierProject.hasDependency) return false;
	if (!prettierProject.configFile) {
		warnPackageLevelPrettier();
		return false;
	}
	if (!await confirmPrettierMigration(interactive)) return false;
	if (!await migratePrettierToOxfmt(projectPath, interactive, prettierProject.configFile, packages)) cancelAndExit("Prettier migration failed.", 1);
	return true;
}
//#endregion
//#region src/migration/migrator/tsup.ts
function showTsdownMigrationOptions(targetLabel = "the project root", automaticMigrationFailed = false) {
	const lines = [
		"Choose one of these manual migration methods:",
		`  1. Run \`vp dlx tsdown-migrate\` in ${targetLabel}.`,
		"  2. Use the tsdown migration skill:",
		`     ${TSDOWN_MIGRATION_SKILL_URL}`
	];
	if (automaticMigrationFailed) {
		lines.unshift("Automatic tsup migration failed.", "");
		lines.push("");
	}
	log.info(lines.join("\n"));
}
function showTsdownMigrationSkillGuidance(instructions) {
	log.info([
		...instructions,
		"",
		"Use the tsdown migration skill for guidance:",
		`  ${TSDOWN_MIGRATION_SKILL_URL}`
	].join("\n"));
}
function detectTsupProject(projectPath, packages) {
	const packageJsonPath = path.join(projectPath, "package.json");
	let hasDependency = false;
	if (fs.existsSync(packageJsonPath)) {
		const pkg = readJsonFile(packageJsonPath);
		hasDependency = !!(pkg.devDependencies?.tsup || pkg.dependencies?.tsup);
	}
	const configFile = detectConfigs(projectPath).tsupConfig;
	let hasConfig = !!configFile;
	for (const wp of packages ?? []) {
		const workspacePath = path.join(projectPath, wp.path);
		hasConfig ||= !!detectConfigs(workspacePath).tsupConfig;
		if (!hasDependency) {
			const workspacePackageJsonPath = path.join(workspacePath, "package.json");
			if (fs.existsSync(workspacePackageJsonPath)) {
				const workspacePackageJson = readJsonFile(workspacePackageJsonPath);
				hasDependency = !!(workspacePackageJson.devDependencies?.tsup || workspacePackageJson.dependencies?.tsup);
			}
		}
	}
	return {
		hasDependency,
		hasConfig,
		configFile
	};
}
const TSDOWN_MIGRATION_FILES = [
	"package.json",
	...TSUP_CONFIG_FILES,
	...TSUP_CONFIG_FILES.map((file) => file.replace("tsup", "tsdown"))
];
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const STANDARD_TSUP_CONFIG_FILE_PATTERN = TSUP_CONFIG_FILES.flatMap((file) => [file, file.replace("tsup", "tsdown")]).map(escapeRegExp).join("|");
const TSDOWN_STANDARD_CONFIG_OPTION_RE = new RegExp(String.raw`(\btsdown(?:-node)?\b(?:(?!&&|\|\||[;|]).)*?)\s+(?:--config(?:=|\s+)|-c\s+)["']?(?:\.[\\/])?(?:${STANDARD_TSUP_CONFIG_FILE_PATTERN})["']?(?=\s|$|[;&|])`, "g");
const TSUP_CONFIG_OPTION_RE = /\btsup(?:-node)?\b(?:(?!&&|\|\||[;|]).)*?\s+(?:--config(?:=|\s+)|-c\s+)(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))(?=\s|$|[;&|])/g;
function removeStandardTsdownConfigOption(script) {
	return script.replace(TSDOWN_STANDARD_CONFIG_OPTION_RE, "$1");
}
function resolveScriptConfigPath(packagePath, configPath) {
	return path.resolve(packagePath, configPath.replace(/[\\/]/g, path.sep));
}
function collectSharedTsupConfigs(projectPath, packages, tsupTargets) {
	const migratedConfigPaths = new Set(tsupTargets.flatMap((target) => TSUP_CONFIG_FILES.map((file) => path.join(target, file)).filter((file) => fs.existsSync(file))));
	const sharedConfigs = /* @__PURE__ */ new Map();
	const consumers = [{
		label: "the project root",
		packagePath: path.resolve(projectPath)
	}, ...(packages ?? []).map((workspacePackage) => ({
		label: workspacePackage.path,
		packagePath: path.resolve(projectPath, workspacePackage.path)
	}))];
	for (const { label, packagePath } of consumers) {
		const packageJsonPath = path.join(packagePath, "package.json");
		if (!fs.existsSync(packageJsonPath)) continue;
		const packageJson = readJsonFile(packageJsonPath);
		for (const [scriptName, script] of Object.entries(packageJson.scripts ?? {})) for (const match of script.matchAll(TSUP_CONFIG_OPTION_RE)) {
			const configPath = resolveScriptConfigPath(packagePath, match[1] ?? match[2] ?? match[3]);
			if (!migratedConfigPaths.has(configPath) || path.dirname(configPath) === packagePath) continue;
			const sharedConfig = sharedConfigs.get(configPath) ?? { consumers: /* @__PURE__ */ new Map() };
			const consumer = sharedConfig.consumers.get(packagePath) ?? {
				label,
				packagePath,
				scriptNames: /* @__PURE__ */ new Set()
			};
			consumer.scriptNames.add(scriptName);
			sharedConfig.consumers.set(packagePath, consumer);
			sharedConfigs.set(configPath, sharedConfig);
		}
	}
	return sharedConfigs;
}
function collectTsupConfigCollisions(tsupTargets) {
	const collisions = [];
	for (const target of tsupTargets) {
		const tsdownConfig = detectConfigs(target).tsdownConfig;
		if (tsdownConfig) collisions.push({ configPath: path.join(target, tsdownConfig) });
		const packageJsonPath = path.join(target, "package.json");
		if (fs.existsSync(packageJsonPath)) {
			const packageJson = readJsonFile(packageJsonPath);
			if (Object.hasOwn(packageJson, "tsdown")) collisions.push({ configPath: `${packageJsonPath}#tsdown` });
		}
	}
	return collisions;
}
function collectInlineTsupConfigs(tsupTargets) {
	return tsupTargets.flatMap((target) => {
		const packageJsonPath = path.join(target, "package.json");
		if (!fs.existsSync(packageJsonPath) || !Object.hasOwn(readJsonFile(packageJsonPath), "tsup")) return [];
		return [{ configPath: `${packageJsonPath}#tsup` }];
	});
}
function isRemovableDefaultConfigArgument(configArgument, defaultConfig) {
	return !!defaultConfig && (configArgument === defaultConfig || configArgument === `./${defaultConfig}` || configArgument === `.\\${defaultConfig}`);
}
function collectUnsupportedTsupConfigConsumers(tsupTargets) {
	const migratedConfigPaths = new Set(tsupTargets.flatMap((target) => TSUP_CONFIG_FILES.map((file) => path.join(target, file)).filter((file) => fs.existsSync(file))));
	const unsupported = [];
	for (const target of tsupTargets) {
		const packageJsonPath = path.join(target, "package.json");
		if (!fs.existsSync(packageJsonPath)) continue;
		const detectedConfig = detectConfigs(target).tsupConfig;
		const defaultConfigPath = detectedConfig && detectedConfig !== "package.json#tsup" ? path.join(target, detectedConfig) : void 0;
		const packageJson = readJsonFile(packageJsonPath);
		for (const [scriptName, script] of Object.entries(packageJson.scripts ?? {})) for (const match of script.matchAll(TSUP_CONFIG_OPTION_RE)) {
			const configArgument = match[1] ?? match[2] ?? match[3];
			const configPath = resolveScriptConfigPath(target, configArgument);
			const isDefaultConfig = configPath === defaultConfigPath && isRemovableDefaultConfigArgument(configArgument, detectedConfig);
			const isSharedMigratedConfig = migratedConfigPaths.has(configPath) && path.dirname(configPath) !== target;
			if (!isDefaultConfig && !isSharedMigratedConfig) unsupported.push({
				configArgument,
				packagePath: target,
				scriptName
			});
		}
	}
	return unsupported;
}
function restoreSharedTsupUsage(sharedConfigs, snapshots) {
	const preservedDependencyTargets = /* @__PURE__ */ new Set();
	const restoredScripts = /* @__PURE__ */ new Map();
	for (const [configPath, sharedConfig] of sharedConfigs) {
		const contents = snapshots.get(configPath);
		if (contents !== void 0) fs.writeFileSync(configPath, contents);
		preservedDependencyTargets.add(path.dirname(configPath));
		for (const consumer of sharedConfig.consumers.values()) {
			preservedDependencyTargets.add(consumer.packagePath);
			const scriptNames = restoredScripts.get(consumer.packagePath) ?? /* @__PURE__ */ new Set();
			for (const scriptName of consumer.scriptNames) scriptNames.add(scriptName);
			restoredScripts.set(consumer.packagePath, scriptNames);
		}
	}
	for (const target of preservedDependencyTargets) {
		const packageJsonPath = path.join(target, "package.json");
		const originalPackageJson = snapshots.get(packageJsonPath);
		if (!originalPackageJson || !fs.existsSync(packageJsonPath)) continue;
		const original = JSON.parse(originalPackageJson.toString());
		editJsonFile(packageJsonPath, (pkg) => {
			let changed = false;
			for (const field of ["devDependencies", "dependencies"]) {
				const spec = original[field]?.tsup;
				if (spec && pkg[field]?.tsup !== spec) {
					pkg[field] ??= {};
					pkg[field].tsup = spec;
					changed = true;
				}
			}
			for (const scriptName of restoredScripts.get(target) ?? []) {
				const script = original.scripts?.[scriptName];
				if (script !== void 0 && pkg.scripts?.[scriptName] !== script) {
					pkg.scripts ??= {};
					pkg.scripts[scriptName] = script;
					changed = true;
				}
			}
			return changed ? pkg : void 0;
		});
	}
	return preservedDependencyTargets;
}
function snapshotTsupMigrationTargets(targets) {
	const snapshots = /* @__PURE__ */ new Map();
	for (const target of targets) for (const file of TSDOWN_MIGRATION_FILES) {
		const filePath = path.join(target, file);
		snapshots.set(filePath, fs.existsSync(filePath) ? fs.readFileSync(filePath) : void 0);
	}
	return snapshots;
}
function restoreTsupMigrationTargets(snapshots) {
	const failures = [];
	for (const [filePath, contents] of snapshots) try {
		if (contents === void 0) fs.rmSync(filePath, { force: true });
		else fs.writeFileSync(filePath, contents);
	} catch {
		failures.push(displayRelative(filePath));
	}
	return failures;
}
function extractTsdownMigrationWarnings(output) {
	return output.toString().replaceAll("\r\n", "\n").split(/\n\s*\n/).map((block) => block.trim().match(/^WARN\s+([\s\S]+)$/)?.[1]?.trim()).filter((warning) => !!warning);
}
/** Run `vp dlx tsdown-migrate` in `cwd` with graceful error handling. */
async function runTsdownMigrateStep(vpBin, cwd, packageManager) {
	try {
		const result = await runCommandSilently({
			command: vpBin,
			args: [
				"dlx",
				`tsdown-migrate@${TSDOWN_MIGRATE_VERSION}`,
				"--yes",
				"--package-manager",
				packageManager,
				"--no-install"
			],
			cwd,
			envs: process.env
		});
		if (result.exitCode !== 0) {
			const stderr = result.stderr.toString().trim();
			if (stderr) log.warn(`⚠ ${stderr}`);
			return {
				ok: false,
				warnings: []
			};
		}
		return {
			ok: true,
			warnings: [...extractTsdownMigrationWarnings(result.stdout), ...extractTsdownMigrationWarnings(result.stderr)]
		};
	} catch {
		return {
			ok: false,
			warnings: []
		};
	}
}
async function migrateTsupToTsdown(projectPath, interactive, packageManager, tsupConfigFile, packages, options) {
	const vpBin = process.env.VP_CLI_BIN ?? "vp";
	const spinner = options?.silent ? getSilentSpinner() : getSpinner(interactive);
	const rootPath = path.resolve(projectPath);
	const tsupTargets = [rootPath, ...(packages ?? []).map((p) => path.resolve(rootPath, p.path))].filter((target) => target === rootPath ? !!tsupConfigFile : !!detectConfigs(target).tsupConfig);
	const configCollisions = collectTsupConfigCollisions(tsupTargets);
	if (configCollisions.length > 0) {
		log.warn(`Automatic tsup migration was skipped because these tsdown configs already exist:\n${configCollisions.map(({ configPath }) => `  ${displayRelative(configPath, projectPath)}`).join("\n")}`);
		showTsdownMigrationSkillGuidance([
			"Resolve this configuration conflict manually:",
			"  1. Merge the tsup and tsdown configurations into `pack` in `vite.config.*`.",
			"  2. Do not run `tsdown-migrate`. It can overwrite the existing tsdown configuration."
		]);
		return false;
	}
	const inlineTsupConfigs = collectInlineTsupConfigs(tsupTargets);
	if (inlineTsupConfigs.length > 0) {
		log.warn(`Automatic tsup migration was skipped because these inline tsup configs cannot be migrated automatically:\n${inlineTsupConfigs.map(({ configPath }) => `  ${displayRelative(configPath, projectPath)}`).join("\n")}`);
		showTsdownMigrationSkillGuidance([
			"Resolve this inline configuration manually:",
			"  1. Move each `package.json#tsup` configuration into `pack` in `vite.config.*`.",
			"  2. Do not run `tsdown-migrate`. Vite+ Pack does not read `package.json#tsdown`."
		]);
		return false;
	}
	const unsupportedConfigConsumers = collectUnsupportedTsupConfigConsumers(tsupTargets);
	if (unsupportedConfigConsumers.length > 0) {
		log.warn(`Automatic tsup migration was skipped because these scripts use configs that cannot be migrated automatically:\n${unsupportedConfigConsumers.map(({ configArgument, packagePath, scriptName }) => `  ${displayRelative(path.join(packagePath, "package.json"), projectPath)}#${scriptName} -> ${configArgument}`).join("\n")}`);
		showTsdownMigrationSkillGuidance([
			"Resolve these config paths manually:",
			"  1. Migrate each listed config into `pack` in `vite.config.*`.",
			"  2. Update each listed script.",
			"  3. Do not run `tsdown-migrate`. It cannot safely resolve these config paths."
		]);
		return false;
	}
	const sharedConfigs = collectSharedTsupConfigs(projectPath, packages, tsupTargets);
	let preservedDependencyTargets = /* @__PURE__ */ new Set();
	if (tsupTargets.length > 0) {
		const snapshots = snapshotTsupMigrationTargets(tsupTargets);
		const migrationWarnings = [];
		spinner.start("Migrating tsup config to tsdown...");
		for (const target of tsupTargets) {
			const targetLabel = target === rootPath ? "the project root" : displayRelative(target, projectPath);
			const migrateResult = await runTsdownMigrateStep(vpBin, target, packageManager);
			if (!migrateResult.ok) {
				spinner.stop();
				const restoreFailures = restoreTsupMigrationTargets(snapshots);
				if (restoreFailures.length > 0) log.warn(`Could not restore these files after the failed migration:\n${restoreFailures.map((file) => `  ${file}`).join("\n")}`);
				showTsdownMigrationOptions(targetLabel, true);
				return false;
			}
			for (const warning of migrateResult.warnings) migrationWarnings.push({
				targetLabel,
				warning
			});
		}
		spinner.stop("tsup config migrated to tsdown.config");
		preservedDependencyTargets = restoreSharedTsupUsage(sharedConfigs, snapshots);
		for (const { targetLabel, warning } of migrationWarnings) {
			const message = targetLabel === "the project root" ? `tsdown-migrate: ${warning}` : `tsdown-migrate (${targetLabel}): ${warning}`;
			if (options?.report) addMigrationWarning(options.report, message);
			else log.warn(message);
		}
		for (const [configPath, sharedConfig] of sharedConfigs) {
			const message = `${displayRelative(configPath, projectPath)} is shared by ${[...sharedConfig.consumers.values()].map((consumer) => consumer.label).toSorted().join(", ")}. It was preserved and must be migrated manually.`;
			if (options?.report) addMigrationWarning(options.report, message);
			else log.warn(message);
		}
	}
	if (options?.report) options.report.tsupMigrated = true;
	for (const target of tsupTargets) {
		if (!fs.existsSync(path.join(target, "package.json"))) continue;
		deleteTsupConfigFiles(target, new Set([...sharedConfigs.keys()].filter((configPath) => path.dirname(configPath) === path.resolve(target))), options?.report, options?.silent);
		rewriteTsupPackageJson(path.join(target, "package.json"), preservedDependencyTargets.has(path.resolve(target)));
	}
	return true;
}
function deleteTsupConfigFiles(basePath, preservedConfigs, report, silent = false) {
	const configs = detectConfigs(basePath);
	if (configs.tsupConfig && configs.tsupConfig !== "package.json#tsup") {
		const configPath = path.join(basePath, configs.tsupConfig);
		if (!preservedConfigs.has(configPath) && fs.existsSync(configPath)) {
			fs.unlinkSync(configPath);
			if (report) report.removedConfigCount++;
			if (!silent) log.success(`✔ Removed ${displayRelative(configPath)}`);
		}
	}
	for (const file of TSUP_CONFIG_FILES) {
		if (file === configs.tsupConfig) continue;
		const configPath = path.join(basePath, file);
		if (!preservedConfigs.has(configPath) && fs.existsSync(configPath)) {
			fs.unlinkSync(configPath);
			if (report) report.removedConfigCount++;
			if (!silent) log.success(`✔ Removed ${displayRelative(configPath)}`);
		}
	}
	editJsonFile(path.join(basePath, "package.json"), (pkg) => {
		if (pkg.tsup) {
			delete pkg.tsup;
			return pkg;
		}
	});
}
function rewriteTsupPackageJson(packageJsonPath, preserveTsupDependency = false) {
	if (!fs.existsSync(packageJsonPath)) return;
	editJsonFile(packageJsonPath, (pkg) => {
		let changed = false;
		for (const [name, script] of Object.entries(pkg.scripts ?? {})) {
			const rewritten = removeStandardTsdownConfigOption(script);
			if (rewritten !== script) {
				pkg.scripts[name] = rewritten;
				changed = true;
			}
		}
		if (!preserveTsupDependency) {
			for (const field of ["devDependencies", "dependencies"]) if (pkg[field]?.tsup) {
				delete pkg[field].tsup;
				changed = true;
			}
		}
		return changed ? pkg : void 0;
	});
}
function warnMissingTsupConfig() {
	log.warn("tsup detected, but no tsup config was found. The tsup setup must be migrated manually.");
}
async function confirmTsupMigration(interactive) {
	if (interactive) {
		const confirmed = await confirm({
			message: "Migrate tsup config to tsdown using tsdown-migrate?\n  " + styleText("gray", "tsdown is Vite+'s built-in bundler (exposed via `vp pack`) — a mostly drop-in tsup replacement powered by Rolldown. tsdown-migrate converts your existing config automatically."),
			initialValue: true
		});
		if (isCancel(confirmed)) cancelAndExit();
		if (!confirmed) showTsdownMigrationOptions();
		return confirmed;
	}
	log.info("tsup configuration detected. Auto-migrating to tsdown...");
	return true;
}
async function promptTsupMigration(projectPath, interactive, packageManager, packages) {
	const tsupProject = detectTsupProject(projectPath, packages);
	if (!tsupProject.hasDependency) return false;
	if (!tsupProject.hasConfig) {
		warnMissingTsupConfig();
		return false;
	}
	if (!await confirmTsupMigration(interactive)) return false;
	if (!await migrateTsupToTsdown(projectPath, interactive, packageManager, tsupProject.configFile, packages)) cancelAndExit("Complete the tsup migration manually, then re-run `vp migrate`.", 1);
	return true;
}
//#endregion
//#region src/migration/migrator/tsconfig.ts
function cleanupDeprecatedTsconfigOptions(projectPath, silent = false, report) {
	const deprecatedOptions = ["esModuleInterop", "allowSyntheticDefaultImports"];
	const files = findTsconfigFiles(projectPath);
	for (const filePath of files) for (const name of deprecatedOptions) if (removeDeprecatedTsconfigFalseOption(filePath, name)) {
		if (report) report.removedConfigCount++;
		if (!silent) log.success(`✔ Removed ${name}: false from ${displayRelative(filePath)}`);
		warnMigration(`Removed \`"${name}": false\` from ${displayRelative(filePath)} — this option has been deprecated. See https://github.com/oxc-project/tsgolint/issues/351, https://github.com/microsoft/TypeScript/issues/62529`, report);
	}
}
function rewriteTsconfigTypes(projectPath, silent = false, report) {
	let changed = false;
	const files = findTsconfigFiles(projectPath);
	for (const filePath of files) if (rewriteTypesInTsconfig(filePath)) {
		changed = true;
		if (report) report.removedConfigCount++;
		if (!silent) log.success(`✔ Rewrote types in ${displayRelative(filePath)}`);
	}
	return changed;
}
function hasTsconfigTypesToRewrite(projectPath) {
	return findTsconfigFiles(projectPath).some((filePath) => hasTypesToRewriteInTsconfig(filePath));
}
//#endregion
//#region src/migration/migrator/framework-shim.ts
const FRAMEWORK_SHIMS = {
	vue: [
		"declare module '*.vue' {",
		"  import type { DefineComponent } from 'vue';",
		"  const component: DefineComponent<{}, {}, unknown>;",
		"  export default component;",
		"}"
	].join("\n"),
	astro: "/// <reference types=\"astro/client\" />"
};
function detectFramework(projectPath) {
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return [];
	const pkg = readJsonFile(packageJsonPath);
	const allDeps = {
		...pkg.dependencies,
		...pkg.devDependencies
	};
	return ["vue", "astro"].filter((framework) => !!allDeps[framework]);
}
function getEnvDtsPath(projectPath) {
	const srcEnvDts = path.join(projectPath, "src", "env.d.ts");
	const rootEnvDts = path.join(projectPath, "env.d.ts");
	for (const candidate of [srcEnvDts, rootEnvDts]) if (fs.existsSync(candidate)) return candidate;
	return fs.existsSync(path.join(projectPath, "src")) ? srcEnvDts : rootEnvDts;
}
function hasFrameworkShim(projectPath, framework) {
	const dirsToScan = [projectPath, path.join(projectPath, "src")];
	for (const dir of dirsToScan) {
		if (!fs.existsSync(dir)) continue;
		let entries;
		try {
			entries = fs.readdirSync(dir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!entry.endsWith(".d.ts")) continue;
			const content = fs.readFileSync(path.join(dir, entry), "utf-8");
			if (framework === "astro") {
				if (content.includes("astro/client")) return true;
			} else if (content.includes(`'*.${framework}'`) || content.includes(`"*.${framework}"`)) return true;
		}
	}
	return false;
}
function addFrameworkShim(projectPath, framework, report) {
	const envDtsPath = getEnvDtsPath(projectPath);
	const shim = FRAMEWORK_SHIMS[framework];
	if (fs.existsSync(envDtsPath)) {
		const existing = fs.readFileSync(envDtsPath, "utf-8");
		fs.writeFileSync(envDtsPath, `${existing.trimEnd()}\n\n${shim}\n`, "utf-8");
	} else {
		fs.mkdirSync(path.dirname(envDtsPath), { recursive: true });
		fs.writeFileSync(envDtsPath, `${shim}\n`, "utf-8");
	}
	if (report) report.frameworkShimAdded = true;
}
//#endregion
//#region src/migration/migrator/vitest-ecosystem.ts
var import_dist = require_dist();
const VITEST_ALIGN_EXCLUDED = /* @__PURE__ */ new Set(["@vitest/eslint-plugin", "@vitest/coverage-c8"]);
const VITEST_DIRECT_USAGE_EXCLUDED = /* @__PURE__ */ new Set([
	"@vitest/eslint-plugin",
	"@vitest/expect",
	"@vitest/mocker",
	"@vitest/pretty-format",
	"@vitest/runner",
	"@vitest/snapshot",
	"@vitest/spy",
	"@vitest/utils",
	"@vitest/ws-client"
]);
function isAlignableVitestEcosystemPackage(name) {
	return name.startsWith("@vitest/") && !VITEST_ALIGN_EXCLUDED.has(name);
}
function extractOverrideTargetName(key) {
	let target = key.trim();
	for (let delim = target.search(/[^ |@]>/); delim !== -1; delim = target.search(/[^ |@]>/)) target = target.slice(delim + 2).trim();
	if (!target) return target;
	if (target.includes("/")) {
		const segments = target.split("/");
		const last = segments[segments.length - 1];
		const scope = segments[segments.length - 2];
		target = scope?.startsWith("@") ? `${scope}/${last}` : last;
	}
	const nameStart = target.startsWith("@") ? target.indexOf("/") + 1 : 0;
	const versionAt = target.indexOf("@", nameStart);
	if (versionAt > 0) target = target.slice(0, versionAt);
	return target;
}
function isRemovePackageOverrideKey(key) {
	return PROVIDER_OVERRIDE_DROP_NAMES.includes(extractOverrideTargetName(key));
}
function stripSegmentVersion(segment) {
	const nameStart = segment.startsWith("@") ? segment.indexOf("/") + 1 : 0;
	const versionAt = segment.indexOf("@", nameStart);
	return versionAt > 0 ? segment.slice(0, versionAt) : segment;
}
function parentGlobMatchesName(glob, name) {
	const pattern = glob.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
	return new RegExp(`^${pattern}$`).test(name);
}
function ancestorSegmentMatches(segment, name) {
	return segment.includes("*") ? parentGlobMatchesName(segment, name) : segment === name;
}
const OWNED_PROVIDER_ANCESTOR_NAMES = REMOVE_PACKAGES.filter((name) => name.startsWith("@vitest/"));
function parentChainReachesVitePlus(segments) {
	const concrete = segments.filter((segment) => segment !== "**");
	let index = 0;
	if (concrete.length > 0 && ancestorSegmentMatches(concrete[0], "vite-plus")) index = 1;
	for (; index < concrete.length; index += 1) {
		const segment = concrete[index];
		if (!OWNED_PROVIDER_ANCESTOR_NAMES.some((name) => ancestorSegmentMatches(segment, name))) return false;
	}
	return true;
}
function extractOverrideParentSegments(key) {
	let rest = key.trim();
	const pnpmParents = [];
	for (let delim = rest.search(/[^ |@]>/); delim !== -1; delim = rest.search(/[^ |@]>/)) {
		pnpmParents.push(stripSegmentVersion(rest.slice(0, delim + 1).trim()));
		rest = rest.slice(delim + 2).trim();
	}
	if (pnpmParents.length > 0) return pnpmParents;
	if (!rest.includes("/")) return null;
	const segments = rest.split("/");
	const descriptorSegmentCount = segments[segments.length - 2]?.startsWith("@") ?? false ? 2 : 1;
	const rawParents = segments.slice(0, segments.length - descriptorSegmentCount);
	if (rawParents.length === 0) return null;
	const parents = [];
	for (let i = 0; i < rawParents.length; i += 1) {
		const segment = rawParents[i];
		if (segment.startsWith("@") && i + 1 < rawParents.length) {
			parents.push(stripSegmentVersion(`${segment}/${rawParents[i + 1]}`));
			i += 1;
		} else parents.push(stripSegmentVersion(segment));
	}
	return parents;
}
function providerKeyReachesVitePlus(key, ancestorChain) {
	if (!isRemovePackageOverrideKey(key)) return false;
	const keyParents = extractOverrideParentSegments(key) ?? [];
	return parentChainReachesVitePlus([...ancestorChain, ...keyParents]);
}
function shouldDropProviderOverrideKey(key) {
	return providerKeyReachesVitePlus(key, []);
}
function childChainContribution(key) {
	return [...extractOverrideParentSegments(key) ?? [], extractOverrideTargetName(key)];
}
// @vitest/provider`. Covers bare, versioned, global-glob and `vite-plus`-parent
function dropRemovePackageOverrideKeys(overrides, ancestorChain = []) {
	if (!overrides) return false;
	let removed = false;
	for (const key of Object.keys(overrides)) {
		const value = overrides[key];
		const child = value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
		if (providerKeyReachesVitePlus(key, ancestorChain)) {
			if (child) {
				let changed = false;
				if ("." in child) {
					delete child["."];
					changed = true;
				}
				if (dropRemovePackageOverrideKeys(child, [...ancestorChain, ...childChainContribution(key)])) changed = true;
				if (Object.keys(child).length === 0) {
					delete overrides[key];
					changed = true;
				}
				if (changed) removed = true;
			} else {
				delete overrides[key];
				removed = true;
			}
			continue;
		}
		if (child) {
			if (dropRemovePackageOverrideKeys(child, [...ancestorChain, ...childChainContribution(key)])) {
				removed = true;
				if (Object.keys(child).length === 0) delete overrides[key];
			}
		}
	}
	return removed;
}
function managedOverridePackages(usesVitest) {
	if (usesVitest) return VITE_PLUS_OVERRIDE_PACKAGES;
	return Object.fromEntries(Object.entries(VITE_PLUS_OVERRIDE_PACKAGES).filter(([key]) => key !== "vitest"));
}
function projectListsVitestEcosystemDep(pkg) {
	return [
		pkg.dependencies,
		pkg.devDependencies,
		pkg.optionalDependencies
	].some((deps) => deps ? Object.keys(deps).some((name) => name !== "vitest" && name.includes("vitest") && !VITEST_DIRECT_USAGE_EXCLUDED.has(name)) : false);
}
function projectListsRequiredVitestPeer(projectPath, pkg) {
	const hasExistingVitest = [
		pkg.dependencies,
		pkg.devDependencies,
		pkg.optionalDependencies
	].some((dependencies) => dependencies?.vitest !== void 0);
	const dependencyNames = /* @__PURE__ */ new Set([
		...Object.keys(pkg.dependencies ?? {}),
		...Object.keys(pkg.devDependencies ?? {}),
		...Object.keys(pkg.optionalDependencies ?? {})
	]);
	dependencyNames.delete("vitest");
	dependencyNames.delete("vite");
	dependencyNames.delete(VITE_PLUS_NAME);
	for (const name of VITEST_DIRECT_USAGE_EXCLUDED) dependencyNames.delete(name);
	let metadataUnavailable = false;
	for (const name of dependencyNames) {
		const metadata = detectPackageMetadata(projectPath, name);
		if (!metadata) {
			metadataUnavailable = true;
			continue;
		}
		try {
			const installedPkg = readJsonFile(path.join(metadata.path, "package.json"));
			if (typeof installedPkg.peerDependencies?.vitest === "string" && installedPkg.peerDependenciesMeta?.vitest?.optional !== true) return true;
		} catch {
			metadataUnavailable = true;
		}
	}
	return metadataUnavailable && hasExistingVitest;
}
function projectUsesVitestDirectly(projectPath, pkg, requiredVitestPeer, preserveNuxtVitestImports = true, precomputedScans) {
	return projectListsVitestEcosystemDep(pkg) || (requiredVitestPeer ?? projectListsRequiredVitestPeer(projectPath, pkg)) || VITEST_BROWSER_DEP_NAMES.some((name) => pkg.peerDependencies?.[name] !== void 0) || (precomputedScans?.retainedModule ?? sourceTreeReferencesRetainedVitestModule(projectPath)) || preserveNuxtVitestImports && hasNuxtTestUtilsDependency(pkg) || (precomputedScans?.browserMode ?? usesVitestBrowserMode(projectPath));
}
function removeManagedVitestEntry(record, keyStyle = "bare") {
	if (!VITEST_IS_MANAGED_OVERRIDE || !record) return false;
	let removed = false;
	for (const key of managedVitestOverrideKeys(keyStyle)) if (typeof record[key] === "string") {
		delete record[key];
		removed = true;
	}
	return removed;
}
function removeYamlMapVitestEntry(map, keyStyle = "bare") {
	if (!VITEST_IS_MANAGED_OVERRIDE || !(map instanceof import_dist.YAMLMap)) return;
	for (const key of managedVitestOverrideKeys(keyStyle)) map.delete(key);
}
function managedVitestOverrideKeys(keyStyle) {
	return keyStyle === "pnpm-ranged" ? ["vitest", pnpmOverrideKey("vitest")] : ["vitest"];
}
function removeVitestPeerDependencyRule(peerDependencyRules) {
	if (!VITEST_IS_MANAGED_OVERRIDE) return;
	if (Array.isArray(peerDependencyRules.allowAny)) peerDependencyRules.allowAny = peerDependencyRules.allowAny.filter((key) => key !== "vitest");
	if (peerDependencyRules.allowedVersions) delete peerDependencyRules.allowedVersions.vitest;
}
const LEGACY_WRAPPER_PACKAGE_NAMES = ["@voidzero-dev/vite-plus-test"];
function isLegacyWrapperSpec(value) {
	if (typeof value !== "string" || !value) return false;
	for (const name of LEGACY_WRAPPER_PACKAGE_NAMES) if (value === `npm:${name}` || value.startsWith(`npm:${name}@`)) return true;
	return false;
}
/**
* Rewrite or remove keys whose value points at a deleted vite-plus wrapper.
* When a fallback exists for the key (e.g. `vitest`), the value is replaced
* so existing `catalog:` references continue to resolve. Otherwise the key
* is dropped entirely. Returns true iff any entry was changed.
*
* npm/bun `overrides` may nest an object of scoped overrides under a parent
* key (e.g. `{ "some-parent": { "vitest": "npm:@voidzero-dev/vite-plus-test@latest" } }`),
* so object values are recursed into; a parent emptied by pruning is dropped so
* no `{}` is left behind. Flat maps (pnpm `overrides`, yarn `resolutions`,
* catalogs) hold only string values, where the recursion is inert.
*/
function pruneLegacyWrapperAliases(record) {
	if (!record) return false;
	let mutated = false;
	for (const key of Object.keys(record)) {
		const value = record[key];
		if (value !== null && typeof value === "object" && !Array.isArray(value)) {
			if (pruneLegacyWrapperAliases(value)) {
				mutated = true;
				if (Object.keys(value).length === 0) delete record[key];
			}
			continue;
		}
		if (isLegacyWrapperSpec(value)) {
			const fallback = LEGACY_WRAPPER_FALLBACK_VERSIONS[key];
			if (fallback !== void 0) record[key] = fallback;
			else delete record[key];
			mutated = true;
		}
	}
	return mutated;
}
function getAlignedVitestEcosystemDependencySpec(current, dependencyName, dependencyField, packageManager, supportCatalog, catalogDependencyResolver) {
	return getCatalogDependencySpec(current, VITEST_VERSION, supportCatalog, {
		dependencyField,
		dependencyName,
		packageManager,
		catalogDependencyResolver,
		preferredCatalogSpec: catalogDependencyResolver?.preferredCatalogSpec
	});
}
function alignVitestEcosystemPackages(pkg, packageManager, supportCatalog, catalogDependencyResolver) {
	if (!VITEST_IS_MANAGED_OVERRIDE) return false;
	const dependencyGroups = [
		{
			dependencyField: "devDependencies",
			dependencies: pkg.devDependencies
		},
		{
			dependencyField: "dependencies",
			dependencies: pkg.dependencies
		},
		{
			dependencyField: "optionalDependencies",
			dependencies: pkg.optionalDependencies
		}
	];
	let changed = false;
	for (const { dependencyField, dependencies } of dependencyGroups) {
		if (!dependencies) continue;
		for (const name of Object.keys(dependencies)) {
			if (!isAlignableVitestEcosystemPackage(name)) continue;
			const aligned = getAlignedVitestEcosystemDependencySpec(dependencies[name], name, dependencyField, packageManager, supportCatalog, catalogDependencyResolver);
			if (dependencies[name] !== aligned) {
				dependencies[name] = aligned;
				changed = true;
			}
		}
	}
	return changed;
}
function vitestEcosystemCatalogReferencesPending(pkg, catalogDependencyResolver) {
	if (!VITEST_IS_MANAGED_OVERRIDE || !catalogDependencyResolver) return false;
	for (const dependencies of [
		pkg.devDependencies,
		pkg.dependencies,
		pkg.optionalDependencies
	]) {
		if (!dependencies) continue;
		for (const [name, spec] of Object.entries(dependencies)) if (isAlignableVitestEcosystemPackage(name) && spec.startsWith("catalog:") && catalogDependencyResolver(spec, name) !== "4.1.11") return true;
	}
	return false;
}
function collectVitestEcosystemInstallDependencyNames(rootDir, packages) {
	const names = /* @__PURE__ */ new Set();
	for (const packagePath of bootstrapProjectPaths(rootDir, packages)) {
		const packageJsonPath = path.join(packagePath, "package.json");
		if (!fs.existsSync(packageJsonPath)) continue;
		const pkg = readJsonFile(packageJsonPath);
		for (const dependencies of [
			pkg.devDependencies,
			pkg.dependencies,
			pkg.optionalDependencies
		]) for (const name of Object.keys(dependencies ?? {})) if (isAlignableVitestEcosystemPackage(name)) names.add(name);
	}
	return names;
}
//#endregion
//#region ../../node_modules/.pnpm/balanced-match@4.0.4/node_modules/balanced-match/dist/esm/index.js
const balanced = (a, b, str) => {
	const ma = a instanceof RegExp ? maybeMatch(a, str) : a;
	const mb = b instanceof RegExp ? maybeMatch(b, str) : b;
	const r = ma !== null && mb != null && range(ma, mb, str);
	return r && {
		start: r[0],
		end: r[1],
		pre: str.slice(0, r[0]),
		body: str.slice(r[0] + ma.length, r[1]),
		post: str.slice(r[1] + mb.length)
	};
};
const maybeMatch = (reg, str) => {
	const m = str.match(reg);
	return m ? m[0] : null;
};
const range = (a, b, str) => {
	let begs, beg, left, right = void 0, result;
	let ai = str.indexOf(a);
	let bi = str.indexOf(b, ai + 1);
	let i = ai;
	if (ai >= 0 && bi > 0) {
		if (a === b) return [ai, bi];
		begs = [];
		left = str.length;
		while (i >= 0 && !result) {
			if (i === ai) {
				begs.push(i);
				ai = str.indexOf(a, i + 1);
			} else if (begs.length === 1) {
				const r = begs.pop();
				if (r !== void 0) result = [r, bi];
			} else {
				beg = begs.pop();
				if (beg !== void 0 && beg < left) {
					left = beg;
					right = bi;
				}
				bi = str.indexOf(b, i + 1);
			}
			i = ai < bi && ai >= 0 ? ai : bi;
		}
		if (begs.length && right !== void 0) result = [left, right];
	}
	return result;
};
//#endregion
//#region ../../node_modules/.pnpm/brace-expansion@5.0.3/node_modules/brace-expansion/dist/esm/index.js
const escSlash = "\0SLASH" + Math.random() + "\0";
const escOpen = "\0OPEN" + Math.random() + "\0";
const escClose = "\0CLOSE" + Math.random() + "\0";
const escComma = "\0COMMA" + Math.random() + "\0";
const escPeriod = "\0PERIOD" + Math.random() + "\0";
const escSlashPattern = new RegExp(escSlash, "g");
const escOpenPattern = new RegExp(escOpen, "g");
const escClosePattern = new RegExp(escClose, "g");
const escCommaPattern = new RegExp(escComma, "g");
const escPeriodPattern = new RegExp(escPeriod, "g");
const slashPattern = /\\\\/g;
const openPattern = /\\{/g;
const closePattern = /\\}/g;
const commaPattern = /\\,/g;
const periodPattern = /\\./g;
const EXPANSION_MAX = 1e5;
function numeric(str) {
	return !isNaN(str) ? parseInt(str, 10) : str.charCodeAt(0);
}
function escapeBraces(str) {
	return str.replace(slashPattern, escSlash).replace(openPattern, escOpen).replace(closePattern, escClose).replace(commaPattern, escComma).replace(periodPattern, escPeriod);
}
function unescapeBraces(str) {
	return str.replace(escSlashPattern, "\\").replace(escOpenPattern, "{").replace(escClosePattern, "}").replace(escCommaPattern, ",").replace(escPeriodPattern, ".");
}
/**
* Basically just str.split(","), but handling cases
* where we have nested braced sections, which should be
* treated as individual members, like {a,{b,c},d}
*/
function parseCommaParts(str) {
	if (!str) return [""];
	const parts = [];
	const m = balanced("{", "}", str);
	if (!m) return str.split(",");
	const { pre, body, post } = m;
	const p = pre.split(",");
	p[p.length - 1] += "{" + body + "}";
	const postParts = parseCommaParts(post);
	if (post.length) {
		p[p.length - 1] += postParts.shift();
		p.push.apply(p, postParts);
	}
	parts.push.apply(parts, p);
	return parts;
}
function expand(str, options = {}) {
	if (!str) return [];
	const { max = EXPANSION_MAX } = options;
	if (str.slice(0, 2) === "{}") str = "\\{\\}" + str.slice(2);
	return expand_(escapeBraces(str), max, true).map(unescapeBraces);
}
function embrace(str) {
	return "{" + str + "}";
}
function isPadded(el) {
	return /^-?0\d/.test(el);
}
function lte(i, y) {
	return i <= y;
}
function gte(i, y) {
	return i >= y;
}
function expand_(str, max, isTop) {
	/** @type {string[]} */
	const expansions = [];
	const m = balanced("{", "}", str);
	if (!m) return [str];
	const pre = m.pre;
	const post = m.post.length ? expand_(m.post, max, false) : [""];
	if (/\$$/.test(m.pre)) for (let k = 0; k < post.length && k < max; k++) {
		const expansion = pre + "{" + m.body + "}" + post[k];
		expansions.push(expansion);
	}
	else {
		const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
		const isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
		const isSequence = isNumericSequence || isAlphaSequence;
		const isOptions = m.body.indexOf(",") >= 0;
		if (!isSequence && !isOptions) {
			if (m.post.match(/,(?!,).*\}/)) {
				str = m.pre + "{" + m.body + escClose + m.post;
				return expand_(str, max, true);
			}
			return [str];
		}
		let n;
		if (isSequence) n = m.body.split(/\.\./);
		else {
			n = parseCommaParts(m.body);
			if (n.length === 1 && n[0] !== void 0) {
				n = expand_(n[0], max, false).map(embrace);
				/* c8 ignore start */
				if (n.length === 1) return post.map((p) => m.pre + n[0] + p);
			}
		}
		let N;
		if (isSequence && n[0] !== void 0 && n[1] !== void 0) {
			const x = numeric(n[0]);
			const y = numeric(n[1]);
			const width = Math.max(n[0].length, n[1].length);
			let incr = n.length === 3 && n[2] !== void 0 ? Math.abs(numeric(n[2])) : 1;
			let test = lte;
			if (y < x) {
				incr *= -1;
				test = gte;
			}
			const pad = n.some(isPadded);
			N = [];
			for (let i = x; test(i, y); i += incr) {
				let c;
				if (isAlphaSequence) {
					c = String.fromCharCode(i);
					if (c === "\\") c = "";
				} else {
					c = String(i);
					if (pad) {
						const need = width - c.length;
						if (need > 0) {
							const z = new Array(need + 1).join("0");
							if (i < 0) c = "-" + z + c.slice(1);
							else c = z + c;
						}
					}
				}
				N.push(c);
			}
		} else {
			N = [];
			for (let j = 0; j < n.length; j++) N.push.apply(N, expand_(n[j], max, false));
		}
		for (let j = 0; j < N.length; j++) for (let k = 0; k < post.length && expansions.length < max; k++) {
			const expansion = pre + N[j] + post[k];
			if (!isTop || isSequence || expansion) expansions.push(expansion);
		}
	}
	return expansions;
}
//#endregion
//#region ../../node_modules/.pnpm/minimatch@10.2.4/node_modules/minimatch/dist/esm/assert-valid-pattern.js
const MAX_PATTERN_LENGTH = 65536;
const assertValidPattern = (pattern) => {
	if (typeof pattern !== "string") throw new TypeError("invalid pattern");
	if (pattern.length > MAX_PATTERN_LENGTH) throw new TypeError("pattern is too long");
};
//#endregion
//#region ../../node_modules/.pnpm/minimatch@10.2.4/node_modules/minimatch/dist/esm/brace-expressions.js
const posixClasses = {
	"[:alnum:]": ["\\p{L}\\p{Nl}\\p{Nd}", true],
	"[:alpha:]": ["\\p{L}\\p{Nl}", true],
	"[:ascii:]": ["\\x00-\\x7f", false],
	"[:blank:]": ["\\p{Zs}\\t", true],
	"[:cntrl:]": ["\\p{Cc}", true],
	"[:digit:]": ["\\p{Nd}", true],
	"[:graph:]": [
		"\\p{Z}\\p{C}",
		true,
		true
	],
	"[:lower:]": ["\\p{Ll}", true],
	"[:print:]": ["\\p{C}", true],
	"[:punct:]": ["\\p{P}", true],
	"[:space:]": ["\\p{Z}\\t\\r\\n\\v\\f", true],
	"[:upper:]": ["\\p{Lu}", true],
	"[:word:]": ["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}", true],
	"[:xdigit:]": ["A-Fa-f0-9", false]
};
const braceEscape = (s) => s.replace(/[[\]\\-]/g, "\\$&");
const regexpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
const rangesToString = (ranges) => ranges.join("");
const parseClass = (glob, position) => {
	const pos = position;
	/* c8 ignore start */
	if (glob.charAt(pos) !== "[") throw new Error("not in a brace expression");
	/* c8 ignore stop */
	const ranges = [];
	const negs = [];
	let i = pos + 1;
	let sawStart = false;
	let uflag = false;
	let escaping = false;
	let negate = false;
	let endPos = pos;
	let rangeStart = "";
	WHILE: while (i < glob.length) {
		const c = glob.charAt(i);
		if ((c === "!" || c === "^") && i === pos + 1) {
			negate = true;
			i++;
			continue;
		}
		if (c === "]" && sawStart && !escaping) {
			endPos = i + 1;
			break;
		}
		sawStart = true;
		if (c === "\\") {
			if (!escaping) {
				escaping = true;
				i++;
				continue;
			}
		}
		if (c === "[" && !escaping) {
			for (const [cls, [unip, u, neg]] of Object.entries(posixClasses)) if (glob.startsWith(cls, i)) {
				if (rangeStart) return [
					"$.",
					false,
					glob.length - pos,
					true
				];
				i += cls.length;
				if (neg) negs.push(unip);
				else ranges.push(unip);
				uflag = uflag || u;
				continue WHILE;
			}
		}
		escaping = false;
		if (rangeStart) {
			if (c > rangeStart) ranges.push(braceEscape(rangeStart) + "-" + braceEscape(c));
			else if (c === rangeStart) ranges.push(braceEscape(c));
			rangeStart = "";
			i++;
			continue;
		}
		if (glob.startsWith("-]", i + 1)) {
			ranges.push(braceEscape(c + "-"));
			i += 2;
			continue;
		}
		if (glob.startsWith("-", i + 1)) {
			rangeStart = c;
			i += 2;
			continue;
		}
		ranges.push(braceEscape(c));
		i++;
	}
	if (endPos < i) return [
		"",
		false,
		0,
		false
	];
	if (!ranges.length && !negs.length) return [
		"$.",
		false,
		glob.length - pos,
		true
	];
	if (negs.length === 0 && ranges.length === 1 && /^\\?.$/.test(ranges[0]) && !negate) {
		const r = ranges[0].length === 2 ? ranges[0].slice(-1) : ranges[0];
		return [
			regexpEscape(r),
			false,
			endPos - pos,
			false
		];
	}
	const sranges = "[" + (negate ? "^" : "") + rangesToString(ranges) + "]";
	const snegs = "[" + (negate ? "" : "^") + rangesToString(negs) + "]";
	return [
		ranges.length && negs.length ? "(" + sranges + "|" + snegs + ")" : ranges.length ? sranges : snegs,
		uflag,
		endPos - pos,
		true
	];
};
//#endregion
//#region ../../node_modules/.pnpm/minimatch@10.2.4/node_modules/minimatch/dist/esm/unescape.js
/**
* Un-escape a string that has been escaped with {@link escape}.
*
* If the {@link MinimatchOptions.windowsPathsNoEscape} option is used, then
* square-bracket escapes are removed, but not backslash escapes.
*
* For example, it will turn the string `'[*]'` into `*`, but it will not
* turn `'\\*'` into `'*'`, because `\` is a path separator in
* `windowsPathsNoEscape` mode.
*
* When `windowsPathsNoEscape` is not set, then both square-bracket escapes and
* backslash escapes are removed.
*
* Slashes (and backslashes in `windowsPathsNoEscape` mode) cannot be escaped
* or unescaped.
*
* When `magicalBraces` is not set, escapes of braces (`{` and `}`) will not be
* unescaped.
*/
const unescape = (s, { windowsPathsNoEscape = false, magicalBraces = true } = {}) => {
	if (magicalBraces) return windowsPathsNoEscape ? s.replace(/\[([^\/\\])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^\/\\])\]/g, "$1$2").replace(/\\([^\/])/g, "$1");
	return windowsPathsNoEscape ? s.replace(/\[([^\/\\{}])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^\/\\{}])\]/g, "$1$2").replace(/\\([^\/{}])/g, "$1");
};
//#endregion
//#region ../../node_modules/.pnpm/minimatch@10.2.4/node_modules/minimatch/dist/esm/ast.js
var _a;
const types = /* @__PURE__ */ new Set([
	"!",
	"?",
	"+",
	"*",
	"@"
]);
const isExtglobType = (c) => types.has(c);
const isExtglobAST = (c) => isExtglobType(c.type);
const adoptionMap = /* @__PURE__ */ new Map([
	["!", ["@"]],
	["?", ["?", "@"]],
	["@", ["@"]],
	["*", [
		"*",
		"+",
		"?",
		"@"
	]],
	["+", ["+", "@"]]
]);
const adoptionWithSpaceMap = /* @__PURE__ */ new Map([
	["!", ["?"]],
	["@", ["?"]],
	["+", ["?", "*"]]
]);
const adoptionAnyMap = /* @__PURE__ */ new Map([
	["!", ["?", "@"]],
	["?", ["?", "@"]],
	["@", ["?", "@"]],
	["*", [
		"*",
		"+",
		"?",
		"@"
	]],
	["+", [
		"+",
		"@",
		"?",
		"*"
	]]
]);
const usurpMap = /* @__PURE__ */ new Map([
	["!", /* @__PURE__ */ new Map([["!", "@"]])],
	["?", /* @__PURE__ */ new Map([["*", "*"], ["+", "*"]])],
	["@", /* @__PURE__ */ new Map([
		["!", "!"],
		["?", "?"],
		["@", "@"],
		["*", "*"],
		["+", "+"]
	])],
	["+", /* @__PURE__ */ new Map([["?", "*"], ["*", "*"]])]
]);
const startNoTraversal = "(?!(?:^|/)\\.\\.?(?:$|/))";
const startNoDot = "(?!\\.)";
const addPatternStart = /* @__PURE__ */ new Set(["[", "."]);
const justDots = /* @__PURE__ */ new Set(["..", "."]);
const reSpecials = /* @__PURE__ */ new Set("().*{}+?[]^$\\!");
const regExpEscape$1 = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
const qmark = "[^/]";
const star$1 = "[^/]*?";
const starNoEmpty = "[^/]+?";
let ID = 0;
var AST = class {
	type;
	#root;
	#hasMagic;
	#uflag = false;
	#parts = [];
	#parent;
	#parentIndex;
	#negs;
	#filledNegs = false;
	#options;
	#toString;
	#emptyExt = false;
	id = ++ID;
	get depth() {
		return (this.#parent?.depth ?? -1) + 1;
	}
	[Symbol.for("nodejs.util.inspect.custom")]() {
		return {
			"@@type": "AST",
			id: this.id,
			type: this.type,
			root: this.#root.id,
			parent: this.#parent?.id,
			depth: this.depth,
			partsLength: this.#parts.length,
			parts: this.#parts
		};
	}
	constructor(type, parent, options = {}) {
		this.type = type;
		if (type) this.#hasMagic = true;
		this.#parent = parent;
		this.#root = this.#parent ? this.#parent.#root : this;
		this.#options = this.#root === this ? options : this.#root.#options;
		this.#negs = this.#root === this ? [] : this.#root.#negs;
		if (type === "!" && !this.#root.#filledNegs) this.#negs.push(this);
		this.#parentIndex = this.#parent ? this.#parent.#parts.length : 0;
	}
	get hasMagic() {
		/* c8 ignore start */
		if (this.#hasMagic !== void 0) return this.#hasMagic;
		/* c8 ignore stop */
		for (const p of this.#parts) {
			if (typeof p === "string") continue;
			if (p.type || p.hasMagic) return this.#hasMagic = true;
		}
		return this.#hasMagic;
	}
	toString() {
		if (this.#toString !== void 0) return this.#toString;
		if (!this.type) return this.#toString = this.#parts.map((p) => String(p)).join("");
		else return this.#toString = this.type + "(" + this.#parts.map((p) => String(p)).join("|") + ")";
	}
	#fillNegs() {
		/* c8 ignore start */
		if (this !== this.#root) throw new Error("should only call on root");
		if (this.#filledNegs) return this;
		/* c8 ignore stop */
		this.toString();
		this.#filledNegs = true;
		let n;
		while (n = this.#negs.pop()) {
			if (n.type !== "!") continue;
			let p = n;
			let pp = p.#parent;
			while (pp) {
				for (let i = p.#parentIndex + 1; !pp.type && i < pp.#parts.length; i++) for (const part of n.#parts) {
					/* c8 ignore start */
					if (typeof part === "string") throw new Error("string part in extglob AST??");
					/* c8 ignore stop */
					part.copyIn(pp.#parts[i]);
				}
				p = pp;
				pp = p.#parent;
			}
		}
		return this;
	}
	push(...parts) {
		for (const p of parts) {
			if (p === "") continue;
			/* c8 ignore start */
			if (typeof p !== "string" && !(p instanceof _a && p.#parent === this)) throw new Error("invalid part: " + p);
			/* c8 ignore stop */
			this.#parts.push(p);
		}
	}
	toJSON() {
		const ret = this.type === null ? this.#parts.slice().map((p) => typeof p === "string" ? p : p.toJSON()) : [this.type, ...this.#parts.map((p) => p.toJSON())];
		if (this.isStart() && !this.type) ret.unshift([]);
		if (this.isEnd() && (this === this.#root || this.#root.#filledNegs && this.#parent?.type === "!")) ret.push({});
		return ret;
	}
	isStart() {
		if (this.#root === this) return true;
		if (!this.#parent?.isStart()) return false;
		if (this.#parentIndex === 0) return true;
		const p = this.#parent;
		for (let i = 0; i < this.#parentIndex; i++) {
			const pp = p.#parts[i];
			if (!(pp instanceof _a && pp.type === "!")) return false;
		}
		return true;
	}
	isEnd() {
		if (this.#root === this) return true;
		if (this.#parent?.type === "!") return true;
		if (!this.#parent?.isEnd()) return false;
		if (!this.type) return this.#parent?.isEnd();
		/* c8 ignore start */
		const pl = this.#parent ? this.#parent.#parts.length : 0;
		/* c8 ignore stop */
		return this.#parentIndex === pl - 1;
	}
	copyIn(part) {
		if (typeof part === "string") this.push(part);
		else this.push(part.clone(this));
	}
	clone(parent) {
		const c = new _a(this.type, parent);
		for (const p of this.#parts) c.copyIn(p);
		return c;
	}
	static #parseAST(str, ast, pos, opt, extDepth) {
		const maxDepth = opt.maxExtglobRecursion ?? 2;
		let escaping = false;
		let inBrace = false;
		let braceStart = -1;
		let braceNeg = false;
		if (ast.type === null) {
			let i = pos;
			let acc = "";
			while (i < str.length) {
				const c = str.charAt(i++);
				if (escaping || c === "\\") {
					escaping = !escaping;
					acc += c;
					continue;
				}
				if (inBrace) {
					if (i === braceStart + 1) {
						if (c === "^" || c === "!") braceNeg = true;
					} else if (c === "]" && !(i === braceStart + 2 && braceNeg)) inBrace = false;
					acc += c;
					continue;
				} else if (c === "[") {
					inBrace = true;
					braceStart = i;
					braceNeg = false;
					acc += c;
					continue;
				}
				if (!opt.noext && isExtglobType(c) && str.charAt(i) === "(" && extDepth <= maxDepth) {
					ast.push(acc);
					acc = "";
					const ext = new _a(c, ast);
					i = _a.#parseAST(str, ext, i, opt, extDepth + 1);
					ast.push(ext);
					continue;
				}
				acc += c;
			}
			ast.push(acc);
			return i;
		}
		let i = pos + 1;
		let part = new _a(null, ast);
		const parts = [];
		let acc = "";
		while (i < str.length) {
			const c = str.charAt(i++);
			if (escaping || c === "\\") {
				escaping = !escaping;
				acc += c;
				continue;
			}
			if (inBrace) {
				if (i === braceStart + 1) {
					if (c === "^" || c === "!") braceNeg = true;
				} else if (c === "]" && !(i === braceStart + 2 && braceNeg)) inBrace = false;
				acc += c;
				continue;
			} else if (c === "[") {
				inBrace = true;
				braceStart = i;
				braceNeg = false;
				acc += c;
				continue;
			}
			/* c8 ignore stop */
			if (!opt.noext && isExtglobType(c) && str.charAt(i) === "(" && (extDepth <= maxDepth || ast && ast.#canAdoptType(c))) {
				const depthAdd = ast && ast.#canAdoptType(c) ? 0 : 1;
				part.push(acc);
				acc = "";
				const ext = new _a(c, part);
				part.push(ext);
				i = _a.#parseAST(str, ext, i, opt, extDepth + depthAdd);
				continue;
			}
			if (c === "|") {
				part.push(acc);
				acc = "";
				parts.push(part);
				part = new _a(null, ast);
				continue;
			}
			if (c === ")") {
				if (acc === "" && ast.#parts.length === 0) ast.#emptyExt = true;
				part.push(acc);
				acc = "";
				ast.push(...parts, part);
				return i;
			}
			acc += c;
		}
		ast.type = null;
		ast.#hasMagic = void 0;
		ast.#parts = [str.substring(pos - 1)];
		return i;
	}
	#canAdoptWithSpace(child) {
		return this.#canAdopt(child, adoptionWithSpaceMap);
	}
	#canAdopt(child, map = adoptionMap) {
		if (!child || typeof child !== "object" || child.type !== null || child.#parts.length !== 1 || this.type === null) return false;
		const gc = child.#parts[0];
		if (!gc || typeof gc !== "object" || gc.type === null) return false;
		return this.#canAdoptType(gc.type, map);
	}
	#canAdoptType(c, map = adoptionAnyMap) {
		return !!map.get(this.type)?.includes(c);
	}
	#adoptWithSpace(child, index) {
		const gc = child.#parts[0];
		const blank = new _a(null, gc, this.options);
		blank.#parts.push("");
		gc.push(blank);
		this.#adopt(child, index);
	}
	#adopt(child, index) {
		const gc = child.#parts[0];
		this.#parts.splice(index, 1, ...gc.#parts);
		for (const p of gc.#parts) if (typeof p === "object") p.#parent = this;
		this.#toString = void 0;
	}
	#canUsurpType(c) {
		return !!usurpMap.get(this.type)?.has(c);
	}
	#canUsurp(child) {
		if (!child || typeof child !== "object" || child.type !== null || child.#parts.length !== 1 || this.type === null || this.#parts.length !== 1) return false;
		const gc = child.#parts[0];
		if (!gc || typeof gc !== "object" || gc.type === null) return false;
		return this.#canUsurpType(gc.type);
	}
	#usurp(child) {
		const m = usurpMap.get(this.type);
		const gc = child.#parts[0];
		const nt = m?.get(gc.type);
		/* c8 ignore start - impossible */
		if (!nt) return false;
		/* c8 ignore stop */
		this.#parts = gc.#parts;
		for (const p of this.#parts) if (typeof p === "object") p.#parent = this;
		this.type = nt;
		this.#toString = void 0;
		this.#emptyExt = false;
	}
	static fromGlob(pattern, options = {}) {
		const ast = new _a(null, void 0, options);
		_a.#parseAST(pattern, ast, 0, options, 0);
		return ast;
	}
	toMMPattern() {
		/* c8 ignore start */
		if (this !== this.#root) return this.#root.toMMPattern();
		/* c8 ignore stop */
		const glob = this.toString();
		const [re, body, hasMagic, uflag] = this.toRegExpSource();
		if (!(hasMagic || this.#hasMagic || this.#options.nocase && !this.#options.nocaseMagicOnly && glob.toUpperCase() !== glob.toLowerCase())) return body;
		const flags = (this.#options.nocase ? "i" : "") + (uflag ? "u" : "");
		return Object.assign(new RegExp(`^${re}$`, flags), {
			_src: re,
			_glob: glob
		});
	}
	get options() {
		return this.#options;
	}
	toRegExpSource(allowDot) {
		const dot = allowDot ?? !!this.#options.dot;
		if (this.#root === this) {
			this.#flatten();
			this.#fillNegs();
		}
		if (!isExtglobAST(this)) {
			const noEmpty = this.isStart() && this.isEnd() && !this.#parts.some((s) => typeof s !== "string");
			const src = this.#parts.map((p) => {
				const [re, _, hasMagic, uflag] = typeof p === "string" ? _a.#parseGlob(p, this.#hasMagic, noEmpty) : p.toRegExpSource(allowDot);
				this.#hasMagic = this.#hasMagic || hasMagic;
				this.#uflag = this.#uflag || uflag;
				return re;
			}).join("");
			let start = "";
			if (this.isStart()) {
				if (typeof this.#parts[0] === "string") {
					if (!(this.#parts.length === 1 && justDots.has(this.#parts[0]))) {
						const aps = addPatternStart;
						const needNoTrav = dot && aps.has(src.charAt(0)) || src.startsWith("\\.") && aps.has(src.charAt(2)) || src.startsWith("\\.\\.") && aps.has(src.charAt(4));
						const needNoDot = !dot && !allowDot && aps.has(src.charAt(0));
						start = needNoTrav ? startNoTraversal : needNoDot ? startNoDot : "";
					}
				}
			}
			let end = "";
			if (this.isEnd() && this.#root.#filledNegs && this.#parent?.type === "!") end = "(?:$|\\/)";
			return [
				start + src + end,
				unescape(src),
				this.#hasMagic = !!this.#hasMagic,
				this.#uflag
			];
		}
		const repeated = this.type === "*" || this.type === "+";
		const start = this.type === "!" ? "(?:(?!(?:" : "(?:";
		let body = this.#partsToRegExp(dot);
		if (this.isStart() && this.isEnd() && !body && this.type !== "!") {
			const s = this.toString();
			const me = this;
			me.#parts = [s];
			me.type = null;
			me.#hasMagic = void 0;
			return [
				s,
				unescape(this.toString()),
				false,
				false
			];
		}
		let bodyDotAllowed = !repeated || allowDot || dot || false ? "" : this.#partsToRegExp(true);
		if (bodyDotAllowed === body) bodyDotAllowed = "";
		if (bodyDotAllowed) body = `(?:${body})(?:${bodyDotAllowed})*?`;
		let final = "";
		if (this.type === "!" && this.#emptyExt) final = (this.isStart() && !dot ? startNoDot : "") + starNoEmpty;
		else {
			const close = this.type === "!" ? "))" + (this.isStart() && !dot && !allowDot ? startNoDot : "") + "[^/]*?)" : this.type === "@" ? ")" : this.type === "?" ? ")?" : this.type === "+" && bodyDotAllowed ? ")" : this.type === "*" && bodyDotAllowed ? `)?` : `)${this.type}`;
			final = start + body + close;
		}
		return [
			final,
			unescape(body),
			this.#hasMagic = !!this.#hasMagic,
			this.#uflag
		];
	}
	#flatten() {
		if (!isExtglobAST(this)) {
			for (const p of this.#parts) if (typeof p === "object") p.#flatten();
		} else {
			let iterations = 0;
			let done = false;
			do {
				done = true;
				for (let i = 0; i < this.#parts.length; i++) {
					const c = this.#parts[i];
					if (typeof c === "object") {
						c.#flatten();
						if (this.#canAdopt(c)) {
							done = false;
							this.#adopt(c, i);
						} else if (this.#canAdoptWithSpace(c)) {
							done = false;
							this.#adoptWithSpace(c, i);
						} else if (this.#canUsurp(c)) {
							done = false;
							this.#usurp(c);
						}
					}
				}
			} while (!done && ++iterations < 10);
		}
		this.#toString = void 0;
	}
	#partsToRegExp(dot) {
		return this.#parts.map((p) => {
			/* c8 ignore start */
			if (typeof p === "string") throw new Error("string type in extglob ast??");
			/* c8 ignore stop */
			const [re, _, _hasMagic, uflag] = p.toRegExpSource(dot);
			this.#uflag = this.#uflag || uflag;
			return re;
		}).filter((p) => !(this.isStart() && this.isEnd()) || !!p).join("|");
	}
	static #parseGlob(glob, hasMagic, noEmpty = false) {
		let escaping = false;
		let re = "";
		let uflag = false;
		let inStar = false;
		for (let i = 0; i < glob.length; i++) {
			const c = glob.charAt(i);
			if (escaping) {
				escaping = false;
				re += (reSpecials.has(c) ? "\\" : "") + c;
				continue;
			}
			if (c === "*") {
				if (inStar) continue;
				inStar = true;
				re += noEmpty && /^[*]+$/.test(glob) ? starNoEmpty : star$1;
				hasMagic = true;
				continue;
			} else inStar = false;
			if (c === "\\") {
				if (i === glob.length - 1) re += "\\\\";
				else escaping = true;
				continue;
			}
			if (c === "[") {
				const [src, needUflag, consumed, magic] = parseClass(glob, i);
				if (consumed) {
					re += src;
					uflag = uflag || needUflag;
					i += consumed - 1;
					hasMagic = hasMagic || magic;
					continue;
				}
			}
			if (c === "?") {
				re += qmark;
				hasMagic = true;
				continue;
			}
			re += regExpEscape$1(c);
		}
		return [
			re,
			unescape(glob),
			!!hasMagic,
			uflag
		];
	}
};
_a = AST;
//#endregion
//#region ../../node_modules/.pnpm/minimatch@10.2.4/node_modules/minimatch/dist/esm/escape.js
/**
* Escape all magic characters in a glob pattern.
*
* If the {@link MinimatchOptions.windowsPathsNoEscape}
* option is used, then characters are escaped by wrapping in `[]`, because
* a magic character wrapped in a character class can only be satisfied by
* that exact character.  In this mode, `\` is _not_ escaped, because it is
* not interpreted as a magic character, but instead as a path separator.
*
* If the {@link MinimatchOptions.magicalBraces} option is used,
* then braces (`{` and `}`) will be escaped.
*/
const escape = (s, { windowsPathsNoEscape = false, magicalBraces = false } = {}) => {
	if (magicalBraces) return windowsPathsNoEscape ? s.replace(/[?*()[\]{}]/g, "[$&]") : s.replace(/[?*()[\]\\{}]/g, "\\$&");
	return windowsPathsNoEscape ? s.replace(/[?*()[\]]/g, "[$&]") : s.replace(/[?*()[\]\\]/g, "\\$&");
};
//#endregion
//#region ../../node_modules/.pnpm/minimatch@10.2.4/node_modules/minimatch/dist/esm/index.js
const minimatch = (p, pattern, options = {}) => {
	assertValidPattern(pattern);
	if (!options.nocomment && pattern.charAt(0) === "#") return false;
	return new Minimatch(pattern, options).match(p);
};
const starDotExtRE = /^\*+([^+@!?\*\[\(]*)$/;
const starDotExtTest = (ext) => (f) => !f.startsWith(".") && f.endsWith(ext);
const starDotExtTestDot = (ext) => (f) => f.endsWith(ext);
const starDotExtTestNocase = (ext) => {
	ext = ext.toLowerCase();
	return (f) => !f.startsWith(".") && f.toLowerCase().endsWith(ext);
};
const starDotExtTestNocaseDot = (ext) => {
	ext = ext.toLowerCase();
	return (f) => f.toLowerCase().endsWith(ext);
};
const starDotStarRE = /^\*+\.\*+$/;
const starDotStarTest = (f) => !f.startsWith(".") && f.includes(".");
const starDotStarTestDot = (f) => f !== "." && f !== ".." && f.includes(".");
const dotStarRE = /^\.\*+$/;
const dotStarTest = (f) => f !== "." && f !== ".." && f.startsWith(".");
const starRE = /^\*+$/;
const starTest = (f) => f.length !== 0 && !f.startsWith(".");
const starTestDot = (f) => f.length !== 0 && f !== "." && f !== "..";
const qmarksRE = /^\?+([^+@!?\*\[\(]*)?$/;
const qmarksTestNocase = ([$0, ext = ""]) => {
	const noext = qmarksTestNoExt([$0]);
	if (!ext) return noext;
	ext = ext.toLowerCase();
	return (f) => noext(f) && f.toLowerCase().endsWith(ext);
};
const qmarksTestNocaseDot = ([$0, ext = ""]) => {
	const noext = qmarksTestNoExtDot([$0]);
	if (!ext) return noext;
	ext = ext.toLowerCase();
	return (f) => noext(f) && f.toLowerCase().endsWith(ext);
};
const qmarksTestDot = ([$0, ext = ""]) => {
	const noext = qmarksTestNoExtDot([$0]);
	return !ext ? noext : (f) => noext(f) && f.endsWith(ext);
};
const qmarksTest = ([$0, ext = ""]) => {
	const noext = qmarksTestNoExt([$0]);
	return !ext ? noext : (f) => noext(f) && f.endsWith(ext);
};
const qmarksTestNoExt = ([$0]) => {
	const len = $0.length;
	return (f) => f.length === len && !f.startsWith(".");
};
const qmarksTestNoExtDot = ([$0]) => {
	const len = $0.length;
	return (f) => f.length === len && f !== "." && f !== "..";
};
/* c8 ignore start */
const defaultPlatform$2 = typeof process === "object" && process ? typeof process.env === "object" && process.env && process.env.__MINIMATCH_TESTING_PLATFORM__ || process.platform : "posix";
const path$1 = {
	win32: { sep: "\\" },
	posix: { sep: "/" }
};
minimatch.sep = defaultPlatform$2 === "win32" ? path$1.win32.sep : path$1.posix.sep;
const GLOBSTAR = Symbol("globstar **");
minimatch.GLOBSTAR = GLOBSTAR;
const star = "[^/]*?";
const twoStarDot = "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?";
const twoStarNoDot = "(?:(?!(?:\\/|^)\\.).)*?";
const filter = (pattern, options = {}) => (p) => minimatch(p, pattern, options);
minimatch.filter = filter;
const ext = (a, b = {}) => Object.assign({}, a, b);
const defaults = (def) => {
	if (!def || typeof def !== "object" || !Object.keys(def).length) return minimatch;
	const orig = minimatch;
	const m = (p, pattern, options = {}) => orig(p, pattern, ext(def, options));
	return Object.assign(m, {
		Minimatch: class Minimatch extends orig.Minimatch {
			constructor(pattern, options = {}) {
				super(pattern, ext(def, options));
			}
			static defaults(options) {
				return orig.defaults(ext(def, options)).Minimatch;
			}
		},
		AST: class AST extends orig.AST {
			/* c8 ignore start */
			constructor(type, parent, options = {}) {
				super(type, parent, ext(def, options));
			}
			/* c8 ignore stop */
			static fromGlob(pattern, options = {}) {
				return orig.AST.fromGlob(pattern, ext(def, options));
			}
		},
		unescape: (s, options = {}) => orig.unescape(s, ext(def, options)),
		escape: (s, options = {}) => orig.escape(s, ext(def, options)),
		filter: (pattern, options = {}) => orig.filter(pattern, ext(def, options)),
		defaults: (options) => orig.defaults(ext(def, options)),
		makeRe: (pattern, options = {}) => orig.makeRe(pattern, ext(def, options)),
		braceExpand: (pattern, options = {}) => orig.braceExpand(pattern, ext(def, options)),
		match: (list, pattern, options = {}) => orig.match(list, pattern, ext(def, options)),
		sep: orig.sep,
		GLOBSTAR
	});
};
minimatch.defaults = defaults;
const braceExpand = (pattern, options = {}) => {
	assertValidPattern(pattern);
	if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) return [pattern];
	return expand(pattern, { max: options.braceExpandMax });
};
minimatch.braceExpand = braceExpand;
const makeRe = (pattern, options = {}) => new Minimatch(pattern, options).makeRe();
minimatch.makeRe = makeRe;
const match = (list, pattern, options = {}) => {
	const mm = new Minimatch(pattern, options);
	list = list.filter((f) => mm.match(f));
	if (mm.options.nonull && !list.length) list.push(pattern);
	return list;
};
minimatch.match = match;
const globMagic = /[?*]|[+@!]\(.*?\)|\[|\]/;
const regExpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var Minimatch = class {
	options;
	set;
	pattern;
	windowsPathsNoEscape;
	nonegate;
	negate;
	comment;
	empty;
	preserveMultipleSlashes;
	partial;
	globSet;
	globParts;
	nocase;
	isWindows;
	platform;
	windowsNoMagicRoot;
	maxGlobstarRecursion;
	regexp;
	constructor(pattern, options = {}) {
		assertValidPattern(pattern);
		options = options || {};
		this.options = options;
		this.maxGlobstarRecursion = options.maxGlobstarRecursion ?? 200;
		this.pattern = pattern;
		this.platform = options.platform || defaultPlatform$2;
		this.isWindows = this.platform === "win32";
		const awe = "allowWindowsEscape";
		this.windowsPathsNoEscape = !!options.windowsPathsNoEscape || options[awe] === false;
		if (this.windowsPathsNoEscape) this.pattern = this.pattern.replace(/\\/g, "/");
		this.preserveMultipleSlashes = !!options.preserveMultipleSlashes;
		this.regexp = null;
		this.negate = false;
		this.nonegate = !!options.nonegate;
		this.comment = false;
		this.empty = false;
		this.partial = !!options.partial;
		this.nocase = !!this.options.nocase;
		this.windowsNoMagicRoot = options.windowsNoMagicRoot !== void 0 ? options.windowsNoMagicRoot : !!(this.isWindows && this.nocase);
		this.globSet = [];
		this.globParts = [];
		this.set = [];
		this.make();
	}
	hasMagic() {
		if (this.options.magicalBraces && this.set.length > 1) return true;
		for (const pattern of this.set) for (const part of pattern) if (typeof part !== "string") return true;
		return false;
	}
	debug(..._) {}
	make() {
		const pattern = this.pattern;
		const options = this.options;
		if (!options.nocomment && pattern.charAt(0) === "#") {
			this.comment = true;
			return;
		}
		if (!pattern) {
			this.empty = true;
			return;
		}
		this.parseNegate();
		this.globSet = [...new Set(this.braceExpand())];
		if (options.debug) this.debug = (...args) => console.error(...args);
		this.debug(this.pattern, this.globSet);
		const rawGlobParts = this.globSet.map((s) => this.slashSplit(s));
		this.globParts = this.preprocess(rawGlobParts);
		this.debug(this.pattern, this.globParts);
		let set = this.globParts.map((s, _, __) => {
			if (this.isWindows && this.windowsNoMagicRoot) {
				const isUNC = s[0] === "" && s[1] === "" && (s[2] === "?" || !globMagic.test(s[2])) && !globMagic.test(s[3]);
				const isDrive = /^[a-z]:/i.test(s[0]);
				if (isUNC) return [...s.slice(0, 4), ...s.slice(4).map((ss) => this.parse(ss))];
				else if (isDrive) return [s[0], ...s.slice(1).map((ss) => this.parse(ss))];
			}
			return s.map((ss) => this.parse(ss));
		});
		this.debug(this.pattern, set);
		this.set = set.filter((s) => s.indexOf(false) === -1);
		if (this.isWindows) for (let i = 0; i < this.set.length; i++) {
			const p = this.set[i];
			if (p[0] === "" && p[1] === "" && this.globParts[i][2] === "?" && typeof p[3] === "string" && /^[a-z]:$/i.test(p[3])) p[2] = "?";
		}
		this.debug(this.pattern, this.set);
	}
	preprocess(globParts) {
		if (this.options.noglobstar) {
			for (let i = 0; i < globParts.length; i++) for (let j = 0; j < globParts[i].length; j++) if (globParts[i][j] === "**") globParts[i][j] = "*";
		}
		const { optimizationLevel = 1 } = this.options;
		if (optimizationLevel >= 2) {
			globParts = this.firstPhasePreProcess(globParts);
			globParts = this.secondPhasePreProcess(globParts);
		} else if (optimizationLevel >= 1) globParts = this.levelOneOptimize(globParts);
		else globParts = this.adjascentGlobstarOptimize(globParts);
		return globParts;
	}
	adjascentGlobstarOptimize(globParts) {
		return globParts.map((parts) => {
			let gs = -1;
			while (-1 !== (gs = parts.indexOf("**", gs + 1))) {
				let i = gs;
				while (parts[i + 1] === "**") i++;
				if (i !== gs) parts.splice(gs, i - gs);
			}
			return parts;
		});
	}
	levelOneOptimize(globParts) {
		return globParts.map((parts) => {
			parts = parts.reduce((set, part) => {
				const prev = set[set.length - 1];
				if (part === "**" && prev === "**") return set;
				if (part === "..") {
					if (prev && prev !== ".." && prev !== "." && prev !== "**") {
						set.pop();
						return set;
					}
				}
				set.push(part);
				return set;
			}, []);
			return parts.length === 0 ? [""] : parts;
		});
	}
	levelTwoFileOptimize(parts) {
		if (!Array.isArray(parts)) parts = this.slashSplit(parts);
		let didSomething = false;
		do {
			didSomething = false;
			if (!this.preserveMultipleSlashes) {
				for (let i = 1; i < parts.length - 1; i++) {
					const p = parts[i];
					if (i === 1 && p === "" && parts[0] === "") continue;
					if (p === "." || p === "") {
						didSomething = true;
						parts.splice(i, 1);
						i--;
					}
				}
				if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
					didSomething = true;
					parts.pop();
				}
			}
			let dd = 0;
			while (-1 !== (dd = parts.indexOf("..", dd + 1))) {
				const p = parts[dd - 1];
				if (p && p !== "." && p !== ".." && p !== "**") {
					didSomething = true;
					parts.splice(dd - 1, 2);
					dd -= 2;
				}
			}
		} while (didSomething);
		return parts.length === 0 ? [""] : parts;
	}
	firstPhasePreProcess(globParts) {
		let didSomething = false;
		do {
			didSomething = false;
			for (let parts of globParts) {
				let gs = -1;
				while (-1 !== (gs = parts.indexOf("**", gs + 1))) {
					let gss = gs;
					while (parts[gss + 1] === "**") gss++;
					if (gss > gs) parts.splice(gs + 1, gss - gs);
					let next = parts[gs + 1];
					const p = parts[gs + 2];
					const p2 = parts[gs + 3];
					if (next !== "..") continue;
					if (!p || p === "." || p === ".." || !p2 || p2 === "." || p2 === "..") continue;
					didSomething = true;
					parts.splice(gs, 1);
					const other = parts.slice(0);
					other[gs] = "**";
					globParts.push(other);
					gs--;
				}
				if (!this.preserveMultipleSlashes) {
					for (let i = 1; i < parts.length - 1; i++) {
						const p = parts[i];
						if (i === 1 && p === "" && parts[0] === "") continue;
						if (p === "." || p === "") {
							didSomething = true;
							parts.splice(i, 1);
							i--;
						}
					}
					if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
						didSomething = true;
						parts.pop();
					}
				}
				let dd = 0;
				while (-1 !== (dd = parts.indexOf("..", dd + 1))) {
					const p = parts[dd - 1];
					if (p && p !== "." && p !== ".." && p !== "**") {
						didSomething = true;
						const splin = dd === 1 && parts[dd + 1] === "**" ? ["."] : [];
						parts.splice(dd - 1, 2, ...splin);
						if (parts.length === 0) parts.push("");
						dd -= 2;
					}
				}
			}
		} while (didSomething);
		return globParts;
	}
	secondPhasePreProcess(globParts) {
		for (let i = 0; i < globParts.length - 1; i++) for (let j = i + 1; j < globParts.length; j++) {
			const matched = this.partsMatch(globParts[i], globParts[j], !this.preserveMultipleSlashes);
			if (matched) {
				globParts[i] = [];
				globParts[j] = matched;
				break;
			}
		}
		return globParts.filter((gs) => gs.length);
	}
	partsMatch(a, b, emptyGSMatch = false) {
		let ai = 0;
		let bi = 0;
		let result = [];
		let which = "";
		while (ai < a.length && bi < b.length) if (a[ai] === b[bi]) {
			result.push(which === "b" ? b[bi] : a[ai]);
			ai++;
			bi++;
		} else if (emptyGSMatch && a[ai] === "**" && b[bi] === a[ai + 1]) {
			result.push(a[ai]);
			ai++;
		} else if (emptyGSMatch && b[bi] === "**" && a[ai] === b[bi + 1]) {
			result.push(b[bi]);
			bi++;
		} else if (a[ai] === "*" && b[bi] && (this.options.dot || !b[bi].startsWith(".")) && b[bi] !== "**") {
			if (which === "b") return false;
			which = "a";
			result.push(a[ai]);
			ai++;
			bi++;
		} else if (b[bi] === "*" && a[ai] && (this.options.dot || !a[ai].startsWith(".")) && a[ai] !== "**") {
			if (which === "a") return false;
			which = "b";
			result.push(b[bi]);
			ai++;
			bi++;
		} else return false;
		return a.length === b.length && result;
	}
	parseNegate() {
		if (this.nonegate) return;
		const pattern = this.pattern;
		let negate = false;
		let negateOffset = 0;
		for (let i = 0; i < pattern.length && pattern.charAt(i) === "!"; i++) {
			negate = !negate;
			negateOffset++;
		}
		if (negateOffset) this.pattern = pattern.slice(negateOffset);
		this.negate = negate;
	}
	matchOne(file, pattern, partial = false) {
		let fileStartIndex = 0;
		let patternStartIndex = 0;
		if (this.isWindows) {
			const fileDrive = typeof file[0] === "string" && /^[a-z]:$/i.test(file[0]);
			const fileUNC = !fileDrive && file[0] === "" && file[1] === "" && file[2] === "?" && /^[a-z]:$/i.test(file[3]);
			const patternDrive = typeof pattern[0] === "string" && /^[a-z]:$/i.test(pattern[0]);
			const patternUNC = !patternDrive && pattern[0] === "" && pattern[1] === "" && pattern[2] === "?" && typeof pattern[3] === "string" && /^[a-z]:$/i.test(pattern[3]);
			const fdi = fileUNC ? 3 : fileDrive ? 0 : void 0;
			const pdi = patternUNC ? 3 : patternDrive ? 0 : void 0;
			if (typeof fdi === "number" && typeof pdi === "number") {
				const [fd, pd] = [file[fdi], pattern[pdi]];
				if (fd.toLowerCase() === pd.toLowerCase()) {
					pattern[pdi] = fd;
					patternStartIndex = pdi;
					fileStartIndex = fdi;
				}
			}
		}
		const { optimizationLevel = 1 } = this.options;
		if (optimizationLevel >= 2) file = this.levelTwoFileOptimize(file);
		if (pattern.includes(GLOBSTAR)) return this.#matchGlobstar(file, pattern, partial, fileStartIndex, patternStartIndex);
		return this.#matchOne(file, pattern, partial, fileStartIndex, patternStartIndex);
	}
	#matchGlobstar(file, pattern, partial, fileIndex, patternIndex) {
		const firstgs = pattern.indexOf(GLOBSTAR, patternIndex);
		const lastgs = pattern.lastIndexOf(GLOBSTAR);
		const [head, body, tail] = partial ? [
			pattern.slice(patternIndex, firstgs),
			pattern.slice(firstgs + 1),
			[]
		] : [
			pattern.slice(patternIndex, firstgs),
			pattern.slice(firstgs + 1, lastgs),
			pattern.slice(lastgs + 1)
		];
		if (head.length) {
			const fileHead = file.slice(fileIndex, fileIndex + head.length);
			if (!this.#matchOne(fileHead, head, partial, 0, 0)) return false;
			fileIndex += head.length;
			patternIndex += head.length;
		}
		let fileTailMatch = 0;
		if (tail.length) {
			if (tail.length + fileIndex > file.length) return false;
			let tailStart = file.length - tail.length;
			if (this.#matchOne(file, tail, partial, tailStart, 0)) fileTailMatch = tail.length;
			else {
				if (file[file.length - 1] !== "" || fileIndex + tail.length === file.length) return false;
				tailStart--;
				if (!this.#matchOne(file, tail, partial, tailStart, 0)) return false;
				fileTailMatch = tail.length + 1;
			}
		}
		if (!body.length) {
			let sawSome = !!fileTailMatch;
			for (let i = fileIndex; i < file.length - fileTailMatch; i++) {
				const f = String(file[i]);
				sawSome = true;
				if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) return false;
			}
			return partial || sawSome;
		}
		const bodySegments = [[[], 0]];
		let currentBody = bodySegments[0];
		let nonGsParts = 0;
		const nonGsPartsSums = [0];
		for (const b of body) if (b === GLOBSTAR) {
			nonGsPartsSums.push(nonGsParts);
			currentBody = [[], 0];
			bodySegments.push(currentBody);
		} else {
			currentBody[0].push(b);
			nonGsParts++;
		}
		let i = bodySegments.length - 1;
		const fileLength = file.length - fileTailMatch;
		for (const b of bodySegments) b[1] = fileLength - (nonGsPartsSums[i--] + b[0].length);
		return !!this.#matchGlobStarBodySections(file, bodySegments, fileIndex, 0, partial, 0, !!fileTailMatch);
	}
	#matchGlobStarBodySections(file, bodySegments, fileIndex, bodyIndex, partial, globStarDepth, sawTail) {
		const bs = bodySegments[bodyIndex];
		if (!bs) {
			for (let i = fileIndex; i < file.length; i++) {
				sawTail = true;
				const f = file[i];
				if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) return false;
			}
			return sawTail;
		}
		const [body, after] = bs;
		while (fileIndex <= after) {
			if (this.#matchOne(file.slice(0, fileIndex + body.length), body, partial, fileIndex, 0) && globStarDepth < this.maxGlobstarRecursion) {
				const sub = this.#matchGlobStarBodySections(file, bodySegments, fileIndex + body.length, bodyIndex + 1, partial, globStarDepth + 1, sawTail);
				if (sub !== false) return sub;
			}
			const f = file[fileIndex];
			if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) return false;
			fileIndex++;
		}
		return partial || null;
	}
	#matchOne(file, pattern, partial, fileIndex, patternIndex) {
		let fi;
		let pi;
		let pl;
		let fl;
		for (fi = fileIndex, pi = patternIndex, fl = file.length, pl = pattern.length; fi < fl && pi < pl; fi++, pi++) {
			this.debug("matchOne loop");
			let p = pattern[pi];
			let f = file[fi];
			this.debug(pattern, p, f);
			/* c8 ignore start */
			if (p === false || p === GLOBSTAR) return false;
			/* c8 ignore stop */
			let hit;
			if (typeof p === "string") {
				hit = f === p;
				this.debug("string match", p, f, hit);
			} else {
				hit = p.test(f);
				this.debug("pattern match", p, f, hit);
			}
			if (!hit) return false;
		}
		if (fi === fl && pi === pl) return true;
		else if (fi === fl) return partial;
		else if (pi === pl) return fi === fl - 1 && file[fi] === "";
		else throw new Error("wtf?");
		/* c8 ignore stop */
	}
	braceExpand() {
		return braceExpand(this.pattern, this.options);
	}
	parse(pattern) {
		assertValidPattern(pattern);
		const options = this.options;
		if (pattern === "**") return GLOBSTAR;
		if (pattern === "") return "";
		let m;
		let fastTest = null;
		if (m = pattern.match(starRE)) fastTest = options.dot ? starTestDot : starTest;
		else if (m = pattern.match(starDotExtRE)) fastTest = (options.nocase ? options.dot ? starDotExtTestNocaseDot : starDotExtTestNocase : options.dot ? starDotExtTestDot : starDotExtTest)(m[1]);
		else if (m = pattern.match(qmarksRE)) fastTest = (options.nocase ? options.dot ? qmarksTestNocaseDot : qmarksTestNocase : options.dot ? qmarksTestDot : qmarksTest)(m);
		else if (m = pattern.match(starDotStarRE)) fastTest = options.dot ? starDotStarTestDot : starDotStarTest;
		else if (m = pattern.match(dotStarRE)) fastTest = dotStarTest;
		const re = AST.fromGlob(pattern, this.options).toMMPattern();
		if (fastTest && typeof re === "object") Reflect.defineProperty(re, "test", { value: fastTest });
		return re;
	}
	makeRe() {
		if (this.regexp || this.regexp === false) return this.regexp;
		const set = this.set;
		if (!set.length) {
			this.regexp = false;
			return this.regexp;
		}
		const options = this.options;
		const twoStar = options.noglobstar ? star : options.dot ? twoStarDot : twoStarNoDot;
		const flags = new Set(options.nocase ? ["i"] : []);
		let re = set.map((pattern) => {
			const pp = pattern.map((p) => {
				if (p instanceof RegExp) for (const f of p.flags.split("")) flags.add(f);
				return typeof p === "string" ? regExpEscape(p) : p === GLOBSTAR ? GLOBSTAR : p._src;
			});
			pp.forEach((p, i) => {
				const next = pp[i + 1];
				const prev = pp[i - 1];
				if (p !== GLOBSTAR || prev === GLOBSTAR) return;
				if (prev === void 0) {
					if (next !== void 0 && next !== GLOBSTAR) pp[i + 1] = "(?:\\/|" + twoStar + "\\/)?" + next;
					else pp[i] = twoStar;
				} else if (next === void 0) pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + ")?";
				else if (next !== GLOBSTAR) {
					pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + "\\/)" + next;
					pp[i + 1] = GLOBSTAR;
				}
			});
			const filtered = pp.filter((p) => p !== GLOBSTAR);
			if (this.partial && filtered.length >= 1) {
				const prefixes = [];
				for (let i = 1; i <= filtered.length; i++) prefixes.push(filtered.slice(0, i).join("/"));
				return "(?:" + prefixes.join("|") + ")";
			}
			return filtered.join("/");
		}).join("|");
		const [open, close] = set.length > 1 ? ["(?:", ")"] : ["", ""];
		re = "^" + open + re + close + "$";
		if (this.partial) re = "^(?:\\/|" + open + re.slice(1, -1) + close + ")$";
		if (this.negate) re = "^(?!" + re + ").+$";
		try {
			this.regexp = new RegExp(re, [...flags].join(""));
		} catch (ex) {
			this.regexp = false;
		}
		/* c8 ignore stop */
		return this.regexp;
	}
	slashSplit(p) {
		if (this.preserveMultipleSlashes) return p.split("/");
		else if (this.isWindows && /^\/\/[^\/]+/.test(p)) return ["", ...p.split(/\/+/)];
		else return p.split(/\/+/);
	}
	match(f, partial = this.partial) {
		this.debug("match", f, this.pattern);
		if (this.comment) return false;
		if (this.empty) return f === "";
		if (f === "/" && partial) return true;
		const options = this.options;
		if (this.isWindows) f = f.split("\\").join("/");
		const ff = this.slashSplit(f);
		this.debug(this.pattern, "split", ff);
		const set = this.set;
		this.debug(this.pattern, "set", set);
		let filename = ff[ff.length - 1];
		if (!filename) for (let i = ff.length - 2; !filename && i >= 0; i--) filename = ff[i];
		for (let i = 0; i < set.length; i++) {
			const pattern = set[i];
			let file = ff;
			if (options.matchBase && pattern.length === 1) file = [filename];
			if (this.matchOne(file, pattern, partial)) {
				if (options.flipNegate) return true;
				return !this.negate;
			}
		}
		if (options.flipNegate) return false;
		return this.negate;
	}
	static defaults(def) {
		return minimatch.defaults(def).Minimatch;
	}
};
/* c8 ignore stop */
minimatch.AST = AST;
minimatch.Minimatch = Minimatch;
minimatch.escape = escape;
minimatch.unescape = unescape;
//#endregion
//#region ../../node_modules/.pnpm/lru-cache@11.2.7/node_modules/lru-cache/dist/esm/index.min.js
var x = typeof performance == "object" && performance && typeof performance.now == "function" ? performance : Date;
var I = /* @__PURE__ */ new Set();
var R = typeof process == "object" && process ? process : {};
var U = (c, t, e, i) => {
	typeof R.emitWarning == "function" ? R.emitWarning(c, t, e, i) : console.error(`[${e}] ${t}: ${c}`);
};
var C = globalThis.AbortController;
var D = globalThis.AbortSignal;
if (typeof C > "u") {
	D = class {
		onabort;
		_onabort = [];
		reason;
		aborted = !1;
		addEventListener(i, s) {
			this._onabort.push(s);
		}
	}, C = class {
		constructor() {
			t();
		}
		signal = new D();
		abort(i) {
			if (!this.signal.aborted) {
				this.signal.reason = i, this.signal.aborted = !0;
				for (let s of this.signal._onabort) s(i);
				this.signal.onabort?.(i);
			}
		}
	};
	let c = R.env?.LRU_CACHE_IGNORE_AC_WARNING !== "1", t = () => {
		c && (c = !1, U("AbortController is not defined. If using lru-cache in node 14, load an AbortController polyfill from the `node-abort-controller` package. A minimal polyfill is provided for use by LRUCache.fetch(), but it should not be relied upon in other contexts (eg, passing it to other APIs that use AbortController/AbortSignal might have undesirable effects). You may disable this with LRU_CACHE_IGNORE_AC_WARNING=1 in the env.", "NO_ABORT_CONTROLLER", "ENOTSUP", t));
	};
}
var G = (c) => !I.has(c);
var y = (c) => c && c === Math.floor(c) && c > 0 && isFinite(c);
var M = (c) => y(c) ? c <= Math.pow(2, 8) ? Uint8Array : c <= Math.pow(2, 16) ? Uint16Array : c <= Math.pow(2, 32) ? Uint32Array : c <= Number.MAX_SAFE_INTEGER ? z : null : null;
var z = class extends Array {
	constructor(t) {
		super(t), this.fill(0);
	}
};
var W = class c {
	heap;
	length;
	static #o = !1;
	static create(t) {
		let e = M(t);
		if (!e) return [];
		c.#o = !0;
		let i = new c(t, e);
		return c.#o = !1, i;
	}
	constructor(t, e) {
		if (!c.#o) throw new TypeError("instantiate Stack using Stack.create(n)");
		this.heap = new e(t), this.length = 0;
	}
	push(t) {
		this.heap[this.length++] = t;
	}
	pop() {
		return this.heap[--this.length];
	}
};
var L = class c {
	#o;
	#c;
	#w;
	#C;
	#S;
	#L;
	#I;
	#m;
	get perf() {
		return this.#m;
	}
	ttl;
	ttlResolution;
	ttlAutopurge;
	updateAgeOnGet;
	updateAgeOnHas;
	allowStale;
	noDisposeOnSet;
	noUpdateTTL;
	maxEntrySize;
	sizeCalculation;
	noDeleteOnFetchRejection;
	noDeleteOnStaleGet;
	allowStaleOnFetchAbort;
	allowStaleOnFetchRejection;
	ignoreFetchAbort;
	#n;
	#_;
	#s;
	#i;
	#t;
	#a;
	#u;
	#l;
	#h;
	#b;
	#r;
	#y;
	#A;
	#d;
	#g;
	#T;
	#v;
	#f;
	#U;
	static unsafeExposeInternals(t) {
		return {
			starts: t.#A,
			ttls: t.#d,
			autopurgeTimers: t.#g,
			sizes: t.#y,
			keyMap: t.#s,
			keyList: t.#i,
			valList: t.#t,
			next: t.#a,
			prev: t.#u,
			get head() {
				return t.#l;
			},
			get tail() {
				return t.#h;
			},
			free: t.#b,
			isBackgroundFetch: (e) => t.#e(e),
			backgroundFetch: (e, i, s, n) => t.#G(e, i, s, n),
			moveToTail: (e) => t.#D(e),
			indexes: (e) => t.#F(e),
			rindexes: (e) => t.#O(e),
			isStale: (e) => t.#p(e)
		};
	}
	get max() {
		return this.#o;
	}
	get maxSize() {
		return this.#c;
	}
	get calculatedSize() {
		return this.#_;
	}
	get size() {
		return this.#n;
	}
	get fetchMethod() {
		return this.#L;
	}
	get memoMethod() {
		return this.#I;
	}
	get dispose() {
		return this.#w;
	}
	get onInsert() {
		return this.#C;
	}
	get disposeAfter() {
		return this.#S;
	}
	constructor(t) {
		let { max: e = 0, ttl: i, ttlResolution: s = 1, ttlAutopurge: n, updateAgeOnGet: o, updateAgeOnHas: h, allowStale: r, dispose: a, onInsert: w, disposeAfter: f, noDisposeOnSet: d, noUpdateTTL: g, maxSize: A = 0, maxEntrySize: p = 0, sizeCalculation: _, fetchMethod: l, memoMethod: S, noDeleteOnFetchRejection: b, noDeleteOnStaleGet: m, allowStaleOnFetchRejection: u, allowStaleOnFetchAbort: T, ignoreFetchAbort: F, perf: v } = t;
		if (v !== void 0 && typeof v?.now != "function") throw new TypeError("perf option must have a now() method if specified");
		if (this.#m = v ?? x, e !== 0 && !y(e)) throw new TypeError("max option must be a nonnegative integer");
		let O = e ? M(e) : Array;
		if (!O) throw new Error("invalid max value: " + e);
		if (this.#o = e, this.#c = A, this.maxEntrySize = p || this.#c, this.sizeCalculation = _, this.sizeCalculation) {
			if (!this.#c && !this.maxEntrySize) throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize");
			if (typeof this.sizeCalculation != "function") throw new TypeError("sizeCalculation set to non-function");
		}
		if (S !== void 0 && typeof S != "function") throw new TypeError("memoMethod must be a function if defined");
		if (this.#I = S, l !== void 0 && typeof l != "function") throw new TypeError("fetchMethod must be a function if specified");
		if (this.#L = l, this.#v = !!l, this.#s = /* @__PURE__ */ new Map(), this.#i = new Array(e).fill(void 0), this.#t = new Array(e).fill(void 0), this.#a = new O(e), this.#u = new O(e), this.#l = 0, this.#h = 0, this.#b = W.create(e), this.#n = 0, this.#_ = 0, typeof a == "function" && (this.#w = a), typeof w == "function" && (this.#C = w), typeof f == "function" ? (this.#S = f, this.#r = []) : (this.#S = void 0, this.#r = void 0), this.#T = !!this.#w, this.#U = !!this.#C, this.#f = !!this.#S, this.noDisposeOnSet = !!d, this.noUpdateTTL = !!g, this.noDeleteOnFetchRejection = !!b, this.allowStaleOnFetchRejection = !!u, this.allowStaleOnFetchAbort = !!T, this.ignoreFetchAbort = !!F, this.maxEntrySize !== 0) {
			if (this.#c !== 0 && !y(this.#c)) throw new TypeError("maxSize must be a positive integer if specified");
			if (!y(this.maxEntrySize)) throw new TypeError("maxEntrySize must be a positive integer if specified");
			this.#B();
		}
		if (this.allowStale = !!r, this.noDeleteOnStaleGet = !!m, this.updateAgeOnGet = !!o, this.updateAgeOnHas = !!h, this.ttlResolution = y(s) || s === 0 ? s : 1, this.ttlAutopurge = !!n, this.ttl = i || 0, this.ttl) {
			if (!y(this.ttl)) throw new TypeError("ttl must be a positive integer if specified");
			this.#j();
		}
		if (this.#o === 0 && this.ttl === 0 && this.#c === 0) throw new TypeError("At least one of max, maxSize, or ttl is required");
		if (!this.ttlAutopurge && !this.#o && !this.#c) {
			let E = "LRU_CACHE_UNBOUNDED";
			G(E) && (I.add(E), U("TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.", "UnboundedCacheWarning", E, c));
		}
	}
	getRemainingTTL(t) {
		return this.#s.has(t) ? 1 / 0 : 0;
	}
	#j() {
		let t = new z(this.#o), e = new z(this.#o);
		this.#d = t, this.#A = e;
		let i = this.ttlAutopurge ? new Array(this.#o) : void 0;
		this.#g = i, this.#N = (h, r, a = this.#m.now()) => {
			e[h] = r !== 0 ? a : 0, t[h] = r, s(h, r);
		}, this.#R = (h) => {
			e[h] = t[h] !== 0 ? this.#m.now() : 0, s(h, t[h]);
		};
		let s = this.ttlAutopurge ? (h, r) => {
			if (i?.[h] && (clearTimeout(i[h]), i[h] = void 0), r && r !== 0 && i) {
				let a = setTimeout(() => {
					this.#p(h) && this.#E(this.#i[h], "expire");
				}, r + 1);
				a.unref && a.unref(), i[h] = a;
			}
		} : () => {};
		this.#z = (h, r) => {
			if (t[r]) {
				let a = t[r], w = e[r];
				if (!a || !w) return;
				h.ttl = a, h.start = w, h.now = n || o();
				h.remainingTTL = a - (h.now - w);
			}
		};
		let n = 0, o = () => {
			let h = this.#m.now();
			if (this.ttlResolution > 0) {
				n = h;
				let r = setTimeout(() => n = 0, this.ttlResolution);
				r.unref && r.unref();
			}
			return h;
		};
		this.getRemainingTTL = (h) => {
			let r = this.#s.get(h);
			if (r === void 0) return 0;
			let a = t[r], w = e[r];
			if (!a || !w) return 1 / 0;
			return a - ((n || o()) - w);
		}, this.#p = (h) => {
			let r = e[h], a = t[h];
			return !!a && !!r && (n || o()) - r > a;
		};
	}
	#R = () => {};
	#z = () => {};
	#N = () => {};
	#p = () => !1;
	#B() {
		let t = new z(this.#o);
		this.#_ = 0, this.#y = t, this.#W = (e) => {
			this.#_ -= t[e], t[e] = 0;
		}, this.#P = (e, i, s, n) => {
			if (this.#e(i)) return 0;
			if (!y(s)) if (n) {
				if (typeof n != "function") throw new TypeError("sizeCalculation must be a function");
				if (s = n(i, e), !y(s)) throw new TypeError("sizeCalculation return invalid (expect positive integer)");
			} else throw new TypeError("invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.");
			return s;
		}, this.#M = (e, i, s) => {
			if (t[e] = i, this.#c) {
				let n = this.#c - t[e];
				for (; this.#_ > n;) this.#x(!0);
			}
			this.#_ += t[e], s && (s.entrySize = i, s.totalCalculatedSize = this.#_);
		};
	}
	#W = (t) => {};
	#M = (t, e, i) => {};
	#P = (t, e, i, s) => {
		if (i || s) throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache");
		return 0;
	};
	*#F({ allowStale: t = this.allowStale } = {}) {
		if (this.#n) for (let e = this.#h; !(!this.#H(e) || ((t || !this.#p(e)) && (yield e), e === this.#l));) e = this.#u[e];
	}
	*#O({ allowStale: t = this.allowStale } = {}) {
		if (this.#n) for (let e = this.#l; !(!this.#H(e) || ((t || !this.#p(e)) && (yield e), e === this.#h));) e = this.#a[e];
	}
	#H(t) {
		return t !== void 0 && this.#s.get(this.#i[t]) === t;
	}
	*entries() {
		for (let t of this.#F()) this.#t[t] !== void 0 && this.#i[t] !== void 0 && !this.#e(this.#t[t]) && (yield [this.#i[t], this.#t[t]]);
	}
	*rentries() {
		for (let t of this.#O()) this.#t[t] !== void 0 && this.#i[t] !== void 0 && !this.#e(this.#t[t]) && (yield [this.#i[t], this.#t[t]]);
	}
	*keys() {
		for (let t of this.#F()) {
			let e = this.#i[t];
			e !== void 0 && !this.#e(this.#t[t]) && (yield e);
		}
	}
	*rkeys() {
		for (let t of this.#O()) {
			let e = this.#i[t];
			e !== void 0 && !this.#e(this.#t[t]) && (yield e);
		}
	}
	*values() {
		for (let t of this.#F()) this.#t[t] !== void 0 && !this.#e(this.#t[t]) && (yield this.#t[t]);
	}
	*rvalues() {
		for (let t of this.#O()) this.#t[t] !== void 0 && !this.#e(this.#t[t]) && (yield this.#t[t]);
	}
	[Symbol.iterator]() {
		return this.entries();
	}
	[Symbol.toStringTag] = "LRUCache";
	find(t, e = {}) {
		for (let i of this.#F()) {
			let s = this.#t[i], n = this.#e(s) ? s.__staleWhileFetching : s;
			if (n !== void 0 && t(n, this.#i[i], this)) return this.get(this.#i[i], e);
		}
	}
	forEach(t, e = this) {
		for (let i of this.#F()) {
			let s = this.#t[i], n = this.#e(s) ? s.__staleWhileFetching : s;
			n !== void 0 && t.call(e, n, this.#i[i], this);
		}
	}
	rforEach(t, e = this) {
		for (let i of this.#O()) {
			let s = this.#t[i], n = this.#e(s) ? s.__staleWhileFetching : s;
			n !== void 0 && t.call(e, n, this.#i[i], this);
		}
	}
	purgeStale() {
		let t = !1;
		for (let e of this.#O({ allowStale: !0 })) this.#p(e) && (this.#E(this.#i[e], "expire"), t = !0);
		return t;
	}
	info(t) {
		let e = this.#s.get(t);
		if (e === void 0) return;
		let i = this.#t[e], s = this.#e(i) ? i.__staleWhileFetching : i;
		if (s === void 0) return;
		let n = { value: s };
		if (this.#d && this.#A) {
			let o = this.#d[e], h = this.#A[e];
			if (o && h) n.ttl = o - (this.#m.now() - h), n.start = Date.now();
		}
		return this.#y && (n.size = this.#y[e]), n;
	}
	dump() {
		let t = [];
		for (let e of this.#F({ allowStale: !0 })) {
			let i = this.#i[e], s = this.#t[e], n = this.#e(s) ? s.__staleWhileFetching : s;
			if (n === void 0 || i === void 0) continue;
			let o = { value: n };
			if (this.#d && this.#A) {
				o.ttl = this.#d[e];
				let h = this.#m.now() - this.#A[e];
				o.start = Math.floor(Date.now() - h);
			}
			this.#y && (o.size = this.#y[e]), t.unshift([i, o]);
		}
		return t;
	}
	load(t) {
		this.clear();
		for (let [e, i] of t) {
			if (i.start) {
				let s = Date.now() - i.start;
				i.start = this.#m.now() - s;
			}
			this.set(e, i.value, i);
		}
	}
	set(t, e, i = {}) {
		if (e === void 0) return this.delete(t), this;
		let { ttl: s = this.ttl, start: n, noDisposeOnSet: o = this.noDisposeOnSet, sizeCalculation: h = this.sizeCalculation, status: r } = i, { noUpdateTTL: a = this.noUpdateTTL } = i, w = this.#P(t, e, i.size || 0, h);
		if (this.maxEntrySize && w > this.maxEntrySize) return r && (r.set = "miss", r.maxEntrySizeExceeded = !0), this.#E(t, "set"), this;
		let f = this.#n === 0 ? void 0 : this.#s.get(t);
		if (f === void 0) f = this.#n === 0 ? this.#h : this.#b.length !== 0 ? this.#b.pop() : this.#n === this.#o ? this.#x(!1) : this.#n, this.#i[f] = t, this.#t[f] = e, this.#s.set(t, f), this.#a[this.#h] = f, this.#u[f] = this.#h, this.#h = f, this.#n++, this.#M(f, w, r), r && (r.set = "add"), a = !1, this.#U && this.#C?.(e, t, "add");
		else {
			this.#D(f);
			let d = this.#t[f];
			if (e !== d) {
				if (this.#v && this.#e(d)) {
					d.__abortController.abort(/* @__PURE__ */ new Error("replaced"));
					let { __staleWhileFetching: g } = d;
					g !== void 0 && !o && (this.#T && this.#w?.(g, t, "set"), this.#f && this.#r?.push([
						g,
						t,
						"set"
					]));
				} else o || (this.#T && this.#w?.(d, t, "set"), this.#f && this.#r?.push([
					d,
					t,
					"set"
				]));
				if (this.#W(f), this.#M(f, w, r), this.#t[f] = e, r) {
					r.set = "replace";
					let g = d && this.#e(d) ? d.__staleWhileFetching : d;
					g !== void 0 && (r.oldValue = g);
				}
			} else r && (r.set = "update");
			this.#U && this.onInsert?.(e, t, e === d ? "update" : "replace");
		}
		if (s !== 0 && !this.#d && this.#j(), this.#d && (a || this.#N(f, s, n), r && this.#z(r, f)), !o && this.#f && this.#r) {
			let d = this.#r, g;
			for (; g = d?.shift();) this.#S?.(...g);
		}
		return this;
	}
	pop() {
		try {
			for (; this.#n;) {
				let t = this.#t[this.#l];
				if (this.#x(!0), this.#e(t)) {
					if (t.__staleWhileFetching) return t.__staleWhileFetching;
				} else if (t !== void 0) return t;
			}
		} finally {
			if (this.#f && this.#r) {
				let t = this.#r, e;
				for (; e = t?.shift();) this.#S?.(...e);
			}
		}
	}
	#x(t) {
		let e = this.#l, i = this.#i[e], s = this.#t[e];
		return this.#v && this.#e(s) ? s.__abortController.abort(/* @__PURE__ */ new Error("evicted")) : (this.#T || this.#f) && (this.#T && this.#w?.(s, i, "evict"), this.#f && this.#r?.push([
			s,
			i,
			"evict"
		])), this.#W(e), this.#g?.[e] && (clearTimeout(this.#g[e]), this.#g[e] = void 0), t && (this.#i[e] = void 0, this.#t[e] = void 0, this.#b.push(e)), this.#n === 1 ? (this.#l = this.#h = 0, this.#b.length = 0) : this.#l = this.#a[e], this.#s.delete(i), this.#n--, e;
	}
	has(t, e = {}) {
		let { updateAgeOnHas: i = this.updateAgeOnHas, status: s } = e, n = this.#s.get(t);
		if (n !== void 0) {
			let o = this.#t[n];
			if (this.#e(o) && o.__staleWhileFetching === void 0) return !1;
			if (this.#p(n)) s && (s.has = "stale", this.#z(s, n));
			else return i && this.#R(n), s && (s.has = "hit", this.#z(s, n)), !0;
		} else s && (s.has = "miss");
		return !1;
	}
	peek(t, e = {}) {
		let { allowStale: i = this.allowStale } = e, s = this.#s.get(t);
		if (s === void 0 || !i && this.#p(s)) return;
		let n = this.#t[s];
		return this.#e(n) ? n.__staleWhileFetching : n;
	}
	#G(t, e, i, s) {
		let n = e === void 0 ? void 0 : this.#t[e];
		if (this.#e(n)) return n;
		let o = new C(), { signal: h } = i;
		h?.addEventListener("abort", () => o.abort(h.reason), { signal: o.signal });
		let r = {
			signal: o.signal,
			options: i,
			context: s
		}, a = (p, _ = !1) => {
			let { aborted: l } = o.signal, S = i.ignoreFetchAbort && p !== void 0, b = i.ignoreFetchAbort || !!(i.allowStaleOnFetchAbort && p !== void 0);
			if (i.status && (l && !_ ? (i.status.fetchAborted = !0, i.status.fetchError = o.signal.reason, S && (i.status.fetchAbortIgnored = !0)) : i.status.fetchResolved = !0), l && !S && !_) return f(o.signal.reason, b);
			let m = g, u = this.#t[e];
			return (u === g || S && _ && u === void 0) && (p === void 0 ? m.__staleWhileFetching !== void 0 ? this.#t[e] = m.__staleWhileFetching : this.#E(t, "fetch") : (i.status && (i.status.fetchUpdated = !0), this.set(t, p, r.options))), p;
		}, w = (p) => (i.status && (i.status.fetchRejected = !0, i.status.fetchError = p), f(p, !1)), f = (p, _) => {
			let { aborted: l } = o.signal, S = l && i.allowStaleOnFetchAbort, b = S || i.allowStaleOnFetchRejection, m = b || i.noDeleteOnFetchRejection, u = g;
			if (this.#t[e] === g && (!m || !_ && u.__staleWhileFetching === void 0 ? this.#E(t, "fetch") : S || (this.#t[e] = u.__staleWhileFetching)), b) return i.status && u.__staleWhileFetching !== void 0 && (i.status.returnedStale = !0), u.__staleWhileFetching;
			if (u.__returned === u) throw p;
		}, d = (p, _) => {
			let l = this.#L?.(t, n, r);
			l && l instanceof Promise && l.then((S) => p(S === void 0 ? void 0 : S), _), o.signal.addEventListener("abort", () => {
				(!i.ignoreFetchAbort || i.allowStaleOnFetchAbort) && (p(void 0), i.allowStaleOnFetchAbort && (p = (S) => a(S, !0)));
			});
		};
		i.status && (i.status.fetchDispatched = !0);
		let g = new Promise(d).then(a, w), A = Object.assign(g, {
			__abortController: o,
			__staleWhileFetching: n,
			__returned: void 0
		});
		return e === void 0 ? (this.set(t, A, {
			...r.options,
			status: void 0
		}), e = this.#s.get(t)) : this.#t[e] = A, A;
	}
	#e(t) {
		if (!this.#v) return !1;
		let e = t;
		return !!e && e instanceof Promise && e.hasOwnProperty("__staleWhileFetching") && e.__abortController instanceof C;
	}
	async fetch(t, e = {}) {
		let { allowStale: i = this.allowStale, updateAgeOnGet: s = this.updateAgeOnGet, noDeleteOnStaleGet: n = this.noDeleteOnStaleGet, ttl: o = this.ttl, noDisposeOnSet: h = this.noDisposeOnSet, size: r = 0, sizeCalculation: a = this.sizeCalculation, noUpdateTTL: w = this.noUpdateTTL, noDeleteOnFetchRejection: f = this.noDeleteOnFetchRejection, allowStaleOnFetchRejection: d = this.allowStaleOnFetchRejection, ignoreFetchAbort: g = this.ignoreFetchAbort, allowStaleOnFetchAbort: A = this.allowStaleOnFetchAbort, context: p, forceRefresh: _ = !1, status: l, signal: S } = e;
		if (!this.#v) return l && (l.fetch = "get"), this.get(t, {
			allowStale: i,
			updateAgeOnGet: s,
			noDeleteOnStaleGet: n,
			status: l
		});
		let b = {
			allowStale: i,
			updateAgeOnGet: s,
			noDeleteOnStaleGet: n,
			ttl: o,
			noDisposeOnSet: h,
			size: r,
			sizeCalculation: a,
			noUpdateTTL: w,
			noDeleteOnFetchRejection: f,
			allowStaleOnFetchRejection: d,
			allowStaleOnFetchAbort: A,
			ignoreFetchAbort: g,
			status: l,
			signal: S
		}, m = this.#s.get(t);
		if (m === void 0) {
			l && (l.fetch = "miss");
			let u = this.#G(t, m, b, p);
			return u.__returned = u;
		} else {
			let u = this.#t[m];
			if (this.#e(u)) {
				let E = i && u.__staleWhileFetching !== void 0;
				return l && (l.fetch = "inflight", E && (l.returnedStale = !0)), E ? u.__staleWhileFetching : u.__returned = u;
			}
			let T = this.#p(m);
			if (!_ && !T) return l && (l.fetch = "hit"), this.#D(m), s && this.#R(m), l && this.#z(l, m), u;
			let F = this.#G(t, m, b, p), O = F.__staleWhileFetching !== void 0 && i;
			return l && (l.fetch = T ? "stale" : "refresh", O && T && (l.returnedStale = !0)), O ? F.__staleWhileFetching : F.__returned = F;
		}
	}
	async forceFetch(t, e = {}) {
		let i = await this.fetch(t, e);
		if (i === void 0) throw new Error("fetch() returned undefined");
		return i;
	}
	memo(t, e = {}) {
		let i = this.#I;
		if (!i) throw new Error("no memoMethod provided to constructor");
		let { context: s, forceRefresh: n, ...o } = e, h = this.get(t, o);
		if (!n && h !== void 0) return h;
		let r = i(t, h, {
			options: o,
			context: s
		});
		return this.set(t, r, o), r;
	}
	get(t, e = {}) {
		let { allowStale: i = this.allowStale, updateAgeOnGet: s = this.updateAgeOnGet, noDeleteOnStaleGet: n = this.noDeleteOnStaleGet, status: o } = e, h = this.#s.get(t);
		if (h !== void 0) {
			let r = this.#t[h], a = this.#e(r);
			return o && this.#z(o, h), this.#p(h) ? (o && (o.get = "stale"), a ? (o && i && r.__staleWhileFetching !== void 0 && (o.returnedStale = !0), i ? r.__staleWhileFetching : void 0) : (n || this.#E(t, "expire"), o && i && (o.returnedStale = !0), i ? r : void 0)) : (o && (o.get = "hit"), a ? r.__staleWhileFetching : (this.#D(h), s && this.#R(h), r));
		} else o && (o.get = "miss");
	}
	#k(t, e) {
		this.#u[e] = t, this.#a[t] = e;
	}
	#D(t) {
		t !== this.#h && (t === this.#l ? this.#l = this.#a[t] : this.#k(this.#u[t], this.#a[t]), this.#k(this.#h, t), this.#h = t);
	}
	delete(t) {
		return this.#E(t, "delete");
	}
	#E(t, e) {
		let i = !1;
		if (this.#n !== 0) {
			let s = this.#s.get(t);
			if (s !== void 0) if (this.#g?.[s] && (clearTimeout(this.#g?.[s]), this.#g[s] = void 0), i = !0, this.#n === 1) this.#V(e);
			else {
				this.#W(s);
				let n = this.#t[s];
				if (this.#e(n) ? n.__abortController.abort(/* @__PURE__ */ new Error("deleted")) : (this.#T || this.#f) && (this.#T && this.#w?.(n, t, e), this.#f && this.#r?.push([
					n,
					t,
					e
				])), this.#s.delete(t), this.#i[s] = void 0, this.#t[s] = void 0, s === this.#h) this.#h = this.#u[s];
				else if (s === this.#l) this.#l = this.#a[s];
				else {
					let o = this.#u[s];
					this.#a[o] = this.#a[s];
					let h = this.#a[s];
					this.#u[h] = this.#u[s];
				}
				this.#n--, this.#b.push(s);
			}
		}
		if (this.#f && this.#r?.length) {
			let s = this.#r, n;
			for (; n = s?.shift();) this.#S?.(...n);
		}
		return i;
	}
	clear() {
		return this.#V("delete");
	}
	#V(t) {
		for (let e of this.#O({ allowStale: !0 })) {
			let i = this.#t[e];
			if (this.#e(i)) i.__abortController.abort(/* @__PURE__ */ new Error("deleted"));
			else {
				let s = this.#i[e];
				this.#T && this.#w?.(i, s, t), this.#f && this.#r?.push([
					i,
					s,
					t
				]);
			}
		}
		if (this.#s.clear(), this.#t.fill(void 0), this.#i.fill(void 0), this.#d && this.#A) {
			this.#d.fill(0), this.#A.fill(0);
			for (let e of this.#g ?? []) e !== void 0 && clearTimeout(e);
			this.#g?.fill(void 0);
		}
		if (this.#y && this.#y.fill(0), this.#l = 0, this.#h = 0, this.#b.length = 0, this.#_ = 0, this.#n = 0, this.#f && this.#r) {
			let e = this.#r, i;
			for (; i = e?.shift();) this.#S?.(...i);
		}
	}
};
//#endregion
//#region ../../node_modules/.pnpm/minipass@7.1.2/node_modules/minipass/dist/esm/index.js
const proc = typeof process === "object" && process ? process : {
	stdout: null,
	stderr: null
};
/**
* Return true if the argument is a Minipass stream, Node stream, or something
* else that Minipass can interact with.
*/
const isStream = (s) => !!s && typeof s === "object" && (s instanceof Minipass || s instanceof Stream || isReadable(s) || isWritable(s));
/**
* Return true if the argument is a valid {@link Minipass.Readable}
*/
const isReadable = (s) => !!s && typeof s === "object" && s instanceof EventEmitter && typeof s.pipe === "function" && s.pipe !== Stream.Writable.prototype.pipe;
/**
* Return true if the argument is a valid {@link Minipass.Writable}
*/
const isWritable = (s) => !!s && typeof s === "object" && s instanceof EventEmitter && typeof s.write === "function" && typeof s.end === "function";
const EOF = Symbol("EOF");
const MAYBE_EMIT_END = Symbol("maybeEmitEnd");
const EMITTED_END = Symbol("emittedEnd");
const EMITTING_END = Symbol("emittingEnd");
const EMITTED_ERROR = Symbol("emittedError");
const CLOSED = Symbol("closed");
const READ = Symbol("read");
const FLUSH = Symbol("flush");
const FLUSHCHUNK = Symbol("flushChunk");
const ENCODING = Symbol("encoding");
const DECODER = Symbol("decoder");
const FLOWING = Symbol("flowing");
const PAUSED = Symbol("paused");
const RESUME = Symbol("resume");
const BUFFER = Symbol("buffer");
const PIPES = Symbol("pipes");
const BUFFERLENGTH = Symbol("bufferLength");
const BUFFERPUSH = Symbol("bufferPush");
const BUFFERSHIFT = Symbol("bufferShift");
const OBJECTMODE = Symbol("objectMode");
const DESTROYED = Symbol("destroyed");
const ERROR = Symbol("error");
const EMITDATA = Symbol("emitData");
const EMITEND = Symbol("emitEnd");
const EMITEND2 = Symbol("emitEnd2");
const ASYNC = Symbol("async");
const ABORT = Symbol("abort");
const ABORTED = Symbol("aborted");
const SIGNAL = Symbol("signal");
const DATALISTENERS = Symbol("dataListeners");
const DISCARDED = Symbol("discarded");
const defer = (fn) => Promise.resolve().then(fn);
const nodefer = (fn) => fn();
const isEndish = (ev) => ev === "end" || ev === "finish" || ev === "prefinish";
const isArrayBufferLike = (b) => b instanceof ArrayBuffer || !!b && typeof b === "object" && b.constructor && b.constructor.name === "ArrayBuffer" && b.byteLength >= 0;
const isArrayBufferView = (b) => !Buffer.isBuffer(b) && ArrayBuffer.isView(b);
/**
* Internal class representing a pipe to a destination stream.
*
* @internal
*/
var Pipe = class {
	src;
	dest;
	opts;
	ondrain;
	constructor(src, dest, opts) {
		this.src = src;
		this.dest = dest;
		this.opts = opts;
		this.ondrain = () => src[RESUME]();
		this.dest.on("drain", this.ondrain);
	}
	unpipe() {
		this.dest.removeListener("drain", this.ondrain);
	}
	/* c8 ignore start */
	proxyErrors(_er) {}
	/* c8 ignore stop */
	end() {
		this.unpipe();
		if (this.opts.end) this.dest.end();
	}
};
/**
* Internal class representing a pipe to a destination stream where
* errors are proxied.
*
* @internal
*/
var PipeProxyErrors = class extends Pipe {
	unpipe() {
		this.src.removeListener("error", this.proxyErrors);
		super.unpipe();
	}
	constructor(src, dest, opts) {
		super(src, dest, opts);
		this.proxyErrors = (er) => dest.emit("error", er);
		src.on("error", this.proxyErrors);
	}
};
const isObjectModeOptions = (o) => !!o.objectMode;
const isEncodingOptions = (o) => !o.objectMode && !!o.encoding && o.encoding !== "buffer";
/**
* Main export, the Minipass class
*
* `RType` is the type of data emitted, defaults to Buffer
*
* `WType` is the type of data to be written, if RType is buffer or string,
* then any {@link Minipass.ContiguousData} is allowed.
*
* `Events` is the set of event handler signatures that this object
* will emit, see {@link Minipass.Events}
*/
var Minipass = class extends EventEmitter {
	[FLOWING] = false;
	[PAUSED] = false;
	[PIPES] = [];
	[BUFFER] = [];
	[OBJECTMODE];
	[ENCODING];
	[ASYNC];
	[DECODER];
	[EOF] = false;
	[EMITTED_END] = false;
	[EMITTING_END] = false;
	[CLOSED] = false;
	[EMITTED_ERROR] = null;
	[BUFFERLENGTH] = 0;
	[DESTROYED] = false;
	[SIGNAL];
	[ABORTED] = false;
	[DATALISTENERS] = 0;
	[DISCARDED] = false;
	/**
	* true if the stream can be written
	*/
	writable = true;
	/**
	* true if the stream can be read
	*/
	readable = true;
	/**
	* If `RType` is Buffer, then options do not need to be provided.
	* Otherwise, an options object must be provided to specify either
	* {@link Minipass.SharedOptions.objectMode} or
	* {@link Minipass.SharedOptions.encoding}, as appropriate.
	*/
	constructor(...args) {
		const options = args[0] || {};
		super();
		if (options.objectMode && typeof options.encoding === "string") throw new TypeError("Encoding and objectMode may not be used together");
		if (isObjectModeOptions(options)) {
			this[OBJECTMODE] = true;
			this[ENCODING] = null;
		} else if (isEncodingOptions(options)) {
			this[ENCODING] = options.encoding;
			this[OBJECTMODE] = false;
		} else {
			this[OBJECTMODE] = false;
			this[ENCODING] = null;
		}
		this[ASYNC] = !!options.async;
		this[DECODER] = this[ENCODING] ? new StringDecoder(this[ENCODING]) : null;
		if (options && options.debugExposeBuffer === true) Object.defineProperty(this, "buffer", { get: () => this[BUFFER] });
		if (options && options.debugExposePipes === true) Object.defineProperty(this, "pipes", { get: () => this[PIPES] });
		const { signal } = options;
		if (signal) {
			this[SIGNAL] = signal;
			if (signal.aborted) this[ABORT]();
			else signal.addEventListener("abort", () => this[ABORT]());
		}
	}
	/**
	* The amount of data stored in the buffer waiting to be read.
	*
	* For Buffer strings, this will be the total byte length.
	* For string encoding streams, this will be the string character length,
	* according to JavaScript's `string.length` logic.
	* For objectMode streams, this is a count of the items waiting to be
	* emitted.
	*/
	get bufferLength() {
		return this[BUFFERLENGTH];
	}
	/**
	* The `BufferEncoding` currently in use, or `null`
	*/
	get encoding() {
		return this[ENCODING];
	}
	/**
	* @deprecated - This is a read only property
	*/
	set encoding(_enc) {
		throw new Error("Encoding must be set at instantiation time");
	}
	/**
	* @deprecated - Encoding may only be set at instantiation time
	*/
	setEncoding(_enc) {
		throw new Error("Encoding must be set at instantiation time");
	}
	/**
	* True if this is an objectMode stream
	*/
	get objectMode() {
		return this[OBJECTMODE];
	}
	/**
	* @deprecated - This is a read-only property
	*/
	set objectMode(_om) {
		throw new Error("objectMode must be set at instantiation time");
	}
	/**
	* true if this is an async stream
	*/
	get ["async"]() {
		return this[ASYNC];
	}
	/**
	* Set to true to make this stream async.
	*
	* Once set, it cannot be unset, as this would potentially cause incorrect
	* behavior.  Ie, a sync stream can be made async, but an async stream
	* cannot be safely made sync.
	*/
	set ["async"](a) {
		this[ASYNC] = this[ASYNC] || !!a;
	}
	[ABORT]() {
		this[ABORTED] = true;
		this.emit("abort", this[SIGNAL]?.reason);
		this.destroy(this[SIGNAL]?.reason);
	}
	/**
	* True if the stream has been aborted.
	*/
	get aborted() {
		return this[ABORTED];
	}
	/**
	* No-op setter. Stream aborted status is set via the AbortSignal provided
	* in the constructor options.
	*/
	set aborted(_) {}
	write(chunk, encoding, cb) {
		if (this[ABORTED]) return false;
		if (this[EOF]) throw new Error("write after end");
		if (this[DESTROYED]) {
			this.emit("error", Object.assign(/* @__PURE__ */ new Error("Cannot call write after a stream was destroyed"), { code: "ERR_STREAM_DESTROYED" }));
			return true;
		}
		if (typeof encoding === "function") {
			cb = encoding;
			encoding = "utf8";
		}
		if (!encoding) encoding = "utf8";
		const fn = this[ASYNC] ? defer : nodefer;
		if (!this[OBJECTMODE] && !Buffer.isBuffer(chunk)) {
			if (isArrayBufferView(chunk)) chunk = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
			else if (isArrayBufferLike(chunk)) chunk = Buffer.from(chunk);
			else if (typeof chunk !== "string") throw new Error("Non-contiguous data written to non-objectMode stream");
		}
		if (this[OBJECTMODE]) {
			/* c8 ignore start */
			if (this[FLOWING] && this[BUFFERLENGTH] !== 0) this[FLUSH](true);
			/* c8 ignore stop */
			if (this[FLOWING]) this.emit("data", chunk);
			else this[BUFFERPUSH](chunk);
			if (this[BUFFERLENGTH] !== 0) this.emit("readable");
			if (cb) fn(cb);
			return this[FLOWING];
		}
		if (!chunk.length) {
			if (this[BUFFERLENGTH] !== 0) this.emit("readable");
			if (cb) fn(cb);
			return this[FLOWING];
		}
		if (typeof chunk === "string" && !(encoding === this[ENCODING] && !this[DECODER]?.lastNeed)) chunk = Buffer.from(chunk, encoding);
		if (Buffer.isBuffer(chunk) && this[ENCODING]) chunk = this[DECODER].write(chunk);
		if (this[FLOWING] && this[BUFFERLENGTH] !== 0) this[FLUSH](true);
		if (this[FLOWING]) this.emit("data", chunk);
		else this[BUFFERPUSH](chunk);
		if (this[BUFFERLENGTH] !== 0) this.emit("readable");
		if (cb) fn(cb);
		return this[FLOWING];
	}
	/**
	* Low-level explicit read method.
	*
	* In objectMode, the argument is ignored, and one item is returned if
	* available.
	*
	* `n` is the number of bytes (or in the case of encoding streams,
	* characters) to consume. If `n` is not provided, then the entire buffer
	* is returned, or `null` is returned if no data is available.
	*
	* If `n` is greater that the amount of data in the internal buffer,
	* then `null` is returned.
	*/
	read(n) {
		if (this[DESTROYED]) return null;
		this[DISCARDED] = false;
		if (this[BUFFERLENGTH] === 0 || n === 0 || n && n > this[BUFFERLENGTH]) {
			this[MAYBE_EMIT_END]();
			return null;
		}
		if (this[OBJECTMODE]) n = null;
		if (this[BUFFER].length > 1 && !this[OBJECTMODE]) this[BUFFER] = [this[ENCODING] ? this[BUFFER].join("") : Buffer.concat(this[BUFFER], this[BUFFERLENGTH])];
		const ret = this[READ](n || null, this[BUFFER][0]);
		this[MAYBE_EMIT_END]();
		return ret;
	}
	[READ](n, chunk) {
		if (this[OBJECTMODE]) this[BUFFERSHIFT]();
		else {
			const c = chunk;
			if (n === c.length || n === null) this[BUFFERSHIFT]();
			else if (typeof c === "string") {
				this[BUFFER][0] = c.slice(n);
				chunk = c.slice(0, n);
				this[BUFFERLENGTH] -= n;
			} else {
				this[BUFFER][0] = c.subarray(n);
				chunk = c.subarray(0, n);
				this[BUFFERLENGTH] -= n;
			}
		}
		this.emit("data", chunk);
		if (!this[BUFFER].length && !this[EOF]) this.emit("drain");
		return chunk;
	}
	end(chunk, encoding, cb) {
		if (typeof chunk === "function") {
			cb = chunk;
			chunk = void 0;
		}
		if (typeof encoding === "function") {
			cb = encoding;
			encoding = "utf8";
		}
		if (chunk !== void 0) this.write(chunk, encoding);
		if (cb) this.once("end", cb);
		this[EOF] = true;
		this.writable = false;
		if (this[FLOWING] || !this[PAUSED]) this[MAYBE_EMIT_END]();
		return this;
	}
	[RESUME]() {
		if (this[DESTROYED]) return;
		if (!this[DATALISTENERS] && !this[PIPES].length) this[DISCARDED] = true;
		this[PAUSED] = false;
		this[FLOWING] = true;
		this.emit("resume");
		if (this[BUFFER].length) this[FLUSH]();
		else if (this[EOF]) this[MAYBE_EMIT_END]();
		else this.emit("drain");
	}
	/**
	* Resume the stream if it is currently in a paused state
	*
	* If called when there are no pipe destinations or `data` event listeners,
	* this will place the stream in a "discarded" state, where all data will
	* be thrown away. The discarded state is removed if a pipe destination or
	* data handler is added, if pause() is called, or if any synchronous or
	* asynchronous iteration is started.
	*/
	resume() {
		return this[RESUME]();
	}
	/**
	* Pause the stream
	*/
	pause() {
		this[FLOWING] = false;
		this[PAUSED] = true;
		this[DISCARDED] = false;
	}
	/**
	* true if the stream has been forcibly destroyed
	*/
	get destroyed() {
		return this[DESTROYED];
	}
	/**
	* true if the stream is currently in a flowing state, meaning that
	* any writes will be immediately emitted.
	*/
	get flowing() {
		return this[FLOWING];
	}
	/**
	* true if the stream is currently in a paused state
	*/
	get paused() {
		return this[PAUSED];
	}
	[BUFFERPUSH](chunk) {
		if (this[OBJECTMODE]) this[BUFFERLENGTH] += 1;
		else this[BUFFERLENGTH] += chunk.length;
		this[BUFFER].push(chunk);
	}
	[BUFFERSHIFT]() {
		if (this[OBJECTMODE]) this[BUFFERLENGTH] -= 1;
		else this[BUFFERLENGTH] -= this[BUFFER][0].length;
		return this[BUFFER].shift();
	}
	[FLUSH](noDrain = false) {
		do		;
while (this[FLUSHCHUNK](this[BUFFERSHIFT]()) && this[BUFFER].length);
		if (!noDrain && !this[BUFFER].length && !this[EOF]) this.emit("drain");
	}
	[FLUSHCHUNK](chunk) {
		this.emit("data", chunk);
		return this[FLOWING];
	}
	/**
	* Pipe all data emitted by this stream into the destination provided.
	*
	* Triggers the flow of data.
	*/
	pipe(dest, opts) {
		if (this[DESTROYED]) return dest;
		this[DISCARDED] = false;
		const ended = this[EMITTED_END];
		opts = opts || {};
		if (dest === proc.stdout || dest === proc.stderr) opts.end = false;
		else opts.end = opts.end !== false;
		opts.proxyErrors = !!opts.proxyErrors;
		if (ended) {
			if (opts.end) dest.end();
		} else {
			this[PIPES].push(!opts.proxyErrors ? new Pipe(this, dest, opts) : new PipeProxyErrors(this, dest, opts));
			if (this[ASYNC]) defer(() => this[RESUME]());
			else this[RESUME]();
		}
		return dest;
	}
	/**
	* Fully unhook a piped destination stream.
	*
	* If the destination stream was the only consumer of this stream (ie,
	* there are no other piped destinations or `'data'` event listeners)
	* then the flow of data will stop until there is another consumer or
	* {@link Minipass#resume} is explicitly called.
	*/
	unpipe(dest) {
		const p = this[PIPES].find((p) => p.dest === dest);
		if (p) {
			if (this[PIPES].length === 1) {
				if (this[FLOWING] && this[DATALISTENERS] === 0) this[FLOWING] = false;
				this[PIPES] = [];
			} else this[PIPES].splice(this[PIPES].indexOf(p), 1);
			p.unpipe();
		}
	}
	/**
	* Alias for {@link Minipass#on}
	*/
	addListener(ev, handler) {
		return this.on(ev, handler);
	}
	/**
	* Mostly identical to `EventEmitter.on`, with the following
	* behavior differences to prevent data loss and unnecessary hangs:
	*
	* - Adding a 'data' event handler will trigger the flow of data
	*
	* - Adding a 'readable' event handler when there is data waiting to be read
	*   will cause 'readable' to be emitted immediately.
	*
	* - Adding an 'endish' event handler ('end', 'finish', etc.) which has
	*   already passed will cause the event to be emitted immediately and all
	*   handlers removed.
	*
	* - Adding an 'error' event handler after an error has been emitted will
	*   cause the event to be re-emitted immediately with the error previously
	*   raised.
	*/
	on(ev, handler) {
		const ret = super.on(ev, handler);
		if (ev === "data") {
			this[DISCARDED] = false;
			this[DATALISTENERS]++;
			if (!this[PIPES].length && !this[FLOWING]) this[RESUME]();
		} else if (ev === "readable" && this[BUFFERLENGTH] !== 0) super.emit("readable");
		else if (isEndish(ev) && this[EMITTED_END]) {
			super.emit(ev);
			this.removeAllListeners(ev);
		} else if (ev === "error" && this[EMITTED_ERROR]) {
			const h = handler;
			if (this[ASYNC]) defer(() => h.call(this, this[EMITTED_ERROR]));
			else h.call(this, this[EMITTED_ERROR]);
		}
		return ret;
	}
	/**
	* Alias for {@link Minipass#off}
	*/
	removeListener(ev, handler) {
		return this.off(ev, handler);
	}
	/**
	* Mostly identical to `EventEmitter.off`
	*
	* If a 'data' event handler is removed, and it was the last consumer
	* (ie, there are no pipe destinations or other 'data' event listeners),
	* then the flow of data will stop until there is another consumer or
	* {@link Minipass#resume} is explicitly called.
	*/
	off(ev, handler) {
		const ret = super.off(ev, handler);
		if (ev === "data") {
			this[DATALISTENERS] = this.listeners("data").length;
			if (this[DATALISTENERS] === 0 && !this[DISCARDED] && !this[PIPES].length) this[FLOWING] = false;
		}
		return ret;
	}
	/**
	* Mostly identical to `EventEmitter.removeAllListeners`
	*
	* If all 'data' event handlers are removed, and they were the last consumer
	* (ie, there are no pipe destinations), then the flow of data will stop
	* until there is another consumer or {@link Minipass#resume} is explicitly
	* called.
	*/
	removeAllListeners(ev) {
		const ret = super.removeAllListeners(ev);
		if (ev === "data" || ev === void 0) {
			this[DATALISTENERS] = 0;
			if (!this[DISCARDED] && !this[PIPES].length) this[FLOWING] = false;
		}
		return ret;
	}
	/**
	* true if the 'end' event has been emitted
	*/
	get emittedEnd() {
		return this[EMITTED_END];
	}
	[MAYBE_EMIT_END]() {
		if (!this[EMITTING_END] && !this[EMITTED_END] && !this[DESTROYED] && this[BUFFER].length === 0 && this[EOF]) {
			this[EMITTING_END] = true;
			this.emit("end");
			this.emit("prefinish");
			this.emit("finish");
			if (this[CLOSED]) this.emit("close");
			this[EMITTING_END] = false;
		}
	}
	/**
	* Mostly identical to `EventEmitter.emit`, with the following
	* behavior differences to prevent data loss and unnecessary hangs:
	*
	* If the stream has been destroyed, and the event is something other
	* than 'close' or 'error', then `false` is returned and no handlers
	* are called.
	*
	* If the event is 'end', and has already been emitted, then the event
	* is ignored. If the stream is in a paused or non-flowing state, then
	* the event will be deferred until data flow resumes. If the stream is
	* async, then handlers will be called on the next tick rather than
	* immediately.
	*
	* If the event is 'close', and 'end' has not yet been emitted, then
	* the event will be deferred until after 'end' is emitted.
	*
	* If the event is 'error', and an AbortSignal was provided for the stream,
	* and there are no listeners, then the event is ignored, matching the
	* behavior of node core streams in the presense of an AbortSignal.
	*
	* If the event is 'finish' or 'prefinish', then all listeners will be
	* removed after emitting the event, to prevent double-firing.
	*/
	emit(ev, ...args) {
		const data = args[0];
		if (ev !== "error" && ev !== "close" && ev !== DESTROYED && this[DESTROYED]) return false;
		else if (ev === "data") return !this[OBJECTMODE] && !data ? false : this[ASYNC] ? (defer(() => this[EMITDATA](data)), true) : this[EMITDATA](data);
		else if (ev === "end") return this[EMITEND]();
		else if (ev === "close") {
			this[CLOSED] = true;
			if (!this[EMITTED_END] && !this[DESTROYED]) return false;
			const ret = super.emit("close");
			this.removeAllListeners("close");
			return ret;
		} else if (ev === "error") {
			this[EMITTED_ERROR] = data;
			super.emit(ERROR, data);
			const ret = !this[SIGNAL] || this.listeners("error").length ? super.emit("error", data) : false;
			this[MAYBE_EMIT_END]();
			return ret;
		} else if (ev === "resume") {
			const ret = super.emit("resume");
			this[MAYBE_EMIT_END]();
			return ret;
		} else if (ev === "finish" || ev === "prefinish") {
			const ret = super.emit(ev);
			this.removeAllListeners(ev);
			return ret;
		}
		const ret = super.emit(ev, ...args);
		this[MAYBE_EMIT_END]();
		return ret;
	}
	[EMITDATA](data) {
		for (const p of this[PIPES]) if (p.dest.write(data) === false) this.pause();
		const ret = this[DISCARDED] ? false : super.emit("data", data);
		this[MAYBE_EMIT_END]();
		return ret;
	}
	[EMITEND]() {
		if (this[EMITTED_END]) return false;
		this[EMITTED_END] = true;
		this.readable = false;
		return this[ASYNC] ? (defer(() => this[EMITEND2]()), true) : this[EMITEND2]();
	}
	[EMITEND2]() {
		if (this[DECODER]) {
			const data = this[DECODER].end();
			if (data) {
				for (const p of this[PIPES]) p.dest.write(data);
				if (!this[DISCARDED]) super.emit("data", data);
			}
		}
		for (const p of this[PIPES]) p.end();
		const ret = super.emit("end");
		this.removeAllListeners("end");
		return ret;
	}
	/**
	* Return a Promise that resolves to an array of all emitted data once
	* the stream ends.
	*/
	async collect() {
		const buf = Object.assign([], { dataLength: 0 });
		if (!this[OBJECTMODE]) buf.dataLength = 0;
		const p = this.promise();
		this.on("data", (c) => {
			buf.push(c);
			if (!this[OBJECTMODE]) buf.dataLength += c.length;
		});
		await p;
		return buf;
	}
	/**
	* Return a Promise that resolves to the concatenation of all emitted data
	* once the stream ends.
	*
	* Not allowed on objectMode streams.
	*/
	async concat() {
		if (this[OBJECTMODE]) throw new Error("cannot concat in objectMode");
		const buf = await this.collect();
		return this[ENCODING] ? buf.join("") : Buffer.concat(buf, buf.dataLength);
	}
	/**
	* Return a void Promise that resolves once the stream ends.
	*/
	async promise() {
		return new Promise((resolve, reject) => {
			this.on(DESTROYED, () => reject(/* @__PURE__ */ new Error("stream destroyed")));
			this.on("error", (er) => reject(er));
			this.on("end", () => resolve());
		});
	}
	/**
	* Asynchronous `for await of` iteration.
	*
	* This will continue emitting all chunks until the stream terminates.
	*/
	[Symbol.asyncIterator]() {
		this[DISCARDED] = false;
		let stopped = false;
		const stop = async () => {
			this.pause();
			stopped = true;
			return {
				value: void 0,
				done: true
			};
		};
		const next = () => {
			if (stopped) return stop();
			const res = this.read();
			if (res !== null) return Promise.resolve({
				done: false,
				value: res
			});
			if (this[EOF]) return stop();
			let resolve;
			let reject;
			const onerr = (er) => {
				this.off("data", ondata);
				this.off("end", onend);
				this.off(DESTROYED, ondestroy);
				stop();
				reject(er);
			};
			const ondata = (value) => {
				this.off("error", onerr);
				this.off("end", onend);
				this.off(DESTROYED, ondestroy);
				this.pause();
				resolve({
					value,
					done: !!this[EOF]
				});
			};
			const onend = () => {
				this.off("error", onerr);
				this.off("data", ondata);
				this.off(DESTROYED, ondestroy);
				stop();
				resolve({
					done: true,
					value: void 0
				});
			};
			const ondestroy = () => onerr(/* @__PURE__ */ new Error("stream destroyed"));
			return new Promise((res, rej) => {
				reject = rej;
				resolve = res;
				this.once(DESTROYED, ondestroy);
				this.once("error", onerr);
				this.once("end", onend);
				this.once("data", ondata);
			});
		};
		return {
			next,
			throw: stop,
			return: stop,
			[Symbol.asyncIterator]() {
				return this;
			}
		};
	}
	/**
	* Synchronous `for of` iteration.
	*
	* The iteration will terminate when the internal buffer runs out, even
	* if the stream has not yet terminated.
	*/
	[Symbol.iterator]() {
		this[DISCARDED] = false;
		let stopped = false;
		const stop = () => {
			this.pause();
			this.off(ERROR, stop);
			this.off(DESTROYED, stop);
			this.off("end", stop);
			stopped = true;
			return {
				done: true,
				value: void 0
			};
		};
		const next = () => {
			if (stopped) return stop();
			const value = this.read();
			return value === null ? stop() : {
				done: false,
				value
			};
		};
		this.once("end", stop);
		this.once(ERROR, stop);
		this.once(DESTROYED, stop);
		return {
			next,
			throw: stop,
			return: stop,
			[Symbol.iterator]() {
				return this;
			}
		};
	}
	/**
	* Destroy a stream, preventing it from being used for any further purpose.
	*
	* If the stream has a `close()` method, then it will be called on
	* destruction.
	*
	* After destruction, any attempt to write data, read data, or emit most
	* events will be ignored.
	*
	* If an error argument is provided, then it will be emitted in an
	* 'error' event.
	*/
	destroy(er) {
		if (this[DESTROYED]) {
			if (er) this.emit("error", er);
			else this.emit(DESTROYED);
			return this;
		}
		this[DESTROYED] = true;
		this[DISCARDED] = true;
		this[BUFFER].length = 0;
		this[BUFFERLENGTH] = 0;
		const wc = this;
		if (typeof wc.close === "function" && !this[CLOSED]) wc.close();
		if (er) this.emit("error", er);
		else this.emit(DESTROYED);
		return this;
	}
	/**
	* Alias for {@link isStream}
	*
	* Former export location, maintained for backwards compatibility.
	*
	* @deprecated
	*/
	static get isStream() {
		return isStream;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/path-scurry@2.0.1/node_modules/path-scurry/dist/esm/index.js
const realpathSync$2 = realpathSync$1.native;
const defaultFS = {
	lstatSync: lstatSync$1,
	readdir,
	readdirSync: readdirSync$1,
	readlinkSync,
	realpathSync: realpathSync$2,
	promises: {
		lstat,
		readdir: readdir$1,
		readlink,
		realpath
	}
};
const fsFromOption = (fsOption) => !fsOption || fsOption === defaultFS || fsOption === actualFS ? defaultFS : {
	...defaultFS,
	...fsOption,
	promises: {
		...defaultFS.promises,
		...fsOption.promises || {}
	}
};
const uncDriveRegexp = /^\\\\\?\\([a-z]:)\\?$/i;
const uncToDrive = (rootPath) => rootPath.replace(/\//g, "\\").replace(uncDriveRegexp, "$1\\");
const eitherSep = /[\\\/]/;
const UNKNOWN = 0;
const IFIFO = 1;
const IFCHR = 2;
const IFDIR = 4;
const IFBLK = 6;
const IFREG = 8;
const IFLNK = 10;
const IFSOCK = 12;
const IFMT = 15;
const IFMT_UNKNOWN = -16;
const READDIR_CALLED = 16;
const LSTAT_CALLED = 32;
const ENOTDIR = 64;
const ENOENT = 128;
const ENOREADLINK = 256;
const ENOREALPATH = 512;
const ENOCHILD = 704;
const TYPEMASK = 1023;
const entToType = (s) => s.isFile() ? IFREG : s.isDirectory() ? IFDIR : s.isSymbolicLink() ? IFLNK : s.isCharacterDevice() ? IFCHR : s.isBlockDevice() ? IFBLK : s.isSocket() ? IFSOCK : s.isFIFO() ? IFIFO : UNKNOWN;
const normalizeCache = new L({ max: 4096 });
const normalize$1 = (s) => {
	const c = normalizeCache.get(s);
	if (c) return c;
	const n = s.normalize("NFKD");
	normalizeCache.set(s, n);
	return n;
};
const normalizeNocaseCache = new L({ max: 4096 });
const normalizeNocase = (s) => {
	const c = normalizeNocaseCache.get(s);
	if (c) return c;
	const n = normalize$1(s.toLowerCase());
	normalizeNocaseCache.set(s, n);
	return n;
};
/**
* An LRUCache for storing resolved path strings or Path objects.
* @internal
*/
var ResolveCache = class extends L {
	constructor() {
		super({ max: 256 });
	}
};
/**
* an LRUCache for storing child entries.
* @internal
*/
var ChildrenCache = class extends L {
	constructor(maxSize = 16384) {
		super({
			maxSize,
			sizeCalculation: (a) => a.length + 1
		});
	}
};
const setAsCwd = Symbol("PathScurry setAsCwd");
/**
* Path objects are sort of like a super-powered
* {@link https://nodejs.org/docs/latest/api/fs.html#class-fsdirent fs.Dirent}
*
* Each one represents a single filesystem entry on disk, which may or may not
* exist. It includes methods for reading various types of information via
* lstat, readlink, and readdir, and caches all information to the greatest
* degree possible.
*
* Note that fs operations that would normally throw will instead return an
* "empty" value. This is in order to prevent excessive overhead from error
* stack traces.
*/
var PathBase = class {
	/**
	* the basename of this path
	*
	* **Important**: *always* test the path name against any test string
	* usingthe {@link isNamed} method, and not by directly comparing this
	* string. Otherwise, unicode path strings that the system sees as identical
	* will not be properly treated as the same path, leading to incorrect
	* behavior and possible security issues.
	*/
	name;
	/**
	* the Path entry corresponding to the path root.
	*
	* @internal
	*/
	root;
	/**
	* All roots found within the current PathScurry family
	*
	* @internal
	*/
	roots;
	/**
	* a reference to the parent path, or undefined in the case of root entries
	*
	* @internal
	*/
	parent;
	/**
	* boolean indicating whether paths are compared case-insensitively
	* @internal
	*/
	nocase;
	/**
	* boolean indicating that this path is the current working directory
	* of the PathScurry collection that contains it.
	*/
	isCWD = false;
	#fs;
	#dev;
	get dev() {
		return this.#dev;
	}
	#mode;
	get mode() {
		return this.#mode;
	}
	#nlink;
	get nlink() {
		return this.#nlink;
	}
	#uid;
	get uid() {
		return this.#uid;
	}
	#gid;
	get gid() {
		return this.#gid;
	}
	#rdev;
	get rdev() {
		return this.#rdev;
	}
	#blksize;
	get blksize() {
		return this.#blksize;
	}
	#ino;
	get ino() {
		return this.#ino;
	}
	#size;
	get size() {
		return this.#size;
	}
	#blocks;
	get blocks() {
		return this.#blocks;
	}
	#atimeMs;
	get atimeMs() {
		return this.#atimeMs;
	}
	#mtimeMs;
	get mtimeMs() {
		return this.#mtimeMs;
	}
	#ctimeMs;
	get ctimeMs() {
		return this.#ctimeMs;
	}
	#birthtimeMs;
	get birthtimeMs() {
		return this.#birthtimeMs;
	}
	#atime;
	get atime() {
		return this.#atime;
	}
	#mtime;
	get mtime() {
		return this.#mtime;
	}
	#ctime;
	get ctime() {
		return this.#ctime;
	}
	#birthtime;
	get birthtime() {
		return this.#birthtime;
	}
	#matchName;
	#depth;
	#fullpath;
	#fullpathPosix;
	#relative;
	#relativePosix;
	#type;
	#children;
	#linkTarget;
	#realpath;
	/**
	* This property is for compatibility with the Dirent class as of
	* Node v20, where Dirent['parentPath'] refers to the path of the
	* directory that was passed to readdir. For root entries, it's the path
	* to the entry itself.
	*/
	get parentPath() {
		return (this.parent || this).fullpath();
	}
	/* c8 ignore start */
	/**
	* Deprecated alias for Dirent['parentPath'] Somewhat counterintuitively,
	* this property refers to the *parent* path, not the path object itself.
	*
	* @deprecated
	*/
	get path() {
		return this.parentPath;
	}
	/* c8 ignore stop */
	/**
	* Do not create new Path objects directly.  They should always be accessed
	* via the PathScurry class or other methods on the Path class.
	*
	* @internal
	*/
	constructor(name, type = UNKNOWN, root, roots, nocase, children, opts) {
		this.name = name;
		this.#matchName = nocase ? normalizeNocase(name) : normalize$1(name);
		this.#type = type & TYPEMASK;
		this.nocase = nocase;
		this.roots = roots;
		this.root = root || this;
		this.#children = children;
		this.#fullpath = opts.fullpath;
		this.#relative = opts.relative;
		this.#relativePosix = opts.relativePosix;
		this.parent = opts.parent;
		if (this.parent) this.#fs = this.parent.#fs;
		else this.#fs = fsFromOption(opts.fs);
	}
	/**
	* Returns the depth of the Path object from its root.
	*
	* For example, a path at `/foo/bar` would have a depth of 2.
	*/
	depth() {
		if (this.#depth !== void 0) return this.#depth;
		if (!this.parent) return this.#depth = 0;
		return this.#depth = this.parent.depth() + 1;
	}
	/**
	* @internal
	*/
	childrenCache() {
		return this.#children;
	}
	/**
	* Get the Path object referenced by the string path, resolved from this Path
	*/
	resolve(path) {
		if (!path) return this;
		const rootPath = this.getRootString(path);
		const dirParts = path.substring(rootPath.length).split(this.splitSep);
		return rootPath ? this.getRoot(rootPath).#resolveParts(dirParts) : this.#resolveParts(dirParts);
	}
	#resolveParts(dirParts) {
		let p = this;
		for (const part of dirParts) p = p.child(part);
		return p;
	}
	/**
	* Returns the cached children Path objects, if still available.  If they
	* have fallen out of the cache, then returns an empty array, and resets the
	* READDIR_CALLED bit, so that future calls to readdir() will require an fs
	* lookup.
	*
	* @internal
	*/
	children() {
		const cached = this.#children.get(this);
		if (cached) return cached;
		const children = Object.assign([], { provisional: 0 });
		this.#children.set(this, children);
		this.#type &= -17;
		return children;
	}
	/**
	* Resolves a path portion and returns or creates the child Path.
	*
	* Returns `this` if pathPart is `''` or `'.'`, or `parent` if pathPart is
	* `'..'`.
	*
	* This should not be called directly.  If `pathPart` contains any path
	* separators, it will lead to unsafe undefined behavior.
	*
	* Use `Path.resolve()` instead.
	*
	* @internal
	*/
	child(pathPart, opts) {
		if (pathPart === "" || pathPart === ".") return this;
		if (pathPart === "..") return this.parent || this;
		const children = this.children();
		const name = this.nocase ? normalizeNocase(pathPart) : normalize$1(pathPart);
		for (const p of children) if (p.#matchName === name) return p;
		const s = this.parent ? this.sep : "";
		const fullpath = this.#fullpath ? this.#fullpath + s + pathPart : void 0;
		const pchild = this.newChild(pathPart, UNKNOWN, {
			...opts,
			parent: this,
			fullpath
		});
		if (!this.canReaddir()) pchild.#type |= ENOENT;
		children.push(pchild);
		return pchild;
	}
	/**
	* The relative path from the cwd. If it does not share an ancestor with
	* the cwd, then this ends up being equivalent to the fullpath()
	*/
	relative() {
		if (this.isCWD) return "";
		if (this.#relative !== void 0) return this.#relative;
		const name = this.name;
		const p = this.parent;
		if (!p) return this.#relative = this.name;
		const pv = p.relative();
		return pv + (!pv || !p.parent ? "" : this.sep) + name;
	}
	/**
	* The relative path from the cwd, using / as the path separator.
	* If it does not share an ancestor with
	* the cwd, then this ends up being equivalent to the fullpathPosix()
	* On posix systems, this is identical to relative().
	*/
	relativePosix() {
		if (this.sep === "/") return this.relative();
		if (this.isCWD) return "";
		if (this.#relativePosix !== void 0) return this.#relativePosix;
		const name = this.name;
		const p = this.parent;
		if (!p) return this.#relativePosix = this.fullpathPosix();
		const pv = p.relativePosix();
		return pv + (!pv || !p.parent ? "" : "/") + name;
	}
	/**
	* The fully resolved path string for this Path entry
	*/
	fullpath() {
		if (this.#fullpath !== void 0) return this.#fullpath;
		const name = this.name;
		const p = this.parent;
		if (!p) return this.#fullpath = this.name;
		const fp = p.fullpath() + (!p.parent ? "" : this.sep) + name;
		return this.#fullpath = fp;
	}
	/**
	* On platforms other than windows, this is identical to fullpath.
	*
	* On windows, this is overridden to return the forward-slash form of the
	* full UNC path.
	*/
	fullpathPosix() {
		if (this.#fullpathPosix !== void 0) return this.#fullpathPosix;
		if (this.sep === "/") return this.#fullpathPosix = this.fullpath();
		if (!this.parent) {
			const p = this.fullpath().replace(/\\/g, "/");
			if (/^[a-z]:\//i.test(p)) return this.#fullpathPosix = `//?/${p}`;
			else return this.#fullpathPosix = p;
		}
		const p = this.parent;
		const pfpp = p.fullpathPosix();
		const fpp = pfpp + (!pfpp || !p.parent ? "" : "/") + this.name;
		return this.#fullpathPosix = fpp;
	}
	/**
	* Is the Path of an unknown type?
	*
	* Note that we might know *something* about it if there has been a previous
	* filesystem operation, for example that it does not exist, or is not a
	* link, or whether it has child entries.
	*/
	isUnknown() {
		return (this.#type & IFMT) === UNKNOWN;
	}
	isType(type) {
		return this[`is${type}`]();
	}
	getType() {
		return this.isUnknown() ? "Unknown" : this.isDirectory() ? "Directory" : this.isFile() ? "File" : this.isSymbolicLink() ? "SymbolicLink" : this.isFIFO() ? "FIFO" : this.isCharacterDevice() ? "CharacterDevice" : this.isBlockDevice() ? "BlockDevice" : /* c8 ignore start */ this.isSocket() ? "Socket" : "Unknown";
		/* c8 ignore stop */
	}
	/**
	* Is the Path a regular file?
	*/
	isFile() {
		return (this.#type & IFMT) === IFREG;
	}
	/**
	* Is the Path a directory?
	*/
	isDirectory() {
		return (this.#type & IFMT) === IFDIR;
	}
	/**
	* Is the path a character device?
	*/
	isCharacterDevice() {
		return (this.#type & IFMT) === IFCHR;
	}
	/**
	* Is the path a block device?
	*/
	isBlockDevice() {
		return (this.#type & IFMT) === IFBLK;
	}
	/**
	* Is the path a FIFO pipe?
	*/
	isFIFO() {
		return (this.#type & IFMT) === IFIFO;
	}
	/**
	* Is the path a socket?
	*/
	isSocket() {
		return (this.#type & IFMT) === IFSOCK;
	}
	/**
	* Is the path a symbolic link?
	*/
	isSymbolicLink() {
		return (this.#type & IFLNK) === IFLNK;
	}
	/**
	* Return the entry if it has been subject of a successful lstat, or
	* undefined otherwise.
	*
	* Does not read the filesystem, so an undefined result *could* simply
	* mean that we haven't called lstat on it.
	*/
	lstatCached() {
		return this.#type & LSTAT_CALLED ? this : void 0;
	}
	/**
	* Return the cached link target if the entry has been the subject of a
	* successful readlink, or undefined otherwise.
	*
	* Does not read the filesystem, so an undefined result *could* just mean we
	* don't have any cached data. Only use it if you are very sure that a
	* readlink() has been called at some point.
	*/
	readlinkCached() {
		return this.#linkTarget;
	}
	/**
	* Returns the cached realpath target if the entry has been the subject
	* of a successful realpath, or undefined otherwise.
	*
	* Does not read the filesystem, so an undefined result *could* just mean we
	* don't have any cached data. Only use it if you are very sure that a
	* realpath() has been called at some point.
	*/
	realpathCached() {
		return this.#realpath;
	}
	/**
	* Returns the cached child Path entries array if the entry has been the
	* subject of a successful readdir(), or [] otherwise.
	*
	* Does not read the filesystem, so an empty array *could* just mean we
	* don't have any cached data. Only use it if you are very sure that a
	* readdir() has been called recently enough to still be valid.
	*/
	readdirCached() {
		const children = this.children();
		return children.slice(0, children.provisional);
	}
	/**
	* Return true if it's worth trying to readlink.  Ie, we don't (yet) have
	* any indication that readlink will definitely fail.
	*
	* Returns false if the path is known to not be a symlink, if a previous
	* readlink failed, or if the entry does not exist.
	*/
	canReadlink() {
		if (this.#linkTarget) return true;
		if (!this.parent) return false;
		const ifmt = this.#type & IFMT;
		return !(ifmt !== UNKNOWN && ifmt !== IFLNK || this.#type & ENOREADLINK || this.#type & ENOENT);
	}
	/**
	* Return true if readdir has previously been successfully called on this
	* path, indicating that cachedReaddir() is likely valid.
	*/
	calledReaddir() {
		return !!(this.#type & READDIR_CALLED);
	}
	/**
	* Returns true if the path is known to not exist. That is, a previous lstat
	* or readdir failed to verify its existence when that would have been
	* expected, or a parent entry was marked either enoent or enotdir.
	*/
	isENOENT() {
		return !!(this.#type & ENOENT);
	}
	/**
	* Return true if the path is a match for the given path name.  This handles
	* case sensitivity and unicode normalization.
	*
	* Note: even on case-sensitive systems, it is **not** safe to test the
	* equality of the `.name` property to determine whether a given pathname
	* matches, due to unicode normalization mismatches.
	*
	* Always use this method instead of testing the `path.name` property
	* directly.
	*/
	isNamed(n) {
		return !this.nocase ? this.#matchName === normalize$1(n) : this.#matchName === normalizeNocase(n);
	}
	/**
	* Return the Path object corresponding to the target of a symbolic link.
	*
	* If the Path is not a symbolic link, or if the readlink call fails for any
	* reason, `undefined` is returned.
	*
	* Result is cached, and thus may be outdated if the filesystem is mutated.
	*/
	async readlink() {
		const target = this.#linkTarget;
		if (target) return target;
		if (!this.canReadlink()) return;
		/* c8 ignore start */
		if (!this.parent) return;
		/* c8 ignore stop */
		try {
			const read = await this.#fs.promises.readlink(this.fullpath());
			const linkTarget = (await this.parent.realpath())?.resolve(read);
			if (linkTarget) return this.#linkTarget = linkTarget;
		} catch (er) {
			this.#readlinkFail(er.code);
			return;
		}
	}
	/**
	* Synchronous {@link PathBase.readlink}
	*/
	readlinkSync() {
		const target = this.#linkTarget;
		if (target) return target;
		if (!this.canReadlink()) return;
		/* c8 ignore start */
		if (!this.parent) return;
		/* c8 ignore stop */
		try {
			const read = this.#fs.readlinkSync(this.fullpath());
			const linkTarget = this.parent.realpathSync()?.resolve(read);
			if (linkTarget) return this.#linkTarget = linkTarget;
		} catch (er) {
			this.#readlinkFail(er.code);
			return;
		}
	}
	#readdirSuccess(children) {
		this.#type |= READDIR_CALLED;
		for (let p = children.provisional; p < children.length; p++) {
			const c = children[p];
			if (c) c.#markENOENT();
		}
	}
	#markENOENT() {
		if (this.#type & ENOENT) return;
		this.#type = (this.#type | ENOENT) & IFMT_UNKNOWN;
		this.#markChildrenENOENT();
	}
	#markChildrenENOENT() {
		const children = this.children();
		children.provisional = 0;
		for (const p of children) p.#markENOENT();
	}
	#markENOREALPATH() {
		this.#type |= ENOREALPATH;
		this.#markENOTDIR();
	}
	#markENOTDIR() {
		/* c8 ignore start */
		if (this.#type & ENOTDIR) return;
		/* c8 ignore stop */
		let t = this.#type;
		if ((t & IFMT) === IFDIR) t &= IFMT_UNKNOWN;
		this.#type = t | ENOTDIR;
		this.#markChildrenENOENT();
	}
	#readdirFail(code = "") {
		if (code === "ENOTDIR" || code === "EPERM") this.#markENOTDIR();
		else if (code === "ENOENT") this.#markENOENT();
		else this.children().provisional = 0;
	}
	#lstatFail(code = "") {
		/* c8 ignore start */
		if (code === "ENOTDIR") this.parent.#markENOTDIR();
		else if (code === "ENOENT")
 /* c8 ignore stop */
		this.#markENOENT();
	}
	#readlinkFail(code = "") {
		let ter = this.#type;
		ter |= ENOREADLINK;
		if (code === "ENOENT") ter |= ENOENT;
		if (code === "EINVAL" || code === "UNKNOWN") ter &= IFMT_UNKNOWN;
		this.#type = ter;
		/* c8 ignore start */
		if (code === "ENOTDIR" && this.parent) this.parent.#markENOTDIR();
		/* c8 ignore stop */
	}
	#readdirAddChild(e, c) {
		return this.#readdirMaybePromoteChild(e, c) || this.#readdirAddNewChild(e, c);
	}
	#readdirAddNewChild(e, c) {
		const type = entToType(e);
		const child = this.newChild(e.name, type, { parent: this });
		const ifmt = child.#type & IFMT;
		if (ifmt !== IFDIR && ifmt !== IFLNK && ifmt !== UNKNOWN) child.#type |= ENOTDIR;
		c.unshift(child);
		c.provisional++;
		return child;
	}
	#readdirMaybePromoteChild(e, c) {
		for (let p = c.provisional; p < c.length; p++) {
			const pchild = c[p];
			if ((this.nocase ? normalizeNocase(e.name) : normalize$1(e.name)) !== pchild.#matchName) continue;
			return this.#readdirPromoteChild(e, pchild, p, c);
		}
	}
	#readdirPromoteChild(e, p, index, c) {
		const v = p.name;
		p.#type = p.#type & IFMT_UNKNOWN | entToType(e);
		if (v !== e.name) p.name = e.name;
		if (index !== c.provisional) {
			if (index === c.length - 1) c.pop();
			else c.splice(index, 1);
			c.unshift(p);
		}
		c.provisional++;
		return p;
	}
	/**
	* Call lstat() on this Path, and update all known information that can be
	* determined.
	*
	* Note that unlike `fs.lstat()`, the returned value does not contain some
	* information, such as `mode`, `dev`, `nlink`, and `ino`.  If that
	* information is required, you will need to call `fs.lstat` yourself.
	*
	* If the Path refers to a nonexistent file, or if the lstat call fails for
	* any reason, `undefined` is returned.  Otherwise the updated Path object is
	* returned.
	*
	* Results are cached, and thus may be out of date if the filesystem is
	* mutated.
	*/
	async lstat() {
		if ((this.#type & ENOENT) === 0) try {
			this.#applyStat(await this.#fs.promises.lstat(this.fullpath()));
			return this;
		} catch (er) {
			this.#lstatFail(er.code);
		}
	}
	/**
	* synchronous {@link PathBase.lstat}
	*/
	lstatSync() {
		if ((this.#type & ENOENT) === 0) try {
			this.#applyStat(this.#fs.lstatSync(this.fullpath()));
			return this;
		} catch (er) {
			this.#lstatFail(er.code);
		}
	}
	#applyStat(st) {
		const { atime, atimeMs, birthtime, birthtimeMs, blksize, blocks, ctime, ctimeMs, dev, gid, ino, mode, mtime, mtimeMs, nlink, rdev, size, uid } = st;
		this.#atime = atime;
		this.#atimeMs = atimeMs;
		this.#birthtime = birthtime;
		this.#birthtimeMs = birthtimeMs;
		this.#blksize = blksize;
		this.#blocks = blocks;
		this.#ctime = ctime;
		this.#ctimeMs = ctimeMs;
		this.#dev = dev;
		this.#gid = gid;
		this.#ino = ino;
		this.#mode = mode;
		this.#mtime = mtime;
		this.#mtimeMs = mtimeMs;
		this.#nlink = nlink;
		this.#rdev = rdev;
		this.#size = size;
		this.#uid = uid;
		const ifmt = entToType(st);
		this.#type = this.#type & IFMT_UNKNOWN | ifmt | LSTAT_CALLED;
		if (ifmt !== UNKNOWN && ifmt !== IFDIR && ifmt !== IFLNK) this.#type |= ENOTDIR;
	}
	#onReaddirCB = [];
	#readdirCBInFlight = false;
	#callOnReaddirCB(children) {
		this.#readdirCBInFlight = false;
		const cbs = this.#onReaddirCB.slice();
		this.#onReaddirCB.length = 0;
		cbs.forEach((cb) => cb(null, children));
	}
	/**
	* Standard node-style callback interface to get list of directory entries.
	*
	* If the Path cannot or does not contain any children, then an empty array
	* is returned.
	*
	* Results are cached, and thus may be out of date if the filesystem is
	* mutated.
	*
	* @param cb The callback called with (er, entries).  Note that the `er`
	* param is somewhat extraneous, as all readdir() errors are handled and
	* simply result in an empty set of entries being returned.
	* @param allowZalgo Boolean indicating that immediately known results should
	* *not* be deferred with `queueMicrotask`. Defaults to `false`. Release
	* zalgo at your peril, the dark pony lord is devious and unforgiving.
	*/
	readdirCB(cb, allowZalgo = false) {
		if (!this.canReaddir()) {
			if (allowZalgo) cb(null, []);
			else queueMicrotask(() => cb(null, []));
			return;
		}
		const children = this.children();
		if (this.calledReaddir()) {
			const c = children.slice(0, children.provisional);
			if (allowZalgo) cb(null, c);
			else queueMicrotask(() => cb(null, c));
			return;
		}
		this.#onReaddirCB.push(cb);
		if (this.#readdirCBInFlight) return;
		this.#readdirCBInFlight = true;
		const fullpath = this.fullpath();
		this.#fs.readdir(fullpath, { withFileTypes: true }, (er, entries) => {
			if (er) {
				this.#readdirFail(er.code);
				children.provisional = 0;
			} else {
				for (const e of entries) this.#readdirAddChild(e, children);
				this.#readdirSuccess(children);
			}
			this.#callOnReaddirCB(children.slice(0, children.provisional));
		});
	}
	#asyncReaddirInFlight;
	/**
	* Return an array of known child entries.
	*
	* If the Path cannot or does not contain any children, then an empty array
	* is returned.
	*
	* Results are cached, and thus may be out of date if the filesystem is
	* mutated.
	*/
	async readdir() {
		if (!this.canReaddir()) return [];
		const children = this.children();
		if (this.calledReaddir()) return children.slice(0, children.provisional);
		const fullpath = this.fullpath();
		if (this.#asyncReaddirInFlight) await this.#asyncReaddirInFlight;
		else {
			/* c8 ignore start */
			let resolve = () => {};
			/* c8 ignore stop */
			this.#asyncReaddirInFlight = new Promise((res) => resolve = res);
			try {
				for (const e of await this.#fs.promises.readdir(fullpath, { withFileTypes: true })) this.#readdirAddChild(e, children);
				this.#readdirSuccess(children);
			} catch (er) {
				this.#readdirFail(er.code);
				children.provisional = 0;
			}
			this.#asyncReaddirInFlight = void 0;
			resolve();
		}
		return children.slice(0, children.provisional);
	}
	/**
	* synchronous {@link PathBase.readdir}
	*/
	readdirSync() {
		if (!this.canReaddir()) return [];
		const children = this.children();
		if (this.calledReaddir()) return children.slice(0, children.provisional);
		const fullpath = this.fullpath();
		try {
			for (const e of this.#fs.readdirSync(fullpath, { withFileTypes: true })) this.#readdirAddChild(e, children);
			this.#readdirSuccess(children);
		} catch (er) {
			this.#readdirFail(er.code);
			children.provisional = 0;
		}
		return children.slice(0, children.provisional);
	}
	canReaddir() {
		if (this.#type & ENOCHILD) return false;
		const ifmt = IFMT & this.#type;
		/* c8 ignore start */
		if (!(ifmt === UNKNOWN || ifmt === IFDIR || ifmt === IFLNK)) return false;
		/* c8 ignore stop */
		return true;
	}
	shouldWalk(dirs, walkFilter) {
		return (this.#type & IFDIR) === IFDIR && !(this.#type & ENOCHILD) && !dirs.has(this) && (!walkFilter || walkFilter(this));
	}
	/**
	* Return the Path object corresponding to path as resolved
	* by realpath(3).
	*
	* If the realpath call fails for any reason, `undefined` is returned.
	*
	* Result is cached, and thus may be outdated if the filesystem is mutated.
	* On success, returns a Path object.
	*/
	async realpath() {
		if (this.#realpath) return this.#realpath;
		if (896 & this.#type) return void 0;
		try {
			const rp = await this.#fs.promises.realpath(this.fullpath());
			return this.#realpath = this.resolve(rp);
		} catch (_) {
			this.#markENOREALPATH();
		}
	}
	/**
	* Synchronous {@link realpath}
	*/
	realpathSync() {
		if (this.#realpath) return this.#realpath;
		if (896 & this.#type) return void 0;
		try {
			const rp = this.#fs.realpathSync(this.fullpath());
			return this.#realpath = this.resolve(rp);
		} catch (_) {
			this.#markENOREALPATH();
		}
	}
	/**
	* Internal method to mark this Path object as the scurry cwd,
	* called by {@link PathScurry#chdir}
	*
	* @internal
	*/
	[setAsCwd](oldCwd) {
		if (oldCwd === this) return;
		oldCwd.isCWD = false;
		this.isCWD = true;
		const changed = /* @__PURE__ */ new Set([]);
		let rp = [];
		let p = this;
		while (p && p.parent) {
			changed.add(p);
			p.#relative = rp.join(this.sep);
			p.#relativePosix = rp.join("/");
			p = p.parent;
			rp.push("..");
		}
		p = oldCwd;
		while (p && p.parent && !changed.has(p)) {
			p.#relative = void 0;
			p.#relativePosix = void 0;
			p = p.parent;
		}
	}
};
/**
* Path class used on win32 systems
*
* Uses `'\\'` as the path separator for returned paths, either `'\\'` or `'/'`
* as the path separator for parsing paths.
*/
var PathWin32 = class PathWin32 extends PathBase {
	/**
	* Separator for generating path strings.
	*/
	sep = "\\";
	/**
	* Separator for parsing path strings.
	*/
	splitSep = eitherSep;
	/**
	* Do not create new Path objects directly.  They should always be accessed
	* via the PathScurry class or other methods on the Path class.
	*
	* @internal
	*/
	constructor(name, type = UNKNOWN, root, roots, nocase, children, opts) {
		super(name, type, root, roots, nocase, children, opts);
	}
	/**
	* @internal
	*/
	newChild(name, type = UNKNOWN, opts = {}) {
		return new PathWin32(name, type, this.root, this.roots, this.nocase, this.childrenCache(), opts);
	}
	/**
	* @internal
	*/
	getRootString(path) {
		return win32.parse(path).root;
	}
	/**
	* @internal
	*/
	getRoot(rootPath) {
		rootPath = uncToDrive(rootPath.toUpperCase());
		if (rootPath === this.root.name) return this.root;
		for (const [compare, root] of Object.entries(this.roots)) if (this.sameRoot(rootPath, compare)) return this.roots[rootPath] = root;
		return this.roots[rootPath] = new PathScurryWin32(rootPath, this).root;
	}
	/**
	* @internal
	*/
	sameRoot(rootPath, compare = this.root.name) {
		rootPath = rootPath.toUpperCase().replace(/\//g, "\\").replace(uncDriveRegexp, "$1\\");
		return rootPath === compare;
	}
};
/**
* Path class used on all posix systems.
*
* Uses `'/'` as the path separator.
*/
var PathPosix = class PathPosix extends PathBase {
	/**
	* separator for parsing path strings
	*/
	splitSep = "/";
	/**
	* separator for generating path strings
	*/
	sep = "/";
	/**
	* Do not create new Path objects directly.  They should always be accessed
	* via the PathScurry class or other methods on the Path class.
	*
	* @internal
	*/
	constructor(name, type = UNKNOWN, root, roots, nocase, children, opts) {
		super(name, type, root, roots, nocase, children, opts);
	}
	/**
	* @internal
	*/
	getRootString(path) {
		return path.startsWith("/") ? "/" : "";
	}
	/**
	* @internal
	*/
	getRoot(_rootPath) {
		return this.root;
	}
	/**
	* @internal
	*/
	newChild(name, type = UNKNOWN, opts = {}) {
		return new PathPosix(name, type, this.root, this.roots, this.nocase, this.childrenCache(), opts);
	}
};
/**
* The base class for all PathScurry classes, providing the interface for path
* resolution and filesystem operations.
*
* Typically, you should *not* instantiate this class directly, but rather one
* of the platform-specific classes, or the exported {@link PathScurry} which
* defaults to the current platform.
*/
var PathScurryBase = class {
	/**
	* The root Path entry for the current working directory of this Scurry
	*/
	root;
	/**
	* The string path for the root of this Scurry's current working directory
	*/
	rootPath;
	/**
	* A collection of all roots encountered, referenced by rootPath
	*/
	roots;
	/**
	* The Path entry corresponding to this PathScurry's current working directory.
	*/
	cwd;
	#resolveCache;
	#resolvePosixCache;
	#children;
	/**
	* Perform path comparisons case-insensitively.
	*
	* Defaults true on Darwin and Windows systems, false elsewhere.
	*/
	nocase;
	#fs;
	/**
	* This class should not be instantiated directly.
	*
	* Use PathScurryWin32, PathScurryDarwin, PathScurryPosix, or PathScurry
	*
	* @internal
	*/
	constructor(cwd = process.cwd(), pathImpl, sep, { nocase, childrenCacheSize = 16384, fs = defaultFS } = {}) {
		this.#fs = fsFromOption(fs);
		if (cwd instanceof URL || cwd.startsWith("file://")) cwd = fileURLToPath(cwd);
		const cwdPath = pathImpl.resolve(cwd);
		this.roots = Object.create(null);
		this.rootPath = this.parseRootPath(cwdPath);
		this.#resolveCache = new ResolveCache();
		this.#resolvePosixCache = new ResolveCache();
		this.#children = new ChildrenCache(childrenCacheSize);
		const split = cwdPath.substring(this.rootPath.length).split(sep);
		if (split.length === 1 && !split[0]) split.pop();
		/* c8 ignore start */
		if (nocase === void 0) throw new TypeError("must provide nocase setting to PathScurryBase ctor");
		/* c8 ignore stop */
		this.nocase = nocase;
		this.root = this.newRoot(this.#fs);
		this.roots[this.rootPath] = this.root;
		let prev = this.root;
		let len = split.length - 1;
		const joinSep = pathImpl.sep;
		let abs = this.rootPath;
		let sawFirst = false;
		for (const part of split) {
			const l = len--;
			prev = prev.child(part, {
				relative: new Array(l).fill("..").join(joinSep),
				relativePosix: new Array(l).fill("..").join("/"),
				fullpath: abs += (sawFirst ? "" : joinSep) + part
			});
			sawFirst = true;
		}
		this.cwd = prev;
	}
	/**
	* Get the depth of a provided path, string, or the cwd
	*/
	depth(path = this.cwd) {
		if (typeof path === "string") path = this.cwd.resolve(path);
		return path.depth();
	}
	/**
	* Return the cache of child entries.  Exposed so subclasses can create
	* child Path objects in a platform-specific way.
	*
	* @internal
	*/
	childrenCache() {
		return this.#children;
	}
	/**
	* Resolve one or more path strings to a resolved string
	*
	* Same interface as require('path').resolve.
	*
	* Much faster than path.resolve() when called multiple times for the same
	* path, because the resolved Path objects are cached.  Much slower
	* otherwise.
	*/
	resolve(...paths) {
		let r = "";
		for (let i = paths.length - 1; i >= 0; i--) {
			const p = paths[i];
			if (!p || p === ".") continue;
			r = r ? `${p}/${r}` : p;
			if (this.isAbsolute(p)) break;
		}
		const cached = this.#resolveCache.get(r);
		if (cached !== void 0) return cached;
		const result = this.cwd.resolve(r).fullpath();
		this.#resolveCache.set(r, result);
		return result;
	}
	/**
	* Resolve one or more path strings to a resolved string, returning
	* the posix path.  Identical to .resolve() on posix systems, but on
	* windows will return a forward-slash separated UNC path.
	*
	* Same interface as require('path').resolve.
	*
	* Much faster than path.resolve() when called multiple times for the same
	* path, because the resolved Path objects are cached.  Much slower
	* otherwise.
	*/
	resolvePosix(...paths) {
		let r = "";
		for (let i = paths.length - 1; i >= 0; i--) {
			const p = paths[i];
			if (!p || p === ".") continue;
			r = r ? `${p}/${r}` : p;
			if (this.isAbsolute(p)) break;
		}
		const cached = this.#resolvePosixCache.get(r);
		if (cached !== void 0) return cached;
		const result = this.cwd.resolve(r).fullpathPosix();
		this.#resolvePosixCache.set(r, result);
		return result;
	}
	/**
	* find the relative path from the cwd to the supplied path string or entry
	*/
	relative(entry = this.cwd) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		return entry.relative();
	}
	/**
	* find the relative path from the cwd to the supplied path string or
	* entry, using / as the path delimiter, even on Windows.
	*/
	relativePosix(entry = this.cwd) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		return entry.relativePosix();
	}
	/**
	* Return the basename for the provided string or Path object
	*/
	basename(entry = this.cwd) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		return entry.name;
	}
	/**
	* Return the dirname for the provided string or Path object
	*/
	dirname(entry = this.cwd) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		return (entry.parent || entry).fullpath();
	}
	async readdir(entry = this.cwd, opts = { withFileTypes: true }) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			opts = entry;
			entry = this.cwd;
		}
		const { withFileTypes } = opts;
		if (!entry.canReaddir()) return [];
		else {
			const p = await entry.readdir();
			return withFileTypes ? p : p.map((e) => e.name);
		}
	}
	readdirSync(entry = this.cwd, opts = { withFileTypes: true }) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			opts = entry;
			entry = this.cwd;
		}
		const { withFileTypes = true } = opts;
		if (!entry.canReaddir()) return [];
		else if (withFileTypes) return entry.readdirSync();
		else return entry.readdirSync().map((e) => e.name);
	}
	/**
	* Call lstat() on the string or Path object, and update all known
	* information that can be determined.
	*
	* Note that unlike `fs.lstat()`, the returned value does not contain some
	* information, such as `mode`, `dev`, `nlink`, and `ino`.  If that
	* information is required, you will need to call `fs.lstat` yourself.
	*
	* If the Path refers to a nonexistent file, or if the lstat call fails for
	* any reason, `undefined` is returned.  Otherwise the updated Path object is
	* returned.
	*
	* Results are cached, and thus may be out of date if the filesystem is
	* mutated.
	*/
	async lstat(entry = this.cwd) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		return entry.lstat();
	}
	/**
	* synchronous {@link PathScurryBase.lstat}
	*/
	lstatSync(entry = this.cwd) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		return entry.lstatSync();
	}
	async readlink(entry = this.cwd, { withFileTypes } = { withFileTypes: false }) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			withFileTypes = entry.withFileTypes;
			entry = this.cwd;
		}
		const e = await entry.readlink();
		return withFileTypes ? e : e?.fullpath();
	}
	readlinkSync(entry = this.cwd, { withFileTypes } = { withFileTypes: false }) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			withFileTypes = entry.withFileTypes;
			entry = this.cwd;
		}
		const e = entry.readlinkSync();
		return withFileTypes ? e : e?.fullpath();
	}
	async realpath(entry = this.cwd, { withFileTypes } = { withFileTypes: false }) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			withFileTypes = entry.withFileTypes;
			entry = this.cwd;
		}
		const e = await entry.realpath();
		return withFileTypes ? e : e?.fullpath();
	}
	realpathSync(entry = this.cwd, { withFileTypes } = { withFileTypes: false }) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			withFileTypes = entry.withFileTypes;
			entry = this.cwd;
		}
		const e = entry.realpathSync();
		return withFileTypes ? e : e?.fullpath();
	}
	async walk(entry = this.cwd, opts = {}) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			opts = entry;
			entry = this.cwd;
		}
		const { withFileTypes = true, follow = false, filter, walkFilter } = opts;
		const results = [];
		if (!filter || filter(entry)) results.push(withFileTypes ? entry : entry.fullpath());
		const dirs = /* @__PURE__ */ new Set();
		const walk = (dir, cb) => {
			dirs.add(dir);
			dir.readdirCB((er, entries) => {
				/* c8 ignore start */
				if (er) return cb(er);
				/* c8 ignore stop */
				let len = entries.length;
				if (!len) return cb();
				const next = () => {
					if (--len === 0) cb();
				};
				for (const e of entries) {
					if (!filter || filter(e)) results.push(withFileTypes ? e : e.fullpath());
					if (follow && e.isSymbolicLink()) e.realpath().then((r) => r?.isUnknown() ? r.lstat() : r).then((r) => r?.shouldWalk(dirs, walkFilter) ? walk(r, next) : next());
					else if (e.shouldWalk(dirs, walkFilter)) walk(e, next);
					else next();
				}
			}, true);
		};
		const start = entry;
		return new Promise((res, rej) => {
			walk(start, (er) => {
				/* c8 ignore start */
				if (er) return rej(er);
				/* c8 ignore stop */
				res(results);
			});
		});
	}
	walkSync(entry = this.cwd, opts = {}) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			opts = entry;
			entry = this.cwd;
		}
		const { withFileTypes = true, follow = false, filter, walkFilter } = opts;
		const results = [];
		if (!filter || filter(entry)) results.push(withFileTypes ? entry : entry.fullpath());
		const dirs = /* @__PURE__ */ new Set([entry]);
		for (const dir of dirs) {
			const entries = dir.readdirSync();
			for (const e of entries) {
				if (!filter || filter(e)) results.push(withFileTypes ? e : e.fullpath());
				let r = e;
				if (e.isSymbolicLink()) {
					if (!(follow && (r = e.realpathSync()))) continue;
					if (r.isUnknown()) r.lstatSync();
				}
				if (r.shouldWalk(dirs, walkFilter)) dirs.add(r);
			}
		}
		return results;
	}
	/**
	* Support for `for await`
	*
	* Alias for {@link PathScurryBase.iterate}
	*
	* Note: As of Node 19, this is very slow, compared to other methods of
	* walking.  Consider using {@link PathScurryBase.stream} if memory overhead
	* and backpressure are concerns, or {@link PathScurryBase.walk} if not.
	*/
	[Symbol.asyncIterator]() {
		return this.iterate();
	}
	iterate(entry = this.cwd, options = {}) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			options = entry;
			entry = this.cwd;
		}
		return this.stream(entry, options)[Symbol.asyncIterator]();
	}
	/**
	* Iterating over a PathScurry performs a synchronous walk.
	*
	* Alias for {@link PathScurryBase.iterateSync}
	*/
	[Symbol.iterator]() {
		return this.iterateSync();
	}
	*iterateSync(entry = this.cwd, opts = {}) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			opts = entry;
			entry = this.cwd;
		}
		const { withFileTypes = true, follow = false, filter, walkFilter } = opts;
		if (!filter || filter(entry)) yield withFileTypes ? entry : entry.fullpath();
		const dirs = /* @__PURE__ */ new Set([entry]);
		for (const dir of dirs) {
			const entries = dir.readdirSync();
			for (const e of entries) {
				if (!filter || filter(e)) yield withFileTypes ? e : e.fullpath();
				let r = e;
				if (e.isSymbolicLink()) {
					if (!(follow && (r = e.realpathSync()))) continue;
					if (r.isUnknown()) r.lstatSync();
				}
				if (r.shouldWalk(dirs, walkFilter)) dirs.add(r);
			}
		}
	}
	stream(entry = this.cwd, opts = {}) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			opts = entry;
			entry = this.cwd;
		}
		const { withFileTypes = true, follow = false, filter, walkFilter } = opts;
		const results = new Minipass({ objectMode: true });
		if (!filter || filter(entry)) results.write(withFileTypes ? entry : entry.fullpath());
		const dirs = /* @__PURE__ */ new Set();
		const queue = [entry];
		let processing = 0;
		const process = () => {
			let paused = false;
			while (!paused) {
				const dir = queue.shift();
				if (!dir) {
					if (processing === 0) results.end();
					return;
				}
				processing++;
				dirs.add(dir);
				const onReaddir = (er, entries, didRealpaths = false) => {
					/* c8 ignore start */
					if (er) return results.emit("error", er);
					/* c8 ignore stop */
					if (follow && !didRealpaths) {
						const promises = [];
						for (const e of entries) if (e.isSymbolicLink()) promises.push(e.realpath().then((r) => r?.isUnknown() ? r.lstat() : r));
						if (promises.length) {
							Promise.all(promises).then(() => onReaddir(null, entries, true));
							return;
						}
					}
					for (const e of entries) if (e && (!filter || filter(e))) {
						if (!results.write(withFileTypes ? e : e.fullpath())) paused = true;
					}
					processing--;
					for (const e of entries) {
						const r = e.realpathCached() || e;
						if (r.shouldWalk(dirs, walkFilter)) queue.push(r);
					}
					if (paused && !results.flowing) results.once("drain", process);
					else if (!sync) process();
				};
				let sync = true;
				dir.readdirCB(onReaddir, true);
				sync = false;
			}
		};
		process();
		return results;
	}
	streamSync(entry = this.cwd, opts = {}) {
		if (typeof entry === "string") entry = this.cwd.resolve(entry);
		else if (!(entry instanceof PathBase)) {
			opts = entry;
			entry = this.cwd;
		}
		const { withFileTypes = true, follow = false, filter, walkFilter } = opts;
		const results = new Minipass({ objectMode: true });
		const dirs = /* @__PURE__ */ new Set();
		if (!filter || filter(entry)) results.write(withFileTypes ? entry : entry.fullpath());
		const queue = [entry];
		let processing = 0;
		const process = () => {
			let paused = false;
			while (!paused) {
				const dir = queue.shift();
				if (!dir) {
					if (processing === 0) results.end();
					return;
				}
				processing++;
				dirs.add(dir);
				const entries = dir.readdirSync();
				for (const e of entries) if (!filter || filter(e)) {
					if (!results.write(withFileTypes ? e : e.fullpath())) paused = true;
				}
				processing--;
				for (const e of entries) {
					let r = e;
					if (e.isSymbolicLink()) {
						if (!(follow && (r = e.realpathSync()))) continue;
						if (r.isUnknown()) r.lstatSync();
					}
					if (r.shouldWalk(dirs, walkFilter)) queue.push(r);
				}
			}
			if (paused && !results.flowing) results.once("drain", process);
		};
		process();
		return results;
	}
	chdir(path = this.cwd) {
		const oldCwd = this.cwd;
		this.cwd = typeof path === "string" ? this.cwd.resolve(path) : path;
		this.cwd[setAsCwd](oldCwd);
	}
};
/**
* Windows implementation of {@link PathScurryBase}
*
* Defaults to case insensitve, uses `'\\'` to generate path strings.  Uses
* {@link PathWin32} for Path objects.
*/
var PathScurryWin32 = class extends PathScurryBase {
	/**
	* separator for generating path strings
	*/
	sep = "\\";
	constructor(cwd = process.cwd(), opts = {}) {
		const { nocase = true } = opts;
		super(cwd, win32, "\\", {
			...opts,
			nocase
		});
		this.nocase = nocase;
		for (let p = this.cwd; p; p = p.parent) p.nocase = this.nocase;
	}
	/**
	* @internal
	*/
	parseRootPath(dir) {
		return win32.parse(dir).root.toUpperCase();
	}
	/**
	* @internal
	*/
	newRoot(fs) {
		return new PathWin32(this.rootPath, IFDIR, void 0, this.roots, this.nocase, this.childrenCache(), { fs });
	}
	/**
	* Return true if the provided path string is an absolute path
	*/
	isAbsolute(p) {
		return p.startsWith("/") || p.startsWith("\\") || /^[a-z]:(\/|\\)/i.test(p);
	}
};
/**
* {@link PathScurryBase} implementation for all posix systems other than Darwin.
*
* Defaults to case-sensitive matching, uses `'/'` to generate path strings.
*
* Uses {@link PathPosix} for Path objects.
*/
var PathScurryPosix = class extends PathScurryBase {
	/**
	* separator for generating path strings
	*/
	sep = "/";
	constructor(cwd = process.cwd(), opts = {}) {
		const { nocase = false } = opts;
		super(cwd, posix, "/", {
			...opts,
			nocase
		});
		this.nocase = nocase;
	}
	/**
	* @internal
	*/
	parseRootPath(_dir) {
		return "/";
	}
	/**
	* @internal
	*/
	newRoot(fs) {
		return new PathPosix(this.rootPath, IFDIR, void 0, this.roots, this.nocase, this.childrenCache(), { fs });
	}
	/**
	* Return true if the provided path string is an absolute path
	*/
	isAbsolute(p) {
		return p.startsWith("/");
	}
};
/**
* {@link PathScurryBase} implementation for Darwin (macOS) systems.
*
* Defaults to case-insensitive matching, uses `'/'` for generating path
* strings.
*
* Uses {@link PathPosix} for Path objects.
*/
var PathScurryDarwin = class extends PathScurryPosix {
	constructor(cwd = process.cwd(), opts = {}) {
		const { nocase = true } = opts;
		super(cwd, {
			...opts,
			nocase
		});
	}
};
process.platform;
/**
* Default {@link PathScurryBase} implementation for the current platform.
*
* {@link PathScurryWin32} on Windows systems, {@link PathScurryDarwin} on
* Darwin (macOS) systems, {@link PathScurryPosix} on all others.
*/
const PathScurry = process.platform === "win32" ? PathScurryWin32 : process.platform === "darwin" ? PathScurryDarwin : PathScurryPosix;
//#endregion
//#region ../../node_modules/.pnpm/glob@13.0.0/node_modules/glob/dist/esm/pattern.js
const isPatternList = (pl) => pl.length >= 1;
const isGlobList = (gl) => gl.length >= 1;
/**
* An immutable-ish view on an array of glob parts and their parsed
* results
*/
var Pattern = class Pattern {
	#patternList;
	#globList;
	#index;
	length;
	#platform;
	#rest;
	#globString;
	#isDrive;
	#isUNC;
	#isAbsolute;
	#followGlobstar = true;
	constructor(patternList, globList, index, platform) {
		if (!isPatternList(patternList)) throw new TypeError("empty pattern list");
		if (!isGlobList(globList)) throw new TypeError("empty glob list");
		if (globList.length !== patternList.length) throw new TypeError("mismatched pattern list and glob list lengths");
		this.length = patternList.length;
		if (index < 0 || index >= this.length) throw new TypeError("index out of range");
		this.#patternList = patternList;
		this.#globList = globList;
		this.#index = index;
		this.#platform = platform;
		if (this.#index === 0) {
			if (this.isUNC()) {
				const [p0, p1, p2, p3, ...prest] = this.#patternList;
				const [g0, g1, g2, g3, ...grest] = this.#globList;
				if (prest[0] === "") {
					prest.shift();
					grest.shift();
				}
				const p = [
					p0,
					p1,
					p2,
					p3,
					""
				].join("/");
				const g = [
					g0,
					g1,
					g2,
					g3,
					""
				].join("/");
				this.#patternList = [p, ...prest];
				this.#globList = [g, ...grest];
				this.length = this.#patternList.length;
			} else if (this.isDrive() || this.isAbsolute()) {
				const [p1, ...prest] = this.#patternList;
				const [g1, ...grest] = this.#globList;
				if (prest[0] === "") {
					prest.shift();
					grest.shift();
				}
				const p = p1 + "/";
				const g = g1 + "/";
				this.#patternList = [p, ...prest];
				this.#globList = [g, ...grest];
				this.length = this.#patternList.length;
			}
		}
	}
	/**
	* The first entry in the parsed list of patterns
	*/
	pattern() {
		return this.#patternList[this.#index];
	}
	/**
	* true of if pattern() returns a string
	*/
	isString() {
		return typeof this.#patternList[this.#index] === "string";
	}
	/**
	* true of if pattern() returns GLOBSTAR
	*/
	isGlobstar() {
		return this.#patternList[this.#index] === GLOBSTAR;
	}
	/**
	* true if pattern() returns a regexp
	*/
	isRegExp() {
		return this.#patternList[this.#index] instanceof RegExp;
	}
	/**
	* The /-joined set of glob parts that make up this pattern
	*/
	globString() {
		return this.#globString = this.#globString || (this.#index === 0 ? this.isAbsolute() ? this.#globList[0] + this.#globList.slice(1).join("/") : this.#globList.join("/") : this.#globList.slice(this.#index).join("/"));
	}
	/**
	* true if there are more pattern parts after this one
	*/
	hasMore() {
		return this.length > this.#index + 1;
	}
	/**
	* The rest of the pattern after this part, or null if this is the end
	*/
	rest() {
		if (this.#rest !== void 0) return this.#rest;
		if (!this.hasMore()) return this.#rest = null;
		this.#rest = new Pattern(this.#patternList, this.#globList, this.#index + 1, this.#platform);
		this.#rest.#isAbsolute = this.#isAbsolute;
		this.#rest.#isUNC = this.#isUNC;
		this.#rest.#isDrive = this.#isDrive;
		return this.#rest;
	}
	/**
	* true if the pattern represents a //unc/path/ on windows
	*/
	isUNC() {
		const pl = this.#patternList;
		return this.#isUNC !== void 0 ? this.#isUNC : this.#isUNC = this.#platform === "win32" && this.#index === 0 && pl[0] === "" && pl[1] === "" && typeof pl[2] === "string" && !!pl[2] && typeof pl[3] === "string" && !!pl[3];
	}
	/**
	* True if the pattern starts with a drive letter on Windows
	*/
	isDrive() {
		const pl = this.#patternList;
		return this.#isDrive !== void 0 ? this.#isDrive : this.#isDrive = this.#platform === "win32" && this.#index === 0 && this.length > 1 && typeof pl[0] === "string" && /^[a-z]:$/i.test(pl[0]);
	}
	/**
	* True if the pattern is rooted on an absolute path
	*/
	isAbsolute() {
		const pl = this.#patternList;
		return this.#isAbsolute !== void 0 ? this.#isAbsolute : this.#isAbsolute = pl[0] === "" && pl.length > 1 || this.isDrive() || this.isUNC();
	}
	/**
	* consume the root of the pattern, and return it
	*/
	root() {
		const p = this.#patternList[0];
		return typeof p === "string" && this.isAbsolute() && this.#index === 0 ? p : "";
	}
	/**
	* Check to see if the current globstar pattern is allowed to follow
	* a symbolic link.
	*/
	checkFollowGlobstar() {
		return !(this.#index === 0 || !this.isGlobstar() || !this.#followGlobstar);
	}
	/**
	* Mark that the current globstar pattern is following a symbolic link
	*/
	markFollowGlobstar() {
		if (this.#index === 0 || !this.isGlobstar() || !this.#followGlobstar) return false;
		this.#followGlobstar = false;
		return true;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/glob@13.0.0/node_modules/glob/dist/esm/ignore.js
const defaultPlatform$1 = typeof process === "object" && process && typeof process.platform === "string" ? process.platform : "linux";
/**
* Class used to process ignored patterns
*/
var Ignore = class {
	relative;
	relativeChildren;
	absolute;
	absoluteChildren;
	platform;
	mmopts;
	constructor(ignored, { nobrace, nocase, noext, noglobstar, platform = defaultPlatform$1 }) {
		this.relative = [];
		this.absolute = [];
		this.relativeChildren = [];
		this.absoluteChildren = [];
		this.platform = platform;
		this.mmopts = {
			dot: true,
			nobrace,
			nocase,
			noext,
			noglobstar,
			optimizationLevel: 2,
			platform,
			nocomment: true,
			nonegate: true
		};
		for (const ign of ignored) this.add(ign);
	}
	add(ign) {
		const mm = new Minimatch(ign, this.mmopts);
		for (let i = 0; i < mm.set.length; i++) {
			const parsed = mm.set[i];
			const globParts = mm.globParts[i];
			/* c8 ignore start */
			if (!parsed || !globParts) throw new Error("invalid pattern object");
			while (parsed[0] === "." && globParts[0] === ".") {
				parsed.shift();
				globParts.shift();
			}
			/* c8 ignore stop */
			const p = new Pattern(parsed, globParts, 0, this.platform);
			const m = new Minimatch(p.globString(), this.mmopts);
			const children = globParts[globParts.length - 1] === "**";
			const absolute = p.isAbsolute();
			if (absolute) this.absolute.push(m);
			else this.relative.push(m);
			if (children) {
				if (absolute) this.absoluteChildren.push(m);
				else this.relativeChildren.push(m);
			}
		}
	}
	ignored(p) {
		const fullpath = p.fullpath();
		const fullpaths = `${fullpath}/`;
		const relative = p.relative() || ".";
		const relatives = `${relative}/`;
		for (const m of this.relative) if (m.match(relative) || m.match(relatives)) return true;
		for (const m of this.absolute) if (m.match(fullpath) || m.match(fullpaths)) return true;
		return false;
	}
	childrenIgnored(p) {
		const fullpath = p.fullpath() + "/";
		const relative = (p.relative() || ".") + "/";
		for (const m of this.relativeChildren) if (m.match(relative)) return true;
		for (const m of this.absoluteChildren) if (m.match(fullpath)) return true;
		return false;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/glob@13.0.0/node_modules/glob/dist/esm/processor.js
/**
* A cache of which patterns have been processed for a given Path
*/
var HasWalkedCache = class HasWalkedCache {
	store;
	constructor(store = /* @__PURE__ */ new Map()) {
		this.store = store;
	}
	copy() {
		return new HasWalkedCache(new Map(this.store));
	}
	hasWalked(target, pattern) {
		return this.store.get(target.fullpath())?.has(pattern.globString());
	}
	storeWalked(target, pattern) {
		const fullpath = target.fullpath();
		const cached = this.store.get(fullpath);
		if (cached) cached.add(pattern.globString());
		else this.store.set(fullpath, /* @__PURE__ */ new Set([pattern.globString()]));
	}
};
/**
* A record of which paths have been matched in a given walk step,
* and whether they only are considered a match if they are a directory,
* and whether their absolute or relative path should be returned.
*/
var MatchRecord = class {
	store = /* @__PURE__ */ new Map();
	add(target, absolute, ifDir) {
		const n = (absolute ? 2 : 0) | (ifDir ? 1 : 0);
		const current = this.store.get(target);
		this.store.set(target, current === void 0 ? n : n & current);
	}
	entries() {
		return [...this.store.entries()].map(([path, n]) => [
			path,
			!!(n & 2),
			!!(n & 1)
		]);
	}
};
/**
* A collection of patterns that must be processed in a subsequent step
* for a given path.
*/
var SubWalks = class {
	store = /* @__PURE__ */ new Map();
	add(target, pattern) {
		if (!target.canReaddir()) return;
		const subs = this.store.get(target);
		if (subs) {
			if (!subs.find((p) => p.globString() === pattern.globString())) subs.push(pattern);
		} else this.store.set(target, [pattern]);
	}
	get(target) {
		const subs = this.store.get(target);
		/* c8 ignore start */
		if (!subs) throw new Error("attempting to walk unknown path");
		/* c8 ignore stop */
		return subs;
	}
	entries() {
		return this.keys().map((k) => [k, this.store.get(k)]);
	}
	keys() {
		return [...this.store.keys()].filter((t) => t.canReaddir());
	}
};
/**
* The class that processes patterns for a given path.
*
* Handles child entry filtering, and determining whether a path's
* directory contents must be read.
*/
var Processor = class Processor {
	hasWalkedCache;
	matches = new MatchRecord();
	subwalks = new SubWalks();
	patterns;
	follow;
	dot;
	opts;
	constructor(opts, hasWalkedCache) {
		this.opts = opts;
		this.follow = !!opts.follow;
		this.dot = !!opts.dot;
		this.hasWalkedCache = hasWalkedCache ? hasWalkedCache.copy() : new HasWalkedCache();
	}
	processPatterns(target, patterns) {
		this.patterns = patterns;
		const processingSet = patterns.map((p) => [target, p]);
		for (let [t, pattern] of processingSet) {
			this.hasWalkedCache.storeWalked(t, pattern);
			const root = pattern.root();
			const absolute = pattern.isAbsolute() && this.opts.absolute !== false;
			if (root) {
				t = t.resolve(root === "/" && this.opts.root !== void 0 ? this.opts.root : root);
				const rest = pattern.rest();
				if (!rest) {
					this.matches.add(t, true, false);
					continue;
				} else pattern = rest;
			}
			if (t.isENOENT()) continue;
			let p;
			let rest;
			let changed = false;
			while (typeof (p = pattern.pattern()) === "string" && (rest = pattern.rest())) {
				t = t.resolve(p);
				pattern = rest;
				changed = true;
			}
			p = pattern.pattern();
			rest = pattern.rest();
			if (changed) {
				if (this.hasWalkedCache.hasWalked(t, pattern)) continue;
				this.hasWalkedCache.storeWalked(t, pattern);
			}
			if (typeof p === "string") {
				const ifDir = p === ".." || p === "" || p === ".";
				this.matches.add(t.resolve(p), absolute, ifDir);
				continue;
			} else if (p === GLOBSTAR) {
				if (!t.isSymbolicLink() || this.follow || pattern.checkFollowGlobstar()) this.subwalks.add(t, pattern);
				const rp = rest?.pattern();
				const rrest = rest?.rest();
				if (!rest || (rp === "" || rp === ".") && !rrest) this.matches.add(t, absolute, rp === "" || rp === ".");
				else if (rp === "..") {
					/* c8 ignore start */
					const tp = t.parent || t;
					/* c8 ignore stop */
					if (!rrest) this.matches.add(tp, absolute, true);
					else if (!this.hasWalkedCache.hasWalked(tp, rrest)) this.subwalks.add(tp, rrest);
				}
			} else if (p instanceof RegExp) this.subwalks.add(t, pattern);
		}
		return this;
	}
	subwalkTargets() {
		return this.subwalks.keys();
	}
	child() {
		return new Processor(this.opts, this.hasWalkedCache);
	}
	filterEntries(parent, entries) {
		const patterns = this.subwalks.get(parent);
		const results = this.child();
		for (const e of entries) for (const pattern of patterns) {
			const absolute = pattern.isAbsolute();
			const p = pattern.pattern();
			const rest = pattern.rest();
			if (p === GLOBSTAR) results.testGlobstar(e, pattern, rest, absolute);
			else if (p instanceof RegExp) results.testRegExp(e, p, rest, absolute);
			else results.testString(e, p, rest, absolute);
		}
		return results;
	}
	testGlobstar(e, pattern, rest, absolute) {
		if (this.dot || !e.name.startsWith(".")) {
			if (!pattern.hasMore()) this.matches.add(e, absolute, false);
			if (e.canReaddir()) {
				if (this.follow || !e.isSymbolicLink()) this.subwalks.add(e, pattern);
				else if (e.isSymbolicLink()) {
					if (rest && pattern.checkFollowGlobstar()) this.subwalks.add(e, rest);
					else if (pattern.markFollowGlobstar()) this.subwalks.add(e, pattern);
				}
			}
		}
		if (rest) {
			const rp = rest.pattern();
			if (typeof rp === "string" && rp !== ".." && rp !== "" && rp !== ".") this.testString(e, rp, rest.rest(), absolute);
			else if (rp === "..") {
				/* c8 ignore start */
				const ep = e.parent || e;
				/* c8 ignore stop */
				this.subwalks.add(ep, rest);
			} else if (rp instanceof RegExp) this.testRegExp(e, rp, rest.rest(), absolute);
		}
	}
	testRegExp(e, p, rest, absolute) {
		if (!p.test(e.name)) return;
		if (!rest) this.matches.add(e, absolute, false);
		else this.subwalks.add(e, rest);
	}
	testString(e, p, rest, absolute) {
		if (!e.isNamed(p)) return;
		if (!rest) this.matches.add(e, absolute, false);
		else this.subwalks.add(e, rest);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/glob@13.0.0/node_modules/glob/dist/esm/walker.js
/**
* Single-use utility classes to provide functionality to the {@link Glob}
* methods.
*
* @module
*/
const makeIgnore = (ignore, opts) => typeof ignore === "string" ? new Ignore([ignore], opts) : Array.isArray(ignore) ? new Ignore(ignore, opts) : ignore;
/**
* basic walking utilities that all the glob walker types use
*/
var GlobUtil = class {
	path;
	patterns;
	opts;
	seen = /* @__PURE__ */ new Set();
	paused = false;
	aborted = false;
	#onResume = [];
	#ignore;
	#sep;
	signal;
	maxDepth;
	includeChildMatches;
	constructor(patterns, path, opts) {
		this.patterns = patterns;
		this.path = path;
		this.opts = opts;
		this.#sep = !opts.posix && opts.platform === "win32" ? "\\" : "/";
		this.includeChildMatches = opts.includeChildMatches !== false;
		if (opts.ignore || !this.includeChildMatches) {
			this.#ignore = makeIgnore(opts.ignore ?? [], opts);
			if (!this.includeChildMatches && typeof this.#ignore.add !== "function") throw new Error("cannot ignore child matches, ignore lacks add() method.");
		}
		/* c8 ignore start */
		this.maxDepth = opts.maxDepth || Infinity;
		/* c8 ignore stop */
		if (opts.signal) {
			this.signal = opts.signal;
			this.signal.addEventListener("abort", () => {
				this.#onResume.length = 0;
			});
		}
	}
	#ignored(path) {
		return this.seen.has(path) || !!this.#ignore?.ignored?.(path);
	}
	#childrenIgnored(path) {
		return !!this.#ignore?.childrenIgnored?.(path);
	}
	pause() {
		this.paused = true;
	}
	resume() {
		/* c8 ignore start */
		if (this.signal?.aborted) return;
		/* c8 ignore stop */
		this.paused = false;
		let fn = void 0;
		while (!this.paused && (fn = this.#onResume.shift())) fn();
	}
	onResume(fn) {
		if (this.signal?.aborted) return;
		/* c8 ignore start */
		if (!this.paused) fn();
		else
 /* c8 ignore stop */
		this.#onResume.push(fn);
	}
	async matchCheck(e, ifDir) {
		if (ifDir && this.opts.nodir) return void 0;
		let rpc;
		if (this.opts.realpath) {
			rpc = e.realpathCached() || await e.realpath();
			if (!rpc) return void 0;
			e = rpc;
		}
		const s = e.isUnknown() || this.opts.stat ? await e.lstat() : e;
		if (this.opts.follow && this.opts.nodir && s?.isSymbolicLink()) {
			const target = await s.realpath();
			/* c8 ignore start */
			if (target && (target.isUnknown() || this.opts.stat)) await target.lstat();
		}
		return this.matchCheckTest(s, ifDir);
	}
	matchCheckTest(e, ifDir) {
		return e && (this.maxDepth === Infinity || e.depth() <= this.maxDepth) && (!ifDir || e.canReaddir()) && (!this.opts.nodir || !e.isDirectory()) && (!this.opts.nodir || !this.opts.follow || !e.isSymbolicLink() || !e.realpathCached()?.isDirectory()) && !this.#ignored(e) ? e : void 0;
	}
	matchCheckSync(e, ifDir) {
		if (ifDir && this.opts.nodir) return void 0;
		let rpc;
		if (this.opts.realpath) {
			rpc = e.realpathCached() || e.realpathSync();
			if (!rpc) return void 0;
			e = rpc;
		}
		const s = e.isUnknown() || this.opts.stat ? e.lstatSync() : e;
		if (this.opts.follow && this.opts.nodir && s?.isSymbolicLink()) {
			const target = s.realpathSync();
			if (target && (target?.isUnknown() || this.opts.stat)) target.lstatSync();
		}
		return this.matchCheckTest(s, ifDir);
	}
	matchFinish(e, absolute) {
		if (this.#ignored(e)) return;
		if (!this.includeChildMatches && this.#ignore?.add) {
			const ign = `${e.relativePosix()}/**`;
			this.#ignore.add(ign);
		}
		const abs = this.opts.absolute === void 0 ? absolute : this.opts.absolute;
		this.seen.add(e);
		const mark = this.opts.mark && e.isDirectory() ? this.#sep : "";
		if (this.opts.withFileTypes) this.matchEmit(e);
		else if (abs) {
			const abs = this.opts.posix ? e.fullpathPosix() : e.fullpath();
			this.matchEmit(abs + mark);
		} else {
			const rel = this.opts.posix ? e.relativePosix() : e.relative();
			const pre = this.opts.dotRelative && !rel.startsWith(".." + this.#sep) ? "." + this.#sep : "";
			this.matchEmit(!rel ? "." + mark : pre + rel + mark);
		}
	}
	async match(e, absolute, ifDir) {
		const p = await this.matchCheck(e, ifDir);
		if (p) this.matchFinish(p, absolute);
	}
	matchSync(e, absolute, ifDir) {
		const p = this.matchCheckSync(e, ifDir);
		if (p) this.matchFinish(p, absolute);
	}
	walkCB(target, patterns, cb) {
		/* c8 ignore start */
		if (this.signal?.aborted) cb();
		/* c8 ignore stop */
		this.walkCB2(target, patterns, new Processor(this.opts), cb);
	}
	walkCB2(target, patterns, processor, cb) {
		if (this.#childrenIgnored(target)) return cb();
		if (this.signal?.aborted) cb();
		if (this.paused) {
			this.onResume(() => this.walkCB2(target, patterns, processor, cb));
			return;
		}
		processor.processPatterns(target, patterns);
		let tasks = 1;
		const next = () => {
			if (--tasks === 0) cb();
		};
		for (const [m, absolute, ifDir] of processor.matches.entries()) {
			if (this.#ignored(m)) continue;
			tasks++;
			this.match(m, absolute, ifDir).then(() => next());
		}
		for (const t of processor.subwalkTargets()) {
			if (this.maxDepth !== Infinity && t.depth() >= this.maxDepth) continue;
			tasks++;
			const childrenCached = t.readdirCached();
			if (t.calledReaddir()) this.walkCB3(t, childrenCached, processor, next);
			else t.readdirCB((_, entries) => this.walkCB3(t, entries, processor, next), true);
		}
		next();
	}
	walkCB3(target, entries, processor, cb) {
		processor = processor.filterEntries(target, entries);
		let tasks = 1;
		const next = () => {
			if (--tasks === 0) cb();
		};
		for (const [m, absolute, ifDir] of processor.matches.entries()) {
			if (this.#ignored(m)) continue;
			tasks++;
			this.match(m, absolute, ifDir).then(() => next());
		}
		for (const [target, patterns] of processor.subwalks.entries()) {
			tasks++;
			this.walkCB2(target, patterns, processor.child(), next);
		}
		next();
	}
	walkCBSync(target, patterns, cb) {
		/* c8 ignore start */
		if (this.signal?.aborted) cb();
		/* c8 ignore stop */
		this.walkCB2Sync(target, patterns, new Processor(this.opts), cb);
	}
	walkCB2Sync(target, patterns, processor, cb) {
		if (this.#childrenIgnored(target)) return cb();
		if (this.signal?.aborted) cb();
		if (this.paused) {
			this.onResume(() => this.walkCB2Sync(target, patterns, processor, cb));
			return;
		}
		processor.processPatterns(target, patterns);
		let tasks = 1;
		const next = () => {
			if (--tasks === 0) cb();
		};
		for (const [m, absolute, ifDir] of processor.matches.entries()) {
			if (this.#ignored(m)) continue;
			this.matchSync(m, absolute, ifDir);
		}
		for (const t of processor.subwalkTargets()) {
			if (this.maxDepth !== Infinity && t.depth() >= this.maxDepth) continue;
			tasks++;
			const children = t.readdirSync();
			this.walkCB3Sync(t, children, processor, next);
		}
		next();
	}
	walkCB3Sync(target, entries, processor, cb) {
		processor = processor.filterEntries(target, entries);
		let tasks = 1;
		const next = () => {
			if (--tasks === 0) cb();
		};
		for (const [m, absolute, ifDir] of processor.matches.entries()) {
			if (this.#ignored(m)) continue;
			this.matchSync(m, absolute, ifDir);
		}
		for (const [target, patterns] of processor.subwalks.entries()) {
			tasks++;
			this.walkCB2Sync(target, patterns, processor.child(), next);
		}
		next();
	}
};
var GlobWalker = class extends GlobUtil {
	matches = /* @__PURE__ */ new Set();
	constructor(patterns, path, opts) {
		super(patterns, path, opts);
	}
	matchEmit(e) {
		this.matches.add(e);
	}
	async walk() {
		if (this.signal?.aborted) throw this.signal.reason;
		if (this.path.isUnknown()) await this.path.lstat();
		await new Promise((res, rej) => {
			this.walkCB(this.path, this.patterns, () => {
				if (this.signal?.aborted) rej(this.signal.reason);
				else res(this.matches);
			});
		});
		return this.matches;
	}
	walkSync() {
		if (this.signal?.aborted) throw this.signal.reason;
		if (this.path.isUnknown()) this.path.lstatSync();
		this.walkCBSync(this.path, this.patterns, () => {
			if (this.signal?.aborted) throw this.signal.reason;
		});
		return this.matches;
	}
};
var GlobStream = class extends GlobUtil {
	results;
	constructor(patterns, path, opts) {
		super(patterns, path, opts);
		this.results = new Minipass({
			signal: this.signal,
			objectMode: true
		});
		this.results.on("drain", () => this.resume());
		this.results.on("resume", () => this.resume());
	}
	matchEmit(e) {
		this.results.write(e);
		if (!this.results.flowing) this.pause();
	}
	stream() {
		const target = this.path;
		if (target.isUnknown()) target.lstat().then(() => {
			this.walkCB(target, this.patterns, () => this.results.end());
		});
		else this.walkCB(target, this.patterns, () => this.results.end());
		return this.results;
	}
	streamSync() {
		if (this.path.isUnknown()) this.path.lstatSync();
		this.walkCBSync(this.path, this.patterns, () => this.results.end());
		return this.results;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/glob@13.0.0/node_modules/glob/dist/esm/glob.js
const defaultPlatform = typeof process === "object" && process && typeof process.platform === "string" ? process.platform : "linux";
/**
* An object that can perform glob pattern traversals.
*/
var Glob = class {
	absolute;
	cwd;
	root;
	dot;
	dotRelative;
	follow;
	ignore;
	magicalBraces;
	mark;
	matchBase;
	maxDepth;
	nobrace;
	nocase;
	nodir;
	noext;
	noglobstar;
	pattern;
	platform;
	realpath;
	scurry;
	stat;
	signal;
	windowsPathsNoEscape;
	withFileTypes;
	includeChildMatches;
	/**
	* The options provided to the constructor.
	*/
	opts;
	/**
	* An array of parsed immutable {@link Pattern} objects.
	*/
	patterns;
	/**
	* All options are stored as properties on the `Glob` object.
	*
	* See {@link GlobOptions} for full options descriptions.
	*
	* Note that a previous `Glob` object can be passed as the
	* `GlobOptions` to another `Glob` instantiation to re-use settings
	* and caches with a new pattern.
	*
	* Traversal functions can be called multiple times to run the walk
	* again.
	*/
	constructor(pattern, opts) {
		/* c8 ignore start */
		if (!opts) throw new TypeError("glob options required");
		/* c8 ignore stop */
		this.withFileTypes = !!opts.withFileTypes;
		this.signal = opts.signal;
		this.follow = !!opts.follow;
		this.dot = !!opts.dot;
		this.dotRelative = !!opts.dotRelative;
		this.nodir = !!opts.nodir;
		this.mark = !!opts.mark;
		if (!opts.cwd) this.cwd = "";
		else if (opts.cwd instanceof URL || opts.cwd.startsWith("file://")) opts.cwd = fileURLToPath(opts.cwd);
		this.cwd = opts.cwd || "";
		this.root = opts.root;
		this.magicalBraces = !!opts.magicalBraces;
		this.nobrace = !!opts.nobrace;
		this.noext = !!opts.noext;
		this.realpath = !!opts.realpath;
		this.absolute = opts.absolute;
		this.includeChildMatches = opts.includeChildMatches !== false;
		this.noglobstar = !!opts.noglobstar;
		this.matchBase = !!opts.matchBase;
		this.maxDepth = typeof opts.maxDepth === "number" ? opts.maxDepth : Infinity;
		this.stat = !!opts.stat;
		this.ignore = opts.ignore;
		if (this.withFileTypes && this.absolute !== void 0) throw new Error("cannot set absolute and withFileTypes:true");
		if (typeof pattern === "string") pattern = [pattern];
		this.windowsPathsNoEscape = !!opts.windowsPathsNoEscape || opts.allowWindowsEscape === false;
		if (this.windowsPathsNoEscape) pattern = pattern.map((p) => p.replace(/\\/g, "/"));
		if (this.matchBase) {
			if (opts.noglobstar) throw new TypeError("base matching requires globstar");
			pattern = pattern.map((p) => p.includes("/") ? p : `./**/${p}`);
		}
		this.pattern = pattern;
		this.platform = opts.platform || defaultPlatform;
		this.opts = {
			...opts,
			platform: this.platform
		};
		if (opts.scurry) {
			this.scurry = opts.scurry;
			if (opts.nocase !== void 0 && opts.nocase !== opts.scurry.nocase) throw new Error("nocase option contradicts provided scurry option");
		} else {
			const Scurry = opts.platform === "win32" ? PathScurryWin32 : opts.platform === "darwin" ? PathScurryDarwin : opts.platform ? PathScurryPosix : PathScurry;
			this.scurry = new Scurry(this.cwd, {
				nocase: opts.nocase,
				fs: opts.fs
			});
		}
		this.nocase = this.scurry.nocase;
		const nocaseMagicOnly = this.platform === "darwin" || this.platform === "win32";
		const mmo = {
			...opts,
			dot: this.dot,
			matchBase: this.matchBase,
			nobrace: this.nobrace,
			nocase: this.nocase,
			nocaseMagicOnly,
			nocomment: true,
			noext: this.noext,
			nonegate: true,
			optimizationLevel: 2,
			platform: this.platform,
			windowsPathsNoEscape: this.windowsPathsNoEscape,
			debug: !!this.opts.debug
		};
		const [matchSet, globParts] = this.pattern.map((p) => new Minimatch(p, mmo)).reduce((set, m) => {
			set[0].push(...m.set);
			set[1].push(...m.globParts);
			return set;
		}, [[], []]);
		this.patterns = matchSet.map((set, i) => {
			const g = globParts[i];
			/* c8 ignore start */
			if (!g) throw new Error("invalid pattern object");
			/* c8 ignore stop */
			return new Pattern(set, g, 0, this.platform);
		});
	}
	async walk() {
		return [...await new GlobWalker(this.patterns, this.scurry.cwd, {
			...this.opts,
			maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
			platform: this.platform,
			nocase: this.nocase,
			includeChildMatches: this.includeChildMatches
		}).walk()];
	}
	walkSync() {
		return [...new GlobWalker(this.patterns, this.scurry.cwd, {
			...this.opts,
			maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
			platform: this.platform,
			nocase: this.nocase,
			includeChildMatches: this.includeChildMatches
		}).walkSync()];
	}
	stream() {
		return new GlobStream(this.patterns, this.scurry.cwd, {
			...this.opts,
			maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
			platform: this.platform,
			nocase: this.nocase,
			includeChildMatches: this.includeChildMatches
		}).stream();
	}
	streamSync() {
		return new GlobStream(this.patterns, this.scurry.cwd, {
			...this.opts,
			maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
			platform: this.platform,
			nocase: this.nocase,
			includeChildMatches: this.includeChildMatches
		}).streamSync();
	}
	/**
	* Default sync iteration function. Returns a Generator that
	* iterates over the results.
	*/
	iterateSync() {
		return this.streamSync()[Symbol.iterator]();
	}
	[Symbol.iterator]() {
		return this.iterateSync();
	}
	/**
	* Default async iteration function. Returns an AsyncGenerator that
	* iterates over the results.
	*/
	iterate() {
		return this.stream()[Symbol.asyncIterator]();
	}
	[Symbol.asyncIterator]() {
		return this.iterate();
	}
};
//#endregion
//#region ../../node_modules/.pnpm/glob@13.0.0/node_modules/glob/dist/esm/has-magic.js
/**
* Return true if the patterns provided contain any magic glob characters,
* given the options provided.
*
* Brace expansion is not considered "magic" unless the `magicalBraces` option
* is set, as brace expansion just turns one string into an array of strings.
* So a pattern like `'x{a,b}y'` would return `false`, because `'xay'` and
* `'xby'` both do not contain any magic glob characters, and it's treated the
* same as if you had called it on `['xay', 'xby']`. When `magicalBraces:true`
* is in the options, brace expansion _is_ treated as a pattern having magic.
*/
const hasMagic = (pattern, options = {}) => {
	if (!Array.isArray(pattern)) pattern = [pattern];
	for (const p of pattern) if (new Minimatch(p, options).hasMagic()) return true;
	return false;
};
//#endregion
//#region ../../node_modules/.pnpm/glob@13.0.0/node_modules/glob/dist/esm/index.js
function globStreamSync(pattern, options = {}) {
	return new Glob(pattern, options).streamSync();
}
function globStream(pattern, options = {}) {
	return new Glob(pattern, options).stream();
}
function globSync(pattern, options = {}) {
	return new Glob(pattern, options).walkSync();
}
async function glob_(pattern, options = {}) {
	return new Glob(pattern, options).walk();
}
function globIterateSync(pattern, options = {}) {
	return new Glob(pattern, options).iterateSync();
}
function globIterate(pattern, options = {}) {
	return new Glob(pattern, options).iterate();
}
const streamSync = globStreamSync;
const stream = Object.assign(globStream, { sync: globStreamSync });
const iterateSync = globIterateSync;
const iterate = Object.assign(globIterate, { sync: globIterateSync });
const sync = Object.assign(globSync, {
	stream: globStreamSync,
	iterate: globIterateSync
});
const glob = Object.assign(glob_, {
	glob: glob_,
	globSync,
	sync,
	globStream,
	stream,
	globStreamSync,
	streamSync,
	globIterate,
	iterate,
	globIterateSync,
	iterateSync,
	Glob,
	hasMagic,
	escape,
	unescape
});
glob.glob = glob;
//#endregion
//#region src/utils/workspace.ts
async function detectWorkspace$1(rootDir) {
	const bindingResult = await detectWorkspace(rootDir);
	const result = {
		rootDir,
		packageManager: void 0,
		packageManagerVersion: "latest",
		isMonorepo: false,
		monorepoScope: "",
		workspacePatterns: [],
		parentDirs: [],
		packages: []
	};
	if (bindingResult.packageManagerName) result.packageManager = bindingResult.packageManagerName;
	if (bindingResult.packageManagerVersion) result.packageManagerVersion = bindingResult.packageManagerVersion;
	if (bindingResult.isMonorepo) result.isMonorepo = bindingResult.isMonorepo;
	if (bindingResult.root) result.rootDir = bindingResult.root;
	if (result.isMonorepo) {
		const pnpmWorkspaceFile = path.join(result.rootDir, "pnpm-workspace.yaml");
		const packageJsonFile = path.join(result.rootDir, "package.json");
		if (fs.existsSync(pnpmWorkspaceFile)) {
			const workspaceConfig = readYamlFile(pnpmWorkspaceFile);
			if (Array.isArray(workspaceConfig.packages)) result.workspacePatterns = workspaceConfig.packages;
		} else if (fs.existsSync(packageJsonFile)) {
			const pkg = readJsonFile(packageJsonFile);
			if (Array.isArray(pkg.workspaces)) result.workspacePatterns = pkg.workspaces;
			else if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) result.workspacePatterns = pkg.workspaces.packages;
		}
		const dirs = /* @__PURE__ */ new Set();
		for (const pattern of result.workspacePatterns) {
			if (!pattern.endsWith("*")) continue;
			const dir = pattern.replace(/\/\*{1,2}$/, "");
			if (dir) dirs.add(dir);
		}
		result.parentDirs = Array.from(dirs).sort();
		const pkg = readJsonFile(packageJsonFile);
		if (pkg.name) result.monorepoScope = getScopeFromPackageName(pkg.name);
		result.packages = discoverWorkspacePackages(result.workspacePatterns, result.rootDir);
	}
	return result;
}
function isBingoTemplate(pkg) {
	return !!pkg.dependencies?.bingo;
}
function discoverWorkspacePackages(workspacePatterns, rootDir) {
	const packages = [];
	if (workspacePatterns.length === 0) return packages;
	const packageJsonRelativePaths = globSync(workspacePatterns.map((pattern) => `${pattern}/package.json`), {
		absolute: false,
		cwd: rootDir,
		ignore: ["**/node_modules/**"]
	});
	for (const packageJsonRelativePath of packageJsonRelativePaths) {
		const packageJsonPath = path.join(rootDir, packageJsonRelativePath);
		const pkg = readJsonFile(packageJsonPath);
		if (!pkg.name) continue;
		packages.push({
			name: pkg.name,
			path: path.dirname(packageJsonRelativePath).split(path.sep).join("/"),
			description: pkg.description,
			version: pkg.version
		});
	}
	return packages;
}
function updatePackageJsonWithDeps(rootDir, projectDir, dependencies, dependencyType) {
	const packageJsonPath = path.join(rootDir, projectDir, "package.json");
	editJsonFile(packageJsonPath, (pkg) => {
		if (!pkg[dependencyType]) pkg[dependencyType] = {};
		for (const dep of dependencies) pkg[dependencyType][dep] = "workspace:*";
		return pkg;
	});
}
function updateWorkspaceConfig(projectPath, workspaceInfo) {
	for (const pattern of workspaceInfo.workspacePatterns) if (minimatch(projectPath, pattern)) return;
	const parentDir = path.dirname(projectPath);
	const pattern = parentDir === "." ? projectPath : `${parentDir}/*`;
	if (workspaceInfo.packageManager === PackageManager.pnpm) editYamlFile(path.join(workspaceInfo.rootDir, "pnpm-workspace.yaml"), (doc) => {
		let packages = doc.getIn(["packages"]);
		if (!packages) packages = new import_dist.YAMLSeq();
		packages.add(new import_dist.Scalar(pattern));
		doc.setIn(["packages"], packages);
	});
	else editJsonFile(path.join(workspaceInfo.rootDir, "package.json"), (pkg) => {
		if (pkg.workspaces && !Array.isArray(pkg.workspaces)) pkg.workspaces.packages = [...pkg.workspaces.packages || [], pattern];
		else pkg.workspaces = [...pkg.workspaces || [], pattern];
		return pkg;
	});
}
//#endregion
//#region src/migration/migrator/catalog.ts
const BROWSER_PROVIDER_POSTINSTALL_PACKAGES = ["edgedriver", "geckodriver"];
const PUBLIC_PEER_DEPENDENCY_FALLBACKS = {
	vite: "*",
	vitest: "*"
};
const PNPM_MINIMUM_RELEASE_AGE_EXCLUDES = [
	"vite-plus",
	"@voidzero-dev/*",
	"oxlint",
	"@oxlint/*",
	"oxlint-tsgolint",
	"@oxlint-tsgolint/*",
	"oxfmt",
	"@oxfmt/*",
	...VITEST_AGE_GATE_EXEMPT_PACKAGES
];
function versionAtLeast(version, minVersion, tags) {
	const coerced = import_semver.default.coerce(version);
	if (coerced) return import_semver.default.gte(coerced, minVersion);
	return tags.includes(version);
}
const PNPM_WORKSPACE_SETTINGS_MIN_VERSION = "10.6.2";
function pnpmSupportsWorkspaceSettings(version) {
	return versionAtLeast(version, PNPM_WORKSPACE_SETTINGS_MIN_VERSION, ["latest", "next"]);
}
const PNPM_CATALOG_MIN_VERSION = "9.5.0";
function pnpmSupportsCatalog(version) {
	return versionAtLeast(version, PNPM_CATALOG_MIN_VERSION, ["latest", "next"]);
}
const YARN_CATALOG_MIN_VERSION = "4.10.0";
function yarnSupportsCatalog(version) {
	return versionAtLeast(version, YARN_CATALOG_MIN_VERSION, [
		"latest",
		"next",
		"stable"
	]);
}
function supportsCatalog(packageManager, version, isBunWorkspace = false) {
	switch (packageManager) {
		case PackageManager.pnpm: return pnpmSupportsCatalog(version);
		case PackageManager.yarn: return yarnSupportsCatalog(version);
		case PackageManager.bun: return isBunWorkspace;
		default: return false;
	}
}
const PNPM_WORKSPACE_SETTING_KEYS = [
	"allowNonAppliedPatches",
	"allowBuilds",
	"allowUnusedPatches",
	"allowedDeprecatedVersions",
	"auditConfig",
	"configDependencies",
	"executionEnv",
	"ignorePatchFailures",
	"ignoredBuiltDependencies",
	"ignoredOptionalDependencies",
	"neverBuiltDependencies",
	"onlyBuiltDependencies",
	"onlyBuiltDependenciesFile",
	"overrides",
	"packageExtensions",
	"patchedDependencies",
	"peerDependencyRules",
	"requiredScripts",
	"supportedArchitectures",
	"updateConfig"
];
function hasPnpmWorkspaceSettings(pkg) {
	return PNPM_WORKSPACE_SETTING_KEYS.some((key) => Object.hasOwn(pkg.pnpm ?? {}, key));
}
function pnpmPackageJsonSettingsPending(pkg) {
	return hasPnpmWorkspaceSettings(pkg) || pkg.pnpm !== void 0 && Object.keys(pkg.pnpm).length === 0;
}
function takePnpmWorkspaceSettings(pkg) {
	if (!pkg.pnpm) return;
	const settings = {};
	for (const key of PNPM_WORKSPACE_SETTING_KEYS) {
		if (!Object.hasOwn(pkg.pnpm, key)) continue;
		settings[key] = pkg.pnpm[key];
		delete pkg.pnpm[key];
	}
	if (Object.keys(pkg.pnpm).length === 0) delete pkg.pnpm;
	return Object.keys(settings).length > 0 ? settings : void 0;
}
/**
* Preserve workspace-level siblings while moving the effective package.json
* pnpm settings into pnpm-workspace.yaml. Package values win at scalar leaves,
* while objects merge recursively and arrays retain unique entries from both
* locations.
*/
function mergePnpmWorkspaceSetting(existing, incoming) {
	if (Array.isArray(existing) && Array.isArray(incoming)) {
		const seen = /* @__PURE__ */ new Set();
		return [...existing, ...incoming].filter((value) => {
			const key = JSON.stringify(value);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}
	if (isPlainRecord(existing) && isPlainRecord(incoming)) {
		const merged = { ...existing };
		for (const [key, value] of Object.entries(incoming)) merged[key] = Object.hasOwn(existing, key) ? mergePnpmWorkspaceSetting(existing[key], value) : value;
		return merged;
	}
	return incoming;
}
function migratePnpmSettingsToWorkspaceYaml(projectPath, settings) {
	if (!settings || Object.keys(settings).length === 0) return;
	const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
	if (!fs.existsSync(pnpmWorkspaceYamlPath)) fs.writeFileSync(pnpmWorkspaceYamlPath, "");
	editYamlFile(pnpmWorkspaceYamlPath, (doc) => {
		const workspace = doc.toJS() ?? {};
		for (const [key, value] of Object.entries(settings)) doc.set(key, doc.createNode(mergePnpmWorkspaceSetting(workspace[key], value)));
	});
}
/**
* Rewrite pnpm-workspace.yaml to add vite-plus dependencies
* @param projectPath - The path to the project
*/
function rewritePnpmWorkspaceYaml(projectPath, pnpmMajorVersion, shouldAllowBrowserBuilds, usesVitest, vitestEcosystemPackages, writeWorkspaceSettings = true, catalogAdditions = /* @__PURE__ */ new Set()) {
	const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
	if (!fs.existsSync(pnpmWorkspaceYamlPath)) fs.writeFileSync(pnpmWorkspaceYamlPath, "");
	const managed = managedOverridePackages(usesVitest);
	editYamlFile(pnpmWorkspaceYamlPath, (doc) => {
		const preferredCatalogSpec = rewriteCatalog(doc, usesVitest, vitestEcosystemPackages, catalogAdditions);
		if (!writeWorkspaceSettings) return;
		ensurePnpmExoticSubdepsSetting(doc);
		if (pnpmMajorVersion !== void 0) applyBuildAllowanceToWorkspaceYaml(doc, pnpmMajorVersion, shouldAllowBrowserBuilds);
		const overrides = doc.getIn(["overrides"]);
		pruneYamlMapLegacyWrapperAliases(overrides);
		if (overrides instanceof import_dist.YAMLMap) {
			const keysSnapshot = overrides.items.map((item) => item.key);
			for (const keyNode of keysSnapshot) if (shouldDropProviderOverrideKey(keyNode instanceof import_dist.Scalar ? String(keyNode.value ?? "") : String(keyNode ?? ""))) overrides.delete(keyNode);
		}
		if (!usesVitest) removeYamlMapVitestEntry(doc.getIn(["overrides"]), "pnpm-ranged");
		for (const key of Object.keys(managed)) {
			const overrideKey = pnpmOverrideKey(key);
			const version = getCatalogDependencySpec(getYamlMapScalarStringValue(overrides, overrideKey) ?? getYamlMapScalarStringValue(overrides, key), managed[key], true, { preferredCatalogSpec });
			if (overrides instanceof import_dist.YAMLMap) overrides.delete(key);
			doc.setIn(["overrides", scalarString(overrideKey)], scalarString(version));
		}
		const updatedOverrides = doc.getIn(["overrides"]);
		const updatedOverrideKeys = updatedOverrides.items.map((item) => item.key);
		for (const key of updatedOverrideKeys) if (key.value.includes(">")) {
			const splits = key.value.split(">");
			if (splits[splits.length - 1].trim() === "vite") updatedOverrides.delete(key);
		}
		const allowAnyNode = doc.getIn(["peerDependencyRules", "allowAny"]);
		let allowAny;
		if (allowAnyNode instanceof import_dist.YAMLSeq) allowAny = allowAnyNode;
		else {
			allowAny = new import_dist.YAMLSeq();
			if (typeof allowAnyNode === "string" && allowAnyNode.length > 0) allowAny.add(scalarString(allowAnyNode));
		}
		if (!usesVitest && VITEST_IS_MANAGED_OVERRIDE) allowAny.items = allowAny.items.filter((n) => n.value !== "vitest");
		const existing = new Set(allowAny.items.map((n) => n.value));
		for (const key of Object.keys(managed)) if (!existing.has(key)) allowAny.add(scalarString(key));
		doc.setIn(["peerDependencyRules", "allowAny"], allowAny);
		const allowedVersionsNode = doc.getIn(["peerDependencyRules", "allowedVersions"]);
		let allowedVersions;
		if (allowedVersionsNode instanceof import_dist.YAMLMap) allowedVersions = allowedVersionsNode;
		else allowedVersions = new import_dist.YAMLMap();
		if (!usesVitest) removeYamlMapVitestEntry(allowedVersions);
		for (const key of Object.keys(managed)) allowedVersions.set(scalarString(key), scalarString("*"));
		doc.setIn(["peerDependencyRules", "allowedVersions"], allowedVersions);
		if (doc.has("minimumReleaseAge")) {
			let minimumReleaseAgeExclude = doc.getIn(["minimumReleaseAgeExclude"]);
			if (!minimumReleaseAgeExclude) minimumReleaseAgeExclude = new import_dist.YAMLSeq();
			const existing = new Set(minimumReleaseAgeExclude.items.map((n) => n.value));
			for (const exclude of PNPM_MINIMUM_RELEASE_AGE_EXCLUDES) if (!existing.has(exclude)) minimumReleaseAgeExclude.add(scalarString(exclude));
			doc.setIn(["minimumReleaseAgeExclude"], minimumReleaseAgeExclude);
		}
	});
}
/**
* Move remaining non-Vite pnpm.overrides from package.json to pnpm-workspace.yaml.
* pnpm ignores workspace-level overrides when pnpm.overrides exists in package.json,
* so all overrides must live in pnpm-workspace.yaml.
*/
function migratePnpmOverridesToWorkspaceYaml(projectPath, overrides) {
	const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
	editYamlFile(pnpmWorkspaceYamlPath, (doc) => {
		for (const [key, value] of Object.entries(overrides)) doc.setIn(["overrides", scalarString(key)], scalarString(value));
	});
}
function applyBuildAllowanceToPackageJsonPnpm(pnpm, major, shouldAllow) {
	if (major >= 10) {
		if (shouldAllow) for (const name of BROWSER_PROVIDER_POSTINSTALL_PACKAGES) (pnpm.allowBuilds ??= {})[name] = true;
	} else if (shouldAllow) {
		const list = pnpm.onlyBuiltDependencies ?? [];
		const existing = new Set(list);
		for (const name of BROWSER_PROVIDER_POSTINSTALL_PACKAGES) if (!existing.has(name)) {
			list.push(name);
			existing.add(name);
		}
		pnpm.onlyBuiltDependencies = list;
	}
}
function applyBuildAllowanceToWorkspaceYaml(doc, major, shouldAllow) {
	if (major >= 10) {
		if (shouldAllow) {
			const existing = doc.getIn(["allowBuilds"]);
			const isNew = !(existing instanceof import_dist.YAMLMap);
			const allowBuilds = isNew ? new import_dist.YAMLMap() : existing;
			for (const name of BROWSER_PROVIDER_POSTINSTALL_PACKAGES) allowBuilds.set(scalarString(name), new import_dist.Scalar(true));
			if (isNew) doc.setIn(["allowBuilds"], allowBuilds);
		}
	} else if (shouldAllow) {
		let onlyBuiltDependencies = doc.getIn(["onlyBuiltDependencies"]);
		if (!(onlyBuiltDependencies instanceof import_dist.YAMLSeq)) onlyBuiltDependencies = new import_dist.YAMLSeq();
		const existing = new Set(onlyBuiltDependencies.items.map((n) => n.value));
		for (const name of BROWSER_PROVIDER_POSTINSTALL_PACKAGES) if (!existing.has(name)) onlyBuiltDependencies.add(scalarString(name));
		doc.setIn(["onlyBuiltDependencies"], onlyBuiltDependencies);
	}
}
/**
* Rewrite .yarnrc.yml to add vite-plus dependencies
* @param projectPath - The path to the project
*/
/**
* Rewrite catalog in pnpm-workspace.yaml or .yarnrc.yml
* @param doc - The document to rewrite
*/
function getCatalogDependencySpec(currentValue, version, supportCatalog, options) {
	if (options?.dependencyField === "peerDependencies") {
		if (currentValue?.startsWith("catalog:") && options.dependencyName) {
			const resolved = options.catalogDependencyResolver?.(currentValue, options.dependencyName);
			if (resolved && !isVitePlusOverrideSpec(resolved)) return resolved;
			return PUBLIC_PEER_DEPENDENCY_FALLBACKS[options.dependencyName] ?? currentValue;
		}
		return currentValue ?? version;
	}
	if (options?.dependencyField === "optionalDependencies" && options?.packageManager === PackageManager.yarn) return version;
	if (!supportCatalog || version.startsWith("file:")) return version;
	return currentValue?.startsWith("catalog:") ? currentValue : options?.preferredCatalogSpec ?? "catalog:";
}
/**
* #1932: under pnpm, an importer that depends on `vite-plus` (which bundles
* `vitest`) needs a DIRECT `vite` devDep pointing at @voidzero-dev/vite-plus-core
* so vitest's required `vite` peer binds to it. Without a direct edge, pnpm's
* `autoInstallPeers` fabricates a separate upstream `vite` to satisfy the
* peer, splitting vite-plus / vite / vitest into duplicate instances (the extra
* vite also lacks vite's `@voidzero-dev/vite-task-client` integration, breaking
* the `vp test` cache). Under a catalog the edge is a `catalog:` reference and
* the catalog entry carries the alias; the `vite@*` workspace override covers
* transitive and peer declarations instead of this one (see `pnpmOverrideKey`).
* npm/yarn/bun redirect transitive/peer vite via root overrides/resolutions (and
* drop the aliased vite), so this is pnpm-only, mirroring the bun root-package
* branch in `rewriteRootWorkspacePackageJson`.
*
* A package that already declares `vite` in ANY dependency field, including
* `peerDependencies` (e.g. a vite plugin pinning `vite ^6`), is left untouched
* so its existing version contract is preserved. Call this AFTER `vite-plus`
* has been ensured in the package, so the dependency check sees it.
*/
function ensureDirectViteForPnpm(pkg, packageManager, supportCatalog, catalogDependencyResolver) {
	const viteOverride = VITE_PLUS_OVERRIDE_PACKAGES.vite;
	if (packageManager !== PackageManager.pnpm || !viteOverride) return false;
	const dependsOnVitePlus = pkg.dependencies?.["vite-plus"] !== void 0 || pkg.devDependencies?.["vite-plus"] !== void 0;
	const viteAlreadyDirect = pkg.dependencies?.vite !== void 0 || pkg.devDependencies?.vite !== void 0 || pkg.optionalDependencies?.vite !== void 0 || pkg.peerDependencies?.vite !== void 0;
	if (!dependsOnVitePlus || viteAlreadyDirect) return false;
	setDirectViteEdge(pkg, supportCatalog, catalogDependencyResolver);
	return true;
}
/**
* Insert (or overwrite) a DIRECT `vite` devDependency edge in SORTED position.
*
* Several migration paths need a direct `vite` devDep for different reasons
* (pnpm peer binding #1932; bun peer pre-resolution oven-sh/bun#8406; npm
* `@vitest/mocker` hoisting for opt-in providers), but they all want the SAME
* spec and the SAME placement, so both are centralized here. Each caller keeps
* its OWN gate for WHEN a direct edge is needed; this owns only the spec +
* placement.
*
* - The spec is computed once from the `vite` override: under a catalog
*   (`supportCatalog`) it resolves to the preferred `catalog:` reference,
*   otherwise the concrete `npm:@voidzero-dev/vite-plus-core@<v>` alias (or the
*   `file:` tgz under force-override). A `catalog:` reference satisfies bun's
*   #8406 peer pre-resolution just as well as a concrete alias because catalog
*   refs resolve during the dependency-graph build (unlike overrides).
* - `vite` is inserted in SORTED position rather than appended: oxfmt sorts
*   package.json dependencies and `vp migrate` has no later format pass, so an
*   out-of-order key (e.g. `vite` after `vite-plus`) would fail a follow-up
*   `vp check`.
*/
function setDirectViteEdge(pkg, supportCatalog, catalogDependencyResolver) {
	const viteSpec = getCatalogDependencySpec(void 0, VITE_PLUS_OVERRIDE_PACKAGES.vite, supportCatalog, { preferredCatalogSpec: catalogDependencyResolver?.preferredCatalogSpec });
	const entries = Object.entries(pkg.devDependencies ?? {}).filter(([name]) => name !== "vite");
	const insertAt = entries.findIndex(([name]) => name > "vite");
	entries.splice(insertAt === -1 ? entries.length : insertAt, 0, ["vite", viteSpec]);
	const target = pkg.devDependencies ??= {};
	for (const key of Object.keys(target)) delete target[key];
	Object.assign(target, Object.fromEntries(entries));
}
function normalizeVitestPeerCatalogSpec(peerDependencies, catalogDependencyResolver) {
	if (!peerDependencies) return false;
	const current = peerDependencies.vitest;
	if (!current?.startsWith("catalog:")) return false;
	const normalized = getCatalogDependencySpec(current, VITEST_VERSION, true, {
		dependencyField: "peerDependencies",
		dependencyName: "vitest",
		catalogDependencyResolver
	});
	if (normalized === current) return false;
	peerDependencies.vitest = normalized;
	return true;
}
function isVitePlusOverrideSpec(value) {
	return Object.values(VITE_PLUS_OVERRIDE_PACKAGES).includes(value) || value.startsWith("npm:@voidzero-dev/vite-plus-");
}
function createCatalogDependencyResolver(projectPath, packageManager) {
	if (packageManager === PackageManager.pnpm) {
		const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
		if (!fs.existsSync(pnpmWorkspaceYamlPath)) return;
		const doc = readYamlFile(pnpmWorkspaceYamlPath);
		return createCatalogDependencyResolverFromCatalogs(doc?.catalog, doc?.catalogs);
	}
	if (packageManager === PackageManager.yarn) {
		const yarnrcYmlPath = path.join(projectPath, ".yarnrc.yml");
		if (!fs.existsSync(yarnrcYmlPath)) return;
		const doc = readYamlFile(yarnrcYmlPath);
		return createCatalogDependencyResolverFromCatalogs(doc?.catalog, doc?.catalogs);
	}
	if (packageManager === PackageManager.bun) {
		const packageJsonPath = path.join(projectPath, "package.json");
		if (!fs.existsSync(packageJsonPath)) return;
		return readBunCatalogDependencyResolver(readJsonFile(packageJsonPath));
	}
}
function createCatalogDependencyResolverFromCatalogs(catalog, catalogs) {
	const preferredCatalogSpec = selectPreferredCatalogSpec(catalog, catalogs);
	const resolver = (catalogSpec, dependencyName) => {
		const catalogName = catalogSpec.slice(8);
		if (catalogName && catalogName !== "default") return catalogs?.[catalogName]?.[dependencyName];
		return (catalog ?? catalogs?.default)?.[dependencyName];
	};
	return Object.assign(resolver, { preferredCatalogSpec });
}
function selectPreferredCatalogSpec(catalog, catalogs) {
	const candidates = [];
	if (catalog) candidates.push({
		spec: "catalog:",
		values: catalog
	});
	for (const [name, values] of Object.entries(catalogs ?? {})) candidates.push({
		spec: name === "default" ? "catalog:" : `catalog:${name}`,
		values
	});
	for (const dependencyName of [
		VITE_PLUS_NAME,
		"vite",
		"vitest"
	]) {
		const matching = candidates.find(({ values }) => Object.hasOwn(values, dependencyName));
		if (matching) return matching.spec;
	}
	if (catalog || catalogs?.default) return "catalog:";
	return "catalog:";
}
function getYamlMapScalarStringValue(map, key) {
	if (!(map instanceof import_dist.YAMLMap)) return;
	for (const item of map.items) if (item.key instanceof import_dist.Scalar && item.key.value === key && item.value instanceof import_dist.Scalar && typeof item.value.value === "string") return item.value.value;
}
/**
* Merge the managed override entries into a pnpm `overrides` record, under the
* range-qualified keys (see `pnpmOverrideKey`).
*
* Both writers of the package.json `pnpm.overrides` sink go through this
* helper: the standalone writer and the monorepo-root writer. That sink serves
* pnpm 9.5 to 10.6.1. The helper deletes a bare managed key that a pre-#2309
* migration left. Two keys for one package would restore the match that
* clobbers `catalog:` importer specs.
*
* A bare key's `catalog:` value moves to the ranged key, so a user's own
* `catalog:<name>` choice survives the re-keying. This mirrors
* `getCatalogDependencySpec`, which keeps a `catalog:` reference in the
* pnpm-workspace.yaml sink. A `file:` managed spec (force-override mode) always
* wins, because there is no catalog to resolve against in that mode.
*
* Force-override mode also appends the `vite-plus` pin, under a BARE key. The
* pin only exists in `file:` tgz mode, where migration writes the tgz spec
* straight into every manifest instead of a `catalog:` reference. In that mode
* there is no catalog provenance for a bare key to strip. This matches the
* workspace-yaml force-override path in `rewriteStandaloneProject`.
*/
function mergeManagedPnpmOverrides(overrides, managed) {
	const next = { ...overrides };
	for (const [dependencyName, managedSpec] of Object.entries(managed)) {
		const overrideKey = pnpmOverrideKey(dependencyName);
		const existing = next[overrideKey] ?? next[dependencyName];
		delete next[dependencyName];
		next[overrideKey] = existing?.startsWith("catalog:") && !managedSpec.startsWith("file:") ? existing : managedSpec;
	}
	if (isForceOverrideMode()) next[VITE_PLUS_NAME] = VITE_PLUS_VERSION;
	return next;
}
function pruneYamlMapLegacyWrapperAliases(map) {
	if (!(map instanceof import_dist.YAMLMap)) return;
	const stale = [];
	for (const item of map.items) {
		const value = item.value instanceof import_dist.Scalar ? item.value.value : void 0;
		if (typeof value === "string" && isLegacyWrapperSpec(value) && item.key instanceof import_dist.Scalar) stale.push({
			key: item.key,
			fallback: LEGACY_WRAPPER_FALLBACK_VERSIONS[item.key.value]
		});
	}
	for (const { key, fallback } of stale) if (fallback !== void 0) map.set(key, scalarString(fallback));
	else map.delete(key);
}
function rewriteCatalog(doc, usesVitest, vitestEcosystemPackages, catalogAdditions) {
	const parsed = doc.toJS();
	const preferredCatalogSpec = selectPreferredCatalogSpec(parsed?.catalog, parsed?.catalogs);
	const preferredCatalogName = preferredCatalogSpec.slice(8);
	const targetPath = preferredCatalogName && preferredCatalogName !== "default" ? ["catalogs", preferredCatalogName] : doc.has("catalog") || !doc.hasIn(["catalogs", "default"]) ? ["catalog"] : ["catalogs", "default"];
	rewriteYamlCatalogAtPath(doc, targetPath, true, usesVitest, vitestEcosystemPackages, catalogAdditions);
	if (targetPath[0] !== "catalog") rewriteYamlCatalogAtPath(doc, ["catalog"], false, usesVitest, vitestEcosystemPackages, catalogAdditions);
	const catalogs = doc.getIn(["catalogs"]);
	if (catalogs instanceof import_dist.YAMLMap) for (const item of catalogs.items) {
		const catalogName = item.key instanceof import_dist.Scalar ? item.key.value : void 0;
		if (typeof catalogName !== "string" || !(item.value instanceof import_dist.YAMLMap) || targetPath[0] === "catalogs" && targetPath[1] === catalogName) continue;
		rewriteYamlCatalogAtPath(doc, ["catalogs", catalogName], false, usesVitest, vitestEcosystemPackages, catalogAdditions);
	}
	return preferredCatalogSpec;
}
function rewriteYamlCatalogAtPath(doc, catalogPath, addMissing, usesVitest, vitestEcosystemPackages, catalogAdditions) {
	const managed = managedOverridePackages(usesVitest);
	let catalogNode = doc.getIn(catalogPath);
	if (!(catalogNode instanceof import_dist.YAMLMap)) {
		if (!addMissing) return;
		catalogNode = new import_dist.YAMLMap();
		doc.setIn(catalogPath, catalogNode);
	}
	const catalog = catalogNode;
	if (!usesVitest) removeYamlMapVitestEntry(catalog);
	for (const [key, value] of Object.entries(managed)) {
		if (value.startsWith("file:") || !addMissing && !catalog.has(key)) continue;
		catalog.set(scalarString(key), scalarString(value));
	}
	if (!VITE_PLUS_VERSION.startsWith("file:") && (addMissing || catalog.has("vite-plus"))) catalog.set(scalarString(VITE_PLUS_NAME), scalarString(VITE_PLUS_VERSION));
	if (addMissing && VITEST_IS_MANAGED_OVERRIDE) {
		const additions = catalog.has("vitest") ? /* @__PURE__ */ new Set([...catalogAdditions, ...vitestEcosystemPackages]) : catalogAdditions;
		for (const name of additions) if (isAlignableVitestEcosystemPackage(name)) catalog.set(scalarString(name), scalarString(VITEST_VERSION));
	}
	for (const name of REMOVE_PACKAGES) catalog.delete(name);
	pruneYamlMapLegacyWrapperAliases(catalog);
	rewriteVitestEcosystemYamlCatalog(catalog, vitestEcosystemPackages);
}
function rewriteVitestEcosystemYamlCatalog(catalog, vitestEcosystemPackages) {
	if (!VITEST_IS_MANAGED_OVERRIDE || !(catalog instanceof import_dist.YAMLMap)) return;
	for (const item of catalog.items) {
		const name = item.key instanceof import_dist.Scalar ? item.key.value : void 0;
		if (typeof name === "string" && vitestEcosystemPackages.has(name) && isAlignableVitestEcosystemPackage(name)) catalog.set(item.key, scalarString(VITEST_VERSION));
	}
}
function rewriteCatalogObject(catalog, addMissing, usesVitest, vitestEcosystemPackages) {
	const managed = managedOverridePackages(usesVitest);
	if (!usesVitest) removeManagedVitestEntry(catalog);
	for (const [key, value] of Object.entries(managed)) {
		if (value.startsWith("file:") || !addMissing && !(key in catalog)) continue;
		catalog[key] = value;
	}
	if (!VITE_PLUS_VERSION.startsWith("file:") && (addMissing || "vite-plus" in catalog)) catalog[VITE_PLUS_NAME] = VITE_PLUS_VERSION;
	for (const name of REMOVE_PACKAGES) delete catalog[name];
	if (VITEST_IS_MANAGED_OVERRIDE) {
		for (const name of Object.keys(catalog)) if (vitestEcosystemPackages.has(name) && isAlignableVitestEcosystemPackage(name)) catalog[name] = VITEST_VERSION;
	}
}
function rewriteCatalogsObject(catalogs, usesVitest, vitestEcosystemPackages) {
	for (const catalog of Object.values(catalogs)) rewriteCatalogObject(catalog, false, usesVitest, vitestEcosystemPackages);
}
/**
* Write catalog entries to root package.json for bun.
* Bun stores catalogs in package.json under the `catalog` key,
* unlike pnpm which uses pnpm-workspace.yaml.
* @see https://bun.sh/docs/pm/catalogs
*/
function rewriteBunCatalog(projectPath, usesVitest, vitestEcosystemPackages) {
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return;
	const managed = managedOverridePackages(usesVitest);
	editJsonFile(packageJsonPath, (pkg) => {
		const workspacesObj = pkg.workspaces && !Array.isArray(pkg.workspaces) ? pkg.workspaces : void 0;
		const useWorkspacesCatalog = workspacesObj?.catalog != null || pkg.catalog == null && workspacesObj?.catalogs != null;
		const catalog = { ...useWorkspacesCatalog ? workspacesObj?.catalog : pkg.catalog };
		rewriteCatalogObject(catalog, true, usesVitest, vitestEcosystemPackages);
		pruneLegacyWrapperAliases(catalog);
		if (useWorkspacesCatalog) {
			workspacesObj.catalog = catalog;
			if (pkg.catalog) {
				rewriteCatalogObject(pkg.catalog, false, usesVitest, vitestEcosystemPackages);
				pruneLegacyWrapperAliases(pkg.catalog);
			}
		} else {
			pkg.catalog = catalog;
			if (workspacesObj?.catalog) {
				rewriteCatalogObject(workspacesObj.catalog, false, usesVitest, vitestEcosystemPackages);
				pruneLegacyWrapperAliases(workspacesObj.catalog);
			}
		}
		if (workspacesObj?.catalogs) {
			rewriteCatalogsObject(workspacesObj.catalogs, usesVitest, vitestEcosystemPackages);
			for (const named of Object.values(workspacesObj.catalogs)) pruneLegacyWrapperAliases(named);
		}
		if (pkg.catalogs) {
			rewriteCatalogsObject(pkg.catalogs, usesVitest, vitestEcosystemPackages);
			for (const named of Object.values(pkg.catalogs)) pruneLegacyWrapperAliases(named);
		}
		const overrides = { ...pkg.overrides };
		pruneLegacyWrapperAliases(overrides);
		if (!usesVitest && typeof overrides.vitest === "string") removeManagedVitestEntry(overrides);
		for (const [key, value] of Object.entries(managed)) {
			const current = overrides[key];
			if (current !== void 0 && typeof current !== "string") continue;
			overrides[key] = getCatalogDependencySpec(current, value, true);
		}
		pkg.overrides = overrides;
		return pkg;
	});
}
/**
* Rewrite root workspace package.json to add vite-plus dependencies
* @param projectPath - The path to the project
*/
function rewriteRootWorkspacePackageJson(projectPath, packageManager, skipStagedMigration, catalogDependencyResolver, packages, pnpmMajorVersion, pnpmVersion, shouldAllowBrowserBuilds = false, workspaceUsesVitest = true, supportCatalog = true) {
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return;
	const managed = managedOverridePackages(workspaceUsesVitest);
	let movedPnpmSettings;
	editJsonFile(packageJsonPath, (pkg) => {
		pruneLegacyWrapperAliases(pkg.resolutions);
		pruneLegacyWrapperAliases(pkg.overrides);
		pruneLegacyWrapperAliases(pkg.pnpm?.overrides);
		dropRemovePackageOverrideKeys(pkg.resolutions);
		dropRemovePackageOverrideKeys(pkg.overrides);
		if (!workspaceUsesVitest) {
			removeManagedVitestEntry(pkg.resolutions);
			removeManagedVitestEntry(pkg.overrides);
		}
		if (packageManager === PackageManager.yarn) pkg.resolutions = {
			...pkg.resolutions,
			...managed
		};
		else if (packageManager === PackageManager.npm) pkg.overrides = {
			...pkg.overrides,
			...managed
		};
		else if (packageManager === PackageManager.bun) setDirectViteEdge(pkg, true, catalogDependencyResolver);
		else if (packageManager === PackageManager.pnpm) {
			const overrideKeys = Object.keys(managed);
			if (!pnpmSupportsWorkspaceSettings(pnpmVersion ?? "")) {
				dropRemovePackageOverrideKeys(pkg.pnpm?.overrides);
				if (!workspaceUsesVitest) removeManagedVitestEntry(pkg.pnpm?.overrides, "pnpm-ranged");
				if (!workspaceUsesVitest && pkg.pnpm?.peerDependencyRules) removeVitestPeerDependencyRule(pkg.pnpm.peerDependencyRules);
				pkg.pnpm = {
					...pkg.pnpm,
					overrides: mergeManagedPnpmOverrides(pkg.pnpm?.overrides, managed),
					peerDependencyRules: {
						...pkg.pnpm?.peerDependencyRules,
						allowAny: [.../* @__PURE__ */ new Set([...pkg.pnpm?.peerDependencyRules?.allowAny ?? [], ...overrideKeys])],
						allowedVersions: {
							...pkg.pnpm?.peerDependencyRules?.allowedVersions,
							...Object.fromEntries(overrideKeys.map((key) => [key, "*"]))
						}
					}
				};
			} else {
				for (const key of [...overrideKeys, ...PROVIDER_OVERRIDE_DROP_NAMES]) if (pkg.resolutions?.[key]) delete pkg.resolutions[key];
				movedPnpmSettings = takePnpmWorkspaceSettings(pkg);
			}
			for (const key in pkg.pnpm?.overrides) if (key.includes(">")) {
				const splits = key.split(">");
				if (splits[splits.length - 1].trim() === "vite") delete pkg.pnpm.overrides[key];
			}
			if (pnpmMajorVersion !== void 0 && pkg.pnpm) applyBuildAllowanceToPackageJsonPnpm(pkg.pnpm, pnpmMajorVersion, shouldAllowBrowserBuilds);
		}
		if (!hasDirectVitePlusInstallEntry(pkg)) pkg.devDependencies = {
			...pkg.devDependencies,
			[VITE_PLUS_NAME]: packageManager === PackageManager.npm || !supportCatalog || VITE_PLUS_VERSION.startsWith("file:") ? VITE_PLUS_VERSION : catalogDependencyResolver?.preferredCatalogSpec ?? "catalog:"
		};
		ensureDirectViteForPnpm(pkg, packageManager, supportCatalog, catalogDependencyResolver);
		return pkg;
	});
	migratePnpmSettingsToWorkspaceYaml(projectPath, movedPnpmSettings);
	rewriteMonorepoProject(projectPath, packageManager, skipStagedMigration, void 0, void 0, catalogDependencyResolver, packages ? {
		rootDir: projectPath,
		packages
	} : void 0, true, supportCatalog);
}
function readPnpmWorkspaceCatalogDependencyResolver(projectPath) {
	const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
	if (!fs.existsSync(pnpmWorkspaceYamlPath)) return;
	const doc = readYamlFile(pnpmWorkspaceYamlPath);
	return createCatalogDependencyResolverFromCatalogs(doc?.catalog, doc?.catalogs);
}
function readPnpmWorkspaceOverrides(projectPath) {
	const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
	if (!fs.existsSync(pnpmWorkspaceYamlPath)) return;
	return readYamlFile(pnpmWorkspaceYamlPath)?.overrides;
}
function pnpmWorkspaceMinimumReleaseAgeExemptionsPending(projectPath) {
	const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
	if (!fs.existsSync(pnpmWorkspaceYamlPath)) return false;
	const doc = readYamlFile(pnpmWorkspaceYamlPath);
	if (!doc || doc.minimumReleaseAge === void 0) return false;
	const existing = new Set(Array.isArray(doc.minimumReleaseAgeExclude) ? doc.minimumReleaseAgeExclude : []);
	return PNPM_MINIMUM_RELEASE_AGE_EXCLUDES.some((exclude) => !existing.has(exclude));
}
function readPnpmWorkspacePeerDependencyRules(projectPath) {
	const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
	if (!fs.existsSync(pnpmWorkspaceYamlPath)) return;
	return readYamlFile(pnpmWorkspaceYamlPath)?.peerDependencyRules;
}
function ensurePnpmWorkspacePackages(projectPath, workspacePatterns) {
	if (workspacePatterns.length === 0) return false;
	const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
	let changed = false;
	editYamlFile(pnpmWorkspaceYamlPath, (doc) => {
		if (doc.has("packages")) return;
		const packages = new import_dist.YAMLSeq();
		for (const pattern of workspacePatterns) packages.add(scalarString(pattern));
		doc.set("packages", packages);
		changed = true;
	});
	return changed;
}
function readBunCatalogDependencyResolver(pkg) {
	const workspacesObj = pkg.workspaces && !Array.isArray(pkg.workspaces) ? pkg.workspaces : {};
	const fromWorkspaces = createCatalogDependencyResolverFromCatalogs(workspacesObj.catalog, workspacesObj.catalogs);
	const fromPkg = createCatalogDependencyResolverFromCatalogs(pkg.catalog, pkg.catalogs);
	const resolver = (catalogSpec, dependencyName) => fromWorkspaces(catalogSpec, dependencyName) ?? fromPkg(catalogSpec, dependencyName);
	return Object.assign(resolver, { preferredCatalogSpec: workspacesObj.catalog || workspacesObj.catalogs ? fromWorkspaces.preferredCatalogSpec : fromPkg.preferredCatalogSpec });
}
//#endregion
//#region src/migration/migrator/yarn.ts
const WEBDRIVERIO_ALLOW_SIGNAL_DEPS = ["webdriverio", WEBDRIVERIO_PROVIDER];
function hasOwnWebdriverioDependency(pkg) {
	for (const name of WEBDRIVERIO_ALLOW_SIGNAL_DEPS) if (pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? pkg.optionalDependencies?.[name] ?? pkg.peerDependencies?.[name]) return true;
	return false;
}
function workspaceUsesWebdriverio(rootDir, packages) {
	const rootPkg = readPackageJsonIfExists(path.join(rootDir, "package.json"));
	if (rootPkg && hasOwnWebdriverioDependency(rootPkg)) return true;
	if (usesWebdriverioProvider(rootDir)) return true;
	if (!packages) return false;
	for (const pkg of packages) {
		const packageDir = path.join(rootDir, pkg.path);
		const subPkg = readPackageJsonIfExists(path.join(packageDir, "package.json"));
		if (subPkg && hasOwnWebdriverioDependency(subPkg)) return true;
		if (usesWebdriverioProvider(packageDir)) return true;
	}
	return false;
}
function readYarnrcValue(dir, key) {
	const yarnrcYmlPath = path.join(dir, ".yarnrc.yml");
	if (!fs.existsSync(yarnrcYmlPath)) return;
	try {
		const value = readYamlFile(yarnrcYmlPath)?.[key];
		return typeof value === "string" ? value : void 0;
	} catch {
		return;
	}
}
function resolveEffectiveYarnConfigValue(workspaceRootDir, key, envVar) {
	const fromEnv = process.env[envVar]?.trim();
	if (fromEnv) return fromEnv;
	let dir = path.resolve(workspaceRootDir);
	for (;;) {
		const value = readYarnrcValue(dir, key);
		if (value !== void 0) return value;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	const home = os.homedir();
	return home ? readYarnrcValue(home, key) : void 0;
}
/**
* Detect Yarn Plug'n'Play using the same precedence Yarn applies to
* `nodeLinker`. Yarn 2+ defaults to PnP when no value is configured, while
* Yarn Classic defaults to node_modules. Unknown/`latest` Yarn versions are
* treated as modern because that is the version `vp` will provision.
*/
function detectYarnPnpMode(projectPath, yarnVersion) {
	if (import_semver.default.coerce(yarnVersion)?.major === 1) return;
	const environmentLinker = process.env.YARN_NODE_LINKER?.trim();
	if (environmentLinker) return environmentLinker.toLowerCase() === "pnp" ? { source: "environment" } : void 0;
	const configuredLinker = resolveEffectiveYarnConfigValue(projectPath, "nodeLinker", "YARN_NODE_LINKER");
	if (configuredLinker) return configuredLinker.toLowerCase() === "pnp" ? { source: "configuration" } : void 0;
	return { source: "default" };
}
/** Set the project-local Yarn linker while preserving every other rc setting. */
function configureYarnNodeModulesMode(projectPath) {
	const yarnrcYmlPath = path.join(projectPath, ".yarnrc.yml");
	const before = fs.existsSync(yarnrcYmlPath) ? fs.readFileSync(yarnrcYmlPath, "utf8") : void 0;
	if (before === void 0) fs.writeFileSync(yarnrcYmlPath, "");
	editYamlFile(yarnrcYmlPath, (doc) => {
		doc.set("nodeLinker", "node-modules");
	});
	return before !== fs.readFileSync(yarnrcYmlPath, "utf8");
}
function dirIsWorkspaceRoot(dir) {
	const pkgJsonPath = path.join(dir, "package.json");
	if (!fs.existsSync(pkgJsonPath)) return false;
	try {
		return readJsonFile(pkgJsonPath).workspaces != null;
	} catch {
		return false;
	}
}
function findYarnWorkspaceHoisting(startDir) {
	let dir = path.resolve(startDir);
	for (;;) {
		if (dirIsWorkspaceRoot(dir)) return {
			rootDir: dir,
			limit: resolveEffectiveYarnConfigValue(dir, "nmHoistingLimits", "YARN_NM_HOISTING_LIMITS"),
			nodeLinker: resolveEffectiveYarnConfigValue(dir, "nodeLinker", "YARN_NODE_LINKER")
		};
		const parent = path.dirname(dir);
		if (parent === dir) return;
		dir = parent;
	}
}
function setYarnWorkspaceHoistingOptOut(pkg) {
	if (pkg.installConfig?.hoistingLimits !== void 0) return;
	pkg.installConfig = {
		...pkg.installConfig,
		hoistingLimits: "none"
	};
}
function applyYarnWorkspaceHoistingFix(pkg, rootLimit, nodeLinker, workspaceLabel, report) {
	if (nodeLinker !== "node-modules") return;
	if (rootLimit === "workspaces" && pkg.installConfig?.hoistingLimits === void 0) {
		setYarnWorkspaceHoistingOptOut(pkg);
		return;
	}
	const explicit = pkg.installConfig?.hoistingLimits;
	if (rootLimit === "dependencies" || explicit === "workspaces" || explicit === "dependencies") warnMigration(`Yarn workspace "${workspaceLabel}" isolates dependency hoisting (hoistingLimits: ${explicit ?? rootLimit}), so it keeps its own \`vitest\`/\`vite-plus\` copy and \`vp test\` may crash with a split \`@vitest/runner\`. Dedupe them to a single copy — relax this workspace's hoisting isolation or pin one \`vitest\` for the workspace.`, report);
}
function rewriteYarnrcYml(projectPath, usesVitest, vitestEcosystemPackages, catalogAdditions = /* @__PURE__ */ new Set(), supportCatalog) {
	const yarnrcYmlPath = path.join(projectPath, ".yarnrc.yml");
	if (!fs.existsSync(yarnrcYmlPath)) fs.writeFileSync(yarnrcYmlPath, "");
	editYamlFile(yarnrcYmlPath, (doc) => {
		if (!doc.has("nodeLinker")) doc.set("nodeLinker", "node-modules");
		let npmPreapprovedPackages = doc.getIn(["npmPreapprovedPackages"]);
		if (!npmPreapprovedPackages) npmPreapprovedPackages = new import_dist.YAMLSeq();
		const existingPreapproved = new Set(npmPreapprovedPackages.items.map((n) => n.value));
		for (const pkg of VITEST_AGE_GATE_EXEMPT_PACKAGES) if (!existingPreapproved.has(pkg)) npmPreapprovedPackages.add(scalarString(pkg));
		doc.setIn(["npmPreapprovedPackages"], npmPreapprovedPackages);
		if (supportCatalog) rewriteCatalog(doc, usesVitest, vitestEcosystemPackages, catalogAdditions);
	});
}
function yarnrcSatisfiesVitePlus(projectPath, usesVitest, supportCatalog) {
	const yarnrcYmlPath = path.join(projectPath, ".yarnrc.yml");
	if (!fs.existsSync(yarnrcYmlPath)) return false;
	const doc = readYamlFile(yarnrcYmlPath);
	if (!doc) return false;
	const preapproved = new Set(Array.isArray(doc.npmPreapprovedPackages) ? doc.npmPreapprovedPackages : []);
	const npmPreapprovedSatisfied = VITEST_AGE_GATE_EXEMPT_PACKAGES.every((pkg) => preapproved.has(pkg));
	if (!supportCatalog) return Object.hasOwn(doc, "nodeLinker") && npmPreapprovedSatisfied;
	const resolver = createCatalogDependencyResolverFromCatalogs(doc?.catalog, doc?.catalogs);
	const catalogName = resolver.preferredCatalogSpec.slice(8);
	const managedCatalog = catalogName && catalogName !== "default" ? doc?.catalogs?.[catalogName] : doc?.catalog ?? doc?.catalogs?.default;
	return Object.hasOwn(doc, "nodeLinker") && npmPreapprovedSatisfied && overridesSatisfyVitePlus(managedCatalog, usesVitest) && (VITE_PLUS_VERSION.startsWith("file:") || resolver(resolver.preferredCatalogSpec, "vite-plus") === VITE_PLUS_VERSION);
}
//#endregion
//#region src/migration/migrator/source-scan.ts
function workspaceUsesVitestDirectly(rootDir, packages, preserveNuxtVitestImports = true) {
	if (projectUsesVitestDirectly(rootDir, readPackageJsonIfExists(path.join(rootDir, "package.json")) ?? {}, void 0, preserveNuxtVitestImports)) return true;
	if (!packages) return false;
	for (const pkg of packages) {
		const packageDir = path.join(rootDir, pkg.path);
		if (projectUsesVitestDirectly(packageDir, readPackageJsonIfExists(path.join(packageDir, "package.json")) ?? {}, void 0, preserveNuxtVitestImports)) return true;
	}
	return false;
}
const VITEST_BROWSER_SPECIFIER_HINTS = [
	"vitest/browser",
	"vitest/plugins/browser",
	"@vitest/browser",
	"vite-plus/test/browser",
	"vite-plus/test/plugins/browser",
	"vite-plus/test/internal/browser",
	"vite-plus/test/client",
	"vite-plus/test/context",
	"vite-plus/test/locators",
	"vite-plus/test/matchers",
	"vite-plus/test/utils"
];
const WEBDRIVERIO_PROVIDER_SPECIFIER_HINTS = [
	"vitest/browser-webdriverio",
	"vitest/browser/providers/webdriverio",
	"vitest/plugins/browser-webdriverio",
	"@vitest/browser-webdriverio",
	"vite-plus/test/browser-webdriverio",
	"vite-plus/test/browser/providers/webdriverio",
	"vite-plus/test/plugins/browser-webdriverio"
];
const PLAYWRIGHT_PROVIDER_SPECIFIER_HINTS = [
	"vitest/browser-playwright",
	"vitest/browser/providers/playwright",
	"vitest/plugins/browser-playwright",
	"@vitest/browser-playwright",
	"vite-plus/test/browser-playwright",
	"vite-plus/test/browser/providers/playwright",
	"vite-plus/test/plugins/browser-playwright"
];
const BROWSER_PROVIDER_SPECIFIER_HINTS = {
	[WEBDRIVERIO_PROVIDER]: WEBDRIVERIO_PROVIDER_SPECIFIER_HINTS,
	[PLAYWRIGHT_PROVIDER]: PLAYWRIGHT_PROVIDER_SPECIFIER_HINTS
};
const VITEST_SCAN_EXTENSIONS = /* @__PURE__ */ new Set([
	".ts",
	".mts",
	".cts",
	".tsx",
	".js",
	".mjs",
	".cjs",
	".jsx"
]);
const VITEST_SCAN_SKIP_DIRS = /* @__PURE__ */ new Set([
	"node_modules",
	"dist",
	"build",
	"out",
	"coverage",
	".git",
	".next",
	".nuxt",
	".svelte-kit",
	".vite",
	".cache"
]);
/**
* Detect whether a package uses vitest's browser mode.
*
* Upstream `@vitest/browser` injects `optimizeDeps.include` entries of the form
* `vitest > expect-type` (and `vitest > @vitest/snapshot > magic-string`,
* `vitest > @vitest/expect > chai`). Vite resolves the leading `vitest` segment
* from the Vite config root, so `vitest` MUST be resolvable as a package from
* the consuming package's directory. In a pnpm strict (non-hoisted) layout,
* `vitest` pulled in only transitively via `vite-plus` is NOT reachable from the
* package root — the optimizer then fails with `Failed to resolve dependency`
* and the browser test page hangs forever.
*
* When this returns true the migration adds `vitest` as a direct
* devDependency so it is hoisted next to the package and the optimizer chain
* resolves. The signal is any of the package's TS/JS files (config, workspace
* config under any name, or test file) referencing `@vitest/browser*` or
* `vite-plus/test/browser*`. The scan recurses through the package directory
* (skipping `node_modules`, build output, VCS metadata) so browser config in a
* non-standard filename or browser imports in test files are all caught.
*
* Recursion stops at nested `package.json` boundaries: a workspace sub-package
* is a separate package that the migration scans on its own pass, so the root
* package must not inherit a browser-mode signal from a sub-package.
*/
function sourceTreeMatches(projectPath, matchesContent) {
	const scanDir = (dir, isRoot) => {
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return false;
		}
		if (!isRoot && entries.some((e) => e.isFile() && e.name === "package.json")) return false;
		for (const entry of entries) {
			const entryPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (VITEST_SCAN_SKIP_DIRS.has(entry.name)) continue;
				if (scanDir(entryPath, false)) return true;
			} else if (entry.isFile() && VITEST_SCAN_EXTENSIONS.has(path.extname(entry.name))) try {
				if (matchesContent(fs.readFileSync(entryPath, "utf8"))) return true;
			} catch {}
		}
		return false;
	};
	return scanDir(projectPath, true);
}
function sourceTreeReferencesAny(projectPath, hints) {
	return sourceTreeMatches(projectPath, (content) => hints.some((hint) => content.includes(hint)));
}
function findPackageTsconfigFiles(projectPath) {
	const files = [];
	const scanDir = (dir, isRoot) => {
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		if (!isRoot && entries.some((entry) => entry.isFile() && entry.name === "package.json")) return;
		for (const entry of entries) {
			const entryPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!VITEST_SCAN_SKIP_DIRS.has(entry.name)) scanDir(entryPath, false);
			} else if (entry.isFile() && /^tsconfig(?:\.[\w-]+)?\.json$/i.test(entry.name)) files.push(entryPath);
		}
	};
	scanDir(projectPath, true);
	return files;
}
function hasNuxtTestUtilsDependency(pkg) {
	return [
		pkg.dependencies,
		pkg.devDependencies,
		pkg.optionalDependencies
	].some((dependencies) => dependencies?.["@nuxt/test-utils"] !== void 0);
}
function sourceTreeReferencesRetainedVitestModule(projectPath) {
	return findPackageTsconfigFiles(projectPath).some(hasVitestTypesInTsconfig) || sourceTreeMatches(projectPath, (content) => {
		return /\bdeclare\s+module\s+['"]vitest(?:\/[^'"]*)?['"]/.test(content) || content.includes("vitest/package.json") || /\brequire\.resolve\s*\(\s*['"]vitest(?:\/[^'"]*)?['"]/.test(content) || /\bimport\.meta\.resolve\s*\(\s*['"]vitest(?:\/[^'"]*)?['"]/.test(content);
	});
}
function usesVitestBrowserMode(projectPath) {
	return sourceTreeReferencesAny(projectPath, VITEST_BROWSER_SPECIFIER_HINTS);
}
function usesWebdriverioProvider(projectPath) {
	return sourceTreeReferencesAny(projectPath, WEBDRIVERIO_PROVIDER_SPECIFIER_HINTS);
}
function collectProviderSourceModes(projectPath) {
	const modes = {};
	for (const provider of OPT_IN_BROWSER_PROVIDERS) modes[provider] = sourceTreeReferencesAny(projectPath, BROWSER_PROVIDER_SPECIFIER_HINTS[provider]);
	return modes;
}
//#endregion
//#region src/migration/migrator/vite-plus-bootstrap.ts
function bunWorkspaceDeclaresPackages(workspaces) {
	if (Array.isArray(workspaces)) return workspaces.length > 0;
	if (workspaces && typeof workspaces === "object") return Array.isArray(workspaces.packages) && workspaces.packages.length > 0;
	return false;
}
function isSemanticVitePlusOverrideSpec(dependencyName, spec) {
	if (!spec) return false;
	if (isLegacyWrapperSpec(spec)) return false;
	if (spec === VITE_PLUS_OVERRIDE_PACKAGES[dependencyName]) return true;
	return false;
}
function overrideSpecSatisfiesVitePlus(dependencyName, spec, catalogDependencyResolver) {
	if (!spec) return false;
	if (isSemanticVitePlusOverrideSpec(dependencyName, spec)) return true;
	if (!spec.startsWith("catalog:")) return false;
	return isSemanticVitePlusOverrideSpec(dependencyName, catalogDependencyResolver?.(spec, dependencyName));
}
function overridesSatisfyVitePlus(overrides, usesVitest, catalogDependencyResolver, keyStyle = "bare") {
	const managed = managedOverridePackages(usesVitest);
	if (!usesVitest && VITEST_IS_MANAGED_OVERRIDE && (typeof overrides?.vitest === "string" || keyStyle === "pnpm-ranged" && typeof overrides?.[pnpmOverrideKey("vitest")] === "string")) return false;
	if (keyStyle === "pnpm-ranged" && Object.keys(managed).some((dependencyName) => typeof overrides?.[dependencyName] === "string")) return false;
	return Object.keys(managed).every((dependencyName) => overrideSpecSatisfiesVitePlus(dependencyName, overrides?.[managedOverrideKey(dependencyName, keyStyle)], catalogDependencyResolver));
}
function hasPackageManagerPin(pkg) {
	return Boolean(pkg.packageManager || pkg.devEngines?.packageManager);
}
function pinnedPackageManagerVersion(pkg) {
	if (typeof pkg.packageManager === "string") {
		const separator = pkg.packageManager.indexOf("@");
		if (separator !== -1) return pkg.packageManager.slice(separator + 1);
	}
	const devEngine = pkg.devEngines?.packageManager;
	if (typeof devEngine === "object" && devEngine !== null && !Array.isArray(devEngine) && "version" in devEngine && typeof devEngine.version === "string") return devEngine.version;
}
function vitePlusDependencyNeedsConcreteVersion(pkg) {
	return [
		pkg.devDependencies,
		pkg.dependencies,
		pkg.optionalDependencies
	].some((dependencies) => dependencies?.["vite-plus"]?.startsWith("catalog:") ?? false);
}
function catalogVitePlusDependencyPending(pkg, catalogDependencyResolver) {
	return [
		pkg.devDependencies,
		pkg.dependencies,
		pkg.optionalDependencies
	].some((dependencies) => {
		const spec = dependencies?.[VITE_PLUS_NAME];
		if (!spec?.startsWith("catalog:")) return false;
		return catalogDependencyResolver?.(spec, VITE_PLUS_NAME) !== VITE_PLUS_VERSION;
	});
}
function pnpmPeerDependencyRulesSatisfyVitePlus(peerDependencyRules, usesVitest) {
	const allowAny = new Set(peerDependencyRules?.allowAny ?? []);
	const allowedVersions = peerDependencyRules?.allowedVersions ?? {};
	if (!usesVitest && VITEST_IS_MANAGED_OVERRIDE && (allowAny.has("vitest") || allowedVersions.vitest !== void 0)) return false;
	return Object.keys(managedOverridePackages(usesVitest)).every((key) => allowAny.has(key) && allowedVersions[key] === "*");
}
function npmVitePlusManagedDependenciesPending(pkg, usesVitest) {
	const dependencyGroups = [
		pkg.devDependencies,
		pkg.dependencies,
		pkg.optionalDependencies
	];
	if (!usesVitest && VITEST_IS_MANAGED_OVERRIDE && dependencyGroups.some((dependencies) => dependencies?.vitest !== void 0)) return true;
	return Object.keys(managedOverridePackages(usesVitest)).some((dependencyName) => dependencyGroups.some((dependencies) => dependencies?.[dependencyName] !== void 0 && !overrideSpecSatisfiesVitePlus(dependencyName, dependencies[dependencyName])));
}
function forceOverrideUsesExoticPnpmSpec() {
	if (!isForceOverrideMode()) return false;
	return [VITE_PLUS_VERSION, ...Object.values(VITE_PLUS_OVERRIDE_PACKAGES)].some((spec) => /^(?:file|https?):/.test(spec));
}
function pnpmWorkspaceExoticSubdepsSettingSatisfied(projectPath) {
	if (!forceOverrideUsesExoticPnpmSpec()) return true;
	const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
	if (!fs.existsSync(pnpmWorkspaceYamlPath)) return false;
	return readYamlFile(pnpmWorkspaceYamlPath)?.blockExoticSubdeps === false;
}
function ensurePnpmExoticSubdepsSetting(doc) {
	if (!forceOverrideUsesExoticPnpmSpec() || doc.get("blockExoticSubdeps") === false) return false;
	doc.set("blockExoticSubdeps", false);
	return true;
}
function ensurePnpmWorkspaceExoticSubdepsSetting(projectPath) {
	if (!forceOverrideUsesExoticPnpmSpec()) return false;
	const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
	if (!fs.existsSync(pnpmWorkspaceYamlPath)) fs.writeFileSync(pnpmWorkspaceYamlPath, "");
	let changed = false;
	editYamlFile(pnpmWorkspaceYamlPath, (doc) => {
		changed = ensurePnpmExoticSubdepsSetting(doc);
	});
	return changed;
}
/**
* Reconcile the install dependencies in one package during an existing-Vite+
* bootstrap. Package-manager overrides are intentionally handled separately at
* the workspace root; this function owns only dependency fields so it can also
* be applied to every workspace package.
*/
function reconcileVitePlusBootstrapPackage(projectPath, pkg, vitePlusVersion, packageManager, supportCatalog, ensureVitePlus, catalogDependencyResolver, providerCatalogAdditions = /* @__PURE__ */ new Set()) {
	const before = JSON.stringify(pkg);
	const usesVitest = projectUsesVitestDirectly(projectPath, pkg, void 0, true);
	ensureVitePlusDependencySpecs(pkg, vitePlusVersion, ensureVitePlus);
	const installGroups = [
		pkg.devDependencies,
		pkg.dependencies,
		pkg.optionalDependencies
	];
	const dependencyGroups = [...installGroups, pkg.peerDependencies];
	for (const dependencies of dependencyGroups) pruneLegacyWrapperAliases(dependencies);
	for (const dependencies of installGroups) if (dependencies?.vite !== void 0) dependencies.vite = getCatalogDependencySpec(dependencies.vite, VITE_PLUS_OVERRIDE_PACKAGES.vite, supportCatalog, { preferredCatalogSpec: catalogDependencyResolver?.preferredCatalogSpec });
	alignVitestEcosystemPackages(pkg, packageManager, supportCatalog, catalogDependencyResolver);
	normalizeVitestPeerCatalogSpec(pkg.peerDependencies, catalogDependencyResolver);
	const providerSourceModes = collectProviderSourceModes(projectPath);
	let usesAnyOptInProvider = false;
	for (const provider of OPT_IN_BROWSER_PROVIDERS) {
		if (!(providerSourceModes[provider] || dependencyGroups.some((dependencies) => dependencies?.[provider] !== void 0))) continue;
		usesAnyOptInProvider = true;
		const installGroupEntry = [
			{
				dependencyField: "devDependencies",
				dependencies: pkg.devDependencies
			},
			{
				dependencyField: "dependencies",
				dependencies: pkg.dependencies
			},
			{
				dependencyField: "optionalDependencies",
				dependencies: pkg.optionalDependencies
			}
		].find(({ dependencies }) => dependencies?.[provider] !== void 0);
		if (installGroupEntry?.dependencies) {
			if (VITEST_IS_MANAGED_OVERRIDE) installGroupEntry.dependencies[provider] = getAlignedVitestEcosystemDependencySpec(installGroupEntry.dependencies[provider], provider, installGroupEntry.dependencyField, packageManager, providerCatalogAdditions.has(provider) ? supportCatalog && packageManager !== PackageManager.bun : supportCatalog, catalogDependencyResolver);
		} else {
			pkg.devDependencies ??= {};
			pkg.devDependencies[provider] = getCatalogDependencySpec(void 0, VITEST_VERSION, supportCatalog && packageManager !== PackageManager.bun, { preferredCatalogSpec: catalogDependencyResolver?.preferredCatalogSpec });
		}
		const frameworkPeer = BROWSER_PROVIDER_PEER_DEPS[provider];
		const frameworkPresent = dependencyGroups.some((dependencies) => dependencies?.[frameworkPeer] !== void 0);
		if (frameworkPeer && !frameworkPresent) {
			pkg.devDependencies ??= {};
			pkg.devDependencies[frameworkPeer] = resolveProviderPeerSpec(pkg, frameworkPeer, supportCatalog, catalogDependencyResolver);
		}
	}
	for (const bundledPackage of REMOVE_PACKAGES) for (const dependencies of installGroups) if (dependencies?.[bundledPackage] !== void 0) delete dependencies[bundledPackage];
	if (usesAnyOptInProvider && packageManager === PackageManager.npm) {
		if (!installGroups.some((dependencies) => dependencies?.vite !== void 0)) setDirectViteEdge(pkg, supportCatalog, catalogDependencyResolver);
	}
	if (packageManager === PackageManager.bun) {
		const needsDirectVite = hasDirectVitePlusInstallEntry(pkg) || usesVitest || usesAnyOptInProvider;
		const viteAlreadyDirect = installGroups.some((dependencies) => dependencies?.vite !== void 0);
		if (needsDirectVite && !viteAlreadyDirect) setDirectViteEdge(pkg, supportCatalog, catalogDependencyResolver);
	}
	if (usesVitest) {
		const existingGroup = installGroups.find((dependencies) => dependencies?.vitest !== void 0);
		if (existingGroup) {
			if (VITEST_IS_MANAGED_OVERRIDE) existingGroup.vitest = getCatalogDependencySpec(existingGroup.vitest, VITEST_VERSION, supportCatalog, { preferredCatalogSpec: catalogDependencyResolver?.preferredCatalogSpec });
		} else {
			pkg.devDependencies ??= {};
			pkg.devDependencies.vitest = getCatalogDependencySpec(void 0, VITEST_VERSION, supportCatalog, { preferredCatalogSpec: catalogDependencyResolver?.preferredCatalogSpec });
		}
	} else for (const dependencies of installGroups) removeManagedVitestEntry(dependencies);
	ensureDirectViteForPnpm(pkg, packageManager, supportCatalog, catalogDependencyResolver);
	return before !== JSON.stringify(pkg);
}
function bootstrapProjectPaths(rootDir, packages) {
	return [rootDir, ...(packages ?? []).map((pkg) => path.join(rootDir, pkg.path))];
}
function collectInjectedProviderNames(rootDir, packages, precomputedSourceModes) {
	const names = /* @__PURE__ */ new Set();
	for (const packagePath of bootstrapProjectPaths(rootDir, packages)) {
		const packageJsonPath = path.join(packagePath, "package.json");
		if (!fs.existsSync(packageJsonPath)) continue;
		const pkg = readJsonFile(packageJsonPath);
		const sourceModes = precomputedSourceModes?.get(packagePath) ?? collectProviderSourceModes(packagePath);
		const installGroups = [
			pkg.devDependencies,
			pkg.dependencies,
			pkg.optionalDependencies
		];
		const dependencyGroups = [...installGroups, pkg.peerDependencies];
		for (const provider of OPT_IN_BROWSER_PROVIDERS) {
			const used = sourceModes[provider] || dependencyGroups.some((dependencies) => dependencies?.[provider] !== void 0);
			const installed = installGroups.some((dependencies) => dependencies?.[provider] !== void 0);
			if (used && !installed) names.add(provider);
		}
	}
	return names;
}
function someBootstrapProjectPackageJson(rootDir, packages, predicate) {
	return bootstrapProjectPaths(rootDir, packages).some((packagePath) => {
		const packageJsonPath = path.join(packagePath, "package.json");
		if (!fs.existsSync(packageJsonPath)) return false;
		return predicate(readJsonFile(packageJsonPath));
	});
}
function workspaceVitestEcosystemCatalogReferencesPending(rootDir, packages, catalogDependencyResolver) {
	return someBootstrapProjectPackageJson(rootDir, packages, (pkg) => vitestEcosystemCatalogReferencesPending(pkg, catalogDependencyResolver));
}
function workspaceCatalogVitePlusDependencyPending(rootDir, packages, catalogDependencyResolver) {
	return someBootstrapProjectPackageJson(rootDir, packages, (pkg) => catalogVitePlusDependencyPending(pkg, catalogDependencyResolver));
}
function yarnWorkspaceHoistingOptOutPending(rootDir, packageManager, packages) {
	if (packageManager !== PackageManager.yarn || !packages?.length) return false;
	const hoisting = findYarnWorkspaceHoisting(rootDir);
	if (!hoisting || hoisting.nodeLinker !== "node-modules" || hoisting.limit !== "workspaces") return false;
	return packages.some((workspacePackage) => {
		const packagePath = path.join(rootDir, workspacePackage.path);
		if (path.resolve(packagePath) === hoisting.rootDir) return false;
		const childPackageJsonPath = path.join(packagePath, "package.json");
		if (!fs.existsSync(childPackageJsonPath)) return false;
		const childPkg = readJsonFile(childPackageJsonPath);
		return hasDirectVitePlusInstallEntry(childPkg) && childPkg.installConfig?.hoistingLimits === void 0;
	});
}
function detectVitePlusBootstrapPending(projectPath, packageManager, packages, packageManagerVersion) {
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return false;
	const pkg = readJsonFile(packageJsonPath);
	if (!hasDirectVitePlusInstallEntry(pkg) || !hasPackageManagerPin(pkg)) return true;
	if (packageManager === void 0) return true;
	const resolvedPackageManagerVersion = packageManagerVersion ?? pinnedPackageManagerVersion(pkg) ?? "";
	const usePnpmWorkspaceYaml = packageManager === PackageManager.pnpm && pnpmSupportsWorkspaceSettings(resolvedPackageManagerVersion);
	if (usePnpmWorkspaceYaml && pnpmPackageJsonSettingsPending(pkg)) return true;
	const supportCatalog = !VITE_PLUS_VERSION.startsWith("file:") && supportsCatalog(packageManager, resolvedPackageManagerVersion, packageManager === PackageManager.bun && bunWorkspaceDeclaresPackages(pkg.workspaces));
	const catalogDependencyResolver = createCatalogDependencyResolver(projectPath, packageManager);
	const canonicalVitePlusSpec = supportCatalog ? catalogDependencyResolver?.preferredCatalogSpec ?? "catalog:" : VITE_PLUS_VERSION;
	if (workspaceVitestEcosystemCatalogReferencesPending(projectPath, packages, catalogDependencyResolver)) return true;
	const providerCatalogAdditions = collectInjectedProviderNames(projectPath, packages);
	for (const [index, packagePath] of bootstrapProjectPaths(projectPath, packages).entries()) {
		const childPackageJsonPath = path.join(packagePath, "package.json");
		if (!fs.existsSync(childPackageJsonPath)) continue;
		const childPkg = readJsonFile(childPackageJsonPath);
		if (reconcileVitePlusBootstrapPackage(packagePath, JSON.parse(JSON.stringify(childPkg)), canonicalVitePlusSpec, packageManager, supportCatalog, index === 0, catalogDependencyResolver, providerCatalogAdditions)) return true;
	}
	const usesVitest = workspaceUsesVitestDirectly(projectPath, packages, true);
	if (packageManager === PackageManager.yarn) return !overridesSatisfyVitePlus(pkg.resolutions, usesVitest) || !yarnrcSatisfiesVitePlus(projectPath, usesVitest, supportCatalog) || yarnWorkspaceHoistingOptOutPending(projectPath, packageManager, packages);
	if (packageManager === PackageManager.npm) return vitePlusDependencyNeedsConcreteVersion(pkg) || !overridesSatisfyVitePlus(pkg.overrides, usesVitest) || npmVitePlusManagedDependenciesPending(pkg, usesVitest);
	if (packageManager === PackageManager.bun) return !overridesSatisfyVitePlus(pkg.overrides, usesVitest, supportCatalog ? readBunCatalogDependencyResolver(pkg) : void 0);
	if (packageManager === PackageManager.pnpm) {
		if (!pnpmWorkspaceExoticSubdepsSettingSatisfied(projectPath)) return true;
		if (!usePnpmWorkspaceYaml) {
			if (supportCatalog) return catalogVitePlusDependencyPending(pkg, catalogDependencyResolver) || !overridesSatisfyVitePlus(pkg.pnpm?.overrides, usesVitest, catalogDependencyResolver, "pnpm-ranged") || !pnpmPeerDependencyRulesSatisfyVitePlus(pkg.pnpm?.peerDependencyRules, usesVitest);
			return vitePlusDependencyNeedsConcreteVersion(pkg) || !overridesSatisfyVitePlus(pkg.pnpm?.overrides, usesVitest, void 0, "pnpm-ranged") || !pnpmPeerDependencyRulesSatisfyVitePlus(pkg.pnpm?.peerDependencyRules, usesVitest);
		}
		const resolver = readPnpmWorkspaceCatalogDependencyResolver(projectPath);
		return workspaceCatalogVitePlusDependencyPending(projectPath, packages, resolver) || !overridesSatisfyVitePlus(readPnpmWorkspaceOverrides(projectPath), usesVitest, resolver, "pnpm-ranged") || !pnpmPeerDependencyRulesSatisfyVitePlus(readPnpmWorkspacePeerDependencyRules(projectPath), usesVitest) || pnpmWorkspaceMinimumReleaseAgeExemptionsPending(projectPath);
	}
	return false;
}
function hasDirectVitePlusInstallEntry(pkg) {
	return pkg.dependencies?.["vite-plus"] !== void 0 || pkg.devDependencies?.["vite-plus"] !== void 0;
}
function ensureVitePlusDependencySpecs(pkg, version, ensurePresent = true) {
	let changed = false;
	const dependencyGroups = [
		pkg.devDependencies,
		pkg.dependencies,
		pkg.optionalDependencies
	];
	for (const dependencies of dependencyGroups) {
		if (dependencies === void 0) continue;
		const spec = dependencies[VITE_PLUS_NAME];
		if (spec === void 0 || spec === version) continue;
		if (version.startsWith("catalog:") && spec.startsWith("catalog:")) continue;
		if (!version.startsWith("catalog:") && spec.startsWith("catalog:")) {
			dependencies[VITE_PLUS_NAME] = version;
			changed = true;
			continue;
		}
		if (isForceOverrideMode() || !isProtocolPinnedSpec(spec)) {
			dependencies[VITE_PLUS_NAME] = version;
			changed = true;
		}
	}
	if (hasDirectVitePlusInstallEntry(pkg) || !ensurePresent) return changed;
	pkg.devDependencies = {
		...pkg.devDependencies,
		[VITE_PLUS_NAME]: version
	};
	return true;
}
function readTextFileIfExists(filePath) {
	return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : void 0;
}
function ensureOverrideEntries(overrides, usesVitest, catalogDependencyResolver, keyStyle = "bare") {
	const next = { ...overrides };
	let changed = false;
	if (!usesVitest && removeManagedVitestEntry(next, keyStyle)) changed = true;
	for (const [dependencyName, overrideSpec] of Object.entries(managedOverridePackages(usesVitest))) {
		const overrideKey = managedOverrideKey(dependencyName, keyStyle);
		if (overrideKey !== dependencyName && next[dependencyName] !== void 0) {
			next[overrideKey] ??= next[dependencyName];
			delete next[dependencyName];
			changed = true;
		}
		if (!overrideSpecSatisfiesVitePlus(dependencyName, next[overrideKey], catalogDependencyResolver)) {
			next[overrideKey] = overrideSpec;
			changed = true;
		}
	}
	return {
		overrides: next,
		changed
	};
}
function ensurePnpmPeerDependencyRules(pkg, usesVitest) {
	const overrideKeys = Object.keys(managedOverridePackages(usesVitest));
	pkg.pnpm ??= {};
	const seed = { ...pkg.pnpm.peerDependencyRules };
	if (!usesVitest && VITEST_IS_MANAGED_OVERRIDE) {
		if (Array.isArray(seed.allowAny)) seed.allowAny = seed.allowAny.filter((key) => key !== "vitest");
		if (seed.allowedVersions) {
			seed.allowedVersions = { ...seed.allowedVersions };
			delete seed.allowedVersions.vitest;
		}
	}
	const peerDependencyRules = {
		...seed,
		allowAny: [.../* @__PURE__ */ new Set([...seed.allowAny ?? [], ...overrideKeys])],
		allowedVersions: {
			...seed.allowedVersions,
			...Object.fromEntries(overrideKeys.map((key) => [key, "*"]))
		}
	};
	const changed = JSON.stringify(pkg.pnpm.peerDependencyRules ?? {}) !== JSON.stringify(peerDependencyRules);
	pkg.pnpm.peerDependencyRules = peerDependencyRules;
	return changed;
}
function ensureVitePlusBootstrap(workspaceInfo, report) {
	const projectPath = workspaceInfo.rootDir;
	const packageJsonPath = path.join(projectPath, "package.json");
	const result = {
		changed: false,
		packageJson: false,
		packageManagerConfig: false,
		packageManagerField: false
	};
	if (!fs.existsSync(packageJsonPath)) return result;
	const usesVitest = workspaceUsesVitestDirectly(projectPath, workspaceInfo.packages, true);
	const pnpmMajorVersion = pnpmMajor(workspaceInfo.downloadPackageManager.version);
	const shouldAllowBrowserBuilds = workspaceUsesWebdriverio(projectPath, workspaceInfo.packages);
	const usePnpmWorkspaceYaml = workspaceInfo.packageManager === PackageManager.pnpm && pnpmSupportsWorkspaceSettings(workspaceInfo.downloadPackageManager.version);
	const isBunWorkspace = workspaceInfo.packageManager === PackageManager.bun && bunWorkspaceDeclaresPackages(readJsonFile(packageJsonPath).workspaces);
	const supportCatalog = !VITE_PLUS_VERSION.startsWith("file:") && supportsCatalog(workspaceInfo.packageManager, workspaceInfo.downloadPackageManager.version, isBunWorkspace);
	const catalogDependencyResolver = createCatalogDependencyResolver(projectPath, workspaceInfo.packageManager);
	const canonicalVitePlusSpec = supportCatalog ? catalogDependencyResolver?.preferredCatalogSpec ?? "catalog:" : VITE_PLUS_VERSION;
	const ecosystemCatalogReferencesPending = workspaceVitestEcosystemCatalogReferencesPending(projectPath, workspaceInfo.packages, catalogDependencyResolver);
	const vitestEcosystemPackages = collectVitestEcosystemInstallDependencyNames(projectPath, workspaceInfo.packages);
	const providerCatalogAdditions = collectInjectedProviderNames(projectPath, workspaceInfo.packages);
	let movedPnpmSettings;
	const pnpmWorkspaceYamlPath = path.join(projectPath, "pnpm-workspace.yaml");
	let pnpmWorkspaceCatalogBefore;
	if (workspaceInfo.packageManager === PackageManager.pnpm && !usePnpmWorkspaceYaml) {
		pnpmWorkspaceCatalogBefore = readTextFileIfExists(pnpmWorkspaceYamlPath);
		if (supportCatalog) rewritePnpmWorkspaceYaml(projectPath, pnpmMajorVersion, shouldAllowBrowserBuilds, usesVitest, vitestEcosystemPackages, false, providerCatalogAdditions);
	}
	editJsonFile(packageJsonPath, (pkg) => {
		let packageJsonChanged = reconcileVitePlusBootstrapPackage(projectPath, pkg, canonicalVitePlusSpec, workspaceInfo.packageManager, supportCatalog, true, catalogDependencyResolver, providerCatalogAdditions);
		if (workspaceInfo.packageManager === PackageManager.yarn) {
			const ensured = ensureOverrideEntries(pkg.resolutions, usesVitest);
			if (ensured.changed) {
				pkg.resolutions = ensured.overrides;
				packageJsonChanged = true;
			}
		} else if (workspaceInfo.packageManager === PackageManager.npm) {
			const ensured = ensureOverrideEntries(pkg.overrides, usesVitest);
			if (ensured.changed) {
				pkg.overrides = ensured.overrides;
				packageJsonChanged = true;
			}
		} else if (workspaceInfo.packageManager === PackageManager.bun) {
			const ensured = ensureOverrideEntries(pkg.overrides, usesVitest, supportCatalog ? readBunCatalogDependencyResolver(pkg) : void 0);
			if (ensured.changed) {
				pkg.overrides = ensured.overrides;
				packageJsonChanged = true;
			}
		} else if (workspaceInfo.packageManager === PackageManager.pnpm && !usePnpmWorkspaceYaml) {
			pkg.pnpm ??= {};
			const ensured = ensureOverrideEntries(pkg.pnpm.overrides, usesVitest, supportCatalog ? readPnpmWorkspaceCatalogDependencyResolver(projectPath) : void 0, "pnpm-ranged");
			if (ensured.changed) {
				pkg.pnpm.overrides = ensured.overrides;
				packageJsonChanged = true;
			}
			packageJsonChanged = ensurePnpmPeerDependencyRules(pkg, usesVitest) || packageJsonChanged;
			if (pnpmMajorVersion !== void 0 && pkg.pnpm) {
				const beforePnpm = JSON.stringify(pkg.pnpm);
				applyBuildAllowanceToPackageJsonPnpm(pkg.pnpm, pnpmMajorVersion, shouldAllowBrowserBuilds);
				packageJsonChanged = beforePnpm !== JSON.stringify(pkg.pnpm) || packageJsonChanged;
			}
		} else if (workspaceInfo.packageManager === PackageManager.pnpm) {
			const hadPnpmField = pkg.pnpm !== void 0;
			movedPnpmSettings = takePnpmWorkspaceSettings(pkg);
			packageJsonChanged = movedPnpmSettings !== void 0 || hadPnpmField && pkg.pnpm === void 0 || packageJsonChanged;
		}
		result.packageJson = packageJsonChanged;
		return pkg;
	});
	const yarnHoisting = workspaceInfo.packageManager === PackageManager.yarn ? findYarnWorkspaceHoisting(projectPath) : void 0;
	for (const workspacePackage of workspaceInfo.packages) {
		const packagePath = path.join(projectPath, workspacePackage.path);
		const childPackageJsonPath = path.join(packagePath, "package.json");
		if (!fs.existsSync(childPackageJsonPath)) continue;
		let childChanged = false;
		editJsonFile(childPackageJsonPath, (pkg) => {
			const before = JSON.stringify(pkg);
			reconcileVitePlusBootstrapPackage(packagePath, pkg, canonicalVitePlusSpec, workspaceInfo.packageManager, supportCatalog, false, catalogDependencyResolver, providerCatalogAdditions);
			if (yarnHoisting && path.resolve(packagePath) !== yarnHoisting.rootDir && hasDirectVitePlusInstallEntry(pkg)) applyYarnWorkspaceHoistingFix(pkg, yarnHoisting.limit, yarnHoisting.nodeLinker, path.relative(yarnHoisting.rootDir, packagePath) || packagePath, report);
			childChanged = before !== JSON.stringify(pkg);
			return childChanged ? pkg : void 0;
		});
		result.packageJson = result.packageJson || childChanged;
	}
	if (workspaceInfo.packageManager === PackageManager.pnpm) {
		if (usePnpmWorkspaceYaml) {
			const before = readTextFileIfExists(pnpmWorkspaceYamlPath);
			migratePnpmSettingsToWorkspaceYaml(projectPath, movedPnpmSettings);
			const catalogDependencyResolver = readPnpmWorkspaceCatalogDependencyResolver(projectPath);
			if (movedPnpmSettings !== void 0 || result.packageJson || ecosystemCatalogReferencesPending || !pnpmWorkspaceExoticSubdepsSettingSatisfied(projectPath) || pnpmWorkspaceMinimumReleaseAgeExemptionsPending(projectPath) || workspaceCatalogVitePlusDependencyPending(projectPath, workspaceInfo.packages, catalogDependencyResolver) || !overridesSatisfyVitePlus(readPnpmWorkspaceOverrides(projectPath), usesVitest, catalogDependencyResolver, "pnpm-ranged") || !pnpmPeerDependencyRulesSatisfyVitePlus(readPnpmWorkspacePeerDependencyRules(projectPath), usesVitest)) rewritePnpmWorkspaceYaml(projectPath, pnpmMajorVersion, shouldAllowBrowserBuilds, usesVitest, vitestEcosystemPackages, true, providerCatalogAdditions);
			if (fs.existsSync(pnpmWorkspaceYamlPath)) ensurePnpmWorkspacePackages(projectPath, workspaceInfo.workspacePatterns);
			result.packageManagerConfig = before !== readTextFileIfExists(pnpmWorkspaceYamlPath);
		} else {
			const exoticChanged = ensurePnpmWorkspaceExoticSubdepsSetting(projectPath);
			if (fs.existsSync(pnpmWorkspaceYamlPath)) ensurePnpmWorkspacePackages(projectPath, workspaceInfo.workspacePatterns);
			const after = readTextFileIfExists(pnpmWorkspaceYamlPath);
			result.packageManagerConfig = exoticChanged || pnpmWorkspaceCatalogBefore !== after;
		}
	} else if (workspaceInfo.packageManager === PackageManager.yarn) {
		const yarnrcYmlPath = path.join(projectPath, ".yarnrc.yml");
		const before = readTextFileIfExists(yarnrcYmlPath);
		rewriteYarnrcYml(projectPath, usesVitest, vitestEcosystemPackages, providerCatalogAdditions, supportCatalog);
		result.packageManagerConfig = before !== fs.readFileSync(yarnrcYmlPath, "utf-8");
	} else if (isBunWorkspace) {
		const before = fs.readFileSync(packageJsonPath, "utf-8");
		rewriteBunCatalog(projectPath, usesVitest, vitestEcosystemPackages);
		const after = fs.readFileSync(packageJsonPath, "utf-8");
		result.packageJson = result.packageJson || before !== after;
	}
	const beforePackageManager = fs.readFileSync(packageJsonPath, "utf-8");
	setPackageManager(projectPath, workspaceInfo.downloadPackageManager);
	result.packageManagerField = beforePackageManager !== fs.readFileSync(packageJsonPath, "utf-8");
	result.changed = result.packageJson || result.packageManagerConfig || result.packageManagerField;
	if (result.changed && report) report.packageManagerBootstrapConfigured = true;
	return result;
}
function declaredRootSpec(pkg, dependencyName) {
	return pkg.dependencies?.[dependencyName] ?? pkg.devDependencies?.[dependencyName];
}
/**
* Reduce a plain spec to a concrete-ish version string for display: a
* `npm:@scope/name@<range>` alias (e.g. the legacy `@voidzero-dev/vite-plus-test`
* vitest wrapper) keeps only its trailing range, then a single leading `^`/`~`/
* `>=` operator is stripped. Any remaining range text is kept as-is.
*/
function concretizeRange(spec) {
	let value = spec;
	if (value.startsWith("npm:")) {
		const versionAt = value.lastIndexOf("@");
		if (versionAt > 4) value = value.slice(versionAt + 1);
	}
	return value.replace(/^(?:\^|~|>=)\s*/, "");
}
/**
* Resolve a pre-migration root dependency spec to a concrete version string for
* display. A `catalog:`/`catalog:<name>` reference resolves through the project
* catalog (then concretized, since a named catalog may itself hold an alias).
*/
function resolveDisplayFromSpec(spec, dependencyName, catalogDependencyResolver) {
	if (spec.startsWith("catalog:")) {
		const resolved = catalogDependencyResolver?.(spec, dependencyName);
		return resolved === void 0 ? void 0 : concretizeRange(resolved);
	}
	return concretizeRange(spec);
}
/**
* Read the RAW upstream Vite version installed under the project's own
* `node_modules/vite`, best-effort. This is a deliberate project-local read (not
* an ancestor-walking resolve) so a parent directory's vite cannot leak in as
* the project's "from". When that copy is the `@voidzero-dev/vite-plus-core`
* alias (the Vite+ bundle), the raw Vite version lives in its
* `bundledVersions.vite`; otherwise it is a real upstream vite and `version` is
* the raw value. Returns undefined when the file is missing (e.g. a cleared
* install or Yarn PnP) or yields nothing.
*/
function readInstalledRawViteVersion(projectPath) {
	const vitePackageJsonPath = path.join(projectPath, "node_modules", "vite", "package.json");
	if (!fs.existsSync(vitePackageJsonPath)) return;
	let pkgJson;
	try {
		pkgJson = readJsonFile(vitePackageJsonPath);
	} catch {
		return;
	}
	if (pkgJson.name === "@voidzero-dev/vite-plus-core") return pkgJson.bundledVersions?.vite;
	return pkgJson.version;
}
/**
* Capture the toolchain dependency version changes an existing-Vite+ upgrade
* will apply, for the migrate summary table. Call this BEFORE the bootstrap
* reconcile mutates the manifest so the `from` values still reflect the
* pre-migration root package.json.
*
* `to` targets: `vite-plus` -> VITE_PLUS_VERSION, `vitest` and every declared
* `@vitest/*` -> VITEST_VERSION, `vite` -> the RAW bundled upstream Vite version
* (NOT the `@voidzero-dev/vite-plus-core` alias). An entry is included only when
* `to` is defined and the version actually changes (or the package is freshly
* added, i.e. `from` is undefined).
*/
async function collectToolchainVersionChanges(projectPath) {
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return [];
	const pkg = readJsonFile(packageJsonPath);
	const { versions } = await import("./versions.js");
	const rawViteVersion = versions.vite;
	const catalogDependencyResolver = readPnpmWorkspaceCatalogDependencyResolver(projectPath) ?? createCatalogDependencyResolver(projectPath, PackageManager.yarn) ?? createCatalogDependencyResolver(projectPath, PackageManager.bun);
	const fromFor = (dependencyName) => {
		const spec = declaredRootSpec(pkg, dependencyName);
		if (spec === void 0) return;
		return resolveDisplayFromSpec(spec, dependencyName, catalogDependencyResolver);
	};
	const changes = [];
	const pushChange = (name, to, from) => {
		if (to === void 0 || from !== void 0 && from === to) return;
		changes.push(from === void 0 ? {
			name,
			to
		} : {
			name,
			from,
			to
		});
	};
	const vitePlusSpec = declaredRootSpec(pkg, VITE_PLUS_NAME);
	if (vitePlusSpec === void 0 || vitePlusSpec.startsWith("catalog:") || isForceOverrideMode() || !isProtocolPinnedSpec(vitePlusSpec)) pushChange(VITE_PLUS_NAME, VITE_PLUS_VERSION, fromFor(VITE_PLUS_NAME));
	pushChange("vite", rawViteVersion, readInstalledRawViteVersion(projectPath));
	if (declaredRootSpec(pkg, "vitest") !== void 0 && projectUsesVitestDirectly(projectPath, pkg, void 0, true)) pushChange("vitest", VITEST_VERSION, fromFor("vitest"));
	const scopedVitestNames = /* @__PURE__ */ new Set();
	for (const group of [pkg.dependencies, pkg.devDependencies]) for (const name of Object.keys(group ?? {})) if (isAlignableVitestEcosystemPackage(name)) scopedVitestNames.add(name);
	for (const name of [...scopedVitestNames].toSorted()) pushChange(name, VITEST_VERSION, fromFor(name));
	return changes;
}
//#endregion
//#region src/migration/migrator/package-json.ts
function rewritePackageJson(pkg, packageManager, isMonorepo, skipStagedMigration, catalogDependencyResolver, vitestBrowserMode, providerSourceModes, usesVitestDirectly = true, retainedVitestModule = false, requiredVitestPeer = false, providerCatalogAdditions = /* @__PURE__ */ new Set()) {
	if (pkg.scripts) {
		const updated = rewriteScripts(JSON.stringify(pkg.scripts), getScriptRulesYaml(skipStagedMigration));
		if (updated) pkg.scripts = JSON.parse(updated);
	}
	let extractedStagedConfig = null;
	if (!skipStagedMigration && pkg["lint-staged"]) {
		const config = pkg["lint-staged"];
		const updated = rewriteScripts(JSON.stringify(config), readRulesYaml());
		extractedStagedConfig = updated ? JSON.parse(updated) : config;
	}
	const supportCatalog = !!isMonorepo && packageManager !== PackageManager.npm;
	let needVitePlus = false;
	const dependencyGroups = [
		{
			dependencyField: "devDependencies",
			dependencies: pkg.devDependencies
		},
		{
			dependencyField: "dependencies",
			dependencies: pkg.dependencies
		},
		{
			dependencyField: "peerDependencies",
			dependencies: pkg.peerDependencies
		},
		{
			dependencyField: "optionalDependencies",
			dependencies: pkg.optionalDependencies
		}
	];
	for (const { dependencies } of dependencyGroups) if (pruneLegacyWrapperAliases(dependencies)) needVitePlus = true;
	const managed = managedOverridePackages(usesVitestDirectly);
	if (!usesVitestDirectly) for (const { dependencyField, dependencies } of dependencyGroups) {
		if (dependencyField === "peerDependencies") continue;
		if (removeManagedVitestEntry(dependencies)) needVitePlus = true;
	}
	for (const [key, version] of Object.entries(managed)) for (const { dependencyField, dependencies } of dependencyGroups) if (dependencies?.[key]) {
		dependencies[key] = getCatalogDependencySpec(dependencies[key], version, supportCatalog, {
			dependencyField,
			dependencyName: key,
			packageManager,
			catalogDependencyResolver,
			preferredCatalogSpec: catalogDependencyResolver?.preferredCatalogSpec
		});
		needVitePlus = true;
	}
	if (normalizeVitestPeerCatalogSpec(pkg.peerDependencies, catalogDependencyResolver)) needVitePlus = true;
	alignVitestEcosystemPackages(pkg, packageManager, supportCatalog, catalogDependencyResolver);
	if (isForceOverrideMode()) {
		for (const { dependencies } of dependencyGroups) if (dependencies?.["vite-plus"]) {
			if (!supportCatalog || VITE_PLUS_VERSION.startsWith("file:") || !dependencies["vite-plus"].startsWith("catalog:")) dependencies[VITE_PLUS_NAME] = VITE_PLUS_VERSION;
			needVitePlus = true;
		}
	}
	const hasBrowserDepSignal = VITEST_BROWSER_DEP_NAMES.some((name) => dependencyGroups.some(({ dependencies }) => dependencies?.[name] !== void 0));
	for (const name of REMOVE_PACKAGES) {
		let wasRemoved = false;
		for (const { dependencies } of dependencyGroups) if (dependencies?.[name]) {
			delete dependencies[name];
			wasRemoved = true;
		}
		if (wasRemoved) needVitePlus = true;
	}
	let usesAnyOptInProvider = false;
	for (const provider of OPT_IN_BROWSER_PROVIDERS) {
		if (!(providerSourceModes?.[provider] || dependencyGroups.some(({ dependencies }) => dependencies?.[provider] !== void 0))) continue;
		usesAnyOptInProvider = true;
		const installGroupEntry = dependencyGroups.find(({ dependencyField, dependencies }) => dependencyField !== "peerDependencies" && dependencies?.[provider] !== void 0);
		if (installGroupEntry?.dependencies) {
			if (VITEST_IS_MANAGED_OVERRIDE) installGroupEntry.dependencies[provider] = getAlignedVitestEcosystemDependencySpec(installGroupEntry.dependencies[provider], provider, installGroupEntry.dependencyField, packageManager, providerCatalogAdditions.has(provider) ? supportCatalog && packageManager !== PackageManager.bun : supportCatalog, catalogDependencyResolver);
		} else {
			pkg.devDependencies ??= {};
			pkg.devDependencies[provider] = getCatalogDependencySpec(void 0, VITEST_VERSION, supportCatalog && packageManager !== PackageManager.bun, { preferredCatalogSpec: catalogDependencyResolver?.preferredCatalogSpec });
		}
		const peer = BROWSER_PROVIDER_PEER_DEPS[provider];
		const peerPresent = findDeclaredSpec(pkg, peer);
		if (peer && !peerPresent) {
			pkg.devDependencies ??= {};
			pkg.devDependencies[peer] = resolveProviderPeerSpec(pkg, peer, supportCatalog, catalogDependencyResolver);
		}
		needVitePlus = true;
	}
	if (usesAnyOptInProvider && packageManager === PackageManager.npm) {
		const viteOverride = VITE_PLUS_OVERRIDE_PACKAGES.vite;
		const viteAlreadyDirect = pkg.dependencies?.vite ?? pkg.devDependencies?.vite ?? pkg.optionalDependencies?.vite;
		if (viteOverride && !viteAlreadyDirect) {
			setDirectViteEdge(pkg, supportCatalog, catalogDependencyResolver);
			needVitePlus = true;
		}
	}
	const effectiveBrowserMode = vitestBrowserMode || hasBrowserDepSignal;
	const installableNames = [
		...Object.keys(pkg.dependencies ?? {}),
		...Object.keys(pkg.devDependencies ?? {}),
		...Object.keys(pkg.optionalDependencies ?? {})
	];
	const isVitestAdjacent = !installableNames.includes("vitest") && installableNames.some((name) => name !== "vitest" && name.includes("vitest") && !VITEST_DIRECT_USAGE_EXCLUDED.has(name));
	const hasNuxtTestUtils = hasNuxtTestUtilsDependency(pkg);
	const canonicalVitePlusSpec = supportCatalog && !VITE_PLUS_VERSION.startsWith("file:") ? catalogDependencyResolver?.preferredCatalogSpec ?? "catalog:" : VITE_PLUS_VERSION;
	const existingVitePlusGroup = pkg.devDependencies?.["vite-plus"] !== void 0 ? pkg.devDependencies : pkg.dependencies?.["vite-plus"] !== void 0 ? pkg.dependencies : void 0;
	const existingVitePlus = existingVitePlusGroup?.[VITE_PLUS_NAME];
	const shouldNormalizeExistingVitePlus = !!existingVitePlus && supportCatalog && existingVitePlus !== canonicalVitePlusSpec && !isProtocolPinnedSpec(existingVitePlus);
	if (!existingVitePlus && (isVitestAdjacent || effectiveBrowserMode)) needVitePlus = true;
	const needDirectVitest = needVitePlus || effectiveBrowserMode || isVitestAdjacent || retainedVitestModule || requiredVitestPeer || hasNuxtTestUtils;
	if (existingVitePlusGroup) {
		if (shouldNormalizeExistingVitePlus) existingVitePlusGroup[VITE_PLUS_NAME] = canonicalVitePlusSpec;
	} else if (needVitePlus) pkg.devDependencies = {
		...pkg.devDependencies,
		[VITE_PLUS_NAME]: canonicalVitePlusSpec
	};
	ensureDirectViteForPnpm(pkg, packageManager, supportCatalog, catalogDependencyResolver);
	if (needDirectVitest) {
		if (!{
			...pkg.dependencies,
			...pkg.devDependencies,
			...pkg.optionalDependencies
		}.vitest && (effectiveBrowserMode || retainedVitestModule || requiredVitestPeer || isVitestAdjacent || hasNuxtTestUtils)) {
			pkg.devDependencies ??= {};
			pkg.devDependencies.vitest = getCatalogDependencySpec(void 0, VITEST_VERSION, supportCatalog, { preferredCatalogSpec: catalogDependencyResolver?.preferredCatalogSpec });
		}
	}
	return extractedStagedConfig;
}
function isProtocolPinnedSpec(spec) {
	return /^(catalog:|workspace:|link:|file:|npm:|github:|git[+:]|https?:\/\/)/.test(spec);
}
//#endregion
//#region src/migration/migrator/vite-config.ts
const SVELTE_RUNE_GLOBALS = {
	$state: "readonly",
	$derived: "readonly",
	$effect: "readonly",
	$props: "readonly",
	$bindable: "readonly",
	$inspect: "readonly",
	$host: "readonly"
};
function ensureSvelteRuneGlobals(config) {
	for (const override of config.overrides ?? []) {
		if (!override.files.some((file) => !file.startsWith("!") && braceExpand(file).some((pattern) => pattern.includes(".svelte")))) continue;
		override.globals = {
			...SVELTE_RUNE_GLOBALS,
			...override.globals
		};
	}
}
function removeLintStagedFromPackageJson(packageJsonPath) {
	editJsonFile(packageJsonPath, (pkg) => {
		if (pkg["lint-staged"]) {
			delete pkg["lint-staged"];
			return pkg;
		}
	});
}
function rewriteLintStagedConfigFile(projectPath, report) {
	let hasUnsupported = false;
	for (const filename of LINT_STAGED_JSON_CONFIG_FILES) {
		const configPath = path.join(projectPath, filename);
		if (!fs.existsSync(configPath)) continue;
		if (filename === ".lintstagedrc" && !isJsonFile(configPath)) {
			warnMigration(`${displayRelative(configPath)} is not JSON format — please migrate to "staged" in vite.config.ts manually`, report);
			hasUnsupported = true;
			continue;
		}
		if (!hasStagedConfigInViteConfig(projectPath)) {
			const config = readJsonFile(configPath);
			const updated = rewriteScripts(JSON.stringify(config), readRulesYaml());
			if (!mergeStagedConfigToViteConfig(projectPath, updated ? JSON.parse(updated) : config, true, report)) continue;
			fs.unlinkSync(configPath);
			if (report) report.inlinedLintStagedConfigCount++;
		} else warnMigration(`${displayRelative(configPath)} found but "staged" already exists in vite.config.ts — please merge manually`, report);
	}
	for (const filename of LINT_STAGED_OTHER_CONFIG_FILES) {
		const configPath = path.join(projectPath, filename);
		if (!fs.existsSync(configPath)) continue;
		warnMigration(`${displayRelative(configPath)} — please migrate to "staged" in vite.config.ts manually`, report);
		hasUnsupported = true;
	}
	if (hasUnsupported) infoMigration("Only \"staged\" in vite.config.ts is supported. See https://viteplus.dev/guide/migrate#lint-staged", report);
}
/**
* Ensure vite.config.ts exists, create it if not
* @returns The vite config filename
*/
function ensureViteConfig(projectPath, configs, silent = false, report) {
	if (!configs.viteConfig) {
		configs.viteConfig = "vite.config.ts";
		const viteConfigPath = path.join(projectPath, "vite.config.ts");
		fs.writeFileSync(viteConfigPath, `import { defineConfig } from '${VITE_PLUS_NAME}';

export default defineConfig({});
`);
		if (report) report.createdViteConfigCount++;
		if (!silent) log.success(`✔ Created vite.config.ts in ${displayRelative(viteConfigPath)}`);
	}
	return configs.viteConfig;
}
/**
* Merge tsdown.config.* into vite.config.ts
* - For JSON files: merge content directly into `pack` field and delete the JSON file
* - For TS/JS files: import the config file
*/
function mergeTsdownConfigFile(projectPath, silent = false, report) {
	const configs = detectConfigs(projectPath);
	if (!configs.tsdownConfig) return;
	const viteConfig = ensureViteConfig(projectPath, configs, silent, report);
	const fullViteConfigPath = path.join(projectPath, viteConfig);
	const fullTsdownConfigPath = path.join(projectPath, configs.tsdownConfig);
	if (configs.tsdownConfig.endsWith(".json")) {
		mergeAndRemoveJsonConfig(projectPath, viteConfig, configs.tsdownConfig, "pack", silent, report);
		return;
	}
	const tsdownRelativePath = `./${configs.tsdownConfig}`;
	const result = mergeTsdownConfig(fullViteConfigPath, tsdownRelativePath);
	if (result.updated) {
		fs.writeFileSync(fullViteConfigPath, result.content);
		if (report) report.tsdownImportCount++;
		if (!silent) log.success(`✔ Added import for ${displayRelative(fullTsdownConfigPath)} in ${displayRelative(fullViteConfigPath)}`);
	}
	infoMigration(`Please manually merge ${displayRelative(fullTsdownConfigPath)} into ${displayRelative(fullViteConfigPath)}, see https://viteplus.dev/guide/migrate#tsdown`, report);
}
/**
* Merge oxlint and oxfmt config into vite.config.ts
*/
function mergeViteConfigFiles(projectPath, silent = false, report, packages, workspaceRoot) {
	const configs = detectConfigs(projectPath);
	if (!configs.oxfmtConfig && !configs.oxlintConfig) return;
	const viteConfig = ensureViteConfig(projectPath, configs, silent, report);
	if (configs.oxlintConfig) {
		const fullOxlintPath = path.join(projectPath, configs.oxlintConfig);
		const oxlintJson = readJsonFile(fullOxlintPath, true);
		if (!oxlintJson.options) oxlintJson.options = {};
		if (!hasBaseUrlInTsconfig(projectPath)) {
			if (oxlintJson.options.typeAware === void 0) oxlintJson.options.typeAware = true;
			if (oxlintJson.options.typeCheck === void 0) oxlintJson.options.typeCheck = true;
		} else warnMigration(BASEURL_TSCONFIG_WARNING, report);
		sanitizeMigratedOxlintConfig(oxlintJson, collectInstalledPackageNames(workspaceRoot ?? projectPath, packages), report);
		ensureSvelteRuneGlobals(oxlintJson);
		const normalizedOxlintConfig = ensureVitePlusImportRuleDefaults(oxlintJson);
		writeJsonFile(fullOxlintPath, normalizedOxlintConfig);
		mergeAndRemoveJsonConfig(projectPath, viteConfig, configs.oxlintConfig, "lint", silent, report);
	}
	if (configs.oxfmtConfig) mergeAndRemoveJsonConfig(projectPath, viteConfig, configs.oxfmtConfig, "fmt", silent, report);
}
/**
* Inject typeAware and typeCheck defaults into vite.config.ts lint config.
* Called after mergeViteConfigFiles() to handle the case where no .oxlintrc.json exists
* (e.g., newly created projects from create-vite templates).
*/
function injectLintTypeCheckDefaults(projectPath, silent = false, report) {
	if (hasBaseUrlInTsconfig(projectPath)) {
		warnMigration(BASEURL_TSCONFIG_WARNING, report);
		return;
	}
	injectConfigDefaults(projectPath, "lint", ".vite-plus-lint-init.oxlintrc.json", JSON.stringify(createDefaultVitePlusLintConfig({ includeTypeAwareDefaults: true })), silent, report);
}
function injectFmtDefaults(projectPath, silent = false, report) {
	injectConfigDefaults(projectPath, "fmt", ".vite-plus-fmt-init.oxfmtrc.json", JSON.stringify({}), silent, report);
}
/**
* Wire `create.defaultTemplate: '<scope>'` into the new monorepo's
* `vite.config.ts`. The caller is `bin.ts`, only when scaffolding a
* monorepo from a bundled `@org` manifest entry — that's the case where
* the user just picked a template from a specific org and naturally
* wants subsequent `vp create` invocations from the workspace to default
* to that same org's picker.
*/
function injectCreateDefaultTemplate(projectPath, scope, silent = false, report) {
	if (!scope) return;
	injectConfigDefaults(projectPath, "create", ".vite-plus-create-init.json", JSON.stringify({ defaultTemplate: scope }), silent, report);
}
function injectConfigDefaults(projectPath, configKey, tempFileName, tempFileContent, silent, report) {
	const configs = detectConfigs(projectPath);
	if (configs.viteConfig && hasConfigKey(path.join(projectPath, configs.viteConfig), configKey)) return;
	const viteConfig = ensureViteConfig(projectPath, configs, silent, report);
	const tempConfigPath = path.join(projectPath, tempFileName);
	fs.writeFileSync(tempConfigPath, tempFileContent);
	const fullViteConfigPath = path.join(projectPath, viteConfig);
	let result;
	try {
		result = mergeJsonConfig(fullViteConfigPath, tempConfigPath, configKey);
	} finally {
		fs.rmSync(tempConfigPath, { force: true });
	}
	if (result.updated) fs.writeFileSync(fullViteConfigPath, result.content);
}
function mergeAndRemoveJsonConfig(projectPath, viteConfigPath, jsonConfigPath, configKey, silent = false, report) {
	const fullViteConfigPath = path.join(projectPath, viteConfigPath);
	const fullJsonConfigPath = path.join(projectPath, jsonConfigPath);
	if (hasConfigKey(fullViteConfigPath, configKey)) {
		fs.unlinkSync(fullJsonConfigPath);
		if (!silent) log.info(`${configKey} config already present in ${displayRelative(fullViteConfigPath)} — removed redundant ${displayRelative(fullJsonConfigPath)}`);
		return;
	}
	const result = mergeJsonConfig(fullViteConfigPath, fullJsonConfigPath, configKey);
	if (result.updated) {
		fs.writeFileSync(fullViteConfigPath, result.content);
		fs.unlinkSync(fullJsonConfigPath);
		if (report) report.mergedConfigCount++;
		if (!silent) log.success(`✔ Merged ${displayRelative(fullJsonConfigPath)} into ${displayRelative(fullViteConfigPath)}`);
	} else {
		warnMigration(`Failed to merge ${displayRelative(fullJsonConfigPath)} into ${displayRelative(fullViteConfigPath)}`, report);
		infoMigration("Please complete the merge manually and follow the instructions in the documentation: https://viteplus.dev/config/", report);
	}
}
/**
* Merge a staged config object into vite.config.ts as `staged: { ... }`.
* Writes the config to a temp JSON file, calls mergeJsonConfig NAPI, then cleans up.
*/
function mergeStagedConfigToViteConfig(projectPath, stagedConfig, silent = false, report) {
	const viteConfig = ensureViteConfig(projectPath, detectConfigs(projectPath), silent, report);
	const fullViteConfigPath = path.join(projectPath, viteConfig);
	const tempJsonPath = path.join(projectPath, ".staged-config-temp.json");
	fs.writeFileSync(tempJsonPath, JSON.stringify(stagedConfig, null, 2));
	let result;
	try {
		result = mergeJsonConfig(fullViteConfigPath, tempJsonPath, "staged");
	} finally {
		fs.unlinkSync(tempJsonPath);
	}
	if (result.updated) {
		fs.writeFileSync(fullViteConfigPath, result.content);
		if (report) report.mergedStagedConfigCount++;
		if (!silent) log.success(`✔ Merged staged config into ${displayRelative(fullViteConfigPath)}`);
		return true;
	} else {
		warnMigration(`Failed to merge staged config into ${displayRelative(fullViteConfigPath)}`, report);
		infoMigration(`Please add staged config to ${displayRelative(fullViteConfigPath)} manually, see https://viteplus.dev/guide/migrate#lint-staged`, report);
		return false;
	}
}
/**
* Check if vite.config.ts already has a `staged` config key.
*/
function hasStagedConfigInViteConfig(projectPath) {
	const configs = detectConfigs(projectPath);
	if (!configs.viteConfig) return false;
	const viteConfigPath = path.join(projectPath, configs.viteConfig);
	const content = fs.readFileSync(viteConfigPath, "utf8");
	return /\bstaged\s*:/.test(content);
}
/**
* Wrap safe inline Vite plugin arrays with lazyPlugins so check/lint/fmt do not
* eagerly execute plugin factories while loading vite.config.ts.
*/
function wrapLazyPluginsInViteConfig(projectPath, silent = false, report) {
	const configs = detectConfigs(projectPath);
	if (!configs.viteConfig) return;
	const viteConfigPath = path.join(projectPath, configs.viteConfig);
	const result = wrapLazyPlugins(viteConfigPath);
	if (!result.updated) return;
	fs.writeFileSync(viteConfigPath, result.content);
	if (report) report.wrappedPluginConfigCount++;
	if (!silent) log.success(`✔ Wrapped inline Vite plugins with lazyPlugins in ${displayRelative(viteConfigPath)}`);
}
/**
* Rewrite imports in all TypeScript/JavaScript files under a directory
* This rewrites vite/vitest imports to @voidzero-dev/vite-plus
* @param projectPath - The root directory to search for files
*/
function rewriteAllImports(projectPath, silent = false, report, preserveNuxtVitestImports = true) {
	const result = rewriteImportsInDirectory(projectPath, preserveNuxtVitestImports);
	const modified = result.modifiedFiles.length;
	const preserved = result.preservedVitestFiles.length;
	const errors = result.errors.length;
	if (report) {
		report.rewrittenImportFileCount += modified;
		report.preservedUpstreamVitestImportFileCount += preserved;
		report.rewrittenImportErrors.push(...result.errors.map((error) => ({
			path: displayRelative(error.path),
			message: error.message
		})));
	}
	if (!silent && modified > 0) {
		log.success(`Rewrote imports in ${modified === 1 ? "one file" : `${modified} files`}`);
		log.info(result.modifiedFiles.map((file) => `  ${displayRelative(file)}`).join("\n"));
	}
	if (errors > 0) {
		if (report) warnMigration(`${errors === 1 ? "one file had an error" : `${errors} files had errors`} while rewriting imports`, report);
		else {
			log.warn(`⚠ ${errors === 1 ? "one file had an error" : `${errors} files had errors`}:`);
			for (const error of result.errors) log.error(`  ${displayRelative(error.path)}: ${error.message}`);
		}
	}
	return modified > 0;
}
//#endregion
//#region src/utils/git.ts
var import_cross_spawn = /* @__PURE__ */ __toESM(require_cross_spawn(), 1);
/**
* Walk up from `startPath` looking for `.git` (directory or file — submodules
* use a `.git` file).  Returns the directory that contains `.git`, or `null`.
*/
function findGitRoot(startPath) {
	let dir = startPath;
	while (true) {
		if (fs.existsSync(path.join(dir, ".git"))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}
async function initGitRepository(cwd) {
	const result = await runCommandSilently({
		command: "git",
		args: ["init"],
		cwd,
		envs: process.env
	});
	if (result.exitCode !== 0) {
		log.warn("Failed to initialize git repository");
		const stderr = result.stderr.toString().trim();
		if (stderr) log.info(stderr);
		return false;
	}
	return true;
}
//#endregion
//#region src/migration/migrator/git-hooks.ts
const OTHER_HOOK_TOOLS = [
	"simple-git-hooks",
	"lefthook",
	"yorkie"
];
const SUPPORTED_GIT_HOOK_NAME_SET = new Set(SUPPORTED_GIT_HOOK_NAMES);
function removeReplacedStagedPackage(packageJsonPath) {
	editJsonFile(packageJsonPath, (pkg) => {
		if (pkg.devDependencies?.["lint-staged"]) delete pkg.devDependencies["lint-staged"];
		if (pkg.dependencies?.["lint-staged"]) delete pkg.dependencies["lint-staged"];
		return pkg;
	});
}
function detectLegacyGitHooksMigrationCandidate(projectPath) {
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return false;
	return readJsonFile(packageJsonPath)["lint-staged"] !== void 0;
}
function hasHuskySetup(projectPath, pkg) {
	return pkg.devDependencies?.husky !== void 0 || pkg.dependencies?.husky !== void 0 || pkg.optionalDependencies?.husky !== void 0 || pkg.peerDependencies?.husky !== void 0 || pkg.husky !== void 0 || (pkg.scripts?.prepare ? /\bhusky\b/.test(pkg.scripts.prepare) : false) || fs.existsSync(path.join(projectPath, ".husky"));
}
function hasExistingViteHooksPolicy(projectPath) {
	const hooksDir = path.join(projectPath, ".vite-hooks");
	if (!fs.lstatSync(hooksDir, { throwIfNoEntry: false })?.isDirectory()) return false;
	return fs.readdirSync(hooksDir, { withFileTypes: true }).some((entry) => entry.isFile() && SUPPORTED_GIT_HOOK_NAME_SET.has(entry.name));
}
function findNonRegularViteHookPath(projectPath) {
	for (const hookName of SUPPORTED_GIT_HOOK_NAMES) {
		const hookPath = path.join(projectPath, ".vite-hooks", hookName);
		const stats = fs.lstatSync(hookPath, { throwIfNoEntry: false });
		if (stats && !stats.isFile()) return path.join(".vite-hooks", hookName);
	}
	return null;
}
function findWorkspacePackageHookPolicy(workspaceRoot, packages) {
	for (const pkg of packages) {
		const packagePath = path.join(workspaceRoot, pkg.path);
		if (hasExistingViteHooksPolicy(packagePath)) return `Detected project-owned Vite+ hooks in workspace package "${pkg.path}" — leaving the existing hook setup unchanged.`;
		const packageJsonPath = path.join(packagePath, "package.json");
		const pkgContent = fs.existsSync(packageJsonPath) ? readJsonFile(packageJsonPath) : {};
		if (hasHuskySetup(packagePath, pkgContent)) return `Detected Husky in workspace package "${pkg.path}" — leaving its hooks, configuration, and dependencies unchanged.`;
		const deps = pkgContent.devDependencies;
		const prodDeps = pkgContent.dependencies;
		for (const tool of OTHER_HOOK_TOOLS) if (deps?.[tool] || prodDeps?.[tool] || pkgContent[tool]) return `Detected ${tool} in workspace package "${pkg.path}" — leaving the existing hook setup unchanged.`;
		const gitRoot = findGitRoot(packagePath);
		if (gitRoot && path.resolve(packagePath) === path.resolve(gitRoot)) {
			const configuredHooksPath = getConfiguredHooksPath(packagePath);
			const normalizedHooksPath = normalizeGitHooksPath(configuredHooksPath);
			if (configuredHooksPath && normalizedHooksPath !== ".vite-hooks/_") return `core.hooksPath is already set to "${configuredHooksPath}" in workspace package "${pkg.path}" — leaving the existing hook setup unchanged.`;
		}
	}
	return null;
}
function getConfiguredHooksPath(projectPath) {
	const result = import_cross_spawn.default.sync("git", [
		"config",
		"--get",
		"core.hooksPath"
	], {
		cwd: projectPath,
		stdio: "pipe"
	});
	return result.status === 0 ? result.stdout?.toString().trim() ?? "" : "";
}
function normalizeGitHooksPath(hooksPath) {
	return path.posix.normalize(hooksPath.replaceAll("\\", "/")).replace(/\/$/, "");
}
/**
* High-level helper that sets up Vite+ hooks when no other hook tool owns the
* project. Husky setups are deliberately preserved for a dedicated migration.
*/
function installGitHooks(projectPath, silent = false, report, packageManager, packages = []) {
	return setupGitHooks(projectPath, silent, report, packageManager, packages);
}
/**
* Pre-flight check: verify that git hooks can be set up for this project.
* Returns `null` if hooks setup can proceed, or a warning reason string
* explaining why hooks setup should be skipped.
*
* These checks are deterministic and read-only — they do not modify
* the project in any way, making them safe to call before migration.
*
* The package manager argument remains for API compatibility with callers.
*/
function preflightGitHooksSetup(projectPath, _packageManager, packages = []) {
	const gitRoot = findGitRoot(projectPath);
	if (gitRoot && path.resolve(projectPath) !== path.resolve(gitRoot)) return "Subdirectory project detected — skipping git hooks setup. Configure hooks at the repository root.";
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return null;
	const pkgContent = readJsonFile(packageJsonPath);
	const deps = pkgContent.devDependencies;
	const prodDeps = pkgContent.dependencies;
	const configuredHooksPath = gitRoot ? getConfiguredHooksPath(projectPath) : "";
	const normalizedHooksPath = normalizeGitHooksPath(configuredHooksPath);
	if (hasHuskySetup(projectPath, pkgContent) || normalizedHooksPath === ".husky" || normalizedHooksPath.startsWith(".husky/")) return "Detected Husky — leaving its hooks, configuration, and dependencies unchanged. Migrate Husky manually before enabling Vite+ hooks.";
	for (const tool of OTHER_HOOK_TOOLS) if (deps?.[tool] || prodDeps?.[tool] || pkgContent[tool]) return `Detected ${tool} — skipping git hooks setup. Please configure git hooks manually, see https://viteplus.dev/guide/migrate#git-hook-tools`;
	const workspacePackageReason = findWorkspacePackageHookPolicy(projectPath, packages);
	if (workspacePackageReason) return workspacePackageReason;
	const disabledHooksEnvironment = [
		"HUSKY",
		"VP_GIT_HOOKS",
		"VITE_GIT_HOOKS"
	].find((name) => process.env[name] === "0");
	if (disabledHooksEnvironment) return `Git hooks are disabled through ${disabledHooksEnvironment}=0 — skipping git hooks setup.`;
	if (configuredHooksPath && normalizedHooksPath !== ".vite-hooks/_") return `core.hooksPath is already set to "${configuredHooksPath}" — leaving the existing hook setup unchanged.`;
	const unsafeInstallPath = findUnsafeHookInstallPath(projectPath, ".vite-hooks");
	if (unsafeInstallPath) return `Git hook dispatcher path "${unsafeInstallPath.relativePath}" is unsafe — leaving the existing hook setup unchanged.`;
	const nonRegularHookPath = findNonRegularViteHookPath(projectPath);
	if (nonRegularHookPath) return `Git hook path "${nonRegularHookPath}" is not a regular file — leaving the existing hook setup unchanged.`;
	if (hasUnsupportedLintStagedConfig(projectPath)) return "Unsupported lint-staged config format — skipping git hooks setup. Please configure git hooks manually.";
	return null;
}
/**
* Decide whether config rewriting must leave lint-staged configuration in
* place. Call this after scaffolding but before rewriting the project so an
* existing hook owner never observes a partially migrated configuration.
*/
function shouldSkipStagedMigrationForHooks(projectPath, shouldSetupHooks, packageManager, packages = []) {
	return !shouldSetupHooks || hasExistingViteHooksPolicy(projectPath) || preflightGitHooksSetup(projectPath, packageManager, packages) !== null;
}
/**
* Set up git hooks with husky + lint-staged via vp commands.
* Skips if another hook tool is detected (warns user).
* Returns true if hooks were successfully set up, false if skipped.
*/
function setupGitHooks(projectPath, silent = false, report, packageManager, packages = []) {
	const reason = preflightGitHooksSetup(projectPath, packageManager, packages);
	if (reason) {
		warnMigration(reason, report);
		return false;
	}
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return false;
	const gitRoot = findGitRoot(projectPath);
	const hooksDir = ".vite-hooks";
	const hasExistingHookPolicy = hasExistingViteHooksPolicy(projectPath);
	editJsonFile(packageJsonPath, (pkg) => {
		if (!pkg.scripts) pkg.scripts = {};
		if (!pkg.scripts.prepare) pkg.scripts.prepare = "vp config";
		else if (!pkg.scripts.prepare.includes("vp config")) pkg.scripts.prepare = `vp config && ${pkg.scripts.prepare}`;
		return pkg;
	});
	let stagedMerged = hasStagedConfigInViteConfig(projectPath);
	const hasStandaloneConfig = hasStandaloneLintStagedConfig(projectPath);
	if (!hasExistingHookPolicy && !stagedMerged && !hasStandaloneConfig) {
		const stagedConfig = readJsonFile(packageJsonPath)?.["lint-staged"] ?? DEFAULT_STAGED_CONFIG;
		const updated = rewriteScripts(JSON.stringify(stagedConfig), readRulesYaml());
		stagedMerged = mergeStagedConfigToViteConfig(projectPath, updated ? JSON.parse(updated) : stagedConfig, silent, report);
	}
	if (!hasExistingHookPolicy && stagedMerged) removeLintStagedFromPackageJson(packageJsonPath);
	if (!hasExistingHookPolicy && stagedMerged) createPreCommitHook(projectPath, hooksDir);
	if (!gitRoot) {
		if (!hasExistingHookPolicy && stagedMerged) removeReplacedStagedPackage(packageJsonPath);
		return true;
	}
	const vpBin = process.env.VP_CLI_BIN ?? "vp";
	const configResult = import_cross_spawn.default.sync(vpBin, ["config", "--no-agent"], {
		cwd: projectPath,
		stdio: "pipe"
	});
	if (configResult.status === 0) {
		const stdout = configResult.stdout?.toString().trim() ?? "";
		if (stdout) {
			warnMigration(`Git hooks not configured — ${stdout}`, report);
			return false;
		}
		if (!hasExistingHookPolicy && stagedMerged) removeReplacedStagedPackage(packageJsonPath);
		if (report) report.gitHooksConfigured = true;
		if (!silent) log.success("✔ Git hooks configured");
		return true;
	}
	warnMigration("Failed to install git hooks", report);
	return false;
}
/**
* Check if a standalone lint-staged config file exists
*/
function hasStandaloneLintStagedConfig(projectPath) {
	return LINT_STAGED_ALL_CONFIG_FILES.some((file) => fs.existsSync(path.join(projectPath, file)));
}
/**
* Check if a standalone lint-staged config exists in a format that can't be
* auto-migrated to "staged" in vite.config.ts (non-JSON files like .yaml,
* .mjs, .cjs, .js, or a non-JSON .lintstagedrc).
*/
function hasUnsupportedLintStagedConfig(projectPath) {
	for (const filename of LINT_STAGED_OTHER_CONFIG_FILES) if (fs.existsSync(path.join(projectPath, filename))) return true;
	const lintstagedrcPath = path.join(projectPath, ".lintstagedrc");
	if (fs.existsSync(lintstagedrcPath) && !isJsonFile(lintstagedrcPath)) return true;
	return false;
}
const DEFAULT_STAGED_CONFIG = { "*": "vp check --fix" };
function createPreCommitHook(projectPath, dir = ".vite-hooks") {
	const huskyDir = path.join(projectPath, dir);
	fs.mkdirSync(huskyDir, { recursive: true });
	const hookPath = path.join(huskyDir, "pre-commit");
	if (fs.existsSync(hookPath)) return;
	fs.writeFileSync(hookPath, "vp staged\n");
	fs.chmodSync(hookPath, 493);
}
//#endregion
//#region src/migration/migrator/setup.ts
function setPackageManager(projectDir, downloadPackageManager) {
	editJsonFile(path.join(projectDir, "package.json"), (pkg) => {
		if (!pkg.packageManager && !pkg.devEngines?.packageManager) pkg.devEngines = {
			...typeof pkg.devEngines === "object" && pkg.devEngines !== null && !Array.isArray(pkg.devEngines) ? pkg.devEngines : void 0,
			packageManager: {
				name: downloadPackageManager.name,
				version: downloadPackageManager.version,
				onFail: "download"
			}
		};
		return pkg;
	});
}
/**
* Detect a .nvmrc file in the project directory.
* If not found, check for a Volta node version in package.json.
* If either is found, return the relevant info for migration.
* Returns undefined if not found or .node-version already exists.
*/
function detectNodeVersionManagerFile(projectPath) {
	if (fs.existsSync(path.join(projectPath, ".node-version"))) return;
	const configs = detectConfigs(projectPath);
	if (configs.nvmrcFile) return configs.voltaNode ? {
		file: ".nvmrc",
		voltaPresent: true
	} : { file: ".nvmrc" };
	if (configs.voltaNode) return {
		file: "package.json",
		voltaNodeVersion: configs.voltaNode
	};
}
/**
* Parse a version alias from a .nvmrc file into a .node-version compatible string.
* Accepts the first line of .nvmrc (pre-trimmed).
* Returns null for unsupported aliases like "system", "default", "iojs".
*/
function parseNvmrcVersion(alias) {
	const version = alias.trim();
	if (!version) return null;
	if (version === "node" || version === "stable") return "lts/*";
	if (version === "iojs" || version === "system" || version === "default") return null;
	if (version.startsWith("lts/")) return version;
	const normalized = version.startsWith("v") ? version.slice(1) : version;
	if (!normalized || !import_semver.default.validRange(normalized)) return null;
	return normalized;
}
/**
* Match an `actions/setup-node` `node-version-file:` value that points at the
* now-removed `.nvmrc`, capturing the surrounding style so it can be preserved:
*   1. the key + whitespace (`node-version-file:` ...)
*   2. the optional opening quote (`'`, `"`, or none), reused as the closing quote
*   3. the optional `./` prefix
* The closing quote backreference (`\2`) plus the `(?=\s|$)` boundary keep this
* pinned to the exact value `.nvmrc` / `./.nvmrc` (quoted or bare) and prevent
* matching similar values such as `.nvmrc-backup`. Only `node-version-file:` lines
* are touched, so shell `cat .nvmrc` and comments are left alone.
*/
const NODE_VERSION_FILE_NVMRC_RE = /(node-version-file:[ \t]*)(['"]?)(\.\/)?\.nvmrc\2(?=\s|$)/gm;
/**
* Collect GitHub Actions YAML files that may carry a `node-version-file:`
* reference: top-level workflows (`.github/workflows/*.{yml,yaml}`, which GitHub
* runs only when flat in that directory) and composite action definitions
* (`.github/actions/**\/action.{yml,yaml}`, which may nest at any depth). Returns
* absolute paths; a missing `.github` tree just yields an empty list. `nocase`
* keeps the match case-insensitive on case-sensitive filesystems.
*/
function collectGithubActionFiles(projectPath) {
	return globSync(["workflows/*.{yml,yaml}", "actions/**/action.{yml,yaml}"], {
		cwd: path.join(projectPath, ".github"),
		absolute: true,
		nocase: true
	});
}
/**
* After `.nvmrc` is converted to `.node-version`, rewrite any GitHub Actions
* workflow or composite action that still references the removed file via
* `node-version-file:`, otherwise `actions/setup-node` fails in CI with "The
* specified node version file at: .../.nvmrc does not exist".
*
* Best-effort and narrowly scoped: scans the files from `collectGithubActionFiles`,
* only rewrites `node-version-file:` values (preserving the original
* quoting/indentation), and never fails the migration if a file cannot be
* read/written. Returns the relative paths of the files that were updated.
*/
function rewriteNodeVersionFileReferences(projectPath) {
	const updated = [];
	for (const filePath of collectGithubActionFiles(projectPath)) try {
		const original = fs.readFileSync(filePath, "utf8");
		const rewritten = original.replace(NODE_VERSION_FILE_NVMRC_RE, "$1$2$3.node-version$2");
		if (rewritten !== original) {
			fs.writeFileSync(filePath, rewritten);
			updated.push(path.relative(projectPath, filePath));
		}
	} catch {}
	return updated;
}
/**
* Migrate .nvmrc or Volta node version from package.json to .node-version.
* - For .nvmrc: the source file is removed after migration.
* - For package.json (Volta): the volta field is left as-is; removal is left to the user's discretion.
* Returns true on success, false if migration was skipped or failed.
*/
function migrateNodeVersionManagerFile(projectPath, detection, report) {
	const nodeVersionPath = path.join(projectPath, ".node-version");
	if (detection.file === "package.json") {
		const { voltaNodeVersion } = detection;
		const resolvedVersion = voltaNodeVersion === "lts" ? "lts/*" : voltaNodeVersion;
		if (!import_semver.default.valid(resolvedVersion) && resolvedVersion !== "lts/*") {
			warnMigration(`package.json volta.node "${voltaNodeVersion}" is not an exact version. Pin an exact version (e.g. ${voltaNodeVersion}.0 or run \`volta pin node@${voltaNodeVersion}\`) then re-run migration.`, report);
			return false;
		}
		fs.writeFileSync(nodeVersionPath, `${resolvedVersion}\n`);
		if (report) {
			report.manualSteps.push("Remove the \"volta\" field from package.json");
			report.nodeVersionFileMigrated = true;
		} else log.info("You can now remove the \"volta\" field from package.json manually.");
		return true;
	}
	const sourcePath = path.join(projectPath, ".nvmrc");
	const originalAlias = fs.readFileSync(sourcePath, "utf8").split("\n")[0]?.trim() ?? "";
	const version = parseNvmrcVersion(originalAlias);
	if (!version) {
		warnMigration(".nvmrc contains an unsupported version alias. Create .node-version manually with your desired Node.js version.", report);
		return false;
	}
	if (version === "lts/*" && (originalAlias === "node" || originalAlias === "stable")) log.info(`"${originalAlias}" in .nvmrc is not a specific version; automatically mapping to "lts/*"`);
	fs.writeFileSync(nodeVersionPath, `${version}\n`);
	fs.unlinkSync(sourcePath);
	const updatedFiles = rewriteNodeVersionFileReferences(projectPath);
	if (updatedFiles.length > 0) warnMigration(`Updated node-version-file from .nvmrc to .node-version in GitHub Actions file(s): ${updatedFiles.join(", ")}`, report);
	if (report) {
		report.nodeVersionFileMigrated = true;
		if (detection.voltaPresent) report.manualSteps.push("Remove the \"volta\" field from package.json");
	} else if (detection.voltaPresent) log.info("You can now remove the \"volta\" field from package.json manually.");
	return true;
}
//#endregion
//#region src/migration/migrator/core-finalization.ts
const RULES_YAML_PATH = path.join(rulesDir, "vite-tools.yml");
path.join(rulesDir, "vite-prepare.yml");
let cachedRulesYaml;
let cachedRulesYamlNoLintStaged;
function readRulesYaml() {
	cachedRulesYaml ??= fs.readFileSync(RULES_YAML_PATH, "utf8");
	return cachedRulesYaml;
}
function splitRuleDocuments(yaml) {
	const lines = yaml.split("\n");
	const documents = [];
	let start = 0;
	for (const [index, line] of lines.entries()) {
		if (line.trimEnd() !== "---") continue;
		let documentStart = index;
		while (documentStart > start && lines[documentStart - 1].trimStart().startsWith("#")) documentStart--;
		if (documentStart > start) {
			documents.push(lines.slice(start, documentStart).join("\n"));
			start = documentStart;
		}
	}
	documents.push(lines.slice(start).join("\n"));
	return documents;
}
function getScriptRulesYaml(skipStagedMigration) {
	const yaml = readRulesYaml();
	if (!skipStagedMigration) return yaml;
	cachedRulesYamlNoLintStaged ??= splitRuleDocuments(yaml).filter((document) => !document.includes("id: replace-lint-staged")).join("\n");
	return cachedRulesYamlNoLintStaged;
}
function getCoreMigrationProjectPaths(workspaceInfo) {
	return [workspaceInfo.rootDir, ...(workspaceInfo.packages ?? []).map((pkg) => path.join(workspaceInfo.rootDir, pkg.path))];
}
function hasCorePackageScriptRewrites(projectPath) {
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return false;
	const pkg = readJsonFile(packageJsonPath);
	if (!pkg.scripts) return false;
	return !!rewriteScripts(JSON.stringify(pkg.scripts), getScriptRulesYaml(true));
}
function rewriteCorePackageScripts(projectPath) {
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return false;
	let changed = false;
	editJsonFile(packageJsonPath, (pkg) => {
		if (!pkg.scripts) return;
		const updated = rewriteScripts(JSON.stringify(pkg.scripts), getScriptRulesYaml(true));
		if (!updated) return;
		pkg.scripts = JSON.parse(updated);
		changed = true;
		return pkg;
	});
	return changed;
}
function detectPendingCoreMigration(workspaceInfo) {
	const projectPaths = getCoreMigrationProjectPaths(workspaceInfo);
	return {
		scripts: projectPaths.some((projectPath) => hasCorePackageScriptRewrites(projectPath)),
		tsconfigTypes: projectPaths.some((projectPath) => hasTsconfigTypesToRewrite(projectPath))
	};
}
function finalizeCoreMigrationForExistingVitePlus(workspaceInfo, silent = false, report, pending = detectPendingCoreMigration(workspaceInfo)) {
	const projectPaths = getCoreMigrationProjectPaths(workspaceInfo);
	const result = {
		scripts: false,
		tsconfigTypes: false,
		imports: false
	};
	if (pending.scripts) for (const projectPath of projectPaths) result.scripts = rewriteCorePackageScripts(projectPath) || result.scripts;
	if (pending.tsconfigTypes) for (const projectPath of projectPaths) result.tsconfigTypes = rewriteTsconfigTypes(projectPath, silent, report) || result.tsconfigTypes;
	result.imports = rewriteAllImports(workspaceInfo.rootDir, silent, report, true);
	return result;
}
//#endregion
//#region src/migration/migrator/orchestrators.ts
function rewriteStandaloneProject(projectPath, workspaceInfo, skipStagedMigration, silent = false, report) {
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return;
	const packageManager = workspaceInfo.packageManager;
	const catalogDependencyResolver = createCatalogDependencyResolver(projectPath, packageManager);
	const vitestEcosystemPackages = collectVitestEcosystemInstallDependencyNames(projectPath);
	const providerSourceModes = collectProviderSourceModes(projectPath);
	const browserMode = usesVitestBrowserMode(projectPath);
	const retainedVitestModule = sourceTreeReferencesRetainedVitestModule(projectPath);
	const providerCatalogAdditions = collectInjectedProviderNames(projectPath, void 0, /* @__PURE__ */ new Map([[projectPath, providerSourceModes]]));
	const pnpmMajorVersion = pnpmMajor(workspaceInfo.downloadPackageManager.version);
	let extractedStagedConfig = null;
	let movedPnpmSettings;
	let shouldAddPnpmWorkspaceVitePlusOverride = false;
	let shouldAllowBrowserProviderBuilds = false;
	let usesVitest = false;
	const usePnpmWorkspaceYaml = packageManager === PackageManager.pnpm && pnpmSupportsWorkspaceSettings(workspaceInfo.downloadPackageManager.version);
	const supportCatalog = supportsCatalog(packageManager, workspaceInfo.downloadPackageManager.version);
	editJsonFile(packageJsonPath, (pkg) => {
		shouldAllowBrowserProviderBuilds = hasOwnWebdriverioDependency(pkg) || usesWebdriverioProvider(projectPath);
		const requiredVitestPeer = projectListsRequiredVitestPeer(projectPath, pkg);
		usesVitest = projectUsesVitestDirectly(projectPath, pkg, requiredVitestPeer, true, {
			browserMode,
			retainedModule: retainedVitestModule
		});
		const managed = managedOverridePackages(usesVitest);
		pruneLegacyWrapperAliases(pkg.resolutions);
		pruneLegacyWrapperAliases(pkg.overrides);
		pruneLegacyWrapperAliases(pkg.pnpm?.overrides);
		dropRemovePackageOverrideKeys(pkg.resolutions);
		dropRemovePackageOverrideKeys(pkg.overrides);
		if (!usesVitest) {
			removeManagedVitestEntry(pkg.resolutions);
			removeManagedVitestEntry(pkg.overrides);
		}
		if (packageManager === PackageManager.yarn) pkg.resolutions = {
			...pkg.resolutions,
			...managed
		};
		else if (packageManager === PackageManager.npm || packageManager === PackageManager.bun) {
			pkg.overrides = {
				...pkg.overrides,
				...managed
			};
			if (packageManager === PackageManager.bun) setDirectViteEdge(pkg, supportCatalog, catalogDependencyResolver);
		} else if (packageManager === PackageManager.pnpm) {
			if (usePnpmWorkspaceYaml) shouldAddPnpmWorkspaceVitePlusOverride = isForceOverrideMode();
			const overrideKeys = Object.keys(managed);
			if (!usePnpmWorkspaceYaml) {
				dropRemovePackageOverrideKeys(pkg.pnpm?.overrides);
				if (!usesVitest) {
					removeManagedVitestEntry(pkg.pnpm?.overrides, "pnpm-ranged");
					if (pkg.pnpm?.peerDependencyRules) removeVitestPeerDependencyRule(pkg.pnpm.peerDependencyRules);
				}
				pkg.pnpm = {
					...pkg.pnpm,
					overrides: mergeManagedPnpmOverrides(pkg.pnpm?.overrides, managed),
					peerDependencyRules: {
						...pkg.pnpm?.peerDependencyRules,
						allowAny: [.../* @__PURE__ */ new Set([...pkg.pnpm?.peerDependencyRules?.allowAny ?? [], ...overrideKeys])],
						allowedVersions: {
							...pkg.pnpm?.peerDependencyRules?.allowedVersions,
							...Object.fromEntries(overrideKeys.map((key) => [key, "*"]))
						}
					}
				};
			} else movedPnpmSettings = takePnpmWorkspaceSettings(pkg);
			for (const key in pkg.pnpm?.overrides) if (key.includes(">")) {
				const splits = key.split(">");
				if (splits[splits.length - 1].trim() === "vite") delete pkg.pnpm.overrides[key];
			}
			for (const key of [...overrideKeys, ...PROVIDER_OVERRIDE_DROP_NAMES]) if (pkg.resolutions?.[key]) delete pkg.resolutions[key];
			if (!usePnpmWorkspaceYaml && pnpmMajorVersion !== void 0 && pkg.pnpm) applyBuildAllowanceToPackageJsonPnpm(pkg.pnpm, pnpmMajorVersion, shouldAllowBrowserProviderBuilds);
		}
		extractedStagedConfig = rewritePackageJson(pkg, packageManager, supportCatalog, skipStagedMigration, catalogDependencyResolver, browserMode, providerSourceModes, usesVitest, retainedVitestModule, requiredVitestPeer, providerCatalogAdditions);
		const forceRepinExistingDevEntry = isForceOverrideMode() && pkg.devDependencies?.["vite-plus"] !== void 0;
		if (!hasDirectVitePlusInstallEntry(pkg) || forceRepinExistingDevEntry) {
			const existingVitePlusSpec = pkg.devDependencies?.[VITE_PLUS_NAME];
			const version = supportCatalog && !VITE_PLUS_VERSION.startsWith("file:") ? existingVitePlusSpec?.startsWith("catalog:") ? existingVitePlusSpec : catalogDependencyResolver?.preferredCatalogSpec ?? "catalog:" : VITE_PLUS_VERSION;
			pkg.devDependencies = {
				...pkg.devDependencies,
				[VITE_PLUS_NAME]: version
			};
		}
		ensureDirectViteForPnpm(pkg, packageManager, supportCatalog, catalogDependencyResolver);
		return pkg;
	});
	migratePnpmSettingsToWorkspaceYaml(projectPath, movedPnpmSettings);
	if (packageManager === PackageManager.pnpm && (usePnpmWorkspaceYaml || supportCatalog)) rewritePnpmWorkspaceYaml(projectPath, pnpmMajorVersion, shouldAllowBrowserProviderBuilds, usesVitest, vitestEcosystemPackages, usePnpmWorkspaceYaml, providerCatalogAdditions);
	if (shouldAddPnpmWorkspaceVitePlusOverride) migratePnpmOverridesToWorkspaceYaml(projectPath, { [VITE_PLUS_NAME]: VITE_PLUS_VERSION });
	if (packageManager === PackageManager.pnpm) ensurePnpmWorkspaceExoticSubdepsSetting(projectPath);
	if (packageManager === PackageManager.yarn) rewriteYarnrcYml(projectPath, usesVitest, vitestEcosystemPackages, providerCatalogAdditions, supportCatalog);
	if (extractedStagedConfig) {
		if (mergeStagedConfigToViteConfig(projectPath, extractedStagedConfig, silent, report)) removeLintStagedFromPackageJson(packageJsonPath);
	}
	if (!skipStagedMigration) rewriteLintStagedConfigFile(projectPath, report);
	cleanupDeprecatedTsconfigOptions(projectPath, silent, report);
	rewriteTsconfigTypes(projectPath, silent, report);
	mergeViteConfigFiles(projectPath, silent, report, workspaceInfo.packages);
	injectLintTypeCheckDefaults(projectPath, silent, report);
	injectFmtDefaults(projectPath, silent, report);
	mergeTsdownConfigFile(projectPath, silent, report);
	rewriteAllImports(projectPath, silent, report, true);
	wrapLazyPluginsInViteConfig(projectPath, silent, report);
	setPackageManager(projectPath, workspaceInfo.downloadPackageManager);
}
/**
* Rewrite monorepo to add vite-plus dependencies
* @param workspaceInfo - The workspace info
*/
function rewriteMonorepo(workspaceInfo, skipStagedMigration, silent = false, report) {
	const catalogDependencyResolver = createCatalogDependencyResolver(workspaceInfo.rootDir, workspaceInfo.packageManager);
	const pnpmMajorVersion = pnpmMajor(workspaceInfo.downloadPackageManager.version);
	const usePnpmWorkspaceSettings = pnpmSupportsWorkspaceSettings(workspaceInfo.downloadPackageManager.version);
	const workspaceShouldAllowBrowserBuilds = workspaceUsesWebdriverio(workspaceInfo.rootDir, workspaceInfo.packages);
	const workspaceUsesVitest = workspaceUsesVitestDirectly(workspaceInfo.rootDir, workspaceInfo.packages, true);
	const vitestEcosystemPackages = collectVitestEcosystemInstallDependencyNames(workspaceInfo.rootDir, workspaceInfo.packages);
	const providerCatalogAdditions = collectInjectedProviderNames(workspaceInfo.rootDir, workspaceInfo.packages);
	const supportCatalog = supportsCatalog(workspaceInfo.packageManager, workspaceInfo.downloadPackageManager.version, true);
	if (workspaceInfo.packageManager === PackageManager.yarn) rewriteYarnrcYml(workspaceInfo.rootDir, workspaceUsesVitest, vitestEcosystemPackages, providerCatalogAdditions, supportCatalog);
	else if (workspaceInfo.packageManager === PackageManager.bun) rewriteBunCatalog(workspaceInfo.rootDir, workspaceUsesVitest, vitestEcosystemPackages);
	rewriteRootWorkspacePackageJson(workspaceInfo.rootDir, workspaceInfo.packageManager, skipStagedMigration, catalogDependencyResolver, workspaceInfo.packages, pnpmMajorVersion, workspaceInfo.downloadPackageManager.version, workspaceShouldAllowBrowserBuilds, workspaceUsesVitest, supportCatalog);
	if (workspaceInfo.packageManager === PackageManager.pnpm) {
		rewritePnpmWorkspaceYaml(workspaceInfo.rootDir, pnpmMajorVersion, workspaceShouldAllowBrowserBuilds, workspaceUsesVitest, vitestEcosystemPackages, usePnpmWorkspaceSettings, providerCatalogAdditions);
		if (usePnpmWorkspaceSettings && isForceOverrideMode()) migratePnpmOverridesToWorkspaceYaml(workspaceInfo.rootDir, { [VITE_PLUS_NAME]: VITE_PLUS_VERSION });
	}
	const workspaceContext = {
		rootDir: workspaceInfo.rootDir,
		packages: workspaceInfo.packages
	};
	for (const pkg of workspaceInfo.packages) rewriteMonorepoProject(path.join(workspaceInfo.rootDir, pkg.path), workspaceInfo.packageManager, skipStagedMigration, silent, report, catalogDependencyResolver, workspaceContext, true, supportCatalog, providerCatalogAdditions);
	if (!skipStagedMigration) rewriteLintStagedConfigFile(workspaceInfo.rootDir, report);
	cleanupDeprecatedTsconfigOptions(workspaceInfo.rootDir, silent, report);
	rewriteTsconfigTypes(workspaceInfo.rootDir, silent, report);
	mergeViteConfigFiles(workspaceInfo.rootDir, silent, report, workspaceInfo.packages);
	injectLintTypeCheckDefaults(workspaceInfo.rootDir, silent, report);
	injectFmtDefaults(workspaceInfo.rootDir, silent, report);
	mergeTsdownConfigFile(workspaceInfo.rootDir, silent, report);
	rewriteAllImports(workspaceInfo.rootDir, silent, report, true);
	wrapLazyPluginsInViteConfig(workspaceInfo.rootDir, silent, report);
	for (const pkg of workspaceInfo.packages) wrapLazyPluginsInViteConfig(path.join(workspaceInfo.rootDir, pkg.path), silent, report);
	setPackageManager(workspaceInfo.rootDir, workspaceInfo.downloadPackageManager);
}
/**
* Rewrite monorepo project to add vite-plus dependencies
* @param projectPath - The path to the project
* @param workspaceContext - Full workspace info, used so the lint-config
*   sanitizer can see hoisted deps living elsewhere in the workspace,
*   not just this sub-package's own `package.json`. `rootDir` is the
*   workspace root (paths in `packages` are relative to it); `packages`
*   is the workspace package list.
*/
function rewriteMonorepoProject(projectPath, packageManager, skipStagedMigration, silent = false, report, catalogDependencyResolver, workspaceContext, deferLazyPluginWrapping = false, supportCatalog = true, providerCatalogAdditions = /* @__PURE__ */ new Set()) {
	cleanupDeprecatedTsconfigOptions(projectPath, silent, report);
	rewriteTsconfigTypes(projectPath, silent, report);
	mergeViteConfigFiles(projectPath, silent, report, workspaceContext?.packages, workspaceContext?.rootDir);
	mergeTsdownConfigFile(projectPath, silent, report);
	const packageJsonPath = path.join(projectPath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return;
	const yarnHoisting = packageManager === PackageManager.yarn ? findYarnWorkspaceHoisting(workspaceContext?.rootDir ?? projectPath) : void 0;
	let extractedStagedConfig = null;
	editJsonFile(packageJsonPath, (pkg) => {
		const requiredVitestPeer = projectListsRequiredVitestPeer(projectPath, pkg);
		const browserMode = usesVitestBrowserMode(projectPath);
		const retainedVitestModule = sourceTreeReferencesRetainedVitestModule(projectPath);
		extractedStagedConfig = rewritePackageJson(pkg, packageManager, supportCatalog, skipStagedMigration, catalogDependencyResolver, browserMode, collectProviderSourceModes(projectPath), projectUsesVitestDirectly(projectPath, pkg, requiredVitestPeer, true, {
			browserMode,
			retainedModule: retainedVitestModule
		}), retainedVitestModule, requiredVitestPeer, providerCatalogAdditions);
		if (yarnHoisting && path.resolve(projectPath) !== yarnHoisting.rootDir && hasDirectVitePlusInstallEntry(pkg)) applyYarnWorkspaceHoistingFix(pkg, yarnHoisting.limit, yarnHoisting.nodeLinker, path.relative(yarnHoisting.rootDir, projectPath) || projectPath, report);
		return pkg;
	});
	if (extractedStagedConfig) {
		if (mergeStagedConfigToViteConfig(projectPath, extractedStagedConfig, silent, report)) removeLintStagedFromPackageJson(packageJsonPath);
	}
	if (!deferLazyPluginWrapping) wrapLazyPluginsInViteConfig(projectPath, silent, report);
}
//#endregion
//#region src/utils/editor.ts
const VSCODE_SETTINGS = {
	"editor.defaultFormatter": "oxc.oxc-vscode",
	"[javascript]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
	"[javascriptreact]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
	"[typescript]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
	"[typescriptreact]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
	"oxc.disableNestedConfig": true,
	"oxc.fmt.disableNestedConfig": true,
	"editor.formatOnSave": true,
	"editor.formatOnSaveMode": "file",
	"editor.codeActionsOnSave": { "source.fixAll.oxc": "explicit" }
};
const VSCODE_EXTENSIONS = { recommendations: ["VoidZero.vite-plus-extension-pack"] };
const ZED_SETTINGS = {
	lsp: {
		oxlint: { initialization_options: { settings: {
			run: "onType",
			fixKind: "safe_fix",
			typeAware: true,
			unusedDisableDirectives: "deny"
		} } },
		oxfmt: { initialization_options: { settings: {
			"fmt.configPath": "./vite.config.ts",
			run: "onSave"
		} } }
	},
	languages: Object.fromEntries([
		"CSS",
		"GraphQL",
		"Handlebars",
		"HTML",
		"JavaScript",
		"JSX",
		"JSON",
		"JSON5",
		"JSONC",
		"Less",
		"Markdown",
		"MDX",
		"SCSS",
		"TypeScript",
		"TSX",
		"Vue.js",
		"YAML"
	].map((language) => [language, {
		format_on_save: "on",
		prettier: { allowed: false },
		formatter: [{ language_server: { name: "oxfmt" } }],
		...language === "JavaScript" ? { code_action: "source.fixAll.oxc" } : {}
	}]))
};
const JETBRAINS_EXTERNAL_DEPENDENCIES = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ExternalDependencies">
    <plugin id="com.github.oxc.project.oxcintellijplugin" />
  </component>
</project>
`;
function jetbrainsNodeInterpreterPath() {
	return path.join(getVpDirs().bin, process.platform === "win32" ? "node.exe" : "node");
}
function jetbrainsWorkspaceConfig(packageManager) {
	return `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="PropertiesComponent">
    <![CDATA[${JSON.stringify({ keyToString: {
		"javascript.preferred.runtime.type.id": "node",
		nodejs_interpreter_path: jetbrainsNodeInterpreterPath(),
		nodejs_package_manager_path: packageManager
	} }, null, 2)}]]>
  </component>
</project>
`;
}
const EDITORS = [
	{
		id: "vscode",
		label: "VSCode",
		targetDir: ".vscode",
		files: {
			"settings.json": VSCODE_SETTINGS,
			"extensions.json": VSCODE_EXTENSIONS
		}
	},
	{
		id: "zed",
		label: "Zed",
		targetDir: ".zed",
		files: { "settings.json": ZED_SETTINGS }
	},
	{
		id: "jetbrains",
		label: "JetBrains (IntelliJ, WebStorm, etc)",
		targetDir: ".idea",
		files: {
			"externalDependencies.xml": JETBRAINS_EXTERNAL_DEPENDENCIES,
			"workspace.xml": jetbrainsWorkspaceConfig(PackageManager.pnpm),
			"OxfmtSettings.xml": `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="OxfmtSettings">
    <option name="preferOxfmtCodeStyleSettings" value="true" />
  </component>
</project>
`
		}
	}
];
const EDITOR_ALIASES = [{
	id: "intellij",
	alias: "jetbrains"
}, {
	id: "webstorm",
	alias: "jetbrains"
}];
async function selectEditor({ interactive, editor, onCancel }) {
	if (editor === false) return;
	if (interactive && !editor) {
		const editorOptions = EDITORS.map((option) => ({
			label: option.label,
			value: option.id,
			hint: option.targetDir
		}));
		const otherOption = {
			label: "Other",
			value: null,
			hint: "Skip writing editor configs"
		};
		const selectedEditor = await select({
			message: "Which editor are you using?\n  " + styleText("gray", "Writes editor config files to enable recommended extensions and Oxlint/Oxfmt integrations."),
			options: [...editorOptions, otherOption],
			initialValue: "vscode"
		});
		if (isCancel(selectedEditor)) {
			onCancel();
			return;
		}
		if (selectedEditor === null) return;
		return resolveEditorId(selectedEditor);
	}
	if (editor) return resolveEditorId(editor);
}
async function selectEditors({ interactive, editor, onCancel }) {
	if (editor === false) return;
	if (interactive && !editor) {
		const selectedEditors = await multiselect({
			message: "Which editors are you using?\n  " + styleText("gray", "Writes editor config files to enable recommended extensions and Oxlint/Oxfmt integrations."),
			options: EDITORS.map((option) => ({
				label: option.label,
				value: option.id,
				hint: option.targetDir
			})),
			initialValues: ["vscode"],
			required: false
		});
		if (isCancel(selectedEditors)) {
			onCancel();
			return;
		}
		return selectedEditors.length === 0 ? void 0 : resolveEditorIds(selectedEditors);
	}
	if (editor) {
		const editorId = resolveEditorId(editor);
		return editorId ? [editorId] : void 0;
	}
}
function detectExistingEditors(projectRoot) {
	const editors = [];
	for (const option of EDITORS) for (const fileName of Object.keys(option.files)) {
		const filePath = path.join(projectRoot, option.targetDir, fileName);
		if (fs.existsSync(filePath)) {
			editors.push(option.id);
			break;
		}
	}
	return editors.length === 0 ? void 0 : editors;
}
/**
* Detect editor config files that would conflict (already exist).
* Read-only — does not write or modify any files.
*/
function detectEditorConflicts({ projectRoot, editorId }) {
	if (!editorId) return [];
	const editorConfig = EDITORS.find((e) => e.id === editorId);
	if (!editorConfig) return [];
	const conflicts = [];
	for (const fileName of Object.keys(editorConfig.files)) {
		const filePath = path.join(projectRoot, editorConfig.targetDir, fileName);
		if (fs.existsSync(filePath)) conflicts.push({
			fileName,
			displayPath: `${editorConfig.targetDir}/${fileName}`
		});
	}
	return conflicts;
}
async function writeEditorConfigs({ projectRoot, editorId, interactive, conflictDecisions, silent = false, extraVsCodeSettings, packageManager = PackageManager.pnpm }) {
	const editorIds = normalizeEditorSelection(editorId);
	if (editorIds.length === 0) return;
	for (const currentEditorId of editorIds) await writeEditorConfig({
		projectRoot,
		editorId: currentEditorId,
		interactive,
		conflictDecisions,
		silent,
		extraVsCodeSettings,
		packageManager
	});
}
async function writeEditorConfig({ projectRoot, editorId, interactive, conflictDecisions, silent, extraVsCodeSettings, packageManager }) {
	const editorConfig = EDITORS.find((e) => e.id === editorId);
	if (!editorConfig) return;
	const targetDir = path.join(projectRoot, editorConfig.targetDir);
	await fsPromises.mkdir(targetDir, { recursive: true });
	for (const [fileName, baseIncoming] of Object.entries(editorConfig.files)) {
		const incoming = editorId === "vscode" && fileName === "settings.json" && extraVsCodeSettings ? {
			...extraVsCodeSettings,
			...baseIncoming
		} : editorId === "jetbrains" && fileName === "workspace.xml" ? jetbrainsWorkspaceConfig(packageManager) : baseIncoming;
		const filePath = path.join(targetDir, fileName);
		const jsonFormat = isJsonLikeFile(fileName);
		if (fs.existsSync(filePath)) {
			const displayPath = `${editorConfig.targetDir}/${fileName}`;
			let conflictAction;
			const preResolved = conflictDecisions?.get(displayPath) ?? conflictDecisions?.get(fileName);
			if (preResolved) conflictAction = preResolved;
			else if (interactive) {
				const action = await select({
					message: `${displayPath} already exists.\n  ` + styleText("gray", jsonFormat ? `Vite+ adds ${editorConfig.label} settings for the built-in linter and formatter. Merge adds new keys without overwriting existing ones.` : `Vite+ adds ${editorConfig.label} settings for the built-in linter and formatter. Overwrite replaces the existing file with the generated config.`),
					options: [{
						label: jsonFormat ? "Merge" : "Overwrite",
						value: "merge",
						hint: jsonFormat ? "Merge new settings into existing file" : "Replace existing file with generated config"
					}, {
						label: "Skip",
						value: "skip",
						hint: "Leave existing file unchanged"
					}],
					initialValue: "skip"
				});
				conflictAction = isCancel(action) || action === "skip" ? "skip" : "merge";
			} else conflictAction = jsonFormat ? "merge" : "skip";
			if (conflictAction === "merge") {
				if (jsonFormat) {
					if (!isPlainObject(incoming)) throw new Error(`Cannot merge editor config: ${displayPath} incoming value is not JSON`);
					mergeAndWriteEditorConfig(filePath, incoming, fileName, displayPath, silent);
				} else writeTextEditorConfig(filePath, incoming, displayPath, silent);
			} else if (!silent) log.info(`Skipped writing ${displayPath}`);
			continue;
		}
		if (jsonFormat) {
			if (!isPlainObject(incoming)) throw new Error(`Cannot write editor config: ${editorConfig.targetDir}/${fileName} must be JSON`);
			writeJsonFile(filePath, incoming);
		} else writeTextEditorConfig(filePath, incoming, `${editorConfig.targetDir}/${fileName}`, silent);
		if (!silent) log.success(`Wrote editor config to ${editorConfig.targetDir}/${fileName}`);
	}
}
function isJsonLikeFile(fileName) {
	const ext = path.extname(fileName).toLowerCase();
	return ext === ".json" || ext === ".jsonc";
}
function writeTextEditorConfig(filePath, incoming, displayPath, silent = false) {
	if (typeof incoming !== "string") throw new Error(`Cannot write editor config: ${displayPath} must be text content`);
	if ((fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : void 0) === incoming) {
		if (!silent) log.info(`No changes needed for ${displayPath}`);
		return;
	}
	fs.writeFileSync(filePath, incoming, "utf-8");
}
function normalizeEditorSelection(editorId) {
	if (!editorId) return [];
	return [...new Set(Array.isArray(editorId) ? editorId : [editorId])];
}
/**
* Merge incoming settings into an existing editor JSON/JSONC file by patching the
* original text with `jsonc-parser` instead of re-serializing a merged object.
* This preserves comments, key order, trailing commas, and untouched formatting.
* Existing values always win; only missing keys/branches are inserted.
*/
function mergeAndWriteEditorConfig(filePath, incoming, fileName, displayPath, silent = false) {
	const originalText = fs.readFileSync(filePath, "utf-8");
	const existing = parse(originalText);
	if (!isPlainObject(existing)) throw new Error(`Cannot merge editor config: ${displayPath} is not a JSON object`);
	const formattingOptions = detectFormattingOptions(originalText);
	const newText = fileName === "extensions.json" ? mergeExtensionsText(originalText, existing, incoming, formattingOptions) : mergeSettingsText(originalText, existing, incoming, formattingOptions);
	if (newText === originalText) {
		if (!silent) log.info(`No changes needed for ${displayPath}`);
		return;
	}
	fs.writeFileSync(filePath, newText, "utf-8");
	if (!silent) log.success(`Merged editor config into ${displayPath}`);
}
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Apply a single `jsonc-parser` modification to `text` and return the patched text. */
function applyJsoncEdit(text, path, value, options) {
	return applyEdits(text, modify(text, path, value, options));
}
/**
* Deep-merge missing keys from `incoming` into the existing text. Inserts a whole
* branch when it is absent, and recurses only when both sides are non-array objects
* so comments inside existing branches are preserved.
*/
function mergeSettingsText(text, existing, incoming, formattingOptions) {
	let currentText = text;
	const insertMissing = (existingNode, incomingNode, basePath) => {
		for (const [key, value] of Object.entries(incomingNode)) {
			const fullPath = [...basePath, key];
			if (!(key in existingNode)) currentText = applyJsoncEdit(currentText, fullPath, value, { formattingOptions });
			else if (isPlainObject(existingNode[key]) && isPlainObject(value)) insertMissing(existingNode[key], value, fullPath);
		}
	};
	insertMissing(existing, incoming, []);
	return currentText;
}
/**
* For `extensions.json`, append missing recommendations without rebuilding the array,
* so comments inside the array survive. Existing entries always win.
*/
function mergeExtensionsText(text, existing, incoming, formattingOptions) {
	const incomingRecs = Array.isArray(incoming["recommendations"]) ? incoming["recommendations"] : [];
	const existingValue = existing["recommendations"];
	if (!("recommendations" in existing)) return applyJsoncEdit(text, ["recommendations"], incomingRecs, { formattingOptions });
	if (!Array.isArray(existingValue)) return text;
	const existingRecs = new Set(existingValue);
	let currentText = text;
	let nextIndex = existingValue.length;
	for (const rec of incomingRecs) {
		if (existingRecs.has(rec)) continue;
		currentText = applyJsoncEdit(currentText, ["recommendations", nextIndex], rec, {
			formattingOptions,
			isArrayInsertion: true
		});
		nextIndex++;
	}
	return currentText;
}
function resolveEditorId(editor) {
	const normalized = editor.trim().toLowerCase();
	const match = EDITORS.find((option) => option.id === normalized || option.label.toLowerCase() === normalized);
	if (match) return match.id;
	const aliasMatch = EDITOR_ALIASES.find((option) => option.id === normalized);
	if (aliasMatch) {
		log.warn(`--editor ${aliasMatch.id} was passed; use --editor ${aliasMatch.alias} instead, as it's the canonical ID for that editor.`);
		return aliasMatch.alias;
	}
}
function resolveEditorIds(editors) {
	const editorIds = editors.flatMap((editor) => {
		const editorId = resolveEditorId(editor);
		return editorId ? [editorId] : [];
	});
	const uniqueEditorIds = [...new Set(editorIds)];
	return uniqueEditorIds.length === 0 ? void 0 : uniqueEditorIds;
}
//#endregion
export { warnLegacyEslintConfig as $, detectWorkspace$1 as A, promptTsupMigration as B, mergeTsdownConfigFile as C, ensureVitePlusBootstrap as D, detectVitePlusBootstrapPending as E, detectFramework as F, promptPrettierMigration as G, confirmPrettierMigration as H, hasFrameworkShim as I, detectEslintProject as J, warnPackageLevelPrettier as K, confirmTsupMigration as L, updatePackageJsonWithDeps as M, updateWorkspaceConfig as N, configureYarnNodeModulesMode as O, addFrameworkShim as P, warnIncompatibleEslintIntegration as Q, detectTsupProject as R, injectLintTypeCheckDefaults as S, collectToolchainVersionChanges as T, detectPrettierProject as U, warnMissingTsupConfig as V, migratePrettierToOxfmt as W, migrateEslintToOxlint as X, detectIncompatibleEslintIntegration as Y, promptEslintMigration as Z, preflightGitHooksSetup as _, selectEditors as a, initGitRepository as b, rewriteMonorepoProject as c, finalizeCoreMigrationForExistingVitePlus as d, warnPackageLevelEslint as et, detectNodeVersionManagerFile as f, installGitHooks as g, detectLegacyGitHooksMigrationCandidate as h, selectEditor as i, isBingoTemplate as j, detectYarnPnpMode as k, rewriteStandaloneProject as l, setPackageManager as m, detectExistingEditors as n, checkVitestVersion as nt, writeEditorConfigs as o, migrateNodeVersionManagerFile as p, confirmEslintMigration as q, isJsonLikeFile as r, rewriteMonorepo as s, detectEditorConflicts as t, checkViteVersion as tt, detectPendingCoreMigration as u, shouldSkipStagedMigrationForHooks as v, mergeViteConfigFiles as w, injectCreateDefaultTemplate as x, findGitRoot as y, migrateTsupToTsdown as z };
