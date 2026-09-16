import { p as createBaseUrlTsconfigFixArgs, t as BASEURL_TSCONFIG_FIX_PACKAGE } from "./constants-Bn-U8o4v.js";
import { A as isCancel, C as log, t as cancelAndExit, x as confirm } from "./prompts-DF3yU-eU.js";
import { c as parse, o as applyEdits, s as modify } from "./json-cULBl7Pi.js";
import { n as runCommandSilently } from "./command-CguLh2KL.js";
import path from "node:path";
import { styleText } from "node:util";
import fs from "node:fs";
//#region src/utils/tsconfig.ts
/**
* Check if tsconfig.json has compilerOptions.baseUrl set.
* oxlint's TypeScript checker (tsgolint) does not support baseUrl,
* so typeAware/typeCheck must be disabled when it is present.
*/
function hasBaseUrlInTsconfigFile(filePath) {
	try {
		return parse(fs.readFileSync(filePath, "utf-8"))?.compilerOptions?.baseUrl != null;
	} catch {
		return false;
	}
}
const TSCONFIG_FILE_RE = /^tsconfig(\.[\w-]+)?\.json$/i;
function findTsconfigFiles(projectPath) {
	try {
		return fs.readdirSync(projectPath).filter((name) => TSCONFIG_FILE_RE.test(name)).map((name) => path.join(projectPath, name));
	} catch {
		return [];
	}
}
function hasBaseUrlInTsconfig(projectPath) {
	return findTsconfigFiles(projectPath).some((filePath) => hasBaseUrlInTsconfigFile(filePath));
}
function findTsconfigFilesWithBaseUrl(projectPath) {
	return findTsconfigFiles(projectPath).filter((filePath) => hasBaseUrlInTsconfigFile(filePath));
}
async function confirmBaseUrlFix(interactive) {
	if (!interactive) return true;
	const command = [BASEURL_TSCONFIG_FIX_PACKAGE, ...createBaseUrlTsconfigFixArgs("<tsconfig path>")].join(" ");
	const confirmed = await confirm({
		message: "Your tsconfig contains `baseUrl`, which prevents enabling type-aware linting.\n  " + styleText("gray", "`baseUrl` is deprecated in TypeScript 6.0 and removed in TypeScript 7.0.") + `\n  Download and run the external \`${BASEURL_TSCONFIG_FIX_PACKAGE}\` fixer now?\n  ` + styleText("gray", `Equivalent command: \`vp dlx ${command}\``),
		initialValue: true
	});
	if (isCancel(confirmed)) cancelAndExit();
	return confirmed;
}
async function fixBaseUrlInTsconfig(projectPath, options) {
	const files = findTsconfigFilesWithBaseUrl(projectPath);
	if (files.length === 0) return "not-needed";
	if (!(options?.confirmed ?? await confirmBaseUrlFix(options?.interactive ?? false))) {
		options?.onStatus?.("declined", projectPath);
		return "declined";
	}
	try {
		for (const filePath of files) {
			const target = path.relative(projectPath, filePath) || filePath;
			const fixArgs = createBaseUrlTsconfigFixArgs(target);
			if (!options?.silent) log.info(`Running vp dlx ${BASEURL_TSCONFIG_FIX_PACKAGE} ${fixArgs.join(" ")}`);
			const result = await runCommandSilently({
				command: process.env.VP_CLI_BIN ?? "vp",
				args: [
					"dlx",
					BASEURL_TSCONFIG_FIX_PACKAGE,
					...fixArgs
				],
				cwd: projectPath,
				envs: process.env
			});
			if (result.exitCode !== 0) {
				if (!options?.silent) {
					const output = `${result.stdout.toString()}${result.stderr.toString()}`.trim();
					if (output) log.warn(output);
				}
				options?.onStatus?.("failed", projectPath);
				return "failed";
			}
		}
		if (hasBaseUrlInTsconfig(projectPath)) {
			if (!options?.silent) log.warn("tsconfig still contains baseUrl after running the fixer.");
			options?.onStatus?.("failed", projectPath);
			return "failed";
		}
	} catch (error) {
		if (!options?.silent && error instanceof Error) log.warn(error.message);
		options?.onStatus?.("failed", projectPath);
		return "failed";
	}
	options?.onStatus?.("fixed", projectPath);
	return "fixed";
}
function removeDeprecatedTsconfigFalseOption(filePath, optionName) {
	let text;
	try {
		text = fs.readFileSync(filePath, "utf-8");
	} catch {
		return false;
	}
	if (parse(text)?.compilerOptions?.[optionName] !== false) return false;
	const edits = modify(text, ["compilerOptions", optionName], void 0, {});
	if (edits.length === 0) return false;
	const newText = applyEdits(text, edits);
	fs.writeFileSync(filePath, newText);
	return true;
}
const TSCONFIG_TYPE_REPLACEMENTS = { "tsdown/client": "vite-plus/pack/client" };
function hasTypesToRewriteInTsconfig(filePath) {
	let text;
	try {
		text = fs.readFileSync(filePath, "utf-8");
	} catch {
		return false;
	}
	const types = parse(text)?.compilerOptions?.types;
	return Array.isArray(types) && types.some((t) => typeof t === "string" && t in TSCONFIG_TYPE_REPLACEMENTS);
}
function hasVitestTypesInTsconfig(filePath) {
	let text;
	try {
		text = fs.readFileSync(filePath, "utf-8");
	} catch {
		return false;
	}
	const types = parse(text)?.compilerOptions?.types;
	return Array.isArray(types) && types.some((type) => typeof type === "string" ? type === "vitest" || type.startsWith("vitest/") : false);
}
function rewriteTypesInTsconfig(filePath) {
	let text;
	try {
		text = fs.readFileSync(filePath, "utf-8");
	} catch {
		return false;
	}
	const types = parse(text)?.compilerOptions?.types;
	if (!Array.isArray(types)) return false;
	const toReplace = types.map((t, i) => typeof t === "string" && t in TSCONFIG_TYPE_REPLACEMENTS ? {
		i,
		newVal: TSCONFIG_TYPE_REPLACEMENTS[t]
	} : null).filter((x) => x !== null);
	if (toReplace.length === 0) return false;
	let currentText = text;
	for (let j = toReplace.length - 1; j >= 0; j--) {
		const { i, newVal } = toReplace[j];
		const edits = modify(currentText, [
			"compilerOptions",
			"types",
			i
		], newVal, {});
		if (edits.length > 0) currentText = applyEdits(currentText, edits);
	}
	fs.writeFileSync(filePath, currentText);
	return true;
}
//#endregion
export { hasBaseUrlInTsconfig as a, hasVitestTypesInTsconfig as c, fixBaseUrlInTsconfig as i, removeDeprecatedTsconfigFalseOption as l, findTsconfigFiles as n, hasBaseUrlInTsconfigFile as o, findTsconfigFilesWithBaseUrl as r, hasTypesToRewriteInTsconfig as s, confirmBaseUrlFix as t, rewriteTypesInTsconfig as u };
