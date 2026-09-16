import { l as VITE_CONFIG_FILES } from "./constants-Bn-U8o4v.js";
import { u as withConfigMetadataResolution } from "./define-config-GXUdVT-0.js";
import path from "node:path";
import fs from "node:fs";
//#region src/resolve-vite-config.ts
/**
* Find a vite config file by walking up from `startDir` to `stopDir`.
* Returns the absolute path of the first config file found, or undefined.
*/
function findViteConfigUp(startDir, stopDir) {
	let dir = path.resolve(startDir);
	const stop = path.resolve(stopDir);
	while (true) {
		for (const filename of VITE_CONFIG_FILES) {
			const filePath = path.join(dir, filename);
			if (fs.existsSync(filePath)) return filePath;
		}
		const parent = path.dirname(dir);
		if (parent === dir || !parent.startsWith(stop)) break;
		dir = parent;
	}
}
/**
* Find a vite config file directly in `dir` (no walking up). Returns the
* absolute path of the first config file found, or undefined. Covers every
* supported extension (`.ts/.js/.mjs/.mts/.cjs/.cts`).
*/
function findViteConfig(dir) {
	const filename = VITE_CONFIG_FILES.find((f) => fs.existsSync(path.join(dir, f)));
	return filename ? path.join(dir, filename) : void 0;
}
function hasViteConfig(dir) {
	return findViteConfig(dir) !== void 0;
}
/**
* Find the workspace root by walking up from `startDir` looking for
* monorepo indicators (pnpm-workspace.yaml, workspaces in package.json, lerna.json).
*/
function findWorkspaceRoot(startDir) {
	let dir = path.resolve(startDir);
	while (true) {
		if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
		const pkgPath = path.join(dir, "package.json");
		if (fs.existsSync(pkgPath)) try {
			if (JSON.parse(fs.readFileSync(pkgPath, "utf-8")).workspaces) return dir;
		} catch {}
		if (fs.existsSync(path.join(dir, "lerna.json"))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
}
/**
* Resolve vite.config.ts and return the config object.
*/
async function resolveViteConfig(cwd, options) {
	const { resolveConfig } = await import("./index.js");
	return withConfigMetadataResolution(async () => {
		if (options?.traverseUp && !hasViteConfig(cwd)) {
			const workspaceRoot = findWorkspaceRoot(cwd);
			if (workspaceRoot) {
				const configFile = findViteConfigUp(path.dirname(cwd), workspaceRoot);
				if (configFile) return resolveConfig({
					root: cwd,
					configFile
				}, "build");
			}
		}
		return resolveConfig({ root: cwd }, "build");
	});
}
async function resolveUniversalViteConfig(err, viteConfigCwd) {
	if (err) throw err;
	try {
		const config = await resolveViteConfig(viteConfigCwd);
		return JSON.stringify({
			configFile: config.configFile,
			lint: config.lint,
			fmt: config.fmt,
			check: config.check,
			run: config.run,
			staged: config.staged
		});
	} catch (resolveErr) {
		console.error("[Vite+] resolve universal vite config error:", resolveErr);
		throw resolveErr;
	}
}
//#endregion
export { resolveViteConfig as a, resolveUniversalViteConfig as i, findWorkspaceRoot as n, hasViteConfig as r, findViteConfig as t };
