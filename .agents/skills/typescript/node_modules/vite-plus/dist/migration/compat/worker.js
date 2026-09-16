import { n as addMigrationWarning, r as createMigrationReport } from "../../report-ZNR1Mk6h.js";
import { t as ROLLDOWN_COMPAT_RESULT_PREFIX } from "../../protocol-D99W10Qi.js";
import { writeSync } from "node:fs";
//#region src/migration/compat/manual-chunks.ts
/**
* Check for Rolldown-incompatible manualChunks config patterns.
*/
function checkManualChunksCompat(output, report) {
	const outputs = Array.isArray(output) ? output : output ? [output] : [];
	for (const out of outputs) if (out.manualChunks != null && typeof out.manualChunks !== "function") {
		addMigrationWarning(report, "Object-form `build.rollupOptions.output.manualChunks` is not supported by Rolldown. Convert it to function form or use `build.rolldownOptions.output.codeSplitting`. See: https://rolldown.rs/options/output#manualchunks and https://rolldown.rs/in-depth/manual-code-splitting");
		break;
	}
}
//#endregion
//#region src/migration/compat/worker.ts
async function main() {
	const rootDir = process.argv[2];
	if (!rootDir) return;
	try {
		const { resolveConfig } = await import("../../index.js");
		const { withConfigMetadataResolution } = await import("../../define-config.js");
		const config = await withConfigMetadataResolution(() => resolveConfig({
			root: rootDir,
			logLevel: "silent",
			configLoader: "runner"
		}, "build"));
		const report = createMigrationReport();
		checkManualChunksCompat(config.build?.rollupOptions?.output, report);
		writeSync(process.stdout.fd, `${ROLLDOWN_COMPAT_RESULT_PREFIX}${JSON.stringify({ warnings: report.warnings })}\n`);
	} catch {}
}
main().then(() => process.exit(0), () => process.exit(0));
//#endregion
export {};
