//#region src/oxlint-plugin.d.ts
declare function rewriteVitePlusImportSpecifier(specifier: string): string | null;
declare const preferVitePlusImportsRule: import("@oxlint/plugins").Rule;
declare const plugin: import("@oxlint/plugins").Plugin;
//#endregion
export { plugin as default, preferVitePlusImportsRule, rewriteVitePlusImportSpecifier };