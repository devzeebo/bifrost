import { n as x, r as createDebug } from "./main-Bcv7jU2b.js";
import { O as fsExists, c as isGreaterOrEqual, f as tryParse, k as fsRemove, l as normalize$1, n as NODE_SEA_MIN_VERSION_PARSED, t as NODE_SEA_MIN_VERSION } from "./target-Bab3CUeB-8PBzMh3p.js";
import "./internal-DSmmwu4u.js";
import process from "node:process";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createReadStream, createWriteStream } from "node:fs";
import { chmod, mkdir, rename } from "node:fs/promises";
import os from "node:os";
import { createHash } from "node:crypto";
//#region ../../node_modules/.pnpm/@tsdown+exe@0.22.14_tsdown@0.22.14/node_modules/@tsdown/exe/dist/index.mjs
function getCacheDir() {
	const home = os.homedir();
	if (process.platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData/Local");
		return path.join(localAppData, "tsdown/Caches");
	}
	if (process.platform === "darwin") return path.join(home, "Library/Caches/tsdown");
	const xdgCache = process.env.XDG_CACHE_HOME || path.join(home, ".cache");
	return path.join(xdgCache, "tsdown");
}
function getCachedBinaryPath(target) {
	const cacheDir = getCacheDir();
	const binName = target.platform === "win" ? "node.exe" : "node";
	return path.join(cacheDir, "node", `v${target.nodeVersion}`, `${target.platform}-${target.arch}`, binName);
}
function getArchiveExtension(platform) {
	if (platform === "win") return "zip";
	if (platform === "linux") return "tar.xz";
	return "tar.gz";
}
function getDownloadUrl(target) {
	const { platform, arch, nodeVersion } = target;
	return `https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-${platform}-${arch}.${getArchiveExtension(platform)}`;
}
function getBinaryPathInArchive(target) {
	const { platform, arch, nodeVersion } = target;
	const dirName = `node-v${nodeVersion}-${platform}-${arch}`;
	if (platform === "win") return `${dirName}/node.exe`;
	return `${dirName}/bin/node`;
}
async function resolveNodeVersion(nodeVersion, nodeDistIndexUrl = "https://nodejs.org/dist/index.json") {
	if (nodeVersion === "latest" || nodeVersion === "latest-lts") {
		const response = await fetch(nodeDistIndexUrl);
		if (!response.ok) throw new Error(`Failed to fetch Node.js releases: HTTP ${response.status} from ${nodeDistIndexUrl}`);
		const releases = await response.json();
		const release = nodeVersion === "latest" ? releases[0] : releases.find((r) => r.lts !== false);
		if (!release) throw new Error(`No matching Node.js release found for "${nodeVersion}".`);
		nodeVersion = release.version.replace(/^v/, "");
	}
	const version = tryParse(nodeVersion);
	if (!version) throw new Error(`Invalid Node.js version: ${nodeVersion}. Please provide a valid version string (e.g., "25.7.0").`);
	if (!isGreaterOrEqual(version, NODE_SEA_MIN_VERSION_PARSED)) throw new Error(`Node.js ${version} does not support SEA (Single Executable Applications). Required minimum version is ${NODE_SEA_MIN_VERSION}. Please update the nodeVersion in your target configuration.`);
	return normalize$1(version);
}
function getTargetSuffix(target) {
	return `-${target.platform}-${target.arch}`;
}
const debug = createDebug("tsdown:exe:download");
const shasumsManifestCache = /* @__PURE__ */ new Map();
async function resolveNodeBinary(target, options, logger) {
	debug("Resolving Node.js binary for target: %O", target);
	target.nodeVersion = await resolveNodeVersion(target.nodeVersion, options.nodeDistIndexUrl);
	const cachedPath = getCachedBinaryPath(target);
	debug("Cache path: %s", cachedPath);
	if (await fsExists(cachedPath)) {
		debug("Cache hit: %s", cachedPath);
		logger?.info(`Using cached Node.js ${target.nodeVersion} for ${target.platform}-${target.arch}`);
		return cachedPath;
	}
	const url = await (options.getDownloadUrl ?? getDownloadUrl)(target);
	debug("Cache miss, downloading from: %s", url);
	logger?.info(`Downloading Node.js ${target.nodeVersion} for ${target.platform}-${target.arch}...`);
	logger?.info(`  ${url}`);
	await mkdir(path.dirname(cachedPath), { recursive: true });
	const archivePath = `${cachedPath}.download.${getArchiveExtension(target.platform)}`;
	await downloadArchive(url, archivePath, target.nodeVersion);
	try {
		await extractBinary(archivePath, cachedPath, target);
		if (target.platform !== "win") await chmod(cachedPath, 493);
		debug("Binary cached at: %s", cachedPath);
		logger?.info(`Cached Node.js binary at: ${cachedPath}`);
	} finally {
		await fsRemove(archivePath);
	}
	return cachedPath;
}
async function downloadArchive(url, archivePath, nodeVersion) {
	const expectedChecksum = await getExpectedArchiveChecksum(nodeVersion, path.posix.basename(new URL(url).pathname));
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to download Node.js binary: HTTP ${response.status} from ${url}`);
	if (!response.body) throw new Error(`Failed to download Node.js binary: empty response from ${url}`);
	const tempArchivePath = `${archivePath}.tmp-${process.pid}-${Date.now()}`;
	try {
		await pipeline(Readable.fromWeb(response.body), createWriteStream(tempArchivePath));
		await verifyArchiveChecksum(tempArchivePath, expectedChecksum);
		await rename(tempArchivePath, archivePath);
	} catch (error) {
		await fsRemove(tempArchivePath);
		throw error;
	}
}
async function getExpectedArchiveChecksum(nodeVersion, archiveName) {
	const checksum = (await getShasumsManifest(nodeVersion)).get(archiveName);
	if (!checksum) throw new Error(`Failed to find checksum for Node.js archive "${archiveName}" in SHASUMS256.txt.`);
	return checksum;
}
async function getShasumsManifest(nodeVersion) {
	const cachedManifest = shasumsManifestCache.get(nodeVersion);
	if (cachedManifest) return cachedManifest;
	const manifest = (async () => {
		const url = `https://nodejs.org/dist/v${nodeVersion}/SHASUMS256.txt`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to download Node.js checksums: HTTP ${response.status} from ${url}`);
		const checksums = /* @__PURE__ */ new Map();
		const text = await response.text();
		for (const line of text.split(/\r?\n/)) {
			const trimmedLine = line.trim();
			if (!trimmedLine) continue;
			const separatorIndex = trimmedLine.search(/\s/);
			if (separatorIndex === -1) continue;
			const checksum = trimmedLine.slice(0, separatorIndex);
			if (!/^[a-f0-9]{64}$/i.test(checksum)) continue;
			const archiveName = trimmedLine.slice(separatorIndex).trimStart().replace(/^\*/, "");
			if (!archiveName) continue;
			checksums.set(archiveName, checksum.toLowerCase());
		}
		return checksums;
	})();
	shasumsManifestCache.set(nodeVersion, manifest);
	try {
		return await manifest;
	} catch (error) {
		shasumsManifestCache.delete(nodeVersion);
		throw error;
	}
}
async function verifyArchiveChecksum(archivePath, expectedChecksum) {
	const hash = createHash("sha256");
	const stream = createReadStream(archivePath);
	for await (const chunk of stream) hash.update(chunk);
	const actualChecksum = hash.digest("hex");
	if (actualChecksum !== expectedChecksum) throw new Error(`Checksum mismatch for Node.js archive "${archivePath}": expected ${expectedChecksum}, received ${actualChecksum}.`);
}
async function extractBinary(archivePath, targetBinaryPath, target) {
	const binaryInArchive = getBinaryPathInArchive(target);
	const outDir = path.dirname(targetBinaryPath);
	debug("Extracting %s from archive to %s", binaryInArchive, outDir);
	const { command, args } = getExtractCommand(archivePath, outDir, binaryInArchive, target);
	try {
		await x(command, args, {
			nodeOptions: { stdio: "inherit" },
			throwOnError: true,
			nodePath: false
		});
	} catch (error) {
		throw new Error(`Failed to extract Node.js archive with \`${command}\`. Please ensure \`${command}\` is installed and available in PATH.`, { cause: error });
	}
	const extractedName = target.platform === "win" ? "node.exe" : "node";
	const extractedPath = path.join(outDir, extractedName);
	if (extractedPath !== targetBinaryPath) await rename(extractedPath, targetBinaryPath);
}
function getExtractCommand(archivePath, outDir, binaryInArchive, target, hostPlatform = process.platform) {
	if (target.platform === "win") {
		if (hostPlatform === "win32") return {
			command: "tar",
			args: [
				"-xf",
				archivePath,
				"-C",
				outDir,
				"--strip-components=1",
				binaryInArchive
			]
		};
		return {
			command: "unzip",
			args: [
				"-j",
				"-o",
				archivePath,
				binaryInArchive,
				"-d",
				outDir
			]
		};
	}
	return {
		command: "tar",
		args: [
			`-x${archivePath.endsWith(".tar.xz") ? "J" : "z"}f`,
			archivePath,
			"-C",
			outDir,
			"--strip-components=2",
			binaryInArchive
		]
	};
}
//#endregion
export { getCacheDir, getCachedBinaryPath, getTargetSuffix, resolveNodeBinary };
