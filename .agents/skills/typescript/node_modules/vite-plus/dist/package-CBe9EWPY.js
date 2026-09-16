import "./constants-Bn-U8o4v.js";
import { i as readJsonFile } from "./json-cULBl7Pi.js";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
//#region src/utils/npm-config.ts
function expandNpmrcValue(raw) {
	let value = raw.trim();
	if (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
	return value.replaceAll(/\$\{([A-Z0-9_]+)\}/gi, (_, name) => process.env[name] ?? "");
}
function parseNpmrc(contents, into) {
	for (const rawLine of contents.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#") || line.startsWith(";")) continue;
		const eq = line.indexOf("=");
		if (eq === -1) continue;
		const key = line.slice(0, eq).trim();
		const value = expandNpmrcValue(line.slice(eq + 1));
		if (key) into.set(key, value);
	}
}
function loadFileInto(filePath, config) {
	try {
		parseNpmrc(fs.readFileSync(filePath, "utf8"), config);
	} catch {}
}
/**
* Rebuilt on every call so tests that mutate `process.env` mid-run see
* fresh config. Each `vp create` hits this ≤4 times (registry + auth on
* packument + auth on tarball), which is cheap enough vs. the network
* work that a cache isn't worth the test-determinism cost.
*/
function getNpmConfig() {
	const config = /* @__PURE__ */ new Map();
	const homeNpmrc = path.resolve(os.homedir(), ".npmrc");
	loadFileInto(homeNpmrc, config);
	const projectRcs = [];
	let dir = path.resolve(process.cwd());
	const seen = /* @__PURE__ */ new Set();
	while (dir && !seen.has(dir)) {
		seen.add(dir);
		const candidate = path.resolve(dir, ".npmrc");
		if (candidate !== homeNpmrc && fs.existsSync(candidate)) projectRcs.push(candidate);
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	for (let i = projectRcs.length - 1; i >= 0; i -= 1) loadFileInto(projectRcs[i], config);
	for (const [envKey, envValue] of Object.entries(process.env)) {
		if (envValue === void 0) continue;
		if (envKey.startsWith("npm_config_")) config.set(envKey.slice(11), envValue);
		else if (envKey.startsWith("NPM_CONFIG_")) config.set(envKey.slice(11).toLowerCase(), envValue);
	}
	return config;
}
function normalizeRegistryUrl(url) {
	return url.replace(/\/+$/, "");
}
/**
* Resolve the npm registry base URL for the given scope (or the default
* registry when `scope` is omitted). Honors `@scope:registry=...` entries
* in `.npmrc` files and the matching `npm_config_@scope:registry` env
* vars so private / mirrored registries work for org manifest fetches.
*/
function getNpmRegistry(scope) {
	const config = getNpmConfig();
	if (scope) {
		const normalizedScope = scope.startsWith("@") ? scope : `@${scope}`;
		const scoped = config.get(`${normalizedScope}:registry`);
		if (scoped) return normalizeRegistryUrl(scoped);
	}
	return normalizeRegistryUrl(config.get("registry") || "https://registry.npmjs.org");
}
/**
* Build the `Authorization` header value for a registry URL by matching
* the URL against `//host[/path]/:_authToken=...` / `:_auth=...` entries
* in `.npmrc`. Returns `undefined` when no credential is configured.
*/
function getNpmAuthHeader(registryOrUrl) {
	let parsed;
	try {
		parsed = new URL(registryOrUrl);
	} catch {
		return;
	}
	const config = getNpmConfig();
	const segments = parsed.pathname.split("/").filter(Boolean);
	const candidates = [];
	for (let i = segments.length; i >= 0; i -= 1) {
		const subPath = i === 0 ? "/" : `/${segments.slice(0, i).join("/")}/`;
		candidates.push(`//${parsed.host}${subPath}`);
	}
	for (const prefix of candidates) {
		const token = config.get(`${prefix}:_authToken`);
		if (token) return `Bearer ${token}`;
		const basic = config.get(`${prefix}:_auth`);
		if (basic) return `Basic ${basic}`;
		const username = config.get(`${prefix}:username`);
		const passwordB64 = config.get(`${prefix}:_password`);
		if (username && passwordB64) {
			const password = Buffer.from(passwordB64, "base64").toString("utf8");
			return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
		}
	}
}
/**
* `fetch` wrapper for npm registry URLs that retries with an
* `Authorization` header on 401/403. Public registries never see the
* token — we only reach into `.npmrc` when the server challenges us.
*
* `init.headers` is forwarded verbatim on both attempts (the retry
* merges in the discovered auth header on top).
*/
async function fetchNpmResource(url, init) {
	const { timeoutMs, headers: callerHeaders, ...rest } = init;
	const first = await fetch(url, {
		...rest,
		headers: callerHeaders,
		signal: AbortSignal.timeout(timeoutMs)
	});
	if (first.status !== 401 && first.status !== 403) return first;
	const authorization = getNpmAuthHeader(url);
	if (!authorization) return first;
	return fetch(url, {
		...rest,
		headers: {
			...callerHeaders,
			authorization
		},
		signal: AbortSignal.timeout(timeoutMs)
	});
}
//#endregion
//#region src/utils/package.ts
function getScopeFromPackageName(packageName) {
	if (packageName.startsWith("@")) return packageName.split("/")[0];
	return "";
}
function findOwningPackageJson(resolvedPath, packageName) {
	let currentDir;
	try {
		currentDir = fs.statSync(resolvedPath).isDirectory() ? resolvedPath : path.dirname(resolvedPath);
	} catch {
		return;
	}
	while (currentDir !== path.dirname(currentDir)) {
		const candidate = path.join(currentDir, "package.json");
		if (fs.existsSync(candidate)) try {
			if (JSON.parse(fs.readFileSync(candidate, "utf8")).name === packageName) return candidate;
		} catch {}
		currentDir = path.dirname(currentDir);
	}
}
function resolvePackageJsonWithNode(require, packageName) {
	try {
		return require.resolve(`${packageName}/package.json`);
	} catch {}
	try {
		return findOwningPackageJson(require.resolve(packageName), packageName);
	} catch {
		return;
	}
}
function findPnpApiPath(projectPath) {
	let currentDir = path.resolve(projectPath);
	while (currentDir !== path.dirname(currentDir)) {
		const candidate = path.join(currentDir, ".pnp.cjs");
		if (fs.existsSync(candidate)) return candidate;
		currentDir = path.dirname(currentDir);
	}
}
function detectPackageMetadata(projectPath, packageName) {
	const require = createRequire(path.join(projectPath, "noop.js"));
	let pkgFilePath = resolvePackageJsonWithNode(require, packageName);
	if (!pkgFilePath) {
		const pnpApiPath = findPnpApiPath(projectPath);
		if (!pnpApiPath) return;
		try {
			const pnpApi = createRequire(pnpApiPath)(pnpApiPath);
			const issuer = path.join(projectPath, "noop.js");
			if (pnpApi.findPackageLocator && !pnpApi.findPackageLocator(issuer)) return;
			pnpApi.setup?.();
			pkgFilePath = findOwningPackageJson(pnpApi.resolveToUnqualified(packageName, issuer), packageName);
			if (!pkgFilePath) pkgFilePath = resolvePackageJsonWithNode(require, packageName);
		} catch {
			return;
		}
	}
	if (!pkgFilePath) return;
	try {
		const pkg = JSON.parse(fs.readFileSync(pkgFilePath, "utf8"));
		return {
			name: pkg.name,
			version: pkg.version,
			path: path.dirname(pkgFilePath)
		};
	} catch {
		return;
	}
}
/**
* Read the nearest package.json file from the current directory up to the root directory.
* @param currentDir - The current directory to start searching from.
* @returns The package.json content as a JSON object, or null if no package.json is found.
*/
function readNearestPackageJson(currentDir) {
	do {
		const packageJsonPath = path.join(currentDir, "package.json");
		if (fs.existsSync(packageJsonPath)) return readJsonFile(packageJsonPath);
		currentDir = path.dirname(currentDir);
	} while (currentDir !== path.dirname(currentDir));
	return null;
}
function hasVitePlusDependency(pkg) {
	return Boolean(pkg?.dependencies?.["vite-plus"] || pkg?.devDependencies?.["vite-plus"]);
}
/**
* Check if an npm package exists on its resolved registry.
* Returns true if the package exists or if the check could not be performed (network error, timeout).
* Returns false only if the registry definitively responds with 404.
*/
async function checkNpmPackageExists(packageName) {
	const atIndex = packageName.indexOf("@", 2);
	const name = atIndex === -1 ? packageName : packageName.slice(0, atIndex);
	const scope = getScopeFromPackageName(name);
	try {
		return (await fetchNpmResource(`${getNpmRegistry(scope)}/${name}`, {
			method: "HEAD",
			timeoutMs: 3e3
		})).status !== 404;
	} catch {
		return true;
	}
}
//#endregion
export { readNearestPackageJson as a, hasVitePlusDependency as i, detectPackageMetadata as n, fetchNpmResource as o, getScopeFromPackageName as r, getNpmRegistry as s, checkNpmPackageExists as t };
