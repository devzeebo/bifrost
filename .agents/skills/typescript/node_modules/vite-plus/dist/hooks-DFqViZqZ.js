import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
//#region src/config/hooks.ts
const SUPPORTED_GIT_HOOK_NAMES = [
	"pre-commit",
	"pre-merge-commit",
	"prepare-commit-msg",
	"commit-msg",
	"post-commit",
	"applypatch-msg",
	"pre-applypatch",
	"post-applypatch",
	"pre-rebase",
	"post-rewrite",
	"post-checkout",
	"post-merge",
	"pre-push",
	"pre-auto-gc"
];
const DEFAULT_HOOKS_DIR = ".vite-hooks";
/** Local git config: user chose `vp hooks disable` (survives prepare / vp config). */
const PREFERENCE_DISABLED_KEY = "vp.hooks.disabled";
/** Local git config: last hooks directory used by enable (relative to setup cwd). */
const PREFERENCE_DIR_KEY = "vp.hooks.dir";
/** Local git config: `git rev-parse --show-prefix` when the dir was stored. `.` = worktree root. */
const PREFERENCE_PREFIX_KEY = "vp.hooks.prefix";
const ROOT_PREFIX_TOKEN = ".";
function nestedDirname(depth) {
	let expr = "\"$0\"";
	for (let i = 0; i < depth; i++) expr = `"$(dirname ${expr})"`;
	return expr;
}
function hookScript(dir) {
	const separators = process.platform === "win32" ? /[\\/]/ : /\//;
	return `#!/usr/bin/env sh
{ [ "$HUSKY" = "2" ] || [ "$VP_GIT_HOOKS" = "2" ] || [ "$VITE_GIT_HOOKS" = "2" ]; } && set -x
n=$(basename "$0")
s=$(dirname "$(dirname "$0")")/$n

[ ! -f "$s" ] && exit 0

i="\${XDG_CONFIG_HOME:-$HOME/.config}/vite-plus/hooks-init.sh"
[ ! -f "$i" ] && i="\${XDG_CONFIG_HOME:-$HOME/.config}/husky/init.sh"
[ -f "$i" ] && . "$i"

{ [ "\${HUSKY-}" = "0" ] || [ "\${VP_GIT_HOOKS-}" = "0" ] || [ "\${VITE_GIT_HOOKS-}" = "0" ]; } && exit 0

d=${nestedDirname(dir.split(separators).filter((s) => s !== "" && s !== ".").length + 2)}
__vp_shell=/bin/sh
[ -x "$__vp_shell" ] || __vp_shell=$(command -v sh)

if [ -n "\${VP_HOME-}" ]; then
  __vp_bin="$VP_HOME/bin"
elif [ -n "\${HOME-}" ]; then
  __vp_bin="$HOME/.vite-plus/bin"
else
  __vp_bin=""
fi
[ -n "$__vp_bin" ] && [ -d "$__vp_bin" ] && export PATH="$PATH:$__vp_bin"

export PATH="$d/node_modules/.bin:$PATH"
"$__vp_shell" -e "$s" "$@"
c=$?

[ $c != 0 ] && echo "VITE+ - $n script failed (code $c)"
[ $c = 127 ] && echo "VITE+ - command not found in PATH=$PATH"
exit $c`;
}
function normalizeHooksPath(hooksPath) {
	let normalized = normalize(hooksPath);
	while (normalized.endsWith(sep)) normalized = normalized.slice(0, -1);
	return normalized;
}
function getGitToplevel() {
	const result = spawnSync("git", ["rev-parse", "--show-toplevel"]);
	if (result.status == null) return {
		message: "git command not found",
		isError: true
	};
	if (result.status !== 0) return {
		message: ".git can't be found",
		isError: false
	};
	const toplevel = result.stdout.toString().trim();
	try {
		return realpathSync(toplevel);
	} catch {
		return toplevel;
	}
}
/** Resolve a core.hooksPath value against the worktree root for ownership checks. */
function resolveHooksPath(hooksPath, gitRoot) {
	const resolved = isAbsolute(hooksPath) ? hooksPath : resolve(gitRoot, hooksPath);
	try {
		return normalizeHooksPath(realpathSync(resolved));
	} catch {
		return normalizeHooksPath(resolved);
	}
}
function hooksPathsEqual(a, b, gitRoot) {
	return resolveHooksPath(a, gitRoot) === resolveHooksPath(b, gitRoot);
}
function findUnsafeHookInstallPath(root, dir) {
	const projectRoot = resolve(root);
	const internalPath = resolve(projectRoot, dir, "_");
	const relativeInternalPath = relative(projectRoot, internalPath);
	let currentPath = projectRoot;
	for (const component of relativeInternalPath.split(sep).filter(Boolean)) {
		currentPath = join(currentPath, component);
		const stats = lstatSync(currentPath, { throwIfNoEntry: false });
		if (!stats) return null;
		if (stats.isSymbolicLink()) return {
			kind: "symbolic",
			relativePath: relative(projectRoot, currentPath)
		};
		if (!stats.isDirectory()) return {
			kind: "not-directory",
			relativePath: relative(projectRoot, currentPath)
		};
	}
	for (const filename of [
		"husky.sh",
		".gitignore",
		"h",
		...SUPPORTED_GIT_HOOK_NAMES
	]) {
		const filePath = join(internalPath, filename);
		const stats = lstatSync(filePath, { throwIfNoEntry: false });
		if (!stats) continue;
		if (stats.isSymbolicLink()) return {
			kind: "symbolic",
			relativePath: relative(projectRoot, filePath)
		};
		if (!stats.isFile()) return {
			kind: "not-file",
			relativePath: relative(projectRoot, filePath)
		};
		if (stats.nlink > 1) return {
			kind: "linked",
			relativePath: relative(projectRoot, filePath)
		};
	}
	return null;
}
function describeUnsafeHookInstallPath(unsafePath) {
	if (unsafePath.kind === "symbolic") return `symbolic hook path "${unsafePath.relativePath}" not allowed`;
	if (unsafePath.kind === "linked") return `multiply linked hook path "${unsafePath.relativePath}" not allowed`;
	if (unsafePath.kind === "not-directory") return `hook path "${unsafePath.relativePath}" is not a directory`;
	return `hook path "${unsafePath.relativePath}" is not a file`;
}
function gitConfigGet(key, options) {
	const args = ["config"];
	if (options?.local) args.push("--local");
	if (options?.bool) args.push("--bool");
	args.push("--get", key);
	const result = spawnSync("git", args);
	if (result.status !== 0) return null;
	return result.stdout?.toString().trim() || null;
}
function gitConfigSet(key, value) {
	const result = spawnSync("git", [
		"config",
		"--local",
		key,
		value
	]);
	if (result.status == null) return {
		ok: false,
		error: "git command not found"
	};
	if (result.status !== 0) return {
		ok: false,
		error: result.stderr?.toString().trim() || `failed to set ${key}`
	};
	return { ok: true };
}
function gitConfigUnset(key) {
	const result = spawnSync("git", [
		"config",
		"--local",
		"--unset-all",
		key
	]);
	if (result.status == null) return {
		ok: false,
		error: "git command not found"
	};
	if (result.status !== 0 && result.status !== 5) return {
		ok: false,
		error: result.stderr?.toString().trim() || `failed to unset ${key}`
	};
	return { ok: true };
}
/** Whether the user ran `vp hooks disable` in this repo (local git config). */
function isHooksUserDisabled() {
	return gitConfigGet(PREFERENCE_DISABLED_KEY, {
		local: true,
		bool: true
	}) === "true";
}
function setHooksUserDisabled(disabled) {
	if (disabled) return gitConfigSet(PREFERENCE_DISABLED_KEY, "true");
	return gitConfigUnset(PREFERENCE_DISABLED_KEY);
}
function getStoredHooksDir() {
	return gitConfigGet(PREFERENCE_DIR_KEY, { local: true });
}
function getStoredHooksPrefix() {
	const value = gitConfigGet(PREFERENCE_PREFIX_KEY, { local: true });
	if (value == null) return null;
	if (value === ROOT_PREFIX_TOKEN) return "";
	return value.replace(/\/$/, "");
}
function setStoredHooksLocation(dir, prefix) {
	const storedDir = gitConfigSet(PREFERENCE_DIR_KEY, dir);
	if (!storedDir.ok) return storedDir;
	return gitConfigSet(PREFERENCE_PREFIX_KEY, prefix || ROOT_PREFIX_TOKEN);
}
function displayHooksDir(location) {
	return location.prefix ? `${location.prefix}/${location.dir}` : location.dir;
}
function getGitWorktree() {
	const toplevel = getGitToplevel();
	if (typeof toplevel !== "string") return toplevel;
	const prefixResult = spawnSync("git", ["rev-parse", "--show-prefix"]);
	if (prefixResult.status == null) return {
		message: "git command not found",
		isError: true
	};
	if (prefixResult.status !== 0) return {
		message: ".git can't be found",
		isError: false
	};
	return {
		toplevel,
		prefix: prefixResult.stdout.toString().trim().replace(/\/$/, "")
	};
}
function buildHooksLocation(git, hooksDir, prefix) {
	const dirError = validateHooksDir(hooksDir);
	if (dirError) return dirError;
	const baseDir = prefix ? resolve(git.toplevel, prefix) : git.toplevel;
	const target = prefix ? `${prefix}/${hooksDir}/_` : `${hooksDir}/_`;
	return {
		toplevel: git.toplevel,
		baseDir,
		dir: hooksDir,
		prefix,
		target
	};
}
function tryAdoptEffectiveDispatcher(git) {
	const existing = getEffectiveHooksPath();
	if (!existing) return null;
	const abs = isAbsolute(existing) ? existing : resolve(git.toplevel, existing);
	let dispatcherDir;
	try {
		dispatcherDir = realpathSync(abs);
	} catch {
		return null;
	}
	if (!existsSync(join(dispatcherDir, "h"))) return null;
	const hooksAbs = resolve(dispatcherDir, "..");
	const relHooks = relative(git.toplevel, hooksAbs);
	if (!relHooks || relHooks === "." || relHooks.startsWith("..")) return null;
	const posixRel = relHooks.split(sep).join("/");
	let prefix = "";
	let dir = posixRel;
	if (posixRel === ".vite-hooks") {
		prefix = "";
		dir = DEFAULT_HOOKS_DIR;
	} else if (posixRel.endsWith(`/.vite-hooks`)) {
		prefix = posixRel.slice(0, -12);
		dir = DEFAULT_HOOKS_DIR;
	}
	const location = buildHooksLocation(git, dir, prefix);
	return "isError" in location ? null : location;
}
/**
* Resolve where hook files live.
*
* An explicit `dir` is relative to the current working directory (current
* git prefix). Omitting it uses the stored dir + the prefix recorded at
* enable/disable time, so later commands find the same tree from any cwd.
*/
function resolveHooksLocation(dir, options = {}) {
	const git = getGitWorktree();
	if ("isError" in git) return git;
	let prefix;
	let hooksDir;
	if (dir !== void 0) {
		prefix = git.prefix;
		hooksDir = dir;
	} else {
		const storedDir = getStoredHooksDir();
		if (storedDir) {
			hooksDir = storedDir;
			prefix = getStoredHooksPrefix() ?? git.prefix;
		} else if (options.adoptEffectiveDispatcher) {
			const adopted = tryAdoptEffectiveDispatcher(git);
			if (adopted) return adopted;
			hooksDir = DEFAULT_HOOKS_DIR;
			prefix = options.unstoredPrefix === "root" ? "" : git.prefix;
		} else {
			hooksDir = DEFAULT_HOOKS_DIR;
			prefix = options.unstoredPrefix === "root" ? "" : git.prefix;
		}
	}
	return buildHooksLocation(git, hooksDir, prefix);
}
function validateHooksDir(dir) {
	if (dir.includes("..")) return {
		message: ".. not allowed",
		isError: true
	};
	if (isAbsolute(dir)) return {
		message: "absolute hooks directory not allowed",
		isError: true
	};
	if (relative(process.cwd(), resolve(process.cwd(), dir)) === "") return {
		message: "hooks directory must be a project subdirectory",
		isError: true
	};
	return null;
}
function getEffectiveHooksPath() {
	const checkResult = spawnSync("git", [
		"config",
		"--get",
		"core.hooksPath"
	]);
	return checkResult.status === 0 ? checkResult.stdout?.toString().trim() : "";
}
function getScopedHooksPath(scope) {
	const result = spawnSync("git", [
		"config",
		`--${scope}`,
		"--get",
		"core.hooksPath"
	]);
	return result.status === 0 ? result.stdout?.toString().trim() : "";
}
function unsetScopedHooksPath(scope) {
	const result = spawnSync("git", [
		"config",
		`--${scope}`,
		"--unset-all",
		"core.hooksPath"
	]);
	if (result.status == null) return {
		message: "git command not found",
		isError: true
	};
	if (result.status !== 0 && result.status !== 5) return {
		message: result.stderr?.toString().trim() || `failed to unset ${scope} core.hooksPath`,
		isError: true
	};
	return null;
}
/**
* Unset core.hooksPath only at scopes that actually point at our dispatcher.
*
* Must not touch a foreign value at another scope (e.g. local still `.husky/_`
* while worktree holds the Vite+ target).
*/
function unsetOwnedHooksPath(target) {
	const toplevel = getGitToplevel();
	if (typeof toplevel !== "string") return toplevel;
	for (const scope of ["local", "worktree"]) {
		const scopedPath = getScopedHooksPath(scope);
		if (!scopedPath || !hooksPathsEqual(scopedPath, target, toplevel)) continue;
		const unsetError = unsetScopedHooksPath(scope);
		if (unsetError) return unsetError;
	}
	const finalPath = getEffectiveHooksPath();
	if (finalPath && hooksPathsEqual(finalPath, target, toplevel)) return {
		message: `could not unset core.hooksPath (still "${finalPath}"); remove it with git config --unset core.hooksPath`,
		isError: true
	};
	return null;
}
function isGitHooksEnvDisabled() {
	return process.env.HUSKY === "0" || process.env.VP_GIT_HOOKS === "0" || process.env.VITE_GIT_HOOKS === "0";
}
function install(dir, options = {}) {
	if (isGitHooksEnvDisabled()) return {
		message: "skip install (git hooks disabled)",
		isError: false
	};
	if (!options.ignoreUserPreference && isHooksUserDisabled()) return {
		message: "skip install (hooks disabled; run `vp hooks enable` to re-enable)",
		isError: false
	};
	const location = resolveHooksLocation(dir);
	if ("isError" in location) return location;
	const unsafeInstallPath = findUnsafeHookInstallPath(location.baseDir, location.dir);
	if (unsafeInstallPath) return {
		message: describeUnsafeHookInstallPath(unsafeInstallPath),
		isError: false
	};
	const internal = (x = "") => join(location.baseDir, location.dir, "_", x);
	const existingHooksPath = getEffectiveHooksPath();
	if (existingHooksPath && !hooksPathsEqual(existingHooksPath, location.target, location.toplevel)) return {
		message: `core.hooksPath is already set to "${existingHooksPath}", skipping`,
		isError: false
	};
	rmSync(internal("husky.sh"), { force: true });
	mkdirSync(internal(), { recursive: true });
	writeFileSync(internal(".gitignore"), "*");
	writeFileSync(internal("h"), hookScript(location.dir), { mode: 493 });
	chmodSync(internal("h"), 493);
	for (const hook of SUPPORTED_GIT_HOOK_NAMES) {
		writeFileSync(internal(hook), `#!/usr/bin/env sh\n. "$(dirname "$0")/h"`, { mode: 493 });
		chmodSync(internal(hook), 493);
	}
	const { status, stderr } = spawnSync("git", [
		"config",
		"core.hooksPath",
		location.target
	]);
	if (status == null) return {
		message: "git command not found",
		isError: true
	};
	if (status) return {
		message: "" + stderr,
		isError: true
	};
	const clearDisabled = setHooksUserDisabled(false);
	if (!clearDisabled.ok) return {
		message: clearDisabled.error || "failed to clear hooks disabled preference",
		isError: true
	};
	const storeDir = setStoredHooksLocation(location.dir, location.prefix);
	if (!storeDir.ok) return {
		message: storeDir.error || "failed to store hooks directory",
		isError: true
	};
	return {
		message: "",
		isError: false
	};
}
/**
* Install (or refresh) the Vite+ hook dispatcher and mark hooks as enabled.
* Clears a previous `vp hooks disable` preference.
*/
function enable(dir) {
	const location = resolveHooksLocation(dir);
	if ("isError" in location) return location;
	const result = install(dir, { ignoreUserPreference: true });
	if (result.isError) return result;
	if (result.message) return result;
	return {
		message: `Git hook dispatcher installed at ${displayHooksDir(location)}/_`,
		isError: false
	};
}
/**
* Disable Vite+ hooks in this repo and tear down the dispatcher.
*
* - Persists the decision in local git config so `vp config` / prepare do not reinstall
* - Unsets `core.hooksPath` only when it points at this project's dispatcher
* - Removes the generated `<dir>/_` directory
* - Leaves project-owned hooks, staged config, and package.json scripts alone
*/
function disable(dir) {
	const location = resolveHooksLocation(dir, {
		unstoredPrefix: "root",
		adoptEffectiveDispatcher: true
	});
	if ("isError" in location) return location;
	const displayedDir = displayHooksDir(location);
	const internalDir = join(location.baseDir, location.dir, "_");
	const hasInternalDir = existsSync(internalDir);
	if (hasInternalDir) {
		const unsafeInstallPath = findUnsafeHookInstallPath(location.baseDir, location.dir);
		if (unsafeInstallPath) return {
			message: describeUnsafeHookInstallPath(unsafeInstallPath),
			isError: false
		};
	}
	const existingHooksPath = getEffectiveHooksPath();
	const ownsHooksPath = !!existingHooksPath && hooksPathsEqual(existingHooksPath, location.target, location.toplevel);
	const foreignHooksPath = !!existingHooksPath && !hooksPathsEqual(existingHooksPath, location.target, location.toplevel);
	const actions = [];
	const notes = [];
	const pref = setHooksUserDisabled(true);
	if (!pref.ok) return {
		message: pref.error || "failed to persist hooks disabled preference",
		isError: true
	};
	const storeDir = setStoredHooksLocation(location.dir, location.prefix);
	if (!storeDir.ok) return {
		message: storeDir.error || "failed to store hooks directory",
		isError: true
	};
	actions.push("recorded disable preference (local git config)");
	const unsetError = unsetOwnedHooksPath(location.target);
	if (unsetError) return {
		message: `${unsetError.message}; disable preference was recorded (local git config). Run \`vp hooks enable\` to clear it, or \`git config --local --unset vp.hooks.disabled\``,
		isError: true
	};
	if (ownsHooksPath) actions.push(`unset core.hooksPath (was "${existingHooksPath}")`);
	else if (foreignHooksPath) notes.push(`core.hooksPath is set to "${existingHooksPath}" (not Vite+ dispatcher "${location.target}"), left unchanged`);
	if (hasInternalDir) {
		rmSync(internalDir, {
			recursive: true,
			force: true
		});
		actions.push(`removed ${displayedDir}/_`);
	}
	const summary = `Git hooks disabled: ${actions.join("; ")}. Project-owned hooks under ${displayedDir}/ and staged config were left unchanged. Run \`vp hooks enable\` to re-enable.`;
	if (notes.length > 0) return {
		message: `${summary} ${notes.join("; ")}.`,
		isError: false
	};
	return {
		message: summary,
		isError: false
	};
}
/**
* Report whether Vite+ hooks are set up, disabled by preference, and active.
*/
function status(dir) {
	const location = resolveHooksLocation(dir, {
		unstoredPrefix: "root",
		adoptEffectiveDispatcher: true
	});
	if ("isError" in location) return location;
	const hooksDir = displayHooksDir(location);
	const existingHooksPath = getEffectiveHooksPath();
	const userDisabled = isHooksUserDisabled();
	const dispatcherInstalled = existsSync(join(location.baseDir, location.dir, "_", "h"));
	const ownsHooksPath = !!existingHooksPath && hooksPathsEqual(existingHooksPath, location.target, location.toplevel);
	let projectHooks = [];
	const hooksDirPath = join(location.baseDir, location.dir);
	if (existsSync(hooksDirPath)) try {
		projectHooks = readdirSync(hooksDirPath, { withFileTypes: true }).filter((entry) => entry.isFile() && SUPPORTED_GIT_HOOK_NAMES.includes(entry.name)).map((entry) => entry.name).toSorted();
	} catch {
		projectHooks = [];
	}
	const preferenceLabel = userDisabled ? "disabled (local)" : getStoredHooksDir() || dispatcherInstalled || ownsHooksPath ? "enabled" : "not set";
	const hooksPathLabel = existingHooksPath || "(unset)";
	const ownership = !existingHooksPath ? "" : ownsHooksPath ? " (Vite+ dispatcher)" : " (not Vite+ dispatcher)";
	const dispatcherLabel = dispatcherInstalled ? "installed" : "missing";
	const projectHooksLabel = projectHooks.length > 0 ? projectHooks.join(", ") : "(none)";
	const lines = [
		`Preference:     ${preferenceLabel}`,
		`Hooks dir:      ${hooksDir}`,
		`core.hooksPath: ${hooksPathLabel}${ownership}`,
		`Dispatcher:     ${dispatcherLabel} (${hooksDir}/_)`,
		`Project hooks:  ${projectHooksLabel}`
	];
	const hooksStatus = {
		hooksDir,
		userDisabled,
		hooksPath: existingHooksPath || null,
		ownsHooksPath,
		dispatcherInstalled,
		projectHooks,
		lines
	};
	return {
		message: lines.join("\n"),
		isError: false,
		status: hooksStatus
	};
}
//#endregion
export { findUnsafeHookInstallPath as a, isHooksUserDisabled as c, enable as i, resolveHooksLocation as l, SUPPORTED_GIT_HOOK_NAMES as n, install as o, disable as r, isGitHooksEnvDisabled as s, DEFAULT_HOOKS_DIR as t, status as u };
