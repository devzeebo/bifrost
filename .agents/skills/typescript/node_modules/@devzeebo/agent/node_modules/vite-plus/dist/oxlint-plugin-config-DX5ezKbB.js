import { u as VITE_PLUS_NAME } from "./constants-Bn-U8o4v.js";
//#region src/oxlint-plugin-config.ts
const VITE_PLUS_OXLINT_PLUGIN_NAME = VITE_PLUS_NAME;
const VITE_PLUS_OXLINT_PLUGIN_SPECIFIER = `${VITE_PLUS_NAME}/oxlint-plugin`;
const PREFER_VITE_PLUS_IMPORTS_RULE_NAME = "prefer-vite-plus-imports";
const PREFER_VITE_PLUS_IMPORTS_RULE = `${VITE_PLUS_OXLINT_PLUGIN_NAME}/${PREFER_VITE_PLUS_IMPORTS_RULE_NAME}`;
function hasVitePlusPlugin(entry) {
	if (typeof entry === "string") return entry === VITE_PLUS_OXLINT_PLUGIN_SPECIFIER;
	return entry.specifier === VITE_PLUS_OXLINT_PLUGIN_SPECIFIER;
}
function isRuleRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function ensureVitePlusImportRuleDefaults(config) {
	const jsPlugins = Array.isArray(config.jsPlugins) ? [...config.jsPlugins] : [];
	if (!jsPlugins.some(hasVitePlusPlugin)) jsPlugins.push({
		name: VITE_PLUS_OXLINT_PLUGIN_NAME,
		specifier: VITE_PLUS_OXLINT_PLUGIN_SPECIFIER
	});
	const rules = isRuleRecord(config.rules) ? { ...config.rules } : {};
	if (!(PREFER_VITE_PLUS_IMPORTS_RULE in rules)) rules[PREFER_VITE_PLUS_IMPORTS_RULE] = "error";
	return {
		...config,
		jsPlugins,
		rules
	};
}
function createDefaultVitePlusLintConfig(options) {
	const config = ensureVitePlusImportRuleDefaults({});
	if (options?.includeTypeAwareDefaults) config.options = {
		typeAware: true,
		typeCheck: true
	};
	return config;
}
//#endregion
export { ensureVitePlusImportRuleDefaults as i, VITE_PLUS_OXLINT_PLUGIN_NAME as n, createDefaultVitePlusLintConfig as r, PREFER_VITE_PLUS_IMPORTS_RULE_NAME as t };
