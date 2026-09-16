import { A as __toESM, C as resolveComma, D as __commonJSMin, E as toArray, O as __exportAll$1, S as pkgExists, T as slash, _ as createConcurrencyExecutor, b as matchPattern, c as blue, d as green, g as yellow, h as underline, l as bold, n as x$1, r as createDebug, t as exec, u as dim, v as debounce, w as resolveRegex, x as noop, y as importWithError } from "./main-Bcv7jU2b.js";
import { a as createSuppressWarnings, c as globalLogger, i as createLogger, l as prettyFormat, n as version, o as generateColor, r as LogLevels, s as getNameLabel } from "./debug-CKcBYQLP-By_AQqN8.js";
import { A as fsStat, D as fsCopy, E as formatBytes, M as stripExtname, O as fsExists, S as filename_js_to_dts, a as resolveTarget, d as satisfies, g as RE_JS, j as lowestCommonAncestor, k as fsRemove, m as RE_DTS, o as validateSea, p as RE_CSS, r as buildExe, s as coerce, u as parseRange, v as RE_NODE_MODULES$1 } from "./target-Bab3CUeB-8PBzMh3p.js";
import module$1, { builtinModules, createRequire, isBuiltin } from "node:module";
import process$1 from "node:process";
import readline from "node:readline";
import { formatWithOptions, inspect, isDeepStrictEqual, parseEnv, promisify } from "node:util";
import path, { dirname, isAbsolute, join, parse, resolve } from "node:path";
import re, { existsSync, readFileSync, writeFileSync } from "node:fs";
import { VERSION, build, watch } from "@voidzero-dev/vite-plus-core/rolldown";
import { chmod, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { and, id, importerId, include } from "@voidzero-dev/vite-plus-core/rolldown/filter";
import * as nativeFs from "fs";
import Ue, { readdir as readdir$1, readdirSync, realpath, realpathSync, stat as stat$1, statSync as statSync$1 } from "fs";
import Ie from "os";
import Se, { basename as basename$1, dirname as dirname$1, isAbsolute as isAbsolute$1, normalize as normalize$1, posix, relative, resolve as resolve$1, sep } from "path";
import { Visitor, parse as parse$1 } from "@voidzero-dev/vite-plus-core/rolldown/utils";
import { tmpdir } from "node:os";
import { fileURLToPath } from "url";
import { createRequire as createRequire$1 } from "module";
import { fileURLToPath as fileURLToPath$1, pathToFileURL } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import { Buffer } from "node:buffer";
import { brotliCompress, gzip } from "node:zlib";
import { importGlobPlugin } from "@voidzero-dev/vite-plus-core/rolldown/experimental";
//#region ../../node_modules/.pnpm/resolve-pkg-maps@1.0.0/node_modules/resolve-pkg-maps/dist/index.mjs
const A = (r) => r !== null && typeof r == "object";
const a = (r, t) => Object.assign(/* @__PURE__ */ new Error(`[${r}]: ${t}`), { code: r });
const _$1 = "ERR_INVALID_PACKAGE_CONFIG";
const E = "ERR_INVALID_PACKAGE_TARGET";
const I$1 = "ERR_PACKAGE_PATH_NOT_EXPORTED";
const R$1 = /^\d+$/;
const O = /^(\.{1,2}|node_modules)$/i;
const w = /\/|\\/;
var h = ((r) => (r.Export = "exports", r.Import = "imports", r))(h || {});
const f = (r, t, e, o, c) => {
	if (t == null) return [];
	if (typeof t == "string") {
		const [n, ...i] = t.split(w);
		if (n === ".." || i.some((l) => O.test(l))) throw a(E, `Invalid "${r}" target "${t}" defined in the package config`);
		return [c ? t.replace(/\*/g, c) : t];
	}
	if (Array.isArray(t)) return t.flatMap((n) => f(r, n, e, o, c));
	if (A(t)) {
		for (const n of Object.keys(t)) {
			if (R$1.test(n)) throw a(_$1, "Cannot contain numeric property keys");
			if (n === "default" || o.includes(n)) return f(r, t[n], e, o, c);
		}
		return [];
	}
	throw a(E, `Invalid "${r}" target "${t}"`);
};
const s = "*";
const m = (r, t) => {
	const e = r.indexOf(s), o = t.indexOf(s);
	return e === o ? t.length > r.length : o > e;
};
function d(r, t) {
	if (!t.includes(s) && r.hasOwnProperty(t)) return [t];
	let e, o;
	for (const c of Object.keys(r)) if (c.includes(s)) {
		const [n, i, l] = c.split(s);
		if (l === void 0 && t.startsWith(n) && t.endsWith(i)) {
			const g = t.slice(n.length, -i.length || void 0);
			g && (!e || m(e, c)) && (e = c, o = g);
		}
	}
	return [e, o];
}
const p = (r) => Object.keys(r).reduce((t, e) => {
	const o = e === "" || e[0] !== ".";
	if (t === void 0 || t === o) return o;
	throw a(_$1, "\"exports\" cannot contain some keys starting with \".\" and some not");
}, void 0);
const u = /^\w+:/;
const v = (r, t, e) => {
	if (!r) throw new Error("\"exports\" is required");
	t = t === "" ? "." : `./${t}`, (typeof r == "string" || Array.isArray(r) || A(r) && p(r)) && (r = { ".": r });
	const [o, c] = d(r, t), n = f(h.Export, r[o], t, e, c);
	if (n.length === 0) throw a(I$1, t === "." ? "No \"exports\" main defined" : `Package subpath '${t}' is not defined by "exports"`);
	for (const i of n) if (!i.startsWith("./") && !u.test(i)) throw a(E, `Invalid "exports" target "${i}" defined in the package config`);
	return n;
};
//#endregion
//#region ../../node_modules/.pnpm/get-tsconfig@5.0.0-beta.5/node_modules/get-tsconfig/dist/index.mjs
var Le = Object.defineProperty;
var i = (e, n) => Le(e, "name", {
	value: n,
	configurable: !0
});
function x(e) {
	return e.startsWith("\\\\?\\") ? e : e.replace(/\\/g, "/");
}
i(x, "slash");
const _e = i((e, n) => {
	const s = `readFileSync:${n}`;
	let t = e?.get(s);
	return t === void 0 && (t = re.readFileSync(n, "utf8"), e?.set(s, t)), t;
}, "readFile");
const F = i((e, n) => {
	const s = `tryStat:${n}`;
	let t = e?.get(s);
	if (t === void 0) {
		try {
			t = re.statSync(n);
		} catch {
			t = null;
		}
		e?.set(s, t);
	}
	return t ?? void 0;
}, "tryStat");
const R = i((e, n, s) => {
	for (;;) {
		const t = path.posix.join(e, n);
		if (F(s, t)) return t;
		const o = path.dirname(e);
		if (o === e) return;
		e = o;
	}
}, "findUp");
function Ne(e, n = !1) {
	const s = e.length;
	let t = 0, o = "", r = 0, l = 16, g = 0, m = 0, k = 0, w = 0, u = 0;
	function A(f, y) {
		let j = 0, v = 0;
		for (; j < f;) {
			let d = e.charCodeAt(t);
			if (d >= 48 && d <= 57) v = v * 16 + d - 48;
			else if (d >= 65 && d <= 70) v = v * 16 + d - 65 + 10;
			else if (d >= 97 && d <= 102) v = v * 16 + d - 97 + 10;
			else break;
			t++, j++;
		}
		return j < f && (v = -1), v;
	}
	i(A, "scanHexDigits");
	function O(f) {
		t = f, o = "", r = 0, l = 16, u = 0;
	}
	i(O, "setPosition");
	function h() {
		let f = t;
		if (e.charCodeAt(t) === 48) t++;
		else for (t++; t < e.length && S(e.charCodeAt(t));) t++;
		if (t < e.length && e.charCodeAt(t) === 46) if (t++, t < e.length && S(e.charCodeAt(t))) for (t++; t < e.length && S(e.charCodeAt(t));) t++;
		else return u = 3, e.substring(f, t);
		let y = t;
		if (t < e.length && (e.charCodeAt(t) === 69 || e.charCodeAt(t) === 101)) if (t++, (t < e.length && e.charCodeAt(t) === 43 || e.charCodeAt(t) === 45) && t++, t < e.length && S(e.charCodeAt(t))) {
			for (t++; t < e.length && S(e.charCodeAt(t));) t++;
			y = t;
		} else u = 3;
		return e.substring(f, y);
	}
	i(h, "scanNumber");
	function D() {
		let f = "", y = t;
		for (;;) {
			if (t >= s) {
				f += e.substring(y, t), u = 2;
				break;
			}
			const j = e.charCodeAt(t);
			if (j === 34) {
				f += e.substring(y, t), t++;
				break;
			}
			if (j === 92) {
				if (f += e.substring(y, t), t++, t >= s) {
					u = 2;
					break;
				}
				switch (e.charCodeAt(t++)) {
					case 34:
						f += "\"";
						break;
					case 92:
						f += "\\";
						break;
					case 47:
						f += "/";
						break;
					case 98:
						f += "\b";
						break;
					case 102:
						f += "\f";
						break;
					case 110:
						f += `
`;
						break;
					case 114:
						f += "\r";
						break;
					case 116:
						f += "	";
						break;
					case 117:
						const d = A(4);
						d >= 0 ? f += String.fromCharCode(d) : u = 4;
						break;
					default: u = 5;
				}
				y = t;
				continue;
			}
			if (j >= 0 && j <= 31) if (P(j)) {
				f += e.substring(y, t), u = 2;
				break;
			} else u = 6;
			t++;
		}
		return f;
	}
	i(D, "scanString");
	function c() {
		if (o = "", u = 0, r = t, m = g, w = k, t >= s) return r = s, l = 17;
		let f = e.charCodeAt(t);
		if (X(f)) {
			do
				t++, o += String.fromCharCode(f), f = e.charCodeAt(t);
			while (X(f));
			return l = 15;
		}
		if (P(f)) return t++, o += String.fromCharCode(f), f === 13 && e.charCodeAt(t) === 10 && (t++, o += `
`), g++, k = t, l = 14;
		switch (f) {
			case 123: return t++, l = 1;
			case 125: return t++, l = 2;
			case 91: return t++, l = 3;
			case 93: return t++, l = 4;
			case 58: return t++, l = 6;
			case 44: return t++, l = 5;
			case 34: return t++, o = D(), l = 10;
			case 47:
				const y = t - 1;
				if (e.charCodeAt(t + 1) === 47) {
					for (t += 2; t < s && !P(e.charCodeAt(t));) t++;
					return o = e.substring(y, t), l = 12;
				}
				if (e.charCodeAt(t + 1) === 42) {
					t += 2;
					const j = s - 1;
					let v = !1;
					for (; t < j;) {
						const d = e.charCodeAt(t);
						if (d === 42 && e.charCodeAt(t + 1) === 47) {
							t += 2, v = !0;
							break;
						}
						t++, P(d) && (d === 13 && e.charCodeAt(t) === 10 && t++, g++, k = t);
					}
					return v || (t++, u = 1), o = e.substring(y, t), l = 13;
				}
				return o += String.fromCharCode(f), t++, l = 16;
			case 45: if (o += String.fromCharCode(f), t++, t === s || !S(e.charCodeAt(t))) return l = 16;
			case 48:
			case 49:
			case 50:
			case 51:
			case 52:
			case 53:
			case 54:
			case 55:
			case 56:
			case 57: return o += h(), l = 11;
			default:
				for (; t < s && p(f);) t++, f = e.charCodeAt(t);
				if (r !== t) {
					switch (o = e.substring(r, t), o) {
						case "true": return l = 8;
						case "false": return l = 9;
						case "null": return l = 7;
					}
					return l = 16;
				}
				return o += String.fromCharCode(f), t++, l = 16;
		}
	}
	i(c, "scanNext");
	function p(f) {
		if (X(f) || P(f)) return !1;
		switch (f) {
			case 125:
			case 93:
			case 123:
			case 91:
			case 34:
			case 58:
			case 44:
			case 47: return !1;
		}
		return !0;
	}
	i(p, "isUnknownContentCharacter");
	function b() {
		let f;
		do
			f = c();
		while (f >= 12 && f <= 15);
		return f;
	}
	return i(b, "scanNextNonTrivia"), {
		setPosition: O,
		getPosition: i(() => t, "getPosition"),
		scan: n ? b : c,
		getToken: i(() => l, "getToken"),
		getTokenValue: i(() => o, "getTokenValue"),
		getTokenOffset: i(() => r, "getTokenOffset"),
		getTokenLength: i(() => t - r, "getTokenLength"),
		getTokenStartLine: i(() => m, "getTokenStartLine"),
		getTokenStartCharacter: i(() => r - w, "getTokenStartCharacter"),
		getTokenError: i(() => u, "getTokenError")
	};
}
i(Ne, "createScanner");
function X(e) {
	return e === 32 || e === 9;
}
i(X, "isWhiteSpace");
function P(e) {
	return e === 10 || e === 13;
}
i(P, "isLineBreak");
function S(e) {
	return e >= 48 && e <= 57;
}
i(S, "isDigit");
var ce;
(function(e) {
	e[e.lineFeed = 10] = "lineFeed", e[e.carriageReturn = 13] = "carriageReturn", e[e.space = 32] = "space", e[e._0 = 48] = "_0", e[e._1 = 49] = "_1", e[e._2 = 50] = "_2", e[e._3 = 51] = "_3", e[e._4 = 52] = "_4", e[e._5 = 53] = "_5", e[e._6 = 54] = "_6", e[e._7 = 55] = "_7", e[e._8 = 56] = "_8", e[e._9 = 57] = "_9", e[e.a = 97] = "a", e[e.b = 98] = "b", e[e.c = 99] = "c", e[e.d = 100] = "d", e[e.e = 101] = "e", e[e.f = 102] = "f", e[e.g = 103] = "g", e[e.h = 104] = "h", e[e.i = 105] = "i", e[e.j = 106] = "j", e[e.k = 107] = "k", e[e.l = 108] = "l", e[e.m = 109] = "m", e[e.n = 110] = "n", e[e.o = 111] = "o", e[e.p = 112] = "p", e[e.q = 113] = "q", e[e.r = 114] = "r", e[e.s = 115] = "s", e[e.t = 116] = "t", e[e.u = 117] = "u", e[e.v = 118] = "v", e[e.w = 119] = "w", e[e.x = 120] = "x", e[e.y = 121] = "y", e[e.z = 122] = "z", e[e.A = 65] = "A", e[e.B = 66] = "B", e[e.C = 67] = "C", e[e.D = 68] = "D", e[e.E = 69] = "E", e[e.F = 70] = "F", e[e.G = 71] = "G", e[e.H = 72] = "H", e[e.I = 73] = "I", e[e.J = 74] = "J", e[e.K = 75] = "K", e[e.L = 76] = "L", e[e.M = 77] = "M", e[e.N = 78] = "N", e[e.O = 79] = "O", e[e.P = 80] = "P", e[e.Q = 81] = "Q", e[e.R = 82] = "R", e[e.S = 83] = "S", e[e.T = 84] = "T", e[e.U = 85] = "U", e[e.V = 86] = "V", e[e.W = 87] = "W", e[e.X = 88] = "X", e[e.Y = 89] = "Y", e[e.Z = 90] = "Z", e[e.asterisk = 42] = "asterisk", e[e.backslash = 92] = "backslash", e[e.closeBrace = 125] = "closeBrace", e[e.closeBracket = 93] = "closeBracket", e[e.colon = 58] = "colon", e[e.comma = 44] = "comma", e[e.dot = 46] = "dot", e[e.doubleQuote = 34] = "doubleQuote", e[e.minus = 45] = "minus", e[e.openBrace = 123] = "openBrace", e[e.openBracket = 91] = "openBracket", e[e.plus = 43] = "plus", e[e.slash = 47] = "slash", e[e.formFeed = 12] = "formFeed", e[e.tab = 9] = "tab";
})(ce || (ce = {})), new Array(20).fill(0).map((e, n) => " ".repeat(n));
const _ = 200;
new Array(_).fill(0).map((e, n) => `
` + " ".repeat(n)), new Array(_).fill(0).map((e, n) => "\r" + " ".repeat(n)), new Array(_).fill(0).map((e, n) => `\r
` + " ".repeat(n)), new Array(_).fill(0).map((e, n) => `
` + "	".repeat(n)), new Array(_).fill(0).map((e, n) => "\r" + "	".repeat(n)), new Array(_).fill(0).map((e, n) => `\r
` + "	".repeat(n));
var W;
(function(e) {
	e.DEFAULT = { allowTrailingComma: !1 };
})(W || (W = {}));
function Re(e, n = [], s = W.DEFAULT) {
	let t = null, o = [];
	const r = [];
	function l(m) {
		Array.isArray(o) ? o.push(m) : t !== null && (o[t] = m);
	}
	return i(l, "onValue"), Pe(e, {
		onObjectBegin: i(() => {
			const m = {};
			l(m), r.push(o), o = m, t = null;
		}, "onObjectBegin"),
		onObjectProperty: i((m) => {
			t = m;
		}, "onObjectProperty"),
		onObjectEnd: i(() => {
			o = r.pop();
		}, "onObjectEnd"),
		onArrayBegin: i(() => {
			const m = [];
			l(m), r.push(o), o = m, t = null;
		}, "onArrayBegin"),
		onArrayEnd: i(() => {
			o = r.pop();
		}, "onArrayEnd"),
		onLiteralValue: l,
		onError: i((m, k, w) => {
			n.push({
				error: m,
				offset: k,
				length: w
			});
		}, "onError")
	}, s), o[0];
}
i(Re, "parse$1");
function Pe(e, n, s = W.DEFAULT) {
	const t = Ne(e, !1), o = [];
	let r = 0;
	function l(T) {
		return T ? () => r === 0 && T(t.getTokenOffset(), t.getTokenLength(), t.getTokenStartLine(), t.getTokenStartCharacter()) : () => !0;
	}
	i(l, "toNoArgVisit");
	function g(T) {
		return T ? (E) => r === 0 && T(E, t.getTokenOffset(), t.getTokenLength(), t.getTokenStartLine(), t.getTokenStartCharacter()) : () => !0;
	}
	i(g, "toOneArgVisit");
	function m(T) {
		return T ? (E) => r === 0 && T(E, t.getTokenOffset(), t.getTokenLength(), t.getTokenStartLine(), t.getTokenStartCharacter(), () => o.slice()) : () => !0;
	}
	i(m, "toOneArgVisitWithPath");
	function k(T) {
		return T ? () => {
			r > 0 ? r++ : T(t.getTokenOffset(), t.getTokenLength(), t.getTokenStartLine(), t.getTokenStartCharacter(), () => o.slice()) === !1 && (r = 1);
		} : () => !0;
	}
	i(k, "toBeginVisit");
	function w(T) {
		return T ? () => {
			r > 0 && r--, r === 0 && T(t.getTokenOffset(), t.getTokenLength(), t.getTokenStartLine(), t.getTokenStartCharacter());
		} : () => !0;
	}
	i(w, "toEndVisit");
	const u = k(n.onObjectBegin), A = m(n.onObjectProperty), O = w(n.onObjectEnd), h = k(n.onArrayBegin), D = w(n.onArrayEnd), c = m(n.onLiteralValue), p = g(n.onSeparator), b = l(n.onComment), f = g(n.onError), y = s && s.disallowComments, j = s && s.allowTrailingComma;
	function v() {
		for (;;) {
			const T = t.scan();
			switch (t.getTokenError()) {
				case 4:
					d(14);
					break;
				case 5:
					d(15);
					break;
				case 3:
					d(13);
					break;
				case 1:
					y || d(11);
					break;
				case 2:
					d(12);
					break;
				case 6: d(16);
			}
			switch (T) {
				case 12:
				case 13:
					y ? d(10) : b();
					break;
				case 16:
					d(1);
					break;
				case 15:
				case 14: break;
				default: return T;
			}
		}
	}
	i(v, "scanNext");
	function d(T, E = [], ie = []) {
		if (f(T), E.length + ie.length > 0) {
			let V = t.getToken();
			for (; V !== 17;) {
				if (E.indexOf(V) !== -1) {
					v();
					break;
				} else if (ie.indexOf(V) !== -1) break;
				V = v();
			}
		}
	}
	i(d, "handleError");
	function L(T) {
		const E = t.getTokenValue();
		return T ? c(E) : (A(E), o.push(E)), v(), !0;
	}
	i(L, "parseString");
	function B() {
		switch (t.getToken()) {
			case 11:
				const T = t.getTokenValue();
				let E = Number(T);
				isNaN(E) && (d(2), E = 0), c(E);
				break;
			case 7:
				c(null);
				break;
			case 8:
				c(!0);
				break;
			case 9:
				c(!1);
				break;
			default: return !1;
		}
		return v(), !0;
	}
	i(B, "parseLiteral");
	function $() {
		return t.getToken() !== 10 ? (d(3, [], [2, 5]), !1) : (L(!1), t.getToken() === 6 ? (p(":"), v(), H() || d(4, [], [2, 5])) : d(5, [], [2, 5]), o.pop(), !0);
	}
	i($, "parseProperty");
	function N() {
		u(), v();
		let T = !1;
		for (; t.getToken() !== 2 && t.getToken() !== 17;) {
			if (t.getToken() === 5) {
				if (T || d(4, [], []), p(","), v(), t.getToken() === 2 && j) break;
			} else T && d(6, [], []);
			$() || d(4, [], [2, 5]), T = !0;
		}
		return O(), t.getToken() !== 2 ? d(7, [2], []) : v(), !0;
	}
	i(N, "parseObject");
	function $e() {
		h(), v();
		let T = !0, E = !1;
		for (; t.getToken() !== 4 && t.getToken() !== 17;) {
			if (t.getToken() === 5) {
				if (E || d(4, [], []), p(","), v(), t.getToken() === 4 && j) break;
			} else E && d(6, [], []);
			T ? (o.push(0), T = !1) : o[o.length - 1]++, H() || d(4, [], [4, 5]), E = !0;
		}
		return D(), T || o.pop(), t.getToken() !== 4 ? d(8, [4], []) : v(), !0;
	}
	i($e, "parseArray");
	function H() {
		switch (t.getToken()) {
			case 3: return $e();
			case 1: return N();
			case 10: return L(!0);
			default: return B();
		}
	}
	return i(H, "parseValue"), v(), t.getToken() === 17 ? s.allowEmptyContent ? !0 : (d(4, [], []), !1) : H() ? (t.getToken() !== 17 && d(9, [], []), !0) : (d(4, [], []), !1);
}
i(Pe, "visit");
var fe;
(function(e) {
	e[e.None = 0] = "None", e[e.UnexpectedEndOfComment = 1] = "UnexpectedEndOfComment", e[e.UnexpectedEndOfString = 2] = "UnexpectedEndOfString", e[e.UnexpectedEndOfNumber = 3] = "UnexpectedEndOfNumber", e[e.InvalidUnicode = 4] = "InvalidUnicode", e[e.InvalidEscapeCharacter = 5] = "InvalidEscapeCharacter", e[e.InvalidCharacter = 6] = "InvalidCharacter";
})(fe || (fe = {}));
var ue;
(function(e) {
	e[e.OpenBraceToken = 1] = "OpenBraceToken", e[e.CloseBraceToken = 2] = "CloseBraceToken", e[e.OpenBracketToken = 3] = "OpenBracketToken", e[e.CloseBracketToken = 4] = "CloseBracketToken", e[e.CommaToken = 5] = "CommaToken", e[e.ColonToken = 6] = "ColonToken", e[e.NullKeyword = 7] = "NullKeyword", e[e.TrueKeyword = 8] = "TrueKeyword", e[e.FalseKeyword = 9] = "FalseKeyword", e[e.StringLiteral = 10] = "StringLiteral", e[e.NumericLiteral = 11] = "NumericLiteral", e[e.LineCommentTrivia = 12] = "LineCommentTrivia", e[e.BlockCommentTrivia = 13] = "BlockCommentTrivia", e[e.LineBreakTrivia = 14] = "LineBreakTrivia", e[e.Trivia = 15] = "Trivia", e[e.Unknown = 16] = "Unknown", e[e.EOF = 17] = "EOF";
})(ue || (ue = {}));
const Ve = Re;
var ae;
(function(e) {
	e[e.InvalidSymbol = 1] = "InvalidSymbol", e[e.InvalidNumberFormat = 2] = "InvalidNumberFormat", e[e.PropertyNameExpected = 3] = "PropertyNameExpected", e[e.ValueExpected = 4] = "ValueExpected", e[e.ColonExpected = 5] = "ColonExpected", e[e.CommaExpected = 6] = "CommaExpected", e[e.CloseBraceExpected = 7] = "CloseBraceExpected", e[e.CloseBracketExpected = 8] = "CloseBracketExpected", e[e.EndOfFileExpected = 9] = "EndOfFileExpected", e[e.InvalidCommentToken = 10] = "InvalidCommentToken", e[e.UnexpectedEndOfComment = 11] = "UnexpectedEndOfComment", e[e.UnexpectedEndOfString = 12] = "UnexpectedEndOfString", e[e.UnexpectedEndOfNumber = 13] = "UnexpectedEndOfNumber", e[e.InvalidUnicode = 14] = "InvalidUnicode", e[e.InvalidEscapeCharacter = 15] = "InvalidEscapeCharacter", e[e.InvalidCharacter = 16] = "InvalidCharacter";
})(ae || (ae = {}));
const Y = i((e, n) => Ve(_e(n, e)), "readJsonc");
const pe = i(() => {
	const { findPnpApi: e } = module$1;
	return e && e(process.cwd());
}, "getPnpApi");
const We = "detectTypeScriptVersion:";
const Me = i((e, n) => {
	const s = `${We}${e}`, t = n?.get(s);
	if (t !== void 0) return t ?? void 0;
	let o;
	const r = pe();
	if (r) try {
		o = r.resolveRequest("typescript/package.json", e) ?? void 0;
	} catch {}
	o ??= R(path.resolve(e), path.join("node_modules", "typescript", "package.json"), n);
	let l;
	if (o) try {
		const g = Y(o, n);
		typeof g?.version == "string" && (l = g.version);
	} catch {}
	return n?.set(s, l ?? null), l;
}, "detectTypeScriptVersion");
const I = "package.json";
const M = "tsconfig.json";
const Je = i((e, n, s) => {
	const t = module$1.createRequire(path.join(s, "tsconfig.json"));
	if (e !== n) try {
		return t.resolve(e);
	} catch {}
	try {
		return t.resolve(n);
	} catch {}
	try {
		return t.resolve(`${n}/${I}`);
	} catch {}
}, "resolvePackageEntryWithNode");
const Z = i((e, n, s, t) => {
	const o = `resolveFromPackageJsonPath:${e}:${n}:${s}`;
	if (t?.has(o)) return t.get(o) || !1;
	const r = Y(e, t);
	if (!r) return;
	let l = n || M;
	if (!s && r.exports) try {
		const [g] = v(r.exports, n, ["require", "types"]);
		l = g;
	} catch {
		return t?.set(o, ""), !1;
	}
	else !n && r.tsconfig && (l = r.tsconfig);
	return l = path.join(e, "..", l), t?.set(o, l), l;
}, "resolveFromPackageJsonPath");
const ze = i((e, n, s) => {
	const t = `resolveExtendsPath:${e}:${n}`;
	if (s?.has(t)) return s.get(t) || void 0;
	const o = Ge(e, n, s);
	return s?.set(t, o || ""), o;
}, "resolveExtendsPath");
const Ge = i((e, n, s) => {
	let t = e;
	if (e === ".." && (t = path.join(t, M)), e[0] === "." && (t = path.resolve(n, t)), path.isAbsolute(t)) {
		const c = F(s, t);
		if (c) {
			if (c.isFile()) return t;
		} else if (!t.endsWith(".json")) {
			const p = `${t}.json`;
			if (F(s, p)) return p;
		}
		return;
	}
	const [o, ...r] = e.split("/"), l = o[0] === "@" ? `${o}/${r.shift()}` : o, g = r.join("/"), m = pe();
	if (m) {
		const { resolveRequest: c } = m;
		try {
			if (l === e) {
				const p = c(path.join(l, I), n);
				if (p) {
					const b = Z(p, g, !1, s);
					if (b && F(s, b)) return b;
				}
			} else {
				let p;
				try {
					p = c(e, n, { extensions: [".json"] });
				} catch {
					p = c(path.join(e, M), n);
				}
				if (p) return p;
			}
		} catch {}
	}
	const k = Je(e, l, n);
	let w;
	if (k) {
		if (path.basename(k) !== I && k.endsWith(".json")) return k;
		w = path.basename(k) === I ? k : R(path.dirname(k), I, s);
	}
	const u = w && path.dirname(w) || R(path.resolve(n), path.join("node_modules", l), s);
	if (!u || !F(s, u)?.isDirectory()) return;
	const A = path.join(u, I);
	if (F(s, A)) {
		const c = Z(A, g, !1, s);
		if (c === !1) return;
		if (c && F(s, c)?.isFile()) return c;
	}
	const O = path.join(u, g), h = O.endsWith(".json");
	if (!h) {
		const c = `${O}.json`;
		if (F(s, c)) return c;
	}
	const D = F(s, O);
	if (D) {
		if (D.isDirectory()) {
			const c = path.join(O, I);
			if (F(s, c)) {
				const b = Z(c, "", !0, s);
				if (b && F(s, b)) return b;
			}
			const p = path.join(O, M);
			if (F(s, p)) return p;
		} else if (h) return O;
	}
}, "resolveExtendsPathUncached");
const q = Symbol("implicitBaseUrl");
const U = "${configDir}";
const K = /^\.{1,2}(\/.*)?$/;
const J = i((e) => {
	const n = x(e);
	return K.test(n) ? n : `./${n}`;
}, "normalizeRelativePath");
const Qe = i((e) => {
	const n = { ...e };
	if (n.strict) for (const t of [
		"noImplicitAny",
		"noImplicitThis",
		"strictNullChecks",
		"strictFunctionTypes",
		"strictBindCallApply",
		"strictPropertyInitialization",
		"strictBuiltinIteratorReturn",
		"alwaysStrict",
		"useUnknownInCatchVariables"
	]) n[t] === void 0 && (n[t] = !0);
	if (n.composite && (n.declaration ??= !0, n.incremental ??= !0), n.target) {
		let s = n.target.toLowerCase();
		s === "es2015" && (s = "es6"), n.target = s, s === "esnext" && (n.module ??= "es6", n.useDefineForClassFields ??= !0), (s === "es6" || s === "es2016" || s === "es2017" || s === "es2018" || s === "es2019" || s === "es2020" || s === "es2021" || s === "es2022" || s === "es2023" || s === "es2024" || s === "es2025") && (n.module ??= "es6"), (s === "es2022" || s === "es2023" || s === "es2024" || s === "es2025") && (n.useDefineForClassFields ??= !0);
	}
	if (n.module) {
		let s = n.module.toLowerCase();
		if (s === "es2015" && (s = "es6"), n.module = s, (s === "es6" || s === "es2020" || s === "es2022" || s === "esnext" || s === "none" || s === "system" || s === "umd" || s === "amd") && (n.moduleResolution ??= "classic"), s === "system" && (n.allowSyntheticDefaultImports ??= !0), (s === "node16" || s === "node18" || s === "node20" || s === "nodenext" || s === "preserve") && (n.esModuleInterop ??= !0, n.allowSyntheticDefaultImports ??= !0), (s === "node16" || s === "node18" || s === "node20" || s === "nodenext") && (n.moduleDetection ??= "force"), (s === "node16" || s === "node18") && (n.target ??= "es2022", n.moduleResolution ??= "node16"), s === "node20" && (n.target ??= "es2023", n.moduleResolution ??= "node16", n.resolveJsonModule ??= !0), s === "nodenext" && (n.target ??= "esnext", n.moduleResolution ??= "nodenext", n.resolveJsonModule ??= !0), s === "node16" || s === "node18" || s === "node20" || s === "nodenext") {
			const t = n.target;
			(t === "es3" || t === "es2022" || t === "es2023" || t === "es2024" || t === "esnext") && (n.useDefineForClassFields ??= !0);
		}
		s === "preserve" && (n.moduleResolution ??= "bundler");
	}
	if (n.moduleResolution) {
		let s = n.moduleResolution.toLowerCase();
		s === "node" && (s = "node10"), n.moduleResolution = s, (s === "node16" || s === "nodenext" || s === "bundler") && (n.resolvePackageJsonExports ??= !0, n.resolvePackageJsonImports ??= !0), s === "bundler" && (n.allowSyntheticDefaultImports ??= !0, n.resolveJsonModule ??= !0);
	}
	for (const s of [
		"jsx",
		"moduleDetection",
		"importsNotUsedAsValues",
		"newLine"
	]) n[s] && (n[s] = n[s].toLowerCase());
	return n.esModuleInterop && (n.allowSyntheticDefaultImports ??= !0), n.verbatimModuleSyntax && (n.isolatedModules ??= !0, n.preserveConstEnums ??= !0), n.isolatedModules && (n.preserveConstEnums ??= !0), n.rewriteRelativeImportExtensions && (n.allowImportingTsExtensions ??= !0), n.lib && (n.lib = n.lib.map((s) => s.toLowerCase())), n.checkJs && (n.allowJs ??= !0), n;
}, "normalizeCompilerOptions");
const He = i((e, n) => {
	!n.has("target") && !Xe(e.module) && (e.target = "es3");
}, "applyV4Defaults");
const Xe = i((e) => e === "node16" || e === "node18" || e === "node20" || e === "nodenext", "moduleDictatesTarget$1");
const Ye = i((e, n) => {
	!n.has("target") && !Ze(e.module) && (e.target = "es5");
}, "applyV5Defaults");
const Ze = i((e) => e === "node16" || e === "node18" || e === "node20" || e === "nodenext", "moduleDictatesTarget");
const qe = i((e, n) => {
	n.has("strict") || (e.strict = !0), n.has("target") || (e.target = "es2025"), n.has("module") || (e.module = "es2022"), n.has("moduleResolution") || (e.moduleResolution = "bundler"), n.has("rootDir") || (e.rootDir = "."), n.has("types") || (e.types = []), n.has("noUncheckedSideEffectImports") || (e.noUncheckedSideEffectImports = !0), n.has("libReplacement") || (e.libReplacement = !1);
}, "applyV6Defaults");
const Ke = [
	[4, He],
	[5, Ye],
	[6, qe]
];
const Ce = i((e) => {
	const n = /^v?(\d+)/.exec(e);
	return n ? Number(n[1]) : void 0;
}, "parseMajor");
const et = i((e, n) => {
	const s = Ce(n);
	if (s === void 0) return;
	const t = new Set(Object.keys(e));
	for (const [o, r] of Ke) o <= s && r(e, t);
}, "applyVersionDefaults");
const C = i((e, n) => J(path.relative(e, n)), "pathRelative");
const me = [
	"files",
	"include",
	"exclude"
];
const ge = i((e, n, s) => {
	const t = path.join(n, s);
	return x(path.relative(e, t)) || "./";
}, "resolveAndRelativize");
const tt = i((e, n, s) => {
	const t = path.relative(e, n);
	if (!t) return s;
	return x(`${t}/${s.startsWith("./") ? s.slice(2) : s}`);
}, "prefixPattern");
const de = ["outDir", "declarationDir"];
const z = i((e, n) => {
	if (e.startsWith(U)) return x(path.join(n, e.slice(12)));
}, "interpolateConfigDir");
const nt = [
	"outDir",
	"declarationDir",
	"outFile",
	"rootDir",
	"baseUrl",
	"tsBuildInfoFile"
];
const ke = i((e, n = {}) => {
	if (e.length === 0) throw new Error("Chain must not be empty");
	const { typescriptVersion: s } = n, t = new Map(e.map((u) => [u.path, u])), o = /* @__PURE__ */ new Map(), r = i((u) => {
		const A = o.get(u);
		if (A) return A;
		const O = t.get(u);
		if (!O) throw new Error(`Config not found in chain: ${u}`);
		const h = O.config, D = path.dirname(u);
		let c = {
			...h,
			...h.compilerOptions && { compilerOptions: { ...h.compilerOptions } },
			...h.watchOptions && { watchOptions: { ...h.watchOptions } }
		};
		if (delete c.extends, c.compilerOptions?.paths && !c.compilerOptions.baseUrl && (c.compilerOptions[q] = D), h.extends) {
			const p = Array.isArray(h.extends) ? h.extends : [h.extends];
			for (const b of p.toReversed()) {
				const f = r(b), y = path.dirname(b), { references: j, ...v } = f;
				if (v.compilerOptions) {
					const L = { ...v.compilerOptions };
					for (const B of [
						"baseUrl",
						"outDir",
						"declarationDir",
						"rootDir"
					]) {
						const $ = L[B];
						$ && !$.startsWith(U) && (L[B] = ge(D, y, $));
					}
					for (const B of ["rootDirs", "typeRoots"]) {
						const $ = L[B];
						$ && (L[B] = $.map((N) => N.startsWith(U) ? N : ge(D, y, N)));
					}
					v.compilerOptions = L;
				}
				for (const L of me) {
					const B = v[L];
					B && (v[L] = B.map(($) => $.startsWith(U) ? $ : tt(D, y, $)));
				}
				const d = {
					...v,
					...c,
					compilerOptions: {
						...v.compilerOptions,
						...c.compilerOptions
					}
				};
				v.watchOptions && (d.watchOptions = {
					...v.watchOptions,
					...c.watchOptions
				}), c = d;
			}
		}
		if (c.compilerOptions) {
			const { compilerOptions: p } = c;
			for (const f of ["baseUrl", "rootDir"]) {
				const y = p[f];
				if (y && !y.startsWith(U)) {
					const j = path.resolve(D, y);
					p[f] = C(D, j);
				}
			}
			for (const f of de) {
				let y = p[f];
				y && (Array.isArray(c.exclude) || (c.exclude = de.map((j) => p[j]).filter(Boolean)), y.startsWith(U) || (y = J(y)), p[f] = y);
			}
		} else c.compilerOptions = {};
		if (c.include && (c.include = c.include.map(x)), c.files && (c.files = c.files.map((p) => p.startsWith(U) ? p : J(p))), c.watchOptions) {
			const { watchOptions: p } = c;
			for (const b of ["excludeDirectories", "excludeFiles"]) p[b] && (p[b] = p[b].map((f) => x(path.resolve(D, f))));
			for (const b of [
				"watchFile",
				"watchDirectory",
				"fallbackPolling"
			]) if (p[b]) {
				const f = p;
				f[b] = p[b].toLowerCase();
			}
		}
		return o.set(u, c), c;
	}, "resolveEntry"), l = e[0], g = r(l.path), m = path.dirname(l.path), k = {
		...g,
		compilerOptions: g.compilerOptions ? { ...g.compilerOptions } : {}
	}, { compilerOptions: w } = k;
	if (w) {
		for (const u of nt) {
			const A = w[u];
			if (A) {
				const O = z(A, m);
				w[u] = O ? C(m, O) : A;
			}
		}
		for (const u of ["rootDirs", "typeRoots"]) {
			const A = w[u];
			A && (w[u] = A.map((O) => {
				const h = z(O, m);
				return h ? C(m, h) : J(O);
			}));
		}
		if (w.paths) {
			const u = {};
			for (const [A, O] of Object.entries(w.paths)) u[A] = O.map((h) => z(h, m) ?? h);
			w.paths = u;
		}
		s && et(w, s), k.compilerOptions = Qe(w);
	}
	for (const u of me) {
		const A = k[u];
		A && (k[u] = A.map((O) => z(O, m) ?? O));
	}
	return {
		path: l.path,
		config: k,
		sources: e.map((u) => u.path)
	};
}, "resolveExtendsChain");
const we = i((e, n = {}) => {
	const { cache: s = /* @__PURE__ */ new Map() } = n, t = path.resolve(e), o = [], r = /* @__PURE__ */ new Set(), l = i((g, m) => {
		const k = x(g);
		if (r.has(k)) return;
		r.add(k);
		let w;
		try {
			w = Y(g, s) || {};
		} catch {
			throw new Error(`Cannot resolve tsconfig at path: ${g}`);
		}
		if (typeof w != "object") throw new SyntaxError(`Failed to parse tsconfig at: ${g}`);
		const u = path.dirname(g);
		if (w.extends) {
			const A = Array.isArray(w.extends), h = (A ? w.extends : [w.extends]).map((c) => {
				const p = ze(c, u, s);
				if (!p) throw new Error(`File '${c}' not found.`);
				const b = x(p);
				if (m.has(b) || b === k) throw new Error(`Circularity detected while resolving configuration: ${b}`);
				return b;
			});
			w.extends = A ? h : h[0], o.push({
				path: k,
				config: w
			});
			const D = new Set(m);
			D.add(k);
			for (const c of [...h].reverse()) l(c, D);
		} else o.push({
			path: k,
			config: w
		});
	}, "collect");
	return l(t, /* @__PURE__ */ new Set()), o;
}, "getExtendsChain");
const ee = i((e, n = {}) => {
	const { cache: s = /* @__PURE__ */ new Map(), typescriptVersion: t = "auto" } = n, o = we(e, { cache: s });
	let r;
	return t === "auto" ? r = Me(path.dirname(o[0].path), s) : t !== !1 && (r = t), ke(o, { typescriptVersion: r });
}, "readTsconfig");
var st = Object.defineProperty;
var G = i((e, n) => st(e, "name", {
	value: n,
	configurable: !0
}), "s");
const ve = G((e) => {
	let n = "";
	for (let s = 0; s < e.length; s += 1) {
		const t = e[s], o = t.toUpperCase();
		n += t === o ? t.toLowerCase() : o;
	}
	return n;
}, "invertCase"), te = /* @__PURE__ */ new Map(), be = G((e, n) => {
	const s = Se.join(e, `.is-fs-case-sensitive-test-${process.pid}`);
	try {
		return n.writeFileSync(s, ""), !n.existsSync(ve(s));
	} finally {
		try {
			n.unlinkSync(s);
		} catch {}
	}
}, "checkDirectoryCaseWithWrite"), ot = G((e, n, s) => {
	try {
		return be(e, s);
	} catch (t) {
		if (n === void 0) return be(Ie.tmpdir(), s);
		throw t;
	}
}, "checkDirectoryCaseWithFallback"), it = G((e, n = Ue, s = !0) => {
	const t = e ?? process.cwd();
	if (s && te.has(t)) return te.get(t);
	let o;
	const r = ve(t);
	return r !== t && n.existsSync(t) ? o = !n.existsSync(r) : o = ot(t, e, n), s && te.set(t, o), o;
}, "isFsCaseSensitive"), { join: ye } = path.posix, ne = {
	ts: [
		".ts",
		".tsx",
		".d.ts"
	],
	cts: [".cts", ".d.cts"],
	mts: [".mts", ".d.mts"]
}, rt = i((e) => {
	const n = [...ne.ts], s = [...ne.cts], t = [...ne.mts];
	return e?.allowJs && (n.push(".js", ".jsx"), s.push(".cjs"), t.push(".mjs")), [
		...n,
		...s,
		...t
	];
}, "getSupportedExtensions"), lt = i((e) => {
	const n = [];
	if (!e) return n;
	const { outDir: s, declarationDir: t } = e;
	return s && n.push(s), t && n.push(t), n;
}, "getDefaultExcludeSpec"), Te = i((e) => e.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`), "escapeForRegexp"), se = `(?!(${[
	"node_modules",
	"bower_components",
	"jspm_packages"
].join("|")})(/|$))`, ft = /(?:^|\/)[^.*?]+$/, he = "**/*", Q = "[^/]", oe = "[^./]", Oe = process.platform === "win32", ut = i(({ config: e, path: n }, s) => {
	if ("extends" in e) throw new Error("tsconfig#extends must be resolved. Use getTsconfig or readTsconfig to resolve it.");
	if (!path.isAbsolute(n)) throw new Error("The tsconfig path must be absolute");
	Oe && (n = x(n));
	const t = path.dirname(n), { files: o, include: r, exclude: l, compilerOptions: g } = e, m = i((c) => path.isAbsolute(c) ? c : ye(t, c), "resolvePattern"), k = o ? new Set(o.map(m)) : void 0, w = rt(g), u = s ? "" : "i", O = (l || lt(g)).map((c) => {
		const p = m(c), b = Te(p).replaceAll(String.raw`\*\*/`, "(.+/)?").replaceAll(String.raw`\*`, `${Q}*`).replaceAll(String.raw`\?`, Q);
		return new RegExp(`^${b}($|/)`, u);
	}), h = o || r ? r : [he];
	return {
		filesSet: k,
		extensions: w,
		excludePatterns: O,
		includePatterns: h ? h.map((c) => {
			let p = m(c);
			ft.test(p) && (p = ye(p, he));
			const b = Te(p).replaceAll(String.raw`/\*\*`, `(/${se}${oe}${Q}*)*?`).replaceAll(/(\/)?\\\*/g, (f, y) => {
				const j = String.raw`(${oe}|(\.(?!min\.js$))?)*`;
				return y ? `/${se}${oe}${j}` : j;
			}).replaceAll(/(\/)?\\\?/g, (f, y) => {
				const j = Q;
				return y ? `/${se}${j}` : j;
			});
			return new RegExp(`^${b}$`, u);
		}) : void 0
	};
}, "compilePatterns"), Ae = /* @__PURE__ */ new WeakMap(), je = i((e, n) => {
	if (!path.isAbsolute(n)) return !1;
	Oe && (n = x(n));
	let s = Ae.get(e);
	s || (s = ut(e, it()), Ae.set(e, s));
	const { filesSet: t, extensions: o, excludePatterns: r, includePatterns: l } = s;
	return t?.has(n) ? !0 : !o.some((g) => n.endsWith(g)) || r.some((g) => g.test(n)) ? !1 : !!(l && l.some((g) => g.test(n)));
}, "isFileIncluded"), De = i((e, n, s, t) => {
	const o = path.resolve(e);
	let r = x(e);
	for (;;) {
		const l = R(r, n, s);
		if (!l) return;
		const g = path.resolve(l), m = ee(g, {
			cache: s,
			typescriptVersion: t
		});
		if (je(m, o)) return m;
		const k = path.dirname(l), w = path.dirname(k);
		if (w === k) return;
		r = w;
	}
}, "findConfigApplicable"), Ee = i((e = process.cwd(), n = {}) => {
	const { configName: s = "tsconfig.json", cache: t = /* @__PURE__ */ new Map(), includes: o = !1 } = n;
	if (!o) {
		const r = path.resolve(e);
		return path.basename(r) === s && F(t, r)?.isFile() ? x(r) : R(x(e), s, t);
	}
	return De(e, s, t, !1)?.path;
}, "findTsconfig"), at = i((e = process.cwd(), n = {}) => {
	const { configName: s = "tsconfig.json", cache: t = /* @__PURE__ */ new Map(), includes: o = !1, typescriptVersion: r = "auto" } = n;
	if (!o) {
		const l = Ee(e, {
			configName: s,
			cache: t
		});
		return l ? ee(l, {
			cache: t,
			typescriptVersion: r
		}) : void 0;
	}
	return De(e, s, t, r);
}, "getTsconfig"), pt = /\*/g, xe = i((e, n) => {
	const s = e.match(pt);
	if (s && s.length > 1) throw new Error(n);
}, "assertStarCount"), mt = i((e) => {
	if (e.includes("*")) {
		const [n, s] = e.split("*");
		return {
			prefix: n,
			suffix: s
		};
	}
	return e;
}, "parsePattern"), gt = i(({ prefix: e, suffix: n }, s) => s.startsWith(e) && s.endsWith(n), "isPatternMatch"), dt = i((e, n, s) => Object.entries(e).map(([t, o]) => (xe(t, `Pattern '${t}' can have at most one '*' character.`), {
	pattern: mt(t),
	substitutions: o.map((r) => {
		if (xe(r, `Substitution '${r}' in pattern '${t}' can have at most one '*' character.`), !n && !K.test(r) && !path.isAbsolute(r)) throw new Error("Non-relative paths are not allowed when 'baseUrl' is not set. Did you forget a leading './'?");
		return path.resolve(s, r);
	})
})), "parsePaths"), kt = i((e) => {
	const { compilerOptions: n } = e.config;
	if (!n) return null;
	const { baseUrl: s, paths: t } = n;
	if (!s && !t) return null;
	const o = q in n && n[q], r = path.resolve(path.dirname(e.path), s || o || "."), l = t ? dt(t, s, r) : [], g = /* @__PURE__ */ new Map(), m = [];
	for (const k of l) typeof k.pattern == "string" ? g.set(k.pattern, k.substitutions) : m.push(k);
	return {
		exactEntries: g,
		patternEntries: m,
		resolvedBaseUrl: r,
		baseUrl: s
	};
}, "compilePaths"), Fe = /* @__PURE__ */ new WeakMap();
i((e, n) => {
	let s = Fe.get(e);
	if (s === void 0 && (s = kt(e), Fe.set(e, s)), !s) return [];
	if (K.test(n)) return [];
	const { exactEntries: t, patternEntries: o, resolvedBaseUrl: r, baseUrl: l } = s, g = t.get(n);
	if (g) return g.map(x);
	let m, k = -1;
	for (const u of o) gt(u.pattern, n) && u.pattern.prefix.length > k && (k = u.pattern.prefix.length, m = u);
	if (!m) return l ? [x(path.join(r, n))] : [];
	const w = n.slice(m.pattern.prefix.length, n.length - m.pattern.suffix.length);
	return m.substitutions.map((u) => x(u.replace("*", w)));
}, "resolvePathAlias");
//#endregion
//#region ../../node_modules/.pnpm/tsdown@0.22.14_@arethetypeswrong+core@0.18.2_@tsdown+css@0.22.14_@tsdown+exe@0.22.14_@t_4084c24f9f44f250d2b604ebc16f10f3/node_modules/tsdown/dist/deps-B_uZzM4C.mjs
const shimFile = path.resolve(import.meta.dirname, "..", "esm-shims.js");
const shimsInject = {
	__dirname: [shimFile, "__dirname"],
	__filename: [shimFile, "__filename"]
};
const shimsDefine = {
	__dirname: "__TSDOWN_SHIM_DIRNAME__",
	__filename: "__TSDOWN_SHIM_FILENAME__"
};
const shimsPlugin = {
	name: "tsdown:shims-banner",
	banner: `
import __tsdown_shims_path from 'node:path'
import __tsdown_shims_url from 'node:url'

const __TSDOWN_SHIM_FILENAME__ = /* @__PURE__ */ __tsdown_shims_url.fileURLToPath(import.meta.url)
const __TSDOWN_SHIM_DIRNAME__ = /* @__PURE__ */ __tsdown_shims_path.dirname(__TSDOWN_SHIM_FILENAME__)
`
};
function getShims(config) {
	if (config.format !== "es" || config.platform !== "node") return {};
	if (config.unbundle) return {
		define: shimsDefine,
		plugin: shimsPlugin
	};
	return { inject: shimsInject };
}
const debug$7 = createDebug("tsdown:deps");
/**
* Matches specifiers that follow npm package naming conventions,
* e.g. `pkg`, `pkg/subpath`, `@scope/pkg/subpath`.
*/
const RE_PACKAGE_SPECIFIER = /^(?:@[a-z0-9-][a-z0-9-._]*\/)?[a-z0-9-][a-z0-9-._]*(?:\/|$)/;
function resolveDepsConfig(config, logger) {
	let { neverBundle, alwaysBundle, onlyBundle, onlyImport, skipNodeModulesBundle, resolveDepSubpath = true } = config.deps || {};
	if (config.external != null) {
		if (neverBundle != null) throw new TypeError("`external` is deprecated. Cannot be used with `deps.neverBundle`.");
		logger?.warn("`external` is deprecated. Use `deps.neverBundle` instead.");
		neverBundle = config.external;
	}
	if (config.noExternal != null) {
		if (alwaysBundle != null) throw new TypeError("`noExternal` is deprecated. Cannot be used with `deps.alwaysBundle`.");
		logger?.warn("`noExternal` is deprecated. Use `deps.alwaysBundle` instead.");
		alwaysBundle = config.noExternal;
	}
	if (config.inlineOnly != null) {
		if (onlyBundle != null) throw new TypeError("`inlineOnly` is deprecated. Cannot be used with `deps.onlyBundle`.");
		logger?.warn("`inlineOnly` is deprecated. Use `deps.onlyBundle` instead.");
		onlyBundle = config.inlineOnly;
	}
	if (config.deps?.onlyAllowBundle != null) {
		if (onlyBundle != null) throw new TypeError("`deps.onlyAllowBundle` is deprecated. Cannot be used with `deps.onlyBundle`.");
		logger?.warn("`deps.onlyAllowBundle` is deprecated. Use `deps.onlyBundle` instead.");
		onlyBundle = config.deps.onlyAllowBundle;
	}
	if (config.skipNodeModulesBundle != null) {
		if (config.deps?.skipNodeModulesBundle != null) throw new TypeError("`skipNodeModulesBundle` is deprecated. Cannot be used with `deps.skipNodeModulesBundle`.");
		logger?.warn("`skipNodeModulesBundle` is deprecated. Use `deps.neverBundle: true` instead.");
		skipNodeModulesBundle = config.skipNodeModulesBundle;
	} else if (skipNodeModulesBundle != null) logger?.warn("`deps.skipNodeModulesBundle` is deprecated. Use `deps.neverBundle: true` instead.");
	if (skipNodeModulesBundle) {
		if (neverBundle === true) throw new TypeError("`deps.skipNodeModulesBundle` is deprecated. Cannot be used with `deps.neverBundle: true`.");
		if (alwaysBundle != null) throw new TypeError("`deps.skipNodeModulesBundle` and `deps.alwaysBundle` are mutually exclusive options and cannot be used together.");
	}
	if (onlyBundle != null && onlyBundle !== false) onlyBundle = toArray(onlyBundle);
	if (onlyImport != null) onlyImport = toArray(onlyImport);
	return {
		...normalizeDepsOptions(alwaysBundle, neverBundle),
		onlyBundle,
		onlyImport,
		skipNodeModulesBundle,
		resolveDepSubpath,
		dts: normalizeDepsOptions(config.deps?.dts?.alwaysBundle, config.deps?.dts?.neverBundle)
	};
}
function normalizeDepsOptions(alwaysBundle, neverBundle) {
	if (alwaysBundle != null && typeof alwaysBundle !== "function") {
		const alwaysBundlePatterns = toArray(alwaysBundle);
		alwaysBundle = (id) => matchPattern(id, alwaysBundlePatterns);
	}
	return {
		alwaysBundle,
		neverBundle: resolveRegex(neverBundle)
	};
}
function DepsPlugin({ pkg, deps: { neverBundle, alwaysBundle: jsAlwaysBundle, onlyBundle, onlyImport, skipNodeModulesBundle, resolveDepSubpath: shouldResolveDepSubpath, dts }, logger, nameLabel, platform }, tsdownBundle) {
	const deps = pkg && Array.from(getProductionDeps(pkg));
	return {
		name: "tsdown:deps",
		resolveId: {
			filter: [include(and(id(/^[^.]/), importerId(/./)))],
			async handler(id, importer, extraOptions) {
				if (extraOptions.isEntry) return;
				let resolveResult;
				const resolve = () => resolveResult ??= this.resolve(id, importer, {
					...extraOptions,
					skipSelf: true
				});
				let shouldExternal = await externalStrategy(id, importer, resolve);
				if (Array.isArray(shouldExternal)) {
					debug$7("custom resolved id for %o -> %o", id, shouldExternal[1]);
					id = shouldExternal[1];
					shouldExternal = shouldExternal[0];
				}
				const moduleSideEffects = isBuiltin(id) ? false : void 0;
				debug$7("shouldExternal: %o = %o", id, shouldExternal);
				if (shouldExternal === true || shouldExternal === "absolute") return {
					id,
					external: shouldExternal,
					moduleSideEffects
				};
				const resolved = await resolve();
				if (resolved) return {
					...resolved,
					moduleSideEffects
				};
			}
		},
		generateBundle: {
			order: "post",
			async handler(options, bundle) {
				const deps = /* @__PURE__ */ new Set();
				const importers = /* @__PURE__ */ new Map();
				const errors = [];
				const moduleIds = [...this.getModuleIds()].filter((id) => platform !== "node" || !isBuiltin(id));
				for (const chunk of Object.values(bundle)) {
					if (chunk.type === "asset") continue;
					if (onlyImport && chunk.code && moduleIds.some((id) => chunk.code.includes(id))) {
						const { program } = await parse$1(chunk.fileName, chunk.code);
						for (const source of collectImportSources(program)) {
							if (source[0] === ".") continue;
							if (platform === "node" && isBuiltin(source)) continue;
							if (matchPattern(parsePackageSpecifier(source)[0], onlyImport)) continue;
							errors.push(`${yellow(source)} is imported in ${blue(chunk.fileName)} but is not included in ${blue`deps.onlyImport`} option.\nTo fix this, either add it to ${blue`deps.onlyImport`} or bundle it manually by adding it to ${blue`deps.alwaysBundle`} option.`);
						}
					}
					for (const id of chunk.moduleIds) {
						if (id === shimFile) continue;
						const parsed = await readBundledDepInfo(id);
						if (!parsed) continue;
						deps.add(parsed.name);
						if (!tsdownBundle.inlinedDeps.has(parsed.pkgName)) tsdownBundle.inlinedDeps.set(parsed.pkgName, /* @__PURE__ */ new Set());
						tsdownBundle.inlinedDeps.get(parsed.pkgName).add(parsed.version);
						const module = this.getModuleInfo(id);
						if (module) importers.set(parsed.name, /* @__PURE__ */ new Set([...module.importers, ...importers.get(parsed.name) || []]));
					}
				}
				debug$7("found deps in bundle: %o", deps);
				if (onlyBundle) errors.push(...Array.from(deps).filter((dep) => !matchPattern(dep, onlyBundle)).map((dep) => `${yellow(dep)} is located in ${blue`node_modules`} but is not included in ${blue`deps.onlyBundle`} option.\nTo fix this, either add it to ${blue`deps.onlyBundle`}, declare it as a production or peer dependency in your package.json, or externalize it manually.\nImported by\n${[...importers.get(dep) || []].map((s) => `- ${underline(s)}`).join("\n")}`));
				if (errors.length) this.error(errors.join("\n\n"));
				if (onlyBundle) {
					const unusedPatterns = onlyBundle.filter((pattern) => Array.from(deps).every((dep) => !matchPattern(dep, [pattern])));
					if (unusedPatterns.length) logger.info(nameLabel, `The following entries in ${blue`deps.onlyBundle`} are not used in the bundle:\n${unusedPatterns.map((pattern) => `- ${yellow(pattern)}`).join("\n")}\nConsider removing them to keep your configuration clean.`);
				} else if (onlyBundle == null && deps.size) logger.info(nameLabel, `Hint: consider adding ${blue`deps.onlyBundle`} option to avoid unintended bundling of dependencies, or set ${blue`deps.onlyBundle: false`} to disable this hint.\nSee more at ${underline`https://tsdown.dev/options/dependencies#deps-onlybundle`}\nDetected dependencies in bundle:\n${Array.from(deps, (dep) => `- ${blue(dep)}`).join("\n")}`);
			}
		}
	};
	/**
	* - `true`: always external
	* - `[true, resolvedId]`: external with custom resolved ID
	* - `false`: skip, let other plugins handle it
	* - `'absolute'`: external as absolute path
	* - `'no-external'`: skip, but mark as non-external for inlineOnly check
	*/
	async function externalStrategy(id, importer, resolve) {
		if (id === shimFile) return false;
		const isDts = RE_DTS.test(importer);
		if ((isDts && dts?.alwaysBundle || jsAlwaysBundle)?.(id, importer)) return "no-external";
		if ((isDts && dts?.neverBundle != null ? dts.neverBundle : neverBundle) === true) {
			if (id[0] === "\0" || id.startsWith("data:") || path.isAbsolute(id)) return false;
			if (isBuiltin(id) || RE_PACKAGE_SPECIFIER.test(id)) return true;
			const resolved = await resolve();
			return !!resolved && (!!resolved.external || RE_NODE_MODULES$1.test(resolved.id));
		}
		if (skipNodeModulesBundle) {
			const resolved = await resolve();
			if (resolved && (resolved.external || RE_NODE_MODULES$1.test(resolved.id))) {
				const resolvedDep = shouldResolveDepSubpath && await resolveDepSubpath(id, resolve);
				return resolvedDep ? [true, resolvedDep] : true;
			}
		}
		if (deps) {
			if (deps.includes(id) || deps.some((dep) => id.startsWith(`${dep}/`))) {
				const resolvedDep = shouldResolveDepSubpath && await resolveDepSubpath(id, resolve);
				return resolvedDep ? [true, resolvedDep] : true;
			}
			if (isDts && !id.startsWith("@types/")) {
				const typesName = getTypesPackageName(id);
				if (typesName && deps.includes(typesName)) return true;
			}
		}
		return false;
	}
}
function collectImportSources(program) {
	const sources = [];
	new Visitor({
		ImportDeclaration(node) {
			sources.push(node.source.value);
		},
		ExportAllDeclaration(node) {
			sources.push(node.source.value);
		},
		ExportNamedDeclaration(node) {
			if (node.source) sources.push(node.source.value);
		},
		ImportExpression(node) {
			const source = getStaticString(node.source);
			if (source) sources.push(source);
		}
	}).visit(program);
	return sources;
}
function getStaticString(value) {
	if (value.type === "Literal" && typeof value.value === "string") return value.value;
	if (value.type !== "TemplateLiteral") return;
	if (value.expressions.length || value.quasis.length !== 1) return;
	const { cooked, raw } = value.quasis[0].value;
	return cooked ?? raw;
}
function parsePackageSpecifier(id) {
	const [first, second] = id.split("/", 3);
	const name = first[0] === "@" && second ? `${first}/${second}` : first;
	return [name, id.slice(name.length)];
}
const NODE_MODULES = "/node_modules/";
function parseNodeModulesPath(id) {
	const slashed = slash(id);
	const lastNmIdx = slashed.lastIndexOf(NODE_MODULES);
	if (lastNmIdx === -1) return;
	const [name, subpath] = parsePackageSpecifier(slashed.slice(lastNmIdx + 14));
	return [
		name,
		subpath,
		slashed.slice(0, lastNmIdx + 14 + name.length)
	];
}
async function readBundledDepInfo(moduleId) {
	const parsed = parseNodeModulesPath(moduleId);
	if (!parsed) return;
	const [name, , root] = parsed;
	try {
		const json = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
		return {
			name,
			pkgName: json.name,
			version: json.version
		};
	} catch {}
}
function getTypesPackageName(id) {
	const name = parsePackageSpecifier(id)[0];
	if (!name) return;
	return `@types/${name.replace(/^@/, "").replace("/", "__")}`;
}
async function resolveDepSubpath(id, resolve) {
	const parts = id.split("/");
	if (parts[0][0] === "@") parts.shift();
	if (parts.length === 1 || parts.at(-1).includes(".")) return;
	const resolved = await resolve();
	if (!resolved?.packageJsonPath) return;
	let pkgJson;
	try {
		pkgJson = JSON.parse(await readFile(resolved.packageJsonPath, "utf8"));
	} catch {
		return;
	}
	if (pkgJson.exports) return;
	const parsed = parseNodeModulesPath(resolved.id);
	if (!parsed) return;
	const result = parsed[0] + parsed[1];
	if (result === id) return;
	return result;
}
function getProductionDeps(pkg) {
	return /* @__PURE__ */ new Set([
		...Object.keys(pkg.dependencies || {}),
		...Object.keys(pkg.peerDependencies || {}),
		...Object.keys(pkg.peerDependenciesMeta || {}),
		...Object.keys(pkg.optionalDependencies || {})
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/defu@6.1.7/node_modules/defu/dist/defu.mjs
function isPlainObject(value) {
	if (value === null || typeof value !== "object") return false;
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) return false;
	if (Symbol.iterator in value) return false;
	if (Symbol.toStringTag in value) return Object.prototype.toString.call(value) === "[object Module]";
	return true;
}
function _defu(baseObject, defaults, namespace = ".", merger) {
	if (!isPlainObject(defaults)) return _defu(baseObject, {}, namespace, merger);
	const object = { ...defaults };
	for (const key of Object.keys(baseObject)) {
		if (key === "__proto__" || key === "constructor") continue;
		const value = baseObject[key];
		if (value === null || value === void 0) continue;
		if (merger && merger(object, key, value, namespace)) continue;
		if (Array.isArray(value) && Array.isArray(object[key])) object[key] = [...value, ...object[key]];
		else if (isPlainObject(value) && isPlainObject(object[key])) object[key] = _defu(value, object[key], (namespace ? `${namespace}.` : "") + key.toString(), merger);
		else object[key] = value;
	}
	return object;
}
function createDefu(merger) {
	return (...arguments_) => arguments_.reduce((p, c) => _defu(p, c, "", merger), {});
}
//#endregion
//#region ../../node_modules/.pnpm/fdir@6.5.0_picomatch@4.0.5/node_modules/fdir/dist/index.mjs
var __require$1 = /* @__PURE__ */ createRequire$1(import.meta.url);
function cleanPath(path) {
	let normalized = normalize$1(path);
	if (normalized.length > 1 && normalized[normalized.length - 1] === sep) normalized = normalized.substring(0, normalized.length - 1);
	return normalized;
}
const SLASHES_REGEX = /[\\/]/g;
function convertSlashes(path, separator) {
	return path.replace(SLASHES_REGEX, separator);
}
const WINDOWS_ROOT_DIR_REGEX = /^[a-z]:[\\/]$/i;
function isRootDirectory(path) {
	return path === "/" || WINDOWS_ROOT_DIR_REGEX.test(path);
}
function normalizePath(path, options) {
	const { resolvePaths, normalizePath: normalizePath$1, pathSeparator } = options;
	const pathNeedsCleaning = process.platform === "win32" && path.includes("/") || path.startsWith(".");
	if (resolvePaths) path = resolve$1(path);
	if (normalizePath$1 || pathNeedsCleaning) path = cleanPath(path);
	if (path === ".") return "";
	return convertSlashes(path[path.length - 1] !== pathSeparator ? path + pathSeparator : path, pathSeparator);
}
function joinPathWithBasePath(filename, directoryPath) {
	return directoryPath + filename;
}
function joinPathWithRelativePath(root, options) {
	return function(filename, directoryPath) {
		if (directoryPath.startsWith(root)) return directoryPath.slice(root.length) + filename;
		else return convertSlashes(relative(root, directoryPath), options.pathSeparator) + options.pathSeparator + filename;
	};
}
function joinPath(filename) {
	return filename;
}
function joinDirectoryPath(filename, directoryPath, separator) {
	return directoryPath + filename + separator;
}
function build$7(root, options) {
	const { relativePaths, includeBasePath } = options;
	return relativePaths && root ? joinPathWithRelativePath(root, options) : includeBasePath ? joinPathWithBasePath : joinPath;
}
function pushDirectoryWithRelativePath(root) {
	return function(directoryPath, paths) {
		paths.push(directoryPath.substring(root.length) || ".");
	};
}
function pushDirectoryFilterWithRelativePath(root) {
	return function(directoryPath, paths, filters) {
		const relativePath = directoryPath.substring(root.length) || ".";
		if (filters.every((filter) => filter(relativePath, true))) paths.push(relativePath);
	};
}
const pushDirectory = (directoryPath, paths) => {
	paths.push(directoryPath || ".");
};
const pushDirectoryFilter = (directoryPath, paths, filters) => {
	const path = directoryPath || ".";
	if (filters.every((filter) => filter(path, true))) paths.push(path);
};
const empty$2 = () => {};
function build$6(root, options) {
	const { includeDirs, filters, relativePaths } = options;
	if (!includeDirs) return empty$2;
	if (relativePaths) return filters && filters.length ? pushDirectoryFilterWithRelativePath(root) : pushDirectoryWithRelativePath(root);
	return filters && filters.length ? pushDirectoryFilter : pushDirectory;
}
const pushFileFilterAndCount = (filename, _paths, counts, filters) => {
	if (filters.every((filter) => filter(filename, false))) counts.files++;
};
const pushFileFilter = (filename, paths, _counts, filters) => {
	if (filters.every((filter) => filter(filename, false))) paths.push(filename);
};
const pushFileCount = (_filename, _paths, counts, _filters) => {
	counts.files++;
};
const pushFile = (filename, paths) => {
	paths.push(filename);
};
const empty$1 = () => {};
function build$5(options) {
	const { excludeFiles, filters, onlyCounts } = options;
	if (excludeFiles) return empty$1;
	if (filters && filters.length) return onlyCounts ? pushFileFilterAndCount : pushFileFilter;
	else if (onlyCounts) return pushFileCount;
	else return pushFile;
}
const getArray = (paths) => {
	return paths;
};
const getArrayGroup = () => {
	return [""].slice(0, 0);
};
function build$4(options) {
	return options.group ? getArrayGroup : getArray;
}
const groupFiles = (groups, directory, files) => {
	groups.push({
		directory,
		files,
		dir: directory
	});
};
const empty = () => {};
function build$3(options) {
	return options.group ? groupFiles : empty;
}
const resolveSymlinksAsync = function(path, state, callback$1) {
	const { queue, fs, options: { suppressErrors } } = state;
	queue.enqueue();
	fs.realpath(path, (error, resolvedPath) => {
		if (error) return queue.dequeue(suppressErrors ? null : error, state);
		fs.stat(resolvedPath, (error$1, stat) => {
			if (error$1) return queue.dequeue(suppressErrors ? null : error$1, state);
			if (stat.isDirectory() && isRecursive(path, resolvedPath, state)) return queue.dequeue(null, state);
			callback$1(stat, resolvedPath);
			queue.dequeue(null, state);
		});
	});
};
const resolveSymlinks = function(path, state, callback$1) {
	const { queue, fs, options: { suppressErrors } } = state;
	queue.enqueue();
	try {
		const resolvedPath = fs.realpathSync(path);
		const stat = fs.statSync(resolvedPath);
		if (stat.isDirectory() && isRecursive(path, resolvedPath, state)) return;
		callback$1(stat, resolvedPath);
	} catch (e) {
		if (!suppressErrors) throw e;
	}
};
function build$2(options, isSynchronous) {
	if (!options.resolveSymlinks || options.excludeSymlinks) return null;
	return isSynchronous ? resolveSymlinks : resolveSymlinksAsync;
}
function isRecursive(path, resolved, state) {
	if (state.options.useRealPaths) return isRecursiveUsingRealPaths(resolved, state);
	let parent = dirname$1(path);
	let depth = 1;
	while (parent !== state.root && depth < 2) {
		const resolvedPath = state.symlinks.get(parent);
		if (!!resolvedPath && (resolvedPath === resolved || resolvedPath.startsWith(resolved) || resolved.startsWith(resolvedPath))) depth++;
		else parent = dirname$1(parent);
	}
	state.symlinks.set(path, resolved);
	return depth > 1;
}
function isRecursiveUsingRealPaths(resolved, state) {
	return state.visited.includes(resolved + state.options.pathSeparator);
}
const onlyCountsSync = (state) => {
	return state.counts;
};
const groupsSync = (state) => {
	return state.groups;
};
const defaultSync = (state) => {
	return state.paths;
};
const limitFilesSync = (state) => {
	return state.paths.slice(0, state.options.maxFiles);
};
const onlyCountsAsync = (state, error, callback$1) => {
	report(error, callback$1, state.counts, state.options.suppressErrors);
	return null;
};
const defaultAsync = (state, error, callback$1) => {
	report(error, callback$1, state.paths, state.options.suppressErrors);
	return null;
};
const limitFilesAsync = (state, error, callback$1) => {
	report(error, callback$1, state.paths.slice(0, state.options.maxFiles), state.options.suppressErrors);
	return null;
};
const groupsAsync = (state, error, callback$1) => {
	report(error, callback$1, state.groups, state.options.suppressErrors);
	return null;
};
function report(error, callback$1, output, suppressErrors) {
	if (error && !suppressErrors) callback$1(error, output);
	else callback$1(null, output);
}
function build$1$1(options, isSynchronous) {
	const { onlyCounts, group, maxFiles } = options;
	if (onlyCounts) return isSynchronous ? onlyCountsSync : onlyCountsAsync;
	else if (group) return isSynchronous ? groupsSync : groupsAsync;
	else if (maxFiles) return isSynchronous ? limitFilesSync : limitFilesAsync;
	else return isSynchronous ? defaultSync : defaultAsync;
}
const readdirOpts = { withFileTypes: true };
const walkAsync = (state, crawlPath, directoryPath, currentDepth, callback$1) => {
	state.queue.enqueue();
	if (currentDepth < 0) return state.queue.dequeue(null, state);
	const { fs } = state;
	state.visited.push(crawlPath);
	state.counts.directories++;
	fs.readdir(crawlPath || ".", readdirOpts, (error, entries = []) => {
		callback$1(entries, directoryPath, currentDepth);
		state.queue.dequeue(state.options.suppressErrors ? null : error, state);
	});
};
const walkSync = (state, crawlPath, directoryPath, currentDepth, callback$1) => {
	const { fs } = state;
	if (currentDepth < 0) return;
	state.visited.push(crawlPath);
	state.counts.directories++;
	let entries = [];
	try {
		entries = fs.readdirSync(crawlPath || ".", readdirOpts);
	} catch (e) {
		if (!state.options.suppressErrors) throw e;
	}
	callback$1(entries, directoryPath, currentDepth);
};
function build$8(isSynchronous) {
	return isSynchronous ? walkSync : walkAsync;
}
/**
* This is a custom stateless queue to track concurrent async fs calls.
* It increments a counter whenever a call is queued and decrements it
* as soon as it completes. When the counter hits 0, it calls onQueueEmpty.
*/
var Queue = class {
	count = 0;
	constructor(onQueueEmpty) {
		this.onQueueEmpty = onQueueEmpty;
	}
	enqueue() {
		this.count++;
		return this.count;
	}
	dequeue(error, output) {
		if (this.onQueueEmpty && (--this.count <= 0 || error)) {
			this.onQueueEmpty(error, output);
			if (error) {
				output.controller.abort();
				this.onQueueEmpty = void 0;
			}
		}
	}
};
var Counter = class {
	_files = 0;
	_directories = 0;
	set files(num) {
		this._files = num;
	}
	get files() {
		return this._files;
	}
	set directories(num) {
		this._directories = num;
	}
	get directories() {
		return this._directories;
	}
	/**
	* @deprecated use `directories` instead
	*/
	/* c8 ignore next 3 */
	get dirs() {
		return this._directories;
	}
};
/**
* AbortController is not supported on Node 14 so we use this until we can drop
* support for Node 14.
*/
var Aborter = class {
	aborted = false;
	abort() {
		this.aborted = true;
	}
};
var Walker = class {
	root;
	isSynchronous;
	state;
	joinPath;
	pushDirectory;
	pushFile;
	getArray;
	groupFiles;
	resolveSymlink;
	walkDirectory;
	callbackInvoker;
	constructor(root, options, callback$1) {
		this.isSynchronous = !callback$1;
		this.callbackInvoker = build$1$1(options, this.isSynchronous);
		this.root = normalizePath(root, options);
		this.state = {
			root: isRootDirectory(this.root) ? this.root : this.root.slice(0, -1),
			paths: [""].slice(0, 0),
			groups: [],
			counts: new Counter(),
			options,
			queue: new Queue((error, state) => this.callbackInvoker(state, error, callback$1)),
			symlinks: /* @__PURE__ */ new Map(),
			visited: [""].slice(0, 0),
			controller: new Aborter(),
			fs: options.fs || nativeFs
		};
		this.joinPath = build$7(this.root, options);
		this.pushDirectory = build$6(this.root, options);
		this.pushFile = build$5(options);
		this.getArray = build$4(options);
		this.groupFiles = build$3(options);
		this.resolveSymlink = build$2(options, this.isSynchronous);
		this.walkDirectory = build$8(this.isSynchronous);
	}
	start() {
		this.pushDirectory(this.root, this.state.paths, this.state.options.filters);
		this.walkDirectory(this.state, this.root, this.root, this.state.options.maxDepth, this.walk);
		return this.isSynchronous ? this.callbackInvoker(this.state, null) : null;
	}
	walk = (entries, directoryPath, depth) => {
		const { paths, options: { filters, resolveSymlinks: resolveSymlinks$1, excludeSymlinks, exclude, maxFiles, signal, useRealPaths, pathSeparator }, controller } = this.state;
		if (controller.aborted || signal && signal.aborted || maxFiles && paths.length > maxFiles) return;
		const files = this.getArray(this.state.paths);
		for (let i = 0; i < entries.length; ++i) {
			const entry = entries[i];
			if (entry.isFile() || entry.isSymbolicLink() && !resolveSymlinks$1 && !excludeSymlinks) {
				const filename = this.joinPath(entry.name, directoryPath);
				this.pushFile(filename, files, this.state.counts, filters);
			} else if (entry.isDirectory()) {
				let path = joinDirectoryPath(entry.name, directoryPath, this.state.options.pathSeparator);
				if (exclude && exclude(entry.name, path)) continue;
				this.pushDirectory(path, paths, filters);
				this.walkDirectory(this.state, path, path, depth - 1, this.walk);
			} else if (this.resolveSymlink && entry.isSymbolicLink()) {
				let path = joinPathWithBasePath(entry.name, directoryPath);
				this.resolveSymlink(path, this.state, (stat, resolvedPath) => {
					if (stat.isDirectory()) {
						resolvedPath = normalizePath(resolvedPath, this.state.options);
						if (exclude && exclude(entry.name, useRealPaths ? resolvedPath : path + pathSeparator)) return;
						this.walkDirectory(this.state, resolvedPath, useRealPaths ? resolvedPath : path + pathSeparator, depth - 1, this.walk);
					} else {
						resolvedPath = useRealPaths ? resolvedPath : path;
						const filename = basename$1(resolvedPath);
						const directoryPath$1 = normalizePath(dirname$1(resolvedPath), this.state.options);
						resolvedPath = this.joinPath(filename, directoryPath$1);
						this.pushFile(resolvedPath, files, this.state.counts, filters);
					}
				});
			}
		}
		this.groupFiles(this.state.groups, directoryPath, files);
	};
};
function promise(root, options) {
	return new Promise((resolve$1, reject) => {
		callback(root, options, (err, output) => {
			if (err) return reject(err);
			resolve$1(output);
		});
	});
}
function callback(root, options, callback$1) {
	new Walker(root, options, callback$1).start();
}
function sync(root, options) {
	return new Walker(root, options).start();
}
var APIBuilder = class {
	constructor(root, options) {
		this.root = root;
		this.options = options;
	}
	withPromise() {
		return promise(this.root, this.options);
	}
	withCallback(cb) {
		callback(this.root, this.options, cb);
	}
	sync() {
		return sync(this.root, this.options);
	}
};
let pm = null;
/* c8 ignore next 6 */
try {
	__require$1.resolve("picomatch");
	pm = __require$1("./npm_entry_picomatch.cjs");
} catch {}
var Builder = class {
	globCache = {};
	options = {
		maxDepth: Infinity,
		suppressErrors: true,
		pathSeparator: sep,
		filters: []
	};
	globFunction;
	constructor(options) {
		this.options = {
			...this.options,
			...options
		};
		this.globFunction = this.options.globFunction;
	}
	group() {
		this.options.group = true;
		return this;
	}
	withPathSeparator(separator) {
		this.options.pathSeparator = separator;
		return this;
	}
	withBasePath() {
		this.options.includeBasePath = true;
		return this;
	}
	withRelativePaths() {
		this.options.relativePaths = true;
		return this;
	}
	withDirs() {
		this.options.includeDirs = true;
		return this;
	}
	withMaxDepth(depth) {
		this.options.maxDepth = depth;
		return this;
	}
	withMaxFiles(limit) {
		this.options.maxFiles = limit;
		return this;
	}
	withFullPaths() {
		this.options.resolvePaths = true;
		this.options.includeBasePath = true;
		return this;
	}
	withErrors() {
		this.options.suppressErrors = false;
		return this;
	}
	withSymlinks({ resolvePaths = true } = {}) {
		this.options.resolveSymlinks = true;
		this.options.useRealPaths = resolvePaths;
		return this.withFullPaths();
	}
	withAbortSignal(signal) {
		this.options.signal = signal;
		return this;
	}
	normalize() {
		this.options.normalizePath = true;
		return this;
	}
	filter(predicate) {
		this.options.filters.push(predicate);
		return this;
	}
	onlyDirs() {
		this.options.excludeFiles = true;
		this.options.includeDirs = true;
		return this;
	}
	exclude(predicate) {
		this.options.exclude = predicate;
		return this;
	}
	onlyCounts() {
		this.options.onlyCounts = true;
		return this;
	}
	crawl(root) {
		return new APIBuilder(root || ".", this.options);
	}
	withGlobFunction(fn) {
		this.globFunction = fn;
		return this;
	}
	/**
	* @deprecated Pass options using the constructor instead:
	* ```ts
	* new fdir(options).crawl("/path/to/root");
	* ```
	* This method will be removed in v7.0
	*/
	/* c8 ignore next 4 */
	crawlWithOptions(root, options) {
		this.options = {
			...this.options,
			...options
		};
		return new APIBuilder(root || ".", this.options);
	}
	glob(...patterns) {
		if (this.globFunction) return this.globWithOptions(patterns);
		return this.globWithOptions(patterns, ...[{ dot: true }]);
	}
	globWithOptions(patterns, ...options) {
		const globFn = this.globFunction || pm;
		/* c8 ignore next 5 */
		if (!globFn) throw new Error("Please specify a glob function to use glob matching.");
		var isMatch = this.globCache[patterns.join("\0")];
		if (!isMatch) {
			isMatch = globFn(patterns, ...options);
			this.globCache[patterns.join("\0")] = isMatch;
		}
		this.options.filters.push((path) => isMatch(path));
		return this;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/picomatch@4.0.5/node_modules/picomatch/lib/constants.js
var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const WIN_SLASH = "\\\\/";
	const WIN_NO_SLASH = `[^${WIN_SLASH}]`;
	const DEFAULT_MAX_EXTGLOB_RECURSION = 0;
	/**
	* Posix glob regex
	*/
	const DOT_LITERAL = "\\.";
	const PLUS_LITERAL = "\\+";
	const QMARK_LITERAL = "\\?";
	const SLASH_LITERAL = "\\/";
	const ONE_CHAR = "(?=.)";
	const QMARK = "[^/]";
	const END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
	const START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
	const DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
	const POSIX_CHARS = {
		DOT_LITERAL,
		PLUS_LITERAL,
		QMARK_LITERAL,
		SLASH_LITERAL,
		ONE_CHAR,
		QMARK,
		END_ANCHOR,
		DOTS_SLASH,
		NO_DOT: `(?!${DOT_LITERAL})`,
		NO_DOTS: `(?!${START_ANCHOR}${DOTS_SLASH})`,
		NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`,
		NO_DOTS_SLASH: `(?!${DOTS_SLASH})`,
		QMARK_NO_DOT: `[^.${SLASH_LITERAL}]`,
		STAR: `${QMARK}*?`,
		START_ANCHOR,
		SEP: "/"
	};
	/**
	* Windows glob regex
	*/
	const WINDOWS_CHARS = {
		...POSIX_CHARS,
		SLASH_LITERAL: `[${WIN_SLASH}]`,
		QMARK: WIN_NO_SLASH,
		STAR: `${WIN_NO_SLASH}*?`,
		DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
		NO_DOT: `(?!${DOT_LITERAL})`,
		NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
		NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
		NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
		QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
		START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
		END_ANCHOR: `(?:[${WIN_SLASH}]|$)`,
		SEP: "\\"
	};
	module.exports = {
		DEFAULT_MAX_EXTGLOB_RECURSION,
		MAX_LENGTH: 65536,
		POSIX_REGEX_SOURCE: {
			__proto__: null,
			alnum: "a-zA-Z0-9",
			alpha: "a-zA-Z",
			ascii: "\\x00-\\x7F",
			blank: " \\t",
			cntrl: "\\x00-\\x1F\\x7F",
			digit: "0-9",
			graph: "\\x21-\\x7E",
			lower: "a-z",
			print: "\\x20-\\x7E ",
			punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
			space: " \\t\\r\\n\\v\\f",
			upper: "A-Z",
			word: "A-Za-z0-9_",
			xdigit: "A-Fa-f0-9"
		},
		REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
		REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
		REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
		REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
		REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
		REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
		REPLACEMENTS: {
			__proto__: null,
			"***": "*",
			"**/**": "**",
			"**/**/**": "**"
		},
		CHAR_0: 48,
		CHAR_9: 57,
		CHAR_UPPERCASE_A: 65,
		CHAR_LOWERCASE_A: 97,
		CHAR_UPPERCASE_Z: 90,
		CHAR_LOWERCASE_Z: 122,
		CHAR_LEFT_PARENTHESES: 40,
		CHAR_RIGHT_PARENTHESES: 41,
		CHAR_ASTERISK: 42,
		CHAR_AMPERSAND: 38,
		CHAR_AT: 64,
		CHAR_BACKWARD_SLASH: 92,
		CHAR_CARRIAGE_RETURN: 13,
		CHAR_CIRCUMFLEX_ACCENT: 94,
		CHAR_COLON: 58,
		CHAR_COMMA: 44,
		CHAR_DOT: 46,
		CHAR_DOUBLE_QUOTE: 34,
		CHAR_EQUAL: 61,
		CHAR_EXCLAMATION_MARK: 33,
		CHAR_FORM_FEED: 12,
		CHAR_FORWARD_SLASH: 47,
		CHAR_GRAVE_ACCENT: 96,
		CHAR_HASH: 35,
		CHAR_HYPHEN_MINUS: 45,
		CHAR_LEFT_ANGLE_BRACKET: 60,
		CHAR_LEFT_CURLY_BRACE: 123,
		CHAR_LEFT_SQUARE_BRACKET: 91,
		CHAR_LINE_FEED: 10,
		CHAR_NO_BREAK_SPACE: 160,
		CHAR_PERCENT: 37,
		CHAR_PLUS: 43,
		CHAR_QUESTION_MARK: 63,
		CHAR_RIGHT_ANGLE_BRACKET: 62,
		CHAR_RIGHT_CURLY_BRACE: 125,
		CHAR_RIGHT_SQUARE_BRACKET: 93,
		CHAR_SEMICOLON: 59,
		CHAR_SINGLE_QUOTE: 39,
		CHAR_SPACE: 32,
		CHAR_TAB: 9,
		CHAR_UNDERSCORE: 95,
		CHAR_VERTICAL_LINE: 124,
		CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
		/**
		* Create EXTGLOB_CHARS
		*/
		extglobChars(chars) {
			return {
				"!": {
					type: "negate",
					open: "(?:(?!(?:",
					close: `))${chars.STAR})`
				},
				"?": {
					type: "qmark",
					open: "(?:",
					close: ")?"
				},
				"+": {
					type: "plus",
					open: "(?:",
					close: ")+"
				},
				"*": {
					type: "star",
					open: "(?:",
					close: ")*"
				},
				"@": {
					type: "at",
					open: "(?:",
					close: ")"
				}
			};
		},
		/**
		* Create GLOB_CHARS
		*/
		globChars(win32) {
			return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
		}
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/picomatch@4.0.5/node_modules/picomatch/lib/utils.js
var require_utils = /* @__PURE__ */ __commonJSMin(((exports) => {
	const { REGEX_BACKSLASH, REGEX_REMOVE_BACKSLASH, REGEX_SPECIAL_CHARS, REGEX_SPECIAL_CHARS_GLOBAL } = require_constants();
	exports.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
	exports.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
	exports.isRegexChar = (str) => str.length === 1 && exports.hasRegexChars(str);
	exports.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
	exports.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
	exports.isWindows = () => {
		if (typeof navigator !== "undefined" && navigator.platform) {
			const platform = navigator.platform.toLowerCase();
			return platform === "win32" || platform === "windows";
		}
		if (typeof process !== "undefined" && process.platform) return process.platform === "win32";
		return false;
	};
	exports.removeBackslashes = (str) => {
		return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
			return match === "\\" ? "" : match;
		});
	};
	exports.escapeLast = (input, char, lastIdx) => {
		const idx = input.lastIndexOf(char, lastIdx);
		if (idx === -1) return input;
		if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1);
		return `${input.slice(0, idx)}\\${input.slice(idx)}`;
	};
	exports.removePrefix = (input, state = {}) => {
		let output = input;
		if (output.startsWith("./")) {
			output = output.slice(2);
			state.prefix = "./";
		}
		return output;
	};
	exports.wrapOutput = (input, state = {}, options = {}) => {
		let output = `${options.contains ? "" : "^"}(?:${input})${options.contains ? "" : "$"}`;
		if (state.negated === true) output = `(?:^(?!${output}).*$)`;
		return output;
	};
	exports.basename = (path, { windows } = {}) => {
		const segs = path.split(windows ? /[\\/]/ : "/");
		const last = segs[segs.length - 1];
		if (last === "") return segs[segs.length - 2];
		return last;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/picomatch@4.0.5/node_modules/picomatch/lib/scan.js
var require_scan = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const utils = require_utils();
	const { CHAR_ASTERISK, CHAR_AT, CHAR_BACKWARD_SLASH, CHAR_COMMA, CHAR_DOT, CHAR_EXCLAMATION_MARK, CHAR_FORWARD_SLASH, CHAR_LEFT_CURLY_BRACE, CHAR_LEFT_PARENTHESES, CHAR_LEFT_SQUARE_BRACKET, CHAR_PLUS, CHAR_QUESTION_MARK, CHAR_RIGHT_CURLY_BRACE, CHAR_RIGHT_PARENTHESES, CHAR_RIGHT_SQUARE_BRACKET } = require_constants();
	const isPathSeparator = (code) => {
		return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
	};
	const depth = (token) => {
		if (token.isPrefix !== true) token.depth = token.isGlobstar ? Infinity : 1;
	};
	/**
	* Quickly scans a glob pattern and returns an object with a handful of
	* useful properties, like `isGlob`, `path` (the leading non-glob, if it exists),
	* `glob` (the actual pattern), `negated` (true if the path starts with `!` but not
	* with `!(`) and `negatedExtglob` (true if the path starts with `!(`).
	*
	* ```js
	* const pm = require('picomatch');
	* console.log(pm.scan('foo/bar/*.js'));
	* { isGlob: true, input: 'foo/bar/*.js', base: 'foo/bar', glob: '*.js' }
	* ```
	* @param {String} `str`
	* @param {Object} `options`
	* @return {Object} Returns an object with tokens and regex source string.
	* @api public
	*/
	const scan = (input, options) => {
		const opts = options || {};
		const length = input.length - 1;
		const scanToEnd = opts.parts === true || opts.scanToEnd === true;
		const slashes = [];
		const tokens = [];
		const parts = [];
		let str = input;
		let index = -1;
		let start = 0;
		let lastIndex = 0;
		let isBrace = false;
		let isBracket = false;
		let isGlob = false;
		let isExtglob = false;
		let isGlobstar = false;
		let braceEscaped = false;
		let backslashes = false;
		let negated = false;
		let negatedExtglob = false;
		let finished = false;
		let braces = 0;
		let prev;
		let code;
		let token = {
			value: "",
			depth: 0,
			isGlob: false
		};
		const eos = () => index >= length;
		const peek = () => str.charCodeAt(index + 1);
		const advance = () => {
			prev = code;
			return str.charCodeAt(++index);
		};
		while (index < length) {
			code = advance();
			let next;
			if (code === CHAR_BACKWARD_SLASH) {
				backslashes = token.backslashes = true;
				code = advance();
				if (code === CHAR_LEFT_CURLY_BRACE) braceEscaped = true;
				continue;
			}
			if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
				braces++;
				while (eos() !== true && (code = advance())) {
					if (code === CHAR_BACKWARD_SLASH) {
						backslashes = token.backslashes = true;
						advance();
						continue;
					}
					if (code === CHAR_LEFT_CURLY_BRACE) {
						braces++;
						continue;
					}
					if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
						isBrace = token.isBrace = true;
						isGlob = token.isGlob = true;
						finished = true;
						if (scanToEnd === true) continue;
						break;
					}
					if (braceEscaped !== true && code === CHAR_COMMA) {
						isBrace = token.isBrace = true;
						isGlob = token.isGlob = true;
						finished = true;
						if (scanToEnd === true) continue;
						break;
					}
					if (code === CHAR_RIGHT_CURLY_BRACE) {
						braces--;
						if (braces === 0) {
							braceEscaped = false;
							isBrace = token.isBrace = true;
							finished = true;
							break;
						}
					}
				}
				if (scanToEnd === true) continue;
				break;
			}
			if (code === CHAR_FORWARD_SLASH) {
				slashes.push(index);
				tokens.push(token);
				token = {
					value: "",
					depth: 0,
					isGlob: false
				};
				if (finished === true) continue;
				if (prev === CHAR_DOT && index === start + 1) {
					start += 2;
					continue;
				}
				lastIndex = index + 1;
				continue;
			}
			if (opts.noext !== true) {
				if ((code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK) === true && peek() === CHAR_LEFT_PARENTHESES) {
					isGlob = token.isGlob = true;
					isExtglob = token.isExtglob = true;
					finished = true;
					if (code === CHAR_EXCLAMATION_MARK && index === start) negatedExtglob = true;
					if (scanToEnd === true) {
						while (eos() !== true && (code = advance())) {
							if (code === CHAR_BACKWARD_SLASH) {
								backslashes = token.backslashes = true;
								code = advance();
								continue;
							}
							if (code === CHAR_RIGHT_PARENTHESES) {
								isGlob = token.isGlob = true;
								finished = true;
								break;
							}
						}
						continue;
					}
					break;
				}
			}
			if (code === CHAR_ASTERISK) {
				if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
				isGlob = token.isGlob = true;
				finished = true;
				if (scanToEnd === true) continue;
				break;
			}
			if (code === CHAR_QUESTION_MARK) {
				isGlob = token.isGlob = true;
				finished = true;
				if (scanToEnd === true) continue;
				break;
			}
			if (code === CHAR_LEFT_SQUARE_BRACKET) {
				while (eos() !== true && (next = advance())) {
					if (next === CHAR_BACKWARD_SLASH) {
						backslashes = token.backslashes = true;
						advance();
						continue;
					}
					if (next === CHAR_RIGHT_SQUARE_BRACKET) {
						isBracket = token.isBracket = true;
						isGlob = token.isGlob = true;
						finished = true;
						break;
					}
				}
				if (scanToEnd === true) continue;
				break;
			}
			if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
				negated = token.negated = true;
				start++;
				continue;
			}
			if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
				isGlob = token.isGlob = true;
				if (scanToEnd === true) {
					while (eos() !== true && (code = advance())) {
						if (code === CHAR_LEFT_PARENTHESES) {
							backslashes = token.backslashes = true;
							code = advance();
							continue;
						}
						if (code === CHAR_RIGHT_PARENTHESES) {
							finished = true;
							break;
						}
					}
					continue;
				}
				break;
			}
			if (isGlob === true) {
				finished = true;
				if (scanToEnd === true) continue;
				break;
			}
		}
		if (opts.noext === true) {
			isExtglob = false;
			isGlob = false;
		}
		let base = str;
		let prefix = "";
		let glob = "";
		if (start > 0) {
			prefix = str.slice(0, start);
			str = str.slice(start);
			lastIndex -= start;
		}
		if (base && isGlob === true && lastIndex > 0) {
			base = str.slice(0, lastIndex);
			glob = str.slice(lastIndex);
		} else if (isGlob === true) {
			base = "";
			glob = str;
		} else base = str;
		if (base && base !== "" && base !== "/" && base !== str) {
			if (isPathSeparator(base.charCodeAt(base.length - 1))) base = base.slice(0, -1);
		}
		if (opts.unescape === true) {
			if (glob) glob = utils.removeBackslashes(glob);
			if (base && backslashes === true) base = utils.removeBackslashes(base);
		}
		const state = {
			prefix,
			input,
			start,
			base,
			glob,
			isBrace,
			isBracket,
			isGlob,
			isExtglob,
			isGlobstar,
			negated,
			negatedExtglob
		};
		if (opts.tokens === true) {
			state.maxDepth = 0;
			if (!isPathSeparator(code)) tokens.push(token);
			state.tokens = tokens;
		}
		if (opts.parts === true || opts.tokens === true) {
			let prevIndex;
			for (let idx = 0; idx < slashes.length; idx++) {
				const n = prevIndex ? prevIndex + 1 : start;
				const i = slashes[idx];
				const value = input.slice(n, i);
				if (opts.tokens) {
					if (idx === 0 && start !== 0) {
						tokens[idx].isPrefix = true;
						tokens[idx].value = prefix;
					} else tokens[idx].value = value;
					depth(tokens[idx]);
					state.maxDepth += tokens[idx].depth;
				}
				if (idx !== 0 || value !== "") parts.push(value);
				prevIndex = i;
			}
			if (prevIndex && prevIndex + 1 < input.length) {
				const value = input.slice(prevIndex + 1);
				parts.push(value);
				if (opts.tokens) {
					tokens[tokens.length - 1].value = value;
					depth(tokens[tokens.length - 1]);
					state.maxDepth += tokens[tokens.length - 1].depth;
				}
			}
			state.slashes = slashes;
			state.parts = parts;
		}
		return state;
	};
	module.exports = scan;
}));
//#endregion
//#region ../../node_modules/.pnpm/picomatch@4.0.5/node_modules/picomatch/lib/parse.js
var require_parse = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const constants = require_constants();
	const utils = require_utils();
	/**
	* Constants
	*/
	const { MAX_LENGTH, POSIX_REGEX_SOURCE, REGEX_NON_SPECIAL_CHARS, REGEX_SPECIAL_CHARS_BACKREF, REPLACEMENTS } = constants;
	/**
	* Helpers
	*/
	const expandRange = (args, options) => {
		if (typeof options.expandRange === "function") return options.expandRange(...args, options);
		args.sort();
		const value = `[${args.join("-")}]`;
		try {
			new RegExp(value);
		} catch (ex) {
			return args.map((v) => utils.escapeRegex(v)).join("..");
		}
		return value;
	};
	/**
	* Create the message for a syntax error
	*/
	const syntaxError = (type, char) => {
		return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
	};
	const splitTopLevel = (input) => {
		const parts = [];
		let bracket = 0;
		let paren = 0;
		let quote = 0;
		let value = "";
		let escaped = false;
		for (const ch of input) {
			if (escaped === true) {
				value += ch;
				escaped = false;
				continue;
			}
			if (ch === "\\") {
				value += ch;
				escaped = true;
				continue;
			}
			if (ch === "\"") {
				quote = quote === 1 ? 0 : 1;
				value += ch;
				continue;
			}
			if (quote === 0) {
				if (ch === "[") bracket++;
				else if (ch === "]" && bracket > 0) bracket--;
				else if (bracket === 0) {
					if (ch === "(") paren++;
					else if (ch === ")" && paren > 0) paren--;
					else if (ch === "|" && paren === 0) {
						parts.push(value);
						value = "";
						continue;
					}
				}
			}
			value += ch;
		}
		parts.push(value);
		return parts;
	};
	const isPlainBranch = (branch) => {
		let escaped = false;
		for (const ch of branch) {
			if (escaped === true) {
				escaped = false;
				continue;
			}
			if (ch === "\\") {
				escaped = true;
				continue;
			}
			if (/[?*+@!()[\]{}]/.test(ch)) return false;
		}
		return true;
	};
	const normalizeSimpleBranch = (branch) => {
		let value = branch.trim();
		let changed = true;
		while (changed === true) {
			changed = false;
			if (/^@\([^\\()[\]{}|]+\)$/.test(value)) {
				value = value.slice(2, -1);
				changed = true;
			}
		}
		if (!isPlainBranch(value)) return;
		return value.replace(/\\(.)/g, "$1");
	};
	const hasRepeatedCharPrefixOverlap = (branches) => {
		const values = branches.map(normalizeSimpleBranch).filter(Boolean);
		for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
			const a = values[i];
			const b = values[j];
			const char = a[0];
			if (!char || a !== char.repeat(a.length) || b !== char.repeat(b.length)) continue;
			if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
		}
		return false;
	};
	const parseRepeatedExtglob = (pattern, requireEnd = true) => {
		if (pattern[0] !== "+" && pattern[0] !== "*" || pattern[1] !== "(") return;
		let bracket = 0;
		let paren = 0;
		let quote = 0;
		let escaped = false;
		for (let i = 1; i < pattern.length; i++) {
			const ch = pattern[i];
			if (escaped === true) {
				escaped = false;
				continue;
			}
			if (ch === "\\") {
				escaped = true;
				continue;
			}
			if (ch === "\"") {
				quote = quote === 1 ? 0 : 1;
				continue;
			}
			if (quote === 1) continue;
			if (ch === "[") {
				bracket++;
				continue;
			}
			if (ch === "]" && bracket > 0) {
				bracket--;
				continue;
			}
			if (bracket > 0) continue;
			if (ch === "(") {
				paren++;
				continue;
			}
			if (ch === ")") {
				paren--;
				if (paren === 0) {
					if (requireEnd === true && i !== pattern.length - 1) return;
					return {
						type: pattern[0],
						body: pattern.slice(2, i),
						end: i
					};
				}
			}
		}
	};
	const buildCharClassStar = (chars) => {
		return `${chars.length === 1 ? utils.escapeRegex(chars[0]) : `[${chars.map((ch) => utils.escapeRegex(ch)).join("")}]`}*`;
	};
	const getStarExtglobSequenceChars = (pattern) => {
		let index = 0;
		const chars = [];
		while (index < pattern.length) {
			const match = parseRepeatedExtglob(pattern.slice(index), false);
			if (!match || match.type !== "*") return;
			const branches = splitTopLevel(match.body).map((branch) => branch.trim());
			if (branches.length !== 1) return;
			const branch = normalizeSimpleBranch(branches[0]);
			if (!branch || branch.length !== 1) return;
			chars.push(branch);
			index += match.end + 1;
		}
		if (chars.length < 1) return;
		return chars;
	};
	const repeatedExtglobRecursion = (pattern) => {
		let depth = 0;
		let value = pattern.trim();
		let match = parseRepeatedExtglob(value);
		while (match) {
			depth++;
			value = match.body.trim();
			match = parseRepeatedExtglob(value);
		}
		return depth;
	};
	const analyzeRepeatedExtglob = (body, options) => {
		if (options.maxExtglobRecursion === false) return { risky: false };
		const max = typeof options.maxExtglobRecursion === "number" ? options.maxExtglobRecursion : constants.DEFAULT_MAX_EXTGLOB_RECURSION;
		const branches = splitTopLevel(body).map((branch) => branch.trim());
		if (branches.length > 1) {
			if (branches.some((branch) => branch === "") || branches.some((branch) => /^[*?]+$/.test(branch)) || hasRepeatedCharPrefixOverlap(branches)) return { risky: true };
		}
		const safeChars = [];
		let sawStarSequence = false;
		let combinable = true;
		for (const branch of branches) {
			const chars = getStarExtglobSequenceChars(branch);
			if (chars) {
				sawStarSequence = true;
				safeChars.push(...chars);
				continue;
			}
			const literal = normalizeSimpleBranch(branch);
			if (literal && literal.length === 1) {
				safeChars.push(literal);
				continue;
			}
			combinable = false;
			if (repeatedExtglobRecursion(branch) > max) return { risky: true };
		}
		if (sawStarSequence) return combinable ? {
			risky: true,
			safeOutput: buildCharClassStar([...new Set(safeChars)])
		} : { risky: true };
		return { risky: false };
	};
	/**
	* Parse the given input string.
	* @param {String} input
	* @param {Object} options
	* @return {Object}
	*/
	const parse = (input, options) => {
		if (typeof input !== "string") throw new TypeError("Expected a string");
		input = REPLACEMENTS[input] || input;
		const opts = { ...options };
		const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
		let len = input.length;
		if (len > max) throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
		const bos = {
			type: "bos",
			value: "",
			output: opts.prepend || ""
		};
		const tokens = [bos];
		const capture = opts.capture ? "" : "?:";
		const PLATFORM_CHARS = constants.globChars(opts.windows);
		const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
		const { DOT_LITERAL, PLUS_LITERAL, SLASH_LITERAL, ONE_CHAR, DOTS_SLASH, NO_DOT, NO_DOT_SLASH, NO_DOTS_SLASH, QMARK, QMARK_NO_DOT, STAR, START_ANCHOR } = PLATFORM_CHARS;
		const globstar = (opts) => {
			return `(${capture}(?:(?!${START_ANCHOR}${opts.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
		};
		const nodot = opts.dot ? "" : NO_DOT;
		const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
		let star = opts.bash === true ? globstar(opts) : STAR;
		if (opts.capture) star = `(${star})`;
		if (typeof opts.noext === "boolean") opts.noextglob = opts.noext;
		const state = {
			input,
			index: -1,
			start: 0,
			dot: opts.dot === true,
			consumed: "",
			output: "",
			prefix: "",
			backtrack: false,
			negated: false,
			brackets: 0,
			braces: 0,
			parens: 0,
			quotes: 0,
			globstar: false,
			tokens
		};
		input = utils.removePrefix(input, state);
		len = input.length;
		const extglobs = [];
		const braces = [];
		const stack = [];
		let prev = bos;
		let value;
		/**
		* Tokenizing helpers
		*/
		const eos = () => state.index === len - 1;
		const peek = state.peek = (n = 1) => input[state.index + n];
		const advance = state.advance = () => input[++state.index] || "";
		const remaining = () => input.slice(state.index + 1);
		const consume = (value = "", num = 0) => {
			state.consumed += value;
			state.index += num;
		};
		const append = (token) => {
			state.output += token.output != null ? token.output : token.value;
			consume(token.value);
		};
		const negate = () => {
			let count = 1;
			while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
				advance();
				state.start++;
				count++;
			}
			if (count % 2 === 0) return false;
			state.negated = true;
			state.start++;
			return true;
		};
		const increment = (type) => {
			state[type]++;
			stack.push(type);
		};
		const decrement = (type) => {
			state[type]--;
			stack.pop();
		};
		/**
		* Push tokens onto the tokens array. This helper speeds up
		* tokenizing by 1) helping us avoid backtracking as much as possible,
		* and 2) helping us avoid creating extra tokens when consecutive
		* characters are plain text. This improves performance and simplifies
		* lookbehinds.
		*/
		const push = (tok) => {
			if (prev.type === "globstar") {
				const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
				const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
				if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
					state.output = state.output.slice(0, -prev.output.length);
					prev.type = "star";
					prev.value = "*";
					prev.output = star;
					state.output += prev.output;
				}
			}
			if (extglobs.length && tok.type !== "paren") extglobs[extglobs.length - 1].inner += tok.value;
			if (tok.value || tok.output) append(tok);
			if (prev && prev.type === "text" && tok.type === "text") {
				prev.output = (prev.output || prev.value) + tok.value;
				prev.value += tok.value;
				return;
			}
			tok.prev = prev;
			tokens.push(tok);
			prev = tok;
		};
		const extglobOpen = (type, value) => {
			const token = {
				...EXTGLOB_CHARS[value],
				conditions: 1,
				inner: ""
			};
			token.prev = prev;
			token.parens = state.parens;
			token.output = state.output;
			token.startIndex = state.index;
			token.tokensIndex = tokens.length;
			const output = (opts.capture ? "(" : "") + token.open;
			increment("parens");
			push({
				type,
				value,
				output: state.output ? "" : ONE_CHAR
			});
			push({
				type: "paren",
				extglob: true,
				value: advance(),
				output
			});
			extglobs.push(token);
		};
		const extglobClose = (token) => {
			const literal = input.slice(token.startIndex, state.index + 1);
			const body = input.slice(token.startIndex + 2, state.index);
			const analysis = analyzeRepeatedExtglob(body, opts);
			if ((token.type === "plus" || token.type === "star") && analysis.risky) {
				const safeOutput = analysis.safeOutput ? (token.output ? "" : ONE_CHAR) + (opts.capture ? `(${analysis.safeOutput})` : analysis.safeOutput) : void 0;
				const open = tokens[token.tokensIndex];
				open.type = "text";
				open.value = literal;
				open.output = safeOutput || utils.escapeRegex(literal);
				for (let i = token.tokensIndex + 1; i < tokens.length; i++) {
					tokens[i].value = "";
					tokens[i].output = "";
					delete tokens[i].suffix;
				}
				state.output = token.output + open.output;
				state.backtrack = true;
				push({
					type: "paren",
					extglob: true,
					value,
					output: ""
				});
				decrement("parens");
				return;
			}
			let output = token.close + (opts.capture ? ")" : "");
			let rest;
			if (token.type === "negate") {
				let extglobStar = star;
				if (token.inner && token.inner.length > 1 && token.inner.includes("/")) extglobStar = globstar(opts);
				if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) output = token.close = `)$))${extglobStar}`;
				if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) output = token.close = `)${parse(rest, {
					...options,
					fastpaths: false
				}).output})${extglobStar})`;
				if (token.prev.type === "bos") state.negatedExtglob = true;
			}
			push({
				type: "paren",
				extglob: true,
				value,
				output
			});
			decrement("parens");
		};
		/**
		* Fast paths
		*/
		if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
			let backslashes = false;
			let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
				if (first === "\\") {
					backslashes = true;
					return m;
				}
				if (first === "?") {
					if (esc) return esc + first + (rest ? QMARK.repeat(rest.length) : "");
					if (index === 0) return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
					return QMARK.repeat(chars.length);
				}
				if (first === ".") return DOT_LITERAL.repeat(chars.length);
				if (first === "*") {
					if (esc) return esc + first + (rest ? star : "");
					return star;
				}
				return esc ? m : `\\${m}`;
			});
			if (backslashes === true) {
				if (opts.unescape === true) output = output.replace(/\\/g, "");
				else output = output.replace(/\\+/g, (m) => {
					return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
				});
			}
			if (output === input && opts.contains === true) {
				state.output = input;
				return state;
			}
			state.output = utils.wrapOutput(output, state, options);
			return state;
		}
		/**
		* Tokenize input until we reach end-of-string
		*/
		while (!eos()) {
			value = advance();
			if (value === "\0") continue;
			/**
			* Escaped characters
			*/
			if (value === "\\") {
				const next = peek();
				if (next === "/" && opts.bash !== true) continue;
				if (next === "." || next === ";") continue;
				if (!next) {
					value += "\\";
					push({
						type: "text",
						value
					});
					continue;
				}
				const match = /^\\+/.exec(remaining());
				let slashes = 0;
				if (match && match[0].length > 2) {
					slashes = match[0].length;
					state.index += slashes;
					if (slashes % 2 !== 0) value += "\\";
				}
				if (opts.unescape === true) value = advance();
				else value += advance();
				if (state.brackets === 0) {
					push({
						type: "text",
						value
					});
					continue;
				}
			}
			/**
			* If we're inside a regex character class, continue
			* until we reach the closing bracket.
			*/
			if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
				if (opts.posix !== false && value === ":") {
					const inner = prev.value.slice(1);
					if (inner.includes("[")) {
						prev.posix = true;
						if (inner.includes(":")) {
							const idx = prev.value.lastIndexOf("[");
							const pre = prev.value.slice(0, idx);
							const rest = prev.value.slice(idx + 2);
							const posix = POSIX_REGEX_SOURCE[rest];
							if (posix) {
								prev.value = pre + posix;
								state.backtrack = true;
								advance();
								if (!bos.output && tokens.indexOf(prev) === 1) bos.output = ONE_CHAR;
								continue;
							}
						}
					}
				}
				if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") value = `\\${value}`;
				if (value === "]" && (prev.value === "[" || prev.value === "[^")) value = `\\${value}`;
				if (opts.posix === true && value === "!" && prev.value === "[") value = "^";
				prev.value += value;
				append({ value });
				continue;
			}
			/**
			* If we're inside a quoted string, continue
			* until we reach the closing double quote.
			*/
			if (state.quotes === 1 && value !== "\"") {
				value = utils.escapeRegex(value);
				prev.value += value;
				append({ value });
				continue;
			}
			/**
			* Double quotes
			*/
			if (value === "\"") {
				state.quotes = state.quotes === 1 ? 0 : 1;
				if (opts.keepQuotes === true) push({
					type: "text",
					value
				});
				continue;
			}
			/**
			* Parentheses
			*/
			if (value === "(") {
				increment("parens");
				push({
					type: "paren",
					value
				});
				continue;
			}
			if (value === ")") {
				if (state.parens === 0 && opts.strictBrackets === true) throw new SyntaxError(syntaxError("opening", "("));
				const extglob = extglobs[extglobs.length - 1];
				if (extglob && state.parens === extglob.parens + 1) {
					extglobClose(extglobs.pop());
					continue;
				}
				push({
					type: "paren",
					value,
					output: state.parens ? ")" : "\\)"
				});
				decrement("parens");
				continue;
			}
			/**
			* Square brackets
			*/
			if (value === "[") {
				if (opts.nobracket === true || !remaining().includes("]")) {
					if (opts.nobracket !== true && opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
					value = `\\${value}`;
				} else increment("brackets");
				push({
					type: "bracket",
					value
				});
				continue;
			}
			if (value === "]") {
				if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
					push({
						type: "text",
						value,
						output: `\\${value}`
					});
					continue;
				}
				if (state.brackets === 0) {
					if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("opening", "["));
					push({
						type: "text",
						value,
						output: `\\${value}`
					});
					continue;
				}
				decrement("brackets");
				const prevValue = prev.value.slice(1);
				if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) value = `/${value}`;
				prev.value += value;
				append({ value });
				if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) continue;
				const escaped = utils.escapeRegex(prev.value);
				state.output = state.output.slice(0, -prev.value.length);
				if (opts.literalBrackets === true) {
					state.output += escaped;
					prev.value = escaped;
					continue;
				}
				prev.value = `(${capture}${escaped}|${prev.value})`;
				state.output += prev.value;
				continue;
			}
			/**
			* Braces
			*/
			if (value === "{" && opts.nobrace !== true) {
				increment("braces");
				const open = {
					type: "brace",
					value,
					output: "(",
					outputIndex: state.output.length,
					tokensIndex: state.tokens.length
				};
				braces.push(open);
				push(open);
				continue;
			}
			if (value === "}") {
				const brace = braces[braces.length - 1];
				if (opts.nobrace === true || !brace) {
					push({
						type: "text",
						value,
						output: value
					});
					continue;
				}
				let output = ")";
				if (brace.dots === true) {
					const arr = tokens.slice();
					const range = [];
					for (let i = arr.length - 1; i >= 0; i--) {
						tokens.pop();
						if (arr[i].type === "brace") break;
						if (arr[i].type !== "dots") range.unshift(arr[i].value);
					}
					output = expandRange(range, opts);
					state.backtrack = true;
				}
				if (brace.comma !== true && brace.dots !== true) {
					const out = state.output.slice(0, brace.outputIndex);
					const toks = state.tokens.slice(brace.tokensIndex);
					brace.value = brace.output = "\\{";
					value = output = "\\}";
					state.output = out;
					for (const t of toks) state.output += t.output || t.value;
				}
				push({
					type: "brace",
					value,
					output
				});
				decrement("braces");
				braces.pop();
				continue;
			}
			/**
			* Pipes
			*/
			if (value === "|") {
				if (extglobs.length > 0) extglobs[extglobs.length - 1].conditions++;
				push({
					type: "text",
					value
				});
				continue;
			}
			/**
			* Commas
			*/
			if (value === ",") {
				let output = value;
				const brace = braces[braces.length - 1];
				if (brace && stack[stack.length - 1] === "braces") {
					brace.comma = true;
					output = "|";
				}
				push({
					type: "comma",
					value,
					output
				});
				continue;
			}
			/**
			* Slashes
			*/
			if (value === "/") {
				if (prev.type === "dot" && state.index === state.start + 1) {
					state.start = state.index + 1;
					state.consumed = "";
					state.output = "";
					tokens.pop();
					prev = bos;
					continue;
				}
				push({
					type: "slash",
					value,
					output: SLASH_LITERAL
				});
				continue;
			}
			/**
			* Dots
			*/
			if (value === ".") {
				if (state.braces > 0 && prev.type === "dot") {
					if (prev.value === ".") prev.output = DOT_LITERAL;
					const brace = braces[braces.length - 1];
					prev.type = "dots";
					prev.output += value;
					prev.value += value;
					brace.dots = true;
					continue;
				}
				if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
					push({
						type: "text",
						value,
						output: DOT_LITERAL
					});
					continue;
				}
				push({
					type: "dot",
					value,
					output: DOT_LITERAL
				});
				continue;
			}
			/**
			* Question marks
			*/
			if (value === "?") {
				if (!(prev && prev.value === "(") && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
					extglobOpen("qmark", value);
					continue;
				}
				if (prev && prev.type === "paren") {
					const next = peek();
					let output = value;
					if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) output = `\\${value}`;
					push({
						type: "text",
						value,
						output
					});
					continue;
				}
				if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
					push({
						type: "qmark",
						value,
						output: QMARK_NO_DOT
					});
					continue;
				}
				push({
					type: "qmark",
					value,
					output: QMARK
				});
				continue;
			}
			/**
			* Exclamation
			*/
			if (value === "!") {
				if (opts.noextglob !== true && peek() === "(") {
					if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
						extglobOpen("negate", value);
						continue;
					}
				}
				if (opts.nonegate !== true && state.index === 0) {
					negate();
					continue;
				}
			}
			/**
			* Plus
			*/
			if (value === "+") {
				if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
					extglobOpen("plus", value);
					continue;
				}
				if (prev && prev.value === "(" || opts.regex === false) {
					push({
						type: "plus",
						value,
						output: PLUS_LITERAL
					});
					continue;
				}
				if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
					push({
						type: "plus",
						value
					});
					continue;
				}
				push({
					type: "plus",
					value: PLUS_LITERAL
				});
				continue;
			}
			/**
			* Plain text
			*/
			if (value === "@") {
				if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
					push({
						type: "at",
						extglob: true,
						value,
						output: ""
					});
					continue;
				}
				push({
					type: "text",
					value
				});
				continue;
			}
			/**
			* Plain text
			*/
			if (value !== "*") {
				if (value === "$" || value === "^") value = `\\${value}`;
				const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
				if (match) {
					value += match[0];
					state.index += match[0].length;
				}
				push({
					type: "text",
					value
				});
				continue;
			}
			/**
			* Stars
			*/
			if (prev && (prev.type === "globstar" || prev.star === true)) {
				prev.type = "star";
				prev.star = true;
				prev.value += value;
				prev.output = star;
				state.backtrack = true;
				state.globstar = true;
				consume(value);
				continue;
			}
			let rest = remaining();
			if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
				extglobOpen("star", value);
				continue;
			}
			if (prev.type === "star") {
				if (opts.noglobstar === true) {
					consume(value);
					continue;
				}
				const prior = prev.prev;
				const before = prior.prev;
				const isStart = prior.type === "slash" || prior.type === "bos";
				const afterStar = before && (before.type === "star" || before.type === "globstar");
				if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
					push({
						type: "star",
						value,
						output: ""
					});
					continue;
				}
				const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
				const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
				if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
					push({
						type: "star",
						value,
						output: ""
					});
					continue;
				}
				while (rest.slice(0, 3) === "/**") {
					const after = input[state.index + 4];
					if (after && after !== "/") break;
					rest = rest.slice(3);
					consume("/**", 3);
				}
				if (prior.type === "bos" && eos()) {
					prev.type = "globstar";
					prev.value += value;
					prev.output = globstar(opts);
					state.output = prev.output;
					state.globstar = true;
					consume(value);
					continue;
				}
				if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
					state.output = state.output.slice(0, -(prior.output + prev.output).length);
					prior.output = `(?:${prior.output}`;
					prev.type = "globstar";
					prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
					prev.value += value;
					state.globstar = true;
					state.output += prior.output + prev.output;
					consume(value);
					continue;
				}
				if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
					const end = rest[1] !== void 0 ? "|$" : "";
					state.output = state.output.slice(0, -(prior.output + prev.output).length);
					prior.output = `(?:${prior.output}`;
					prev.type = "globstar";
					prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
					prev.value += value;
					state.output += prior.output + prev.output;
					state.globstar = true;
					consume(value + advance());
					push({
						type: "slash",
						value: "/",
						output: ""
					});
					continue;
				}
				if (prior.type === "bos" && rest[0] === "/") {
					prev.type = "globstar";
					prev.value += value;
					prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
					state.output = prev.output;
					state.globstar = true;
					consume(value + advance());
					push({
						type: "slash",
						value: "/",
						output: ""
					});
					continue;
				}
				state.output = state.output.slice(0, -prev.output.length);
				prev.type = "globstar";
				prev.output = globstar(opts);
				prev.value += value;
				state.output += prev.output;
				state.globstar = true;
				consume(value);
				continue;
			}
			const token = {
				type: "star",
				value,
				output: star
			};
			if (opts.bash === true) {
				token.output = ".*?";
				if (prev.type === "bos" || prev.type === "slash") token.output = nodot + token.output;
				push(token);
				continue;
			}
			if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
				token.output = value;
				push(token);
				continue;
			}
			if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
				if (prev.type === "dot") {
					state.output += NO_DOT_SLASH;
					prev.output += NO_DOT_SLASH;
				} else if (opts.dot === true) {
					state.output += NO_DOTS_SLASH;
					prev.output += NO_DOTS_SLASH;
				} else {
					state.output += nodot;
					prev.output += nodot;
				}
				if (peek() !== "*") {
					state.output += ONE_CHAR;
					prev.output += ONE_CHAR;
				}
			}
			push(token);
		}
		while (state.brackets > 0) {
			if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
			state.output = utils.escapeLast(state.output, "[");
			decrement("brackets");
		}
		while (state.parens > 0) {
			if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
			state.output = utils.escapeLast(state.output, "(");
			decrement("parens");
		}
		while (state.braces > 0) {
			if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
			state.output = utils.escapeLast(state.output, "{");
			decrement("braces");
		}
		if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) push({
			type: "maybe_slash",
			value: "",
			output: `${SLASH_LITERAL}?`
		});
		if (state.backtrack === true) {
			state.output = "";
			for (const token of state.tokens) {
				state.output += token.output != null ? token.output : token.value;
				if (token.suffix) state.output += token.suffix;
			}
		}
		return state;
	};
	/**
	* Fast paths for creating regular expressions for common glob patterns.
	* This can significantly speed up processing and has very little downside
	* impact when none of the fast paths match.
	*/
	parse.fastpaths = (input, options) => {
		const opts = { ...options };
		const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
		const len = input.length;
		if (len > max) throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
		input = REPLACEMENTS[input] || input;
		const { DOT_LITERAL, SLASH_LITERAL, ONE_CHAR, DOTS_SLASH, NO_DOT, NO_DOTS, NO_DOTS_SLASH, STAR, START_ANCHOR } = constants.globChars(opts.windows);
		const nodot = opts.dot ? NO_DOTS : NO_DOT;
		const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
		const capture = opts.capture ? "" : "?:";
		const state = {
			negated: false,
			prefix: ""
		};
		let star = opts.bash === true ? ".*?" : STAR;
		if (opts.capture) star = `(${star})`;
		const globstar = (opts) => {
			if (opts.noglobstar === true) return star;
			return `(${capture}(?:(?!${START_ANCHOR}${opts.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
		};
		const create = (str) => {
			switch (str) {
				case "*": return `${nodot}${ONE_CHAR}${star}`;
				case ".*": return `${DOT_LITERAL}${ONE_CHAR}${star}`;
				case "*.*": return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
				case "*/*": return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
				case "**": return nodot + globstar(opts);
				case "**/*": return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
				case "**/*.*": return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
				case "**/.*": return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
				default: {
					const match = /^(.*?)\.(\w+)$/.exec(str);
					if (!match) return;
					const source = create(match[1]);
					if (!source) return;
					return source + DOT_LITERAL + match[2];
				}
			}
		};
		let source = create(utils.removePrefix(input, state));
		if (source && opts.strictSlashes !== true) source += `${SLASH_LITERAL}?`;
		return source;
	};
	module.exports = parse;
}));
//#endregion
//#region ../../node_modules/.pnpm/picomatch@4.0.5/node_modules/picomatch/lib/picomatch.js
var require_picomatch$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const scan = require_scan();
	const parse = require_parse();
	const utils = require_utils();
	const constants = require_constants();
	const isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
	/**
	* Creates a matcher function from one or more glob patterns. The
	* returned function takes a string to match as its first argument,
	* and returns true if the string is a match. The returned matcher
	* function also takes a boolean as the second argument that, when true,
	* returns an object with additional information.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch(glob[, options]);
	*
	* const isMatch = picomatch('*.!(*a)');
	* console.log(isMatch('a.a')); //=> false
	* console.log(isMatch('a.b')); //=> true
	*
	* // For environments without `node.js`, `picomatch/posix` provides you a dependency-free matcher, without automatic OS detection.
	* const picomatch = require('picomatch/posix');
	* // the same API, defaulting to posix paths
	* const isMatch = picomatch('a/*');
	* console.log(isMatch('a\\b')); //=> false
	* console.log(isMatch('a/b')); //=> true
	*
	* // you can still configure the matcher function to accept windows paths
	* const isMatch = picomatch('a/*', { options: windows });
	* console.log(isMatch('a\\b')); //=> true
	* console.log(isMatch('a/b')); //=> true
	* ```
	* @name picomatch
	* @param {String|Array} `globs` One or more glob patterns.
	* @param {Object=} `options`
	* @return {Function=} Returns a matcher function.
	* @api public
	*/
	const picomatch = (glob, options, returnState = false) => {
		if (Array.isArray(glob)) {
			const fns = glob.map((input) => picomatch(input, options, returnState));
			const arrayMatcher = (str) => {
				for (const isMatch of fns) {
					const state = isMatch(str);
					if (state) return state;
				}
				return false;
			};
			return arrayMatcher;
		}
		const isState = isObject(glob) && glob.tokens && glob.input;
		if (glob === "" || typeof glob !== "string" && !isState) throw new TypeError("Expected pattern to be a non-empty string");
		const opts = options || {};
		const posix = opts.windows;
		const regex = isState ? picomatch.compileRe(glob, options) : picomatch.makeRe(glob, options, false, true);
		const state = regex.state;
		delete regex.state;
		let isIgnored = () => false;
		if (opts.ignore) {
			const ignoreOpts = {
				...options,
				ignore: null,
				onMatch: null,
				onResult: null
			};
			isIgnored = picomatch(opts.ignore, ignoreOpts, returnState);
		}
		const matcher = (input, returnObject = false) => {
			const { isMatch, match, output } = picomatch.test(input, regex, options, {
				glob,
				posix
			});
			const result = {
				glob,
				state,
				regex,
				posix,
				input,
				output,
				match,
				isMatch
			};
			if (typeof opts.onResult === "function") opts.onResult(result);
			if (isMatch === false) {
				result.isMatch = false;
				return returnObject ? result : false;
			}
			if (isIgnored(input)) {
				if (typeof opts.onIgnore === "function") opts.onIgnore(result);
				result.isMatch = false;
				return returnObject ? result : false;
			}
			if (typeof opts.onMatch === "function") opts.onMatch(result);
			return returnObject ? result : true;
		};
		if (returnState) matcher.state = state;
		return matcher;
	};
	/**
	* Test `input` with the given `regex`. This is used by the main
	* `picomatch()` function to test the input string.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch.test(input, regex[, options]);
	*
	* console.log(picomatch.test('foo/bar', /^(?:([^/]*?)\/([^/]*?))$/));
	* // { isMatch: true, match: [ 'foo/', 'foo', 'bar' ], output: 'foo/bar' }
	* ```
	* @param {String} `input` String to test.
	* @param {RegExp} `regex`
	* @return {Object} Returns an object with matching info.
	* @api public
	*/
	picomatch.test = (input, regex, options, { glob, posix } = {}) => {
		if (typeof input !== "string") throw new TypeError("Expected input to be a string");
		if (input === "") return {
			isMatch: false,
			output: ""
		};
		const opts = options || {};
		const format = opts.format || (posix ? utils.toPosixSlashes : null);
		let match = input === glob;
		let output = match && format ? format(input) : input;
		if (match === false) {
			output = format ? format(input) : input;
			match = output === glob;
		}
		if (match === false || opts.capture === true) {
			if (opts.matchBase === true || opts.basename === true) match = picomatch.matchBase(input, regex, options, posix);
			else match = regex.exec(output);
		}
		return {
			isMatch: Boolean(match),
			match,
			output
		};
	};
	/**
	* Match the basename of a filepath.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch.matchBase(input, glob[, options]);
	* console.log(picomatch.matchBase('foo/bar.js', '*.js'); // true
	* ```
	* @param {String} `input` String to test.
	* @param {RegExp|String} `glob` Glob pattern or regex created by [.makeRe](#makeRe).
	* @return {Boolean}
	* @api public
	*/
	picomatch.matchBase = (input, glob, options, posix = options && options.windows) => {
		return (glob instanceof RegExp ? glob : picomatch.makeRe(glob, options)).test(utils.basename(input, { windows: posix }));
	};
	/**
	* Returns true if **any** of the given glob `patterns` match the specified `string`.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch.isMatch(string, patterns[, options]);
	*
	* console.log(picomatch.isMatch('a.a', ['b.*', '*.a'])); //=> true
	* console.log(picomatch.isMatch('a.a', 'b.*')); //=> false
	* ```
	* @param {String|Array} str The string to test.
	* @param {String|Array} patterns One or more glob patterns to use for matching.
	* @param {Object} [options] See available [options](#options).
	* @return {Boolean} Returns true if any patterns match `str`
	* @api public
	*/
	picomatch.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);
	/**
	* Parse a glob pattern to create the source string for a regular
	* expression.
	*
	* ```js
	* const picomatch = require('picomatch');
	* const result = picomatch.parse(pattern[, options]);
	* ```
	* @param {String} `pattern`
	* @param {Object} `options`
	* @return {Object} Returns an object with useful properties and output to be used as a regex source string.
	* @api public
	*/
	picomatch.parse = (pattern, options) => {
		if (Array.isArray(pattern)) return pattern.map((p) => picomatch.parse(p, options));
		return parse(pattern, {
			...options,
			fastpaths: false
		});
	};
	/**
	* Scan a glob pattern to separate the pattern into segments.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch.scan(input[, options]);
	*
	* const result = picomatch.scan('!./foo/*.js');
	* console.log(result);
	* { prefix: '!./',
	*   input: '!./foo/*.js',
	*   start: 3,
	*   base: 'foo',
	*   glob: '*.js',
	*   isBrace: false,
	*   isBracket: false,
	*   isGlob: true,
	*   isExtglob: false,
	*   isGlobstar: false,
	*   negated: true }
	* ```
	* @param {String} `input` Glob pattern to scan.
	* @param {Object} `options`
	* @return {Object} Returns an object with
	* @api public
	*/
	picomatch.scan = (input, options) => scan(input, options);
	/**
	* Compile a regular expression from the `state` object returned by the
	* [parse()](#parse) method.
	*
	* ```js
	* const picomatch = require('picomatch');
	* const state = picomatch.parse('*.js');
	* // picomatch.compileRe(state[, options]);
	*
	* console.log(picomatch.compileRe(state));
	* //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
	* ```
	* @param {Object} `state`
	* @param {Object} `options`
	* @param {Boolean} `returnOutput` Intended for implementors, this argument allows you to return the raw output from the parser.
	* @param {Boolean} `returnState` Adds the state to a `state` property on the returned regex. Useful for implementors and debugging.
	* @return {RegExp}
	* @api public
	*/
	picomatch.compileRe = (state, options, returnOutput = false, returnState = false) => {
		if (returnOutput === true) return state.output;
		const opts = options || {};
		const prepend = opts.contains ? "" : "^";
		const append = opts.contains ? "" : "$";
		let source = `${prepend}(?:${state.output})${append}`;
		if (state && state.negated === true) source = `^(?!${source}).*$`;
		const regex = picomatch.toRegex(source, options);
		if (returnState === true) regex.state = state;
		return regex;
	};
	/**
	* Create a regular expression from a parsed glob pattern.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch.makeRe(state[, options]);
	*
	* const result = picomatch.makeRe('*.js');
	* console.log(result);
	* //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
	* ```
	* @param {String} `state` The object returned from the `.parse` method.
	* @param {Object} `options`
	* @param {Boolean} `returnOutput` Implementors may use this argument to return the compiled output, instead of a regular expression. This is not exposed on the options to prevent end-users from mutating the result.
	* @param {Boolean} `returnState` Implementors may use this argument to return the state from the parsed glob with the returned regular expression.
	* @return {RegExp} Returns a regex created from the given pattern.
	* @api public
	*/
	picomatch.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
		if (!input || typeof input !== "string") throw new TypeError("Expected a non-empty string");
		let parsed = {
			negated: false,
			fastpaths: true
		};
		if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) parsed.output = parse.fastpaths(input, options);
		if (!parsed.output) parsed = parse(input, options);
		return picomatch.compileRe(parsed, options, returnOutput, returnState);
	};
	/**
	* Create a regular expression from the given regex source string.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch.toRegex(source[, options]);
	*
	* const { output } = picomatch.parse('*.js');
	* console.log(picomatch.toRegex(output));
	* //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
	* ```
	* @param {String} `source` Regular expression source string.
	* @param {Object} `options`
	* @return {RegExp}
	* @api public
	*/
	picomatch.toRegex = (source, options) => {
		try {
			const opts = options || {};
			return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
		} catch (err) {
			if (options && options.debug === true) throw err;
			return /$^/;
		}
	};
	/**
	* Picomatch constants.
	* @return {Object}
	*/
	picomatch.constants = constants;
	/**
	* Expose "picomatch"
	*/
	module.exports = picomatch;
}));
//#endregion
//#region ../../node_modules/.pnpm/tinyglobby@0.2.17/node_modules/tinyglobby/dist/index.mjs
var import_picomatch = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const pico = require_picomatch$1();
	const utils = require_utils();
	function picomatch(glob, options, returnState = false) {
		if (options && (options.windows === null || options.windows === void 0)) options = {
			...options,
			windows: utils.isWindows()
		};
		return pico(glob, options, returnState);
	}
	Object.assign(picomatch, pico);
	module.exports = picomatch;
})))(), 1);
const isReadonlyArray = Array.isArray;
const BACKSLASHES = /\\/g;
const DRIVE_RELATIVE_PATH = /^[A-Za-z]:$/;
const isWin = process.platform === "win32";
const ONLY_PARENT_DIRECTORIES = /^(\/?\.\.)+$/;
function getPartialMatcher(patterns, options = {}) {
	const patternsCount = patterns.length;
	const patternsParts = Array(patternsCount);
	const matchers = Array(patternsCount);
	let i, j;
	for (i = 0; i < patternsCount; i++) {
		const parts = splitPattern(patterns[i]);
		patternsParts[i] = parts;
		const partsCount = parts.length;
		const partMatchers = Array(partsCount);
		for (j = 0; j < partsCount; j++) partMatchers[j] = (0, import_picomatch.default)(parts[j], options);
		matchers[i] = partMatchers;
	}
	return (input) => {
		const inputParts = input.split("/");
		if (inputParts[0] === ".." && ONLY_PARENT_DIRECTORIES.test(input)) return true;
		for (i = 0; i < patternsCount; i++) {
			const patternParts = patternsParts[i];
			const matcher = matchers[i];
			const inputPatternCount = inputParts.length;
			const minParts = Math.min(inputPatternCount, patternParts.length);
			j = 0;
			while (j < minParts) {
				const part = patternParts[j];
				if (part.includes("/")) return true;
				if (!matcher[j](inputParts[j])) break;
				if (!options.noglobstar && part === "**") return true;
				j++;
			}
			if (j === inputPatternCount) return true;
		}
		return false;
	};
}
/* node:coverage ignore next 2 */
const WIN32_ROOT_DIR = /^[A-Z]:\/$/i;
const isRoot = isWin ? (p) => WIN32_ROOT_DIR.test(p) : (p) => p === "/";
function buildFormat(cwd, root, absolute) {
	if (cwd === root || root.startsWith(`${cwd}/`)) {
		if (absolute) {
			const start = cwd.length + +!isRoot(cwd);
			return (p, isDir) => p.slice(start, isDir ? -1 : void 0) || ".";
		}
		const prefix = root.slice(cwd.length + 1);
		if (prefix) return (p, isDir) => {
			if (p === ".") return prefix;
			const result = `${prefix}/${p}`;
			return isDir ? result.slice(0, -1) : result;
		};
		return (p, isDir) => isDir && p !== "." ? p.slice(0, -1) : p;
	}
	if (absolute) return (p) => posix.relative(cwd, p) || ".";
	return (p) => posix.relative(cwd, `${root}/${p}`) || ".";
}
function buildRelative(cwd, root) {
	if (root.startsWith(`${cwd}/`)) {
		const prefix = root.slice(cwd.length + 1);
		return (p) => `${prefix}/${p}`;
	}
	return (p) => {
		const result = posix.relative(cwd, `${root}/${p}`);
		return p[p.length - 1] === "/" && result !== "" ? `${result}/` : result || ".";
	};
}
function ensureNonDriveRelativePath(path) {
	return path.replace(DRIVE_RELATIVE_PATH, (match) => `${match}/`);
}
const splitPatternOptions = { parts: true };
function splitPattern(path) {
	var _result$parts;
	const result = import_picomatch.default.scan(path, splitPatternOptions);
	return ((_result$parts = result.parts) === null || _result$parts === void 0 ? void 0 : _result$parts.length) ? result.parts : [path];
}
const POSIX_UNESCAPED_GLOB_SYMBOLS = /(?<!\\)([()[\]{}*?|]|^!|[!+@](?=\()|\\(?![()[\]{}!*+?@|]))/g;
const WIN32_UNESCAPED_GLOB_SYMBOLS = /(?<!\\)([()[\]{}]|^!|[!+@](?=\())/g;
const escapePosixPath = (path) => path.replace(POSIX_UNESCAPED_GLOB_SYMBOLS, "\\$&");
const escapeWin32Path = (path) => path.replace(WIN32_UNESCAPED_GLOB_SYMBOLS, "\\$&");
/**
* Escapes a path's special characters depending on the platform.
* @see {@link https://superchupu.dev/tinyglobby/documentation#escapePath}
*/
/* node:coverage ignore next */
const escapePath = isWin ? escapeWin32Path : escapePosixPath;
/**
* Checks if a pattern has dynamic parts.
*
* Has a few minor differences with [`fast-glob`](https://github.com/mrmlnc/fast-glob) for better accuracy:
*
* - Doesn't necessarily return `false` on patterns that include `\`.
* - Returns `true` if the pattern includes parentheses, regardless of them representing one single pattern or not.
* - Returns `true` for unfinished glob extensions i.e. `(h`, `+(h`.
* - Returns `true` for unfinished brace expansions as long as they include `,` or `..`.
*
* @see {@link https://superchupu.dev/tinyglobby/documentation#isDynamicPattern}
*/
function isDynamicPattern(pattern, options) {
	if ((options === null || options === void 0 ? void 0 : options.caseSensitiveMatch) === false) return true;
	const scan = import_picomatch.default.scan(pattern);
	return scan.isGlob || scan.negated;
}
function log(...tasks) {
	console.log(`[tinyglobby ${(/* @__PURE__ */ new Date()).toLocaleTimeString("es")}]`, ...tasks);
}
function ensureStringArray(value) {
	return typeof value === "string" ? [value] : value !== null && value !== void 0 ? value : [];
}
const PARENT_DIRECTORY = /^(\/?\.\.)+/;
const ESCAPING_BACKSLASHES = /\\(?=[()[\]{}!*+?@|])/g;
function normalizePattern(pattern, opts, props, isIgnore) {
	var _PARENT_DIRECTORY$exe;
	const cwd = opts.cwd;
	let result = pattern;
	if (pattern[pattern.length - 1] === "/") result = pattern.slice(0, -1);
	if (result[result.length - 1] !== "*" && opts.expandDirectories) result += "/**";
	const escapedCwd = escapePath(cwd);
	result = isAbsolute$1(result.replace(ESCAPING_BACKSLASHES, "")) ? posix.relative(escapedCwd, result) : posix.normalize(result);
	const parentDir = (_PARENT_DIRECTORY$exe = PARENT_DIRECTORY.exec(result)) === null || _PARENT_DIRECTORY$exe === void 0 ? void 0 : _PARENT_DIRECTORY$exe[0];
	const parts = splitPattern(result);
	if (parentDir) {
		const n = (parentDir.length + 1) / 3;
		let i = 0;
		const cwdParts = escapedCwd.split("/");
		while (i < n && parts[i + n] === cwdParts[cwdParts.length + i - n]) {
			result = result.slice(0, (n - i - 1) * 3) + result.slice((n - i) * 3 + parts[i + n].length + 1) || ".";
			i++;
		}
		const potentialRoot = posix.join(cwd, parentDir.slice(i * 3));
		if (potentialRoot[0] !== "." && props.root.length > potentialRoot.length) {
			props.root = ensureNonDriveRelativePath(potentialRoot);
			props.depthOffset = -n + i;
		}
	}
	if (!isIgnore && props.depthOffset >= 0) {
		var _props$commonPath;
		(_props$commonPath = props.commonPath) !== null && _props$commonPath !== void 0 || (props.commonPath = parts);
		const newCommonPath = [];
		const length = Math.min(props.commonPath.length, parts.length);
		for (let i = 0; i < length; i++) {
			const part = parts[i];
			if (part === "**" && !parts[i + 1]) {
				newCommonPath.pop();
				break;
			}
			if (i === parts.length - 1 || part !== props.commonPath[i] || isDynamicPattern(part)) break;
			newCommonPath.push(part);
		}
		props.depthOffset = newCommonPath.length;
		props.commonPath = newCommonPath;
		props.root = ensureNonDriveRelativePath(newCommonPath.length > 0 ? posix.join(cwd, ...newCommonPath) : cwd);
	}
	return result;
}
function processPatterns(options, patterns, props) {
	const matchPatterns = [];
	const ignorePatterns = [];
	for (const pattern of options.ignore) {
		if (!pattern) continue;
		if (pattern[0] !== "!" || pattern[1] === "(") ignorePatterns.push(normalizePattern(pattern, options, props, true));
	}
	for (const pattern of patterns) {
		if (!pattern) continue;
		if (pattern[0] !== "!" || pattern[1] === "(") matchPatterns.push(normalizePattern(pattern, options, props, false));
		else if (pattern[1] !== "!" || pattern[2] === "(") ignorePatterns.push(normalizePattern(pattern.slice(1), options, props, true));
	}
	return {
		match: matchPatterns,
		ignore: ignorePatterns
	};
}
function buildCrawler(options, patterns) {
	const cwd = options.cwd;
	const props = {
		root: cwd,
		depthOffset: 0
	};
	const processed = processPatterns(options, patterns, props);
	if (options.debug) log("internal processing patterns:", processed);
	const { absolute, caseSensitiveMatch, debug, dot, followSymbolicLinks, onlyDirectories } = options;
	const root = props.root.replace(BACKSLASHES, "");
	const matchOptions = {
		dot,
		nobrace: options.braceExpansion === false,
		nocase: !caseSensitiveMatch,
		noextglob: options.extglob === false,
		noglobstar: options.globstar === false,
		posix: true
	};
	const matcher = (0, import_picomatch.default)(processed.match, matchOptions);
	const ignore = (0, import_picomatch.default)(processed.ignore, matchOptions);
	const partialMatcher = getPartialMatcher(processed.match, matchOptions);
	const format = buildFormat(cwd, root, absolute);
	const excludeFormatter = absolute ? format : buildFormat(cwd, root, true);
	const excludePredicate = (_, p) => {
		const relativePath = excludeFormatter(p, true);
		return relativePath !== "." && !partialMatcher(relativePath) || ignore(relativePath);
	};
	let maxDepth;
	if (options.deep !== void 0) maxDepth = Math.round(options.deep - props.depthOffset);
	const crawler = new Builder({
		filters: [debug ? (p, isDirectory) => {
			const path = format(p, isDirectory);
			const matches = matcher(path) && !ignore(path);
			if (matches) log(`matched ${path}`);
			return matches;
		} : (p, isDirectory) => {
			const path = format(p, isDirectory);
			return matcher(path) && !ignore(path);
		}],
		exclude: debug ? (_, p) => {
			const skipped = excludePredicate(_, p);
			log(`${skipped ? "skipped" : "crawling"} ${p}`);
			return skipped;
		} : excludePredicate,
		fs: options.fs,
		pathSeparator: "/",
		relativePaths: !absolute,
		resolvePaths: absolute,
		includeBasePath: absolute,
		resolveSymlinks: followSymbolicLinks,
		excludeSymlinks: !followSymbolicLinks,
		excludeFiles: onlyDirectories,
		includeDirs: onlyDirectories || !options.onlyFiles,
		maxDepth,
		signal: options.signal
	}).crawl(root);
	if (options.debug) log("internal properties:", {
		...props,
		root
	});
	return [crawler, cwd !== root && !absolute && buildRelative(cwd, root)];
}
function formatPaths(paths, mapper) {
	if (mapper) for (let i = paths.length - 1; i >= 0; i--) paths[i] = mapper(paths[i]);
	return paths;
}
const defaultOptions$1 = {
	caseSensitiveMatch: true,
	debug: !!process.env.TINYGLOBBY_DEBUG,
	expandDirectories: true,
	followSymbolicLinks: true,
	onlyFiles: true
};
function getOptions(options) {
	const opts = Object.assign({}, options);
	for (const key in defaultOptions$1) if (opts[key] === void 0) Object.assign(opts, { [key]: defaultOptions$1[key] });
	opts.cwd = (opts.cwd instanceof URL ? fileURLToPath(opts.cwd) : resolve$1(opts.cwd || process.cwd())).replace(BACKSLASHES, "/");
	opts.ignore = ensureStringArray(opts.ignore);
	opts.fs && (opts.fs = {
		readdir: opts.fs.readdir || readdir$1,
		readdirSync: opts.fs.readdirSync || readdirSync,
		realpath: opts.fs.realpath || realpath,
		realpathSync: opts.fs.realpathSync || realpathSync,
		stat: opts.fs.stat || stat$1,
		statSync: opts.fs.statSync || statSync$1
	});
	if (opts.debug) log("globbing with options:", opts);
	return opts;
}
function getCrawler(globInput, inputOptions = {}) {
	var _ref;
	if (globInput && (inputOptions === null || inputOptions === void 0 ? void 0 : inputOptions.patterns)) throw new Error("Cannot pass patterns as both an argument and an option");
	const isModern = isReadonlyArray(globInput) || typeof globInput === "string";
	const patterns = ensureStringArray((_ref = isModern ? globInput : globInput.patterns) !== null && _ref !== void 0 ? _ref : "**/*");
	const options = getOptions(isModern ? inputOptions : globInput);
	return patterns.length > 0 ? buildCrawler(options, patterns) : [];
}
async function glob(globInput, options) {
	const [crawler, relative] = getCrawler(globInput, options);
	return crawler ? formatPaths(await crawler.withPromise(), relative) : [];
}
//#endregion
//#region ../../node_modules/.pnpm/empathic@2.0.1/node_modules/empathic/resolve.mjs
/**
* Resolve an absolute path from {@link root}, but only
* if {@link input} isn't already absolute.
*
* @param input The path to resolve.
* @param root The base path; default = process.cwd()
* @returns The resolved absolute path.
*/
function absolute(input, root) {
	return isAbsolute(input) ? input : resolve(root || ".", input);
}
//#endregion
//#region ../../node_modules/.pnpm/empathic@2.0.1/node_modules/empathic/walk.mjs
/**
* Get all parent directories of {@link base}.
* Stops after {@link Options['last']} is processed.
*
* @returns An array of absolute paths of all parent directories.
*/
function up$2(base, options) {
	let { last, cwd } = options || {};
	let tmp = absolute(base, cwd);
	let root = absolute(last || "/", cwd);
	let prev, arr = [];
	while (prev !== root) {
		arr.push(tmp);
		tmp = dirname(prev = tmp);
		if (tmp === prev) break;
	}
	return arr;
}
//#endregion
//#region ../../node_modules/.pnpm/empathic@2.0.1/node_modules/empathic/find.mjs
/**
* Find an item by name, walking parent directories until found.
*
* @param name The item name to find.
* @returns The absolute path to the item, if found.
*/
function up$1(name, options) {
	let dir, tmp;
	for (dir of up$2(options && options.cwd || "", options)) {
		tmp = join(dir, name);
		if (existsSync(tmp)) return tmp;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/empathic@2.0.1/node_modules/empathic/package.mjs
/**
* Find the closest "package.json" file while walking parent directories.
* @returns The absolute path to a "package.json", if found.
*/
function up(options) {
	return up$1("package.json", options);
}
//#endregion
//#region ../../node_modules/.pnpm/import-without-cache@0.4.0/node_modules/import-without-cache/dist/index.mjs
var __require = /* @__PURE__ */ createRequire(import.meta.url);
const namespace = "no-cache://";
const namespaceLength = 11;
const isSupported = !!module$1.registerHooks;
const RE_NODE_MODULES = /[/\\]node_modules[/\\]/;
const depsStore = new AsyncLocalStorage();
let deregister;
function init({ skipNodeModules } = {}) {
	if (process$1.versions.bun) throw new Error("init is unnecessary in Bun, use clearRequireCache() instead.");
	if (!isSupported) throw new Error("import-without-cache requires Node.js v22.15.0 or higher.");
	if (deregister) return deregister;
	const hooks = module$1.registerHooks({
		resolve(specifier, context, nextResolve) {
			let noCache = context.importAttributes?.cache === "no";
			if (specifier.startsWith(namespace)) {
				specifier = specifier.slice(namespaceLength);
				noCache = true;
			}
			const resolved = nextResolve(specifier, context);
			if (skipNodeModules && RE_NODE_MODULES.test(resolved.url)) return resolved;
			if (!resolved.url.startsWith("file://")) return resolved;
			const parentUUID = getParentUUID(context.parentURL);
			if (!noCache && !parentUUID) return resolved;
			const deps = depsStore.getStore();
			if (deps) deps.add(fileURLToPath$1(resolved.url));
			resolved.url = appendUUID(resolved.url, parentUUID || crypto.randomUUID());
			return resolved;
		},
		load(url, context, nextLoad) {
			cleanupImportAttributes(context);
			return nextLoad(url, context);
		}
	});
	return deregister = () => {
		hooks.deregister();
		deregister = void 0;
	};
}
function clearRequireCache() {
	for (const key of Object.keys(__require.cache)) delete __require.cache[key];
}
function getParentUUID(parentURL) {
	if (!parentURL) return;
	return new URL(parentURL).searchParams.get("no-cache") ?? void 0;
}
function appendUUID(url, uuid) {
	const parsed = new URL(url);
	parsed.searchParams.set("no-cache", uuid);
	return parsed.toString();
}
function cleanupImportAttributes(context) {
	if (!context.importAttributes?.cache) return;
	const attrs = Object.assign(Object.create(null), context.importAttributes);
	delete attrs.cache;
	context.importAttributes = attrs;
	Object.freeze(context.importAttributes);
}
//#endregion
//#region ../../node_modules/.pnpm/quansync@1.0.0/node_modules/quansync/dist/src-C2Pm6gXo.js
const GET_IS_ASYNC = Symbol.for("quansync.getIsAsync");
var QuansyncError = class extends Error {
	constructor(message = "Unexpected promise in sync context") {
		super(message);
		this.name = "QuansyncError";
	}
};
function isThenable(value) {
	return value && typeof value === "object" && typeof value.then === "function";
}
function isQuansyncGenerator(value) {
	return value && typeof value === "object" && typeof value[Symbol.iterator] === "function" && "__quansync" in value;
}
function fromObject(options) {
	const generator = function* (...args) {
		if (yield GET_IS_ASYNC) return yield options.async.apply(this, args);
		return options.sync.apply(this, args);
	};
	function fn(...args) {
		const iter = generator.apply(this, args);
		iter.then = (...thenArgs) => options.async.apply(this, args).then(...thenArgs);
		iter.__quansync = true;
		return iter;
	}
	fn.sync = options.sync;
	fn.async = options.async;
	return fn;
}
function fromPromise(promise) {
	return fromObject({
		async: () => Promise.resolve(promise),
		sync: () => {
			if (isThenable(promise)) throw new QuansyncError();
			return promise;
		}
	});
}
function unwrapYield(value, isAsync) {
	if (value === GET_IS_ASYNC) return isAsync;
	if (isQuansyncGenerator(value)) return isAsync ? iterateAsync(value) : iterateSync(value);
	if (!isAsync && isThenable(value)) throw new QuansyncError();
	return value;
}
const DEFAULT_ON_YIELD = (value) => value;
function iterateSync(generator, onYield = DEFAULT_ON_YIELD) {
	let current = generator.next();
	while (!current.done) try {
		current = generator.next(unwrapYield(onYield(current.value, false)));
	} catch (err) {
		current = generator.throw(err);
	}
	return unwrapYield(current.value);
}
async function iterateAsync(generator, onYield = DEFAULT_ON_YIELD) {
	let current = generator.next();
	while (!current.done) try {
		current = generator.next(await unwrapYield(onYield(current.value, true), true));
	} catch (err) {
		current = generator.throw(err);
	}
	return current.value;
}
function fromGeneratorFn(generatorFn, options) {
	return fromObject({
		name: generatorFn.name,
		async(...args) {
			return iterateAsync(generatorFn.apply(this, args), options?.onYield);
		},
		sync(...args) {
			return iterateSync(generatorFn.apply(this, args), options?.onYield);
		}
	});
}
function quansync$1(input, options) {
	if (isThenable(input)) return fromPromise(input);
	if (typeof input === "function") return fromGeneratorFn(input, options);
	else return fromObject(input);
}
quansync$1({
	async: () => Promise.resolve(true),
	sync: () => false
});
//#endregion
//#region ../../node_modules/.pnpm/quansync@1.0.0/node_modules/quansync/dist/macro.js
/**
* This function is equivalent to `quansync` from main entry
* but accepts a fake argument type of async functions.
*
* This requires to be used with the macro transformer `unplugin-quansync`.
* Do NOT use it directly.
*
* @internal
*/
const quansync = quansync$1;
quansync$1({
	sync: re.readFileSync,
	async: re.promises.readFile
});
quansync$1({
	sync: re.writeFileSync,
	async: re.promises.writeFile
});
quansync$1({
	sync: re.unlinkSync,
	async: re.promises.unlink
});
quansync$1({
	sync: re.accessSync,
	async: re.promises.access
});
/**
* @link https://nodejs.org/api/fs.html#fspromisesstatpath-options
*/
const stat$2 = quansync$1({
	sync: re.statSync,
	async: re.promises.stat
});
const lstat = quansync$1({
	sync: re.lstatSync,
	async: re.promises.lstat
});
quansync$1({
	sync: re.copyFileSync,
	async: re.promises.copyFile
});
quansync$1({
	sync: re.rmSync,
	async: re.promises.rm
});
quansync$1({
	sync: re.mkdirSync,
	async: re.promises.mkdir
});
quansync$1({
	sync: re.renameSync,
	async: re.promises.rename
});
quansync$1({
	sync: re.readdirSync,
	async: re.promises.readdir
});
quansync$1({
	sync: re.realpathSync,
	async: re.promises.realpath
});
quansync$1({
	sync: re.readlinkSync,
	async: re.promises.readlink
});
quansync$1({
	sync: re.symlinkSync,
	async: re.promises.symlink
});
quansync$1({
	sync: re.chownSync,
	async: re.promises.chown
});
quansync$1({
	sync: re.lchownSync,
	async: re.promises.lchown
});
quansync$1({
	sync: re.chmodSync,
	async: re.promises.chmod
});
quansync$1({
	sync: re.utimesSync,
	async: re.promises.utimes
});
quansync$1({
	sync: re.lutimesSync,
	async: re.promises.lutimes
});
quansync$1({
	sync: re.mkdtempSync,
	async: re.promises.mkdtemp
});
//#endregion
//#region ../../node_modules/.pnpm/unconfig-core@7.5.0/node_modules/unconfig-core/dist/index.mjs
const isFile = quansync(function* (path, allowSymlinks) {
	try {
		return (yield (allowSymlinks ? stat$2 : lstat)(path)).isFile();
	} catch {
		return false;
	}
});
const findUp = quansync(function* (paths, options = {}) {
	const { cwd = process$1.cwd(), stopAt = parse(cwd).root, multiple = false, allowSymlinks = true } = options;
	let current = cwd;
	const files = [];
	while (current && current !== stopAt) {
		for (const path of paths) {
			const filepath = resolve(current, path);
			if (yield isFile(filepath, allowSymlinks)) {
				files.push(filepath);
				if (!multiple) return files;
			}
		}
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return files;
});
const loadConfigFile$1 = quansync(function* (filepath, source) {
	try {
		const config = yield source.parser(filepath);
		if (!config) return;
		return {
			config,
			source: filepath
		};
	} catch (e) {
		if (source.skipOnError) return;
		throw e;
	}
});
function createConfigCoreLoader(options) {
	const { cwd = process$1.cwd(), multiple, sources } = options;
	const results = [];
	let matchedFiles;
	const findConfigs = quansync(function* () {
		if (matchedFiles == null) matchedFiles = [];
		matchedFiles.length = 0;
		for (const source of sources) {
			const { extensions } = source;
			const files = yield findUp(source.files.flatMap((file) => !extensions?.length ? [file] : extensions.map((ext) => ext ? `${file}.${ext}` : file)), {
				cwd,
				stopAt: options.stopAt,
				multiple
			});
			matchedFiles.push([source, files]);
		}
		return matchedFiles.flatMap((i) => i[1]);
	});
	return {
		load: quansync(function* (force = false) {
			if (matchedFiles == null || force) yield findConfigs();
			for (const [source, files] of matchedFiles) {
				if (!files.length) continue;
				if (!multiple) {
					const result = yield loadConfigFile$1(files[0], source);
					if (result) return [result];
				} else for (const file of files) {
					const result = yield loadConfigFile$1(file, source);
					if (result) results.push(result);
				}
			}
			return results;
		}),
		findConfigs
	};
}
const picomatch = createRequire(import.meta.url)("./npm_entry_picomatch.cjs");
const debug$3$2 = createDebug("tsdown:clean");
const RE_LAST_SLASH = /[/\\]$/;
async function cleanOutDir(configs) {
	const removes = /* @__PURE__ */ new Set();
	for (const config of configs) {
		if (config.devtools && (config.devtools.clean ?? true)) config.clean.push("node_modules/.rolldown");
		if (config.exe) {
			const exeOutDir = path.resolve(config.cwd, config.exe.outDir || "build");
			config.clean.push(exeOutDir);
		}
		if (!config.clean.length) continue;
		const files = await glob(config.clean, {
			cwd: config.cwd,
			absolute: true,
			onlyFiles: false,
			dot: true
		});
		const normalizedOutDir = config.outDir.replace(RE_LAST_SLASH, "");
		for (const file of files) if (file.replace(RE_LAST_SLASH, "") !== normalizedOutDir) removes.add(file);
	}
	if (!removes.size) return;
	globalLogger.info(`Cleaning ${removes.size} files`);
	await Promise.all([...removes].map(async (file) => {
		debug$3$2("Removing", file);
		await fsRemove(file);
	}));
	debug$3$2("Removed %d files", removes.size);
}
function resolveClean(clean, outDir, cwd) {
	if (clean === true) clean = [slash(outDir)];
	else if (!clean) clean = [];
	if (clean.some((item) => path.resolve(item) === cwd)) throw new Error("Cannot clean the current working directory. Please specify a different path to clean option.");
	return clean;
}
async function cleanChunks(outDir, chunks) {
	await Promise.all(chunks.map(async (chunk) => {
		const filePath = path.resolve(outDir, chunk.fileName);
		debug$3$2("Removing chunk file", filePath);
		await fsRemove(filePath);
	}));
}
async function resolveEntry(logger, entry, cwd, color, nameLabel, root) {
	if (!entry || Object.keys(entry).length === 0) {
		const defaultEntry = path.resolve(cwd, "src/index.ts");
		if (await fsExists(defaultEntry)) entry = { index: defaultEntry };
		else throw new Error(`${nameLabel ? `${nameLabel} ` : ""}No input files, try "vp pack <your-file>" or create src/index.ts`);
	}
	const [entryMap, computedRoot] = await toObjectEntry(entry, cwd, root);
	const entries = Object.values(entryMap);
	if (entries.length === 0) throw new Error(`${nameLabel ? `${nameLabel} ` : ""}Cannot find entry: ${JSON.stringify(entry)}`);
	logger.info(nameLabel, `entry: ${color(entries.map((entry) => path.isAbsolute(entry) ? path.relative(cwd, entry) : entry).join(", "))}`);
	return [entryMap, computedRoot];
}
function toObjectEntry(entry, cwd, root) {
	if (typeof entry === "string") entry = [entry];
	if (!Array.isArray(entry)) return resolveObjectEntry(entry, cwd);
	return resolveArrayEntry(entry, cwd, root);
}
function isGlobEntry(entry) {
	if (!entry) return false;
	if (typeof entry === "string") return isDynamicPattern(entry);
	if (Array.isArray(entry)) return entry.some((e) => typeof e === "string" ? isDynamicPattern(e) : isGlobEntry(e));
	return Object.keys(entry).some((key) => key.includes("*"));
}
async function resolveObjectEntry(entries, cwd) {
	const entry = Object.fromEntries((await Promise.all(Object.entries(entries).map(async ([key, value]) => {
		if (!key.includes("*")) {
			if (Array.isArray(value)) throw new TypeError(`Object entry "${key}" cannot have an array value when the key is not a glob pattern.`);
			return [[key, value]];
		}
		const patterns = toArray(value);
		const files = await glob(patterns, {
			cwd,
			expandDirectories: false
		});
		if (!files.length) throw new Error(`Cannot find files for entry key "${key}" with patterns: ${JSON.stringify(patterns)}`);
		let valueGlobBase;
		for (const pattern of patterns) {
			if (pattern.startsWith("!")) continue;
			const base = picomatch.scan(pattern).base;
			if (valueGlobBase === void 0) valueGlobBase = base;
			else if (valueGlobBase !== base) throw new Error(`When using object entry with glob pattern key "${key}", all value glob patterns must have the same base directory.`);
		}
		if (valueGlobBase === void 0) throw new Error(`Cannot determine base directory for value glob patterns of key "${key}".`);
		return files.map((file) => [slash(key.replaceAll("*", stripExtname(path.relative(valueGlobBase, file)))), path.resolve(cwd, file)]);
	}))).flat());
	return [entry, lowestCommonAncestor(...Object.values(entry))];
}
async function resolveArrayEntry(entries, cwd, root) {
	const stringEntries = [];
	const objectEntries = [];
	for (const e of entries) if (typeof e === "string") stringEntries.push(e);
	else objectEntries.push(e);
	const isGlob = stringEntries.some((e) => isDynamicPattern(e));
	let resolvedEntries;
	if (isGlob) resolvedEntries = (await glob(stringEntries, {
		cwd,
		expandDirectories: false,
		absolute: true
	})).map((file) => path.resolve(file));
	else resolvedEntries = stringEntries;
	const computedRoot = root || lowestCommonAncestor(...resolvedEntries);
	const base = root && !isGlob ? path.relative(cwd, root) || "." : computedRoot;
	const arrayEntryMap = Object.fromEntries(resolvedEntries.map((file) => {
		return [slash(stripExtname(path.relative(base, file))), file];
	}));
	const resolvedObjectEntries = await Promise.all(objectEntries.map(async (entry) => {
		const [entryMap] = await resolveObjectEntry(entry, cwd);
		return entryMap;
	}));
	return [Object.assign({}, arrayEntryMap, ...resolvedObjectEntries), computedRoot];
}
function writeJsonFile(filePath, content) {
	let originalText;
	let originalJson;
	let originalIndent = 2;
	let originalEOL = "\n";
	let originalHasTrailingNewline = false;
	try {
		originalText = readFileSync(filePath, "utf8");
		originalJson = JSON.parse(originalText);
		originalIndent = detectIndentation(originalText);
		if (originalText.includes("\r\n")) originalEOL = "\r\n";
		if (originalText.endsWith("\n")) originalHasTrailingNewline = true;
	} catch {}
	if (originalJson && (isDeepStrictEqual(originalJson, content) || JSON.stringify(originalJson) === JSON.stringify(content))) return;
	let jsonString = JSON.stringify(content, null, originalIndent);
	if (originalEOL !== "\n") jsonString = jsonString.replaceAll("\n", originalEOL);
	if (originalHasTrailingNewline) jsonString += originalEOL;
	if (originalText === jsonString) return;
	writeFileSync(filePath, jsonString, "utf8");
}
function detectIndentation(jsonText) {
	const lines = jsonText.split(/\r?\n/);
	for (const line of lines) {
		const match = line.match(/^(\s+)\S/);
		if (!match) continue;
		if (match[1].includes("	")) return "	";
		return match[1].length;
	}
	return 2;
}
async function writeExports(options, chunks, inlinedDeps) {
	const { pkg } = options;
	const { publishExports, publishBin, bin, ...generated } = await generateExports(pkg, chunks, options, inlinedDeps);
	const updatedPkg = {
		...pkg,
		...generated,
		...bin === void 0 ? {} : { bin },
		packageJsonPath: void 0
	};
	if (publishExports || publishBin) {
		updatedPkg.publishConfig ||= {};
		if (publishExports) updatedPkg.publishConfig.exports = publishExports;
		if (publishBin) updatedPkg.publishConfig.bin = publishBin;
	}
	writeJsonFile(pkg.packageJsonPath, updatedPkg);
}
function shouldExclude(fileName, exclude) {
	if (!exclude?.length) return false;
	return matchPattern(fileName, exclude);
}
async function generateExports(pkg, chunks, options, inlinedDeps) {
	let { exports: { devExports, all, packageJson = true, exclude, customExports, legacy, extensions, inlinedDependencies: emitInlinedDeps = true, bin }, css, logger, cwd } = options;
	const pkgRoot = path.dirname(pkg.packageJsonPath);
	let main, module, cjsTypes, esmTypes;
	const exportsMap = /* @__PURE__ */ new Map();
	const formats = Object.keys(chunks);
	if (!formats.includes("cjs") && !formats.includes("es")) logger.warn(`No CJS or ESM formats found in chunks for package ${pkg.name}`);
	const isPureESM = formats.length === 1 && formats[0] === "es";
	legacy ??= !isPureESM;
	for (const [format, chunksByFormat] of Object.entries(chunks)) {
		if (format !== "es" && format !== "cjs") continue;
		const filteredChunks = chunksByFormat.filter((chunk) => {
			if (chunk.type !== "chunk") return false;
			if (!chunk.isEntry) {
				if (!all) return false;
				if (chunk.facadeModuleId?.[0] === "\0" || chunk.facadeModuleId && RE_NODE_MODULES$1.test(chunk.facadeModuleId)) return false;
			}
			const [name] = getExportName(chunk);
			return !shouldExclude(name, exclude);
		});
		const onlyOneEntry = filteredChunks.filter((chunk) => !RE_DTS.test(chunk.fileName)).length === 1;
		for (const chunk of filteredChunks) {
			let [name, normalizedName, isDts] = getExportName(chunk);
			const isIndex = onlyOneEntry || name === "index";
			const distFile = join$1(pkgRoot, chunk.outDir, normalizedName);
			if (isIndex) {
				name = ".";
				if (format === "cjs") if (isDts) cjsTypes = distFile;
				else main = distFile;
				else if (format === "es") if (isDts) esmTypes = distFile;
				else module = distFile;
			} else if (name.endsWith("/index")) name = `./${name.slice(0, -6)}`;
			else name = `./${name}`;
			if (extensions && name !== ".") name = `${name}.js`;
			let subExport = exportsMap.get(name);
			if (!subExport) {
				subExport = {};
				exportsMap.set(name, subExport);
			}
			if (!isDts) {
				subExport[format] = distFile;
				if (chunk.facadeModuleId && !subExport.src) subExport.src = `./${slash(path.relative(pkgRoot, chunk.facadeModuleId))}`;
			}
		}
	}
	const sortedExportsMap = [...exportsMap].toSorted(([a], [b]) => {
		if (a === "index") return -1;
		return a.localeCompare(b);
	});
	let exports = Object.fromEntries(sortedExportsMap.map(([name, subExport]) => [name, genSubExport(devExports, subExport)]));
	exportMeta(exports, all, packageJson);
	exportCss(exports, chunks, css, pkgRoot);
	if (typeof customExports === "object") exports = {
		...exports,
		...customExports
	};
	else if (typeof customExports === "function") exports = await customExports(exports, {
		pkg,
		chunks,
		isPublish: false
	});
	let publishExports;
	if (devExports) {
		publishExports = Object.fromEntries(sortedExportsMap.map(([name, subExport]) => [name, genSubExport(false, subExport)]));
		exportMeta(publishExports, all, packageJson);
		exportCss(publishExports, chunks, css, pkgRoot);
		if (typeof customExports === "object") publishExports = {
			...publishExports,
			...customExports
		};
		else if (typeof customExports === "function") publishExports = await customExports(publishExports, {
			pkg,
			chunks,
			isPublish: true
		});
	}
	const binResult = generateBin(bin, !!devExports, pkg, chunks, pkgRoot, logger, cwd);
	const publishBin = devExports && binResult ? generateBin(bin, false, pkg, chunks, pkgRoot, logger, cwd) : void 0;
	return {
		main: legacy ? main || module || pkg.main : void 0,
		module: legacy ? module || pkg.module : void 0,
		types: legacy ? cjsTypes || esmTypes || pkg.types : pkg.types,
		exports,
		bin: binResult,
		publishBin,
		inlinedDependencies: emitInlinedDeps ? inlinedDeps : void 0,
		publishExports
	};
}
function genSubExport(devExports, { src, es, cjs }) {
	if (devExports === true) return src;
	let value;
	const dualFormat = es && cjs;
	if (!dualFormat && !devExports) value = cjs || es;
	else {
		value = {};
		if (typeof devExports === "string") value[devExports] = src;
		if (es) value[dualFormat ? "import" : "default"] = es;
		if (cjs) value[dualFormat ? "require" : "default"] = cjs;
	}
	return value;
}
function exportMeta(exports, all, packageJson) {
	if (all) exports["./*"] = "./*";
	else if (packageJson) exports["./package.json"] = "./package.json";
}
function exportCss(exports, chunks, css, pkgRoot) {
	if (css?.splitting) return;
	for (const chunksByFormat of Object.values(chunks)) for (const chunk of chunksByFormat) if (chunk.type === "asset" && RE_CSS.test(chunk.fileName)) {
		const filename = slash(chunk.fileName);
		exports[`./${filename}`] = join$1(pkgRoot, chunk.outDir, filename);
		return;
	}
}
function hasExportsTypes(value) {
	if (value == null || typeof value !== "object") return false;
	if (Array.isArray(value)) return value.some(hasExportsTypes);
	if ("types" in value) return true;
	return Object.values(value).some(hasExportsTypes);
}
const RE_SHEBANG$1 = /^#!.*/;
function generateBin(bin, devExports, pkg, chunks, pkgRoot, logger, cwd) {
	if (bin === false) return;
	if (bin === true || bin === void 0 || typeof bin === "string") {
		if (!pkg.name) throw new Error("Package name is required when using string form for `bin`");
		const binName = pkg.name[0] === "@" ? pkg.name.split("/", 2)[1] : pkg.name;
		if (bin === true || bin === void 0) {
			let detected;
			const seen = /* @__PURE__ */ new Set();
			for (const format of ["es", "cjs"]) {
				const formatChunks = chunks[format];
				if (!formatChunks) continue;
				for (const chunk of formatChunks) {
					if (chunk.type !== "chunk" || !chunk.isEntry || !chunk.facadeModuleId) continue;
					if (!RE_SHEBANG$1.test(chunk.code)) continue;
					if (seen.has(chunk.facadeModuleId)) continue;
					seen.add(chunk.facadeModuleId);
					if (detected) {
						if (bin === true) throw new Error("Multiple entry chunks with shebangs found. Use `exports.bin: { command: \"./src/file.ts\" }` to specify which one to use.");
						logger.warn("Multiple entry chunks with shebangs found. Use `exports.bin: true` or `exports.bin: { command: \"./src/file.ts\" }` to configure explicitly.");
						return;
					}
					detected = devExports ? `./${slash(path.relative(pkgRoot, chunk.facadeModuleId))}` : join$1(pkgRoot, chunk.outDir, slash(chunk.fileName));
				}
			}
			if (detected == null) {
				if (bin === true) logger.warn("`exports.bin` is true but no entry chunks with shebangs were found");
				return;
			}
			return { [binName]: detected };
		}
		if (typeof bin === "string") {
			const match = findChunkBySource(bin);
			if (!match) throw new Error(`Could not find output chunk for bin entry "${bin}"`);
			return { [binName]: devExports ? normalizeSource(bin) : match };
		}
	}
	const result = {};
	for (const [cmdName, sourcePath] of Object.entries(bin)) {
		const match = findChunkBySource(sourcePath);
		if (!match) throw new Error(`Could not find output chunk for bin entry "${cmdName}": "${sourcePath}"`);
		result[cmdName] = devExports ? normalizeSource(sourcePath) : match;
	}
	return result;
	function normalizeSource(sourcePath) {
		const resolved = path.resolve(cwd, sourcePath);
		return `./${slash(path.relative(pkgRoot, resolved))}`;
	}
	function findChunkBySource(sourcePath) {
		const resolved = path.resolve(cwd, sourcePath);
		for (const format of ["es", "cjs"]) {
			const formatChunks = chunks[format];
			if (!formatChunks) continue;
			for (const chunk of formatChunks) {
				if (chunk.type !== "chunk" || !chunk.isEntry) continue;
				if (chunk.facadeModuleId !== resolved) continue;
				if (!RE_SHEBANG$1.test(chunk.code)) logger.warn(`Bin entry "${sourcePath}" does not contain a shebang line`);
				return join$1(pkgRoot, chunk.outDir, slash(chunk.fileName));
			}
		}
	}
}
function getExportName(chunk) {
	const normalizedName = slash(chunk.fileName);
	let name = stripExtname(normalizedName);
	const isDts = name.endsWith(".d");
	if (isDts) name = name.slice(0, -2);
	return [
		name,
		normalizedName,
		isDts
	];
}
function join$1(pkgRoot, outDir, fileName) {
	const outDirRelative = slash(path.relative(pkgRoot, outDir));
	return `${outDirRelative ? `./${outDirRelative}` : "."}/${fileName}`;
}
async function flattenPlugins(plugins) {
	const awaited = await plugins;
	if (!awaited) return [];
	if (Array.isArray(awaited)) return (await Promise.all(awaited.map(flattenPlugins))).flat();
	return [awaited];
}
function findTsconfig(cwd, name = "tsconfig.json") {
	return up$1(name, { cwd }) || false;
}
async function resolveTsconfig(logger, tsconfig, cwd, color, nameLabel) {
	const original = tsconfig;
	if (tsconfig !== false) {
		if (tsconfig === true || tsconfig == null) {
			tsconfig = findTsconfig(cwd);
			if (original && !tsconfig) logger.warn(`No tsconfig found in ${blue(cwd)}`);
		} else {
			const tsconfigPath = path.resolve(cwd, tsconfig);
			const stat = await fsStat(tsconfigPath);
			if (stat?.isFile()) tsconfig = tsconfigPath;
			else if (stat?.isDirectory()) {
				tsconfig = findTsconfig(tsconfigPath);
				if (!tsconfig) logger.warn(`No tsconfig found in ${blue(tsconfigPath)}`);
			} else {
				tsconfig = findTsconfig(cwd, tsconfig);
				if (!tsconfig) logger.warn(`tsconfig ${blue(original)} doesn't exist`);
			}
		}
		if (tsconfig) logger.info(nameLabel, `tsconfig: ${color(path.relative(cwd, tsconfig))}`);
	}
	return tsconfig;
}
function isInCI() {
	const ci = process$1.env.CI;
	return ci != null && ci !== "0" && ci.toLowerCase() !== "false";
}
const debug$2$2 = createDebug("tsdown:package");
async function readPackageJson(dir) {
	const packageJsonPath = up({ cwd: dir });
	if (!packageJsonPath) return;
	debug$2$2("Reading package.json:", packageJsonPath);
	const contents = await readFile(packageJsonPath, "utf8");
	return {
		...JSON.parse(contents),
		packageJsonPath
	};
}
function getPackageType(pkg) {
	if (!pkg?.type) return;
	if (!["module", "commonjs"].includes(pkg.type)) throw new Error(`Invalid package.json type: ${pkg.type}`);
	return pkg.type;
}
function normalizeFormat(format) {
	switch (format) {
		case "es":
		case "esm":
		case "module": return "es";
		case "cjs":
		case "commonjs": return "cjs";
		default: return format;
	}
}
const debug$1$7 = createDebug("tsdown:config:file");
async function loadViteConfig(prefix, cwd, configLoader) {
	const loader = resolveConfigLoader(configLoader);
	debug$1$7("Loading Vite config via loader: ", loader);
	const parser = createParser(loader);
	const [result] = await createConfigCoreLoader({
		sources: [{
			files: [`${prefix}.config`],
			extensions: [
				"js",
				"mjs",
				"ts",
				"cjs",
				"mts",
				"cts"
			],
			parser
		}],
		cwd
	}).load(true);
	if (!result) return;
	let { config: [exported, deps], source } = result;
	globalLogger.info(`Using Vite config: ${underline(source)}`);
	exported = await exported;
	if (typeof exported === "function") exported = await exported({
		command: "build",
		mode: "production"
	});
	return {
		config: exported,
		deps
	};
}
const configPrefix = "tsdown.config";
async function loadConfigFile(inlineConfig, workspace, rootConfig) {
	let cwd = inlineConfig.cwd || process$1.cwd();
	let { config: filePath } = inlineConfig;
	if (filePath === false) return { configs: [{}] };
	let overrideConfig = false;
	if (typeof filePath === "string") {
		const stats = await fsStat(filePath);
		if (stats) {
			const resolved = path.resolve(filePath);
			if (stats.isFile()) {
				overrideConfig = true;
				filePath = resolved;
				cwd = path.dirname(filePath);
			} else if (stats.isDirectory()) cwd = resolved;
		}
	}
	const loader = resolveConfigLoader(inlineConfig.configLoader);
	debug$1$7("Using config loader:", loader);
	const parser = createParser(loader);
	const [result] = await createConfigCoreLoader({
		sources: overrideConfig ? [{
			files: [filePath],
			extensions: [],
			parser
		}] : [{
			files: [configPrefix],
			extensions: [
				"ts",
				"mts",
				"cts",
				"js",
				"mjs",
				"cjs",
				"json"
			],
			parser
		}, {
			files: ["package.json"],
			parser
		}],
		cwd,
		stopAt: workspace && path.dirname(workspace)
	}).load(true);
	let exported = [];
	let file;
	let deps;
	if (result) {
		({config: [exported, deps], source: file} = result);
		globalLogger.info(`config file: ${underline(file)}`, loader === "native" ? "" : `(${loader})`);
		exported = await exported;
		if (typeof exported === "function") exported = await exported(inlineConfig, {
			ci: isInCI(),
			rootConfig
		});
	}
	exported = toArray(exported);
	if (exported.length === 0) exported.push({});
	if (exported.some((config) => typeof config === "function")) throw new Error("Function should not be nested within multiple tsdown configurations. It must be at the top level.\nExample: export default defineConfig(() => [...])");
	return {
		configs: exported.map((config) => ({
			...config,
			cwd: config.cwd ? path.resolve(cwd, config.cwd) : cwd
		})),
		deps
	};
}
const isBun = !!process$1.versions.bun;
const nativeTS = process$1.features.typescript || process$1.versions.deno;
const autoLoader = isBun || nativeTS && isSupported ? "native" : "unrun";
function resolveConfigLoader(configLoader = "auto") {
	return configLoader === "auto" ? autoLoader : configLoader;
}
function createParser(loader) {
	return async (filepath) => {
		const basename = path.basename(filepath);
		const isPkgJson = basename === "package.json";
		if (basename === configPrefix || isPkgJson || basename.endsWith(".json")) {
			const contents = await readFile(filepath, "utf8");
			const parsed = JSON.parse(contents);
			return [isPkgJson ? parsed?.tsdown : parsed, /* @__PURE__ */ new Set([filepath])];
		}
		switch (loader) {
			case "native": return nativeImport(filepath);
			case "tsx": return tsxImport(filepath);
			case "unrun": return unrunImport(filepath);
			default: throw new Error(`Unknown config loader: ${loader}`);
		}
	};
}
async function nativeImport(id) {
	const deps = /* @__PURE__ */ new Set([id]);
	const url = pathToFileURL(id);
	const importAttributes = Object.create(null);
	if (isSupported) {
		importAttributes.cache = "no";
		init({ skipNodeModules: true });
	} else if (!isBun) url.searchParams.set("no-cache", crypto.randomUUID());
	const mod = await depsStore.run(deps, () => import(url.href, { with: importAttributes }).catch((error) => {
		if (error?.message?.includes?.("Cannot find module")) throw new Error(`Failed to load the config file. Try setting the --config-loader CLI flag to \`tsx\` or \`unrun\`.\n\n${error.message}`, { cause: error });
		if (String(error).includes("not supported in strip-only mode")) throw new Error(`Failed to load the config file because it contains TypeScript-specific syntax that Node.js cannot execute directly. Please set the --config-loader CLI flag to \`tsx\` or \`unrun\`.\n\n${error.message}`, { cause: error });
		if (typeof error?.stack === "string" && error.stack.includes("node:internal/modules/esm/translators")) throw new Error(`Failed to load the config file due to a known Node.js bug. Try setting the --config-loader CLI flag to \`tsx\` or \`unrun\`, or upgrading Node.js to v24.11.1 or later.\n\n${error.message}`, { cause: error });
		throw error;
	}));
	return [mod?.default || mod, deps];
}
async function tsxImport(id) {
	const { tsImport } = await importWithError("tsx/esm/api");
	const module = await tsImport(pathToFileURL(id).href, import.meta.url);
	return [module?.default || module, /* @__PURE__ */ new Set([id])];
}
async function unrunImport(id) {
	const { unrun } = await importWithError("unrun");
	const { module, dependencies } = await unrun({ path: pathToFileURL(id).href });
	return [module, new Set(dependencies)];
}
const debug$8 = createDebug("tsdown:config:options");
/**
* Resolve user config into resolved configs
*
* **Internal API, not for public use**
* @private
*/
async function resolveUserConfig(userConfig, inlineConfig, configDeps, runBuild = createConcurrencyExecutor()) {
	{
		const flat = await flattenPlugins(userConfig.plugins);
		for (const plugin of flat) {
			const result = await plugin.tsdownConfig?.(userConfig, inlineConfig);
			if (result) userConfig = mergeConfig(userConfig, result);
		}
	}
	let { entry, format, plugins = [], clean = true, logLevel = "info", failOnWarn = false, suppressWarnings, customLogger, treeshake = true, platform = "node", outDir = "dist", sourcemap = false, dts, unused = false, watch = false, ignoreWatch, shims = false, publint = false, attw = false, fromVite, alias, tsconfig, report = true, target, env = {}, envFile, envPrefix = "TSDOWN_", copy, publicDir, hash = true, cwd = process$1.cwd(), name, workspace, exports = false, bundle, unbundle = typeof bundle === "boolean" ? !bundle : false, root, removeNodeProtocol, nodeProtocol, cjsDefault = true, globImport = true, css, injectStyle, outExtension, outExtensions, fixedExtension = platform === "node", devtools = false, write = true, exe = false } = userConfig;
	const pkg = await readPackageJson(cwd);
	if (workspace) name ||= pkg?.name;
	const color = generateColor(name);
	const nameLabel = getNameLabel(color, name);
	if (!filterConfig(inlineConfig.filter, cwd, name)) {
		debug$8("[filter] skipping config %s", cwd);
		return [];
	}
	const logger = createLogger(logLevel, {
		customLogger,
		failOnWarn: resolveFeatureOption(failOnWarn, true),
		suppressWarnings
	});
	if (typeof bundle === "boolean") logger.warn("`bundle` option is deprecated. Use `unbundle` instead.");
	if (removeNodeProtocol) {
		if (nodeProtocol) throw new TypeError("`removeNodeProtocol` is deprecated. Please only use `nodeProtocol` instead.");
		logger.warn("`removeNodeProtocol` is deprecated. Use `nodeProtocol: \"strip\"` instead.");
	}
	nodeProtocol = nodeProtocol ?? (removeNodeProtocol ? "strip" : false);
	outDir = path.resolve(cwd, outDir);
	clean = resolveClean(clean, outDir, cwd);
	const rawEntry = entry;
	const [resolvedEntry, resolvedRoot] = await resolveEntry(logger, entry, cwd, color, nameLabel, root ? path.resolve(cwd, root) : void 0);
	target = resolveTarget(logger, target, color, pkg, nameLabel);
	tsconfig = await resolveTsconfig(logger, tsconfig, cwd, color, nameLabel);
	publint = resolveFeatureOption(publint, {});
	attw = resolveFeatureOption(attw, {});
	exports = resolveFeatureOption(exports, {});
	unused = resolveFeatureOption(unused, {});
	report = resolveFeatureOption(report, {});
	exe = resolveFeatureOption(exe, {});
	if (dts == null) if (exe) dts = false;
	else if (pkg?.types || pkg?.typings || hasExportsTypes(pkg?.exports)) dts = true;
	else if (tsconfig) {
		const { config } = ee(tsconfig);
		dts = !!config.compilerOptions?.declaration;
	} else dts = false;
	dts = resolveFeatureOption(dts, {});
	if (!pkg) {
		if (exports) throw new Error("`package.json` not found, cannot write exports");
		if (publint) logger.warn(nameLabel, "publint is enabled but package.json is not found");
		if (attw) logger.warn(nameLabel, "attw is enabled but package.json is not found");
	}
	if (injectStyle != null) if (css?.inject == null) {
		logger.warn(`${blue`injectStyle`} is deprecated. Use ${blue`css.inject`} instead.`);
		css = {
			...css,
			inject: injectStyle
		};
	} else throw new TypeError("`injectStyle` is deprecated. Cannot be used with `css.inject`");
	if (publicDir) if (copy) throw new TypeError("`publicDir` is deprecated. Cannot be used with `copy`");
	else logger.warn(`${blue`publicDir`} is deprecated. Use ${blue`copy`} instead.`);
	if (outExtension) {
		if (outExtensions) throw new TypeError("`outExtension` is deprecated. Cannot be used with `outExtensions`");
		logger.warn(`${blue`outExtension`} is deprecated. Use ${blue`outExtensions`} instead.`);
		outExtensions = outExtension;
	}
	envPrefix = toArray(envPrefix);
	if (envPrefix.includes("")) logger.warn("`envPrefix` includes an empty string; filtering is disabled. All environment variables from the env file and process.env will be injected into the build. Ensure this is intended to avoid accidental leakage of sensitive information.");
	const envFromProcess = filterEnv(process$1.env, envPrefix);
	if (envFile) {
		const resolvedPath = path.resolve(cwd, envFile);
		logger.info(nameLabel, `env file: ${color(resolvedPath)}`);
		env = {
			...filterEnv(parseEnv(await readFile(resolvedPath, "utf8")), envPrefix),
			...envFromProcess,
			...env
		};
	} else env = {
		...envFromProcess,
		...env
	};
	debug$8(`Environment variables: %O`, env);
	configDeps = new Set(configDeps);
	if (fromVite) {
		const viteUserConfig = await loadViteConfig(fromVite === true ? "vite" : fromVite, cwd, inlineConfig.configLoader);
		if (viteUserConfig) {
			const { config, deps } = viteUserConfig;
			deps?.forEach((dep) => configDeps.add(dep));
			const viteAlias = config.resolve?.alias;
			if (Array.isArray(viteAlias)) throw new TypeError("Unsupported resolve.alias in Vite config. Use object instead of array");
			if (viteAlias) alias = {
				...alias,
				...viteAlias
			};
			if (config.plugins) plugins = [config.plugins, plugins];
		}
	}
	ignoreWatch = toArray(ignoreWatch).map((ignore) => {
		ignore = resolveRegex(ignore);
		if (typeof ignore === "string") return path.resolve(cwd, ignore);
		return ignore;
	});
	const depsConfig = resolveDepsConfig(userConfig, logger);
	devtools = resolveFeatureOption(devtools, {});
	if (devtools) if (watch) {
		if (devtools.ui) logger.warn("Devtools UI is not supported in watch mode, disabling it.");
		devtools.ui = false;
	} else devtools.ui ??= !!pkgExists("@vitejs/devtools/cli");
	const config = {
		...userConfig,
		alias,
		attw,
		cjsDefault,
		clean,
		configDeps,
		copy: publicDir || copy,
		css,
		cwd,
		deps: depsConfig,
		devtools,
		dts,
		entry: resolvedEntry,
		env,
		exe,
		exports,
		fixedExtension,
		globImport,
		hash,
		ignoreWatch,
		logger,
		name,
		nameLabel,
		nodeProtocol,
		outDir,
		outExtensions,
		pkg,
		platform,
		plugins,
		publint,
		rawEntry,
		report,
		root: resolvedRoot,
		runBuild,
		shims,
		sourcemap,
		target,
		treeshake,
		tsconfig,
		unbundle,
		unused,
		watch,
		write
	};
	if (exe) validateSea(config);
	const objectFormat = typeof format === "object" && !Array.isArray(format);
	const resolvedConfigs = (objectFormat ? Object.keys(format) : resolveComma(toArray(format, "esm"))).map((fmt, idx) => {
		const once = idx === 0;
		const overrides = objectFormat ? format[fmt] : void 0;
		return {
			...config,
			copy: once ? config.copy : void 0,
			onSuccess: once ? config.onSuccess : void 0,
			format: normalizeFormat(fmt),
			...overrides,
			runBuild
		};
	});
	for (const resolved of resolvedConfigs) {
		const finalPlugins = await flattenPlugins(resolved.plugins);
		for (const plugin of finalPlugins) await plugin.tsdownConfigResolved?.(resolved);
	}
	return resolvedConfigs;
}
/** filter env variables by prefixes */
function filterEnv(envDict, envPrefixes) {
	const env = {};
	for (const [key, value] of Object.entries(envDict)) if (value != null && envPrefixes.some((prefix) => key.startsWith(prefix))) env[key] = value;
	return env;
}
const defu = createDefu((obj, key, value, namespace) => {
	if (key === "plugins" && (namespace === "" || namespace === "inputOptions" || namespace === "outputOptions")) {
		obj[key] = [].concat(obj[key], value);
		return true;
	}
	if (Array.isArray(obj[key]) && Array.isArray(value)) {
		obj[key] = value;
		return true;
	}
});
function mergeConfig(defaults, ...overrides) {
	return defu(...overrides.toReversed(), defaults);
}
async function mergeUserOptions(defaults, user, args) {
	if (!user) return defaults;
	if (typeof user === "function") return await user(defaults, ...args) ?? defaults;
	return defu(user, defaults);
}
function resolveFeatureOption(value, defaults) {
	if (typeof value === "object" && value !== null) return resolveCIOption(value.enabled ?? true) ? value : false;
	return resolveCIOption(value) ? defaults : false;
}
function resolveCIOption(value) {
	if (value === "ci-only") return isInCI();
	if (value === "local-only") return !isInCI();
	return value;
}
function filterConfig(filter, configCwd, name) {
	if (!filter) return true;
	let cwd = path.relative(process$1.cwd(), configCwd);
	if (cwd === "") cwd = ".";
	if (filter instanceof RegExp) return name && filter.test(name) || filter.test(cwd);
	return toArray(filter).some((value) => name && name === value || cwd === value);
}
//#endregion
//#region ../../node_modules/.pnpm/tsdown@0.22.14_@arethetypeswrong+core@0.18.2_@tsdown+css@0.22.14_@tsdown+exe@0.22.14_@t_4084c24f9f44f250d2b604ebc16f10f3/node_modules/tsdown/dist/watch-DOMHXvCH.mjs
async function copy(options) {
	if (!options.copy) return;
	const resolved = await resolveCopyEntries(options);
	await Promise.all(resolved.map(({ from, to, verbose }) => {
		if (verbose) options.logger.info(options.nameLabel, `Copying files from ${path.relative(options.cwd, from)} to ${path.relative(options.cwd, to)}`);
		return fsCopy(from, to);
	}));
}
async function resolveCopyEntries(options) {
	const copy = toArray(typeof options.copy === "function" ? await options.copy(options) : options.copy);
	if (!copy.length) return [];
	const resolved = (await Promise.all(copy.map(async (entry) => {
		if (typeof entry === "string") entry = { from: [entry] };
		let from = toArray(entry.from);
		if (from.some((f) => isDynamicPattern(f))) from = await glob(from, {
			cwd: options.cwd,
			onlyFiles: true,
			expandDirectories: false
		});
		return from.map((file) => resolveCopyEntry({
			...entry,
			from: file
		}, options.cwd, options.outDir));
	}))).flat();
	if (!resolved.length) options.logger.warn(options.nameLabel, `No files matched for copying.`);
	return resolved;
}
function resolveCopyEntry(entry, cwd, outDir) {
	const { flatten = true, rename } = entry;
	const from = path.resolve(cwd, entry.from);
	const to = entry.to ? path.resolve(cwd, entry.to) : outDir;
	const { base, dir } = path.parse(path.relative(cwd, from));
	const destFolder = flatten || !flatten && !dir ? to : dir.replace(dir.split(path.sep)[0], to);
	const dest = path.join(destFolder, rename ? renameTarget(base, rename, from) : base);
	return {
		...entry,
		from,
		to: dest
	};
}
function renameTarget(target, rename, src) {
	const parsedPath = path.parse(target);
	return typeof rename === "string" ? rename : rename(parsedPath.name, parsedPath.ext.replace(".", ""), src);
}
/**
* The `node:` protocol was added in Node.js v14.18.0.
* @see https://nodejs.org/api/esm.html#node-imports
*/
function NodeProtocolPlugin(nodeProtocolOption) {
	const modulesWithoutProtocol = builtinModules.filter((mod) => !mod.startsWith("node:"));
	return {
		name: `tsdown:node-protocol`,
		resolveId: {
			order: "pre",
			filter: { id: nodeProtocolOption === "strip" ? new RegExp(`^node:(${modulesWithoutProtocol.join("|")})$`) : new RegExp(`^(${modulesWithoutProtocol.join("|")})$`) },
			handler: nodeProtocolOption === "strip" ? async function(id, ...args) {
				const strippedId = id.slice(5);
				const resolved = await this.resolve(strippedId, ...args);
				if (resolved && !resolved.external) return resolved;
				return {
					id: strippedId,
					external: true,
					moduleSideEffects: false
				};
			} : (id) => {
				return {
					id: `node:${id}`,
					external: true,
					moduleSideEffects: false
				};
			}
		}
	};
}
const debug$6 = createDebug("tsdown:report");
const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);
const defaultOptions = {
	gzip: true,
	brotli: false,
	maxCompressSize: 1e6
};
function ReportPlugin(config, cjsDts, isDualFormat) {
	return {
		name: "tsdown:report",
		async writeBundle(outputOptions, bundle) {
			const outDir = outputOptions.file ? path.resolve(config.cwd, outputOptions.file, "..") : path.resolve(config.cwd, outputOptions.dir);
			await outputReport(config, Object.values(bundle), outDir, cjsDts, isDualFormat);
		}
	};
}
async function outputReport(config, chunks, outDir, cjsDts, isDualFormat) {
	outDir = path.relative(config.cwd, outDir);
	const options = {
		...defaultOptions,
		...config.report
	};
	const sizes = [];
	for (const chunk of chunks) {
		const size = await calcSize(options, chunk);
		sizes.push(size);
	}
	const filenameLength = Math.max(...sizes.map((size) => size.filename.length));
	const rawTextLength = Math.max(...sizes.map((size) => size.rawText.length));
	const gzipTextLength = Math.max(...sizes.map((size) => size.gzipText == null ? 0 : size.gzipText.length));
	const brotliTextLength = Math.max(...sizes.map((size) => size.brotliText == null ? 0 : size.brotliText.length));
	let totalRaw = 0;
	for (const size of sizes) {
		size.rawText = size.rawText.padStart(rawTextLength);
		size.gzipText = size.gzipText?.padStart(gzipTextLength);
		size.brotliText = size.brotliText?.padStart(brotliTextLength);
		totalRaw += size.raw;
	}
	sizes.sort((a, b) => {
		if (a.dts !== b.dts) return a.dts ? 1 : -1;
		if (a.isEntry !== b.isEntry) return a.isEntry ? -1 : 1;
		return b.raw - a.raw;
	});
	const formatLabel = isDualFormat && prettyFormat(cjsDts ? "cjs" : config.format);
	for (const size of sizes) {
		const filenameColor = size.dts ? green : noop;
		const filename = path.normalize(size.filename);
		config.logger.info(config.nameLabel, formatLabel, dim(outDir + path.sep) + filenameColor((size.isEntry ? bold : noop)(filename)), ` `.repeat(filenameLength - size.filename.length), dim(size.rawText), options.gzip && size.gzipText && dim`│ gzip: ${size.gzipText}`, options.brotli && size.brotliText && dim`│ brotli: ${size.brotliText}`);
	}
	const totalSizeText = formatBytes(totalRaw);
	config.logger.info(config.nameLabel, formatLabel, `${sizes.length} files, total: ${totalSizeText}`);
}
async function calcSize(options, chunk) {
	debug$6(`Calculating size for`, chunk.fileName);
	const content = chunk.type === "chunk" ? chunk.code : chunk.source;
	const raw = Buffer.byteLength(content, "utf8");
	debug$6("[size]", chunk.fileName, raw);
	let gzip = Infinity;
	let brotli = Infinity;
	if (raw > options.maxCompressSize) debug$6(chunk.fileName, "file size exceeds limit, skip gzip/brotli");
	else {
		if (options.gzip) {
			gzip = (await gzipAsync(content)).length;
			debug$6("[gzip]", chunk.fileName, gzip);
		}
		if (options.brotli) {
			brotli = (await brotliCompressAsync(content)).length;
			debug$6("[brotli]", chunk.fileName, brotli);
		}
	}
	return {
		filename: chunk.fileName,
		dts: RE_DTS.test(chunk.fileName),
		isEntry: chunk.type === "chunk" && chunk.isEntry,
		raw,
		rawText: formatBytes(raw),
		gzip,
		gzipText: formatBytes(gzip),
		brotli,
		brotliText: formatBytes(brotli)
	};
}
const RE_SHEBANG = /^#!.*/;
function ShebangPlugin(logger, cwd, nameLabel, isDualFormat) {
	return {
		name: "tsdown:shebang",
		async writeBundle(options, bundle) {
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== "chunk" || !chunk.isEntry) continue;
				if (!RE_SHEBANG.test(chunk.code)) continue;
				const filepath = path.resolve(cwd, options.file || path.join(options.dir, chunk.fileName));
				if (await fsExists(filepath)) {
					logger.info(nameLabel, isDualFormat && prettyFormat(options.format), `Granting execute permission to ${underline(path.relative(cwd, filepath))}`);
					await chmod(filepath, 493);
				}
			}
		}
	};
}
function addOutDirToChunks(chunks, outDir) {
	return chunks.map((chunk) => {
		chunk.outDir = outDir;
		return chunk;
	});
}
const endsWithConfig = /[\\/](?:tsdown\.config.*|package\.json|tsconfig\.json)$/;
function WatchPlugin(configDeps, { config, chunks }) {
	return {
		name: "tsdown:watch",
		options: config.ignoreWatch.length ? (inputOptions) => {
			inputOptions.watch ||= {};
			inputOptions.watch.exclude = toArray(inputOptions.watch.exclude);
			inputOptions.watch.exclude.push(...config.ignoreWatch);
		} : void 0,
		async buildStart() {
			config.tsconfig && this.addWatchFile(config.tsconfig);
			for (const file of configDeps) this.addWatchFile(file);
			if (typeof config.watch !== "boolean") for (const file of resolveComma(toArray(config.watch))) this.addWatchFile(file);
			if (config.pkg) this.addWatchFile(config.pkg.packageJsonPath);
			if (config.copy) {
				const resolvedEntries = await resolveCopyEntries(config);
				for (const entry of resolvedEntries) this.addWatchFile(entry.from);
			}
		},
		generateBundle: {
			order: "post",
			handler(outputOptions, bundle) {
				chunks.push(...addOutDirToChunks(Object.values(bundle), config.outDir));
			}
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/hookable@6.1.1/node_modules/hookable/dist/index.mjs
function flatHooks(configHooks, hooks = {}, parentName) {
	for (const key in configHooks) {
		const subHook = configHooks[key];
		const name = parentName ? `${parentName}:${key}` : key;
		if (typeof subHook === "object" && subHook !== null) flatHooks(subHook, hooks, name);
		else if (typeof subHook === "function") hooks[name] = subHook;
	}
	return hooks;
}
const createTask = /* @__PURE__ */ (() => {
	if (console.createTask) return console.createTask;
	const defaultTask = { run: (fn) => fn() };
	return () => defaultTask;
})();
function callHooks(hooks, args, startIndex, task) {
	for (let i = startIndex; i < hooks.length; i += 1) try {
		const result = task ? task.run(() => hooks[i](...args)) : hooks[i](...args);
		if (result && typeof result.then === "function") return Promise.resolve(result).then(() => callHooks(hooks, args, i + 1, task));
	} catch (error) {
		return Promise.reject(error);
	}
}
function serialTaskCaller(hooks, args, name) {
	if (hooks.length > 0) return callHooks(hooks, args, 0, createTask(name));
}
function parallelTaskCaller(hooks, args, name) {
	if (hooks.length > 0) {
		const task = createTask(name);
		return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
	}
}
function callEachWith(callbacks, arg0) {
	for (const callback of [...callbacks]) callback(arg0);
}
var Hookable = class {
	_hooks;
	_before;
	_after;
	_deprecatedHooks;
	_deprecatedMessages;
	constructor() {
		this._hooks = {};
		this._before = void 0;
		this._after = void 0;
		this._deprecatedMessages = void 0;
		this._deprecatedHooks = {};
		this.hook = this.hook.bind(this);
		this.callHook = this.callHook.bind(this);
		this.callHookWith = this.callHookWith.bind(this);
	}
	hook(name, function_, options = {}) {
		if (!name || typeof function_ !== "function") return () => {};
		const originalName = name;
		let dep;
		while (this._deprecatedHooks[name]) {
			dep = this._deprecatedHooks[name];
			name = dep.to;
		}
		if (dep && !options.allowDeprecated) {
			let message = dep.message;
			if (!message) message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
			if (!this._deprecatedMessages) this._deprecatedMessages = /* @__PURE__ */ new Set();
			if (!this._deprecatedMessages.has(message)) {
				console.warn(message);
				this._deprecatedMessages.add(message);
			}
		}
		if (!function_.name) try {
			Object.defineProperty(function_, "name", {
				get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
				configurable: true
			});
		} catch {}
		this._hooks[name] = this._hooks[name] || [];
		this._hooks[name].push(function_);
		return () => {
			if (function_) {
				this.removeHook(name, function_);
				function_ = void 0;
			}
		};
	}
	hookOnce(name, function_) {
		let _unreg;
		let _function = (...arguments_) => {
			if (typeof _unreg === "function") _unreg();
			_unreg = void 0;
			_function = void 0;
			return function_(...arguments_);
		};
		_unreg = this.hook(name, _function);
		return _unreg;
	}
	removeHook(name, function_) {
		const hooks = this._hooks[name];
		if (hooks) {
			const index = hooks.indexOf(function_);
			if (index !== -1) hooks.splice(index, 1);
			if (hooks.length === 0) this._hooks[name] = void 0;
		}
	}
	clearHook(name) {
		this._hooks[name] = void 0;
	}
	deprecateHook(name, deprecated) {
		this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
		const _hooks = this._hooks[name] || [];
		this._hooks[name] = void 0;
		for (const hook of _hooks) this.hook(name, hook);
	}
	deprecateHooks(deprecatedHooks) {
		for (const name in deprecatedHooks) this.deprecateHook(name, deprecatedHooks[name]);
	}
	addHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		const removeFns = Object.keys(hooks).map((key) => this.hook(key, hooks[key]));
		return () => {
			for (const unreg of removeFns) unreg();
			removeFns.length = 0;
		};
	}
	removeHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		for (const key in hooks) this.removeHook(key, hooks[key]);
	}
	removeAllHooks() {
		this._hooks = {};
	}
	callHook(name, ...args) {
		return this.callHookWith(serialTaskCaller, name, args);
	}
	callHookParallel(name, ...args) {
		return this.callHookWith(parallelTaskCaller, name, args);
	}
	callHookWith(caller, name, args) {
		const event = this._before || this._after ? {
			name,
			args,
			context: {}
		} : void 0;
		if (this._before) callEachWith(this._before, event);
		const result = caller(this._hooks[name] ? [...this._hooks[name]] : [], args, name);
		if (result instanceof Promise) return result.finally(() => {
			if (this._after && event) callEachWith(this._after, event);
		});
		if (this._after && event) callEachWith(this._after, event);
		return result;
	}
	beforeEach(function_) {
		this._before = this._before || [];
		this._before.push(function_);
		return () => {
			if (this._before !== void 0) {
				const index = this._before.indexOf(function_);
				if (index !== -1) this._before.splice(index, 1);
			}
		};
	}
	afterEach(function_) {
		this._after = this._after || [];
		this._after.push(function_);
		return () => {
			if (this._after !== void 0) {
				const index = this._after.indexOf(function_);
				if (index !== -1) this._after.splice(index, 1);
			}
		};
	}
};
//#endregion
//#region ../../node_modules/.pnpm/tsdown@0.22.14_@arethetypeswrong+core@0.18.2_@tsdown+css@0.22.14_@tsdown+exe@0.22.14_@t_4084c24f9f44f250d2b604ebc16f10f3/node_modules/tsdown/dist/build-D_enfyvD.mjs
var build_D_enfyvD_exports = /* @__PURE__ */ __exportAll$1({
	n: () => buildWithConfigs,
	r: () => build_exports,
	t: () => build$1
});
const treeKill = createRequire(import.meta.url)("./npm_entry_tree-kill.cjs");
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
const debug$5 = createDebug("tsdown:config:workspace");
const DEFAULT_EXCLUDE_WORKSPACE = [
	"**/node_modules/**",
	"**/dist/**",
	"**/test?(s)/**",
	"**/t?(e)mp/**"
];
async function resolveWorkspace(config, inlineConfig, rootDeps) {
	const normalized = mergeConfig(config, inlineConfig);
	const rootCwd = normalized.cwd || process$1.cwd();
	const deps = new Set(rootDeps);
	let { workspace } = normalized;
	if (!workspace) return {
		configs: [normalized],
		deps
	};
	if (workspace === true) workspace = {};
	else if (typeof workspace === "string" || Array.isArray(workspace)) workspace = { include: workspace };
	let { include: packages = "auto", exclude = DEFAULT_EXCLUDE_WORKSPACE, config: workspaceConfig } = workspace;
	if (packages === "auto") packages = (await glob("**/package.json", {
		ignore: exclude,
		cwd: rootCwd,
		expandDirectories: false
	})).filter((file) => file !== "package.json").map((file) => slash(path.resolve(rootCwd, file, "..")));
	else packages = (await glob(packages, {
		ignore: exclude,
		cwd: rootCwd,
		onlyDirectories: true,
		absolute: true,
		expandDirectories: false
	})).map((file) => slash(path.resolve(file)));
	if (packages.length === 0) throw new Error("No workspace packages found, please check your config");
	return {
		configs: (await Promise.all(packages.map(async (cwd) => {
			debug$5("loading workspace config %s", cwd);
			const { configs, deps: workspaceDeps } = await loadConfigFile({
				...inlineConfig,
				config: workspaceConfig,
				cwd
			}, cwd, normalized);
			workspaceDeps?.forEach((dep) => deps.add(dep));
			return configs.map((config) => mergeConfig(normalized, config));
		}))).flat(),
		deps
	};
}
const debug$4 = createDebug("tsdown:config");
async function resolveConfig(inlineConfig) {
	debug$4("inline config %O", inlineConfig);
	if (inlineConfig.cwd) inlineConfig.cwd = path.resolve(inlineConfig.cwd);
	const { configs: rootConfigs, deps: rootDeps } = await loadConfigFile(inlineConfig);
	const globalDeps = new Set(rootDeps);
	const runBuild = createConcurrencyExecutor(inlineConfig.concurrency);
	const configs = (await Promise.all(rootConfigs.map(async (rootConfig) => {
		const { configs: workspaceConfigs, deps: workspaceDeps } = await resolveWorkspace(rootConfig, inlineConfig, rootDeps);
		debug$4("workspace configs %O", workspaceConfigs);
		const configs = (await Promise.all(workspaceConfigs.filter((config) => !config.workspace || config.entry).map((config) => resolveUserConfig(config, inlineConfig, workspaceDeps, runBuild)))).flat().filter((config) => !!config);
		workspaceDeps.forEach((dep) => globalDeps.add(dep));
		return configs;
	}))).flat();
	debug$4("resolved configs %O", configs);
	if (configs.length === 0) throw new Error("No valid configuration found.");
	if (inlineConfig.concurrency != null && configs.some((config) => config.watch)) globalLogger.warn("`--concurrency` is not supported in watch mode and will be ignored.");
	return {
		configs,
		deps: globalDeps
	};
}
const RANGE_REQUIRING_ESM = parseRange("^20.19.0 || >=22.12.0");
function warnLegacyCJS(config) {
	if (config.exe || !config.target || !(config.checks?.legacyCjs ?? true) || !config.format.includes("cjs")) return;
	if (config.target.some((t) => {
		const version = coerce(t.split("node", 2)[1]);
		return version && satisfies(version, RANGE_REQUIRING_ESM);
	})) config.logger.warnOnce("We recommend using the ESM format instead of CommonJS.\nThe ESM format is compatible with modern platforms and runtimes, and most new libraries are now distributed only in ESM format.\nLearn more at https://nodejs.org/en/learn/modules/publishing-a-package#how-did-we-get-here");
}
function CjsDtsReexportPlugin() {
	return {
		name: "tsdown:cjs-dts-reexport",
		generateBundle(_options, bundle) {
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== "chunk" || !chunk.isEntry) continue;
				if (!chunk.fileName.endsWith(".cjs") && !chunk.fileName.endsWith(".js")) continue;
				const content = `export type * from './${path.basename(chunk.fileName.replace(RE_JS, ".d.mts"))}'\n`;
				this.emitFile({
					type: "prebuilt-chunk",
					fileName: filename_js_to_dts(chunk.fileName),
					code: content
				});
			}
		}
	};
}
async function startDevtoolsUI(config) {
	const { start } = await importWithError("@vitejs/devtools/cli-commands");
	await start({
		host: "127.0.0.1",
		open: true,
		...typeof config.ui === "object" ? config.ui : {}
	});
}
async function createHooks(options) {
	const hooks = new Hookable();
	if (typeof options.hooks === "object") hooks.addHooks(options.hooks);
	else if (typeof options.hooks === "function") await options.hooks(hooks);
	return {
		hooks,
		context: {
			options,
			hooks
		}
	};
}
function executeOnSuccess(config) {
	if (!config.onSuccess) return;
	const ab = new AbortController();
	if (typeof config.onSuccess === "string") {
		const p = exec(config.onSuccess, [], { nodeOptions: {
			shell: true,
			stdio: "inherit",
			cwd: config.cwd
		} });
		p.then(({ exitCode }) => {
			if (exitCode) process$1.exitCode = exitCode;
		});
		ab.signal.addEventListener("abort", () => {
			if (typeof p.pid === "number") treeKill(p.pid);
		});
	} else config.onSuccess(config, ab.signal);
	return ab;
}
const debug$3 = createDebug("tsdown:attw");
const label$1 = dim`[attw]`;
const problemFlags = {
	NoResolution: "no-resolution",
	UntypedResolution: "untyped-resolution",
	FalseCJS: "false-cjs",
	FalseESM: "false-esm",
	CJSResolvesToESM: "cjs-resolves-to-esm",
	FallbackCondition: "fallback-condition",
	CJSOnlyExportsDefault: "cjs-only-exports-default",
	NamedExports: "named-exports",
	FalseExportDefault: "false-export-default",
	MissingExportEquals: "missing-export-equals",
	UnexpectedModuleSyntax: "unexpected-module-syntax",
	InternalResolutionError: "internal-resolution-error"
};
/**
* ATTW profiles.
* Defines the resolution modes to ignore for each profile.
*
* @see https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/packages/cli/README.md#profiles
*/
const profiles = {
	strict: [],
	node16: ["node10"],
	"esm-only": ["node10", "node16-cjs"]
};
async function attw(options, tarball) {
	if (!options.attw) return;
	if (!options.pkg) {
		options.logger.warn("attw is enabled but package.json is not found");
		return;
	}
	const { profile = "strict", level = "warn", ignoreRules = [], ...attwOptions } = options.attw;
	const invalidRules = ignoreRules.filter((rule) => !Object.values(problemFlags).includes(rule));
	if (invalidRules.length) options.logger.warn(`attw config option 'ignoreRules' contains invalid value '${invalidRules.join(", ")}'.`);
	const t = performance.now();
	debug$3("Running attw check");
	const attwCore = options.attw.module || await importWithError("@arethetypeswrong/core");
	const pkg = attwCore.createPackageFromTarballData(tarball);
	const checkResult = await attwCore.checkPackage(pkg, attwOptions);
	let errorMessage;
	if (checkResult.types) {
		const problems = checkResult.problems.filter((problem) => {
			if (ignoreRules.includes(problemFlags[problem.kind])) return false;
			if ("resolutionKind" in problem) return !profiles[profile]?.includes(problem.resolutionKind);
			return true;
		});
		if (problems.length) errorMessage = `problems found:\n${problems.map((problem) => formatProblem(checkResult.packageName, problem)).join("\n")}`;
	} else errorMessage = `Package has no types`;
	if (errorMessage) options.logger[level](options.nameLabel, label$1, errorMessage);
	else options.logger.success(options.nameLabel, label$1, "No problems found", dim`(${Math.round(performance.now() - t)}ms)`);
}
/**
* Format an ATTW problem for display
*/
function formatProblem(packageName, problem) {
	const resolutionKind = "resolutionKind" in problem ? ` (${problem.resolutionKind})` : "";
	const entrypoint = "entrypoint" in problem ? ` at ${slash(path.join(packageName, problem.entrypoint))}` : "";
	switch (problem.kind) {
		case "NoResolution": return `  ❌ No resolution${resolutionKind}${entrypoint}`;
		case "UntypedResolution": return `  ⚠️  Untyped resolution${resolutionKind}${entrypoint}`;
		case "FalseESM": return `  🔄 False ESM: Types indicate ESM (${problem.typesModuleKind}) but implementation is CJS (${problem.implementationModuleKind})\n     Types: ${problem.typesFileName} | Implementation: ${problem.implementationFileName}`;
		case "FalseCJS": return `  🔄 False CJS: Types indicate CJS (${problem.typesModuleKind}) but implementation is ESM (${problem.implementationModuleKind})\n     Types: ${problem.typesFileName} | Implementation: ${problem.implementationFileName}`;
		case "CJSResolvesToESM": return `  ⚡ CJS resolves to ESM${resolutionKind}${entrypoint}`;
		case "NamedExports": {
			const missingExports = problem.missing?.length > 0 ? ` Missing: ${problem.missing.join(", ")}` : "";
			return `  📤 Named exports problem${problem.isMissingAllNamed ? " (all named exports missing)" : ""}${missingExports}\n     Types: ${problem.typesFileName} | Implementation: ${problem.implementationFileName}`;
		}
		case "FallbackCondition": return `  🎯 Fallback condition used${resolutionKind}${entrypoint}`;
		case "FalseExportDefault": return `  🎭 False export default\n     Types: ${problem.typesFileName} | Implementation: ${problem.implementationFileName}`;
		case "MissingExportEquals": return `  📝 Missing export equals\n     Types: ${problem.typesFileName} | Implementation: ${problem.implementationFileName}`;
		case "InternalResolutionError": return `  💥 Internal resolution error in ${problem.fileName} (${problem.resolutionOption})\n     Module: ${problem.moduleSpecifier} | Mode: ${problem.resolutionMode}`;
		case "UnexpectedModuleSyntax": return `  📋 Unexpected module syntax in ${problem.fileName}\n     Expected: ${problem.moduleKind} | Found: ${problem.syntax === 99 ? "ESM" : "CJS"}`;
		case "CJSOnlyExportsDefault": return `  🏷️  CJS only exports default in ${problem.fileName}`;
		default: return `  ❓ Unknown problem: ${JSON.stringify(problem)}`;
	}
}
const debug$2 = createDebug("tsdown:publint");
const label = dim`[publint]`;
async function publint(options, tarball) {
	if (!options.publint) return;
	if (!options.pkg) {
		options.logger.warn(options.nameLabel, "publint is enabled but package.json is not found");
		return;
	}
	const t = performance.now();
	debug$2("Running publint");
	const { publint } = options.publint.module?.[0] || await importWithError("publint");
	const { formatMessage } = options.publint.module?.[1] || await importWithError("publint/utils");
	const { messages, pkg } = await publint({
		...options.publint,
		pack: { tarball: tarball.buffer }
	});
	debug$2("Found %d issues", messages.length);
	if (!messages.length) {
		options.logger.success(options.nameLabel, label, "No issues found", dim`(${Math.round(performance.now() - t)}ms)`);
		return;
	}
	for (const message of messages) {
		const formattedMessage = formatMessage(message, pkg);
		const logType = {
			error: "error",
			warning: "warn",
			suggestion: "info"
		}[message.type];
		options.logger[logType](options.nameLabel, label, formattedMessage);
	}
}
const debug$1 = createDebug("tsdown:pkg");
function initBundleByPkg(configs) {
	const map = {};
	for (const config of configs) {
		const pkgJson = config.pkg?.packageJsonPath;
		if (!pkgJson) continue;
		if (!map[pkgJson]) {
			const { promise, resolve } = Promise.withResolvers();
			map[pkgJson] = {
				promise,
				resolve,
				count: 0,
				formats: /* @__PURE__ */ new Set(),
				bundles: []
			};
		}
		map[pkgJson].count++;
		map[pkgJson].formats.add(config.format);
	}
	return map;
}
async function bundleDone(bundleByPkg, bundle) {
	const pkg = bundle.config.pkg;
	if (!pkg) return;
	const ctx = bundleByPkg[pkg.packageJsonPath];
	ctx.bundles.push(bundle);
	if (ctx.bundles.length < ctx.count) return ctx.promise;
	const configs = ctx.bundles.map(({ config }) => config);
	const exportsConfigs = dedupeConfigs(configs, "exports");
	if (exportsConfigs.length) {
		if (exportsConfigs.length > 1) throw new Error(`Conflicting exports options for package at ${pkg.packageJsonPath}. Please merge them:\n${exportsConfigs.map((config) => `- ${formatWithOptions({ colors: true }, config.exports)}`).join("\n")}`);
		const chunks = {};
		const inlinedDeps = mergeInlinedDeps(ctx.bundles);
		for (const bundle of ctx.bundles) {
			if (!bundle.config.exports) continue;
			chunks[bundle.config.format] ||= [];
			chunks[bundle.config.format].push(...bundle.chunks);
		}
		await writeExports(exportsConfigs[0], chunks, inlinedDeps);
	}
	const publintConfigs = dedupeConfigs(configs, "publint");
	const attwConfigs = dedupeConfigs(configs, "attw");
	const duplicate = publintConfigs[1] || attwConfigs[1];
	if (duplicate) duplicate.logger.warn(`Multiple publint or attw configurations found for package at ${pkg.packageJsonPath}. Consider merging them for better consistency and performance.`);
	try {
		if (publintConfigs.length || attwConfigs.length) {
			const tarball = await packTarball(pkg.packageJsonPath);
			await Promise.all([...publintConfigs.map((config) => publint(config, tarball)), ...attwConfigs.map((config) => attw(config, tarball))]);
		}
	} catch (error) {
		configs[0].logger.error("Pack failed:", error);
		debug$1("Pack failed for %s: %O", pkg.packageJsonPath, error);
	}
	ctx.resolve();
}
async function packTarball(packageJsonPath) {
	const pkgDir = path.dirname(packageJsonPath);
	const destination = await mkdtemp(path.join(tmpdir(), "tsdown-pack-"));
	const { detect } = await import("./detect-DGhJGEqb-LL52mV6u.js");
	try {
		const detected = await detect({ cwd: pkgDir });
		debug$1("Detected package manager: %o", detected);
		if (detected?.name === "deno") throw new Error(`Cannot pack tarball for Deno projects at ${pkgDir}`);
		const tarballPath = await pack(pkgDir, detected, destination, true);
		debug$1("Packed tarball at %s", tarballPath);
		return await readFile(tarballPath);
	} finally {
		if (debug$1.enabled) debug$1("Preserving pack directory for debugging: %s", destination);
		else await fsRemove(destination);
	}
}
function dedupeConfigs(configs, key) {
	const filtered = configs.filter((config) => config[key]);
	if (!filtered.length) return [];
	const seen = /* @__PURE__ */ new Set();
	const results = filtered.filter((config) => {
		if (!Object.keys(config[key]).length) return false;
		if (seen.has(config[key])) return false;
		seen.add(config[key]);
		return true;
	});
	if (results.length === 0) return [filtered[0]];
	return results;
}
function mergeInlinedDeps(bundles) {
	const merged = /* @__PURE__ */ new Map();
	for (const bundle of bundles) for (const [pkgName, versions] of bundle.inlinedDeps) {
		if (!merged.has(pkgName)) merged.set(pkgName, /* @__PURE__ */ new Set());
		for (const v of versions) merged.get(pkgName).add(v);
	}
	if (!merged.size) return;
	const sorted = [...merged].toSorted(([a], [b]) => a.localeCompare(b));
	const result = {};
	for (const [pkgName, versions] of sorted) result[pkgName] = versions.size === 1 ? [...versions][0] : [...versions].toSorted();
	return result;
}
async function pack(dir, pm, destination, ignoreScripts) {
	pm ||= {
		name: "npm",
		agent: "npm"
	};
	if (pm.name === "deno") throw new Error(`Cannot pack tarball for Deno projects at ${dir}`);
	const command = pm.name;
	const args = ["pack"];
	if (pm.name === "bun") args.unshift("pm");
	const outFile = path.join(destination, "package.tgz");
	if (destination) switch (pm.agent) {
		case "yarn":
			args.push("-f", outFile);
			break;
		case "yarn@berry":
			args.push("-o", outFile);
			break;
		case "bun":
			args.push("--destination", destination);
			break;
		default:
			args.push("--pack-destination", destination);
			break;
	}
	if (ignoreScripts) switch (pm.agent) {
		case "pnpm":
			args.push("--config.ignore-scripts=true");
			break;
		case "yarn@berry": break;
		default:
			args.push("--ignore-scripts");
			break;
	}
	const output = await x$1(command, args, {
		nodePath: false,
		nodeOptions: { cwd: dir }
	});
	const tarballFile = await readdir(destination).then((files) => files.find((file) => file.endsWith(".tgz")));
	if (!tarballFile) throw new Error(`Failed to find packed tarball file in ${destination}. Command output:\n${JSON.stringify(output, null, 2)}`);
	return path.join(destination, tarballFile);
}
function resolveJsOutputExtension(packageType, format, fixedExtension) {
	switch (format) {
		case "es": return !fixedExtension && packageType === "module" ? "js" : "mjs";
		case "cjs": return fixedExtension || packageType === "module" ? "cjs" : "js";
		default: return "js";
	}
}
function resolveChunkFilename({ outExtensions, fixedExtension, pkg, hash }, inputOptions, format) {
	const packageType = getPackageType(pkg);
	let jsExtension;
	let dtsExtension;
	if (outExtensions) {
		const { js, dts } = outExtensions({
			options: inputOptions,
			format,
			pkgType: packageType
		}) || {};
		jsExtension = js;
		dtsExtension = dts;
	}
	jsExtension ??= `.${resolveJsOutputExtension(packageType, format, fixedExtension)}`;
	const suffix = format === "iife" || format === "umd" ? `.${format}` : "";
	return [createChunkFilename(`[name]${suffix}`, jsExtension, dtsExtension), createChunkFilename(`[name]${suffix}${hash ? "-[hash]" : ""}`, jsExtension, dtsExtension)];
}
function createChunkFilename(basename, jsExtension, dtsExtension) {
	if (dtsExtension === void 0) return `${basename}${jsExtension}`;
	return (chunk) => {
		return `${basename}${chunk.name.endsWith(".d") ? dtsExtension : jsExtension}`;
	};
}
function resolveChunkAddon(chunkAddon, format) {
	if (!chunkAddon) return;
	return (chunk) => {
		const resolved = typeof chunkAddon === "function" ? chunkAddon({
			format,
			fileName: chunk.fileName
		}) : chunkAddon;
		if (typeof resolved === "string") return resolved;
		switch (true) {
			case RE_JS.test(chunk.fileName): return resolved?.js || "";
			case RE_CSS.test(chunk.fileName): return resolved?.css || "";
			case RE_DTS.test(chunk.fileName): return resolved?.dts || "";
			default: return "";
		}
	};
}
const debug = createDebug("tsdown:rolldown");
async function getBuildOptions(config, format, configDeps, bundle, cjsDts = false, isDualFormat) {
	const inputOptions = await resolveInputOptions(config, format, configDeps, bundle, cjsDts, isDualFormat);
	const outputOptions = await resolveOutputOptions(inputOptions, config, format, cjsDts);
	const rolldownConfig = {
		...inputOptions,
		output: outputOptions,
		write: config.write
	};
	debug("rolldown config with format \"%s\" %O", cjsDts ? "cjs dts" : format, rolldownConfig);
	return rolldownConfig;
}
async function resolveInputOptions(config, format, configDeps, bundle, cjsDts, isDualFormat) {
	const { alias, checks: { legacyCjs, ...checks } = {}, cjsDefault, cwd, deps, devtools, dts, entry, env, globImport, loader, logger, nameLabel, nodeProtocol, platform, plugins: userPlugins, report, shims, target, treeshake, tsconfig, unused, watch } = config;
	const loggerLevelIndex = LogLevels[logger.level];
	const isSuppressed = createSuppressWarnings(logger.options?.suppressWarnings);
	const plugins = [];
	if (nodeProtocol) plugins.push(NodeProtocolPlugin(nodeProtocol));
	if (config.pkg || config.deps.skipNodeModulesBundle || config.deps.neverBundle === true || config.deps.dts.neverBundle === true) plugins.push(DepsPlugin(config, bundle));
	if (dts) {
		const { dts: dtsPlugin } = await import("./dist-BsS7BOcb.js");
		const { cjsReexport: _, ...dtsPluginOptions } = dts;
		const options = {
			tsconfig,
			logger,
			...dtsPluginOptions
		};
		if (format === "es") plugins.push(dtsPlugin(options));
		else if (cjsDts) plugins.push(dtsPlugin({
			...options,
			emitDtsOnly: true,
			cjsDefault
		}));
		else if (dts.cjsReexport && isDualFormat) plugins.push(CjsDtsReexportPlugin());
	}
	let cssPostPlugins;
	if (!cjsDts) {
		if (unused) {
			const { Unused } = await importWithError("unplugin-unused");
			plugins.push(Unused.rolldown({
				root: cwd,
				...unused
			}));
		}
		if (true) {
			const { CssPlugin } = await import("./tsdown-css.js");
			const cssPlugins = CssPlugin(config, { logger });
			plugins.push(...cssPlugins.pre);
			cssPostPlugins = cssPlugins.post;
		} else plugins.push(CssGuardPlugin());
		plugins.push(ShebangPlugin(logger, cwd, nameLabel, isDualFormat));
		if (globImport) plugins.push(importGlobPlugin({ root: cwd }));
	}
	if (report && loggerLevelIndex >= 3) plugins.push(ReportPlugin(config, cjsDts, isDualFormat));
	if (watch) plugins.push(WatchPlugin(configDeps, bundle));
	if (!cjsDts) plugins.push(userPlugins);
	if (cssPostPlugins) plugins.push(...cssPostPlugins);
	let define = {
		...config.define,
		...Object.keys(env).reduce((acc, key) => {
			const value = JSON.stringify(env[key]);
			acc[`process.env.${key}`] = value;
			acc[`import.meta.env.${key}`] = value;
			return acc;
		}, Object.create(null))
	};
	let inject;
	if (shims && !cjsDts) {
		const shims = getShims(config);
		inject = shims.inject;
		define = {
			...define,
			...shims.define
		};
		if (shims.plugin) plugins.push(shims.plugin);
	}
	const jsNeverBundle = deps.neverBundle === true ? void 0 : deps.neverBundle;
	const dtsNeverBundle = deps.dts.neverBundle === true ? void 0 : deps.dts.neverBundle;
	const dtsExternal = dtsNeverBundle ? functionifyExternal(dtsNeverBundle) : void 0;
	let external;
	if (jsNeverBundle && dtsExternal) {
		const jsExternal = functionifyExternal(jsNeverBundle);
		external = (id, importer, ...args) => {
			return ((importer ? RE_DTS.test(importer) : false) ? dtsExternal : jsExternal)(id, importer, ...args);
		};
	} else if (dtsExternal) external = (id, importer, ...args) => {
		return (importer ? RE_DTS.test(importer) : false) ? dtsExternal(id, importer, ...args) : void 0;
	};
	else external = jsNeverBundle;
	const logLevel = logger.options?.failOnWarn && loggerLevelIndex < 2 ? "warn" : logger.level === "error" ? "silent" : logger.level;
	return await mergeUserOptions({
		input: entry,
		cwd,
		external,
		resolve: { alias },
		tsconfig: tsconfig || void 0,
		treeshake,
		platform: cjsDts || format === "cjs" ? "node" : platform,
		transform: {
			target,
			define,
			inject
		},
		plugins,
		moduleTypes: {
			".node": "copy",
			...loader
		},
		logLevel,
		onLog(level, log, defaultHandler) {
			if (cjsDefault && log.code === "MIXED_EXPORT") return;
			if (level === "warn" && isSuppressed(log.message)) return;
			if (logger.options?.failOnWarn && level === "warn" && log.code !== "PLUGIN_TIMINGS") defaultHandler("error", log);
			defaultHandler(level, log);
		},
		devtools: devtools || void 0,
		checks
	}, config.inputOptions, [format, { cjsDts }]);
}
async function resolveOutputOptions(inputOptions, config, format, cjsDts) {
	const { banner, cjsDefault, footer, minify, outDir, sourcemap, unbundle } = config;
	const [entryFileNames, chunkFileNames] = resolveChunkFilename(config, inputOptions, format);
	return await mergeUserOptions({
		format: cjsDts ? "es" : format,
		name: config.globalName,
		sourcemap,
		dir: outDir,
		exports: cjsDefault ? "auto" : "named",
		minify: !cjsDts && minify,
		entryFileNames,
		chunkFileNames,
		preserveModules: unbundle,
		preserveModulesRoot: unbundle ? config.root : void 0,
		postBanner: resolveChunkAddon(banner, format),
		postFooter: resolveChunkAddon(footer, format),
		codeSplitting: config.exe ? false : void 0
	}, config.outputOptions, [format, { cjsDts }]);
}
async function getDebugRolldownDir() {
	if (debug.enabled) return await mkdtemp(path.join(tmpdir(), "tsdown-config-"));
}
async function debugBuildOptions(dir, name, format, buildOptions) {
	const outFile = path.join(dir, `rolldown.config.${format}.js`);
	handlePluginInspect(buildOptions.plugins);
	const serialized = formatWithOptions({
		depth: null,
		maxArrayLength: null,
		maxStringLength: null
	}, buildOptions);
	await writeFile(outFile, `/*
Auto-generated rolldown config for tsdown debug purposes
tsdown v${version}, rolldown v${VERSION}
Generated on ${(/* @__PURE__ */ new Date()).toISOString()}
Package name: ${name || "not specified"}
*/

export default ${serialized}\n`);
	debug("Wrote debug rolldown config for \"%s\" (%s) -> %s", name || "default name", format, outFile);
}
function handlePluginInspect(plugins) {
	if (Array.isArray(plugins)) for (const plugin of plugins) handlePluginInspect(plugin);
	else if (typeof plugins === "object" && plugins !== null && "name" in plugins) plugins[inspect.custom] = function(depth, options, inspect) {
		if ("_options" in plugins) return inspect({
			name: plugins.name,
			options: plugins._options
		}, options);
		else return `"rolldown plugin: ${plugins.name}"`;
	};
}
function CssGuardPlugin() {
	return {
		name: "tsdown:css-guard",
		transform: {
			order: "post",
			filter: { id: /\.(?:css|less|sass|scss|styl|stylus)$/ },
			handler(_code, id) {
				throw new Error(`CSS file "${id}" was encountered but \`@tsdown/css\` is not installed. Please install it: \`npm install @tsdown/css\``);
			}
		}
	};
}
function functionifyExternal(external) {
	if (typeof external === "function") return external;
	external = toArray(external);
	return (id) => {
		return external.some((item) => item instanceof RegExp ? item.test(id) : item === id);
	};
}
function shortcuts(restart) {
	let actionRunning = false;
	async function onInput(input) {
		if (actionRunning) return;
		input = input.trim().toLowerCase();
		const SHORTCUTS = [
			{
				key: "r",
				description: "reload config and rebuild",
				action() {
					restart();
				}
			},
			{
				key: "c",
				description: "clear console",
				action() {
					console.clear();
				}
			},
			{
				key: "q",
				description: "quit",
				action() {
					process$1.exit(0);
				}
			}
		];
		if (input === "h") {
			const loggedKeys = /* @__PURE__ */ new Set();
			globalLogger.info("  Shortcuts");
			for (const shortcut of SHORTCUTS) {
				if (loggedKeys.has(shortcut.key)) continue;
				loggedKeys.add(shortcut.key);
				if (shortcut.action == null) continue;
				globalLogger.info(dim`  press ` + bold`${shortcut.key} + enter` + dim` to ${shortcut.description}`);
			}
			return;
		}
		const shortcut = SHORTCUTS.find((shortcut) => shortcut.key === input);
		if (!shortcut) return;
		actionRunning = true;
		await shortcut.action();
		actionRunning = false;
	}
	const rl = readline.createInterface({ input: process$1.stdin });
	rl.on("line", onInput);
	return () => rl.close();
}
var build_exports = /* @__PURE__ */ __exportAll({
	build: () => build$1,
	buildWithConfigs: () => buildWithConfigs
});
const asyncDispose = Symbol.asyncDispose || Symbol.for("Symbol.asyncDispose");
/**
* Build with tsdown.
*/
async function build$1(inlineConfig = {}) {
	globalLogger.level = inlineConfig.logLevel || "info";
	const { configs, deps: configDeps } = await resolveConfig(inlineConfig);
	return buildWithConfigs(configs, configDeps, () => build$1(inlineConfig));
}
/**
* Build with `ResolvedConfigs`.
*
* **Internal API, not for public use**
* @private
*/
async function buildWithConfigs(configs, configDeps, _restart) {
	let cleanPromise;
	const clean = () => {
		if (cleanPromise) return cleanPromise;
		return cleanPromise = cleanOutDir(configs);
	};
	const disposeCbs = [];
	let restarting = false;
	async function restart() {
		if (restarting) return;
		restarting = true;
		await Promise.all(disposeCbs.map((cb) => cb()));
		clearRequireCache();
		_restart();
	}
	const configChunksByPkg = initBundleByPkg(configs);
	function done(bundle) {
		return bundleDone(configChunksByPkg, bundle);
	}
	globalLogger.info("Build start");
	const bundles = await Promise.all(configs.map((options) => {
		return buildSingle(options, configDeps, options.pkg ? configChunksByPkg[options.pkg.packageJsonPath].formats.size > 1 : true, clean, restart, done);
	}));
	const firstDevtoolsConfig = configs.find((config) => config.devtools && config.devtools.ui);
	if (configs.some((config) => config.watch)) {
		disposeCbs.push(shortcuts(restart));
		for (const bundle of bundles) disposeCbs.push(bundle[asyncDispose]);
	} else if (firstDevtoolsConfig) startDevtoolsUI(firstDevtoolsConfig.devtools);
	return bundles;
}
/**
* Build a single configuration, without watch and shortcuts features.
* @param config Resolved options
*/
async function buildSingle(config, configDeps, isDualFormat, clean, restart, done) {
	const { format, dts, watch: watch$1, logger, outDir } = config;
	const { hooks, context } = await createHooks(config);
	warnLegacyCJS(config);
	const startTime = performance.now();
	await hooks.callHook("build:prepare", context);
	await clean();
	const debugRolldownConfigDir = await getDebugRolldownDir();
	const chunks = [];
	let watcher;
	let ab;
	const debouncedPostBuild = debounce(() => {
		postBuild().catch((error) => logger.error(error));
	}, 100);
	let hasBuilt = false;
	const bundle = {
		chunks,
		config,
		inlinedDeps: /* @__PURE__ */ new Map(),
		async [asyncDispose]() {
			debouncedPostBuild.cancel();
			ab?.abort();
			await watcher?.close();
		}
	};
	const configs = await initBuildOptions();
	if (watch$1) {
		watcher = watch(configs);
		handleWatcher(watcher);
	} else {
		const outputs = await config.runBuild(() => build(configs));
		for (const { output } of outputs) chunks.push(...addOutDirToChunks(output, outDir));
	}
	if (!watch$1) {
		logger.success(config.nameLabel, `Build complete in ${green(`${Math.round(performance.now() - startTime)}ms`)}`);
		await postBuild();
	}
	return bundle;
	function handleWatcher(watcher) {
		const changedFile = [];
		let hasError = false;
		watcher.on("change", async (id, event) => {
			if (event.event === "update") {
				changedFile.push(id);
				debouncedPostBuild.cancel();
				ab?.abort();
			}
			if (configDeps.has(id) || endsWithConfig.test(id)) {
				globalLogger.info(`Reload config: ${id}, restarting...`);
				restart();
			}
			if ((event.event === "create" || event.event === "delete") && config.rawEntry && isGlobEntry(config.rawEntry)) {
				const [newEntry] = await toObjectEntry(config.rawEntry, config.cwd);
				if (Object.keys(config.entry).toSorted().join("\0") !== Object.keys(newEntry).toSorted().join("\0")) {
					globalLogger.info("Entry files changed, restarting...");
					restart();
				}
			}
		});
		watcher.on("event", async (event) => {
			switch (event.code) {
				case "START":
					debouncedPostBuild.cancel();
					if (config.clean.length) await cleanChunks(config.outDir, chunks);
					chunks.length = 0;
					hasError = false;
					break;
				case "END":
					if (!hasError) debouncedPostBuild();
					break;
				case "BUNDLE_START":
					if (changedFile.length) {
						logger.clearScreen("info");
						logger.info(`Found ${bold(changedFile.join(", "))} changed, rebuilding...`);
					}
					changedFile.length = 0;
					break;
				case "BUNDLE_END":
					await event.result.close();
					logger.success(config.nameLabel, `Rebuilt in ${event.duration}ms.`);
					break;
				case "ERROR":
					await event.result.close();
					logger.error(event.error);
					hasError = true;
			}
		});
	}
	async function initBuildOptions() {
		const buildOptions = await getBuildOptions(config, format, configDeps, bundle, false, isDualFormat);
		await hooks.callHook("build:before", {
			...context,
			buildOptions
		});
		if (debugRolldownConfigDir) await debugBuildOptions(debugRolldownConfigDir, config.name, format, buildOptions);
		const configs = [buildOptions];
		if (format === "cjs" && dts && (!isDualFormat || !dts.cjsReexport)) configs.push(await getBuildOptions(config, format, configDeps, bundle, true, isDualFormat));
		return configs;
	}
	async function postBuild() {
		await copy(config);
		await buildExe(config, chunks);
		if (!hasBuilt) await done(bundle);
		await hooks.callHook("build:done", {
			...context,
			chunks
		});
		hasBuilt = true;
		ab?.abort();
		ab = executeOnSuccess(config);
	}
}
//#endregion
export { resolveUserConfig as a, mergeConfig as i, buildWithConfigs as n, at as o, build_D_enfyvD_exports as r, ee as s, build$1 as t };
