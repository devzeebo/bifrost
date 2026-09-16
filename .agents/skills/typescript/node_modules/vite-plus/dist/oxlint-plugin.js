import { n as VITE_PLUS_OXLINT_PLUGIN_NAME, t as PREFER_VITE_PLUS_IMPORTS_RULE_NAME } from "./oxlint-plugin-config-DX5ezKbB.js";
import path from "node:path";
import fs from "node:fs";
import { definePlugin, defineRule } from "@oxlint/plugins";
//#region src/vite-config-entry-basenames.json
var vite_config_entry_basenames_default = [
	"vite.config.ts",
	"vite.config.mts",
	"vite.config.cts",
	"vite.config.js",
	"vite.config.mjs",
	"vite.config.cjs",
	"vitest.config.ts",
	"vitest.config.mts",
	"vitest.config.cts",
	"vitest.config.js",
	"vitest.config.mjs",
	"vitest.config.cjs"
];
//#endregion
//#region src/oxlint-plugin.ts
function isVitestFamilyDeclareModuleSpecifier(specifier) {
	return specifier === "vitest" || specifier.startsWith("vitest/") || specifier === "@vitest/browser" || specifier.startsWith("@vitest/browser/") || specifier.startsWith("@vitest/browser-");
}
const VITE_CONFIG_FILE_BASENAMES = new Set(vite_config_entry_basenames_default);
function isViteSpecifier(specifier) {
	return specifier === "vite" || specifier.startsWith("vite/");
}
function isViteConfigFile(filename) {
	return VITE_CONFIG_FILE_BASENAMES.has(path.basename(filename));
}
function rewriteVitePlusImportSpecifier(specifier) {
	if (specifier === "vite") return "vite-plus";
	if (specifier.startsWith("vite/")) return `vite-plus/${specifier.slice(5)}`;
	if (specifier === "vitest/config") return "vite-plus";
	if (specifier === "vitest") return "vite-plus/test";
	if (specifier === "vitest/package.json") return null;
	if (specifier.startsWith("vitest/")) return `vite-plus/test/${specifier.slice(7)}`;
	if (specifier === "@vitest/browser") return "vite-plus/test/browser";
	const browserSubpathRewrites = {
		"@vitest/browser/context": "vite-plus/test/browser/context",
		"@vitest/browser/client": "vite-plus/test/client",
		"@vitest/browser/locators": "vite-plus/test/locators",
		"@vitest/browser/matchers": "vite-plus/test/matchers",
		"@vitest/browser/utils": "vite-plus/test/utils"
	};
	if (specifier in browserSubpathRewrites) return browserSubpathRewrites[specifier];
	for (const [prefix, provider] of [
		["@vitest/browser-playwright", "playwright"],
		["@vitest/browser-preview", "preview"],
		["@vitest/browser-webdriverio", "webdriverio"]
	]) {
		if (specifier === prefix) return `vite-plus/test/${prefix.slice(8)}`;
		if (specifier === `${prefix}/context`) return "vite-plus/test/browser/context";
		if (specifier === `${prefix}/provider`) return `vite-plus/test/browser/providers/${provider}`;
	}
	return null;
}
function quoteSpecifier(literal, replacement) {
	const quote = literal.raw?.startsWith("'") ? "'" : "\"";
	return `${quote}${replacement}${quote}`;
}
const nuxtTestUtilsPackageCache = /* @__PURE__ */ new Map();
function isUpstreamVitestSpecifier(specifier) {
	return specifier === "vitest" || specifier.startsWith("vitest/");
}
function nearestPackageUsesNuxtTestUtils(filename) {
	if (!path.isAbsolute(filename)) return false;
	let directory = path.dirname(filename);
	while (true) {
		const packageJsonPath = path.join(directory, "package.json");
		if (fs.existsSync(packageJsonPath)) {
			let mtimeMs;
			try {
				mtimeMs = fs.statSync(packageJsonPath).mtimeMs;
			} catch {}
			const cached = mtimeMs === void 0 ? void 0 : nuxtTestUtilsPackageCache.get(packageJsonPath);
			if (cached !== void 0 && cached.mtimeMs === mtimeMs) return cached.usesNuxtTestUtils;
			let usesNuxtTestUtils = false;
			try {
				const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
				usesNuxtTestUtils = [
					pkg.dependencies,
					pkg.devDependencies,
					pkg.optionalDependencies
				].some((dependencies) => dependencies?.["@nuxt/test-utils"] !== void 0);
			} catch {}
			if (mtimeMs !== void 0) nuxtTestUtilsPackageCache.set(packageJsonPath, {
				mtimeMs,
				usesNuxtTestUtils
			});
			return usesNuxtTestUtils;
		}
		const parent = path.dirname(directory);
		if (parent === directory) return false;
		directory = parent;
	}
}
function maybeReportLiteral(context, literal, preserveUpstreamVitest = false, fileIsViteConfig = false) {
	if (!literal || literal.type !== "Literal" || typeof literal.value !== "string") return;
	if (preserveUpstreamVitest && isUpstreamVitestSpecifier(literal.value)) return;
	if (!fileIsViteConfig && isViteSpecifier(literal.value)) return;
	const replacement = rewriteVitePlusImportSpecifier(literal.value);
	if (!replacement) return;
	context.report({
		node: literal,
		messageId: "preferVitePlusImports",
		data: {
			from: literal.value,
			to: replacement
		},
		fix(fixer) {
			return fixer.replaceText(literal, quoteSpecifier(literal, replacement));
		}
	});
}
const preferVitePlusImportsRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description: "Prefer vite-plus module specifiers over vite and vitest packages.",
			recommended: true,
			url: "https://github.com/voidzero-dev/vite-plus/issues/1301"
		},
		fixable: "code",
		messages: { preferVitePlusImports: "Use '{{to}}' instead of '{{from}}' in Vite+ projects." }
	},
	createOnce(context) {
		let preserveUpstreamVitest = false;
		let fileIsViteConfig = false;
		return {
			Program() {
				preserveUpstreamVitest = nearestPackageUsesNuxtTestUtils(context.filename);
				fileIsViteConfig = isViteConfigFile(context.filename);
			},
			ImportDeclaration(node) {
				maybeReportLiteral(context, node.source, preserveUpstreamVitest, fileIsViteConfig);
			},
			ExportAllDeclaration(node) {
				maybeReportLiteral(context, node.source, preserveUpstreamVitest, fileIsViteConfig);
			},
			ExportNamedDeclaration(node) {
				maybeReportLiteral(context, node.source, preserveUpstreamVitest, fileIsViteConfig);
			},
			ImportExpression(node) {
				maybeReportLiteral(context, node.source, preserveUpstreamVitest, fileIsViteConfig);
			},
			TSImportType(node) {
				maybeReportLiteral(context, node.source, preserveUpstreamVitest, fileIsViteConfig);
			},
			TSExternalModuleReference(node) {
				maybeReportLiteral(context, node.expression, preserveUpstreamVitest, fileIsViteConfig);
			},
			TSModuleDeclaration(node) {
				if (node.global) return;
				const id = node.id;
				if (id?.type === "Literal" && typeof id.value === "string" && isVitestFamilyDeclareModuleSpecifier(id.value)) return;
				maybeReportLiteral(context, id, preserveUpstreamVitest, fileIsViteConfig);
			}
		};
	}
});
const plugin = definePlugin({
	meta: { name: VITE_PLUS_OXLINT_PLUGIN_NAME },
	rules: { [PREFER_VITE_PLUS_IMPORTS_RULE_NAME]: preferVitePlusImportsRule }
});
//#endregion
export { plugin as default, preferVitePlusImportsRule, rewriteVitePlusImportSpecifier };
