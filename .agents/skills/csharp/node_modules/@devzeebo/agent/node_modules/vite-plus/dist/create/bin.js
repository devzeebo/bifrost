import { r as __toESM, t as __commonJSMin } from "../rolldown-runtime-CMFfr-1z.js";
import { t as renderCliDoc } from "../help-BmKpeOP9.js";
import { a as muted, i as log, o as printHeader, r as formatDuration, s as success, t as accent } from "../terminal-MKGAuy-p.js";
import { u as VITE_PLUS_NAME } from "../constants-Bn-U8o4v.js";
import { a as resolveViteConfig, n as findWorkspaceRoot, r as hasViteConfig, t as findViteConfig } from "../resolve-vite-config-ipGb39Jo.js";
import { A as isCancel, C as log$1, D as spinner, E as select, O as text, S as intro, a as resolveGitInit, c as selectPackageManager, d as readYamlFile, h as resolveApproveBuildTargets, i as promptGitHooks, k as require_picocolors, m as detectGatedBuilds, n as defaultInteractive, o as runViteFmt, p as approveBuilds, r as downloadPackageManager$1, s as runViteInstall, t as cancelAndExit, u as editYamlFile, v as DependencyType, w as multiselect, y as PackageManager } from "../prompts-DF3yU-eU.js";
import { t as lib_default } from "../lib-L3DWSRQp.js";
import { i as readJsonFile, n as editJsonFile } from "../json-cULBl7Pi.js";
import { o as fetchNpmResource, r as getScopeFromPackageName, s as getNpmRegistry, t as checkNpmPackageExists } from "../package-CBe9EWPY.js";
import { a as selectAgentTargets, c as writeCopilotSetupWorkflow, d as templatesDir, l as displayRelative, r as detectExistingAgentTargetPaths, s as writeAgentInstructions, t as COPILOT_AGENT_ID } from "../agent-Wqx0MPk0.js";
import { A as detectWorkspace$1, B as promptTsupMigration, F as detectFramework, G as promptPrettierMigration, I as hasFrameworkShim, J as detectEslintProject, M as updatePackageJsonWithDeps, N as updateWorkspaceConfig, P as addFrameworkShim, R as detectTsupProject, U as detectPrettierProject, Z as promptEslintMigration, a as selectEditors, b as initGitRepository, c as rewriteMonorepoProject, g as installGitHooks, j as isBingoTemplate, l as rewriteStandaloneProject, m as setPackageManager, n as detectExistingEditors, o as writeEditorConfigs, s as rewriteMonorepo, v as shouldSkipStagedMigrationForHooks, x as injectCreateDefaultTemplate, y as findGitRoot } from "../editor-CC4DqODz.js";
import { n as runCommandSilently, t as runCommand$1 } from "../command-CguLh2KL.js";
import path from "node:path";
import { getVpDirs, runCommand, upsertJsonConfig, vitePlusHeader } from "../../binding/index.js";
import { styleText } from "node:util";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import fsPromises from "node:fs/promises";
import assert from "node:assert";
//#region src/create/command.ts
async function runCommandAndDetectProjectDir(options, parentDir) {
	const cwd = parentDir ? path.join(options.cwd, parentDir) : options.cwd;
	const existingDirs = /* @__PURE__ */ new Set();
	if (parentDir) {
		await fsPromises.mkdir(cwd, { recursive: true });
		const entries = await fsPromises.readdir(cwd, { withFileTypes: true });
		for (const entry of entries) if (entry.isDirectory()) existingDirs.add(entry.name);
	}
	const result = await runCommand({
		binName: options.command,
		args: options.args,
		envs: options.envs,
		cwd
	});
	let projectDir;
	let currentDirPackageJsonWritten = false;
	let minDepth = Infinity;
	for (const [filePath, pathAccess] of Object.entries(result.pathAccesses)) if (pathAccess.write && filePath.endsWith("package.json") && !filePath.includes("node_modules")) {
		const dir = path.dirname(filePath);
		if (dir === "." || dir === "") {
			currentDirPackageJsonWritten = true;
			continue;
		}
		if (existingDirs.has(dir)) continue;
		const depth = dir.split(path.sep).length;
		if (depth < minDepth) {
			minDepth = depth;
			projectDir = dir;
		}
	}
	if (!projectDir && currentDirPackageJsonWritten) projectDir = ".";
	if (parentDir && projectDir) projectDir = path.join(parentDir, projectDir);
	return {
		exitCode: result.exitCode,
		projectDir
	};
}
function getPackageRunner(workspaceInfo) {
	switch (workspaceInfo.packageManager) {
		case "pnpm": return {
			command: "pnpm",
			args: ["dlx"]
		};
		case "yarn": return {
			command: "yarn",
			args: ["dlx"]
		};
		case "bun": return {
			command: "bun",
			args: ["x"]
		};
		default: return {
			command: "npx",
			args: []
		};
	}
}
function formatDlxCommand(packageName, args, workspaceInfo) {
	const runner = getPackageRunner(workspaceInfo);
	return {
		command: runner.command,
		args: [
			...runner.args,
			packageName,
			...args
		]
	};
}
function prependToPathToEnvs(extraPath, envs) {
	const delimiter = path.delimiter;
	const pathKey = Object.keys(envs).find((key) => key.toLowerCase() === "path") ?? "PATH";
	const current = envs[pathKey] ?? "";
	if (!current.split(delimiter).filter(Boolean).includes(extraPath)) envs[pathKey] = extraPath + (current ? delimiter + current : "");
	return envs;
}
//#endregion
//#region ../../node_modules/.pnpm/nanotar@0.3.0/node_modules/nanotar/dist/index.mjs
const tarItemTypeMap = {
	"0": "file",
	"1": "hardLink",
	"2": "symbolicLink",
	"3": "characterDevice",
	"4": "blockDevice",
	"5": "directory",
	"6": "fifo",
	"7": "contiguousFile",
	"g": "globalExtendedHeader",
	"x": "extendedHeader",
	"D": "gnuDirectory",
	"I": "gnuInodeMetadata",
	"K": "gnuLongLinkName",
	"L": "gnuLongFileName",
	"N": "gnuOldLongFileName",
	"M": "gnuMultiVolume",
	"S": "gnuSparseFile",
	"E": "gnuExtendedSparse",
	"A": "solarisAcl",
	"V": "solarisVolumeLabel",
	"X": "solarisOldExtendedHeader"
};
function parseTar(data, opts) {
	const buffer = data.buffer || data;
	const files = [];
	let offset = 0;
	let nextExtendedHeader;
	let globalExtendedHeader;
	while (offset < buffer.byteLength - 512) {
		let name = _readString(buffer, offset, 100);
		if (name.length === 0) break;
		if (nextExtendedHeader) {
			const longName = nextExtendedHeader.path || nextExtendedHeader.linkpath;
			if (longName) name = longName;
		}
		const mode = _readString(buffer, offset + 100, 8).trim();
		const uid = Number.parseInt(_readString(buffer, offset + 108, 8));
		const gid = Number.parseInt(_readString(buffer, offset + 116, 8));
		const size = _readNumber(buffer, offset + 124, 12);
		const seek = 512 + 512 * Math.trunc(size / 512) + (size % 512 ? 512 : 0);
		const mtime = _readNumber(buffer, offset + 136, 12);
		const _type = _readString(buffer, offset + 156, 1) || "0";
		const type = tarItemTypeMap[_type] || _type;
		switch (type) {
			case "extendedHeader":
			case "globalExtendedHeader": {
				const headers = _parseExtendedHeaders(new Uint8Array(buffer, offset + 512, size));
				if (type === "extendedHeader") nextExtendedHeader = headers;
				else {
					nextExtendedHeader = void 0;
					globalExtendedHeader = {
						...globalExtendedHeader,
						...headers
					};
				}
				offset += seek;
				continue;
			}
			case "gnuLongFileName":
			case "gnuOldLongFileName":
			case "gnuLongLinkName":
				nextExtendedHeader = { path: _readString(buffer, offset + 512, size) };
				offset += seek;
				continue;
		}
		const user = _readString(buffer, offset + 265, 32);
		const group = _readString(buffer, offset + 297, 32);
		name = _sanitizePath(name);
		const meta = {
			name,
			type,
			size,
			attrs: {
				...globalExtendedHeader,
				...nextExtendedHeader,
				mode,
				uid,
				gid,
				mtime,
				user,
				group
			}
		};
		nextExtendedHeader = void 0;
		if (opts?.filter && !opts.filter(meta)) {
			offset += seek;
			continue;
		}
		if (opts?.metaOnly) {
			files.push(meta);
			offset += seek;
			continue;
		}
		const data2 = size === 0 ? void 0 : new Uint8Array(buffer, offset + 512, size);
		files.push({
			...meta,
			data: data2,
			get text() {
				return new TextDecoder().decode(this.data);
			}
		});
		offset += seek;
	}
	return files;
}
async function parseTarGzip(data, opts = {}) {
	const stream = new ReadableStream({ start(controller) {
		controller.enqueue(new Uint8Array(data));
		controller.close();
	} }).pipeThrough(new DecompressionStream(opts.compression ?? "gzip"));
	return parseTar(await new Response(stream).arrayBuffer(), opts);
}
function _sanitizePath(path) {
	let normalized = path.replace(/\\/g, "/");
	normalized = normalized.replace(/^[a-zA-Z]:\//, "");
	normalized = normalized.replace(/^\/+/, "");
	const hasLeadingDotSlash = normalized.startsWith("./");
	const parts = normalized.split("/");
	const resolved = [];
	for (const part of parts) if (part === "..") resolved.pop();
	else if (part !== "." && part !== "") resolved.push(part);
	let result = resolved.join("/");
	if (hasLeadingDotSlash && !result.startsWith("./")) result = "./" + result;
	if (path.endsWith("/") && !result.endsWith("/")) result += "/";
	return result;
}
function _readString(buffer, offset, size) {
	const view = new Uint8Array(buffer, offset, size);
	const i = view.indexOf(0);
	return new TextDecoder().decode(i === -1 ? view : view.slice(0, i));
}
function _readNumber(buffer, offset, size) {
	const view = new Uint8Array(buffer, offset, size);
	let str = "";
	for (let i = 0; i < size; i++) str += String.fromCodePoint(view[i]);
	return Number.parseInt(str, 8);
}
function _parseExtendedHeaders(data) {
	const dataStr = new TextDecoder().decode(data);
	const headers = {};
	for (const line of dataStr.split("\n")) {
		const s = line.split(" ")[1]?.split("=");
		if (s) headers[s[0]] = s[1];
	}
	return headers;
}
//#endregion
//#region src/create/org-tarball.ts
function getCacheRoot() {
	return path.join(getVpDirs().cache, "create-org");
}
/**
* Replace characters that are illegal in Windows path segments
* (`\ / : * ? " < > |` plus the IPv6 bracket pair `[ ]`). The host
* comes from `new URL(...).host` which can carry a port (`:4873`) or
* IPv6 literal (`[::1]`); both end up in the cache path otherwise.
*/
function sanitizeHostForPath(host) {
	return host.replaceAll(/[\\/:*?"<>|[\]]/g, "_");
}
/**
* Cache extracted tarballs under `<host>/<scope>/create/<version>` so two
* repos resolving the same `<scope>@<version>` through different registries
* (via `.npmrc` scope mappings) don't share a cache slot. The registry
* guarantees `manifest.tarballUrl` is a valid URL, so any parse failure
* here is a real bug worth surfacing.
*/
function getExtractionDir(manifest) {
	const { host } = new URL(manifest.tarballUrl);
	return path.join(getCacheRoot(), sanitizeHostForPath(host), manifest.scope, "create", manifest.version);
}
function parseIntegrity(integrity) {
	const match = integrity.split(/\s+/)[0].match(/^(sha\d+)-(.+)$/);
	if (!match) return null;
	return {
		algorithm: match[1],
		expected: match[2]
	};
}
function verifyIntegrity(bytes, integrity) {
	if (!integrity) return;
	const parsed = parseIntegrity(integrity);
	if (!parsed) return;
	const hash = createHash(parsed.algorithm);
	hash.update(bytes);
	const actual = hash.digest("base64");
	if (actual !== parsed.expected) throw new Error(`integrity check failed: expected ${integrity}, got ${parsed.algorithm}-${actual}`);
}
const MAX_TARBALL_BYTES = 52428800;
async function downloadTarball(url) {
	const response = await fetchNpmResource(url, { timeoutMs: 3e4 });
	if (!response.ok) throw new Error(`failed to download tarball (${response.status}): ${url}`);
	const contentLength = Number(response.headers.get("content-length"));
	if (Number.isFinite(contentLength) && contentLength > MAX_TARBALL_BYTES) throw new Error(`tarball exceeds ${MAX_TARBALL_BYTES} byte size limit: ${url}`);
	const reader = response.body?.getReader();
	if (!reader) throw new Error(`tarball response has no body: ${url}`);
	const chunks = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_TARBALL_BYTES) {
			await reader.cancel();
			throw new Error(`tarball exceeds ${MAX_TARBALL_BYTES} byte size limit: ${url}`);
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}
/**
* Download a package tarball and parse its `package/package.json`.
*
* Some registries (GitHub Packages among them) strip fields they don't
* recognize — including `createConfig` — from packument *version metadata*
* while preserving the published tarball byte-for-byte. This gives
* `readOrgManifest` a fallback source of truth for those registries.
*
* Returns `null` when the archive contains no `package/package.json`.
* Throws on download/integrity failures or unparsable JSON.
*/
async function readPackageJsonFromTarball(tarballUrl, integrity) {
	const bytes = await downloadTarball(tarballUrl);
	verifyIntegrity(bytes, integrity);
	const entries = await parseTarGzip(bytes);
	for (const entry of entries) {
		if (normalizeEntryName(entry.name) !== "package.json" || !entry.data) continue;
		const text = new TextDecoder().decode(entry.data);
		try {
			return JSON.parse(text);
		} catch {
			throw new Error(`invalid package.json in tarball: ${tarballUrl}`);
		}
	}
	return null;
}
const STAGING_SUFFIX_PREFIX = ".tmp-";
/**
* Parse a tar entry's stored mode (always octal) into the numeric
* permission bits (low 9 bits — `rwxrwxrwx`). Returns `undefined` when
* the mode is missing or unparsable so the caller leaves the file with
* its default (umask-derived) permissions instead of downgrading.
*/
function parseEntryMode(raw) {
	if (!raw) return;
	const parsed = Number.parseInt(raw, 8);
	if (!Number.isFinite(parsed)) return;
	return parsed & 511;
}
/**
* Strip the `package/` prefix from an `npm pack` tarball entry. Returns
* `null` for entries to skip (root dir, PaxHeader, anything outside
* `package/`).
*/
function normalizeEntryName(rawName) {
	const name = rawName.replace(/^\.\//, "").replace(/\\/g, "/");
	if (!name || name === "package" || name === "package/") return null;
	if (name.startsWith("PaxHeader/") || name.includes("/PaxHeader/")) return null;
	if (!name.startsWith("package/")) return null;
	return name.slice(8);
}
async function extractTarballTo(bytes, destDir) {
	const entries = await parseTarGzip(bytes);
	const stagingDir = `${destDir}${STAGING_SUFFIX_PREFIX}${process.pid}-${Date.now()}`;
	await fs.promises.mkdir(stagingDir, { recursive: true });
	const resolvedStaging = path.resolve(stagingDir);
	try {
		for (const entry of entries) {
			const relativeName = normalizeEntryName(entry.name);
			if (relativeName === null) continue;
			const targetPath = path.join(stagingDir, relativeName);
			const resolvedTarget = path.resolve(targetPath);
			if (resolvedTarget !== resolvedStaging && !resolvedTarget.startsWith(`${resolvedStaging}${path.sep}`)) throw new Error(`tarball entry escapes extraction root: ${entry.name}`);
			if (entry.type === "directory" || relativeName.endsWith("/")) {
				await fs.promises.mkdir(targetPath, { recursive: true });
				continue;
			}
			await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
			const data = entry.data ?? /* @__PURE__ */ new Uint8Array(0);
			await fs.promises.writeFile(targetPath, data);
			const mode = parseEntryMode(entry.attrs?.mode);
			if (mode !== void 0) await fs.promises.chmod(targetPath, mode);
		}
		try {
			await fs.promises.rename(stagingDir, destDir);
		} catch (error) {
			const code = error.code;
			if ((code === "ENOTEMPTY" || code === "EEXIST") && fs.existsSync(path.join(destDir, "package.json"))) {
				await fs.promises.rm(stagingDir, {
					recursive: true,
					force: true
				}).catch(() => {});
				return;
			}
			throw error;
		}
	} catch (error) {
		await fs.promises.rm(stagingDir, {
			recursive: true,
			force: true
		}).catch(() => {});
		throw error;
	}
}
const STAGING_STALE_MS = 864e5;
/**
* Remove `<destDir>.tmp-*` siblings left behind by a previous crash so
* repeated aborts don't accumulate orphaned staging trees. Only deletes
* entries whose mtime is older than 24 hours — a concurrent `vp create`
* that's still actively extracting will always be younger than that, so
* the age gate keeps this safe to run at the top of every extract.
*/
async function cleanupStaleStagingDirs(destDir) {
	const parent = path.dirname(destDir);
	const prefix = `${path.basename(destDir)}${STAGING_SUFFIX_PREFIX}`;
	let entries;
	try {
		entries = await fs.promises.readdir(parent);
	} catch {
		return;
	}
	const cutoff = Date.now() - STAGING_STALE_MS;
	await Promise.all(entries.filter((name) => name.startsWith(prefix)).map(async (name) => {
		const fullPath = path.join(parent, name);
		try {
			if ((await fs.promises.stat(fullPath)).mtimeMs < cutoff) await fs.promises.rm(fullPath, {
				recursive: true,
				force: true
			});
		} catch {}
	}));
}
/**
* Ensure the `@org/create` package tarball for the given manifest has been
* downloaded and extracted locally. Returns the absolute path to the
* extracted package root (i.e. the directory that contains
* `package.json`).
*
* Idempotent: subsequent calls for the same `<scope, version>` reuse the
* cached extraction. Concurrent calls race on the final rename; the loser
* cleans up and returns the existing directory.
*/
async function ensureOrgPackageExtracted(manifest) {
	const extractedRoot = getExtractionDir(manifest);
	if (fs.existsSync(path.join(extractedRoot, "package.json"))) return extractedRoot;
	const parent = path.dirname(extractedRoot);
	await fs.promises.mkdir(parent, { recursive: true });
	await cleanupStaleStagingDirs(extractedRoot);
	const bytes = await downloadTarball(manifest.tarballUrl);
	verifyIntegrity(bytes, manifest.integrity);
	await extractTarballTo(bytes, extractedRoot);
	return extractedRoot;
}
/**
* Resolve a manifest entry's relative `./...` path against an already-
* extracted package root, rejecting any path that escapes the root (via
* `..` walks or an absolute specifier).
*
* Existence is NOT checked here — the subsequent `copyDir` surfaces any
* missing-directory error with a clearer errno.
*/
function resolveBundledPath(extractedRoot, relativePath) {
	if (path.isAbsolute(relativePath)) throw new Error(`bundled template path must be relative, got ${relativePath}`);
	const resolvedRoot = path.resolve(extractedRoot);
	const resolvedTarget = path.resolve(extractedRoot, relativePath);
	if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`bundled template path escapes the package root: ${relativePath}`);
	return resolvedTarget;
}
//#endregion
//#region src/create/org-manifest.ts
/**
* Parse the org picker specifier: `@scope` (scope only → picker) or
* `@scope:name` (direct manifest-entry selection). Colon mirrors the
* existing `vite:monorepo` / `vite:library` builtin-template syntax and
* keeps manifest entries syntactically distinct from real
* `@scope/package-name` npm specifiers.
*
* Returns `null` for anything else — including the plain `@scope/name`
* form, which routes to the existing `@scope/create-name` shorthand as
* it did before the org-manifest feature.
*
* The optional `version` suffix (`@scope@1.2.3`, `@scope:name@1.2.3`)
* pins `@scope/create` to a specific release rather than `dist-tags.latest`.
*/
function parseOrgScopedSpec(spec) {
	if (!spec.startsWith("@")) return null;
	if (spec.includes("/")) return null;
	const colonIndex = spec.indexOf(":");
	if (colonIndex === -1) {
		const atIndex = spec.indexOf("@", 1);
		if (atIndex === -1) return { scope: spec };
		const version = spec.slice(atIndex + 1);
		return version ? {
			scope: spec.slice(0, atIndex),
			version
		} : { scope: spec.slice(0, atIndex) };
	}
	const scope = spec.slice(0, colonIndex);
	const rest = spec.slice(colonIndex + 1);
	const atIndex = rest.indexOf("@");
	const name = atIndex === -1 ? rest : rest.slice(0, atIndex);
	const version = atIndex === -1 ? "" : rest.slice(atIndex + 1);
	if (!name) return version ? {
		scope,
		version
	} : { scope };
	return version ? {
		scope,
		name,
		version
	} : {
		scope,
		name
	};
}
/**
* Schema-level failure. Never falls through silently — a maintainer who
* shipped an invalid manifest should see the offending field.
*/
var OrgManifestSchemaError = class extends Error {
	packageName;
	constructor(message, packageName) {
		super(`${packageName}: ${message}`);
		this.packageName = packageName;
		this.name = "OrgManifestSchemaError";
	}
};
function isRelativePath(spec) {
	return spec.startsWith("./") || spec.startsWith("../");
}
/**
* Validate the `{ name, description, template }` fields shared by org manifest
* entries and local `create.templates` entries. `label` is the config path
* used in error messages (e.g. `createConfig.templates` or `create.templates`)
* and `makeError` builds the thrown error so each source uses its own type.
*/
function validateTemplateEntry(entry, index, label, makeError) {
	if (!entry || typeof entry !== "object") throw makeError(`${label}[${index}] must be an object`);
	const raw = entry;
	const requireString = (field) => {
		const value = raw[field];
		if (typeof value !== "string" || value.length === 0) throw makeError(`${label}[${index}].${field} must be a non-empty string`);
		return value;
	};
	const name = requireString("name");
	if (name.startsWith("__vp_")) throw makeError(`${label}[${index}].name uses the reserved \`__vp_\` prefix`);
	const description = requireString("description");
	const template = requireString("template");
	if (isRelativePath(template)) {
		const resolved = path.posix.resolve("/root", template.replaceAll("\\", "/"));
		if (resolved !== "/root" && !resolved.startsWith("/root/")) throw makeError(`${label}[${index}].template escapes the package root: ${template}`);
	}
	return {
		name,
		description,
		template
	};
}
/**
* Validate a list of entries, rejecting duplicate `name`s. Shared by org
* manifests and local `create.templates`.
*/
function validateTemplateEntries(templates, label, makeError, validateOne) {
	const entries = [];
	const seen = /* @__PURE__ */ new Set();
	for (let index = 0; index < templates.length; index += 1) {
		const entry = validateOne(templates[index], index);
		if (seen.has(entry.name)) throw makeError(`${label}[${index}].name duplicates an earlier entry: "${entry.name}"`);
		seen.add(entry.name);
		entries.push(entry);
	}
	return entries;
}
function validateEntry(entry, index, packageName) {
	const makeError = (message) => new OrgManifestSchemaError(message, packageName);
	const base = validateTemplateEntry(entry, index, "createConfig.templates", makeError);
	let monorepo;
	const raw = entry;
	if (raw.monorepo !== void 0) {
		if (typeof raw.monorepo !== "boolean") throw makeError(`createConfig.templates[${index}].monorepo must be a boolean`);
		monorepo = raw.monorepo;
	}
	return {
		...base,
		...monorepo !== void 0 ? { monorepo } : {}
	};
}
function validateManifest(raw, packageName) {
	if (!raw || typeof raw !== "object") return null;
	const createConfig = raw.createConfig;
	if (!createConfig || typeof createConfig !== "object") return null;
	const templates = createConfig.templates;
	if (templates === void 0) return null;
	if (!Array.isArray(templates)) throw new OrgManifestSchemaError("createConfig.templates must be an array", packageName);
	if (templates.length === 0) return null;
	return validateTemplateEntries(templates, "createConfig.templates", (message) => new OrgManifestSchemaError(message, packageName), (entry, index) => validateEntry(entry, index, packageName));
}
/**
* Schema-level failure for `create.templates` in `vite.config.ts`. A misconfigured
* local template should surface clearly rather than silently disappear.
*/
var CreateConfigSchemaError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "CreateConfigSchemaError";
	}
};
/**
* Validate `create.templates` from `vite.config.ts`. Returns `[]` when the field
* is absent or an empty array; throws {@link CreateConfigSchemaError} when present
* but malformed.
*/
function validateCreateTemplates(templates) {
	if (templates === void 0) return [];
	if (!Array.isArray(templates)) throw new CreateConfigSchemaError("create.templates must be an array");
	const makeError = (message) => new CreateConfigSchemaError(message);
	return validateTemplateEntries(templates, "create.templates", makeError, (entry, index) => {
		const validated = validateTemplateEntry(entry, index, "create.templates", makeError);
		if (validated.name.startsWith("vite:")) throw makeError(`create.templates[${index}].name uses the reserved \`vite:\` prefix`);
		return validated;
	});
}
async function fetchPackument(scope, packageName) {
	const url = `${getNpmRegistry(scope)}/${packageName}`;
	const response = await fetchNpmResource(url, {
		headers: { accept: "application/json" },
		timeoutMs: 5e3
	});
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`npm registry responded with ${response.status} for ${packageName}`);
	return await response.json();
}
/**
* Fetch `@scope/create` from the npm registry and parse its `createConfig.templates`
* manifest.
*
* Returns `null` when:
* - the package does not exist on the registry (404), or
* - the package exists but has no `createConfig.templates` field
*
* When the packument version metadata lacks `createConfig` entirely, the
* published tarball's package.json is consulted before giving up — some
* registries (GitHub Packages among them) strip custom fields from version
* metadata while preserving the tarball byte-for-byte.
*
* Throws when:
* - the `createConfig.templates` field is present but malformed (`OrgManifestSchemaError`), or
* - the registry request fails for any non-404 reason
*
* `requestedVersion` pins the lookup to a specific `versions[...]` entry
* (equivalent to `vp create @scope@1.2.3`); omit it to resolve `dist-tags.latest`.
*/
async function readOrgManifest(scope, requestedVersion) {
	if (!scope.startsWith("@")) return null;
	const packageName = `${scope}/create`;
	const packument = await fetchPackument(scope, packageName);
	if (!packument) return null;
	let resolvedVersion;
	if (requestedVersion) {
		resolvedVersion = packument["dist-tags"]?.[requestedVersion] ?? (packument.versions?.[requestedVersion] ? requestedVersion : void 0);
		if (!resolvedVersion) throw new OrgManifestSchemaError(`version "${requestedVersion}" not found (known tags: ${Object.keys(packument["dist-tags"] ?? {}).join(", ") || "none"})`, packageName);
	} else {
		resolvedVersion = packument["dist-tags"]?.latest;
		if (!resolvedVersion) return null;
	}
	const meta = packument.versions?.[resolvedVersion];
	if (!meta) return null;
	let templates = validateManifest(meta, packageName);
	if (!templates && meta.createConfig === void 0 && meta.dist?.tarball) templates = validateManifest(await readPackageJsonFromTarball(meta.dist.tarball, meta.dist.integrity).catch(() => null), packageName);
	if (!templates) return null;
	if (!meta.dist?.tarball) throw new OrgManifestSchemaError(`missing dist.tarball for ${resolvedVersion}`, packageName);
	return {
		scope,
		packageName,
		version: resolvedVersion,
		tarballUrl: meta.dist.tarball,
		integrity: meta.dist.integrity,
		templates
	};
}
/**
* Apply the in-monorepo filter rule from the RFC: entries with
* `monorepo: true` are hidden when the command is invoked inside an
* existing monorepo, mirroring `initial-template-options.ts:9-31`.
*/
function filterManifestForContext(templates, isMonorepo) {
	if (!isMonorepo) return [...templates];
	return templates.filter((entry) => !entry.monorepo);
}
//#endregion
//#region src/create/templates/types.ts
const LibraryTemplateRepo = "github:sxzz/tsdown-templates/vite-plus";
const BuiltinTemplate = {
	generator: "vite:generator",
	monorepo: "vite:monorepo",
	application: "vite:application",
	library: "vite:library"
};
const TemplateType = {
	builtin: "builtin",
	bingo: "bingo",
	remote: "remote",
	bundled: "bundled"
};
//#endregion
//#region src/create/discovery.ts
function isGitHubUrl(templateName) {
	return templateName.startsWith("https://github.com/") || templateName.startsWith("github:") || templateName.includes("github.com/");
}
function parseGitHubUrl(url) {
	if (url.startsWith("github:")) return url.slice(7);
	const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
	if (match) return match[1].replace(/\.git$/, "");
	return null;
}
function inferGitHubRepoName(templateName) {
	const degitPath = parseGitHubUrl(templateName);
	if (!degitPath) return null;
	return degitPath.split("/").pop() || null;
}
function localTemplateDir(workspaceInfo, templateName) {
	if (isRelativePath(templateName)) return templateName.replace(/^\.\//, "");
	return workspaceInfo.packages.find((pkg) => pkg.name === templateName)?.path;
}
function resolveLocalBinPath(localPackagePath, packageName, bin) {
	if (!bin) return;
	if (typeof bin === "string") return path.join(localPackagePath, bin);
	const entries = Object.entries(bin);
	if (entries.length === 0) return;
	if (entries.length === 1) return path.join(localPackagePath, entries[0][1]);
	const unscopedName = packageName.slice(packageName.lastIndexOf("/") + 1);
	const preferred = bin[packageName] ?? bin[unscopedName];
	if (preferred) return path.join(localPackagePath, preferred);
	throw new Error(`Local template package "${packageName}" defines multiple "bin" entries (${entries.map(([name]) => name).join(", ")}); add a "bin" entry named "${packageName}" so the template entry is unambiguous`);
}
function discoverTemplate(templateName, templateArgs, workspaceInfo, interactive, bundledLocalPath, skipShorthand, localTemplate) {
	const envs = prependToPathToEnvs(workspaceInfo.downloadPackageManager.binPrefix, { ...process.env });
	const parentDir = inferParentDir(templateName, workspaceInfo, localTemplate);
	if (bundledLocalPath) return {
		command: "",
		args: [...templateArgs],
		envs,
		type: TemplateType.bundled,
		parentDir,
		interactive,
		localPath: bundledLocalPath
	};
	if (templateName.startsWith("vite:")) return {
		command: templateName,
		args: [...templateArgs],
		envs,
		type: TemplateType.builtin,
		parentDir,
		interactive
	};
	if (isGitHubUrl(templateName)) {
		const degitPath = parseGitHubUrl(templateName);
		if (degitPath) return {
			command: "degit",
			args: [degitPath, ...templateArgs],
			envs,
			type: TemplateType.remote,
			parentDir,
			interactive
		};
	}
	if (localTemplate) {
		const localDir = localTemplateDir(workspaceInfo, templateName);
		if (!localDir) throw new Error(`Local template "${templateName}" does not match any workspace package; update the \`create.templates\` entry in vite.config.ts`);
		const localPackagePath = path.join(workspaceInfo.rootDir, localDir);
		const packageJsonPath = path.join(localPackagePath, "package.json");
		if (!fs.existsSync(packageJsonPath)) throw new Error(`Local template "${templateName}" has no package.json, so it cannot be run as a template`);
		const pkg = readJsonFile(packageJsonPath);
		const binPath = resolveLocalBinPath(localPackagePath, pkg.name ?? templateName, pkg.bin);
		if (!binPath) throw new Error(`Local template "${templateName}" has no "bin" entry in its package.json, so it cannot be run as a template`);
		const args = [binPath, ...templateArgs];
		let type = TemplateType.remote;
		if (isBingoTemplate(pkg)) {
			type = TemplateType.bingo;
			args.push("--skip-requests");
		}
		return {
			command: "node",
			args,
			envs,
			type,
			parentDir,
			interactive
		};
	}
	return {
		command: skipShorthand ? templateName : expandCreateShorthand(templateName),
		args: [...templateArgs],
		envs,
		type: TemplateType.remote,
		parentDir,
		interactive
	};
}
/**
* Expand shorthand template names to their full `create-*` package names.
*
* This follows the same convention as `npm create` / `pnpm create`:
* - `vite` → `create-vite`
* - `vite@latest` → `create-vite@latest`
*
* Special cases for packages where the convention doesn't work:
* - `nitro` → `create-nitro-app` (create-nitro is abandoned)
* - `svelte` → `sv`
* - `@tanstack/start` → `@tanstack/cli` (@tanstack/create-start is deprecated)
*
* Skips expansion for:
* - Builtin templates (`vite:*`)
* - GitHub URLs
* - Local paths (`./`, `../`, `/`)
* - Names already starting with `create-` (or `@scope/create-`)
*/
function expandCreateShorthand(templateName) {
	if (templateName.includes(":")) return templateName;
	if (isGitHubUrl(templateName)) return templateName;
	if (templateName.startsWith("./") || templateName.startsWith("../") || templateName.startsWith("/")) return templateName;
	if (templateName.startsWith("@")) {
		const slashIndex = templateName.indexOf("/");
		if (slashIndex === -1) {
			const atIndex = templateName.indexOf("@", 1);
			return `${atIndex === -1 ? templateName : templateName.slice(0, atIndex)}/create${atIndex === -1 ? "" : templateName.slice(atIndex)}`;
		}
		const scope = templateName.slice(0, slashIndex);
		const rest = templateName.slice(slashIndex + 1);
		const atIndex = rest.indexOf("@");
		const name = atIndex === -1 ? rest : rest.slice(0, atIndex);
		const version = atIndex === -1 ? "" : rest.slice(atIndex);
		if (name.startsWith("create-")) return templateName;
		if (scope === "@tanstack" && name === "start") return `@tanstack/cli${version}`;
		return `${scope}/create-${name}${version}`;
	}
	const atIndex = templateName.indexOf("@");
	const name = atIndex === -1 ? templateName : templateName.slice(0, atIndex);
	const version = atIndex === -1 ? "" : templateName.slice(atIndex);
	if (name.startsWith("create-")) return templateName;
	if (name === "nitro") return `create-nitro-app${version}`;
	if (name === "svelte") return `sv${version}`;
	return `create-${name}${version}`;
}
function inferParentDir(templateName, workspaceInfo, localTemplate = false) {
	if (workspaceInfo.parentDirs.length === 0) return;
	const localDir = localTemplate ? localTemplateDir(workspaceInfo, templateName) : void 0;
	if (localDir) {
		const ownParentDir = path.dirname(localDir);
		if (workspaceInfo.parentDirs.includes(ownParentDir)) return ownParentDir;
	}
	let rule = /app/i;
	if (templateName === BuiltinTemplate.library) rule = /lib|component|package/i;
	else if (templateName === BuiltinTemplate.generator) rule = /generator|tool/i;
	for (const parentDir of workspaceInfo.parentDirs) if (rule.test(parentDir)) return parentDir;
}
//#endregion
//#region src/create/initial-template-options.ts
function getInitialTemplateOptions(isMonorepo, templates = []) {
	return [
		...!isMonorepo ? [{
			label: "Vite+ Monorepo",
			value: BuiltinTemplate.monorepo,
			hint: "Create a new Vite+ monorepo project"
		}] : [],
		{
			label: "Vite+ Application",
			value: BuiltinTemplate.application,
			hint: "Create vite applications"
		},
		{
			label: "Vite+ Library",
			value: BuiltinTemplate.library,
			hint: "Create vite libraries"
		},
		...isMonorepo ? templates.map((entry) => ({
			label: entry.name,
			value: entry.name,
			hint: entry.description
		})) : []
	];
}
//#endregion
//#region src/create/org-picker.ts
const ORG_PICKER_CANCEL = Symbol("org-picker-cancel");
const ORG_PICKER_BUILTIN_ESCAPE = Symbol("org-picker-builtin-escape");
const ESCAPE_HATCH = Symbol("builtin-escape");
/**
* Render the interactive picker for an org manifest. Always appends a
* trailing "Vite+ built-in templates" escape-hatch entry.
*
* Context-filters entries with `monorepo: true` when running inside an
* existing monorepo, mirroring `initial-template-options.ts:9-31`.
*
* Returns `ORG_PICKER_BUILTIN_ESCAPE` when the escape hatch is selected,
* or `ORG_PICKER_CANCEL` when the user hits Ctrl-C.
*/
async function pickOrgTemplate(manifest, opts) {
	const filtered = filterManifestForContext(manifest.templates, opts.isMonorepo);
	if (filtered.length === 0) return ORG_PICKER_BUILTIN_ESCAPE;
	const escapeValue = `__vp_builtin_escape__::${randomUUID()}`;
	const lookup = /* @__PURE__ */ new Map();
	const options = filtered.map((entry) => {
		lookup.set(entry.name, entry);
		return {
			value: entry.name,
			label: entry.name,
			hint: entry.description
		};
	});
	lookup.set(escapeValue, ESCAPE_HATCH);
	const builtinHint = opts.isMonorepo ? "Use defaults (application / library)" : "Use defaults (monorepo / application / library)";
	options.push({
		value: escapeValue,
		label: "Vite+ built-in templates",
		hint: builtinHint
	});
	const picked = await select({
		message: `Pick a template from ${manifest.scope}`,
		options
	});
	if (isCancel(picked)) return ORG_PICKER_CANCEL;
	const found = lookup.get(picked);
	if (found === ESCAPE_HATCH) return ORG_PICKER_BUILTIN_ESCAPE;
	if (!found) throw new Error(`org-picker: prompts.select returned an unregistered value: ${picked}`);
	return {
		kind: "entry",
		entry: found
	};
}
/**
* Render the manifest as a plain-text table for the `--no-interactive`
* error output. Fixed column order so AI agents and scripts can recover
* available template names without a `--json` flag.
*/
function formatManifestTable(manifest, isMonorepo) {
	const visible = filterManifestForContext(manifest.templates, isMonorepo);
	const filteredCount = manifest.templates.length - visible.length;
	const nameWidth = Math.max(4, ...visible.map((entry) => entry.name.length));
	const descWidth = Math.max(11, ...visible.map((entry) => entry.description.length));
	const lines = [];
	lines.push(`  ${"NAME".padEnd(nameWidth)}  ${"DESCRIPTION".padEnd(descWidth)}  TEMPLATE`);
	for (const entry of visible) lines.push(`  ${entry.name.padEnd(nameWidth)}  ${entry.description.padEnd(descWidth)}  ${entry.template}`);
	return {
		lines,
		filteredCount
	};
}
//#endregion
//#region src/create/org-resolve.ts
function printNonInteractiveTable(manifest, orgSpec, isMonorepo) {
	const { lines, filteredCount } = formatManifestTable(manifest, isMonorepo);
	const [firstVisible] = filterManifestForContext(manifest.templates, isMonorepo);
	const body = [
		"",
		`A template name is required when running \`vp create ${orgSpec.scope}\` in non-interactive mode.`,
		"",
		`Available templates in ${manifest.packageName}:`,
		"",
		...lines
	];
	if (filteredCount > 0) body.push("", `(omitted ${filteredCount} monorepo-only ${filteredCount === 1 ? "entry" : "entries"} because this workspace is already a monorepo)`);
	body.push("", "Examples:");
	if (firstVisible) body.push("  # Scaffold a specific template from the org", `  vp create ${orgSpec.scope}:${firstVisible.name} --no-interactive`, "");
	body.push("  # Or use a Vite+ built-in template", "  vp create vite:application --no-interactive", "");
	process.stderr.write(body.join("\n"));
}
function rejectMonorepoEntryInsideMonorepo(entry, isMonorepo) {
	if (entry.monorepo && isMonorepo) {
		log$1.info("You are already in a monorepo workspace.\nUse a different template or run this command outside the monorepo");
		cancelAndExit("Cannot create a monorepo inside an existing monorepo", 1);
	}
}
async function resolveEntry(manifest, entry) {
	if (isRelativePath(entry.template)) return {
		kind: "bundled",
		bundledLocalPath: resolveBundledPath(await ensureOrgPackageExtracted(manifest), entry.template),
		entryName: entry.name,
		scope: manifest.scope,
		...entry.monorepo === true ? { monorepo: true } : {}
	};
	return {
		kind: "replaced",
		templateName: entry.template
	};
}
/**
* If `selectedTemplateName` points at an `@scope[/name]` org whose
* `@scope/create` package publishes a `createConfig.templates` manifest, apply the
* manifest rules (picker / direct lookup / escape hatch / bundled
* extraction) and report the outcome.
*
* The caller — `packages/cli/src/create/bin.ts` — decides what to do next
* based on the returned variant.
*/
async function resolveOrgManifestForCreate(args) {
	const orgSpec = parseOrgScopedSpec(args.templateName);
	if (!orgSpec) return { kind: "passthrough" };
	let manifest;
	try {
		manifest = await readOrgManifest(orgSpec.scope, orgSpec.version);
	} catch (error) {
		const message = error instanceof OrgManifestSchemaError ? error.message : `Failed to read ${orgSpec.scope}/create manifest: ${error.message}`;
		cancelAndExit(message, 1);
	}
	if (!manifest) {
		if (orgSpec.name !== void 0) cancelAndExit(`No \`createConfig.templates\` manifest in ${orgSpec.scope}/create — \`@org:name\` requires one.`, 1);
		log$1.info(`No \`createConfig.templates\` manifest in ${orgSpec.scope}/create — running it as a normal package.`);
		return { kind: "passthrough" };
	}
	if (orgSpec.name === void 0) {
		if (!args.interactive) {
			printNonInteractiveTable(manifest, orgSpec, args.isMonorepo);
			process.exit(1);
		}
		const picked = await pickOrgTemplate(manifest, { isMonorepo: args.isMonorepo });
		if (picked === ORG_PICKER_CANCEL) cancelAndExit();
		if (picked === ORG_PICKER_BUILTIN_ESCAPE) {
			if (args.isMonorepo && manifest.templates.every((t) => t.monorepo)) log$1.info(`No templates from ${manifest.packageName} are applicable inside a monorepo — showing Vite+ built-in templates instead.`);
			return { kind: "escape-hatch" };
		}
		rejectMonorepoEntryInsideMonorepo(picked.entry, args.isMonorepo);
		return resolveEntry(manifest, picked.entry);
	}
	const entry = manifest.templates.find((candidate) => candidate.name === orgSpec.name);
	if (!entry) {
		const available = filterManifestForContext(manifest.templates, args.isMonorepo).map((t) => t.name).join(", ");
		cancelAndExit(`No template named "${orgSpec.name}" in ${manifest.packageName}. Available: ${available || "(none applicable in this context)"}.`, 1);
	}
	rejectMonorepoEntryInsideMonorepo(entry, args.isMonorepo);
	return resolveEntry(manifest, entry);
}
/**
* Read the `create` config (`defaultTemplate` + validated `templates`) from
* a workspace's `vite.config.ts` in a single config evaluation.
*
* By default, walks up from `startDir` via `findWorkspaceRoot` (monorepo
* markers only — `pnpm-workspace.yaml`, `workspaces` in `package.json`,
* `lerna.json`) so monorepo invocations from any subdirectory still pick up
* the root config. Pass `walkUp: false` to read `startDir` directly when the
* caller already holds the exact workspace root.
*
* Best-effort for resolution: a missing or unresolvable config reads as
* empty. A present-but-malformed `create.templates` still throws a
* {@link CreateConfigSchemaError} so the misconfiguration surfaces.
*
* Pass `throwOnReadError: true` for read-modify-write callers (registration):
* if a config file exists but cannot be evaluated, an empty read would let a
* later write clobber the real `create` block, so the eval error is rethrown
* instead of swallowed.
*/
async function getConfiguredCreate(startDir, options) {
	const projectRoot = options?.walkUp === false ? startDir : findWorkspaceRoot(startDir) ?? startDir;
	if (!hasViteConfig(projectRoot)) return { templates: [] };
	let create;
	try {
		create = (await resolveViteConfig(projectRoot)).create;
	} catch (error) {
		if (options?.throwOnReadError) throw error;
		return { templates: [] };
	}
	const defaultTemplate = typeof create?.defaultTemplate === "string" && create.defaultTemplate.length > 0 ? create.defaultTemplate : void 0;
	const templates = validateCreateTemplates(create?.templates);
	return {
		...defaultTemplate !== void 0 ? { defaultTemplate } : {},
		templates
	};
}
/**
* Read `create.defaultTemplate` only. Best-effort for missing or unresolvable
* configs (returns `undefined`), but a malformed `create.templates` still
* rethrows its {@link CreateConfigSchemaError}: swallowing it here would
* silently drop a valid `defaultTemplate` along with the diagnostic.
*/
async function getConfiguredDefaultTemplate(startDir) {
	try {
		return (await getConfiguredCreate(startDir)).defaultTemplate;
	} catch (error) {
		if (error instanceof CreateConfigSchemaError) throw error;
		return;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/validate-npm-package-name@7.0.2/node_modules/validate-npm-package-name/lib/builtin-modules.json
var require_builtin_modules = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = [
		"_http_agent",
		"_http_client",
		"_http_common",
		"_http_incoming",
		"_http_outgoing",
		"_http_server",
		"_stream_duplex",
		"_stream_passthrough",
		"_stream_readable",
		"_stream_transform",
		"_stream_wrap",
		"_stream_writable",
		"_tls_common",
		"_tls_wrap",
		"assert",
		"assert/strict",
		"async_hooks",
		"buffer",
		"child_process",
		"cluster",
		"console",
		"constants",
		"crypto",
		"dgram",
		"diagnostics_channel",
		"dns",
		"dns/promises",
		"domain",
		"events",
		"fs",
		"fs/promises",
		"http",
		"http2",
		"https",
		"inspector",
		"inspector/promises",
		"module",
		"net",
		"os",
		"path",
		"path/posix",
		"path/win32",
		"perf_hooks",
		"process",
		"punycode",
		"querystring",
		"readline",
		"readline/promises",
		"repl",
		"stream",
		"stream/consumers",
		"stream/promises",
		"stream/web",
		"string_decoder",
		"sys",
		"timers",
		"timers/promises",
		"tls",
		"trace_events",
		"tty",
		"url",
		"util",
		"util/types",
		"v8",
		"vm",
		"wasi",
		"worker_threads",
		"zlib",
		"node:sea",
		"node:sqlite",
		"node:test",
		"node:test/reporters"
	];
}));
//#endregion
//#region ../../node_modules/.pnpm/@nkzw+safe-word-list@3.1.0/node_modules/@nkzw/safe-word-list/index.js
var import_lib = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const builtins = require_builtin_modules();
	var scopedPackagePattern = /* @__PURE__ */ new RegExp("^(?:@([^/]+?)[/])?([^/]+?)$");
	var exclusionList = ["node_modules", "favicon.ico"];
	function validate(name) {
		var warnings = [];
		var errors = [];
		if (name === null) {
			errors.push("name cannot be null");
			return done(warnings, errors);
		}
		if (name === void 0) {
			errors.push("name cannot be undefined");
			return done(warnings, errors);
		}
		if (typeof name !== "string") {
			errors.push("name must be a string");
			return done(warnings, errors);
		}
		if (!name.length) errors.push("name length must be greater than zero");
		if (name.startsWith(".")) errors.push("name cannot start with a period");
		if (name.startsWith("-")) errors.push("name cannot start with a hyphen");
		if (name.match(/^_/)) errors.push("name cannot start with an underscore");
		if (name.trim() !== name) errors.push("name cannot contain leading or trailing spaces");
		exclusionList.forEach(function(excludedName) {
			if (name.toLowerCase() === excludedName) errors.push(excludedName + " is not a valid package name");
		});
		if (builtins.includes(name.toLowerCase())) warnings.push(name + " is a core module name");
		if (name.length > 214) warnings.push("name can no longer contain more than 214 characters");
		if (name.toLowerCase() !== name) warnings.push("name can no longer contain capital letters");
		if (/[~'!()*]/.test(name.split("/").slice(-1)[0])) warnings.push("name can no longer contain special characters (\"~'!()*\")");
		if (encodeURIComponent(name) !== name) {
			var nameMatch = name.match(scopedPackagePattern);
			if (nameMatch) {
				var user = nameMatch[1];
				var pkg = nameMatch[2];
				if (pkg.startsWith(".")) errors.push("name cannot start with a period");
				if (encodeURIComponent(user) === user && encodeURIComponent(pkg) === pkg) return done(warnings, errors);
			}
			errors.push("name can only contain URL-friendly characters");
		}
		return done(warnings, errors);
	}
	var done = function(warnings, errors) {
		var result = {
			validForNewPackages: errors.length === 0 && warnings.length === 0,
			validForOldPackages: errors.length === 0,
			warnings,
			errors
		};
		if (!result.warnings.length) delete result.warnings;
		if (!result.errors.length) delete result.errors;
		return result;
	};
	module.exports = validate;
})))(), 1);
const words = [
	"ability",
	"able",
	"about",
	"above",
	"abroad",
	"absence",
	"absolute",
	"absolutely",
	"absorb",
	"academic",
	"accept",
	"access",
	"accompany",
	"accomplish",
	"according",
	"account",
	"accurate",
	"achieve",
	"achievement",
	"acid",
	"acknowledge",
	"acquire",
	"across",
	"act",
	"action",
	"active",
	"activist",
	"activity",
	"actor",
	"actress",
	"actual",
	"actually",
	"adapt",
	"add",
	"addition",
	"additional",
	"address",
	"adequate",
	"adjust",
	"adjustment",
	"administration",
	"administrator",
	"admire",
	"admission",
	"admit",
	"adolescent",
	"adopt",
	"adult",
	"advance",
	"advanced",
	"advantage",
	"adventure",
	"advertising",
	"advice",
	"advise",
	"adviser",
	"advocate",
	"affair",
	"affect",
	"afford",
	"after",
	"afternoon",
	"again",
	"against",
	"age",
	"agency",
	"agenda",
	"agent",
	"ago",
	"agree",
	"agreement",
	"agricultural",
	"ahead",
	"aid",
	"aide",
	"aim",
	"air",
	"aircraft",
	"airline",
	"airport",
	"album",
	"alive",
	"all",
	"alliance",
	"allow",
	"ally",
	"almost",
	"alone",
	"along",
	"already",
	"also",
	"alter",
	"alternative",
	"although",
	"always",
	"amazing",
	"among",
	"amount",
	"analysis",
	"analyst",
	"analyze",
	"ancient",
	"and",
	"angle",
	"animal",
	"anniversary",
	"announce",
	"annual",
	"another",
	"answer",
	"anticipate",
	"any",
	"anybody",
	"anymore",
	"anyone",
	"anything",
	"anyway",
	"anywhere",
	"apart",
	"apartment",
	"apparent",
	"apparently",
	"appeal",
	"appear",
	"appearance",
	"apple",
	"application",
	"apply",
	"appoint",
	"appointment",
	"appreciate",
	"approach",
	"appropriate",
	"approval",
	"approve",
	"approximately",
	"architect",
	"area",
	"argue",
	"argument",
	"arise",
	"arm",
	"armed",
	"around",
	"arrange",
	"arrangement",
	"arrival",
	"arrive",
	"art",
	"article",
	"artist",
	"artistic",
	"aside",
	"ask",
	"asleep",
	"aspect",
	"assert",
	"assess",
	"assessment",
	"asset",
	"assign",
	"assignment",
	"assist",
	"assistance",
	"assistant",
	"associate",
	"association",
	"assume",
	"assumption",
	"assure",
	"athlete",
	"athletic",
	"atmosphere",
	"attach",
	"attempt",
	"attend",
	"attention",
	"attitude",
	"attorney",
	"attract",
	"attractive",
	"attribute",
	"audience",
	"author",
	"authority",
	"auto",
	"available",
	"average",
	"avoid",
	"award",
	"aware",
	"awareness",
	"away",
	"awesome",
	"baby",
	"back",
	"background",
	"bag",
	"bake",
	"balance",
	"ball",
	"ban",
	"band",
	"bank",
	"bar",
	"barely",
	"barrel",
	"base",
	"baseball",
	"basic",
	"basically",
	"basis",
	"basket",
	"basketball",
	"bathroom",
	"battery",
	"beach",
	"bean",
	"bear",
	"beat",
	"beautiful",
	"beauty",
	"because",
	"become",
	"bed",
	"bedroom",
	"beer",
	"before",
	"begin",
	"beginning",
	"behavior",
	"behind",
	"being",
	"belief",
	"believe",
	"bell",
	"belong",
	"below",
	"belt",
	"bench",
	"bend",
	"beneath",
	"benefit",
	"beside",
	"besides",
	"best",
	"bet",
	"better",
	"between",
	"beyond",
	"big",
	"bike",
	"bill",
	"billion",
	"bind",
	"biological",
	"bird",
	"birth",
	"birthday",
	"bit",
	"bite",
	"black",
	"blade",
	"blanket",
	"blind",
	"block",
	"blow",
	"blue",
	"board",
	"boat",
	"body",
	"bond",
	"bone",
	"book",
	"boom",
	"boot",
	"border",
	"born",
	"borrow",
	"boss",
	"both",
	"bother",
	"bottle",
	"bottom",
	"boundary",
	"bowl",
	"box",
	"boy",
	"boyfriend",
	"brain",
	"branch",
	"brand",
	"bread",
	"break",
	"breakfast",
	"breast",
	"breath",
	"breathe",
	"brick",
	"bridge",
	"brief",
	"briefly",
	"bright",
	"brilliant",
	"bring",
	"broad",
	"brother",
	"brown",
	"brush",
	"buck",
	"budget",
	"build",
	"building",
	"bullet",
	"bunch",
	"bury",
	"bus",
	"business",
	"busy",
	"but",
	"butter",
	"button",
	"buy",
	"buyer",
	"cabin",
	"cabinet",
	"cable",
	"cake",
	"calculate",
	"call",
	"camera",
	"camp",
	"campaign",
	"campus",
	"can",
	"candidate",
	"cap",
	"capability",
	"capable",
	"capacity",
	"capital",
	"captain",
	"capture",
	"car",
	"carbon",
	"card",
	"care",
	"career",
	"careful",
	"carefully",
	"carrier",
	"carry",
	"case",
	"cash",
	"cast",
	"cat",
	"catch",
	"category",
	"cause",
	"ceiling",
	"celebrate",
	"celebration",
	"celebrity",
	"cell",
	"center",
	"central",
	"century",
	"ceremony",
	"certain",
	"certainly",
	"chain",
	"chair",
	"chairman",
	"challenge",
	"chamber",
	"champion",
	"championship",
	"chance",
	"change",
	"changing",
	"channel",
	"chapter",
	"character",
	"characteristic",
	"characterize",
	"charge",
	"charity",
	"chart",
	"chase",
	"cheap",
	"check",
	"cheek",
	"cheese",
	"chef",
	"chemical",
	"chest",
	"chicken",
	"chief",
	"child",
	"childhood",
	"chip",
	"chocolate",
	"choice",
	"cholesterol",
	"choose",
	"church",
	"cigarette",
	"circle",
	"circumstance",
	"cite",
	"citizen",
	"city",
	"civil",
	"civilian",
	"claim",
	"class",
	"classic",
	"classroom",
	"clean",
	"clear",
	"clearly",
	"client",
	"climate",
	"climb",
	"clinic",
	"clinical",
	"clock",
	"close",
	"closely",
	"closer",
	"clothes",
	"clothing",
	"cloud",
	"club",
	"clue",
	"cluster",
	"coach",
	"coal",
	"coalition",
	"coast",
	"coat",
	"code",
	"coffee",
	"cognitive",
	"cold",
	"colleague",
	"collect",
	"collection",
	"collective",
	"college",
	"colonial",
	"color",
	"column",
	"combination",
	"combine",
	"come",
	"comedy",
	"comfort",
	"comfortable",
	"command",
	"commander",
	"comment",
	"commercial",
	"commission",
	"commit",
	"commitment",
	"committee",
	"common",
	"communicate",
	"communication",
	"community",
	"company",
	"compare",
	"comparison",
	"compete",
	"competition",
	"competitive",
	"competitor",
	"complete",
	"completely",
	"complex",
	"complicated",
	"component",
	"compose",
	"composition",
	"comprehensive",
	"computer",
	"concentrate",
	"concentration",
	"concept",
	"concern",
	"concerned",
	"concert",
	"conclude",
	"conclusion",
	"concrete",
	"condition",
	"conduct",
	"conference",
	"confidence",
	"confident",
	"confirm",
	"confront",
	"confusion",
	"congressional",
	"connect",
	"connection",
	"consciousness",
	"consensus",
	"consequence",
	"conservative",
	"consider",
	"considerable",
	"consideration",
	"consist",
	"consistent",
	"constant",
	"constantly",
	"constitute",
	"constitutional",
	"construct",
	"construction",
	"consultant",
	"consume",
	"consumer",
	"consumption",
	"contact",
	"contain",
	"container",
	"contemporary",
	"content",
	"contest",
	"context",
	"continue",
	"continued",
	"contract",
	"contrast",
	"contribute",
	"contribution",
	"control",
	"convention",
	"conventional",
	"conversation",
	"convert",
	"conviction",
	"convince",
	"cook",
	"cookie",
	"cooking",
	"cool",
	"cooperation",
	"cop",
	"cope",
	"copy",
	"core",
	"corn",
	"corner",
	"corporate",
	"corporation",
	"correct",
	"correspondent",
	"cost",
	"cotton",
	"couch",
	"could",
	"council",
	"counselor",
	"count",
	"counter",
	"country",
	"county",
	"couple",
	"courage",
	"course",
	"court",
	"cousin",
	"cover",
	"coverage",
	"cow",
	"crack",
	"craft",
	"cream",
	"create",
	"creation",
	"creative",
	"creature",
	"credit",
	"crew",
	"criteria",
	"crop",
	"cross",
	"crowd",
	"crucial",
	"cultural",
	"culture",
	"cup",
	"curious",
	"current",
	"currently",
	"curriculum",
	"custom",
	"customer",
	"cut",
	"cycle",
	"dad",
	"daily",
	"dance",
	"dare",
	"dark",
	"darkness",
	"data",
	"date",
	"daughter",
	"day",
	"deal",
	"dealer",
	"dear",
	"debate",
	"decade",
	"decide",
	"decision",
	"deck",
	"declare",
	"decrease",
	"deep",
	"deeply",
	"deer",
	"defend",
	"defendant",
	"defense",
	"defensive",
	"define",
	"definitely",
	"definition",
	"degree",
	"delay",
	"deliver",
	"delivery",
	"demand",
	"democracy",
	"democratic",
	"demonstrate",
	"demonstration",
	"deny",
	"department",
	"depend",
	"dependent",
	"depending",
	"depict",
	"depth",
	"deputy",
	"derive",
	"describe",
	"description",
	"desert",
	"deserve",
	"design",
	"designer",
	"desire",
	"desk",
	"desperate",
	"despite",
	"detail",
	"detailed",
	"detect",
	"determine",
	"develop",
	"developing",
	"development",
	"device",
	"devote",
	"dialogue",
	"diet",
	"differ",
	"difference",
	"different",
	"differently",
	"difficult",
	"difficulty",
	"dig",
	"digital",
	"dimension",
	"dining",
	"dinner",
	"direct",
	"direction",
	"directly",
	"director",
	"disability",
	"disagree",
	"disappear",
	"discipline",
	"discourse",
	"discover",
	"discovery",
	"discuss",
	"discussion",
	"dish",
	"dismiss",
	"display",
	"distance",
	"distant",
	"distinct",
	"distinction",
	"distinguish",
	"distribute",
	"distribution",
	"district",
	"diverse",
	"diversity",
	"divide",
	"division",
	"divorce",
	"doctor",
	"document",
	"dog",
	"domestic",
	"dominant",
	"dominate",
	"door",
	"double",
	"down",
	"downtown",
	"dozen",
	"draft",
	"drag",
	"drama",
	"dramatic",
	"dramatically",
	"draw",
	"drawing",
	"dream",
	"dress",
	"drink",
	"drive",
	"driver",
	"drop",
	"dry",
	"due",
	"during",
	"dust",
	"duty",
	"each",
	"eager",
	"ear",
	"early",
	"earn",
	"earnings",
	"earth",
	"ease",
	"easily",
	"east",
	"eastern",
	"easy",
	"eat",
	"economic",
	"economics",
	"economist",
	"economy",
	"edge",
	"edition",
	"editor",
	"educate",
	"education",
	"educational",
	"educator",
	"effect",
	"effective",
	"effectively",
	"efficiency",
	"efficient",
	"effort",
	"egg",
	"eight",
	"either",
	"elderly",
	"elect",
	"election",
	"electric",
	"electricity",
	"electronic",
	"element",
	"elementary",
	"eliminate",
	"elite",
	"else",
	"elsewhere",
	"embrace",
	"emerge",
	"emission",
	"emotion",
	"emotional",
	"emphasis",
	"emphasize",
	"employ",
	"employee",
	"employer",
	"employment",
	"empty",
	"enable",
	"encounter",
	"encourage",
	"end",
	"energy",
	"enforcement",
	"engage",
	"engine",
	"engineer",
	"engineering",
	"enhance",
	"enjoy",
	"enormous",
	"enough",
	"ensure",
	"enter",
	"enterprise",
	"entertainment",
	"entire",
	"entirely",
	"entrance",
	"entry",
	"environment",
	"environmental",
	"episode",
	"equal",
	"equally",
	"equipment",
	"era",
	"escape",
	"especially",
	"essay",
	"essential",
	"essentially",
	"establish",
	"establishment",
	"estate",
	"estimate",
	"etc",
	"ethics",
	"ethnic",
	"evaluate",
	"evaluation",
	"even",
	"evening",
	"event",
	"eventually",
	"ever",
	"every",
	"everybody",
	"everyday",
	"everyone",
	"everything",
	"everywhere",
	"evidence",
	"evolution",
	"evolve",
	"exact",
	"exactly",
	"examination",
	"examine",
	"example",
	"exceed",
	"excellent",
	"except",
	"exception",
	"exchange",
	"exciting",
	"executive",
	"exercise",
	"exhibit",
	"exhibition",
	"exist",
	"existence",
	"existing",
	"expand",
	"expansion",
	"expect",
	"expectation",
	"expense",
	"expensive",
	"experience",
	"experiment",
	"expert",
	"explain",
	"explanation",
	"explore",
	"expose",
	"express",
	"expression",
	"extend",
	"extension",
	"extensive",
	"extent",
	"external",
	"extra",
	"extraordinary",
	"extreme",
	"extremely",
	"eye",
	"fabric",
	"face",
	"facility",
	"fact",
	"factor",
	"factory",
	"faculty",
	"fade",
	"fair",
	"fairly",
	"faith",
	"fall",
	"false",
	"familiar",
	"family",
	"famous",
	"fan",
	"fantasy",
	"far",
	"farm",
	"farmer",
	"fashion",
	"fast",
	"fate",
	"father",
	"favor",
	"favorite",
	"feature",
	"federal",
	"fee",
	"feed",
	"feel",
	"feeling",
	"fellow",
	"female",
	"fence",
	"few",
	"fewer",
	"fiber",
	"fiction",
	"field",
	"fifteen",
	"fifth",
	"fifty",
	"figure",
	"file",
	"fill",
	"film",
	"final",
	"finally",
	"finance",
	"financial",
	"find",
	"finding",
	"fine",
	"finger",
	"finish",
	"firm",
	"first",
	"fish",
	"fishing",
	"fit",
	"fitness",
	"five",
	"fix",
	"flag",
	"flame",
	"flat",
	"flavor",
	"flesh",
	"flight",
	"float",
	"floor",
	"flow",
	"flower",
	"fly",
	"focus",
	"folk",
	"follow",
	"following",
	"food",
	"foot",
	"football",
	"for",
	"force",
	"foreign",
	"forest",
	"forever",
	"forget",
	"form",
	"formal",
	"formation",
	"former",
	"formula",
	"forth",
	"fortune",
	"forward",
	"found",
	"foundation",
	"founder",
	"four",
	"fourth",
	"frame",
	"framework",
	"free",
	"freedom",
	"freeze",
	"frequency",
	"frequent",
	"frequently",
	"fresh",
	"friend",
	"friendly",
	"friendship",
	"from",
	"front",
	"fruit",
	"fuel",
	"full",
	"fully",
	"fun",
	"function",
	"fund",
	"fundamental",
	"funding",
	"funeral",
	"funny",
	"furniture",
	"furthermore",
	"future",
	"gain",
	"galaxy",
	"gallery",
	"game",
	"gap",
	"garage",
	"garden",
	"garlic",
	"gas",
	"gate",
	"gather",
	"gaze",
	"gear",
	"gender",
	"gene",
	"general",
	"generally",
	"generate",
	"generation",
	"genetic",
	"gentleman",
	"gently",
	"gesture",
	"get",
	"ghost",
	"giant",
	"gift",
	"gifted",
	"girl",
	"girlfriend",
	"give",
	"given",
	"glad",
	"glance",
	"glass",
	"global",
	"glove",
	"goal",
	"gold",
	"golden",
	"golf",
	"good",
	"government",
	"governor",
	"grab",
	"grade",
	"gradually",
	"graduate",
	"grain",
	"grand",
	"grandfather",
	"grandmother",
	"grant",
	"grass",
	"grave",
	"gray",
	"great",
	"greatest",
	"green",
	"grocery",
	"ground",
	"group",
	"grow",
	"growing",
	"growth",
	"guarantee",
	"guard",
	"guess",
	"guest",
	"guide",
	"guideline",
	"guy",
	"habit",
	"habitat",
	"hair",
	"half",
	"hall",
	"hand",
	"handful",
	"handle",
	"hang",
	"happen",
	"happy",
	"hard",
	"hardly",
	"hat",
	"have",
	"head",
	"headline",
	"headquarters",
	"health",
	"healthy",
	"hear",
	"hearing",
	"heart",
	"heat",
	"heaven",
	"heavily",
	"heavy",
	"heel",
	"height",
	"helicopter",
	"hell",
	"hello",
	"help",
	"helpful",
	"here",
	"heritage",
	"hero",
	"herself",
	"hey",
	"hide",
	"high",
	"highlight",
	"highly",
	"highway",
	"hill",
	"himself",
	"hip",
	"hire",
	"historian",
	"historic",
	"historical",
	"history",
	"hit",
	"hold",
	"hole",
	"holiday",
	"holy",
	"home",
	"honest",
	"honey",
	"honor",
	"hope",
	"horizon",
	"horse",
	"hospital",
	"host",
	"hot",
	"hotel",
	"hour",
	"house",
	"household",
	"housing",
	"how",
	"however",
	"huge",
	"human",
	"humor",
	"hundred",
	"hungry",
	"hunter",
	"hunting",
	"husband",
	"hypothesis",
	"ice",
	"idea",
	"ideal",
	"identification",
	"identify",
	"identity",
	"ignore",
	"illustrate",
	"image",
	"imagination",
	"imagine",
	"immediate",
	"immediately",
	"immigrant",
	"immigration",
	"impact",
	"implement",
	"implication",
	"imply",
	"importance",
	"important",
	"impose",
	"impossible",
	"impress",
	"impression",
	"impressive",
	"improve",
	"improvement",
	"incentive",
	"incident",
	"include",
	"including",
	"income",
	"incorporate",
	"increase",
	"increased",
	"increasing",
	"increasingly",
	"incredible",
	"indeed",
	"independence",
	"independent",
	"index",
	"indicate",
	"indication",
	"individual",
	"industrial",
	"industry",
	"infant",
	"inflation",
	"influence",
	"inform",
	"information",
	"ingredient",
	"initial",
	"initially",
	"initiative",
	"inner",
	"innocent",
	"inquiry",
	"inside",
	"insight",
	"insist",
	"inspire",
	"install",
	"instance",
	"instead",
	"institution",
	"institutional",
	"instruction",
	"instructor",
	"instrument",
	"insurance",
	"intellectual",
	"intelligence",
	"intend",
	"intense",
	"intensity",
	"intention",
	"interaction",
	"interest",
	"interested",
	"interesting",
	"internal",
	"international",
	"interpret",
	"interpretation",
	"intervention",
	"interview",
	"into",
	"introduce",
	"introduction",
	"invest",
	"investigate",
	"investigation",
	"investigator",
	"investment",
	"investor",
	"invite",
	"involve",
	"involved",
	"involvement",
	"iron",
	"island",
	"issue",
	"item",
	"its",
	"itself",
	"jacket",
	"jet",
	"job",
	"join",
	"joint",
	"joke",
	"journal",
	"journalist",
	"journey",
	"joy",
	"judge",
	"judgment",
	"juice",
	"jump",
	"junior",
	"jury",
	"just",
	"justice",
	"justify",
	"keep",
	"key",
	"kick",
	"kid",
	"kind",
	"king",
	"kiss",
	"kitchen",
	"knee",
	"knife",
	"knock",
	"know",
	"knowledge",
	"lab",
	"label",
	"labor",
	"laboratory",
	"lady",
	"lake",
	"land",
	"landscape",
	"language",
	"lap",
	"large",
	"largely",
	"last",
	"late",
	"later",
	"latter",
	"laugh",
	"launch",
	"law",
	"lawn",
	"lawsuit",
	"lawyer",
	"lay",
	"layer",
	"lead",
	"leader",
	"leadership",
	"leading",
	"leaf",
	"league",
	"lean",
	"learn",
	"learning",
	"least",
	"leather",
	"leave",
	"left",
	"leg",
	"legacy",
	"legal",
	"legend",
	"legislation",
	"legitimate",
	"lemon",
	"length",
	"less",
	"lesson",
	"let",
	"letter",
	"level",
	"liberal",
	"library",
	"license",
	"lie",
	"life",
	"lifestyle",
	"lifetime",
	"lift",
	"light",
	"like",
	"likely",
	"limit",
	"limitation",
	"limited",
	"line",
	"link",
	"lip",
	"list",
	"listen",
	"literally",
	"literary",
	"literature",
	"little",
	"live",
	"living",
	"load",
	"loan",
	"local",
	"locate",
	"location",
	"lock",
	"long",
	"look",
	"loose",
	"lose",
	"lost",
	"lot",
	"lots",
	"loud",
	"love",
	"lovely",
	"lover",
	"low",
	"lower",
	"luck",
	"lucky",
	"lunch",
	"lung",
	"machine",
	"magazine",
	"mail",
	"main",
	"mainly",
	"maintain",
	"maintenance",
	"major",
	"majority",
	"make",
	"maker",
	"makeup",
	"male",
	"mall",
	"man",
	"manage",
	"management",
	"manager",
	"manner",
	"manufacturer",
	"manufacturing",
	"many",
	"map",
	"margin",
	"mark",
	"market",
	"marketing",
	"marriage",
	"married",
	"marry",
	"mask",
	"mass",
	"massive",
	"master",
	"match",
	"material",
	"math",
	"matter",
	"may",
	"maybe",
	"mayor",
	"meal",
	"mean",
	"meaning",
	"meanwhile",
	"measure",
	"measurement",
	"meat",
	"mechanism",
	"media",
	"medical",
	"medication",
	"medicine",
	"medium",
	"meet",
	"meeting",
	"member",
	"membership",
	"memory",
	"mental",
	"mention",
	"menu",
	"mere",
	"merely",
	"message",
	"metal",
	"meter",
	"method",
	"middle",
	"might",
	"military",
	"milk",
	"million",
	"mind",
	"mine",
	"minister",
	"minor",
	"minority",
	"minute",
	"miracle",
	"mirror",
	"miss",
	"missile",
	"mission",
	"mix",
	"mixture",
	"mode",
	"model",
	"moderate",
	"modern",
	"modest",
	"mom",
	"moment",
	"money",
	"monitor",
	"month",
	"mood",
	"moon",
	"moral",
	"more",
	"moreover",
	"morning",
	"mortgage",
	"most",
	"mostly",
	"mother",
	"motion",
	"motivation",
	"motor",
	"mount",
	"mountain",
	"mouse",
	"mouth",
	"move",
	"movement",
	"movie",
	"much",
	"multiple",
	"muscle",
	"museum",
	"music",
	"musical",
	"musician",
	"must",
	"mutual",
	"myself",
	"mystery",
	"myth",
	"naked",
	"name",
	"narrative",
	"narrow",
	"nation",
	"national",
	"native",
	"natural",
	"naturally",
	"nature",
	"near",
	"nearby",
	"nearly",
	"necessarily",
	"necessary",
	"neck",
	"need",
	"negative",
	"negotiate",
	"negotiation",
	"neighbor",
	"neighborhood",
	"neither",
	"nerve",
	"net",
	"network",
	"never",
	"nevertheless",
	"new",
	"newly",
	"news",
	"newspaper",
	"next",
	"nice",
	"night",
	"nine",
	"nobody",
	"nod",
	"nomination",
	"none",
	"nonetheless",
	"nor",
	"normal",
	"normally",
	"north",
	"northern",
	"nose",
	"not",
	"note",
	"nothing",
	"notice",
	"notion",
	"novel",
	"now",
	"nowhere",
	"nuclear",
	"number",
	"numerous",
	"nurse",
	"nut",
	"object",
	"objective",
	"obligation",
	"observation",
	"observe",
	"observer",
	"obtain",
	"obvious",
	"obviously",
	"occasion",
	"occasionally",
	"occupation",
	"occupy",
	"occur",
	"ocean",
	"odd",
	"odds",
	"off",
	"offer",
	"office",
	"officer",
	"official",
	"often",
	"oil",
	"okay",
	"old",
	"once",
	"one",
	"ongoing",
	"onion",
	"online",
	"only",
	"onto",
	"open",
	"opening",
	"operate",
	"operating",
	"operation",
	"operator",
	"opinion",
	"opponent",
	"opportunity",
	"oppose",
	"opposite",
	"opposition",
	"option",
	"orange",
	"order",
	"ordinary",
	"organic",
	"organization",
	"organize",
	"orientation",
	"origin",
	"original",
	"originally",
	"other",
	"others",
	"otherwise",
	"ought",
	"our",
	"ourselves",
	"out",
	"outcome",
	"outside",
	"oven",
	"over",
	"overall",
	"overcome",
	"overlook",
	"owe",
	"own",
	"owner",
	"pace",
	"pack",
	"package",
	"page",
	"paint",
	"painter",
	"painting",
	"pair",
	"pale",
	"palm",
	"pan",
	"panel",
	"pant",
	"paper",
	"parent",
	"park",
	"parking",
	"part",
	"participant",
	"participate",
	"participation",
	"particular",
	"particularly",
	"partly",
	"partner",
	"partnership",
	"party",
	"pass",
	"passage",
	"passenger",
	"passion",
	"past",
	"patch",
	"path",
	"patient",
	"pattern",
	"pause",
	"pay",
	"payment",
	"peace",
	"peak",
	"peer",
	"people",
	"pepper",
	"per",
	"perceive",
	"percentage",
	"perception",
	"perfect",
	"perfectly",
	"perform",
	"performance",
	"perhaps",
	"period",
	"permanent",
	"permission",
	"permit",
	"person",
	"personal",
	"personality",
	"personally",
	"personnel",
	"perspective",
	"persuade",
	"pet",
	"phase",
	"phenomenon",
	"philosophy",
	"phone",
	"photo",
	"photograph",
	"photographer",
	"phrase",
	"physical",
	"physically",
	"physician",
	"piano",
	"pick",
	"picture",
	"pie",
	"piece",
	"pile",
	"pilot",
	"pine",
	"pink",
	"pipe",
	"pitch",
	"place",
	"plan",
	"plane",
	"planet",
	"planning",
	"plant",
	"plastic",
	"plate",
	"platform",
	"play",
	"player",
	"please",
	"pleasure",
	"plenty",
	"plot",
	"plus",
	"pocket",
	"poem",
	"poet",
	"poetry",
	"point",
	"pole",
	"police",
	"policy",
	"political",
	"politically",
	"politician",
	"politics",
	"poll",
	"pool",
	"pop",
	"popular",
	"population",
	"porch",
	"port",
	"portion",
	"portrait",
	"portray",
	"pose",
	"position",
	"positive",
	"possess",
	"possibility",
	"possible",
	"possibly",
	"post",
	"pot",
	"potato",
	"potential",
	"potentially",
	"pound",
	"pour",
	"powder",
	"power",
	"powerful",
	"practical",
	"practice",
	"pray",
	"prayer",
	"precisely",
	"predict",
	"prefer",
	"preference",
	"pregnancy",
	"pregnant",
	"preparation",
	"prepare",
	"prescription",
	"presence",
	"present",
	"presentation",
	"preserve",
	"president",
	"presidential",
	"press",
	"pretend",
	"pretty",
	"prevent",
	"previous",
	"previously",
	"price",
	"pride",
	"priest",
	"primarily",
	"primary",
	"prime",
	"principal",
	"principle",
	"print",
	"prior",
	"priority",
	"privacy",
	"private",
	"probably",
	"procedure",
	"proceed",
	"process",
	"produce",
	"producer",
	"product",
	"production",
	"profession",
	"professional",
	"professor",
	"profile",
	"profit",
	"program",
	"progress",
	"project",
	"prominent",
	"promise",
	"promote",
	"prompt",
	"proof",
	"proper",
	"properly",
	"property",
	"proportion",
	"proposal",
	"propose",
	"proposed",
	"prosecutor",
	"prospect",
	"protect",
	"protection",
	"protein",
	"protest",
	"proud",
	"prove",
	"provide",
	"provider",
	"province",
	"provision",
	"psychological",
	"psychologist",
	"psychology",
	"public",
	"publication",
	"publicly",
	"publish",
	"publisher",
	"pull",
	"purchase",
	"pure",
	"purpose",
	"pursue",
	"push",
	"put",
	"qualify",
	"quality",
	"quarter",
	"quarterback",
	"question",
	"quick",
	"quickly",
	"quiet",
	"quietly",
	"quit",
	"quite",
	"quote",
	"race",
	"racial",
	"radical",
	"radio",
	"rail",
	"rain",
	"raise",
	"range",
	"rank",
	"rapid",
	"rapidly",
	"rare",
	"rarely",
	"rate",
	"rather",
	"rating",
	"ratio",
	"raw",
	"reach",
	"react",
	"reaction",
	"read",
	"reader",
	"reading",
	"ready",
	"real",
	"reality",
	"realize",
	"really",
	"reason",
	"reasonable",
	"recall",
	"receive",
	"recent",
	"recently",
	"recipe",
	"recognition",
	"recognize",
	"recommend",
	"recommendation",
	"record",
	"recording",
	"recover",
	"recovery",
	"recruit",
	"red",
	"reduce",
	"reduction",
	"refer",
	"reference",
	"reflect",
	"reflection",
	"reform",
	"refugee",
	"refuse",
	"regard",
	"regarding",
	"regardless",
	"regime",
	"region",
	"regional",
	"register",
	"regular",
	"regularly",
	"regulate",
	"regulation",
	"reinforce",
	"relate",
	"relation",
	"relationship",
	"relative",
	"relatively",
	"relax",
	"release",
	"relevant",
	"relief",
	"religion",
	"religious",
	"rely",
	"remain",
	"remaining",
	"remarkable",
	"remember",
	"remind",
	"remote",
	"remove",
	"repeat",
	"repeatedly",
	"replace",
	"reply",
	"report",
	"reporter",
	"represent",
	"representation",
	"representative",
	"reputation",
	"request",
	"require",
	"requirement",
	"research",
	"researcher",
	"resemble",
	"reservation",
	"resident",
	"resist",
	"resolution",
	"resolve",
	"resort",
	"resource",
	"respect",
	"respond",
	"respondent",
	"response",
	"responsibility",
	"responsible",
	"rest",
	"restaurant",
	"restore",
	"restriction",
	"result",
	"retain",
	"retire",
	"retirement",
	"return",
	"reveal",
	"revenue",
	"review",
	"revolution",
	"rhythm",
	"rice",
	"rich",
	"rid",
	"ride",
	"rifle",
	"right",
	"ring",
	"rise",
	"river",
	"road",
	"rock",
	"role",
	"roll",
	"romantic",
	"roof",
	"room",
	"root",
	"rope",
	"rose",
	"roughly",
	"round",
	"route",
	"routine",
	"row",
	"rub",
	"rule",
	"run",
	"running",
	"rural",
	"rush",
	"sacred",
	"safe",
	"safety",
	"sake",
	"salad",
	"salary",
	"sale",
	"sales",
	"salt",
	"same",
	"sample",
	"sanction",
	"sand",
	"satellite",
	"satisfaction",
	"satisfy",
	"sauce",
	"save",
	"saving",
	"say",
	"scale",
	"scenario",
	"scene",
	"schedule",
	"scheme",
	"scholar",
	"scholarship",
	"school",
	"science",
	"scientific",
	"scientist",
	"scope",
	"score",
	"screen",
	"script",
	"sea",
	"search",
	"season",
	"seat",
	"second",
	"secret",
	"secretary",
	"section",
	"sector",
	"secure",
	"security",
	"see",
	"seed",
	"seek",
	"seem",
	"segment",
	"seize",
	"select",
	"selection",
	"self",
	"sell",
	"senator",
	"send",
	"senior",
	"sense",
	"sensitive",
	"sentence",
	"separate",
	"sequence",
	"series",
	"serious",
	"seriously",
	"serve",
	"service",
	"session",
	"set",
	"setting",
	"settle",
	"settlement",
	"seven",
	"several",
	"shade",
	"shadow",
	"shake",
	"shall",
	"shape",
	"share",
	"sharp",
	"sheet",
	"shelf",
	"shell",
	"shelter",
	"shift",
	"shine",
	"ship",
	"shirt",
	"shoe",
	"shop",
	"shopping",
	"shore",
	"short",
	"shortly",
	"shot",
	"should",
	"shoulder",
	"shout",
	"show",
	"shower",
	"shrug",
	"shut",
	"side",
	"sigh",
	"sight",
	"sign",
	"signal",
	"significance",
	"significant",
	"significantly",
	"silence",
	"silent",
	"silver",
	"similar",
	"similarly",
	"simple",
	"simply",
	"since",
	"sing",
	"singer",
	"single",
	"sink",
	"sir",
	"sister",
	"sit",
	"site",
	"situation",
	"six",
	"size",
	"ski",
	"skill",
	"skin",
	"sky",
	"sleep",
	"slice",
	"slide",
	"slight",
	"slightly",
	"slip",
	"slow",
	"slowly",
	"small",
	"smart",
	"smell",
	"smile",
	"smooth",
	"snap",
	"snow",
	"soccer",
	"social",
	"society",
	"soft",
	"software",
	"soil",
	"solar",
	"solid",
	"solution",
	"solve",
	"some",
	"somebody",
	"somehow",
	"someone",
	"something",
	"sometimes",
	"somewhat",
	"somewhere",
	"son",
	"song",
	"soon",
	"sophisticated",
	"sorry",
	"sort",
	"soul",
	"sound",
	"soup",
	"source",
	"south",
	"southern",
	"space",
	"speak",
	"speaker",
	"special",
	"specialist",
	"species",
	"specific",
	"specifically",
	"speech",
	"speed",
	"spend",
	"spending",
	"spin",
	"spirit",
	"spiritual",
	"split",
	"spokesman",
	"sport",
	"spot",
	"spread",
	"spring",
	"square",
	"squeeze",
	"stability",
	"stable",
	"staff",
	"stage",
	"stair",
	"stake",
	"stand",
	"standard",
	"standing",
	"star",
	"stare",
	"start",
	"state",
	"statement",
	"station",
	"statistics",
	"status",
	"stay",
	"steady",
	"steal",
	"steel",
	"step",
	"stick",
	"still",
	"stir",
	"stock",
	"stomach",
	"stone",
	"stop",
	"storage",
	"store",
	"storm",
	"story",
	"straight",
	"strange",
	"stranger",
	"strategic",
	"strategy",
	"stream",
	"street",
	"strength",
	"strengthen",
	"stretch",
	"string",
	"strip",
	"strong",
	"strongly",
	"structure",
	"student",
	"studio",
	"study",
	"stuff",
	"style",
	"subject",
	"submit",
	"subsequent",
	"substance",
	"substantial",
	"succeed",
	"success",
	"successful",
	"successfully",
	"such",
	"sudden",
	"suddenly",
	"sue",
	"sufficient",
	"sugar",
	"suggest",
	"suggestion",
	"suit",
	"summer",
	"summit",
	"sun",
	"super",
	"supply",
	"support",
	"supporter",
	"suppose",
	"supposed",
	"sure",
	"surely",
	"surface",
	"surgery",
	"surprise",
	"surprised",
	"surprising",
	"surprisingly",
	"surround",
	"survey",
	"survival",
	"survive",
	"survivor",
	"sustain",
	"swear",
	"sweep",
	"sweet",
	"swim",
	"swing",
	"switch",
	"symbol",
	"system",
	"table",
	"tablespoon",
	"tactic",
	"tail",
	"take",
	"tale",
	"talent",
	"talk",
	"tall",
	"tank",
	"tap",
	"tape",
	"target",
	"task",
	"taste",
	"tax",
	"taxpayer",
	"tea",
	"teach",
	"teacher",
	"teaching",
	"team",
	"tear",
	"teaspoon",
	"technical",
	"technique",
	"technology",
	"teen",
	"teenager",
	"telephone",
	"telescope",
	"television",
	"tell",
	"temperature",
	"temporary",
	"ten",
	"tend",
	"tendency",
	"tennis",
	"tent",
	"term",
	"terms",
	"territory",
	"test",
	"testify",
	"testimony",
	"testing",
	"text",
	"than",
	"thank",
	"thanks",
	"that",
	"the",
	"theater",
	"their",
	"them",
	"theme",
	"themselves",
	"then",
	"theory",
	"therapy",
	"there",
	"therefore",
	"thick",
	"thin",
	"thing",
	"think",
	"thinking",
	"third",
	"thirty",
	"though",
	"thought",
	"thousand",
	"three",
	"throat",
	"through",
	"throughout",
	"throw",
	"ticket",
	"tie",
	"tight",
	"time",
	"tiny",
	"tip",
	"tire",
	"tired",
	"tissue",
	"title",
	"today",
	"toe",
	"together",
	"tomato",
	"tomorrow",
	"tone",
	"tongue",
	"tonight",
	"too",
	"tool",
	"tooth",
	"top",
	"topic",
	"toss",
	"total",
	"totally",
	"touch",
	"tough",
	"tour",
	"tourist",
	"tournament",
	"toward",
	"towards",
	"tower",
	"town",
	"toy",
	"trace",
	"track",
	"trade",
	"tradition",
	"traditional",
	"traffic",
	"trail",
	"train",
	"training",
	"transfer",
	"transform",
	"transformation",
	"transition",
	"translate",
	"transportation",
	"travel",
	"treat",
	"treatment",
	"treaty",
	"tree",
	"tremendous",
	"trend",
	"trial",
	"tribe",
	"trip",
	"troop",
	"truck",
	"true",
	"truly",
	"trust",
	"truth",
	"try",
	"tube",
	"tunnel",
	"turn",
	"twelve",
	"twenty",
	"twice",
	"twin",
	"two",
	"type",
	"typical",
	"typically",
	"ultimate",
	"ultimately",
	"unable",
	"uncle",
	"under",
	"undergo",
	"understand",
	"understanding",
	"unfortunately",
	"uniform",
	"union",
	"unique",
	"unit",
	"universal",
	"universe",
	"university",
	"unknown",
	"unless",
	"unlike",
	"unlikely",
	"until",
	"unusual",
	"upon",
	"upper",
	"urban",
	"urge",
	"use",
	"used",
	"useful",
	"user",
	"usual",
	"usually",
	"utility",
	"vacation",
	"valley",
	"valuable",
	"value",
	"variable",
	"variation",
	"variety",
	"various",
	"vary",
	"vast",
	"vegetable",
	"vehicle",
	"venture",
	"version",
	"versus",
	"very",
	"vessel",
	"veteran",
	"via",
	"victory",
	"video",
	"view",
	"viewer",
	"village",
	"virtually",
	"virtue",
	"visible",
	"vision",
	"visit",
	"visitor",
	"visual",
	"vital",
	"voice",
	"volume",
	"volunteer",
	"vote",
	"voter",
	"wage",
	"wait",
	"wake",
	"walk",
	"wall",
	"wander",
	"want",
	"warm",
	"warn",
	"warning",
	"wash",
	"watch",
	"water",
	"wave",
	"way",
	"wealth",
	"wealthy",
	"wear",
	"weather",
	"wedding",
	"week",
	"weekend",
	"weekly",
	"weigh",
	"weight",
	"welcome",
	"welfare",
	"well",
	"west",
	"western",
	"wet",
	"what",
	"whatever",
	"wheel",
	"when",
	"whenever",
	"where",
	"whereas",
	"whether",
	"which",
	"while",
	"whisper",
	"white",
	"who",
	"whole",
	"whom",
	"whose",
	"why",
	"wide",
	"widely",
	"widespread",
	"wife",
	"wild",
	"will",
	"willing",
	"win",
	"wind",
	"window",
	"wine",
	"wing",
	"winner",
	"winter",
	"wipe",
	"wire",
	"wisdom",
	"wise",
	"wish",
	"with",
	"withdraw",
	"within",
	"without",
	"witness",
	"woman",
	"wonder",
	"wonderful",
	"wood",
	"wooden",
	"word",
	"work",
	"worker",
	"working",
	"works",
	"workshop",
	"world",
	"worried",
	"worth",
	"would",
	"wrap",
	"write",
	"writer",
	"writing",
	"yard",
	"yeah",
	"year",
	"yell",
	"yellow",
	"yes",
	"yesterday",
	"yet",
	"yield",
	"young",
	"your",
	"yours",
	"yourself",
	"youth",
	"zone"
];
const random = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
function getRandomWord() {
	return words[random(0, words.length - 1)];
}
//#endregion
//#region src/create/random-name.ts
const isTest = process.env.VP_CLI_TEST === "1";
function getRandomWords() {
	const first = getRandomWord();
	let second;
	do
		second = getRandomWord();
	while (second === first);
	return [first, second];
}
function getRandomProjectName(options = {}) {
	const { scope, fallbackName } = options;
	const projectName = isTest && fallbackName ? fallbackName : getRandomWords().join("-");
	return scope ? `${scope}/${projectName}` : projectName;
}
//#endregion
//#region src/create/utils.ts
function hasExplicitEditorOptIn(editor) {
	return typeof editor === "string" && editor.trim() !== "";
}
function normalizeEditorOption(editor) {
	if (!Array.isArray(editor)) return editor;
	if (editor.includes(false)) return false;
	return editor.findLast((value) => typeof value === "string");
}
function shouldConfigureEditorsForCreate({ editor, isMonorepo }) {
	if (editor === false) return false;
	if (!isMonorepo) return true;
	return hasExplicitEditorOptIn(editor);
}
function copy(src, dest) {
	if (fs.statSync(src).isDirectory()) copyDir(src, dest);
	else fs.copyFileSync(src, dest);
}
function copyDir(srcDir, destDir) {
	fs.mkdirSync(destDir, { recursive: true });
	for (const file of fs.readdirSync(srcDir)) copy(path.resolve(srcDir, file), path.resolve(destDir, file));
}
/**
* Format the target directory into a valid directory name and package name
*
* Examples:
* ```
* # invalid target directories
* /foo/bar -> { directory: '', packageName: '', error: 'Absolute path is not allowed' }
* @scope/ -> { directory: '', packageName: '', error: 'Invalid target directory' }
* ../../foo/bar -> { directory: '', packageName: '', error: 'Invalid target directory' }
*
* # valid target directories
* . -> { directory: '.', packageName: '' }
* ./my-package -> { directory: './my-package', packageName: 'my-package' }
* ./foo/bar-package -> { directory: './foo/bar-package', packageName: 'bar-package' }
* ./foo/bar-package/ -> { directory: './foo/bar-package', packageName: 'bar-package' }
* my-package -> { directory: 'my-package', packageName: 'my-package' }
* @my-scope/my-package -> { directory: 'my-package', packageName: '@my-scope/my-package' }
* foo/@my-scope/my-package -> { directory: 'foo/my-package', packageName: '@scope/my-package' }
* ./foo/@my-scope/my-package -> { directory: './foo/my-package', packageName: '@scope/my-package' }
* ./foo/bar/@scope/my-package -> { directory: './foo/bar/my-package', packageName: '@scope/my-package' }
* ```
*/
function formatTargetDir(input) {
	let targetDir = path.normalize(input.trim());
	if (targetDir === "." || targetDir === `.${path.sep}`) return {
		directory: ".",
		packageName: ""
	};
	const parsed = path.parse(targetDir);
	if (parsed.root || path.isAbsolute(targetDir)) return {
		directory: "",
		packageName: "",
		error: "Absolute path is not allowed"
	};
	if (targetDir.includes("..")) return {
		directory: "",
		packageName: "",
		error: "Relative path contains \"..\" which is not allowed"
	};
	let packageName = parsed.base;
	const parentName = path.basename(parsed.dir);
	if (parentName.startsWith("@")) {
		targetDir = path.join(path.dirname(parsed.dir), packageName);
		packageName = `${parentName}/${packageName}`;
	}
	const result = (0, import_lib.default)(packageName);
	if (!result.validForNewPackages) {
		const message = result.errors?.[0] ?? result.warnings?.[0] ?? "Invalid package name";
		return {
			directory: "",
			packageName: "",
			error: `Parsed package name "${packageName}" is invalid: ${message}`
		};
	}
	return {
		directory: targetDir.split(path.sep).join("/"),
		packageName
	};
}
function getProjectDirFromPackageName(packageName) {
	if (packageName.startsWith("@")) return packageName.split("/")[1];
	return packageName;
}
function setPackageName(projectDir, packageName) {
	editJsonFile(path.join(projectDir, "package.json"), (pkg) => {
		pkg.name = packageName;
		return pkg;
	});
}
const RENAME_FILES = {
	_gitignore: ".gitignore",
	_npmrc: ".npmrc",
	"_yarnrc.yml": ".yarnrc.yml"
};
/** Rename underscore-prefixed scaffold files to their dotfile names in `projectDir`. */
function renameFiles(projectDir) {
	for (const [from, to] of Object.entries(RENAME_FILES)) {
		const fromPath = path.join(projectDir, from);
		if (fs.existsSync(fromPath)) fs.renameSync(fromPath, path.join(projectDir, to));
	}
}
const DOTENV_GITIGNORE_LINES = [
	"# dotenv environment variable files",
	".env",
	".env.*",
	"!.env.example"
];
/**
* Make sure the scaffolded project's `.gitignore` excludes default generated
* project artifacts.
*
* Called right after `git init` so even bundled `@org` templates (which
* may ship without a `.gitignore`) don't end up tracking dependencies or
* local environment files on the user's first commit.
*/
function ensureDefaultGitignoreEntries(projectDir) {
	const gitignorePath = path.join(projectDir, ".gitignore");
	let content = "";
	try {
		content = fs.readFileSync(gitignorePath, "utf-8");
	} catch {}
	const lines = [];
	if (!hasNodeModulesGitignoreLine(content)) lines.push("node_modules");
	const missingDotenvLines = DOTENV_GITIGNORE_LINES.filter((line) => !hasGitignoreLine(content, line));
	if (missingDotenvLines.length > 0) {
		const startsDotenvSection = missingDotenvLines[0] === DOTENV_GITIGNORE_LINES[0];
		if (lines.length > 0 || startsDotenvSection && content.trim() !== "") lines.push("");
		lines.push(...missingDotenvLines);
	}
	appendGitignoreLines(gitignorePath, content, lines);
}
function hasNodeModulesGitignoreLine(content) {
	return /^\s*node_modules\/?\s*$/m.test(content);
}
function hasGitignoreLine(content, line) {
	return content.split(/\r?\n/).some((entry) => entry.trim() === line);
}
function appendGitignoreLines(gitignorePath, content, lines) {
	if (lines.length === 0) return;
	const prefix = content === "" || content.endsWith("\n") ? "" : "\n";
	fs.appendFileSync(gitignorePath, `${prefix}${lines.join("\n")}\n`);
}
const VSCODE_SETTINGS_PATH = ".vscode/settings.json";
const VSCODE_CONFIG_UNIGNORE_BLOCK = [
	"!.vscode/",
	`!${VSCODE_SETTINGS_PATH}`,
	`!.vscode/extensions.json`
];
/**
* Make generated VS Code workspace config trackable when `vp create` writes VS Code config.
*/
function ensureGitignoreVsCodeEditorConfigs(projectDir) {
	if (!fs.existsSync(path.join(projectDir, VSCODE_SETTINGS_PATH))) return;
	const gitignorePath = path.join(projectDir, ".gitignore");
	let content;
	try {
		content = fs.readFileSync(gitignorePath, "utf-8");
	} catch {
		return;
	}
	appendGitignoreVsCodeEditorConfigsBlock(gitignorePath, content);
}
function appendGitignoreVsCodeEditorConfigsBlock(gitignorePath, content) {
	if (content.trimEnd().endsWith(VSCODE_CONFIG_UNIGNORE_BLOCK.join("\n"))) return;
	appendGitignoreLines(gitignorePath, content, VSCODE_CONFIG_UNIGNORE_BLOCK);
}
function formatDisplayTargetDir(targetDir) {
	const normalized = targetDir.split(path.sep).join("/");
	if (normalized === "" || normalized === ".") return "./";
	if (normalized.startsWith("./") || normalized.startsWith("../") || normalized.startsWith("/") || normalized.startsWith("~")) return normalized;
	return `./${normalized}`;
}
function deriveDefaultPackageName(cwd, scope, fallbackName) {
	const dirName = path.basename(cwd);
	const candidate = scope ? `${scope}/${dirName}` : dirName;
	return (0, import_lib.default)(candidate).validForNewPackages ? candidate : getRandomProjectName({
		scope,
		fallbackName
	});
}
//#endregion
//#region src/create/prompts.ts
async function promptPackageNameAndTargetDir(defaultPackageName, interactive) {
	let packageName;
	let targetDir;
	if (interactive) {
		const selected = await text({
			message: "Package name:",
			placeholder: defaultPackageName,
			defaultValue: defaultPackageName,
			validate: (value) => {
				if (value == null || value.length === 0) return;
				const result = value ? (0, import_lib.default)(value) : null;
				if (result?.validForNewPackages) return;
				return result?.errors?.[0] ?? result?.warnings?.[0] ?? "Invalid package name";
			}
		});
		if (isCancel(selected)) cancelAndExit();
		packageName = selected;
		targetDir = getProjectDirFromPackageName(packageName);
	} else {
		packageName = defaultPackageName;
		targetDir = getProjectDirFromPackageName(packageName);
		log$1.info(`Using default package name: ${accent(packageName)}`);
	}
	return {
		packageName,
		targetDir
	};
}
async function promptTargetDir(defaultTargetDir, interactive, options) {
	let targetDir;
	if (interactive) {
		const selected = await text({
			message: "Target directory:",
			placeholder: defaultTargetDir,
			defaultValue: defaultTargetDir,
			validate: (value) => validateTargetDir(value ?? defaultTargetDir, options?.cwd).error
		});
		if (isCancel(selected)) cancelAndExit();
		targetDir = validateTargetDir(selected ?? defaultTargetDir, options?.cwd).directory;
	} else {
		targetDir = validateTargetDir(defaultTargetDir, options?.cwd).directory;
		log$1.info(`Using default target directory: ${accent(targetDir)}`);
	}
	return targetDir;
}
function suggestAvailableTargetDir(defaultTargetDir, cwd) {
	let suggestedTargetDir = defaultTargetDir;
	let attempt = 1;
	while (!isTargetDirAvailable(path.join(cwd, suggestedTargetDir))) {
		suggestedTargetDir = getRandomProjectName({ fallbackName: `${defaultTargetDir}-${attempt}` });
		attempt++;
	}
	return suggestedTargetDir;
}
async function checkProjectDirExists(projectDirFullPath, interactive) {
	if (isTargetDirAvailable(projectDirFullPath)) return;
	if (!interactive) {
		log$1.info("Use --directory to specify a different location or remove the directory first");
		cancelAndExit(`Target directory "${projectDirFullPath}" is not empty`, 1);
	}
	const overwrite = await select({
		message: `Target directory "${projectDirFullPath}" is not empty. Please choose how to proceed:`,
		options: [{
			label: "Cancel operation",
			value: "no"
		}, {
			label: "Remove existing files and continue",
			value: "yes"
		}]
	});
	if (isCancel(overwrite)) cancelAndExit();
	switch (overwrite) {
		case "yes":
			emptyDir(projectDirFullPath);
			break;
		case "no": cancelAndExit();
	}
}
function isEmpty(path) {
	const files = fs.readdirSync(path);
	return files.length === 0 || files.length === 1 && files[0] === ".git";
}
function emptyDir(dir) {
	if (!fs.existsSync(dir)) return;
	for (const file of fs.readdirSync(dir)) {
		if (file === ".git") continue;
		fs.rmSync(path.resolve(dir, file), {
			recursive: true,
			force: true
		});
	}
}
function isTargetDirAvailable(projectDirFullPath) {
	return !fs.existsSync(projectDirFullPath) || isEmpty(projectDirFullPath);
}
function validateTargetDir(input, cwd) {
	const value = input?.trim() ?? "";
	if (!value) return {
		directory: "",
		error: "Target directory is required"
	};
	const targetDir = path.normalize(value);
	if (!targetDir || targetDir === ".") return {
		directory: "",
		error: "Target directory is required"
	};
	if (path.isAbsolute(targetDir)) return {
		directory: "",
		error: "Absolute path is not allowed"
	};
	if (targetDir.includes("..")) return {
		directory: "",
		error: "Relative path contains \"..\" which is not allowed"
	};
	if (cwd && !isTargetDirAvailable(path.join(cwd, targetDir))) return {
		directory: "",
		error: `Target directory "${targetDir}" already exists`
	};
	return { directory: targetDir };
}
//#endregion
//#region src/create/register-template.ts
/**
* Register a local template into `create.templates` in a monorepo's root
* `vite.config.ts`. Used after `vp create vite:generator` scaffolds a
* generator so the generated template shows up in this workspace's
* `vp create` picker.
*
* Behavior:
* - Reads the existing `create` config from the workspace root's `vite.config.*`.
* - If an entry with the same `name` already exists → no-op (idempotent),
*   warning when it points at a different `template` so a stale entry does
*   not silently shadow the new generator.
* - Otherwise appends `entry` to `create.templates`, preserving any sibling
*   `create.defaultTemplate` and any existing entries, and writes back.
* - If there is no `vite.config.*` yet, or no `create` block, it is created.
*
* Read-modify-write: the existing `create` object is read in full first and
* the complete, recomputed object is written back via `upsertJsonConfig`
* (replace the existing `create` value, or insert the key), so
* `defaultTemplate` and prior `templates` are kept. Throws when the config
* shape is not supported by the upsert, rather than writing nothing or a key
* that is dead at runtime.
*
* Returns the absolute path of the config file written, so the caller can fold
* it into its own formatting pass (the upsert writes a JSON-style block that
* needs reformatting). Returns `undefined` for the idempotent no-op.
*/
async function registerLocalTemplate(workspaceRoot, entry, silent = false) {
	const configPath = findViteConfig(workspaceRoot);
	const existing = await getConfiguredCreate(workspaceRoot, {
		walkUp: false,
		throwOnReadError: true
	});
	const existingEntry = existing.templates.find((t) => t.name === entry.name);
	if (existingEntry) {
		if (existingEntry.template !== entry.template) log$1.warn(`create.templates already has an entry named '${entry.name}' pointing at '${existingEntry.template}'; left unchanged.\nUpdate it by hand if it should run '${entry.template}' instead.`);
		return;
	}
	const nextCreate = {
		...existing.defaultTemplate !== void 0 ? { defaultTemplate: existing.defaultTemplate } : {},
		templates: [...existing.templates, entry]
	};
	const targetPath = configPath ?? ensureViteConfig(workspaceRoot, silent);
	writeCreateBlock(targetPath, nextCreate);
	return targetPath;
}
/**
* Create a minimal `vite.config.ts` (matching the migrator's
* `ensureViteConfig` shape) and return its absolute path.
*/
function ensureViteConfig(workspaceRoot, silent) {
	const configPath = path.join(workspaceRoot, "vite.config.ts");
	fs.writeFileSync(configPath, `import { defineConfig } from '${VITE_PLUS_NAME}';\n\nexport default defineConfig({});\n`);
	if (!silent) log$1.success(`✔ Created vite.config.ts in ${displayRelative(configPath)}`);
	return configPath;
}
/**
* Write the full `create` object into vite.config.ts via the shared config
* upsert: replace the existing `create:` value in place, or insert the key
* when absent. The caller reformats the file afterward, so the JSON-style
* block written here is normalized to the surrounding style.
*
* Throws when the config shape is not supported (`updated: false`, e.g.
* `module.exports` or `export default someVar`), so the caller can warn and
* point at a manual edit instead of reporting a registration that never
* happened.
*/
function writeCreateBlock(configPath, create) {
	const tempPath = path.join(os.tmpdir(), `vite-plus-create-register-${randomUUID()}.json`);
	fs.writeFileSync(tempPath, JSON.stringify(create));
	try {
		const result = upsertJsonConfig(configPath, tempPath, "create");
		if (!result.updated) throw new Error(`could not find a supported config object in ${displayRelative(configPath)}`);
		fs.writeFileSync(configPath, result.content);
	} finally {
		fs.rmSync(tempPath, { force: true });
	}
}
//#endregion
//#region src/create/templates/generator.ts
async function executeGeneratorScaffold(workspaceInfo, templateInfo, options) {
	if (!options?.silent) log$1.step("Creating generator scaffold...");
	let description;
	if (templateInfo.interactive) {
		const defaultDescription = "Generate new components for our monorepo";
		const descPrompt = await text({
			message: "Description:",
			placeholder: defaultDescription,
			defaultValue: defaultDescription
		});
		if (!isCancel(descPrompt)) description = descPrompt;
	}
	const fullPath = path.join(workspaceInfo.rootDir, templateInfo.targetDir);
	copyDir(path.join(templatesDir, "generator"), fullPath);
	fs.chmodSync(path.join(fullPath, "bin/index.ts"), "755");
	editJsonFile(path.join(fullPath, "package.json"), (pkg) => {
		pkg.name = templateInfo.packageName;
		if (description) pkg.description = description;
		return pkg;
	});
	if (!options?.silent) log$1.success("Generator scaffold created");
	return {
		exitCode: 0,
		projectDir: templateInfo.targetDir
	};
}
//#endregion
//#region src/create/templates/remote.ts
var import_picocolors = /* @__PURE__ */ __toESM(require_picocolors(), 1);
const { gray, yellow } = import_picocolors.default;
async function executeRemoteTemplate(workspaceInfo, templateInfo, options) {
	const silent = options?.silent ?? false;
	if (!silent) log$1.step("Generating project…");
	let isGitHubTemplate = templateInfo.command === "degit";
	let result;
	if (templateInfo.command === "node") {
		const command = templateInfo.command;
		const args = templateInfo.args;
		const envs = templateInfo.envs;
		if (!silent) log$1.info(`Running: ${gray(`${command} ${args.join(" ")}`)}`);
		result = await runCommandAndDetectProjectDir({
			command,
			args,
			cwd: workspaceInfo.rootDir,
			envs
		}, templateInfo.parentDir);
	} else {
		if (!isGitHubTemplate) {
			if (!await checkNpmPackageExists(templateInfo.command)) {
				if (!silent) log$1.error(`Template "${templateInfo.command}" not found on npm. Run ${yellow("vp create --list")} to see available templates.`);
				return { exitCode: 1 };
			}
		}
		result = await runRemoteTemplateCommand(workspaceInfo, workspaceInfo.rootDir, templateInfo, true, silent);
	}
	const exitCode = result.exitCode;
	if (exitCode === 127) {
		log$1.info(yellow("\nTroubleshooting:"));
		log$1.info(`  ${gray("•")} Command not found. Make sure Node.js is installed`);
	} else if (isGitHubTemplate && exitCode !== 0) {
		log$1.info(yellow("\nTroubleshooting:"));
		log$1.info(`  ${gray("•")} Make sure the GitHub repository exists`);
		log$1.info(`  ${gray("•")} Check your internet connection`);
		log$1.info(`  ${gray("•")} Repository might be private (requires authentication)`);
	}
	return result;
}
async function runRemoteTemplateCommand(workspaceInfo, cwd, templateInfo, detectCreatedProjectDir, silent = false) {
	autoFixRemoteTemplateCommand(templateInfo, workspaceInfo);
	const remotePackageName = templateInfo.command;
	const execArgs = [...templateInfo.args];
	const envs = templateInfo.envs;
	const { command, args } = formatDlxCommand(remotePackageName, execArgs, workspaceInfo);
	if (!silent) log$1.info(`Running: ${gray(`${command} ${args.join(" ")}`)}`);
	if (detectCreatedProjectDir) return await runCommandAndDetectProjectDir({
		command,
		args,
		cwd,
		envs
	}, templateInfo.parentDir);
	if (silent) return await runCommandSilently({
		command,
		args,
		cwd,
		envs
	});
	return await runCommand$1({
		command,
		args,
		cwd,
		envs
	});
}
function autoFixRemoteTemplateCommand(templateInfo, workspaceInfo) {
	let packageName = templateInfo.command;
	const indexOfAt = packageName.indexOf("@", 2);
	if (indexOfAt !== -1) packageName = packageName.substring(0, indexOfAt);
	if (packageName === "create-vite") {
		templateInfo.args.push("--no-immediate");
		templateInfo.args.push("--no-rolldown");
	} else if (packageName === "@tanstack/cli") {
		if (templateInfo.args[0] !== "create") templateInfo.args.unshift("create");
		templateInfo.args.push("--no-install");
		templateInfo.args.push("--no-toolchain");
	} else if (packageName === "sv") {
		if (templateInfo.args[0] !== "create") templateInfo.args.unshift("create");
		templateInfo.args.push("--no-install");
	}
	if (workspaceInfo.isMonorepo) {
		if (packageName === "create-nuxt") templateInfo.args.push("--no-gitInit");
		else if (packageName === "@tanstack/cli") templateInfo.args.push("--no-git");
	}
}
//#endregion
//#region src/create/templates/builtin.ts
async function executeBuiltinTemplate(workspaceInfo, templateInfo, options) {
	assert(templateInfo.targetDir, "targetDir is required");
	assert(templateInfo.packageName, "packageName is required");
	if (templateInfo.command === BuiltinTemplate.generator) return await executeGeneratorScaffold(workspaceInfo, templateInfo, options);
	if (templateInfo.command === BuiltinTemplate.application) {
		templateInfo.command = "create-vite@latest";
		if (!templateInfo.interactive) templateInfo.args.push("--no-interactive");
		templateInfo.args.unshift(templateInfo.targetDir);
	} else if (templateInfo.command === BuiltinTemplate.library) {
		const libraryTemplateInfo = discoverTemplate(LibraryTemplateRepo, [templateInfo.targetDir], workspaceInfo);
		const result = await runRemoteTemplateCommand(workspaceInfo, workspaceInfo.rootDir, libraryTemplateInfo, false, options?.silent ?? false);
		if (result.exitCode !== 0) return { exitCode: result.exitCode };
		setPackageName(path.join(workspaceInfo.rootDir, templateInfo.targetDir), templateInfo.packageName);
		return {
			...result,
			projectDir: templateInfo.targetDir
		};
	}
	if (templateInfo.command.startsWith("vite:")) {
		if (!options?.silent) log$1.error(`Unknown builtin template "${templateInfo.command}". Run ${import_picocolors.default.yellow("vp create --list")} to see available templates.`);
		return { exitCode: 1 };
	}
	const result = await runRemoteTemplateCommand(workspaceInfo, workspaceInfo.rootDir, templateInfo, false, options?.silent ?? false);
	if (result.exitCode !== 0) return { exitCode: result.exitCode };
	setPackageName(path.join(workspaceInfo.rootDir, templateInfo.targetDir), templateInfo.packageName);
	return {
		...result,
		projectDir: templateInfo.targetDir
	};
}
//#endregion
//#region src/create/templates/bundled.ts
/**
* Scaffold a bundled template by copying the pre-extracted directory at
* `localPath` into `workspaceInfo.rootDir/targetDir`.
*/
async function executeBundledTemplate(workspaceInfo, templateInfo) {
	assert(templateInfo.localPath, "localPath is required for bundled templates");
	assert(templateInfo.targetDir, "targetDir is required");
	assert(templateInfo.packageName, "packageName is required");
	const destDir = path.join(workspaceInfo.rootDir, templateInfo.targetDir);
	try {
		copyDir(templateInfo.localPath, destDir);
	} catch (error) {
		if (error.code === "ENOENT") throw new Error(`bundled template directory not found: ${templateInfo.localPath}`, { cause: error });
		throw error;
	}
	renameFiles(destDir);
	try {
		setPackageName(destDir, templateInfo.packageName);
	} catch {}
	return {
		exitCode: 0,
		projectDir: templateInfo.targetDir
	};
}
//#endregion
//#region src/create/templates/monorepo.ts
const InitialMonorepoAppDir = "apps/website";
async function executeMonorepoTemplate(workspaceInfo, templateInfo, options) {
	assert(templateInfo.packageName, "packageName is required");
	assert(templateInfo.targetDir, "targetDir is required");
	workspaceInfo.monorepoScope = getScopeFromPackageName(templateInfo.packageName);
	const fullPath = path.join(workspaceInfo.rootDir, templateInfo.targetDir);
	if (!options?.silent) {
		log$1.info(`Target directory: ${formatDisplayTargetDir(templateInfo.targetDir)}`);
		log$1.step("Creating Vite+ monorepo...");
	}
	copyDir(path.join(templatesDir, "monorepo"), fullPath);
	renameFiles(fullPath);
	editJsonFile(path.join(fullPath, "package.json"), (pkg) => {
		pkg.name = templateInfo.packageName;
		return pkg;
	});
	if (workspaceInfo.packageManager === PackageManager.pnpm) {
		editJsonFile(path.join(fullPath, "package.json"), (pkg) => {
			pkg.workspaces = void 0;
			pkg.resolutions = void 0;
			return pkg;
		});
		const yarnrcPath = path.join(fullPath, ".yarnrc.yml");
		if (fs.existsSync(yarnrcPath)) fs.unlinkSync(yarnrcPath);
	} else if (workspaceInfo.packageManager === PackageManager.yarn) {
		editJsonFile(path.join(fullPath, "package.json"), (pkg) => {
			pkg.pnpm = void 0;
			return pkg;
		});
		const pnpmWorkspacePath = path.join(fullPath, "pnpm-workspace.yaml");
		if (fs.existsSync(pnpmWorkspacePath)) fs.unlinkSync(pnpmWorkspacePath);
	} else {
		editJsonFile(path.join(fullPath, "package.json"), (pkg) => {
			pkg.pnpm = void 0;
			return pkg;
		});
		const pnpmWorkspacePath = path.join(fullPath, "pnpm-workspace.yaml");
		if (fs.existsSync(pnpmWorkspacePath)) fs.unlinkSync(pnpmWorkspacePath);
		const yarnrcPath = path.join(fullPath, ".yarnrc.yml");
		if (fs.existsSync(yarnrcPath)) fs.unlinkSync(yarnrcPath);
	}
	if (!options?.silent) log$1.success("Monorepo template created");
	if (!options?.silent) log$1.step("Creating default application in apps/website...");
	const appResult = await runRemoteTemplateCommand(workspaceInfo, fullPath, discoverTemplate("create-vite@latest", [
		InitialMonorepoAppDir,
		"--template",
		"vanilla-ts",
		"--no-interactive"
	], workspaceInfo), false, options?.silent ?? false);
	if (appResult.exitCode !== 0) {
		log$1.error(`Failed to create default application: ${appResult.exitCode}`);
		return appResult;
	}
	const appPackageName = workspaceInfo.monorepoScope ? `${workspaceInfo.monorepoScope}/website` : "website";
	const appProjectPath = path.join(fullPath, InitialMonorepoAppDir);
	setPackageName(appProjectPath, appPackageName);
	rewriteMonorepoProject(appProjectPath, workspaceInfo.packageManager, void 0, options?.silent ?? false);
	dropAliasedRuntimeDevDeps(appProjectPath, workspaceInfo.packageManager);
	if (!options?.silent) log$1.step("Creating default library in packages/utils...");
	const libraryDir = "packages/utils";
	const libraryResult = await runRemoteTemplateCommand(workspaceInfo, fullPath, discoverTemplate(LibraryTemplateRepo, [libraryDir], workspaceInfo), false, options?.silent ?? false);
	if (libraryResult.exitCode !== 0) {
		log$1.error(`Failed to create default library, exit code: ${libraryResult.exitCode}`);
		return libraryResult;
	}
	const libraryPackageName = workspaceInfo.monorepoScope ? `${workspaceInfo.monorepoScope}/utils` : "utils";
	const libraryProjectPath = path.join(fullPath, libraryDir);
	setPackageName(libraryProjectPath, libraryPackageName);
	rewriteMonorepoProject(libraryProjectPath, workspaceInfo.packageManager, void 0, options?.silent ?? false);
	alignMonorepoTypeScriptVersion(fullPath, appProjectPath, libraryProjectPath);
	return {
		exitCode: 0,
		projectDir: templateInfo.targetDir
	};
}
/**
* Keep every scaffolded workspace member on the same TypeScript version.
*
* The app and library come from independently updated remote templates. If
* their TypeScript ranges resolve to different versions, `typescript` — an
* optional peer of vite-plus — resolves differently per member, so package
* managers either create separate vite-plus peer instances (pnpm) or hoist a
* compiler the other workspace member did not ask for (npm/Yarn). The library
* template is the compatibility baseline because its declaration build may
* require a newer compiler, so the app adopts its TypeScript range instead of
* silently downgrading the library. The workspace catalog entry follows the
* same baseline so members that reference `typescript: "catalog:"` (e.g. a
* later `vite:generator` scaffold) stay on the workspace's compiler.
*/
function alignMonorepoTypeScriptVersion(workspaceRootPath, appProjectPath, libraryProjectPath) {
	const typescriptVersion = JSON.parse(fs.readFileSync(path.join(libraryProjectPath, "package.json"), "utf8")).devDependencies?.typescript;
	if (!typescriptVersion) return;
	editJsonFile(path.join(appProjectPath, "package.json"), (pkg) => {
		if (!pkg.devDependencies?.typescript || pkg.devDependencies.typescript === typescriptVersion) return;
		pkg.devDependencies.typescript = typescriptVersion;
		return pkg;
	});
	for (const catalogFile of ["pnpm-workspace.yaml", ".yarnrc.yml"]) {
		const catalogPath = path.join(workspaceRootPath, catalogFile);
		if (!fs.existsSync(catalogPath)) continue;
		const catalogEntry = readYamlFile(catalogPath)?.catalog?.typescript;
		if (catalogEntry === void 0 || catalogEntry === typescriptVersion) continue;
		editYamlFile(catalogPath, (doc) => {
			doc.setIn(["catalog", "typescript"], typescriptVersion);
		});
	}
}
/**
* Drop the aliased `vite` / `vitest` devDeps that `create-vite` leaves on a
* scaffolded sub-package. After migration its scripts already use `vp ...` and
* nothing imports `'vite'` directly, so `vite-plus` provides them transitively.
*
* pnpm is the exception and keeps them: a package needs a DIRECT `vite` edge for
* `vite` to resolve to @voidzero-dev/vite-plus-core there (and for `vp why vite`
* to show it) rather than pnpm auto-installing an upstream Vite to satisfy
* Vitest's peer. Migration points that edge at the workspace catalog, which owns
* the alias; the `vite@*` workspace override covers the transitive and peer
* declarations instead (see `pnpmOverrideKey`). npm, yarn, and bun redirect the
* transitive/peer vite via their root overrides/resolutions regardless of a
* direct dep, so the aliased keys are dead weight and are dropped.
*/
function dropAliasedRuntimeDevDeps(appProjectPath, packageManager) {
	if (packageManager === PackageManager.pnpm) return;
	editJsonFile(path.join(appProjectPath, "package.json"), (pkg) => {
		let changed = false;
		for (const name of ["vite", "vitest"]) if (pkg.devDependencies?.[name]) {
			delete pkg.devDependencies[name];
			changed = true;
		}
		return changed ? pkg : void 0;
	});
}
//#endregion
//#region src/create/bin.ts
const helpMessage = renderCliDoc({
	usage: "vp create [TEMPLATE] [OPTIONS] [-- TEMPLATE_OPTIONS]",
	summary: "Use any builtin, local or remote template with Vite+.",
	documentationUrl: "https://viteplus.dev/guide/create",
	sections: [
		{
			title: "Arguments",
			rows: [{
				label: "TEMPLATE",
				description: [
					`Template name. Run \`${accent("vp create --list")}\` to see available templates.`,
					`- Default: ${accent("vite:monorepo")}, ${accent("vite:application")}, ${accent("vite:library")}, ${accent("vite:generator")}`,
					"- Remote: vite, @tanstack/start, create-next-app,",
					"  create-nuxt, github:user/repo, https://github.com/user/template-repo, etc.",
					"- Local: a `create.templates` entry name from vite.config.ts (monorepo)",
					`- Org scope: ${accent("@your-org")} → picker from ${accent("@your-org/create")}'s ${accent("createConfig.templates")} manifest`,
					`- Org entry: ${accent("@your-org:web")} → manifest entry "web" from ${accent("@your-org/create")}`,
					`When omitted, uses \`create.defaultTemplate\` from vite.config.ts if set.`
				]
			}]
		},
		{
			title: "Options",
			rows: [
				{
					label: "--directory DIR",
					description: "Target directory for the generated project."
				},
				{
					label: "--agent NAME",
					description: "Write coding agent instructions to AGENTS.md, CLAUDE.md, etc."
				},
				{
					label: "--no-agent",
					description: "Skip writing coding agent instructions"
				},
				{
					label: "--editor NAME",
					description: "Write editor config files for the specified editor."
				},
				{
					label: "--no-editor",
					description: "Skip writing editor config files"
				},
				{
					label: "--git",
					description: "Initialize a git repository"
				},
				{
					label: "--no-git",
					description: "Skip git repository initialization"
				},
				{
					label: "--hooks",
					description: "Set up pre-commit hooks (default in non-interactive mode)"
				},
				{
					label: "--no-hooks",
					description: "Skip pre-commit hooks setup"
				},
				{
					label: "--package-manager NAME",
					description: "Use specified package manager (pnpm, npm, yarn, bun)"
				},
				{
					label: "--approve-builds",
					description: "Approve and run gated dependency build scripts without prompting"
				},
				{
					label: "--verbose",
					description: "Show detailed scaffolding output"
				},
				{
					label: "--no-interactive",
					description: "Run in non-interactive mode"
				},
				{
					label: "--list",
					description: "List all available templates"
				},
				{
					label: "-h, --help",
					description: "Show this help message"
				}
			]
		},
		{
			title: "Template Options",
			lines: ["  Any arguments after -- are passed directly to the template."]
		},
		{
			title: "Examples",
			lines: [
				`  ${muted("# Interactive mode")}`,
				`  ${accent("vp create")}`,
				"",
				`  ${muted("# Use existing templates (shorthand expands to create-* packages)")}`,
				`  ${accent("vp create vite")}`,
				`  ${accent("vp create @tanstack/start")}`,
				`  ${accent("vp create svelte")}`,
				`  ${accent("vp create vite -- --template react-ts")}`,
				"",
				`  ${muted("# Full package names also work")}`,
				`  ${accent("vp create create-vite")}`,
				`  ${accent("vp create create-next-app")}`,
				"",
				`  ${muted("# Create Vite+ monorepo, application, library, or generator scaffolds")}`,
				`  ${accent("vp create vite:monorepo")}`,
				`  ${accent("vp create vite:application")}`,
				`  ${accent("vp create vite:library")}`,
				`  ${accent("vp create vite:generator")}`,
				"",
				`  ${muted("# Use templates from GitHub (via degit)")}`,
				`  ${accent("vp create github:user/repo")}`,
				`  ${accent("vp create https://github.com/user/template-repo")}`,
				"",
				`  ${muted("# Pick from an org that publishes @scope/create with createConfig.templates")}`,
				`  ${accent("vp create @your-org")} ${muted("# interactive picker")}`,
				`  ${accent("vp create @your-org:web")} ${muted("# direct manifest-entry selection")}`
			]
		}
	]
});
const listTemplatesMessage = renderCliDoc({
	usage: "vp create --list",
	summary: "List available builtin and popular project templates.",
	documentationUrl: "https://viteplus.dev/guide/create",
	sections: [
		{
			title: "Vite+ Built-in Templates",
			rows: [
				{
					label: "vite:monorepo",
					description: "Create a new monorepo"
				},
				{
					label: "vite:application",
					description: "Create a new application"
				},
				{
					label: "vite:library",
					description: "Create a new library"
				},
				{
					label: "vite:generator",
					description: "Scaffold a new code generator (monorepo only)"
				}
			]
		},
		{
			title: "Popular Templates (shorthand)",
			rows: [
				{
					label: "vite",
					description: "Official Vite templates (create-vite)"
				},
				{
					label: "@tanstack/start",
					description: "TanStack applications (@tanstack/cli create)"
				},
				{
					label: "next-app",
					description: "Next.js application (create-next-app)"
				},
				{
					label: "nuxt",
					description: "Nuxt application (create-nuxt)"
				},
				{
					label: "react-router",
					description: "React Router application (create-react-router)"
				},
				{
					label: "svelte",
					description: "Svelte application (sv create)"
				},
				{
					label: "vue",
					description: "Vue application (create-vue)"
				}
			]
		},
		{
			title: "Examples",
			lines: [
				`  ${accent("vp create")} ${muted("# interactive mode")}`,
				`  ${accent("vp create vite")} ${muted("# shorthand for create-vite")}`,
				`  ${accent("vp create @tanstack/start")} ${muted("# shorthand for @tanstack/cli create")}`,
				`  ${accent("vp create <template> -- <options>")} ${muted("# pass options to the template")}`
			]
		},
		{
			title: "Tip",
			lines: [`  You can use any npm template or git repo with ${accent("vp create")}.`]
		}
	]
});
function normalizeAgentOption(agent) {
	if (!Array.isArray(agent)) return agent;
	if (agent.includes(false)) return false;
	return agent.filter((value) => typeof value === "string");
}
function parseArgs() {
	const args = process.argv.slice(3);
	const separatorIndex = args.indexOf("--");
	const viteArgs = separatorIndex >= 0 ? args.slice(0, separatorIndex) : args;
	const templateArgs = separatorIndex >= 0 ? args.slice(separatorIndex + 1) : [];
	const parsed = lib_default(viteArgs, {
		alias: { h: "help" },
		boolean: [
			"help",
			"list",
			"all",
			"interactive",
			"hooks",
			"verbose",
			"git",
			"approve-builds"
		],
		string: [
			"directory",
			"agent",
			"editor",
			"package-manager"
		],
		default: { interactive: defaultInteractive() }
	});
	return {
		templateName: parsed._[0],
		options: {
			directory: parsed.directory,
			interactive: parsed.interactive,
			list: parsed.list || false,
			help: parsed.help || false,
			verbose: parsed.verbose || false,
			agent: normalizeAgentOption(parsed.agent),
			editor: normalizeEditorOption(parsed.editor),
			git: parsed.git,
			hooks: parsed.hooks,
			packageManager: parsed["package-manager"],
			approveBuilds: parsed["approve-builds"] || false
		},
		templateArgs
	};
}
function describeScaffold(templateName, templateArgs) {
	if (templateName === BuiltinTemplate.monorepo) return "Vite+ monorepo";
	if (templateName === BuiltinTemplate.generator) return "generator scaffold";
	if (templateName === BuiltinTemplate.library) return "TypeScript library";
	const selectedTemplate = getTemplateOption(templateArgs);
	if (selectedTemplate) return formatTemplateName(selectedTemplate);
	if (templateName === BuiltinTemplate.application) return "Vite application";
}
function getTemplateOption(args) {
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--template" || arg === "-t") return args[index + 1];
		if (arg.startsWith("--template=")) return arg.slice(11);
	}
}
function hasExplicitTargetDir(args) {
	return args[0] !== void 0 && !args[0].startsWith("-");
}
function formatTemplateName(templateName) {
	const templateAliases = {
		lit: "Lit",
		preact: "Preact",
		react: "React",
		"react-router": "React Router",
		solid: "Solid",
		svelte: "Svelte",
		vanilla: "Vanilla",
		vue: "Vue"
	};
	const isTypeScript = templateName.endsWith("-ts");
	const baseName = isTypeScript ? templateName.slice(0, -3) : templateName;
	return `${templateAliases[baseName] ?? baseName.split(/[-_]/).map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join(" ")} + ${isTypeScript ? "TypeScript" : "JavaScript"}`;
}
function getNextCommand(projectDir, command) {
	if (!projectDir || projectDir === ".") return command;
	return `cd ${projectDir} && ${command}`;
}
function getCopilotSetupRoot(projectRoot, isExistingMonorepo) {
	if (!isExistingMonorepo) return projectRoot;
	return findGitRoot(projectRoot) ?? projectRoot;
}
function showCreateSummary(options) {
	const { description, installSummary, nextCommand, packageManager, packageManagerVersion, projectDir } = options;
	log(`${styleText("magenta", "◇")} Scaffolded ${accent(projectDir)}${description ? ` with ${description}` : ""}`);
	log(`${styleText("gray", "•")} Node ${process.versions.node}  ${packageManager} ${packageManagerVersion}`);
	if (installSummary?.status === "installed") log(`${styleText("green", "✓")} Dependencies installed in ${formatDuration(installSummary.durationMs)}`);
	log(`${styleText("blue", "→")} Next: ${accent(nextCommand)}`);
}
async function main() {
	const { templateName, options, templateArgs } = parseArgs();
	let compactOutput = !options.verbose;
	if (options.help) {
		printHeader();
		log(helpMessage);
		return;
	}
	if (options.list) {
		await showAvailableTemplates();
		return;
	}
	if (options.interactive) intro(vitePlusHeader());
	let targetDir = "";
	let packageName = "";
	if (options.directory) {
		const formatted = formatTargetDir(options.directory);
		if (formatted.error) {
			log$1.error(formatted.error);
			cancelAndExit("The --directory option is invalid", 1);
		}
		targetDir = formatted.directory;
		packageName = formatted.packageName;
	}
	const cwd = process.cwd();
	const workspaceInfoOptional = await detectWorkspace$1(cwd);
	const isMonorepo = workspaceInfoOptional.isMonorepo;
	if (!isMonorepo) workspaceInfoOptional.rootDir = cwd;
	const cwdRelativeToRoot = isMonorepo && workspaceInfoOptional.rootDir !== cwd ? displayRelative(cwd, workspaceInfoOptional.rootDir) : "";
	const isInSubdirectory = cwdRelativeToRoot !== "";
	const cwdUnderParentDir = isInSubdirectory ? workspaceInfoOptional.parentDirs.some((dir) => cwdRelativeToRoot === dir || cwdRelativeToRoot.startsWith(`${dir}/`)) : true;
	const shouldOfferCwdOption = isInSubdirectory && !cwdUnderParentDir;
	let selectedTemplateName = templateName;
	let selectedTemplateArgs = [...templateArgs];
	let selectedAgentTargetPaths;
	let shouldWriteCopilotSetupWorkflow = false;
	let selectedEditors;
	let selectedParentDir;
	let remoteTargetDir;
	let shouldSetupHooks = false;
	let bundled;
	let skipShorthandExpansion = false;
	let registeredConfigPath;
	const installArgs = process.env.CI ? ["--no-frozen-lockfile"] : void 0;
	let localTemplates = [];
	if (isMonorepo) try {
		const configuredCreate = await getConfiguredCreate(workspaceInfoOptional.rootDir, { throwOnReadError: true });
		localTemplates = configuredCreate.templates;
		if (!selectedTemplateName && configuredCreate.defaultTemplate) selectedTemplateName = configuredCreate.defaultTemplate;
	} catch (error) {
		if (error instanceof CreateConfigSchemaError) cancelAndExit(error.message, 1);
		log$1.warn(`Could not read \`create\` config from the workspace vite.config (${error.message}); local templates are unavailable`);
	}
	else if (!selectedTemplateName) {
		let defaultTemplate;
		try {
			defaultTemplate = await getConfiguredDefaultTemplate(workspaceInfoOptional.rootDir);
		} catch (error) {
			if (error instanceof CreateConfigSchemaError) cancelAndExit(error.message, 1);
			throw error;
		}
		if (defaultTemplate) selectedTemplateName = defaultTemplate;
	}
	let resolvedByOrg = false;
	if (selectedTemplateName) {
		const resolved = await resolveOrgManifestForCreate({
			templateName: selectedTemplateName,
			isMonorepo,
			interactive: options.interactive
		});
		if (resolved.kind === "replaced") {
			selectedTemplateName = resolved.templateName;
			skipShorthandExpansion = true;
			resolvedByOrg = true;
		} else if (resolved.kind === "bundled") {
			bundled = resolved;
			resolvedByOrg = true;
		} else if (resolved.kind === "escape-hatch") selectedTemplateName = "";
	}
	if (!selectedTemplateName && !options.interactive) {
		console.error(`
A template name is required when running in non-interactive mode

Usage: vp create [TEMPLATE] [OPTIONS] [-- TEMPLATE_OPTIONS]

Example:
  ${muted("# Create a new application in non-interactive mode with a custom target directory")}
  vp create vite:application --no-interactive --directory=apps/my-app

Use \`vp create --list\` to list all available templates, or run \`vp create --help\` for more information.
`);
		process.exit(1);
	}
	if (!selectedTemplateName) {
		const template = await select({
			message: "",
			options: getInitialTemplateOptions(isMonorepo, localTemplates)
		});
		if (isCancel(template)) cancelAndExit();
		selectedTemplateName = template;
	}
	const matchedLocalTemplate = resolvedByOrg ? void 0 : localTemplates.find((entry) => entry.name === selectedTemplateName);
	if (matchedLocalTemplate) {
		selectedTemplateName = matchedLocalTemplate.template;
		skipShorthandExpansion = true;
	}
	const isLocalTemplate = matchedLocalTemplate !== void 0;
	const isBuiltinTemplate = selectedTemplateName.startsWith("vite:");
	const isBundledTemplate = bundled !== void 0;
	const isBundledMonorepo = bundled?.monorepo === true;
	const isDirectScaffoldTemplate = isBuiltinTemplate || isBundledTemplate;
	if (!isDirectScaffoldTemplate) compactOutput = false;
	if (targetDir && !isDirectScaffoldTemplate) cancelAndExit("The --directory option is only available for builtin and bundled @org templates", 1);
	if (selectedTemplateName === BuiltinTemplate.monorepo && isMonorepo) {
		log$1.info("You are already in a monorepo workspace.\nUse a different template or run this command outside the monorepo");
		cancelAndExit("Cannot create a monorepo inside an existing monorepo", 1);
	}
	if (selectedTemplateName === BuiltinTemplate.generator && !isMonorepo) {
		log$1.info("The vite:generator template requires a monorepo workspace.\nRun this command inside a Vite+ monorepo, or create one first with `vp create vite:monorepo`");
		cancelAndExit("Cannot create a generator outside a monorepo", 1);
	}
	if (isMonorepo && options.git !== void 0) cancelAndExit("The --git/--no-git options are not available when adding a package to an existing monorepo", 1);
	if (isInSubdirectory && !compactOutput) log$1.info(`Detected monorepo root at ${accent(workspaceInfoOptional.rootDir)}`);
	if (isMonorepo && options.interactive && !targetDir) {
		let parentDir;
		if (workspaceInfoOptional.parentDirs.length > 0 || isInSubdirectory) {
			const dirOptions = workspaceInfoOptional.parentDirs.map((dir) => ({
				label: `${dir}/`,
				value: dir,
				hint: ""
			}));
			if (shouldOfferCwdOption) dirOptions.push({
				label: `${cwdRelativeToRoot}/ (current directory)`,
				value: cwdRelativeToRoot,
				hint: ""
			});
			dirOptions.push({
				label: "other directory",
				value: "other",
				hint: "Enter a custom target directory"
			});
			const defaultParentDir = shouldOfferCwdOption ? cwdRelativeToRoot : inferParentDir(selectedTemplateName, workspaceInfoOptional, isLocalTemplate) ?? workspaceInfoOptional.parentDirs[0];
			const selected = await select({
				message: "Where should the new package be added to the monorepo:",
				options: dirOptions,
				initialValue: defaultParentDir
			});
			if (isCancel(selected)) cancelAndExit();
			if (selected !== "other") parentDir = selected;
		}
		if (!parentDir) {
			const customTargetDir = await text({
				message: "Where should the new package be added to the monorepo:",
				placeholder: "e.g., packages/",
				validate: (value) => {
					return value ? formatTargetDir(value).error : "Target directory is required";
				}
			});
			if (isCancel(customTargetDir)) cancelAndExit();
			parentDir = customTargetDir;
		}
		selectedParentDir = parentDir;
	}
	if (isMonorepo && !options.interactive && !targetDir) {
		if (isInSubdirectory && !compactOutput) log$1.info(`Use ${accent("--directory")} to specify a different target location.`);
		selectedParentDir = inferParentDir(selectedTemplateName, workspaceInfoOptional, isLocalTemplate) ?? workspaceInfoOptional.parentDirs[0];
	}
	if (isGitHubUrl(selectedTemplateName)) {
		if (hasExplicitTargetDir(selectedTemplateArgs)) remoteTargetDir = selectedTemplateArgs[0];
		else {
			const inferredTargetDir = inferGitHubRepoName(selectedTemplateName) ?? "template";
			const remoteTargetBaseDir = selectedParentDir ? path.join(workspaceInfoOptional.rootDir, selectedParentDir) : workspaceInfoOptional.rootDir;
			const defaultTargetDir = suggestAvailableTargetDir(inferredTargetDir, remoteTargetBaseDir);
			if (defaultTargetDir !== inferredTargetDir && options.interactive) log$1.info(`  Target directory "${inferredTargetDir}" already exists. Suggested: ${accent(defaultTargetDir)}`);
			remoteTargetDir = await promptTargetDir(defaultTargetDir, options.interactive, { cwd: remoteTargetBaseDir });
			selectedTemplateArgs = [remoteTargetDir, ...selectedTemplateArgs];
		}
	}
	const directScaffoldFallbackName = bundled ? `vite-plus-${bundled.entryName}` : selectedTemplateName === BuiltinTemplate.monorepo ? "vite-plus-monorepo" : `vite-plus-${selectedTemplateName.split(":")[1]}`;
	if (isDirectScaffoldTemplate && (!targetDir || targetDir === ".")) {
		if (targetDir === ".") {
			packageName = deriveDefaultPackageName(cwd, workspaceInfoOptional.monorepoScope, directScaffoldFallbackName);
			if (isMonorepo) {
				if (!cwdRelativeToRoot) cancelAndExit("Cannot scaffold into the monorepo root directory. Use --directory to specify a target directory", 1);
				const enclosingPackage = workspaceInfoOptional.packages.find((pkg) => cwdRelativeToRoot === pkg.path || cwdRelativeToRoot.startsWith(`${pkg.path}/`));
				if (enclosingPackage) cancelAndExit(`Cannot scaffold inside existing package "${enclosingPackage.name}" (${enclosingPackage.path}). Use --directory to specify a different location`, 1);
				targetDir = cwdRelativeToRoot;
			}
			log$1.info(`Using package name: ${accent(packageName)}`);
		} else if (selectedTemplateName === BuiltinTemplate.monorepo) {
			const selected = await promptPackageNameAndTargetDir(getRandomProjectName({ fallbackName: "vite-plus-monorepo" }), options.interactive);
			packageName = selected.packageName;
			targetDir = selected.targetDir;
		} else {
			const selected = await promptPackageNameAndTargetDir(getRandomProjectName({
				scope: workspaceInfoOptional.monorepoScope,
				fallbackName: directScaffoldFallbackName
			}), options.interactive);
			packageName = selected.packageName;
			targetDir = selectedParentDir ? path.join(selectedParentDir, selected.targetDir).split(path.sep).join("/") : selected.targetDir;
		}
	}
	if (options.packageManager && !Object.values(PackageManager).includes(options.packageManager)) {
		const valid = Object.values(PackageManager).join(", ");
		log$1.error(`Invalid package manager: ${options.packageManager}. Must be one of: ${valid}`);
		cancelAndExit("Invalid --package-manager value", 1);
	}
	const requestedPackageManager = options.packageManager;
	const detectedPackageManager = workspaceInfoOptional.packageManager;
	const packageManager = (isMonorepo ? detectedPackageManager ?? requestedPackageManager : requestedPackageManager ?? detectedPackageManager) ?? await selectPackageManager(options.interactive, compactOutput);
	const packageManagerVersion = packageManager === detectedPackageManager ? workspaceInfoOptional.packageManagerVersion : "latest";
	const shouldSilencePackageManagerInstallLog = compactOutput || isMonorepo && workspaceInfoOptional.packageManager !== void 0;
	const downloadResult = await downloadPackageManager$1(packageManager, packageManagerVersion, options.interactive, shouldSilencePackageManagerInstallLog);
	const workspaceInfo = {
		...workspaceInfoOptional,
		packageManager,
		downloadPackageManager: downloadResult
	};
	const existingAgentTargetPaths = options.agent !== void 0 || !options.interactive ? void 0 : detectExistingAgentTargetPaths(workspaceInfoOptional.rootDir);
	if (existingAgentTargetPaths !== void 0) selectedAgentTargetPaths = existingAgentTargetPaths;
	else {
		const agentSelection = await selectAgentTargets({
			interactive: options.interactive,
			agent: options.agent,
			onCancel: () => cancelAndExit()
		});
		selectedAgentTargetPaths = agentSelection.targetPaths;
		shouldWriteCopilotSetupWorkflow = agentSelection.selectedAgents.some((agent) => agent.id === COPILOT_AGENT_ID);
	}
	const shouldConfigureEditors = shouldConfigureEditorsForCreate({
		editor: options.editor,
		isMonorepo
	});
	if (shouldConfigureEditors) selectedEditors = (options.editor || !options.interactive ? void 0 : detectExistingEditors(workspaceInfoOptional.rootDir)) ?? await selectEditors({
		interactive: options.interactive,
		editor: options.editor,
		onCancel: () => cancelAndExit()
	});
	const shouldSetupGit = await resolveGitInit(options, isMonorepo);
	if (!isMonorepo && (!options.interactive || shouldSetupGit || options.hooks === true)) shouldSetupHooks = await promptGitHooks(options);
	const createProgress = options.interactive && compactOutput ? spinner({ indicator: "timer" }) : void 0;
	let createProgressStarted = false;
	let createProgressMessage = "Scaffolding project";
	const updateCreateProgress = (message) => {
		createProgressMessage = message;
		if (!createProgress) return;
		if (createProgressStarted) {
			createProgress.message(message);
			return;
		}
		createProgress.start(message);
		createProgressStarted = true;
	};
	const clearCreateProgress = () => {
		if (createProgress && createProgressStarted) {
			createProgress.clear();
			createProgressStarted = false;
		}
	};
	const failCreateProgress = (message) => {
		if (createProgress && createProgressStarted) {
			createProgress.error(message);
			createProgressStarted = false;
		}
	};
	const pauseCreateProgress = () => {
		if (createProgress && createProgressStarted) {
			createProgress.pause();
			createProgressStarted = false;
		}
	};
	const resumeCreateProgress = () => {
		if (createProgress && !createProgressStarted) {
			createProgress.resume(createProgressMessage);
			createProgressStarted = true;
		}
	};
	let migratePendingBuilds = [];
	const handleIgnoredBuilds = async (projectPath, installCwd, summary) => {
		if (summary?.status !== "installed") return;
		const reportedBuilds = [.../* @__PURE__ */ new Set([...summary.pendingBuilds ?? [], ...migratePendingBuilds])];
		const pendingBuilds = await detectGatedBuilds(installCwd, workspaceInfo.packageManager, reportedBuilds);
		const targets = resolveApproveBuildTargets(projectPath, pendingBuilds, workspaceInfo.packageManager);
		if (targets.length === 0) return;
		pauseCreateProgress();
		const approved = await approveBuilds({
			cwd: installCwd,
			projectDir: projectPath,
			packageManager: workspaceInfo.packageManager,
			packageManagerVersion: workspaceInfo.downloadPackageManager.version,
			targets,
			interactive: options.interactive,
			autoApprove: options.approveBuilds === true,
			silent: compactOutput
		});
		resumeCreateProgress();
		if (!approved && !options.interactive && options.approveBuilds === true) process.exitCode = 1;
	};
	updateCreateProgress("Scaffolding project");
	const templateInfo = discoverTemplate(selectedTemplateName, selectedTemplateArgs, workspaceInfo, options.interactive, bundled?.bundledLocalPath, skipShorthandExpansion, isLocalTemplate);
	if (selectedParentDir) templateInfo.parentDir = selectedParentDir;
	if (targetDir) templateInfo.parentDir = void 0;
	if (remoteTargetDir) {
		const projectDir = templateInfo.parentDir ? path.join(templateInfo.parentDir, remoteTargetDir) : remoteTargetDir;
		pauseCreateProgress();
		await checkProjectDirExists(path.join(workspaceInfo.rootDir, projectDir), options.interactive);
		resumeCreateProgress();
	}
	if (templateInfo.command === BuiltinTemplate.monorepo || isBundledMonorepo) {
		updateCreateProgress("Creating monorepo");
		await checkProjectDirExists(path.join(workspaceInfo.rootDir, targetDir), options.interactive);
		const result = isBundledMonorepo ? await executeBundledTemplate(workspaceInfo, {
			...templateInfo,
			packageName,
			targetDir
		}) : await executeMonorepoTemplate(workspaceInfo, {
			...templateInfo,
			packageName,
			targetDir
		}, { silent: compactOutput });
		const { projectDir } = result;
		if (result.exitCode !== 0 || !projectDir) {
			failCreateProgress("Scaffolding failed");
			cancelAndExit(`Failed to create monorepo, exit code: ${result.exitCode}`, result.exitCode);
		}
		const fullPath = path.join(workspaceInfo.rootDir, projectDir);
		const scaffoldedWorkspace = await detectWorkspace$1(fullPath);
		workspaceInfo.isMonorepo = true;
		workspaceInfo.workspacePatterns = scaffoldedWorkspace.workspacePatterns;
		workspaceInfo.parentDirs = scaffoldedWorkspace.parentDirs;
		workspaceInfo.packages = scaffoldedWorkspace.packages;
		if (shouldSetupGit) {
			updateCreateProgress("Initializing git repository");
			if (await initGitRepository(fullPath)) ensureDefaultGitignoreEntries(fullPath);
		}
		updateCreateProgress("Writing agent instructions");
		pauseCreateProgress();
		await writeAgentInstructions({
			projectRoot: fullPath,
			targetPaths: selectedAgentTargetPaths,
			interactive: options.interactive,
			silent: compactOutput
		});
		if (shouldWriteCopilotSetupWorkflow) await writeCopilotSetupWorkflow({
			projectRoot: fullPath,
			silent: compactOutput
		});
		resumeCreateProgress();
		updateCreateProgress("Writing editor configs");
		pauseCreateProgress();
		await writeEditorConfigs({
			projectRoot: fullPath,
			editorId: selectedEditors,
			interactive: options.interactive,
			silent: compactOutput,
			extraVsCodeSettings: { "npm.scriptRunner": "vp" },
			packageManager
		});
		if (selectedEditors?.includes("vscode")) ensureGitignoreVsCodeEditorConfigs(fullPath);
		resumeCreateProgress();
		workspaceInfo.rootDir = fullPath;
		updateCreateProgress("Integrating monorepo");
		const skipStagedMigration = shouldSkipStagedMigrationForHooks(fullPath, shouldSetupHooks, workspaceInfo.packageManager, workspaceInfo.packages);
		rewriteMonorepo(workspaceInfo, skipStagedMigration, compactOutput);
		if (bundled?.monorepo) injectCreateDefaultTemplate(fullPath, bundled.scope, compactOutput);
		if (shouldSetupHooks) installGitHooks(fullPath, compactOutput, void 0, workspaceInfo.packageManager, workspaceInfo.packages);
		updateCreateProgress("Installing dependencies");
		const installSummary = await runViteInstall(fullPath, options.interactive, installArgs, {
			silent: compactOutput,
			packageManager: workspaceInfo.packageManager,
			packageManagerVersion: workspaceInfo.downloadPackageManager.version,
			detectIgnoredBuilds: true
		});
		await handleIgnoredBuilds(fullPath, fullPath, installSummary);
		updateCreateProgress("Formatting code");
		await runViteFmt(fullPath, options.interactive, void 0, { silent: compactOutput });
		clearCreateProgress();
		showCreateSummary({
			description: describeScaffold(selectedTemplateName, selectedTemplateArgs),
			installSummary,
			nextCommand: getNextCommand(projectDir, "vp run"),
			packageManager: workspaceInfo.packageManager,
			packageManagerVersion: workspaceInfo.downloadPackageManager.version,
			projectDir
		});
		return;
	}
	let result;
	if (templateInfo.type === TemplateType.bundled) {
		pauseCreateProgress();
		await checkProjectDirExists(path.join(workspaceInfo.rootDir, targetDir), options.interactive);
		resumeCreateProgress();
		updateCreateProgress("Copying template files");
		result = await executeBundledTemplate(workspaceInfo, {
			...templateInfo,
			packageName,
			targetDir
		});
	} else if (templateInfo.type === TemplateType.builtin) {
		if (!targetDir) {
			const selected = await promptPackageNameAndTargetDir(getRandomProjectName({
				scope: workspaceInfo.monorepoScope,
				fallbackName: `vite-plus-${templateInfo.command.split(":")[1]}`
			}), options.interactive);
			packageName = selected.packageName;
			targetDir = templateInfo.parentDir ? path.join(templateInfo.parentDir, selected.targetDir).split(path.sep).join("/") : selected.targetDir;
		}
		pauseCreateProgress();
		await checkProjectDirExists(path.join(workspaceInfo.rootDir, targetDir), options.interactive);
		resumeCreateProgress();
		updateCreateProgress("Generating project");
		result = await executeBuiltinTemplate(workspaceInfo, {
			...templateInfo,
			packageName,
			targetDir
		}, { silent: compactOutput });
	} else {
		updateCreateProgress("Generating project");
		result = await executeRemoteTemplate(workspaceInfo, templateInfo, { silent: compactOutput });
	}
	if (result.exitCode !== 0) {
		failCreateProgress("Scaffolding failed");
		process.exit(result.exitCode);
	}
	const projectDir = result.projectDir;
	if (!projectDir) {
		clearCreateProgress();
		process.exit(0);
	}
	const fullPath = path.join(workspaceInfo.rootDir, projectDir);
	if (selectedTemplateName === BuiltinTemplate.generator && isMonorepo) {
		updateCreateProgress("Registering generator");
		pauseCreateProgress();
		const generatorTemplatePath = `./${projectDir.split(path.sep).join("/")}`;
		let generatorName = packageName;
		try {
			const generatorPkg = readJsonFile(path.join(fullPath, "package.json"));
			generatorName = generatorPkg.name ?? packageName;
			if (generatorName) registeredConfigPath = await registerLocalTemplate(workspaceInfo.rootDir, {
				name: generatorName,
				description: generatorPkg.description || `Run the ${generatorName} generator`,
				template: generatorTemplatePath
			}, compactOutput);
		} catch (error) {
			log$1.warn(`Could not register the generator in create.templates (${error.message}).\nAdd it by hand: { name: '${generatorName || path.basename(projectDir)}', template: '${generatorTemplatePath}' }`);
		}
		resumeCreateProgress();
	}
	const agentInstructionsRoot = isMonorepo ? workspaceInfo.rootDir : fullPath;
	updateCreateProgress("Writing agent instructions");
	pauseCreateProgress();
	await writeAgentInstructions({
		projectRoot: agentInstructionsRoot,
		targetPaths: selectedAgentTargetPaths,
		interactive: options.interactive,
		silent: compactOutput
	});
	if (shouldWriteCopilotSetupWorkflow) await writeCopilotSetupWorkflow({
		projectRoot: getCopilotSetupRoot(agentInstructionsRoot, isMonorepo),
		silent: compactOutput
	});
	resumeCreateProgress();
	if (shouldConfigureEditors) {
		updateCreateProgress("Writing editor configs");
		pauseCreateProgress();
		await writeEditorConfigs({
			projectRoot: fullPath,
			editorId: selectedEditors,
			interactive: options.interactive,
			silent: compactOutput,
			extraVsCodeSettings: { "npm.scriptRunner": "vp" },
			packageManager
		});
		if (selectedEditors?.includes("vscode")) ensureGitignoreVsCodeEditorConfigs(fullPath);
		resumeCreateProgress();
	}
	const shouldMigrateLintFmtTools = detectEslintProject(fullPath).hasDependency || detectPrettierProject(fullPath).hasDependency || detectTsupProject(fullPath).hasDependency;
	let installSummary;
	const installAndMigrate = async (installCwd) => {
		setPackageManager(fullPath, workspaceInfo.downloadPackageManager);
		if (workspaceInfo.packageManager === PackageManager.yarn) {
			const yarnrcPath = path.join(fullPath, ".yarnrc.yml");
			if (!fs.existsSync(yarnrcPath)) fs.writeFileSync(yarnrcPath, "nodeLinker: node-modules\n");
		}
		updateCreateProgress("Installing dependencies");
		installSummary = await runViteInstall(installCwd, options.interactive, installArgs, {
			silent: compactOutput,
			packageManager: workspaceInfo.packageManager,
			packageManagerVersion: workspaceInfo.downloadPackageManager.version,
			detectIgnoredBuilds: true
		});
		if (installSummary.status !== "installed") return;
		if (installSummary.pendingBuilds && installSummary.pendingBuilds.length > 0) migratePendingBuilds = installSummary.pendingBuilds;
		updateCreateProgress("Migrating lint, format & pack tools");
		pauseCreateProgress();
		await promptEslintMigration(fullPath, false);
		await promptPrettierMigration(fullPath, false);
		await promptTsupMigration(fullPath, false, packageManager);
		resumeCreateProgress();
	};
	if (isMonorepo) {
		if (!compactOutput) log$1.step("Monorepo integration...");
		if (workspaceInfo.packages.length > 0) {
			if (options.interactive) {
				pauseCreateProgress();
				const selectedDepTypeOptions = await multiselect({
					message: `Add workspace dependencies to ${accent(projectDir)}?`,
					options: [
						{ value: DependencyType.dependencies },
						{ value: DependencyType.devDependencies },
						{ value: DependencyType.peerDependencies },
						{ value: DependencyType.optionalDependencies }
					],
					required: false
				});
				let selectedDepTypes = [];
				if (!isCancel(selectedDepTypeOptions)) selectedDepTypes = selectedDepTypeOptions;
				for (const selectedDepType of selectedDepTypes) {
					const selected = await multiselect({
						message: `Which packages should be added as ${selectedDepType} to ${success(projectDir)}?`,
						options: workspaceInfo.packages.map((pkg) => ({
							value: pkg.name,
							label: pkg.path
						})),
						required: false
					});
					let selectedDeps = [];
					if (!isCancel(selected)) selectedDeps = selected;
					if (selectedDeps.length > 0) updatePackageJsonWithDeps(workspaceInfo.rootDir, projectDir, selectedDeps, selectedDepType);
				}
				resumeCreateProgress();
			}
		}
		updateWorkspaceConfig(projectDir, workspaceInfo);
		if (shouldMigrateLintFmtTools) await installAndMigrate(workspaceInfo.rootDir);
		updateCreateProgress("Integrating into monorepo");
		const skipStagedMigration = shouldSkipStagedMigrationForHooks(fullPath, shouldSetupHooks, workspaceInfo.packageManager);
		rewriteMonorepoProject(fullPath, workspaceInfo.packageManager, skipStagedMigration, compactOutput);
		for (const framework of detectFramework(fullPath)) if (!hasFrameworkShim(fullPath, framework)) addFrameworkShim(fullPath, framework);
		updateCreateProgress("Installing dependencies");
		installSummary = await runViteInstall(workspaceInfo.rootDir, options.interactive, installArgs, {
			silent: compactOutput,
			packageManager: workspaceInfo.packageManager,
			packageManagerVersion: workspaceInfo.downloadPackageManager.version,
			detectIgnoredBuilds: true
		});
		await handleIgnoredBuilds(fullPath, workspaceInfo.rootDir, installSummary);
		updateCreateProgress("Formatting code");
		const fmtPaths = registeredConfigPath ? [projectDir, path.relative(workspaceInfo.rootDir, registeredConfigPath)] : [projectDir];
		await runViteFmt(workspaceInfo.rootDir, options.interactive, fmtPaths, { silent: compactOutput });
	} else {
		if (shouldSetupGit) {
			updateCreateProgress("Initializing git repository");
			if (await initGitRepository(fullPath)) ensureDefaultGitignoreEntries(fullPath);
		}
		if (shouldMigrateLintFmtTools) await installAndMigrate(fullPath);
		updateCreateProgress("Applying Vite+ project setup");
		const skipStagedMigration = shouldSkipStagedMigrationForHooks(fullPath, shouldSetupHooks, workspaceInfo.packageManager);
		rewriteStandaloneProject(fullPath, workspaceInfo, skipStagedMigration, compactOutput);
		for (const framework of detectFramework(fullPath)) if (!hasFrameworkShim(fullPath, framework)) addFrameworkShim(fullPath, framework);
		if (shouldSetupHooks) installGitHooks(fullPath, compactOutput, void 0, workspaceInfo.packageManager);
		updateCreateProgress("Installing dependencies");
		installSummary = await runViteInstall(fullPath, options.interactive, installArgs, {
			silent: compactOutput,
			packageManager: workspaceInfo.packageManager,
			packageManagerVersion: workspaceInfo.downloadPackageManager.version,
			detectIgnoredBuilds: true
		});
		await handleIgnoredBuilds(fullPath, fullPath, installSummary);
		updateCreateProgress("Formatting code");
		await runViteFmt(fullPath, options.interactive, void 0, { silent: compactOutput });
	}
	clearCreateProgress();
	showCreateSummary({
		description: describeScaffold(selectedTemplateName, selectedTemplateArgs),
		installSummary,
		nextCommand: getNextCommand(projectDir, "vp run"),
		packageManager: workspaceInfo.packageManager,
		packageManagerVersion: workspaceInfo.downloadPackageManager.version,
		projectDir
	});
}
async function showAvailableTemplates() {
	printHeader();
	log(listTemplatesMessage);
}
main().catch((err) => {
	log$1.error(err.message);
	console.error(err);
	cancelAndExit(`Failed to generate code: ${err.message}`, 1);
});
//#endregion
export {};
