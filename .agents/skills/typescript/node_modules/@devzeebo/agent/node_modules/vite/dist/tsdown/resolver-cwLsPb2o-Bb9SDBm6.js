import { r as createDebug } from "./main-Bcv7jU2b.js";
import { t as requireTS } from "./dist-BsS7BOcb.js";
import path from "node:path";
//#region ../../node_modules/.pnpm/rolldown-plugin-dts@0.27.13_@typescript+native-preview@7.0.0-dev.20260605.1_oxc-resolve_19173df252fb1b72b750fe1e656588b8/node_modules/rolldown-plugin-dts/dist/resolver-cwLsPb2o.mjs
const debug = createDebug("rolldown-plugin-dts:tsc-resolver");
const ts = requireTS();
function tscResolve(id, importer, cwd, tsconfig, tsconfigRaw, reference) {
	const baseDir = tsconfig ? path.dirname(tsconfig) : cwd;
	const parsedConfig = ts.parseJsonConfigFileContent(tsconfigRaw, ts.sys, baseDir);
	const resolved = ts.bundlerModuleNameResolver(id, importer, {
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		...parsedConfig.options
	}, ts.sys, void 0, reference);
	debug(`tsc resolving id "%s" from "%s" -> %O`, id, importer, resolved.resolvedModule);
	return resolved.resolvedModule?.resolvedFileName;
}
//#endregion
export { tscResolve };
