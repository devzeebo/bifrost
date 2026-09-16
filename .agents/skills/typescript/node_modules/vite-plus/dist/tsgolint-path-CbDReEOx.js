import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, realpathSync } from "node:fs";
//#region src/utils/tsgolint-path.ts
function resolveWindowsTsgolintExecutable(pathCandidates, options) {
	let oxlintTsgolintPath = pathCandidates.find((p) => options.exists(p)) ?? "";
	if (!oxlintTsgolintPath && options.getRealpathCandidates) try {
		oxlintTsgolintPath = options.getRealpathCandidates().find((p) => options.exists(p)) ?? "";
	} catch {}
	if (!oxlintTsgolintPath) throw new Error("Unable to resolve oxlint-tsgolint executable, tried:\n" + pathCandidates.map((path) => `- ${path}`).join("\n"));
	return oxlintTsgolintPath;
}
function resolveTsgolintExecutable(tsgolintBinPath, scriptUrl) {
	if (process.platform !== "win32") return tsgolintBinPath;
	const scriptDir = dirname(fileURLToPath(scriptUrl));
	const localBinDir = join(scriptDir, "..", "node_modules", ".bin");
	const oxlintTsgolintPackagePath = dirname(dirname(tsgolintBinPath));
	const projectBinDir = join(oxlintTsgolintPackagePath, "..", ".bin");
	return resolveWindowsTsgolintExecutable([
		join(localBinDir, "tsgolint.exe"),
		join(localBinDir, "tsgolint.cmd"),
		join(projectBinDir, "tsgolint.exe"),
		join(projectBinDir, "tsgolint.cmd")
	], {
		exists: existsSync,
		getRealpathCandidates: () => {
			const realPkgDir = realpathSync(join(scriptDir, ".."));
			const realBinDir = join(dirname(realPkgDir), ".bin");
			return [join(realBinDir, "tsgolint.exe"), join(realBinDir, "tsgolint.cmd")];
		}
	});
}
//#endregion
export { resolveWindowsTsgolintExecutable as n, resolveTsgolintExecutable as t };
