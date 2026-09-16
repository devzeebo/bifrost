import { r as __toESM } from "../rolldown-runtime-CMFfr-1z.js";
import { t as renderCliDoc } from "../help-BmKpeOP9.js";
import { a as muted, c as warnMsg, i as log, o as printHeader, r as formatDuration, t as accent } from "../terminal-MKGAuy-p.js";
import { f as VITE_PLUS_VERSION, m as isForceOverrideMode } from "../constants-Bn-U8o4v.js";
import { A as isCancel, C as log$1, D as spinner, E as select, T as outro, b as require_semver, c as selectPackageManager, i as promptGitHooks, l as upgradeYarn, n as defaultInteractive, o as runViteFmt, r as downloadPackageManager, s as runViteInstall, t as cancelAndExit, x as confirm, y as PackageManager } from "../prompts-DF3yU-eU.js";
import { t as lib_default } from "../lib-L3DWSRQp.js";
import { a as writeJsonFile, i as readJsonFile } from "../json-cULBl7Pi.js";
import { a as readNearestPackageJson, i as hasVitePlusDependency } from "../package-CBe9EWPY.js";
import { i as selectAgentTargetPaths, l as displayRelative, n as detectAgentConflicts, r as detectExistingAgentTargetPaths, s as writeAgentInstructions } from "../agent-Wqx0MPk0.js";
import { n as addMigrationWarning, r as createMigrationReport } from "../report-ZNR1Mk6h.js";
import { $ as warnLegacyEslintConfig, A as detectWorkspace, C as mergeTsdownConfigFile, D as ensureVitePlusBootstrap, E as detectVitePlusBootstrapPending, F as detectFramework, H as confirmPrettierMigration, I as hasFrameworkShim, J as detectEslintProject, K as warnPackageLevelPrettier, L as confirmTsupMigration, O as configureYarnNodeModulesMode, P as addFrameworkShim, Q as warnIncompatibleEslintIntegration, R as detectTsupProject, S as injectLintTypeCheckDefaults, T as collectToolchainVersionChanges, U as detectPrettierProject, V as warnMissingTsupConfig, W as migratePrettierToOxfmt, X as migrateEslintToOxlint, Y as detectIncompatibleEslintIntegration, _ as preflightGitHooksSetup, d as finalizeCoreMigrationForExistingVitePlus, et as warnPackageLevelEslint, f as detectNodeVersionManagerFile, g as installGitHooks, h as detectLegacyGitHooksMigrationCandidate, i as selectEditor, k as detectYarnPnpMode, l as rewriteStandaloneProject, nt as checkVitestVersion, o as writeEditorConfigs, p as migrateNodeVersionManagerFile, q as confirmEslintMigration, r as isJsonLikeFile, s as rewriteMonorepo, t as detectEditorConflicts, tt as checkViteVersion, u as detectPendingCoreMigration, v as shouldSkipStagedMigrationForHooks, w as mergeViteConfigFiles, z as migrateTsupToTsdown } from "../editor-CC4DqODz.js";
import { n as runCommandSilently } from "../command-CguLh2KL.js";
import { a as hasBaseUrlInTsconfig, i as fixBaseUrlInTsconfig, t as confirmBaseUrlFix } from "../tsconfig-LD2QhQ0O.js";
import { t as ROLLDOWN_COMPAT_RESULT_PREFIX } from "../protocol-D99W10Qi.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "node:util";
import fs, { existsSync } from "node:fs";
//#region src/migration/compat/runner.ts
var import_semver = /* @__PURE__ */ __toESM(require_semver(), 1);
/**
* Resolve the isolated compat worker emitted at `migration/compat/worker.js`.
*
* The worker is a sibling of this module in source (`src/migration/compat/`),
* so `./worker.js` is the correct relative path. The bundler, however, inlines
* this runner into the parent `migration/bin.js` entry, which sits one level up
* from the emitted `migration/compat/worker.js`; there the worker lives in the
* nested `./compat/` directory. A fixed literal can only satisfy one layout:
* `./compat/worker.js` doubles to `compat/compat/worker.js` in source, while
* `./worker.js` misses the bundled worker. Probe for the nested
* `./compat/worker.js` next to this module to pick the right prefix for
* whichever layout this code is running in.
*/
function resolveWorkerPath() {
	const nestedWorker = new URL("./compat/worker.js", import.meta.url);
	if (existsSync(nestedWorker)) return fileURLToPath(nestedWorker);
	return fileURLToPath(new URL("./worker.js", import.meta.url));
}
const WORKER_TIMEOUT_MS = 3e4;
function parseRolldownCompatibilityResult(stdout) {
	const output = stdout.toString();
	const markerIndex = output.lastIndexOf(ROLLDOWN_COMPAT_RESULT_PREFIX);
	if (markerIndex === -1) return;
	const resultStart = markerIndex + ROLLDOWN_COMPAT_RESULT_PREFIX.length;
	const resultEnd = output.indexOf("\n", resultStart);
	const serialized = output.slice(resultStart, resultEnd === -1 ? void 0 : resultEnd).trim();
	try {
		const result = JSON.parse(serialized);
		if (!Array.isArray(result.warnings) || !result.warnings.every((item) => typeof item === "string")) return;
		return { warnings: result.warnings };
	} catch {
		return;
	}
}
/**
* Resolve a project's Vite config in a child process before checking it for
* Rolldown-incompatible options. Config files execute arbitrary project code;
* isolating them prevents process-level handlers, explicit exits, and
* asynchronous crashes from terminating the migration itself.
*/
async function checkRolldownCompatibility(rootDir, report) {
	try {
		const workerPath = resolveWorkerPath();
		const result = await runCommandSilently({
			command: process.execPath,
			args: [workerPath, rootDir],
			cwd: rootDir,
			envs: process.env,
			timeoutMs: WORKER_TIMEOUT_MS
		});
		if (result.exitCode !== 0) return;
		const compatibilityResult = parseRolldownCompatibilityResult(result.stdout);
		for (const warning of compatibilityResult?.warnings ?? []) addMigrationWarning(report, warning);
	} catch {}
}
//#endregion
//#region src/migration/format.ts
const FORMAT_FAILURE_MESSAGE = "Automatic formatting failed. Run `vp fmt` manually after migration.";
const MAX_FORMAT_ARG_BYTES = process.platform === "win32" ? 24e3 : 1e5;
function chunkPathsByArgLength(paths) {
	const chunks = [];
	let current = [];
	let currentBytes = 0;
	for (const filePath of paths) {
		const bytes = Buffer.byteLength(filePath) + 1;
		if (current.length > 0 && currentBytes + bytes > MAX_FORMAT_ARG_BYTES) {
			chunks.push(current);
			current = [];
			currentBytes = 0;
		}
		current.push(filePath);
		currentBytes += bytes;
	}
	if (current.length > 0) chunks.push(current);
	return chunks;
}
function parseNullDelimitedPaths(output) {
	return output.toString().split("\0").filter(Boolean);
}
function isExistingFile(projectRoot, relativePath) {
	const absolutePath = path.join(projectRoot, relativePath);
	try {
		return fs.statSync(absolutePath).isFile();
	} catch {
		return false;
	}
}
/**
* Limit automatic formatting to files changed in the current Git worktree.
* This prevents migration from reformatting unrelated source trees while still
* covering manifests, generated config, and rewritten imports.
*
* Return `undefined` outside a Git worktree so non-Git projects retain the
* existing full-project formatting behavior.
*/
async function collectChangedFormatPaths(projectRoot, excludedPaths) {
	try {
		const git = (args) => runCommandSilently({
			command: "git",
			args,
			cwd: projectRoot,
			envs: process.env
		});
		const worktree = await git(["rev-parse", "--is-inside-work-tree"]);
		if (worktree.exitCode !== 0) return worktree.stderr.toString().includes("not a git repository") ? void 0 : [];
		if (worktree.stdout.toString().trim() !== "true") return;
		const [unstaged, staged, untracked] = await Promise.all([
			git([
				"diff",
				"--name-only",
				"--relative",
				"-z",
				"--diff-filter=ACMRTUXB",
				"--",
				"."
			]),
			git([
				"diff",
				"--cached",
				"--name-only",
				"--relative",
				"-z",
				"--diff-filter=ACMRTUXB",
				"--",
				"."
			]),
			git([
				"ls-files",
				"--others",
				"--exclude-standard",
				"-z",
				"--",
				"."
			])
		]);
		if (unstaged.exitCode !== 0 || staged.exitCode !== 0 || untracked.exitCode !== 0) return [];
		return [.../* @__PURE__ */ new Set([
			...parseNullDelimitedPaths(unstaged.stdout),
			...parseNullDelimitedPaths(staged.stdout),
			...parseNullDelimitedPaths(untracked.stdout)
		])].filter((file) => !excludedPaths?.has(file) && isExistingFile(projectRoot, file)).toSorted();
	} catch {
		return [];
	}
}
/**
* Do not apply Oxfmt to a project that still uses Prettier. Their formatting
* rules can conflict, especially when Prettier is enforced through ESLint.
*/
function canFormatWithOxfmt(hasPrettierDependency, prettierMigrated) {
	return !hasPrettierDependency || prettierMigrated;
}
/**
* Format a successfully migrated project without turning a formatter problem
* into an unhandled migration failure. The formatter already prints its
* stdout/stderr when it exits nonzero; the report keeps the manual follow-up
* visible in the final migration summary.
*/
async function formatMigratedProject(projectRoot, interactive, report, options = {}) {
	const { format = runViteFmt, collectPaths = collectChangedFormatPaths, excludedPaths } = options;
	try {
		const paths = await collectPaths(projectRoot, excludedPaths);
		if (paths?.length === 0) return true;
		const cliEntry = process.argv[1] ? path.resolve(process.cwd(), process.argv[1]) : void 0;
		const formatOptions = {
			silent: false,
			...cliEntry ? {
				command: process.execPath,
				commandArgs: [...process.execArgv, cliEntry]
			} : {}
		};
		const batches = paths === void 0 ? [void 0] : chunkPathsByArgLength(paths);
		let allFormatted = true;
		for (const batch of batches) if ((await format(projectRoot, interactive, batch, formatOptions)).status !== "formatted") {
			allFormatted = false;
			break;
		}
		if (allFormatted) return true;
	} catch {}
	addMigrationWarning(report, FORMAT_FAILURE_MESSAGE);
	return false;
}
//#endregion
//#region src/migration/npm-reinstall.ts
const VITE_PLUS_CORE_PACKAGE = "@voidzero-dev/vite-plus-core";
function isViteInstallPath(packagePath) {
	return packagePath === "node_modules/vite" || packagePath.endsWith("/node_modules/vite");
}
function isVitePlusCorePackage(pkg) {
	return pkg?.name === VITE_PLUS_CORE_PACKAGE || pkg?.resolved?.includes("/@voidzero-dev/vite-plus-core/") === true;
}
const STALE_VITE_BACKUP_NAME = ".vite-plus-migrate-stale-vite";
function removeStaleInstalledVite(packagePath, moved) {
	const packageJsonPath = path.join(packagePath, "package.json");
	if (!fs.existsSync(packageJsonPath)) return false;
	try {
		if (readJsonFile(packageJsonPath).name === VITE_PLUS_CORE_PACKAGE) return false;
	} catch {}
	const backupPath = path.join(path.dirname(packagePath), STALE_VITE_BACKUP_NAME);
	try {
		fs.rmSync(backupPath, {
			recursive: true,
			force: true
		});
		fs.renameSync(packagePath, backupPath);
		moved.push({
			originalPath: packagePath,
			backupPath
		});
	} catch {
		fs.rmSync(packagePath, {
			recursive: true,
			force: true
		});
	}
	return true;
}
/**
* npm does not replace an already-installed package when its dependency changes
* from `vite` to the `@voidzero-dev/vite-plus-core` npm alias. Even `npm
* install --force` can exit successfully while retaining the real Vite package
* and its stale package-lock entry. Move those stale Vite installs aside (and
* drop their lock entries) before the migration's final install so npm resolves
* the managed alias afresh; the caller commits or restores them depending on
* whether the install succeeded, so a failed install does not strand the
* project without any vite package.
*/
function prepareNpmViteAliasReinstall(rootDir, projectPaths = [rootDir]) {
	const packageLockPath = path.join(rootDir, "package-lock.json");
	const moved = [];
	let changed = false;
	if (fs.existsSync(packageLockPath)) try {
		const packageLock = readJsonFile(packageLockPath);
		let lockChanged = false;
		for (const [packagePath, pkg] of Object.entries(packageLock.packages ?? {})) {
			if (!isViteInstallPath(packagePath)) continue;
			const installPath = path.resolve(rootDir, packagePath);
			const relativeInstallPath = path.relative(rootDir, installPath);
			if (relativeInstallPath.startsWith("..") || path.isAbsolute(relativeInstallPath)) continue;
			if (!isVitePlusCorePackage(pkg)) {
				delete packageLock.packages?.[packagePath];
				lockChanged = true;
				removeStaleInstalledVite(installPath, moved);
			} else changed = removeStaleInstalledVite(installPath, moved) || changed;
		}
		if (lockChanged) {
			writeJsonFile(packageLockPath, packageLock);
			changed = true;
		}
	} catch {}
	for (const projectPath of projectPaths) changed = removeStaleInstalledVite(path.join(projectPath, "node_modules", "vite"), moved) || changed;
	return {
		changed,
		commit: () => {
			for (const { backupPath } of moved) try {
				fs.rmSync(backupPath, {
					recursive: true,
					force: true
				});
			} catch {}
		},
		restore: () => {
			for (const { originalPath, backupPath } of moved) try {
				fs.rmSync(originalPath, {
					recursive: true,
					force: true
				});
				fs.renameSync(backupPath, originalPath);
			} catch {}
		}
	};
}
//#endregion
//#region src/migration/setup-plan.ts
async function collectGitHooksDecision(rootDir, packageManager, options, packages = []) {
	let shouldSetupHooks = await promptGitHooks(options);
	if (shouldSetupHooks) {
		const reason = preflightGitHooksSetup(rootDir, packageManager, packages);
		if (reason) {
			log$1.warn(`⚠ ${reason}`);
			shouldSetupHooks = false;
		}
	}
	return shouldSetupHooks;
}
async function collectAgentInstructionPlan(rootDir, options) {
	const existingAgentTargetPaths = options.agent !== void 0 || !options.interactive ? void 0 : detectExistingAgentTargetPaths(rootDir);
	const selectedAgentTargetPaths = existingAgentTargetPaths !== void 0 ? existingAgentTargetPaths : await selectAgentTargetPaths({
		interactive: options.interactive,
		agent: options.agent,
		onCancel: () => cancelAndExit()
	});
	const agentConflicts = await detectAgentConflicts({
		projectRoot: rootDir,
		targetPaths: selectedAgentTargetPaths
	});
	const agentConflictDecisions = /* @__PURE__ */ new Map();
	for (const conflict of agentConflicts) if (options.interactive) {
		const action = await select({
			message: `Agent instructions already exist at ${conflict.targetPath}.\n  ` + styleText("gray", "The Vite+ template includes guidance on `vp` commands, the build pipeline, and project conventions."),
			options: [{
				label: "Append",
				value: "append",
				hint: "Add template content to the end"
			}, {
				label: "Skip",
				value: "skip",
				hint: "Leave existing file unchanged"
			}],
			initialValue: "skip"
		});
		if (isCancel(action)) cancelAndExit();
		agentConflictDecisions.set(conflict.targetPath, action);
	} else agentConflictDecisions.set(conflict.targetPath, "skip");
	return {
		selectedAgentTargetPaths,
		agentConflictDecisions
	};
}
async function collectEditorConfigPlan(rootDir, options) {
	const selectedEditor = await selectEditor({
		interactive: options.interactive,
		editor: options.editor,
		onCancel: () => cancelAndExit()
	});
	const editorConflicts = detectEditorConflicts({
		projectRoot: rootDir,
		editorId: selectedEditor
	});
	const editorConflictDecisions = /* @__PURE__ */ new Map();
	for (const conflict of editorConflicts) if (options.interactive) {
		const action = await select({
			message: `${conflict.displayPath} already exists.\n  ` + styleText("gray", "Vite+ adds editor settings for the built-in linter and formatter. Merge adds new keys without overwriting existing ones."),
			options: [{
				label: "Merge",
				value: "merge",
				hint: "Merge new settings into existing file"
			}, {
				label: "Skip",
				value: "skip",
				hint: "Leave existing file unchanged"
			}],
			initialValue: "skip"
		});
		if (isCancel(action)) cancelAndExit();
		editorConflictDecisions.set(conflict.fileName, action);
	} else editorConflictDecisions.set(conflict.fileName, isJsonLikeFile(conflict.fileName) ? "merge" : "skip");
	return {
		selectedEditor,
		editorConflictDecisions
	};
}
async function collectEslintMigrationDecision(rootDir, options, packages) {
	const eslintProject = detectEslintProject(rootDir, packages);
	const incompatibleEslintIntegration = detectIncompatibleEslintIntegration(rootDir, packages);
	let migrateEslint = false;
	if (incompatibleEslintIntegration) warnIncompatibleEslintIntegration(incompatibleEslintIntegration);
	else if (eslintProject.hasDependency && !eslintProject.configFile && eslintProject.legacyConfigFile) warnLegacyEslintConfig(eslintProject.legacyConfigFile);
	else if (eslintProject.hasDependency && eslintProject.configFile) migrateEslint = await confirmEslintMigration(options.interactive);
	else if (eslintProject.hasDependency) warnPackageLevelEslint();
	return {
		migrateEslint,
		eslintConfigFile: eslintProject.configFile
	};
}
async function collectTsupMigrationDecision(rootDir, options, packages) {
	const tsupProject = detectTsupProject(rootDir, packages);
	let migrateTsup = false;
	if (tsupProject.hasDependency && tsupProject.hasConfig) migrateTsup = await confirmTsupMigration(options.interactive);
	else if (tsupProject.hasDependency) warnMissingTsupConfig();
	return {
		migrateTsup,
		tsupConfigFile: tsupProject.configFile
	};
}
async function collectMigrationSetupPlan(rootDir, packageManager, options, packages, includeEslint = true) {
	const shouldSetupHooks = await collectGitHooksDecision(rootDir, packageManager, options, packages);
	const agentPlan = await collectAgentInstructionPlan(rootDir, options);
	const editorPlan = await collectEditorConfigPlan(rootDir, options);
	const eslintPlan = includeEslint ? await collectEslintMigrationDecision(rootDir, options, packages) : { migrateEslint: false };
	return {
		shouldSetupHooks,
		...agentPlan,
		...editorPlan,
		...eslintPlan
	};
}
//#endregion
//#region src/migration/bin.ts
async function confirmNodeVersionFileMigration(interactive, detection) {
	const message = {
		"package.json": "Migrate Volta node version (package.json) to .node-version?",
		".nvmrc": "Migrate .nvmrc to .node-version?"
	}[detection.file];
	if (interactive) {
		const confirmed = await confirm({
			message,
			initialValue: true
		});
		if (isCancel(confirmed)) cancelAndExit();
		return confirmed;
	}
	return true;
}
async function confirmFrameworkShim(framework, interactive) {
	const name = {
		vue: "Vue",
		astro: "Astro"
	}[framework];
	if (interactive) {
		const confirmed = await confirm({
			message: `Add TypeScript shim for ${name} component files (*.${framework})?\n  ` + styleText("gray", `Lets TypeScript recognize .${framework} files until vp check fully supports them.`),
			initialValue: true
		});
		if (isCancel(confirmed)) cancelAndExit();
		return confirmed;
	}
	return true;
}
async function confirmYarnNodeModulesMode(rootDir, packageManager, packageManagerVersion, interactive) {
	if (packageManager !== PackageManager.yarn) return false;
	const pnp = detectYarnPnpMode(rootDir, packageManagerVersion);
	if (!pnp) return false;
	log$1.warn(`⚠ Vite+ does not currently support Yarn Plug'n'Play (PnP).`);
	if (pnp.source === "environment") cancelAndExit("YARN_NODE_LINKER=pnp overrides project configuration. Set it to node-modules or unset it, then re-run `vp migrate`.", 1);
	if (interactive) {
		const confirmed = await confirm({
			message: "Switch this project to Yarn node-modules mode and continue?",
			initialValue: true
		});
		if (isCancel(confirmed)) cancelAndExit();
		if (!confirmed) cancelAndExit("Migration cancelled. Vite+ requires Yarn node-modules mode.");
	}
	return true;
}
async function fixBaseUrlForWorkspace(workspaceInfo, fixBaseUrl, updateProgress, report) {
	if (!fixBaseUrl) return [];
	const fixedProjectPaths = [];
	for (const projectPath of getWorkspaceProjectPaths(workspaceInfo)) {
		if (!hasBaseUrlInTsconfig(projectPath)) continue;
		updateProgress?.(`Fixing tsconfig baseUrl${projectPath === workspaceInfo.rootDir ? "" : ` in ${displayRelative(projectPath, workspaceInfo.rootDir)}`}`);
		const status = await fixBaseUrlInTsconfig(projectPath, {
			confirmed: true,
			silent: true
		});
		if (status === "failed") {
			const projectLabel = displayRelative(projectPath, workspaceInfo.rootDir) || ".";
			addMigrationWarning(report, `Failed to remove tsconfig baseUrl in ${projectLabel}. Run \`vp dlx @andrewbranch/ts5to6 --fixBaseUrl <tsconfig path>\` manually and re-run the migration.`);
		}
		if (status === "fixed") fixedProjectPaths.push(projectPath);
	}
	return fixedProjectPaths;
}
function getWorkspaceProjectPaths(workspaceInfo) {
	return [workspaceInfo.rootDir, ...(workspaceInfo.packages ?? []).map((pkg) => path.join(workspaceInfo.rootDir, pkg.path))];
}
function hasBaseUrlInWorkspace(workspaceInfo) {
	return getWorkspaceProjectPaths(workspaceInfo).some(hasBaseUrlInTsconfig);
}
async function checkWorkspaceRolldownCompatibility(workspaceInfo, report, updateProgress) {
	const projectPaths = getWorkspaceProjectPaths(workspaceInfo);
	for (const [index, projectPath] of projectPaths.entries()) {
		const counter = projectPaths.length > 1 ? ` (${index + 1}/${projectPaths.length})` : "";
		const label = displayRelative(projectPath, workspaceInfo.rootDir);
		updateProgress?.(`Checking config compatibility${counter}${label ? `: ${label}` : ""}`);
		await checkRolldownCompatibility(projectPath, report);
	}
}
const helpMessage = renderCliDoc({
	usage: "vp migrate [PATH] [OPTIONS]",
	summary: "Migrate standalone Vite, Vitest, Oxlint, Oxfmt, and Prettier projects to unified Vite+.",
	documentationUrl: "https://viteplus.dev/guide/migrate",
	sections: [
		{
			title: "Arguments",
			rows: [{
				label: "PATH",
				description: "Target directory to migrate (default: current directory)"
			}]
		},
		{
			title: "Options",
			rows: [
				{
					label: "--agent NAME",
					description: "Write coding agent instructions to AGENTS.md, CLAUDE.md, etc."
				},
				{
					label: "--no-agent",
					description: "Skip writing coding agent instructions"
				},
				{
					label: "--editor NAME",
					description: "Write editor config files into the project."
				},
				{
					label: "--no-editor",
					description: "Skip writing editor config files"
				},
				{
					label: "--hooks",
					description: "Set up pre-commit hooks (default in non-interactive mode)"
				},
				{
					label: "--no-hooks",
					description: "Skip pre-commit hooks setup"
				},
				{
					label: "--full",
					description: "Existing Vite+ projects: also run the full setup (hooks, editor, agent files, ESLint/Prettier migration, framework shims, tsconfig baseUrl, .node-version). Without it, `vp migrate` only upgrades the toolchain version."
				},
				{
					label: "--no-interactive",
					description: "Run in non-interactive mode (skip prompts and use defaults)"
				},
				{
					label: "-h, --help",
					description: "Show this help message"
				}
			]
		},
		{
			title: "Examples",
			lines: [
				`  ${muted("# Migrate current package")}`,
				`  ${accent("vp migrate")}`,
				"",
				`  ${muted("# Migrate specific directory")}`,
				`  ${accent("vp migrate my-app")}`,
				"",
				`  ${muted("# Non-interactive mode")}`,
				`  ${accent("vp migrate --no-interactive")}`
			]
		},
		{
			title: "Migration Prompt",
			lines: [
				"  Give this to a coding agent when you want it to drive the migration:",
				"",
				"  Migrate this project to Vite+.",
				"  Vite+ replaces the current split tooling around runtime management, package",
				"  management, dev/build/test commands, linting, formatting, and packaging.",
				"  Run `vp help` and `vp help migrate` before making changes.",
				`  Use ${accent("vp migrate --no-interactive")} in the workspace root.`,
				"  Make sure the project is using Vite 8+ and Vitest 4.1+ before migrating.",
				"",
				"  After the migration:",
				"  - Confirm `vite` imports were rewritten to `vite-plus` where needed",
				"  - Confirm `vitest` imports were rewritten to `vite-plus/test` where needed",
				"  - On pnpm, keep the `vite` / `vitest` entries that `vp migrate` aliased to",
				"    the Vite+ packages so the workspace override stays effective; with other",
				"    package managers you can remove them once those rewrites are confirmed",
				"  - Move remaining tool-specific config into the appropriate blocks in",
				"    `vite.config.ts`",
				"",
				"  Command mapping:",
				"  - `vp run <script>` is the equivalent of `pnpm run <script>`",
				"  - `vp dev` and `vp test` always run the built-ins; `vp run dev` and",
				"    `vp run test` run the `dev` and `test` scripts from `package.json`",
				"  - `vp install`, `vp add`, and `vp remove` delegate through the package",
				"    manager declared by `packageManager`",
				"  - `vp dev`, `vp build`, `vp preview`, `vp lint`, `vp fmt`, `vp check`,",
				"    and `vp pack` replace the corresponding standalone tools",
				"  - Prefer `vp check` for validation loops",
				"",
				"  Finally, verify the migration by running:",
				`  - ${accent("vp install")}`,
				`  - ${accent("vp check")}`,
				`  - ${accent("vp test")}`,
				`  - ${accent("vp build")}`,
				"",
				"  Summarize the migration at the end and report any manual follow-up still",
				"  required."
			]
		}
	]
});
function parseArgs() {
	const args = process.argv.slice(3);
	const parsed = lib_default(args, {
		alias: { h: "help" },
		boolean: [
			"help",
			"interactive",
			"hooks",
			"full"
		],
		default: { interactive: defaultInteractive() }
	});
	const interactive = parsed.interactive;
	let projectPath = parsed._[0];
	if (projectPath) projectPath = path.resolve(process.cwd(), projectPath);
	else projectPath = process.cwd();
	return {
		projectPath,
		options: {
			interactive,
			help: parsed.help,
			agent: parsed.agent,
			editor: parsed.editor,
			hooks: parsed.hooks,
			full: parsed.full
		}
	};
}
function getFrameworkShimCandidates(rootDir, packages) {
	const allDetectedFrameworks = new Set(detectFramework(rootDir));
	for (const pkg of packages ?? []) for (const framework of detectFramework(path.join(rootDir, pkg.path))) allDetectedFrameworks.add(framework);
	return [...allDetectedFrameworks].filter((framework) => {
		if (detectFramework(rootDir).includes(framework) && !hasFrameworkShim(rootDir, framework)) return true;
		return (packages ?? []).some((pkg) => {
			const pkgPath = path.join(rootDir, pkg.path);
			return detectFramework(pkgPath).includes(framework) && !hasFrameworkShim(pkgPath, framework);
		});
	});
}
async function collectFrameworkShimFrameworks(rootDir, options, packages) {
	const frameworkShimFrameworks = [];
	for (const framework of getFrameworkShimCandidates(rootDir, packages)) if (await confirmFrameworkShim(framework, options.interactive)) frameworkShimFrameworks.push(framework);
	return frameworkShimFrameworks.length > 0 ? frameworkShimFrameworks : void 0;
}
function addFrameworkShimsForWorkspace(rootDir, frameworks, packages, report, updateMigrationProgress) {
	if (!frameworks) return false;
	let changed = false;
	updateMigrationProgress("Adding TypeScript shim");
	for (const framework of frameworks) {
		if (detectFramework(rootDir).includes(framework) && !hasFrameworkShim(rootDir, framework)) {
			addFrameworkShim(rootDir, framework, report);
			changed = true;
		}
		for (const pkg of packages ?? []) {
			const pkgPath = path.join(rootDir, pkg.path);
			if (detectFramework(pkgPath).includes(framework) && !hasFrameworkShim(pkgPath, framework)) {
				addFrameworkShim(pkgPath, framework, report);
				changed = true;
			}
		}
	}
	return changed;
}
function hasEnabledOption(value) {
	if (Array.isArray(value)) return value.some((item) => Boolean(item));
	return value !== void 0 && value !== false && value !== "";
}
function hasExplicitExistingVitePlusSetupRequest(options) {
	return options.hooks === true || hasEnabledOption(options.agent) || hasEnabledOption(options.editor);
}
function hasExistingVitePlusMigrationCandidates(workspaceInfo, options) {
	const eslintProject = detectEslintProject(workspaceInfo.rootDir, workspaceInfo.packages);
	const prettierProject = detectPrettierProject(workspaceInfo.rootDir, workspaceInfo.packages);
	const tsupProject = detectTsupProject(workspaceInfo.rootDir, workspaceInfo.packages);
	return hasExplicitExistingVitePlusSetupRequest(options) || detectLegacyGitHooksMigrationCandidate(workspaceInfo.rootDir) || hasBaseUrlInWorkspace(workspaceInfo) || eslintProject.hasDependency || prettierProject.hasDependency || tsupProject.hasDependency || detectNodeVersionManagerFile(workspaceInfo.rootDir) !== void 0 || getFrameworkShimCandidates(workspaceInfo.rootDir, workspaceInfo.packages).length > 0;
}
function getExistingVitePlusSetupOptions(options, useFullMigrationDefaults = false) {
	if (useFullMigrationDefaults) return options;
	return {
		...options,
		hooks: options.hooks ?? false,
		agent: options.agent ?? false,
		editor: options.editor ?? false
	};
}
async function collectMigrationPlan(rootDir, detectedPackageManager, detectedPackageManagerVersion, options, packages) {
	const packageManager = detectedPackageManager ?? await selectPackageManager(options.interactive, true);
	const convertYarnPnp = await confirmYarnNodeModulesMode(rootDir, packageManager, detectedPackageManager ? detectedPackageManagerVersion : "latest", options.interactive);
	const setupPlan = await collectMigrationSetupPlan(rootDir, packageManager, options, packages);
	const prettierProject = detectPrettierProject(rootDir, packages);
	let migratePrettier = false;
	if (prettierProject.hasDependency && prettierProject.configFile) migratePrettier = await confirmPrettierMigration(options.interactive);
	else if (prettierProject.hasDependency) warnPackageLevelPrettier();
	const { migrateTsup, tsupConfigFile } = await collectTsupMigrationDecision(rootDir, options, packages);
	const fixBaseUrl = hasBaseUrlInWorkspace({
		rootDir,
		packages
	}) ? await confirmBaseUrlFix(options.interactive) : false;
	const nodeVersionDetection = detectNodeVersionManagerFile(rootDir);
	let migrateNodeVersionFile = false;
	if (nodeVersionDetection) migrateNodeVersionFile = await confirmNodeVersionFileMigration(options.interactive, nodeVersionDetection);
	const frameworkShimFrameworks = await collectFrameworkShimFrameworks(rootDir, options, packages);
	return {
		packageManager,
		convertYarnPnp,
		...setupPlan,
		migratePrettier,
		hasPrettierDependency: prettierProject.hasDependency,
		prettierConfigFile: prettierProject.configFile,
		migrateTsup,
		tsupConfigFile,
		fixBaseUrl,
		migrateNodeVersionFile,
		nodeVersionDetection,
		frameworkShimFrameworks
	};
}
/**
* Reconcile a CommandRunSummary from `runViteInstall` with the migration's
* duration counter and exit-code state. `runViteInstall` returns
* `{ status: 'failed', exitCode }` without throwing; treating that as a success
* (incrementing duration unconditionally) would let the migration claim
* "Dependencies installed" while node_modules is desynced from the just-mutated
* package.json. This helper centralizes the right handling: credit duration on
* success, warn + flip exitCode on failure, stay silent on skip.
*/
function handleInstallResult(installSummary, rootDir, report, options) {
	if (installSummary.status === "installed") return installSummary.durationMs;
	if (installSummary.status === "failed") {
		const exitCode = installSummary.exitCode ?? 1;
		const message = `Dependency installation failed (exit code ${exitCode}). Run \`vp install\` manually in ${rootDir} to resync node_modules.`;
		warnMsg(message);
		report.warnings.push(message);
		if (options?.propagateExitCode !== false) process.exitCode = exitCode;
		return 0;
	}
	return 0;
}
const FULL_MIGRATION_HINT = `${styleText("gray", "•")} Skipped editor, hooks, and lint setup. Run \`vp migrate --full\` to apply them.`;
function showMigrationSummary(options) {
	const { projectRoot, packageManager, packageManagerVersion, installDurationMs, finalInstallOk, report, updatedExistingVitePlus, suggestFullMigration } = options;
	const projectLabel = displayRelative(projectRoot) || ".";
	const configUpdates = report.createdViteConfigCount + report.mergedConfigCount + report.mergedStagedConfigCount + report.inlinedLintStagedConfigCount + report.removedConfigCount + report.tsdownImportCount + report.wrappedPluginConfigCount;
	log(`${styleText("magenta", "◇")} ${updatedExistingVitePlus ? "Updated" : "Migrated"} ${accent(projectLabel)} to Vite+ ${VITE_PLUS_VERSION}`);
	log(`${styleText("gray", "•")} Node ${process.versions.node}  ${packageManager} ${packageManagerVersion}`);
	if (report.dependencyUpgrades.length > 0) {
		const nameWidth = Math.max(...report.dependencyUpgrades.map((change) => change.name.length));
		const fromWidth = Math.max(...report.dependencyUpgrades.map((change) => (change.from ?? "").length));
		log(`${styleText("gray", "•")} Dependencies:`);
		for (const change of report.dependencyUpgrades) {
			const name = change.name.padEnd(nameWidth);
			const from = muted((change.from ?? "").padEnd(fromWidth));
			const to = styleText("green", change.to);
			log(`    ${name}  ${from} → ${to}`);
		}
	}
	if (finalInstallOk && installDurationMs > 0) log(`${styleText("green", "✓")} Dependencies installed in ${formatDuration(installDurationMs)}`);
	if (configUpdates > 0 || report.rewrittenImportFileCount > 0) {
		const parts = [];
		if (configUpdates > 0) parts.push(`${configUpdates} ${configUpdates === 1 ? "config update" : "config updates"} applied`);
		if (report.rewrittenImportFileCount > 0) parts.push(`${report.rewrittenImportFileCount} ${report.rewrittenImportFileCount === 1 ? "file had" : "files had"} imports rewritten`);
		log(`${styleText("gray", "•")} ${parts.join(", ")}`);
	}
	if (report.preservedUpstreamVitestImportFileCount > 0) log(`${styleText("gray", "•")} Kept upstream \`vitest\` imports in ${report.preservedUpstreamVitestImportFileCount} ${report.preservedUpstreamVitestImportFileCount === 1 ? "file" : "files"} for @nuxt/test-utils compatibility`);
	if (report.eslintMigrated) log(`${styleText("gray", "•")} ESLint rules migrated to Oxlint`);
	if (report.prettierMigrated) log(`${styleText("gray", "•")} Prettier migrated to Oxfmt`);
	if (report.tsupMigrated) log(`${styleText("gray", "•")} tsup config migrated to tsdown (\`vp pack\`)`);
	if (report.nodeVersionFileMigrated) log(`${styleText("gray", "•")} Node version manager file migrated to .node-version`);
	if (report.wrappedPluginConfigCount > 0) log(`${styleText("gray", "•")} Inline Vite plugins wrapped with lazyPlugins for check/lint/fmt`);
	if (report.gitHooksConfigured) log(`${styleText("gray", "•")} Git hooks configured`);
	if (report.frameworkShimAdded) log(`${styleText("gray", "•")} TypeScript shim added for framework component files`);
	if (report.packageManagerBootstrapConfigured) log(`${styleText("gray", "•")} Package manager settings configured`);
	if (suggestFullMigration) log(FULL_MIGRATION_HINT);
	if (report.warnings.length > 0) {
		log(`${styleText("yellow", "!")} Warnings:`);
		for (const warning of report.warnings) log(`  - ${warning}`);
	}
	if (report.manualSteps.length > 0) {
		log(`${styleText("blue", "→")} Manual follow-up:`);
		for (const step of report.manualSteps) log(`  - ${step}`);
	}
}
async function downloadSupportedPackageManager(options) {
	const { rootDir, packageManager, packageManagerVersion, interactive, updateMigrationProgress, failMigrationProgress } = options;
	updateMigrationProgress("Preparing migration");
	const downloadResult = await downloadPackageManager(packageManager, packageManagerVersion, interactive, true);
	if (packageManager === PackageManager.yarn && import_semver.default.satisfies(downloadResult.version, ">=4.0.0 <4.10.0")) {
		updateMigrationProgress("Upgrading Yarn");
		await upgradeYarn(rootDir, interactive, true);
	} else if (packageManager === PackageManager.pnpm && import_semver.default.satisfies(downloadResult.version, "< 9.5.0")) {
		failMigrationProgress("Migration failed");
		log$1.error(`✘ pnpm@${downloadResult.version} is not supported by auto migration, please upgrade pnpm to >=9.5.0 first`);
		cancelAndExit("Vite+ cannot automatically migrate this project yet.", 1);
	} else if (packageManager === PackageManager.npm && import_semver.default.satisfies(downloadResult.version, "< 8.3.0")) {
		failMigrationProgress("Migration failed");
		log$1.error(`✘ npm@${downloadResult.version} is not supported by auto migration, please upgrade npm to >=8.3.0 first`);
		cancelAndExit("Vite+ cannot automatically migrate this project yet.", 1);
	}
	return downloadResult;
}
async function executeMigrationPlan(workspaceInfoOptional, plan, interactive, preExistingChangedPaths) {
	const report = createMigrationReport();
	const migrationProgress = interactive ? spinner({ indicator: "timer" }) : void 0;
	let migrationProgressStarted = false;
	const updateMigrationProgress = (message) => {
		if (!migrationProgress) return;
		if (migrationProgressStarted) {
			migrationProgress.message(message);
			return;
		}
		migrationProgress.start(message);
		migrationProgressStarted = true;
	};
	const clearMigrationProgress = () => {
		if (migrationProgress && migrationProgressStarted) {
			migrationProgress.clear();
			migrationProgressStarted = false;
		}
	};
	const failMigrationProgress = (message) => {
		if (migrationProgress && migrationProgressStarted) {
			migrationProgress.error(message);
			migrationProgressStarted = false;
		}
	};
	const downloadResult = await downloadSupportedPackageManager({
		rootDir: workspaceInfoOptional.rootDir,
		packageManager: plan.packageManager,
		packageManagerVersion: workspaceInfoOptional.packageManagerVersion,
		interactive,
		updateMigrationProgress,
		failMigrationProgress
	});
	const workspaceInfo = {
		...workspaceInfoOptional,
		packageManager: plan.packageManager,
		downloadPackageManager: downloadResult
	};
	if (plan.convertYarnPnp) {
		updateMigrationProgress("Configuring Yarn node-modules mode");
		report.packageManagerBootstrapConfigured = configureYarnNodeModulesMode(workspaceInfo.rootDir);
		if (report.packageManagerBootstrapConfigured) log$1.success("✔ Switched Yarn to node-modules mode");
	}
	if (plan.migrateNodeVersionFile && plan.nodeVersionDetection) {
		updateMigrationProgress("Migrating node version file");
		migrateNodeVersionManagerFile(workspaceInfo.rootDir, plan.nodeVersionDetection, report);
	}
	updateMigrationProgress("Installing dependencies");
	const initialInstallSummary = await runViteInstall(workspaceInfo.rootDir, interactive, void 0, {
		silent: true,
		packageManager: workspaceInfo.packageManager,
		packageManagerVersion: workspaceInfo.downloadPackageManager.version
	});
	updateMigrationProgress("Validating toolchain");
	const isViteSupported = checkViteVersion(workspaceInfo.rootDir);
	const isVitestSupported = checkVitestVersion(workspaceInfo.rootDir);
	if (!isViteSupported || !isVitestSupported) {
		failMigrationProgress("Migration failed");
		cancelAndExit("Vite+ cannot automatically migrate this project yet.", 1);
	}
	await checkWorkspaceRolldownCompatibility(workspaceInfo, report, updateMigrationProgress);
	await fixBaseUrlForWorkspace(workspaceInfo, plan.fixBaseUrl, updateMigrationProgress, report);
	if (plan.migrateEslint) {
		updateMigrationProgress("Migrating ESLint");
		if (!await migrateEslintToOxlint(workspaceInfo.rootDir, interactive, plan.eslintConfigFile, workspaceInfo.packages, {
			silent: true,
			report
		})) {
			failMigrationProgress("Migration failed");
			cancelAndExit("ESLint migration failed. Fix the issue and re-run `vp migrate`.", 1);
		}
	}
	if (plan.migratePrettier) {
		updateMigrationProgress("Migrating Prettier");
		if (!await migratePrettierToOxfmt(workspaceInfo.rootDir, interactive, plan.prettierConfigFile, workspaceInfo.packages, {
			silent: true,
			report
		})) {
			failMigrationProgress("Migration failed");
			cancelAndExit("Prettier migration failed. Fix the issue and re-run `vp migrate`.", 1);
		}
	}
	if (plan.migrateTsup) {
		updateMigrationProgress("Migrating tsup");
		if (!await migrateTsupToTsdown(workspaceInfo.rootDir, interactive, plan.packageManager, plan.tsupConfigFile, workspaceInfo.packages, {
			silent: true,
			report
		})) {
			failMigrationProgress("Migration failed");
			cancelAndExit("Complete the tsup migration manually, then re-run `vp migrate`.", 1);
		}
	}
	const skipStagedMigration = shouldSkipStagedMigrationForHooks(workspaceInfo.rootDir, plan.shouldSetupHooks, plan.packageManager, workspaceInfo.packages);
	updateMigrationProgress("Rewriting configs");
	if (workspaceInfo.isMonorepo) rewriteMonorepo(workspaceInfo, skipStagedMigration, true, report);
	else rewriteStandaloneProject(workspaceInfo.rootDir, workspaceInfo, skipStagedMigration, true, report);
	if (plan.shouldSetupHooks) {
		updateMigrationProgress("Configuring git hooks");
		installGitHooks(workspaceInfo.rootDir, true, report, plan.packageManager, workspaceInfo.packages);
	}
	updateMigrationProgress("Writing agent instructions");
	await writeAgentInstructions({
		projectRoot: workspaceInfo.rootDir,
		targetPaths: plan.selectedAgentTargetPaths,
		interactive,
		conflictDecisions: plan.agentConflictDecisions,
		silent: true
	});
	updateMigrationProgress("Writing editor configs");
	await writeEditorConfigs({
		projectRoot: workspaceInfo.rootDir,
		editorId: plan.selectedEditor,
		interactive,
		conflictDecisions: plan.editorConflictDecisions,
		silent: true,
		packageManager: plan.packageManager
	});
	addFrameworkShimsForWorkspace(workspaceInfo.rootDir, plan.frameworkShimFrameworks, workspaceInfo.packages, report, updateMigrationProgress);
	const installArgs = plan.packageManager === PackageManager.npm || plan.packageManager === PackageManager.bun ? ["--force"] : ["--no-frozen-lockfile"];
	const npmReinstallPreparation = plan.packageManager === PackageManager.npm ? prepareNpmViteAliasReinstall(workspaceInfo.rootDir, getWorkspaceProjectPaths(workspaceInfo)) : void 0;
	updateMigrationProgress("Installing dependencies");
	const finalInstallSummary = await runViteInstall(workspaceInfo.rootDir, interactive, installArgs, {
		silent: true,
		packageManager: workspaceInfo.packageManager,
		packageManagerVersion: workspaceInfo.downloadPackageManager.version
	});
	if (finalInstallSummary.status === "failed") npmReinstallPreparation?.restore();
	else npmReinstallPreparation?.commit();
	clearMigrationProgress();
	const initialInstallDurationMs = handleInstallResult(initialInstallSummary, workspaceInfo.rootDir, report, { propagateExitCode: false });
	const finalInstallDurationMs = handleInstallResult(finalInstallSummary, workspaceInfo.rootDir, report);
	if (finalInstallSummary.status === "installed" && canFormatWithOxfmt(plan.hasPrettierDependency, plan.migratePrettier)) await formatMigratedProject(workspaceInfo.rootDir, interactive, report, { excludedPaths: preExistingChangedPaths });
	return {
		installDurationMs: initialInstallDurationMs + finalInstallDurationMs,
		finalInstallOk: finalInstallSummary.status === "installed",
		packageManagerVersion: downloadResult.version,
		report
	};
}
async function main() {
	const { projectPath, options } = parseArgs();
	if (options.help) {
		printHeader();
		log(helpMessage);
		return;
	}
	printHeader();
	const workspaceInfoOptional = await detectWorkspace(projectPath);
	if (workspaceInfoOptional.isMonorepo && path.resolve(projectPath) !== path.resolve(workspaceInfoOptional.rootDir)) cancelAndExit(`Vite+ cannot migrate a workspace member. Run \`vp migrate\` from the workspace root at ${workspaceInfoOptional.rootDir}.`, 1);
	const initialChangedPaths = await collectChangedFormatPaths(workspaceInfoOptional.rootDir);
	const preExistingChangedPaths = initialChangedPaths ? new Set(initialChangedPaths) : void 0;
	const resolvedPackageManager = workspaceInfoOptional.packageManager ?? "unknown";
	const rootPkg = readNearestPackageJson(workspaceInfoOptional.rootDir);
	if (hasVitePlusDependency(rootPkg) && !isForceOverrideMode()) {
		let convertYarnPnp = await confirmYarnNodeModulesMode(workspaceInfoOptional.rootDir, workspaceInfoOptional.packageManager, workspaceInfoOptional.packageManagerVersion, options.interactive);
		let didMigrate = false;
		let installDurationMs = 0;
		let finalInstallOk = true;
		let canFormatMigratedProject = !process.env.VP_SKIP_INSTALL;
		const report = createMigrationReport();
		const migrationProgress = options.interactive ? spinner({ indicator: "timer" }) : void 0;
		let migrationProgressStarted = false;
		const updateMigrationProgress = (message) => {
			if (!migrationProgress) return;
			if (migrationProgressStarted) {
				migrationProgress.message(message);
				return;
			}
			migrationProgress.start(message);
			migrationProgressStarted = true;
		};
		const clearMigrationProgress = () => {
			if (migrationProgress && migrationProgressStarted) {
				migrationProgress.clear();
				migrationProgressStarted = false;
			}
		};
		const failMigrationProgress = (message) => {
			if (migrationProgress && migrationProgressStarted) {
				migrationProgress.error(message);
				migrationProgressStarted = false;
			}
		};
		const pendingCoreMigration = detectPendingCoreMigration(workspaceInfoOptional);
		const vitePlusBootstrapPending = detectVitePlusBootstrapPending(workspaceInfoOptional.rootDir, workspaceInfoOptional.packageManager, workspaceInfoOptional.packages, workspaceInfoOptional.packageManagerVersion);
		let packageManager = vitePlusBootstrapPending ? workspaceInfoOptional.packageManager ?? await selectPackageManager(options.interactive, true) : workspaceInfoOptional.packageManager;
		let downloadedPackageManager;
		let packageManagerVersion = workspaceInfoOptional.packageManagerVersion;
		const downloadExistingPackageManager = async () => {
			if (!packageManager) return;
			downloadedPackageManager ??= await downloadSupportedPackageManager({
				rootDir: workspaceInfoOptional.rootDir,
				packageManager,
				packageManagerVersion,
				interactive: options.interactive,
				updateMigrationProgress,
				failMigrationProgress
			});
			packageManagerVersion = downloadedPackageManager.version;
			return downloadedPackageManager;
		};
		const ensureExistingPackageManager = async () => {
			packageManager ??= await selectPackageManager(options.interactive, true);
			return downloadExistingPackageManager();
		};
		if (vitePlusBootstrapPending) await ensureExistingPackageManager();
		clearMigrationProgress();
		if (!convertYarnPnp && workspaceInfoOptional.packageManager === void 0 && packageManager === PackageManager.yarn) convertYarnPnp = await confirmYarnNodeModulesMode(workspaceInfoOptional.rootDir, packageManager, packageManagerVersion, options.interactive);
		report.dependencyUpgrades = await collectToolchainVersionChanges(workspaceInfoOptional.rootDir);
		updateMigrationProgress("Rewriting toolchain imports across the workspace");
		const coreMigrationResult = finalizeCoreMigrationForExistingVitePlus(workspaceInfoOptional, true, report, pendingCoreMigration);
		if (coreMigrationResult.scripts || coreMigrationResult.tsconfigTypes || coreMigrationResult.imports) didMigrate = true;
		clearMigrationProgress();
		const fullSetup = options.full === true;
		const skippedSetupCandidates = !fullSetup && !hasExplicitExistingVitePlusSetupRequest(options) && hasExistingVitePlusMigrationCandidates(workspaceInfoOptional, options);
		if (!didMigrate && !convertYarnPnp && report.warnings.length === 0 && !vitePlusBootstrapPending && !(fullSetup ? hasExistingVitePlusMigrationCandidates(workspaceInfoOptional, options) : hasExplicitExistingVitePlusSetupRequest(options))) {
			if (skippedSetupCandidates) log(FULL_MIGRATION_HINT);
			outro(`This project is already using Vite+! ${accent("Happy coding!")}`);
			return;
		}
		const setupOptions = getExistingVitePlusSetupOptions(options, fullSetup);
		const plan = await collectMigrationSetupPlan(workspaceInfoOptional.rootDir, packageManager, setupOptions, workspaceInfoOptional.packages, fullSetup);
		const frameworkShimFrameworks = fullSetup ? await collectFrameworkShimFrameworks(workspaceInfoOptional.rootDir, options, workspaceInfoOptional.packages) : void 0;
		let needsInstall = false;
		if (vitePlusBootstrapPending) {
			const downloadResult = await ensureExistingPackageManager();
			if (downloadResult && packageManager) {
				updateMigrationProgress("Configuring package manager");
				const bootstrapResult = ensureVitePlusBootstrap({
					...workspaceInfoOptional,
					packageManager,
					downloadPackageManager: downloadResult
				}, report);
				didMigrate = bootstrapResult.changed || didMigrate;
				needsInstall = bootstrapResult.changed || needsInstall;
			}
		}
		let fixBaseUrl = false;
		if (fullSetup && hasBaseUrlInWorkspace(workspaceInfoOptional)) {
			if (options.interactive) clearMigrationProgress();
			fixBaseUrl = await confirmBaseUrlFix(options.interactive);
		}
		const fixedBaseUrlProjectPaths = await fixBaseUrlForWorkspace(workspaceInfoOptional, fixBaseUrl, updateMigrationProgress, report);
		if (fixedBaseUrlProjectPaths.length > 0) {
			updateMigrationProgress("Updating lint defaults");
			for (const projectPath of fixedBaseUrlProjectPaths) injectLintTypeCheckDefaults(projectPath, true, report);
			didMigrate = true;
		}
		clearMigrationProgress();
		let eslintMigrated = false;
		if (plan.migrateEslint) {
			await ensureExistingPackageManager();
			updateMigrationProgress("Migrating ESLint");
			if (!await migrateEslintToOxlint(workspaceInfoOptional.rootDir, options.interactive, plan.eslintConfigFile, workspaceInfoOptional.packages, {
				silent: true,
				report
			})) {
				clearMigrationProgress();
				cancelAndExit("ESLint migration failed. Fix the issue and re-run `vp migrate`.", 1);
			}
			eslintMigrated = true;
		}
		const prettierProject = detectPrettierProject(workspaceInfoOptional.rootDir, workspaceInfoOptional.packages);
		let prettierMigrated = false;
		if (fullSetup) {
			if (prettierProject.hasDependency && prettierProject.configFile) {
				if (options.interactive) clearMigrationProgress();
				if (await confirmPrettierMigration(options.interactive)) {
					await ensureExistingPackageManager();
					updateMigrationProgress("Migrating Prettier");
					if (!await migratePrettierToOxfmt(workspaceInfoOptional.rootDir, options.interactive, prettierProject.configFile, workspaceInfoOptional.packages, {
						silent: true,
						report
					})) {
						clearMigrationProgress();
						cancelAndExit("Prettier migration failed. Fix the issue and re-run `vp migrate`.", 1);
					}
					prettierMigrated = true;
				}
			} else if (prettierProject.hasDependency) warnPackageLevelPrettier();
		}
		let tsupMigrated = false;
		if (fullSetup) {
			if (options.interactive) clearMigrationProgress();
			const { migrateTsup, tsupConfigFile } = await collectTsupMigrationDecision(workspaceInfoOptional.rootDir, setupOptions, workspaceInfoOptional.packages);
			if (migrateTsup) {
				await ensureExistingPackageManager();
				updateMigrationProgress("Migrating tsup");
				if (!await migrateTsupToTsdown(workspaceInfoOptional.rootDir, options.interactive, packageManager, tsupConfigFile, workspaceInfoOptional.packages, {
					silent: true,
					report
				})) {
					clearMigrationProgress();
					cancelAndExit("Complete the tsup migration manually, then re-run `vp migrate`.", 1);
				}
				tsupMigrated = true;
			}
		}
		if (fullSetup) {
			const nodeVersionDetection = detectNodeVersionManagerFile(workspaceInfoOptional.rootDir);
			if (nodeVersionDetection) {
				if (options.interactive) clearMigrationProgress();
				if (await confirmNodeVersionFileMigration(options.interactive, nodeVersionDetection) && migrateNodeVersionManagerFile(workspaceInfoOptional.rootDir, nodeVersionDetection, report)) didMigrate = true;
			}
		}
		if (convertYarnPnp) {
			updateMigrationProgress("Configuring Yarn node-modules mode");
			if (configureYarnNodeModulesMode(workspaceInfoOptional.rootDir)) {
				log$1.success("✔ Switched Yarn to node-modules mode");
				report.packageManagerBootstrapConfigured = true;
				didMigrate = true;
				needsInstall = true;
			}
		}
		if (addFrameworkShimsForWorkspace(workspaceInfoOptional.rootDir, frameworkShimFrameworks, workspaceInfoOptional.packages, report, updateMigrationProgress)) didMigrate = true;
		if (eslintMigrated || prettierMigrated || tsupMigrated) {
			updateMigrationProgress("Rewriting configs");
			mergeViteConfigFiles(workspaceInfoOptional.rootDir, true, report, workspaceInfoOptional.packages);
			if (tsupMigrated) {
				mergeTsdownConfigFile(workspaceInfoOptional.rootDir, true, report);
				for (const pkg of workspaceInfoOptional.packages ?? []) mergeTsdownConfigFile(path.join(workspaceInfoOptional.rootDir, pkg.path), true, report);
			}
			needsInstall = true;
			didMigrate = true;
			report.eslintMigrated = eslintMigrated;
			report.prettierMigrated = prettierMigrated;
			report.tsupMigrated = tsupMigrated;
		}
		if (plan.shouldSetupHooks) {
			await ensureExistingPackageManager();
			updateMigrationProgress("Configuring git hooks");
			if (installGitHooks(workspaceInfoOptional.rootDir, true, report, packageManager, workspaceInfoOptional.packages)) {
				didMigrate = true;
				needsInstall = true;
			}
		}
		if (needsInstall) {
			const resolved = await ensureExistingPackageManager();
			updateMigrationProgress("Installing dependencies");
			const resolvedVersion = resolved?.version ?? packageManagerVersion;
			const npmReinstallPreparation = packageManager === PackageManager.npm ? prepareNpmViteAliasReinstall(workspaceInfoOptional.rootDir, getWorkspaceProjectPaths(workspaceInfoOptional)) : void 0;
			const installSummary = await runViteInstall(workspaceInfoOptional.rootDir, options.interactive, packageManager === PackageManager.npm || packageManager === PackageManager.bun ? ["--force"] : ["--no-frozen-lockfile"], {
				silent: true,
				packageManager,
				packageManagerVersion: resolvedVersion
			});
			if (installSummary.status === "failed") {
				clearMigrationProgress();
				npmReinstallPreparation?.restore();
			} else npmReinstallPreparation?.commit();
			finalInstallOk = installSummary.status !== "failed";
			canFormatMigratedProject = finalInstallOk && canFormatMigratedProject;
			installDurationMs += handleInstallResult(installSummary, workspaceInfoOptional.rootDir, report);
		}
		if (plan.selectedAgentTargetPaths && plan.selectedAgentTargetPaths.length > 0) {
			updateMigrationProgress("Writing agent instructions");
			await writeAgentInstructions({
				projectRoot: workspaceInfoOptional.rootDir,
				targetPaths: plan.selectedAgentTargetPaths,
				interactive: options.interactive,
				conflictDecisions: plan.agentConflictDecisions,
				silent: true
			});
			didMigrate = true;
		}
		if (plan.selectedEditor) {
			updateMigrationProgress("Writing editor configs");
			await writeEditorConfigs({
				projectRoot: workspaceInfoOptional.rootDir,
				editorId: plan.selectedEditor,
				interactive: options.interactive,
				conflictDecisions: plan.editorConflictDecisions,
				silent: true,
				packageManager
			});
			didMigrate = true;
		}
		await checkWorkspaceRolldownCompatibility(workspaceInfoOptional, report, updateMigrationProgress);
		if (didMigrate && finalInstallOk && canFormatMigratedProject && canFormatWithOxfmt(prettierProject.hasDependency, prettierMigrated)) {
			clearMigrationProgress();
			await formatMigratedProject(workspaceInfoOptional.rootDir, options.interactive, report, { excludedPaths: preExistingChangedPaths });
		}
		if (didMigrate || report.warnings.length > 0) {
			clearMigrationProgress();
			showMigrationSummary({
				projectRoot: workspaceInfoOptional.rootDir,
				packageManager: packageManager ?? resolvedPackageManager,
				packageManagerVersion,
				installDurationMs,
				finalInstallOk,
				report,
				updatedExistingVitePlus: true,
				suggestFullMigration: skippedSetupCandidates
			});
		} else {
			clearMigrationProgress();
			if (skippedSetupCandidates) log(FULL_MIGRATION_HINT);
			outro(`This project is already using Vite+! ${accent("Happy coding!")}`);
		}
		return;
	}
	const plan = await collectMigrationPlan(workspaceInfoOptional.rootDir, workspaceInfoOptional.packageManager, workspaceInfoOptional.packageManagerVersion, options, workspaceInfoOptional.packages);
	const result = await executeMigrationPlan(workspaceInfoOptional, plan, options.interactive, preExistingChangedPaths);
	showMigrationSummary({
		projectRoot: workspaceInfoOptional.rootDir,
		packageManager: plan.packageManager,
		packageManagerVersion: result.packageManagerVersion,
		installDurationMs: result.installDurationMs,
		finalInstallOk: result.finalInstallOk,
		report: result.report
	});
}
main().catch((err) => {
	log$1.error(err.message);
	console.error(err);
	process.exit(1);
});
//#endregion
export {};
