//#region src/migration/report.ts
function createMigrationReport() {
	return {
		createdViteConfigCount: 0,
		mergedConfigCount: 0,
		mergedStagedConfigCount: 0,
		inlinedLintStagedConfigCount: 0,
		removedConfigCount: 0,
		tsdownImportCount: 0,
		wrappedPluginConfigCount: 0,
		rewrittenImportFileCount: 0,
		preservedUpstreamVitestImportFileCount: 0,
		rewrittenImportErrors: [],
		eslintMigrated: false,
		tsupMigrated: false,
		prettierMigrated: false,
		nodeVersionFileMigrated: false,
		gitHooksConfigured: false,
		frameworkShimAdded: false,
		packageManagerBootstrapConfigured: false,
		dependencyUpgrades: [],
		warnings: [],
		manualSteps: []
	};
}
function addMigrationWarning(report, warning) {
	if (!report || report.warnings.includes(warning)) return;
	report.warnings.push(warning);
}
function addManualStep(report, step) {
	if (!report || report.manualSteps.includes(step)) return;
	report.manualSteps.push(step);
}
//#endregion
export { addMigrationWarning as n, createMigrationReport as r, addManualStep as t };
