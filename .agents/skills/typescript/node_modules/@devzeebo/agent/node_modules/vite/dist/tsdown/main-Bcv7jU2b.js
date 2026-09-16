import { createRequire } from "node:module";
import { cwd } from "node:process";
import readline from "node:readline";
import { isatty } from "node:tty";
import { formatWithOptions, inspect } from "node:util";
import { spawn } from "node:child_process";
import { basename, delimiter, dirname, normalize, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { PassThrough } from "node:stream";
import { closeSync, openSync, readSync, statSync } from "node:fs";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region ../../node_modules/.pnpm/tsdown@0.22.14_@arethetypeswrong+core@0.18.2_@tsdown+css@0.22.14_@tsdown+exe@0.22.14_@t_4084c24f9f44f250d2b604ebc16f10f3/node_modules/tsdown/dist/general-BbZk8B18.mjs
const picomatch = createRequire(import.meta.url)("./npm_entry_picomatch.cjs");
function toArray(val, defaultValue) {
	if (Array.isArray(val)) return val;
	else if (val == null) {
		if (defaultValue) return [defaultValue];
		return [];
	} else return [val];
}
function resolveComma(arr) {
	return arr.flatMap((format) => format.split(","));
}
function resolveRegex(str) {
	if (typeof str === "string" && str.length > 2 && str[0] === "/" && str.at(-1) === "/") return new RegExp(str.slice(1, -1));
	return str;
}
function slash(string) {
	return string.replaceAll("\\", "/");
}
const noop = (v) => v;
function matchPattern(id, patterns) {
	return patterns.some((pattern) => {
		if (pattern instanceof RegExp) {
			pattern.lastIndex = 0;
			return pattern.test(id);
		}
		return id === pattern || picomatch(pattern)(id);
	});
}
function pkgExists(moduleName) {
	try {
		import.meta.resolve(moduleName);
		return true;
	} catch {}
	return false;
}
async function importWithError(moduleName) {
	try {
		return await import(moduleName);
	} catch (error) {
		throw new Error(`Failed to import module "${moduleName}". Please ensure it is installed.`, { cause: error });
	}
}
function createConcurrencyExecutor(concurrency) {
	if (concurrency == null) return (task) => task();
	if (!Number.isInteger(concurrency) || concurrency < 1) throw new TypeError("`--concurrency` must be a positive integer");
	const queue = [];
	let active = 0;
	return async (task) => {
		if (active >= concurrency) await new Promise((resolve) => queue.push(resolve));
		else active++;
		try {
			return await task();
		} finally {
			const next = queue.shift();
			if (next) next();
			else active--;
		}
	};
}
function debounce(fn, delay) {
	let timer;
	const debounced = (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	};
	debounced.cancel = () => clearTimeout(timer);
	return debounced;
}
const { Ansis, fg, bg, rgb, bgRgb, hex, bgHex, reset, inverse, hidden, visible, link, bold, dim, italic, underline, strikethrough, black, red, green, yellow, blue, magenta, cyan, white, gray, redBright, greenBright, yellowBright, blueBright, magentaBright, cyanBright, whiteBright, bgBlack, bgRed, bgGreen, bgYellow, bgBlue, bgMagenta, bgCyan, bgWhite, bgGray, bgRedBright, bgGreenBright, bgYellowBright, bgBlueBright, bgMagentaBright, bgCyanBright, bgWhiteBright } = (/* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	let e, { defineProperty: r, getPrototypeOf: t, setPrototypeOf: n, create: o, keys: l } = Object, i = "", { round: f, max: s } = Math, u = (e) => {
		let r = /([a-f\d]{3,6})/i.exec(e)?.[0], t = r?.length, n = "0x" + (6 ^ t ? 3 ^ t ? "0" : r[0] + r[0] + r[1] + r[1] + r[2] + r[2] : r) | 0;
		return [
			n >> 16,
			n >> 8 & 255,
			255 & n
		];
	}, a = (e) => {
		if (8 > e) return 30 + e;
		if (16 > e) return 82 + e;
		if (e > 231) return e > 243 ? 37 : 30;
		let r = (e -= 16) % 36, t = e / 36 | 0, n = r / 6 | 0, o = r % 6;
		return 30 + (t > 2 | (n > 2) << 1 | (o > 2) << 2) + (s(t, n, o) > 4 ? 60 : 0);
	}, c = {
		open: i,
		close: i
	}, g = (e, { open: r = "", close: o = "", f: l }) => {
		let f = (e.open || i) + r, s = o + (e.close || i), u = (e, ...t) => {
			if (!e) {
				if (!o) return r;
				if ((e ?? i) === i) return i;
			}
			let n, a = l ? l(e, ...t) : e.raw ? String.raw({ raw: e }, ...t) : i + e, c = u;
			if (a.includes("\x1B")) for (; c = c.p;) {
				let { t: e, o: r } = c, t = r.length, o = i, l = 0;
				if (t) for (; ~(n = a.indexOf(r, l)); l = n + t) o += a.slice(l, n) + e;
				a = o + a.slice(l);
			}
			return f + (a.includes("\n") ? a.replace(/(\r?\n)/g, s + "$1" + f) : a) + s;
		};
		return n(u, t(e)).p = {
			t: r,
			o,
			p: e.p
		}, u.open = f, u.close = s, u;
	};
	const d = new function t(s = globalThis) {
		let d = "number" == typeof s ? s : ((r) => {
			let t = r.process ?? {}, n = t.argv ?? [], o = t.env ?? {}, i = 0;
			try {
				i = ((r, t, n) => (e = t.TERM, {
					"24bit": 3,
					truecolor: 3,
					ansi256: 2,
					ansi: 1
				}[t.COLORTERM] || (t.CI ? /,GITHUB/.test(n) ? 3 : 1 : (t.PM2_HOME || /edge/.test(t.NEXT_RUNTIME) || r.stdout?.isTTY) && "dumb" !== e ? "win32" === r.platform ? 3 : /-256/.test(e) ? 2 : 1 : 0)))(t, o, "," + l(o).join(","));
			} catch (e) {
				o = {};
			}
			let f, s = i || 1, u = "FORCE_COLOR", a = {
				false: 0,
				0: 0,
				1: 1,
				2: 2,
				3: 3
			}[o[u]] ?? s, c = -1;
			for (f of n) /^--color=?(true|always)?$/.test(f) && (c = s), /^--(no-color|color=(false|never))$/.test(f) && (c = 0);
			return r.window?.chrome ? 3 : u in o ? a : ~c ? c : o.NO_COLOR ? 0 : i;
		})(s), b = {}, p = {
			Ansis: t,
			level: d,
			isSupported: () => m,
			strip: (e) => e.replace(/][^]*|[][[()#;?]*(?:\d+(?:;\d*)*)?[\dA-ORZcf-nqry=><]/g, i),
			extend(e) {
				for (let r in e) {
					let t = e[r];
					"s" === (typeof t)[0] && (h(w(r), A(...u(t))), t = P(...u(t))), h(r, t);
				}
				return n(p, o({}, b));
			}
		}, h = (e, t) => {
			b[e] = { get() {
				return r(this, e, { value: t.call ? (...e) => g(this, t(...e)) : g(this, t) })[e];
			} };
		}, y = 1 ^ d, $ = d > 2, m = d > 0, O = (e, r) => m ? {
			open: `[${e}m`,
			close: r ? `[${r}m` : i
		} : c, w = (e) => "bg" + e[0].toUpperCase() + e.slice(1), v = (e) => (r) => e(...u(r)), x = (e, r) => (t, n, o) => O(`${e}8;2;${t};${n};${o}`, r), _ = (e) => (r, t, n) => e(((e, r, t) => e ^ r | r ^ t ? 16 + 36 * f(e / 51) + 6 * f(r / 51) + f(t / 51) : 8 > e ? 16 : e > 248 ? 231 : f(24 * (e - 8) / 247) + 232)(r, t, n)), k = (e) => O(y ? "38;5;" + e : a(e), 39), R = (e) => O(y ? "48;5;" + e : a(e) + 10, 49), P = $ ? x(3, 39) : _(k), A = $ ? x(4, 49) : _(R), B = {
			fg: k,
			bg: R,
			rgb: P,
			bgRgb: A,
			hex: v(P),
			bgHex: v(A),
			visible: c,
			reset: O(0, i),
			bold: O(1, 22),
			dim: O(2, 22),
			italic: O(3, 23),
			underline: O(4, 24),
			inverse: O(7, 27),
			hidden: O(8, 28),
			strikethrough: O(9, 29),
			link: { f: (e, r = e) => m ? `]8;;${e}${r}]8;;` : r != e ? r + ` (​${e}​)` : e }
		}, C = (e, r) => {
			B[e] = O(r, 39), B[w(e)] = O(r + 10, 49);
		};
		return "gray,black,red,green,yellow,blue,magenta,cyan,white".split(",").map(((e, r) => {
			r ? C(e + "Bright", 89 + r) : r = 61, C(e, 29 + r);
		})), p.extend(B);
	}();
	module.exports = d.default = d;
})))(), 1)).default;
//#endregion
//#region ../../node_modules/.pnpm/obug@2.1.4/node_modules/obug/dist/core.js
/**
* Coerce `value`.
*/
function coerce(value) {
	if (value instanceof Error) return value.stack || value.message;
	return value;
}
/**
* Selects a color for a debug namespace
* @return An ANSI color code for the given namespace
*/
function selectColor(colors, namespace) {
	let hash = 0;
	for (let i = 0; i < namespace.length; i++) {
		hash = (hash << 5) - hash + namespace.charCodeAt(i);
		hash |= 0;
	}
	return colors[Math.abs(hash) % colors.length];
}
/**
* Checks if the given string matches a namespace template, honoring
* asterisks as wildcards.
*/
function matchesTemplate(search, template) {
	let searchIndex = 0;
	let templateIndex = 0;
	let starIndex = -1;
	let matchIndex = 0;
	while (searchIndex < search.length) if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) if (template[templateIndex] === "*") {
		starIndex = templateIndex;
		matchIndex = searchIndex;
		templateIndex++;
	} else {
		searchIndex++;
		templateIndex++;
	}
	else if (starIndex !== -1) {
		templateIndex = starIndex + 1;
		matchIndex++;
		searchIndex = matchIndex;
	} else return false;
	while (templateIndex < template.length && template[templateIndex] === "*") templateIndex++;
	return templateIndex === template.length;
}
function humanize(value) {
	if (value >= 1e3) return `${(value / 1e3).toFixed(1)}s`;
	return `${value}ms`;
}
let globalNamespaces = "";
/**
* Returns a string of the currently enabled debug namespaces.
*/
function namespaces() {
	return globalNamespaces;
}
function createDebug$1(namespace, options) {
	let prevTime;
	let enableOverride;
	let namespacesCache;
	let enabledCache;
	const debug = (...args) => {
		if (!debug.enabled) return;
		const curr = Date.now();
		const diff = curr - (prevTime || curr);
		prevTime = curr;
		args[0] = coerce(args[0]);
		if (typeof args[0] !== "string") args.unshift("%O");
		let index = 0;
		args[0] = args[0].replace(/%([a-z%])/gi, (match, format) => {
			if (match === "%%") return "%";
			index++;
			const formatter = options.formatters[format];
			if (typeof formatter === "function") {
				const value = args[index];
				match = formatter.call(debug, value);
				args.splice(index, 1);
				index--;
			}
			return match;
		});
		options.formatArgs.call(debug, diff, args);
		debug.log(...args);
	};
	debug.extend = function(namespace, delimiter = ":") {
		return createDebug$1(this.namespace + delimiter + namespace, {
			useColors: this.useColors,
			color: this.color,
			formatArgs: this.formatArgs,
			formatters: this.formatters,
			inspectOpts: this.inspectOpts,
			log: this.log,
			humanize: this.humanize
		});
	};
	Object.assign(debug, options);
	debug.namespace = namespace;
	Object.defineProperty(debug, "enabled", {
		enumerable: true,
		configurable: false,
		get: () => {
			if (enableOverride != null) return enableOverride;
			if (namespacesCache !== globalNamespaces) {
				namespacesCache = globalNamespaces;
				enabledCache = enabled(namespace);
			}
			return enabledCache;
		},
		set: (v) => {
			enableOverride = v;
		}
	});
	return debug;
}
let names = [];
let skips = [];
function enable$1(namespaces) {
	globalNamespaces = namespaces;
	names = [];
	skips = [];
	const split = globalNamespaces.trim().replace(/\s+/g, ",").split(",").filter(Boolean);
	for (const ns of split) if (ns[0] === "-") skips.push(ns.slice(1));
	else names.push(ns);
}
/**
* Returns true if the given mode name is enabled, false otherwise.
*/
function enabled(name) {
	for (const skip of skips) if (matchesTemplate(name, skip)) return false;
	for (const ns of names) if (matchesTemplate(name, ns)) return true;
	return false;
}
//#endregion
//#region ../../node_modules/.pnpm/obug@2.1.4/node_modules/obug/dist/node.js
let env = {};
try {
	process.env.DEBUG;
	env = process.env;
} catch (_unused) {}
const colors = process.stderr.getColorDepth && process.stderr.getColorDepth(env) > 2 ? [
	20,
	21,
	26,
	27,
	32,
	33,
	38,
	39,
	40,
	41,
	42,
	43,
	44,
	45,
	56,
	57,
	62,
	63,
	68,
	69,
	74,
	75,
	76,
	77,
	78,
	79,
	80,
	81,
	92,
	93,
	98,
	99,
	112,
	113,
	128,
	129,
	134,
	135,
	148,
	149,
	160,
	161,
	162,
	163,
	164,
	165,
	166,
	167,
	168,
	169,
	170,
	171,
	172,
	173,
	178,
	179,
	184,
	185,
	196,
	197,
	198,
	199,
	200,
	201,
	202,
	203,
	204,
	205,
	206,
	207,
	208,
	209,
	214,
	215,
	220,
	221
] : [
	6,
	2,
	3,
	4,
	5,
	1
];
const inspectOpts = Object.keys(env).filter((key) => /^debug_/i.test(key)).reduce((obj, key) => {
	const prop = key.slice(6).toLowerCase().replace(/_([a-z])/g, (_, k) => k.toUpperCase());
	let value = env[key];
	const lowerCase = typeof value === "string" && value.toLowerCase();
	if (value === "null") value = null;
	else if (lowerCase === "yes" || lowerCase === "on" || lowerCase === "true" || lowerCase === "enabled") value = true;
	else if (lowerCase === "no" || lowerCase === "off" || lowerCase === "false" || lowerCase === "disabled") value = false;
	else value = Number(value);
	obj[prop] = value;
	return obj;
}, Object.create(null));
/**
* Is stdout a TTY? Colored output is enabled when `true`.
*/
function useColors() {
	return "colors" in inspectOpts ? Boolean(inspectOpts.colors) : isatty(process.stderr.fd);
}
function getDate() {
	if (inspectOpts.hideDate) return "";
	return `${(/* @__PURE__ */ new Date()).toISOString()} `;
}
/**
* Adds ANSI color escape codes if enabled.
*/
function formatArgs(diff, args) {
	const { namespace: name, useColors } = this;
	if (useColors) {
		const c = this.color;
		const colorCode = `\u001B[3${c < 8 ? c : `8;5;${c}`}`;
		const prefix = `  ${colorCode};1m${name} \u001B[0m`;
		args[0] = prefix + args[0].split("\n").join(`\n${prefix}`);
		args.push(`${colorCode}m+${this.humanize(diff)}\u001B[0m`);
	} else args[0] = `${getDate()}${name} ${args[0]}`;
}
function log(...args) {
	process.stderr.write(`${formatWithOptions(this.inspectOpts, ...args)}\n`);
}
const defaultOptions$1 = {
	useColors: useColors(),
	formatArgs,
	formatters: {
		/**
		* Map %o to `util.inspect()`, all on a single line.
		*/
		o(v) {
			this.inspectOpts.colors = this.useColors;
			return inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
		},
		/**
		* Map %O to `util.inspect()`, allowing multiple lines if needed.
		*/
		O(v) {
			this.inspectOpts.colors = this.useColors;
			return inspect(v, this.inspectOpts);
		}
	},
	inspectOpts,
	log,
	humanize
};
function createDebug(namespace, options) {
	var _ref;
	const color = (_ref = options && options.color) !== null && _ref !== void 0 ? _ref : selectColor(colors, namespace);
	return createDebug$1(namespace, Object.assign(defaultOptions$1, { color }, options));
}
function save(namespaces) {
	if (namespaces) env.DEBUG = namespaces;
	else delete env.DEBUG;
}
/**
* Enables a debug mode by namespaces. This can include modes
* separated by a colon and wildcards.
*/
function enable(namespaces) {
	save(namespaces);
	enable$1(namespaces);
}
enable$1(env.DEBUG || "");
//#endregion
//#region ../../node_modules/.pnpm/tinyexec@1.3.0/node_modules/tinyexec/dist/main.mjs
const isPathLikePattern = /^path$/i;
const defaultEnvPathInfo = {
	key: "PATH",
	value: ""
};
function getPathFromEnv(env) {
	for (const key in env) {
		if (!Object.prototype.hasOwnProperty.call(env, key) || !isPathLikePattern.test(key)) continue;
		const value = env[key];
		if (!value) return defaultEnvPathInfo;
		return {
			key,
			value
		};
	}
	return defaultEnvPathInfo;
}
function addNodeBinToPath(cwd, path) {
	const parts = path.value.split(delimiter);
	const nodeBinPaths = [];
	let currentPath = cwd;
	let lastPath;
	do {
		nodeBinPaths.push(resolve(currentPath, "node_modules", ".bin"));
		lastPath = currentPath;
		currentPath = dirname(currentPath);
	} while (currentPath !== lastPath);
	nodeBinPaths.push(dirname(process.execPath));
	const newPath = nodeBinPaths.concat(parts).join(delimiter);
	return {
		key: path.key,
		value: newPath
	};
}
function computeEnv(cwd, env, nodePath = true) {
	const envWithDefault = {
		...process.env,
		...env
	};
	if (!nodePath) return envWithDefault;
	const envPathInfo = addNodeBinToPath(cwd, getPathFromEnv(envWithDefault));
	envWithDefault[envPathInfo.key] = envPathInfo.value;
	return envWithDefault;
}
const combineStreams = (streams) => {
	let streamCount = streams.length;
	const combined = new PassThrough();
	const maybeEmitEnd = () => {
		if (--streamCount === 0) combined.end();
	};
	for (const stream of streams) pipeline(stream, combined, { end: false }).then(maybeEmitEnd).catch(maybeEmitEnd);
	return combined;
};
const metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
const shebangRegExp = /^#!\s*(.+)/;
const isWindowsExecutableRegExp = /\.(?:com|exe)$/i;
const isNodeModulesCmdRegExp = /node_modules[\\/]\.bin[\\/][^\\/]+\.cmd$/i;
const isWindows = process.platform === "win32";
const defaultPathExt = [
	".EXE",
	".CMD",
	".BAT",
	".COM"
];
const noPathExt = [""];
/**
* Normalizes the command and arguments to work cross-platform.
* On Windows, this basically handles things like shebangs, calling
* `node_modules/.bin` commands, and escaping meta characters.
* On other platforms, it just returns the command and arguments as-is.
*/
function normalizeSpawnCommand(command, args = [], options = {}) {
	if (options.shell === true || !isWindows) return {
		command,
		args,
		options
	};
	let file = resolveCommand(command, options);
	let shebang = null;
	if (file !== null) {
		const size = 150;
		const buffer = Buffer.alloc(size);
		let fd = null;
		try {
			fd = openSync(file, "r");
			readSync(fd, buffer, 0, size, 0);
		} catch {} finally {
			if (fd !== null) closeSync(fd);
		}
		const match = buffer.toString().match(shebangRegExp);
		if (match !== null) {
			const line = match[1].trim();
			const separatorIndex = line.indexOf(" ");
			const path = separatorIndex !== -1 ? line.slice(0, separatorIndex) : line;
			const argument = separatorIndex !== -1 ? line.slice(separatorIndex + 1) : "";
			const binary = basename(path);
			shebang = binary === "env" ? argument || null : binary;
		}
	}
	if (shebang !== null && file !== null) {
		args = [file, ...args];
		command = shebang;
		file = resolveCommand(command, options);
	}
	if (file === null || !isWindowsExecutableRegExp.test(file)) {
		const needsDoubleEscapeMetaChars = file !== null && isNodeModulesCmdRegExp.test(file);
		command = normalize(command);
		command = command.replace(metaCharsRegExp, "^$1");
		args = args.map((arg) => {
			arg = arg.replace(/(?=(\\+?)?)\1"/g, "$1$1\\\"");
			arg = arg.replace(/(?=(\\+?)?)\1$/, "$1$1");
			arg = `"${arg}"`;
			arg = arg.replace(metaCharsRegExp, "^$1");
			if (needsDoubleEscapeMetaChars) arg = arg.replace(metaCharsRegExp, "^$1");
			return arg;
		});
		args = [
			"/d",
			"/s",
			"/c",
			`"${[command, ...args].join(" ")}"`
		];
		command = options.env?.comspec ?? "cmd.exe";
		options = {
			...options,
			windowsVerbatimArguments: true
		};
	}
	return {
		command,
		args,
		options
	};
}
/**
* Resolves the command to an absolute path if possible.
* Handles things like traversing PATH and adding extensions from PATHEXT
*/
function resolveCommand(command, options) {
	const cwd$3 = (options.cwd ?? cwd()).toString();
	const env = options.env ?? process.env;
	const PATH = getPathFromEnv(env).value;
	const pathEnv = command.includes("/") || command.includes("\\") ? [""] : [cwd$3, ...PATH.split(delimiter)];
	let pathExt = env.PATHEXT ? env.PATHEXT.split(delimiter) : defaultPathExt;
	if (command.includes(".") && pathExt[0] !== "") pathExt = ["", ...pathExt];
	for (const extensions of [pathExt, noPathExt]) for (const path of pathEnv) {
		const dest = resolve(cwd$3, path.startsWith("\"") && path.endsWith("\"") && path.length > 1 ? path.slice(1, -1) : path, command);
		for (const ext of extensions) {
			const destWithExt = dest + ext;
			try {
				if (statSync(destWithExt).isFile()) return destWithExt;
			} catch {}
		}
	}
	return null;
}
var NonZeroExitError = class extends Error {
	result;
	output;
	exitCode;
	get signalCode() {
		return this.result.signalCode;
	}
	constructor(result, output, command, args) {
		let target = "The process";
		if (command) target = `The command \`${args?.length ? `${command} ${args.map((a) => /[ "'`()]/.test(a) ? JSON.stringify(a) : a).join(" ")}` : command}\``;
		const exitCode = result.exitCode ?? 1;
		super(result.signalCode !== null ? `${target} was killed by the signal ${result.signalCode}` : `${target} exited with a non-zero status (${exitCode})`);
		this.result = result;
		this.output = output;
		this.exitCode = exitCode;
		Object.defineProperty(this, "result", {
			enumerable: false,
			writable: false,
			configurable: false
		});
	}
};
const defaultOptions = {
	timeout: void 0,
	persist: false
};
const defaultNodeOptions = { windowsHide: true };
function combineSignals(signals) {
	const controller = new AbortController();
	for (const signal of signals) {
		if (signal.aborted) {
			controller.abort();
			return signal;
		}
		const onAbort = () => {
			controller.abort(signal.reason);
		};
		signal.addEventListener("abort", onAbort, { signal: controller.signal });
	}
	return controller.signal;
}
async function readStream(stream) {
	let output = "";
	try {
		for await (const chunk of stream) output += chunk.toString();
	} catch {}
	return output;
}
var ExecProcess = class {
	_process;
	_aborted = false;
	_options;
	_command;
	_args;
	_resolveClose;
	_processClosed;
	_thrownError;
	get process() {
		return this._process;
	}
	get pid() {
		return this._process?.pid;
	}
	get exitCode() {
		if (this._process && this._process.exitCode !== null) return this._process.exitCode;
	}
	get signalCode() {
		return this._process?.signalCode ?? null;
	}
	constructor(command, args, options) {
		this._options = {
			...defaultOptions,
			...options
		};
		this._command = command;
		this._args = args ?? [];
		this._processClosed = new Promise((resolve) => {
			this._resolveClose = resolve;
		});
	}
	kill(signal) {
		return this._process?.kill(signal) === true;
	}
	get aborted() {
		return this._aborted;
	}
	get killed() {
		return this._process?.killed === true;
	}
	pipe(command, args, options) {
		return exec(command, args, {
			...options,
			stdin: this
		});
	}
	async *[Symbol.asyncIterator]() {
		const proc = this._process;
		if (!proc) return;
		const streams = [];
		if (this._streamErr) streams.push(this._streamErr);
		if (this._streamOut) streams.push(this._streamOut);
		const streamCombined = combineStreams(streams);
		const rl = readline.createInterface({ input: streamCombined });
		for await (const chunk of rl) yield chunk.toString();
		await this._processClosed;
		proc.removeAllListeners();
		if (this._thrownError) throw this._thrownError;
		if (this._options?.throwOnError && (this.exitCode !== 0 && this.exitCode !== void 0 || this.signalCode !== null)) throw new NonZeroExitError(this, void 0, this._command, this._args);
	}
	async _waitForOutput() {
		const proc = this._process;
		if (!proc) throw new Error("No process was started");
		const [stdout, stderr] = await Promise.all([this._streamOut ? readStream(this._streamOut) : "", this._streamErr ? readStream(this._streamErr) : ""]);
		await this._processClosed;
		const { stdin } = this._options;
		if (stdin && typeof stdin !== "string") await stdin;
		proc.removeAllListeners();
		if (this._thrownError) throw this._thrownError;
		const result = {
			stderr,
			stdout,
			exitCode: this.exitCode
		};
		if (this._options.throwOnError && (this.exitCode !== 0 && this.exitCode !== void 0 || this.signalCode !== null)) throw new NonZeroExitError(this, result, this._command, this._args);
		return result;
	}
	then(onfulfilled, onrejected) {
		return this._waitForOutput().then(onfulfilled, onrejected);
	}
	_streamOut;
	_streamErr;
	spawn() {
		const cwd$1 = cwd();
		const options = this._options;
		const nodeOptions = {
			...defaultNodeOptions,
			...options.nodeOptions
		};
		const signals = [];
		this._resetState();
		if (options.timeout !== void 0) signals.push(AbortSignal.timeout(options.timeout));
		if (options.signal !== void 0) signals.push(options.signal);
		if (options.persist === true) nodeOptions.detached = true;
		if (signals.length > 0) nodeOptions.signal = combineSignals(signals);
		nodeOptions.env = computeEnv(cwd$1, nodeOptions.env, options.nodePath);
		const crossResult = normalizeSpawnCommand(this._command, this._args, nodeOptions);
		const handle = spawn(crossResult.command, crossResult.args, crossResult.options);
		if (handle.stderr) this._streamErr = handle.stderr;
		if (handle.stdout) this._streamOut = handle.stdout;
		this._process = handle;
		handle.once("error", this._onError);
		handle.once("close", this._onClose);
		if (handle.stdin) {
			const { stdin } = options;
			if (typeof stdin === "string") handle.stdin.end(stdin);
			else stdin?.process?.stdout?.pipe(handle.stdin);
		}
	}
	_resetState() {
		this._aborted = false;
		this._processClosed = new Promise((resolve) => {
			this._resolveClose = resolve;
		});
		this._thrownError = void 0;
	}
	_onError = (err) => {
		if (err.name === "AbortError" && (!(err.cause instanceof Error) || err.cause.name !== "TimeoutError")) {
			this._aborted = true;
			return;
		}
		this._thrownError = err;
	};
	_onClose = () => {
		if (this._resolveClose) this._resolveClose();
	};
};
const x = (command, args, userOptions) => {
	const proc = new ExecProcess(command, args, userOptions);
	proc.spawn();
	return proc;
};
const exec = x;
//#endregion
export { __toESM as A, resolveComma as C, __commonJSMin as D, toArray as E, __exportAll as O, pkgExists as S, slash as T, createConcurrencyExecutor as _, namespaces as a, matchPattern as b, blue as c, green as d, hex as f, yellow as g, underline as h, enable as i, __require as k, bold as l, rgb as m, x as n, bgRed as o, red as p, createDebug as r, bgYellow as s, exec as t, dim as u, debounce as v, resolveRegex as w, noop as x, importWithError as y };
