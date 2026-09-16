import { C as resolveComma, E as toArray, l as bold, n as x, p as red, r as createDebug, u as dim, y as importWithError } from "./main-Bcv7jU2b.js";
import process from "node:process";
import path from "node:path";
import { RUNTIME_MODULE_ID } from "@voidzero-dev/vite-plus-core/rolldown";
import { access, cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { exactRegex } from "@voidzero-dev/vite-plus-core/rolldown/filter";
import { tmpdir } from "node:os";
//#region ../../node_modules/.pnpm/tsdown@0.22.14_@arethetypeswrong+core@0.18.2_@tsdown+css@0.22.14_@tsdown+exe@0.22.14_@t_4084c24f9f44f250d2b604ebc16f10f3/node_modules/tsdown/dist/format-DLxyxnif.mjs
function fsExists(path) {
	return access(path).then(() => true, () => false);
}
function fsStat(path) {
	return stat(path).catch(() => null);
}
function fsRemove(path) {
	return rm(path, {
		force: true,
		recursive: true
	}).catch(() => {});
}
function fsCopy(from, to) {
	return cp(from, to, {
		recursive: true,
		force: true
	});
}
function lowestCommonAncestor(...filepaths) {
	if (filepaths.length === 0) return "";
	if (filepaths.length === 1) return path.dirname(filepaths[0]);
	filepaths = filepaths.map(path.normalize);
	const [first, ...rest] = filepaths;
	let ancestor = first.split(path.sep);
	for (const filepath of rest) {
		const directories = filepath.split(path.sep, ancestor.length);
		let index = 0;
		for (const directory of directories) if (directory === ancestor[index]) index += 1;
		else {
			ancestor = ancestor.slice(0, index);
			break;
		}
		ancestor = ancestor.slice(0, index);
	}
	return ancestor.length <= 1 && ancestor[0] === "" ? path.sep + ancestor[0] : ancestor.join(path.sep);
}
function stripExtname(filePath) {
	const ext = path.extname(filePath);
	if (!ext.length) return filePath;
	return filePath.slice(0, -ext.length);
}
function formatBytes(bytes) {
	if (bytes === Infinity) return void 0;
	if (bytes > 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
	return `${(bytes / 1e3).toFixed(2)} kB`;
}
//#endregion
//#region ../../node_modules/.pnpm/rolldown-plugin-dts@0.27.13_@typescript+native-preview@7.0.0-dev.20260605.1_oxc-resolve_19173df252fb1b72b750fe1e656588b8/node_modules/rolldown-plugin-dts/dist/filename-BrNNypc2.mjs
const RE_JS = /\.([cm]?)jsx?$/;
const RE_TS = /\.([cm]?)tsx?$/;
const RE_DTS = /\.d\.([cm]?)ts$/;
const RE_DTS_MAP = /\.d\.([cm]?)ts\.map$/;
const RE_NODE_MODULES = /[\\/]node_modules[\\/]/;
const RE_CSS = /\.(?:css|scss|sass|less|styl|stylus)$/;
const RE_JSON = /\.json$/;
const RE_ROLLDOWN_RUNTIME = exactRegex(RUNTIME_MODULE_ID);
function filename_js_to_dts(id) {
	return id.replace(RE_JS, ".d.$1ts");
}
function filename_to_dts(id, volarContext) {
	id = volarContext?.toTsFilename?.(id) ?? id;
	return id.replace(RE_TS, ".d.$1ts").replace(RE_JS, ".d.$1ts").replace(RE_JSON, ".json.d.ts");
}
function filename_dts_to(id, ext) {
	return id.replace(RE_DTS, `.$1${ext}`);
}
function resolveTemplateFn(fn, chunk) {
	return typeof fn === "function" ? fn(chunk) : fn;
}
function replaceTemplateName(template, name) {
	return template.replaceAll("[name]", name);
}
//#endregion
//#region ../../node_modules/.pnpm/verkit@0.3.0/node_modules/verkit/dist/index.js
const LETTER_DASH_NUMBER = "[a-zA-Z0-9-]";
const NUMERIC_IDENTIFIER = String.raw`0|[1-9]\d*`;
const NUMERIC_IDENTIFIER_LOOSE = String.raw`\d+`;
const NON_NUMERIC_IDENTIFIER = String.raw`\d*[a-zA-Z-]${LETTER_DASH_NUMBER}*`;
const MAIN_VERSION = String.raw`(${NUMERIC_IDENTIFIER})\.(${NUMERIC_IDENTIFIER})\.(${NUMERIC_IDENTIFIER})`;
const MAIN_VERSION_LOOSE = String.raw`(${NUMERIC_IDENTIFIER_LOOSE})\.(${NUMERIC_IDENTIFIER_LOOSE})\.(${NUMERIC_IDENTIFIER_LOOSE})`;
const PRERELEASE_IDENTIFIER = `(?:${NON_NUMERIC_IDENTIFIER}|${NUMERIC_IDENTIFIER})`;
const PRERELEASE_IDENTIFIER_LOOSE = `(?:${NON_NUMERIC_IDENTIFIER}|${NUMERIC_IDENTIFIER_LOOSE})`;
const PRERELEASE = String.raw`(?:-(${PRERELEASE_IDENTIFIER}(?:\.${PRERELEASE_IDENTIFIER})*))`;
const PRERELEASE_LOOSE = String.raw`(?:-?(${PRERELEASE_IDENTIFIER_LOOSE}(?:\.${PRERELEASE_IDENTIFIER_LOOSE})*))`;
const BUILD_IDENTIFIER = `${LETTER_DASH_NUMBER}+`;
const BUILD = String.raw`(?:\+(${BUILD_IDENTIFIER}(?:\.${BUILD_IDENTIFIER})*))`;
const FULL_PLAIN = `v?${MAIN_VERSION}${PRERELEASE}?${BUILD}?`;
const LOOSE_PLAIN = String.raw`[v=\s]*${MAIN_VERSION_LOOSE}${PRERELEASE_LOOSE}?${BUILD}?`;
const GREATER_LESS_THAN = "((?:<|>)?=?)";
const XRANGE_IDENTIFIER = String.raw`${NUMERIC_IDENTIFIER}|x|X|\*`;
const XRANGE_IDENTIFIER_LOOSE = String.raw`${NUMERIC_IDENTIFIER_LOOSE}|x|X|\*`;
const XRANGE_PLAIN = String.raw`[v=\s]*(${XRANGE_IDENTIFIER})(?:\.(${XRANGE_IDENTIFIER})(?:\.(${XRANGE_IDENTIFIER})(?:${PRERELEASE})?${BUILD}?)?)?`;
const XRANGE_PLAIN_LOOSE = String.raw`[v=\s]*(${XRANGE_IDENTIFIER_LOOSE})(?:\.(${XRANGE_IDENTIFIER_LOOSE})(?:\.(${XRANGE_IDENTIFIER_LOOSE})(?:${PRERELEASE_LOOSE})?${BUILD}?)?)?`;
const LONE_TILDE = "(?:~>?)";
const LONE_CARET = String.raw`(?:\^)`;
const COERCE_PLAIN = String.raw`(^|[^\d])(\d{1,${16}})(?:\.(\d{1,${16}}))?(?:\.(\d{1,${16}}))?`;
const COERCE = String.raw`${COERCE_PLAIN}(?:$|[^\d])`;
const COERCE_FULL = String.raw`${COERCE_PLAIN}(?:${PRERELEASE})?(?:${BUILD})?(?:$|[^\d])`;
function makeSafeRegexSource(source) {
	const replacements = [
		[String.raw`\s`, 1],
		[String.raw`\d`, 256],
		[LETTER_DASH_NUMBER, 250]
	];
	for (const [token, maximum] of replacements) source = source.split(`${token}*`).join(`${token}{0,${maximum}}`).split(`${token}+`).join(`${token}{1,${maximum}}`);
	return source;
}
function safeRegex(source, flags) {
	return new RegExp(makeSafeRegexSource(source), flags);
}
const NUMERIC$1 = /^\d+$/;
function compareIdentifiers(left, right) {
	if (typeof left === "number" && typeof right === "number") return left === right ? 0 : left < right ? -1 : 1;
	const leftNumeric = NUMERIC$1.test(String(left));
	const rightNumeric = NUMERIC$1.test(String(right));
	const normalizedLeft = leftNumeric ? Number(left) : left;
	const normalizedRight = rightNumeric ? Number(right) : right;
	return normalizedLeft === normalizedRight ? 0 : leftNumeric && !rightNumeric ? -1 : rightNumeric && !leftNumeric ? 1 : normalizedLeft < normalizedRight ? -1 : 1;
}
const FULL = safeRegex(`^${FULL_PLAIN}$`);
const LOOSE = safeRegex(`^${LOOSE_PLAIN}$`);
safeRegex(`^${PRERELEASE}$`);
safeRegex(`^${PRERELEASE_LOOSE}$`);
const COERCE_EXACT = safeRegex(COERCE);
const COERCE_FULL_EXACT = safeRegex(COERCE_FULL);
const NUMERIC = /^\d+$/;
function formatComparableVersion(version) {
	const base = `${version.major}.${version.minor}.${version.patch}`;
	return version.prerelease?.length ? `${base}-${version.prerelease.join(".")}` : base;
}
function formatFullVersion(version) {
	const comparable = formatComparableVersion(version);
	return version.build?.length ? `${comparable}+${version.build.join(".")}` : comparable;
}
function parse$1(version, options = {}) {
	if (typeof version !== "string") return version;
	if (version.length > 256) throw new TypeError(`Version exceeds the maximum length of 256 characters`);
	const match = version.trim().match(options.loose ? LOOSE : FULL);
	if (!match) throw new TypeError(`Invalid version syntax: ${version}`);
	const major = Number(match[1]);
	const minor = Number(match[2]);
	const patch = Number(match[3]);
	if (major > Number.MAX_SAFE_INTEGER || major < 0) throw new TypeError(`Invalid major version: ${match[1]}`);
	if (minor > Number.MAX_SAFE_INTEGER || minor < 0) throw new TypeError(`Invalid minor version: ${match[2]}`);
	if (patch > Number.MAX_SAFE_INTEGER || patch < 0) throw new TypeError(`Invalid patch version: ${match[3]}`);
	const prerelease = match[4] ? match[4].split(".").map((identifier) => {
		if (NUMERIC.test(identifier)) {
			const numeric = Number(identifier);
			if (numeric >= 0 && numeric < Number.MAX_SAFE_INTEGER) return numeric;
		}
		return identifier;
	}) : void 0;
	return {
		build: match[5]?.split("."),
		major,
		minor,
		patch,
		prerelease
	};
}
function tryParse(version, options = {}) {
	try {
		return parse$1(version, options);
	} catch {
		return null;
	}
}
function compareMainParsed(left, right) {
	return left.major === right.major ? left.minor === right.minor ? left.patch === right.patch ? 0 : left.patch < right.patch ? -1 : 1 : left.minor < right.minor ? -1 : 1 : left.major < right.major ? -1 : 1;
}
function comparePrereleaseParsed(left, right) {
	const leftPrerelease = left.prerelease;
	const rightPrerelease = right.prerelease;
	if (leftPrerelease?.length && !rightPrerelease?.length) return -1;
	if (!leftPrerelease?.length && rightPrerelease?.length) return 1;
	if (!leftPrerelease?.length && !rightPrerelease?.length) return 0;
	for (let index = 0;; index++) {
		const leftIdentifier = leftPrerelease?.[index];
		const rightIdentifier = rightPrerelease?.[index];
		if (leftIdentifier === void 0 && rightIdentifier === void 0) return 0;
		if (rightIdentifier === void 0) return 1;
		if (leftIdentifier === void 0) return -1;
		if (leftIdentifier !== rightIdentifier) return compareIdentifiers(leftIdentifier, rightIdentifier);
	}
}
function compareParsed(left, right) {
	return compareMainParsed(left, right) || comparePrereleaseParsed(left, right);
}
function coerceParsedVersion(value, options = {}) {
	if (typeof value === "object") return value;
	const input = typeof value === "number" ? String(value) : value;
	if (typeof input !== "string") return null;
	let match = null;
	if (options.rtl) {
		const expression = safeRegex(options.includePrerelease ? COERCE_FULL : COERCE, "g");
		let next;
		while ((next = expression.exec(input)) && (!match || match.index + match[0].length !== input.length)) {
			if (!match || next.index + next[0].length !== match.index + match[0].length) match = next;
			expression.lastIndex = next.index + next[1].length + next[2].length;
		}
	} else match = (options.includePrerelease ? COERCE_FULL_EXACT : COERCE_EXACT).exec(input);
	if (!match) return null;
	const major = match[2];
	return tryParse(`${major}.${match[3] || "0"}.${match[4] || "0"}${options.includePrerelease && match[5] ? `-${match[5]}` : ""}${options.includePrerelease && match[6] ? `+${match[6]}` : ""}`, options);
}
const STRICT_COMPARATOR = safeRegex(String.raw`^${GREATER_LESS_THAN}\s*(${FULL_PLAIN})$|^$`);
const LOOSE_COMPARATOR$1 = safeRegex(String.raw`^${GREATER_LESS_THAN}\s*(${LOOSE_PLAIN})$|^$`);
function parseComparator(comparator, options = {}) {
	const normalized = comparator.trim().replaceAll(/\s+/g, " ");
	const match = normalized.match(options.loose ? LOOSE_COMPARATOR$1 : STRICT_COMPARATOR);
	if (!match) throw new TypeError(`Invalid comparator: ${normalized}`);
	const operator = match[1] === "=" ? "" : match[1] || "";
	const version = match[2] ? parse$1(match[2], options) : null;
	return {
		operator,
		options,
		value: version ? `${operator}${formatComparableVersion(version)}` : "",
		version
	};
}
function testParsedComparator(comparator, version) {
	if (!comparator.version) return true;
	const comparison = compareParsed(version, comparator.version);
	switch (comparator.operator) {
		case "": return comparison === 0;
		case ">": return comparison > 0;
		case ">=": return comparison >= 0;
		case "<": return comparison < 0;
		case "<=": return comparison <= 0;
	}
}
function compare(left, right, options = {}) {
	return compareParsed(parse$1(left, options), parse$1(right, options));
}
function isGreaterOrEqual(left, right, options = {}) {
	return compare(left, right, options) >= 0;
}
const BUILD_STRIP = new RegExp(BUILD, "g");
const BUILD_SAFE = safeRegex(BUILD);
const STRICT_HYPHEN = safeRegex(String.raw`^\s*(${XRANGE_PLAIN})\s+-\s+(${XRANGE_PLAIN})\s*$`);
const LOOSE_HYPHEN = safeRegex(String.raw`^\s*(${XRANGE_PLAIN_LOOSE})\s+-\s+(${XRANGE_PLAIN_LOOSE})\s*$`);
const COMPARATOR_TRIM = safeRegex(String.raw`(\s*)${GREATER_LESS_THAN}\s*(${LOOSE_PLAIN}|${XRANGE_PLAIN})`, "g");
const TILDE_TRIM = safeRegex(String.raw`(\s*)${LONE_TILDE}\s+`, "g");
const CARET_TRIM = safeRegex(String.raw`(\s*)${LONE_CARET}\s+`, "g");
const STRICT_TILDE = safeRegex(`^${LONE_TILDE}${XRANGE_PLAIN}$`);
const LOOSE_TILDE = safeRegex(`^${LONE_TILDE}${XRANGE_PLAIN_LOOSE}$`);
const STRICT_CARET = safeRegex(`^${LONE_CARET}${XRANGE_PLAIN}$`);
const LOOSE_CARET = safeRegex(`^${LONE_CARET}${XRANGE_PLAIN_LOOSE}$`);
const STRICT_XRANGE = safeRegex(String.raw`^${GREATER_LESS_THAN}\s*${XRANGE_PLAIN}$`);
const LOOSE_XRANGE = safeRegex(String.raw`^${GREATER_LESS_THAN}\s*${XRANGE_PLAIN_LOOSE}$`);
const STAR = safeRegex(String.raw`(<|>)?=?\s*\*`);
const GTE_ZERO = /^\s*>=\s*0\.0\.0\s*$/;
const GTE_ZERO_PRERELEASE = /^\s*>=\s*0\.0\.0-0\s*$/;
const LOOSE_COMPARATOR = safeRegex(String.raw`^${GREATER_LESS_THAN}\s*(${LOOSE_PLAIN})$|^$`);
function isWildcard(value) {
	return !value || String(value).toLowerCase() === "x" || String(value) === "*";
}
function hasInvalidWildcardOrder(major, minor, patch) {
	return isWildcard(major) && !isWildcard(minor) || isWildcard(minor) && Boolean(patch) && !isWildcard(patch);
}
function replaceTilde(comparator, options) {
	const expression = options.loose ? LOOSE_TILDE : STRICT_TILDE;
	const lowerPrerelease = options.includePrerelease ? "-0" : "";
	return comparator.replace(expression, (_match, major, minor, patch, prerelease) => {
		if (isWildcard(major)) return "";
		if (isWildcard(minor)) return `>=${major}.0.0${lowerPrerelease} <${Number(major) + 1}.0.0-0`;
		if (isWildcard(patch)) return `>=${major}.${minor}.0${lowerPrerelease} <${major}.${Number(minor) + 1}.0-0`;
		return prerelease ? `>=${major}.${minor}.${patch}-${prerelease} <${major}.${Number(minor) + 1}.0-0` : `>=${major}.${minor}.${patch} <${major}.${Number(minor) + 1}.0-0`;
	});
}
function replaceTildes(comparator, options) {
	return comparator.trim().split(/\s+/).map((part) => replaceTilde(part, options)).join(" ");
}
function replaceCaret(comparator, options) {
	const expression = options.loose ? LOOSE_CARET : STRICT_CARET;
	const lowerPrerelease = options.includePrerelease ? "-0" : "";
	return comparator.replace(expression, (_match, major, minor, patch, prerelease) => {
		if (isWildcard(major)) return "";
		if (isWildcard(minor)) return `>=${major}.0.0${lowerPrerelease} <${Number(major) + 1}.0.0-0`;
		if (isWildcard(patch)) return major === "0" ? `>=${major}.${minor}.0${lowerPrerelease} <${major}.${Number(minor) + 1}.0-0` : `>=${major}.${minor}.0${lowerPrerelease} <${Number(major) + 1}.0.0-0`;
		if (prerelease) return major === "0" ? minor === "0" ? `>=${major}.${minor}.${patch}-${prerelease} <${major}.${minor}.${Number(patch) + 1}-0` : `>=${major}.${minor}.${patch}-${prerelease} <${major}.${Number(minor) + 1}.0-0` : `>=${major}.${minor}.${patch}-${prerelease} <${Number(major) + 1}.0.0-0`;
		return major === "0" ? minor === "0" ? `>=${major}.${minor}.${patch} <${major}.${minor}.${Number(patch) + 1}-0` : `>=${major}.${minor}.${patch} <${major}.${Number(minor) + 1}.0-0` : `>=${major}.${minor}.${patch} <${Number(major) + 1}.0.0-0`;
	});
}
function replaceCarets(comparator, options) {
	return comparator.trim().split(/\s+/).map((part) => replaceCaret(part, options)).join(" ");
}
function replaceXRange(comparator, options) {
	const expression = options.loose ? LOOSE_XRANGE : STRICT_XRANGE;
	return comparator.trim().replace(expression, (match, rawOperator, rawMajor, rawMinor, rawPatch) => {
		let operator = rawOperator;
		let major = rawMajor;
		let minor = rawMinor;
		let patch = rawPatch;
		if (hasInvalidWildcardOrder(String(major), minor === void 0 ? void 0 : String(minor), patch === void 0 ? void 0 : String(patch))) return comparator;
		const wildcardMajor = isWildcard(major);
		const wildcardMinor = wildcardMajor || isWildcard(minor);
		const wildcardPatch = wildcardMinor || isWildcard(patch);
		if (operator === "=" && wildcardPatch) operator = "";
		if (wildcardMajor) return operator === ">" || operator === "<" ? "<0.0.0-0" : "*";
		let prerelease = options.includePrerelease ? "-0" : "";
		if (operator && wildcardPatch) {
			if (wildcardMinor) minor = 0;
			patch = 0;
			if (operator === ">") {
				operator = ">=";
				if (wildcardMinor) {
					major = Number(major) + 1;
					minor = 0;
				} else minor = Number(minor) + 1;
			} else if (operator === "<=") {
				operator = "<";
				if (wildcardMinor) major = Number(major) + 1;
				else minor = Number(minor) + 1;
			}
			if (operator === "<") prerelease = "-0";
			return `${operator}${major}.${minor}.${patch}${prerelease}`;
		}
		if (wildcardMinor) return `>=${major}.0.0${prerelease} <${Number(major) + 1}.0.0-0`;
		if (wildcardPatch) return `>=${major}.${minor}.0${prerelease} <${major}.${Number(minor) + 1}.0-0`;
		return match;
	});
}
function replaceXRanges(comparator, options) {
	return comparator.split(/\s+/).map((part) => replaceXRange(part, options)).join(" ");
}
function replaceHyphenRange(range, options) {
	const expression = options.loose ? LOOSE_HYPHEN : STRICT_HYPHEN;
	return range.replace(expression, (_match, rawFrom, fromMajor, fromMinor, fromPatch, fromPrerelease, _fromBuild, rawTo, toMajor, toMinor, toPatch, toPrerelease) => {
		let from = rawFrom;
		let to = rawTo;
		if (isWildcard(fromMajor)) from = "";
		else if (isWildcard(fromMinor)) from = `>=${fromMajor}.0.0${options.includePrerelease ? "-0" : ""}`;
		else if (isWildcard(fromPatch)) from = `>=${fromMajor}.${fromMinor}.0${options.includePrerelease ? "-0" : ""}`;
		else if (fromPrerelease) from = `>=${from}`;
		else from = `>=${from}${options.includePrerelease ? "-0" : ""}`;
		if (isWildcard(toMajor)) to = "";
		else if (isWildcard(toMinor)) to = `<${Number(toMajor) + 1}.0.0-0`;
		else if (isWildcard(toPatch)) to = `<${toMajor}.${Number(toMinor) + 1}.0-0`;
		else if (toPrerelease) to = `<=${toMajor}.${toMinor}.${toPatch}-${toPrerelease}`;
		else if (options.includePrerelease) to = `<${toMajor}.${toMinor}.${Number(toPatch) + 1}-0`;
		else to = `<=${to}`;
		return `${from} ${to}`.trim();
	});
}
function expandComparator(comparator, options) {
	return replaceXRanges(replaceTildes(replaceCarets(comparator.replace(BUILD_SAFE, ""), options), options), options).trim().replace(STAR, "");
}
function parseSimpleRange(input, options) {
	let parts = replaceHyphenRange(input.replace(BUILD_STRIP, ""), options).replace(COMPARATOR_TRIM, "$1$2$3").replace(TILDE_TRIM, "$1~").replace(CARET_TRIM, "$1^").split(" ").map((part) => expandComparator(part, options)).join(" ").split(/\s+/).map((part) => part.trim().replace(options.includePrerelease ? GTE_ZERO_PRERELEASE : GTE_ZERO, ""));
	if (options.loose) parts = parts.filter((part) => LOOSE_COMPARATOR.test(part));
	const unique = /* @__PURE__ */ new Map();
	for (const comparator of parts.map((part) => parseComparator(part, options))) {
		if (comparator.value === "<0.0.0-0") return [comparator];
		unique.set(comparator.value, comparator);
	}
	if (unique.size > 1) unique.delete("");
	return [...unique.values()];
}
function parseRange(range, options = {}) {
	if (typeof range !== "string") return range;
	const parsedOptions = { ...options };
	const raw = range.trim().replaceAll(/\s+/g, " ");
	let sets = raw.split("||").map((part) => parseSimpleRange(part.trim(), parsedOptions)).filter((set) => set.length);
	if (!sets.length) throw new TypeError(`Range contains no valid comparator sets: ${raw}`);
	if (sets.length > 1) {
		const first = sets[0];
		sets = sets.filter((set) => set[0]?.value !== "<0.0.0-0");
		if (!sets.length) sets = [first];
		else if (sets.length > 1) {
			const any = sets.find((set) => set.length === 1 && set[0]?.value === "");
			if (any) sets = [any];
		}
	}
	return {
		normalized: sets.map((set) => set.map((comparator) => comparator.value).join(" ")).join("||"),
		options: parsedOptions,
		raw,
		sets
	};
}
function tryParseRange(range, options = {}) {
	try {
		return parseRange(range, options);
	} catch {
		return null;
	}
}
function testComparatorSet(set, version, options) {
	if (set.some((comparator) => !testParsedComparator(comparator, version))) return false;
	if (!version.prerelease?.length || options.includePrerelease) return true;
	return set.some((comparator) => {
		const allowed = comparator.version;
		return allowed !== null && allowed.prerelease?.length && allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch;
	});
}
function testParsedRange(range, version) {
	return range.sets.some((set) => testComparatorSet(set, version, range.options));
}
function testRangeVersion(range, version) {
	const parsed = tryParse(version, range.options);
	return parsed ? testParsedRange(range, parsed) : false;
}
function satisfies(version, range, options = {}) {
	const parsed = tryParseRange(range, options);
	return parsed ? testRangeVersion(parsed, version) : false;
}
function nextVersionAfter(version) {
	const { prerelease } = version;
	return parse$1(formatComparableVersion(prerelease?.length ? {
		major: version.major,
		minor: version.minor,
		patch: version.patch,
		prerelease: [...prerelease, 0]
	} : {
		major: version.major,
		minor: version.minor,
		patch: version.patch + 1
	}));
}
function findMinimumForRange(range, options = {}) {
	const parsedRange = parseRange(range, options);
	const zero = parse$1("0.0.0");
	if (testParsedRange(parsedRange, zero)) return formatComparableVersion(zero);
	const zeroPrerelease = parse$1("0.0.0-0");
	if (testParsedRange(parsedRange, zeroPrerelease)) return formatComparableVersion(zeroPrerelease);
	let minimum = null;
	for (const set of parsedRange.sets) {
		let setMinimum = null;
		for (const comparator of set) {
			if (!comparator.version) continue;
			const candidate = comparator.operator === ">" ? nextVersionAfter(comparator.version) : comparator.operator === "" || comparator.operator === ">=" ? comparator.version : null;
			if (candidate && (!setMinimum || compareParsed(candidate, setMinimum) > 0)) setMinimum = candidate;
		}
		if (setMinimum && (!minimum || compareParsed(minimum, setMinimum) > 0)) minimum = setMinimum;
	}
	return minimum && testParsedRange(parsedRange, minimum) ? formatComparableVersion(minimum) : null;
}
function normalize$1(version, options = {}) {
	const parsed = tryParse(version, options);
	return parsed ? formatComparableVersion(parsed) : null;
}
function coerce(value, options = {}) {
	const parsed = coerceParsedVersion(value, options);
	return parsed ? formatFullVersion(parsed) : null;
}
//#endregion
//#region ../../node_modules/.pnpm/tsdown@0.22.14_@arethetypeswrong+core@0.18.2_@tsdown+css@0.22.14_@tsdown+exe@0.22.14_@t_4084c24f9f44f250d2b604ebc16f10f3/node_modules/tsdown/dist/target-Bab3CUeB.mjs
const NODE_SEA_MIN_VERSION = "25.7.0";
const NODE_SEA_MIN_VERSION_PARSED = {
	major: 25,
	minor: 7,
	patch: 0
};
const debug = createDebug("tsdown:exe");
function validateSea({ dts, entry, logger, nameLabel }) {
	if (process.versions.bun || process.versions.deno) throw new Error("The `exe` option is not supported in Bun and Deno environments.");
	if (!isGreaterOrEqual(process.version, NODE_SEA_MIN_VERSION_PARSED)) throw new Error(`Node.js version ${process.version} does not support \`exe\` option. Please upgrade to Node.js ${NODE_SEA_MIN_VERSION} or later.`);
	if (Object.keys(entry).length > 1) throw new Error(`The \`exe\` feature currently only supports single entry points. Found entries:\n${JSON.stringify(entry, void 0, 2)}`);
	if (dts) logger.warn(nameLabel, `Generating .d.ts files with \`exe\` option is not recommended since they won't be included in the executable. Consider separating your library and executable targets if you need type declarations.`);
	logger.info(nameLabel, "`exe` option is experimental and may change in future releases.");
}
async function buildExe(config, chunks) {
	if (!config.exe) return;
	const filteredChunks = chunks.filter((chunk) => !RE_DTS.test(chunk.fileName));
	if (filteredChunks.length > 1) throw new Error(`The 'exe' feature currently only supports single-chunk outputs. Found ${filteredChunks.length} chunks.\nChunks:\n${filteredChunks.map((c) => `- ${c.fileName}`).join("\n")}`);
	const chunk = filteredChunks[0];
	debug("Building executable with SEA for chunk:", chunk.fileName);
	const bundledFile = path.join(config.outDir, chunk.fileName);
	const { targets } = config.exe;
	if (targets?.length) {
		if (config.exe.seaConfig?.executable) config.logger.warn(config.nameLabel, "`seaConfig.executable` is ignored when `targets` is specified.");
		const { resolveNodeBinary, getTargetSuffix } = await import("./tsdown-exe.js");
		for (const target of targets) {
			const nodeBinaryPath = await resolveNodeBinary(target, config.exe, config.logger);
			const suffix = getTargetSuffix(target);
			await buildSingleExe(config, bundledFile, resolveOutputFileName(config.exe, chunk, bundledFile, target, suffix), nodeBinaryPath, target);
		}
	} else await buildSingleExe(config, bundledFile, resolveOutputFileName(config.exe, chunk, bundledFile));
}
function resolveOutputFileName(exe, chunk, bundledFile, target, suffix) {
	let baseName;
	if (exe.fileName) baseName = typeof exe.fileName === "function" ? exe.fileName(chunk) : exe.fileName;
	else baseName = path.basename(bundledFile, path.extname(bundledFile));
	if (suffix) baseName += suffix;
	if (target?.platform ? target.platform === "win" : process.platform === "win32") baseName += ".exe";
	return baseName;
}
async function buildSingleExe(config, bundledFile, outputFile, executable, target) {
	const exe = config.exe;
	const exeOutDir = path.resolve(config.cwd, exe.outDir || "build");
	await mkdir(exeOutDir, { recursive: true });
	const outputPath = path.join(exeOutDir, outputFile);
	debug("Building SEA executable: %s -> %s", bundledFile, outputPath);
	const t = performance.now();
	const tempDir = await mkdtemp(path.join(tmpdir(), "tsdown-sea-"));
	try {
		const seaConfig = {
			disableExperimentalSEAWarning: true,
			...exe.seaConfig,
			main: bundledFile,
			output: outputPath,
			mainFormat: config.format === "es" ? "module" : "commonjs"
		};
		if (executable) seaConfig.executable = executable;
		const seaConfigPath = path.join(tempDir, "sea-config.json");
		await writeFile(seaConfigPath, JSON.stringify(seaConfig));
		debug("Wrote sea-config.json: %O -> %s", seaConfig, seaConfigPath);
		debug("Running: %s --build-sea %s", process.execPath, seaConfigPath);
		await x(process.execPath, ["--build-sea", seaConfigPath], {
			nodeOptions: { stdio: [
				"ignore",
				"ignore",
				"inherit"
			] },
			throwOnError: true,
			nodePath: false
		});
	} finally {
		if (debug.enabled) debug("Preserving temp directory for debugging: %s", tempDir);
		else await fsRemove(tempDir);
	}
	if ((target?.platform || process.platform) === "darwin") try {
		await x("codesign", [
			"--sign",
			"-",
			outputPath
		], {
			nodeOptions: { stdio: "inherit" },
			throwOnError: true,
			nodePath: false
		});
	} catch {
		config.logger.warn(config.nameLabel, `Failed to code-sign the executable. ${process.platform === "darwin" ? `You can sign it manually using:\n  codesign --sign - "${outputPath}"` : `Automatic code signing is not supported on ${process.platform}.`}`);
	}
	const stat = await fsStat(outputPath);
	if (stat) {
		const sizeText = formatBytes(stat.size);
		config.logger.info(config.nameLabel, bold(path.relative(config.cwd, outputPath)), ` ${dim(sizeText)}`);
	}
	config.logger.success(config.nameLabel, `Built executable: ${red(path.relative(config.cwd, outputPath))}`, dim`(${Math.round(performance.now() - t)}ms)`);
}
const BASELINE_WIDELY_AVAILABLE_TARGET = [
	"chrome111",
	"edge111",
	"firefox114",
	"safari16.4",
	"ios16.4"
];
function expandBaselineTarget(targets) {
	return targets.flatMap((t) => t === "baseline-widely-available" ? BASELINE_WIDELY_AVAILABLE_TARGET : t);
}
function resolveTarget(logger, target, color, pkg, nameLabel) {
	if (target === false) return;
	if (target == null) {
		const pkgTarget = resolvePackageTarget(pkg);
		if (pkgTarget) target = pkgTarget;
		else return;
	}
	if (typeof target === "number") throw new TypeError(`Invalid target: ${target}`);
	const targets = expandBaselineTarget(resolveComma(toArray(target)));
	if (targets.length) logger.info(nameLabel, `target${targets.length > 1 ? "s" : ""}: ${color(targets.join(", "))}`);
	return targets;
}
function resolvePackageTarget(pkg) {
	const nodeVersion = pkg?.engines?.node;
	if (!nodeVersion) return;
	const nodeMinVersion = findMinimumForRange(nodeVersion);
	if (!nodeMinVersion) return;
	if (nodeMinVersion === "0.0.0") return;
	return `node${nodeMinVersion}`;
}
//#endregion
export { fsStat as A, filename_to_dts as C, fsCopy as D, formatBytes as E, stripExtname as M, fsExists as O, filename_js_to_dts as S, resolveTemplateFn as T, RE_JSON as _, resolveTarget as a, RE_TS as b, isGreaterOrEqual as c, satisfies as d, tryParse as f, RE_JS as g, RE_DTS_MAP as h, expandBaselineTarget as i, lowestCommonAncestor as j, fsRemove as k, normalize$1 as l, RE_DTS as m, NODE_SEA_MIN_VERSION_PARSED as n, validateSea as o, RE_CSS as p, buildExe as r, coerce as s, NODE_SEA_MIN_VERSION as t, parseRange as u, RE_NODE_MODULES as v, replaceTemplateName as w, filename_dts_to as x, RE_ROLLDOWN_RUNTIME as y };
