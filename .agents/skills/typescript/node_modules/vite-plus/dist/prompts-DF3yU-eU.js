import { r as __toESM, t as __commonJSMin } from "./rolldown-runtime-CMFfr-1z.js";
import { t as accent } from "./terminal-MKGAuy-p.js";
import { f as VITE_PLUS_VERSION } from "./constants-Bn-U8o4v.js";
import { a as writeJsonFile, i as readJsonFile } from "./json-cULBl7Pi.js";
import { n as runCommandSilently } from "./command-CguLh2KL.js";
import { t as require_dist } from "./dist-BDYZP12R.js";
import path from "node:path";
import { downloadPackageManager } from "../binding/index.js";
import { stripVTControlCharacters, styleText } from "node:util";
import fs from "node:fs";
import process$1, { stdin, stdout } from "node:process";
import * as l from "node:readline";
import l__default from "node:readline";
import { ReadStream } from "node:tty";
import { randomBytes } from "node:crypto";
//#region ../../node_modules/.pnpm/fast-string-truncated-width@3.0.3/node_modules/fast-string-truncated-width/dist/utils.js
const getCodePointsLength$1 = (() => {
	const SURROGATE_PAIR_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
	return (input) => {
		let surrogatePairsNr = 0;
		SURROGATE_PAIR_RE.lastIndex = 0;
		while (SURROGATE_PAIR_RE.test(input)) surrogatePairsNr += 1;
		return input.length - surrogatePairsNr;
	};
})();
const isFullWidth = (x) => {
	return x === 12288 || x >= 65281 && x <= 65376 || x >= 65504 && x <= 65510;
};
const isWideNotCJKTNotEmoji$1 = (x) => {
	return x === 8987 || x === 9001 || x >= 12272 && x <= 12287 || x >= 12289 && x <= 12350 || x >= 12441 && x <= 12543 || x >= 12549 && x <= 12591 || x >= 12593 && x <= 12686 || x >= 12688 && x <= 12771 || x >= 12783 && x <= 12830 || x >= 12832 && x <= 12871 || x >= 12880 && x <= 19903 || x >= 65040 && x <= 65049 || x >= 65072 && x <= 65106 || x >= 65108 && x <= 65126 || x >= 65128 && x <= 65131 || x >= 127488 && x <= 127490 || x >= 127504 && x <= 127547 || x >= 127552 && x <= 127560 || x >= 131072 && x <= 196605 || x >= 196608 && x <= 262141;
};
//#endregion
//#region ../../node_modules/.pnpm/fast-string-truncated-width@3.0.3/node_modules/fast-string-truncated-width/dist/index.js
const ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\u001b\]8;[^;]*;.*?(?:\u0007|\u001b\u005c)/y;
const CONTROL_RE = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
const CJKT_WIDE_RE$1 = /(?:(?![\uFF61-\uFF9F\uFF00-\uFFEF])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Tangut}]){1,1000}/uy;
const TAB_RE = /\t{1,1000}/y;
const EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0061}-\u{E007A}]{2}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{1,3}\u{E007F}|(?:\p{Emoji}\uFE0F\u20E3?|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation})(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F\u20E3?))*/uy;
const LATIN_RE = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
const MODIFIER_RE = /\p{M}+/gu;
const NO_TRUNCATION$1 = {
	limit: Infinity,
	ellipsis: ""
};
const getStringTruncatedWidth = (input, truncationOptions = {}, widthOptions = {}) => {
	const LIMIT = truncationOptions.limit ?? Infinity;
	const ELLIPSIS = truncationOptions.ellipsis ?? "";
	const ELLIPSIS_WIDTH = truncationOptions?.ellipsisWidth ?? (ELLIPSIS ? getStringTruncatedWidth(ELLIPSIS, NO_TRUNCATION$1, widthOptions).width : 0);
	const ANSI_WIDTH = 0;
	const CONTROL_WIDTH = widthOptions.controlWidth ?? 0;
	const TAB_WIDTH = widthOptions.tabWidth ?? 8;
	const EMOJI_WIDTH = widthOptions.emojiWidth ?? 2;
	const FULL_WIDTH_WIDTH = 2;
	const REGULAR_WIDTH = widthOptions.regularWidth ?? 1;
	const WIDE_WIDTH = widthOptions.wideWidth ?? FULL_WIDTH_WIDTH;
	const PARSE_BLOCKS = [
		[LATIN_RE, REGULAR_WIDTH],
		[ANSI_RE, ANSI_WIDTH],
		[CONTROL_RE, CONTROL_WIDTH],
		[TAB_RE, TAB_WIDTH],
		[EMOJI_RE, EMOJI_WIDTH],
		[CJKT_WIDE_RE$1, WIDE_WIDTH]
	];
	let indexPrev = 0;
	let index = 0;
	let length = input.length;
	let lengthExtra = 0;
	let truncationEnabled = false;
	let truncationIndex = length;
	let truncationLimit = Math.max(0, LIMIT - ELLIPSIS_WIDTH);
	let unmatchedStart = 0;
	let unmatchedEnd = 0;
	let width = 0;
	let widthExtra = 0;
	outer: while (true) {
		if (unmatchedEnd > unmatchedStart || index >= length && index > indexPrev) {
			const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrev, index);
			lengthExtra = 0;
			for (const char of unmatched.replaceAll(MODIFIER_RE, "")) {
				const codePoint = char.codePointAt(0) || 0;
				if (isFullWidth(codePoint)) widthExtra = FULL_WIDTH_WIDTH;
				else if (isWideNotCJKTNotEmoji$1(codePoint)) widthExtra = WIDE_WIDTH;
				else widthExtra = REGULAR_WIDTH;
				if (width + widthExtra > truncationLimit) truncationIndex = Math.min(truncationIndex, Math.max(unmatchedStart, indexPrev) + lengthExtra);
				if (width + widthExtra > LIMIT) {
					truncationEnabled = true;
					break outer;
				}
				lengthExtra += char.length;
				width += widthExtra;
			}
			unmatchedStart = unmatchedEnd = 0;
		}
		if (index >= length) break outer;
		for (let i = 0, l = PARSE_BLOCKS.length; i < l; i++) {
			const [BLOCK_RE, BLOCK_WIDTH] = PARSE_BLOCKS[i];
			BLOCK_RE.lastIndex = index;
			if (BLOCK_RE.test(input)) {
				lengthExtra = BLOCK_RE === CJKT_WIDE_RE$1 ? getCodePointsLength$1(input.slice(index, BLOCK_RE.lastIndex)) : BLOCK_RE === EMOJI_RE ? 1 : BLOCK_RE.lastIndex - index;
				widthExtra = lengthExtra * BLOCK_WIDTH;
				if (width + widthExtra > truncationLimit) truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / BLOCK_WIDTH));
				if (width + widthExtra > LIMIT) {
					truncationEnabled = true;
					break outer;
				}
				width += widthExtra;
				unmatchedStart = indexPrev;
				unmatchedEnd = index;
				index = indexPrev = BLOCK_RE.lastIndex;
				continue outer;
			}
		}
		index += 1;
	}
	return {
		width: truncationEnabled ? truncationLimit : width,
		index: truncationEnabled ? truncationIndex : length,
		truncated: truncationEnabled,
		ellipsed: truncationEnabled && LIMIT >= ELLIPSIS_WIDTH
	};
};
//#endregion
//#region ../../node_modules/.pnpm/fast-string-width@3.0.2/node_modules/fast-string-width/dist/index.js
const NO_TRUNCATION = {
	limit: Infinity,
	ellipsis: "",
	ellipsisWidth: 0
};
const fastStringWidth = (input, options = {}) => {
	return getStringTruncatedWidth(input, NO_TRUNCATION, options).width;
};
//#endregion
//#region ../../node_modules/.pnpm/fast-wrap-ansi@0.2.0/node_modules/fast-wrap-ansi/lib/main.js
const ESC$1 = "\x1B";
const CSI$1 = "";
const END_CODE$1 = 39;
const ANSI_ESCAPE_BELL$1 = "\x07";
const ANSI_CSI$1 = "[";
const ANSI_OSC$1 = "]";
const ANSI_SGR_TERMINATOR$1 = "m";
const ANSI_ESCAPE_LINK$1 = `${ANSI_OSC$1}8;;`;
const GROUP_REGEX$1 = new RegExp(`(?:\\${ANSI_CSI$1}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK$1}(?<uri>.*)${ANSI_ESCAPE_BELL$1})`, "y");
const getClosingCode$1 = (openingCode) => {
	if (openingCode >= 30 && openingCode <= 37) return 39;
	if (openingCode >= 90 && openingCode <= 97) return 39;
	if (openingCode >= 40 && openingCode <= 47) return 49;
	if (openingCode >= 100 && openingCode <= 107) return 49;
	if (openingCode === 1 || openingCode === 2) return 22;
	if (openingCode === 3) return 23;
	if (openingCode === 4) return 24;
	if (openingCode === 7) return 27;
	if (openingCode === 8) return 28;
	if (openingCode === 9) return 29;
	if (openingCode === 0) return 0;
};
const wrapAnsiCode$1 = (code) => `${ESC$1}${ANSI_CSI$1}${code}${ANSI_SGR_TERMINATOR$1}`;
const wrapAnsiHyperlink$1 = (url) => `${ESC$1}${ANSI_ESCAPE_LINK$1}${url}${ANSI_ESCAPE_BELL$1}`;
const wrapWord$1 = (rows, word, columns) => {
	const characters = word[Symbol.iterator]();
	let isInsideEscape = false;
	let isInsideLinkEscape = false;
	let lastRow = rows.at(-1);
	let visible = lastRow === void 0 ? 0 : fastStringWidth(lastRow);
	let currentCharacter = characters.next();
	let nextCharacter = characters.next();
	let rawCharacterIndex = 0;
	while (!currentCharacter.done) {
		const character = currentCharacter.value;
		const characterLength = fastStringWidth(character);
		if (visible + characterLength <= columns) rows[rows.length - 1] += character;
		else {
			rows.push(character);
			visible = 0;
		}
		if (character === ESC$1 || character === CSI$1) {
			isInsideEscape = true;
			isInsideLinkEscape = word.startsWith(ANSI_ESCAPE_LINK$1, rawCharacterIndex + 1);
		}
		if (isInsideEscape) {
			if (isInsideLinkEscape) {
				if (character === ANSI_ESCAPE_BELL$1) {
					isInsideEscape = false;
					isInsideLinkEscape = false;
				}
			} else if (character === ANSI_SGR_TERMINATOR$1) isInsideEscape = false;
		} else {
			visible += characterLength;
			if (visible === columns && !nextCharacter.done) {
				rows.push("");
				visible = 0;
			}
		}
		currentCharacter = nextCharacter;
		nextCharacter = characters.next();
		rawCharacterIndex += character.length;
	}
	lastRow = rows.at(-1);
	if (!visible && lastRow !== void 0 && lastRow.length && rows.length > 1) rows[rows.length - 2] += rows.pop();
};
const stringVisibleTrimSpacesRight$1 = (string) => {
	const words = string.split(" ");
	let last = words.length;
	while (last) {
		if (fastStringWidth(words[last - 1])) break;
		last--;
	}
	if (last === words.length) return string;
	return words.slice(0, last).join(" ") + words.slice(last).join("");
};
const exec$1 = (string, columns, options = {}) => {
	if (options.trim !== false && string.trim() === "") return "";
	let returnValue = "";
	let escapeCode;
	let escapeUrl;
	const words = string.split(" ");
	let rows = [""];
	let rowLength = 0;
	for (let index = 0; index < words.length; index++) {
		const word = words[index];
		if (options.trim !== false) {
			const row = rows.at(-1) ?? "";
			const trimmed = row.trimStart();
			if (row.length !== trimmed.length) {
				rows[rows.length - 1] = trimmed;
				rowLength = fastStringWidth(trimmed);
			}
		}
		if (index !== 0) {
			if (rowLength >= columns && (options.wordWrap === false || options.trim === false)) {
				rows.push("");
				rowLength = 0;
			}
			if (rowLength || options.trim === false) {
				rows[rows.length - 1] += " ";
				rowLength++;
			}
		}
		const wordLength = fastStringWidth(word);
		if (options.hard && wordLength > columns) {
			const remainingColumns = columns - rowLength;
			const breaksStartingThisLine = 1 + Math.floor((wordLength - remainingColumns - 1) / columns);
			if (Math.floor((wordLength - 1) / columns) < breaksStartingThisLine) rows.push("");
			wrapWord$1(rows, word, columns);
			rowLength = fastStringWidth(rows.at(-1) ?? "");
			continue;
		}
		if (rowLength + wordLength > columns && rowLength && wordLength) {
			if (options.wordWrap === false && rowLength < columns) {
				wrapWord$1(rows, word, columns);
				rowLength = fastStringWidth(rows.at(-1) ?? "");
				continue;
			}
			rows.push("");
			rowLength = 0;
		}
		if (rowLength + wordLength > columns && options.wordWrap === false) {
			wrapWord$1(rows, word, columns);
			rowLength = fastStringWidth(rows.at(-1) ?? "");
			continue;
		}
		rows[rows.length - 1] += word;
		rowLength += wordLength;
	}
	if (options.trim !== false) rows = rows.map((row) => stringVisibleTrimSpacesRight$1(row));
	const preString = rows.join("\n");
	let inSurrogate = false;
	for (let i = 0; i < preString.length; i++) {
		const character = preString[i];
		returnValue += character;
		if (!inSurrogate) {
			inSurrogate = character >= "\ud800" && character <= "\udbff";
			if (inSurrogate) continue;
		} else inSurrogate = false;
		if (character === ESC$1 || character === CSI$1) {
			GROUP_REGEX$1.lastIndex = i + 1;
			const groups = GROUP_REGEX$1.exec(preString)?.groups;
			if (groups?.code !== void 0) {
				const code = Number.parseFloat(groups.code);
				escapeCode = code === END_CODE$1 ? void 0 : code;
			} else if (groups?.uri !== void 0) escapeUrl = groups.uri.length === 0 ? void 0 : groups.uri;
		}
		if (preString[i + 1] === "\n") {
			if (escapeUrl) returnValue += wrapAnsiHyperlink$1("");
			const closingCode = escapeCode ? getClosingCode$1(escapeCode) : void 0;
			if (escapeCode && closingCode) returnValue += wrapAnsiCode$1(closingCode);
		} else if (character === "\n") {
			if (escapeCode && getClosingCode$1(escapeCode)) returnValue += wrapAnsiCode$1(escapeCode);
			if (escapeUrl) returnValue += wrapAnsiHyperlink$1(escapeUrl);
		}
	}
	return returnValue;
};
const CRLF_OR_LF$1 = /\r?\n/;
function wrapAnsi$1(string, columns, options) {
	return String(string).normalize().split(CRLF_OR_LF$1).map((line) => exec$1(line, columns, options)).join("\n");
}
//#endregion
//#region ../../node_modules/.pnpm/@clack+core@1.4.3/node_modules/@clack/core/dist/index.mjs
var import_src = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const ESC = "\x1B";
	const CSI = `${ESC}[`;
	const beep = "\x07";
	const cursor = {
		to(x, y) {
			if (!y) return `${CSI}${x + 1}G`;
			return `${CSI}${y + 1};${x + 1}H`;
		},
		move(x, y) {
			let ret = "";
			if (x < 0) ret += `${CSI}${-x}D`;
			else if (x > 0) ret += `${CSI}${x}C`;
			if (y < 0) ret += `${CSI}${-y}A`;
			else if (y > 0) ret += `${CSI}${y}B`;
			return ret;
		},
		up: (count = 1) => `${CSI}${count}A`,
		down: (count = 1) => `${CSI}${count}B`,
		forward: (count = 1) => `${CSI}${count}C`,
		backward: (count = 1) => `${CSI}${count}D`,
		nextLine: (count = 1) => `${CSI}E`.repeat(count),
		prevLine: (count = 1) => `${CSI}F`.repeat(count),
		left: `${CSI}G`,
		hide: `${CSI}?25l`,
		show: `${CSI}?25h`,
		save: `${ESC}7`,
		restore: `${ESC}8`
	};
	module.exports = {
		cursor,
		scroll: {
			up: (count = 1) => `${CSI}S`.repeat(count),
			down: (count = 1) => `${CSI}T`.repeat(count)
		},
		erase: {
			screen: `${CSI}2J`,
			up: (count = 1) => `${CSI}1J`.repeat(count),
			down: (count = 1) => `${CSI}J`.repeat(count),
			line: `${CSI}2K`,
			lineEnd: `${CSI}K`,
			lineStart: `${CSI}1K`,
			lines(count) {
				let clear = "";
				for (let i = 0; i < count; i++) clear += this.line + (i < count - 1 ? cursor.up() : "");
				if (count) clear += cursor.left;
				return clear;
			}
		},
		beep
	};
})))();
function findCursor(s, o, l) {
	if (!l.some((r) => !r.disabled)) return s;
	const t = s + o, n = Math.max(l.length - 1, 0), e = t < 0 ? n : t > n ? 0 : t;
	return l[e]?.disabled ? findCursor(e, o < 0 ? -1 : 1, l) : e;
}
const settings = {
	actions: /* @__PURE__ */ new Set([
		"up",
		"down",
		"left",
		"right",
		"space",
		"enter",
		"cancel"
	]),
	aliases: /* @__PURE__ */ new Map([
		["k", "up"],
		["j", "down"],
		["h", "left"],
		["l", "right"],
		["", "cancel"],
		["escape", "cancel"]
	]),
	messages: {
		cancel: "Canceled",
		error: "Something went wrong"
	},
	withGuide: true,
	date: {
		monthNames: [...[
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December"
		]],
		messages: {
			required: "Please enter a valid date",
			invalidMonth: "There are only 12 months in a year",
			invalidDay: (n, e) => `There are only ${n} days in ${e}`,
			afterMin: (n) => `Date must be on or after ${n.toISOString().slice(0, 10)}`,
			beforeMax: (n) => `Date must be on or before ${n.toISOString().slice(0, 10)}`
		}
	}
};
function isActionKey(n, e) {
	if (typeof n == "string") return settings.aliases.get(n) === e;
	for (const s of n) if (s !== void 0 && isActionKey(s, e)) return true;
	return false;
}
function diffLines(i, s) {
	if (i === s) return;
	const e = i.split(`
`), t = s.split(`
`), r = Math.max(e.length, t.length), f = [];
	for (let n = 0; n < r; n++) e[n] !== t[n] && f.push(n);
	return {
		lines: f,
		numLinesBefore: e.length,
		numLinesAfter: t.length,
		numLines: r
	};
}
const R = globalThis.process.platform.startsWith("win");
const CANCEL_SYMBOL = Symbol("clack:cancel");
function isCancel(e) {
	return e === CANCEL_SYMBOL;
}
function setRawMode(e, r) {
	const o = e;
	o.isTTY && o.setRawMode(r);
}
function block({ input: e = stdin, output: r = stdout, overwrite: o = true, hideCursor: t = true } = {}) {
	const s = l.createInterface({
		input: e,
		output: r,
		prompt: "",
		tabSize: 1
	});
	l.emitKeypressEvents(e, s), e instanceof ReadStream && e.isTTY && e.setRawMode(true);
	const n = (f, { name: a, sequence: p }) => {
		if (isActionKey([
			String(f),
			a,
			p
		], "cancel")) {
			t && r.write(import_src.cursor.show), process.exit(0);
			return;
		}
		if (!o) return;
		const i = a === "return" ? 0 : -1, m = a === "return" ? -1 : 0;
		l.moveCursor(r, i, m, () => {
			l.clearLine(r, 1, () => {
				e.once("keypress", n);
			});
		});
	};
	return t && r.write(import_src.cursor.hide), e.once("keypress", n), () => {
		e.off("keypress", n), t && r.write(import_src.cursor.show), e instanceof ReadStream && e.isTTY && !R && e.setRawMode(false), s.terminal = false, s.close();
	};
}
const getColumns = (e) => "columns" in e && typeof e.columns == "number" ? e.columns : 80;
const getRows = (e) => "rows" in e && typeof e.rows == "number" ? e.rows : 20;
function wrapTextWithPrefix(e, r, o, t = o, s = o, n) {
	return wrapAnsi$1(r, getColumns(e ?? stdout) - o.length, {
		hard: true,
		trim: false
	}).split(`
`).map((c, i, m) => {
		const d = n ? n(c, i) : c;
		return i === 0 ? `${t}${d}` : i === m.length - 1 ? `${s}${d}` : `${o}${d}`;
	}).join(`
`);
}
function runValidation(e, n) {
	if ("~standard" in e) {
		const a = e["~standard"].validate(n);
		if (a instanceof Promise) throw new TypeError("Schema validation must be synchronous. Update `validate()` and remove any asynchronous logic.");
		return a.issues?.at(0)?.message;
	}
	return e(n);
}
var V = class {
	input;
	output;
	_abortSignal;
	rl;
	opts;
	_render;
	_track = false;
	_prevFrame = "";
	_subscribers = /* @__PURE__ */ new Map();
	_cursor = 0;
	state = "initial";
	error = "";
	value;
	userInput = "";
	constructor(t, e = true) {
		const { input: i = stdin, output: n = stdout, render: s, signal: r, ...o } = t;
		this.opts = o, this.onKeypress = this.onKeypress.bind(this), this.close = this.close.bind(this), this.render = this.render.bind(this), this._render = s.bind(this), this._track = e, this._abortSignal = r, this.input = i, this.output = n;
	}
	/**
	* Unsubscribe all listeners
	*/
	unsubscribe() {
		this._subscribers.clear();
	}
	/**
	* Set a subscriber with opts
	* @param event - The event name
	*/
	setSubscriber(t, e) {
		const i = this._subscribers.get(t) ?? [];
		i.push(e), this._subscribers.set(t, i);
	}
	/**
	* Subscribe to an event
	* @param event - The event name
	* @param cb - The callback
	*/
	on(t, e) {
		this.setSubscriber(t, { cb: e });
	}
	/**
	* Subscribe to an event once
	* @param event - The event name
	* @param cb - The callback
	*/
	once(t, e) {
		this.setSubscriber(t, {
			cb: e,
			once: true
		});
	}
	/**
	* Emit an event with data
	* @param event - The event name
	* @param data - The data to pass to the callback
	*/
	emit(t, ...e) {
		const i = this._subscribers.get(t) ?? [], n = [];
		for (const s of i) s.cb(...e), s.once && n.push(() => i.splice(i.indexOf(s), 1));
		for (const s of n) s();
	}
	prompt() {
		return new Promise((t) => {
			if (this._abortSignal) {
				if (this._abortSignal.aborted) return this.state = "cancel", this.close(), t(CANCEL_SYMBOL);
				this._abortSignal.addEventListener("abort", () => {
					this.state = "cancel", this.close();
				}, { once: true });
			}
			this.rl = l__default.createInterface({
				input: this.input,
				tabSize: 2,
				prompt: "",
				escapeCodeTimeout: 50,
				terminal: true
			}), this.rl.prompt(), this.opts.initialUserInput !== void 0 && this._setUserInput(this.opts.initialUserInput, true), this.input.on("keypress", this.onKeypress), setRawMode(this.input, true), this.output.on("resize", this.render), this.render(), this.once("submit", () => {
				this.output.write(import_src.cursor.show), this.output.off("resize", this.render), setRawMode(this.input, false), t(this.value);
			}), this.once("cancel", () => {
				this.output.write(import_src.cursor.show), this.output.off("resize", this.render), setRawMode(this.input, false), t(CANCEL_SYMBOL);
			});
		});
	}
	_isActionKey(t, e) {
		return t === "	";
	}
	_shouldSubmit(t, e) {
		return true;
	}
	_setValue(t) {
		this.value = t, this.emit("value", this.value);
	}
	_setUserInput(t, e) {
		this.userInput = t ?? "", this.emit("userInput", this.userInput), e && this._track && this.rl && (this.rl.write(this.userInput), this._cursor = this.rl.cursor);
	}
	_clearUserInput() {
		this.rl?.write(null, {
			ctrl: true,
			name: "u"
		}), this._setUserInput("");
	}
	onKeypress(t, e) {
		if (this._track && e.name !== "return" && (e.name && this._isActionKey(t, e) && this.rl?.write(null, {
			ctrl: true,
			name: "h"
		}), this._cursor = this.rl?.cursor ?? 0, this._setUserInput(this.rl?.line)), this.state === "error" && (this.state = "active"), e?.name && (!this._track && settings.aliases.has(e.name) && this.emit("cursor", settings.aliases.get(e.name)), settings.actions.has(e.name) && this.emit("cursor", e.name)), t && (t.toLowerCase() === "y" || t.toLowerCase() === "n") && this.emit("confirm", t.toLowerCase() === "y"), this.emit("key", t, e), e?.name === "return" && this._shouldSubmit(t, e)) {
			if (this.opts.validate) {
				const i = runValidation(this.opts.validate, this.value);
				i && (this.error = i instanceof Error ? i.message : i, this.state = "error", this.rl?.write(this.userInput));
			}
			this.state !== "error" && (this.state = "submit");
		}
		isActionKey([
			t,
			e?.name,
			e?.sequence
		], "cancel") && (this.state = "cancel"), (this.state === "submit" || this.state === "cancel") && this.emit("finalize"), this.render(), (this.state === "submit" || this.state === "cancel") && this.close();
	}
	close() {
		this.input.unpipe(), this.input.removeListener("keypress", this.onKeypress), this.output.write(`
`), setRawMode(this.input, false), this.rl?.close(), this.rl = void 0, this.emit(`${this.state}`, this.value), this.unsubscribe();
	}
	restoreCursor() {
		const t = wrapAnsi$1(this._prevFrame, process.stdout.columns, {
			hard: true,
			trim: false
		}).split(`
`).length - 1;
		this.output.write(import_src.cursor.move(-999, t * -1));
	}
	render() {
		const t = wrapAnsi$1(this._render(this) ?? "", process.stdout.columns, {
			hard: true,
			trim: false
		});
		if (t !== this._prevFrame) {
			if (this.state === "initial") this.output.write(import_src.cursor.hide);
			else {
				const e = diffLines(this._prevFrame, t), i = getRows(this.output);
				if (this.restoreCursor(), e) {
					const n = Math.max(0, e.numLinesAfter - i), s = Math.max(0, e.numLinesBefore - i);
					let r = e.lines.find((o) => o >= n);
					if (r === void 0) {
						this._prevFrame = t;
						return;
					}
					if (e.lines.length === 1) {
						this.output.write(import_src.cursor.move(0, r - s)), this.output.write(import_src.erase.lines(1));
						const o = t.split(`
`);
						this.output.write(o[r]), this._prevFrame = t, this.output.write(import_src.cursor.move(0, o.length - r - 1));
						return;
					} else if (e.lines.length > 1) {
						if (n < s) r = n;
						else {
							const h = r - s;
							h > 0 && this.output.write(import_src.cursor.move(0, h));
						}
						this.output.write(import_src.erase.down());
						const f = t.split(`
`).slice(r);
						this.output.write(f.join(`
`)), this._prevFrame = t;
						return;
					}
				}
				this.output.write(import_src.erase.down());
			}
			this.output.write(t), this.state === "initial" && (this.state = "active"), this._prevFrame = t;
		}
	}
};
var r = class extends V {
	get cursor() {
		return this.value ? 0 : 1;
	}
	get _value() {
		return this.cursor === 0;
	}
	constructor(t) {
		super(t, false), this.value = !!t.initialValue, this.on("userInput", () => {
			this.value = this._value;
		}), this.on("confirm", (i) => {
			this.output.write(import_src.cursor.move(0, -1)), this.value = i, this.state = "submit", this.close();
		}), this.on("cursor", () => {
			this.value = !this.value;
		});
	}
};
var a = class extends V {
	options;
	cursor = 0;
	get _value() {
		return this.options[this.cursor]?.value;
	}
	get _enabledOptions() {
		return this.options.filter((e) => e.disabled !== true);
	}
	toggleAll() {
		const e = this._enabledOptions, i = this.value !== void 0 && this.value.length === e.length;
		this.value = i ? [] : e.map((t) => t.value);
	}
	toggleInvert() {
		const e = this.value;
		if (!e) return;
		const i = this._enabledOptions.filter((t) => !e.includes(t.value));
		this.value = i.map((t) => t.value);
	}
	toggleValue() {
		this.value === void 0 && (this.value = []);
		const e = this.value.includes(this._value);
		this.value = e ? this.value.filter((i) => i !== this._value) : [...this.value, this._value];
	}
	constructor(e) {
		super(e, false), this.options = e.options, this.value = [...e.initialValues ?? []];
		const i = Math.max(this.options.findIndex(({ value: t }) => t === e.cursorAt), 0);
		this.cursor = this.options[i]?.disabled ? findCursor(i, 1, this.options) : i, this.on("key", (t, l) => {
			l.name === "a" && this.toggleAll(), l.name === "i" && this.toggleInvert();
		}), this.on("cursor", (t) => {
			switch (t) {
				case "left":
				case "up":
					this.cursor = findCursor(this.cursor, -1, this.options);
					break;
				case "down":
				case "right":
					this.cursor = findCursor(this.cursor, 1, this.options);
					break;
				case "space": this.toggleValue();
			}
		});
	}
};
let n$1 = class n extends V {
	options;
	cursor = 0;
	get _selectedValue() {
		return this.options[this.cursor];
	}
	changeValue() {
		const e = this._selectedValue;
		this.value = e === void 0 ? void 0 : e.value;
	}
	constructor(e) {
		super(e, false), this.options = e.options;
		const o = this.options.findIndex(({ value: s }) => s === e.initialValue), t = o === -1 ? 0 : o;
		this.cursor = this.options[t]?.disabled ? findCursor(t, 1, this.options) : t, this.changeValue(), this.on("cursor", (s) => {
			switch (s) {
				case "left":
				case "up":
					this.cursor = findCursor(this.cursor, -1, this.options);
					break;
				case "down":
				case "right": this.cursor = findCursor(this.cursor, 1, this.options);
			}
			this.changeValue();
		});
	}
};
var n = class extends V {
	get userInputWithCursor() {
		if (this.state === "submit") return this.userInput;
		const t = this.userInput;
		if (this.cursor >= t.length) return `${this.userInput}\u2588`;
		const r = t.slice(0, this.cursor), s = t.slice(this.cursor, this.cursor + 1), e = t.slice(this.cursor + 1);
		return `${r}${styleText("inverse", s)}${e}`;
	}
	get cursor() {
		return this._cursor;
	}
	constructor(t) {
		super({
			...t,
			initialUserInput: t.initialUserInput ?? t.initialValue
		}), this.on("userInput", (r) => {
			this._setValue(r);
		}), this.on("finalize", () => {
			this.value || (this.value = t.defaultValue), this.value === void 0 && (this.value = "");
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/picocolors@1.1.1/node_modules/picocolors/picocolors.js
var require_picocolors = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let p = process || {};
	let argv = p.argv || [];
	let env = p.env || {};
	let isColorSupported = !(!!env.NO_COLOR || argv.includes("--no-color")) && (!!env.FORCE_COLOR || argv.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env.TERM !== "dumb" || !!env.CI);
	let formatter = (open, close, replace = open) => (input) => {
		let string = "" + input, index = string.indexOf(close, open.length);
		return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
	};
	let replaceClose = (string, close, replace, index) => {
		let result = "", cursor = 0;
		do {
			result += string.substring(cursor, index) + replace;
			cursor = index + close.length;
			index = string.indexOf(close, cursor);
		} while (~index);
		return result + string.substring(cursor);
	};
	let createColors = (enabled = isColorSupported) => {
		let f = enabled ? formatter : () => String;
		return {
			isColorSupported: enabled,
			reset: f("\x1B[0m", "\x1B[0m"),
			bold: f("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
			dim: f("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
			italic: f("\x1B[3m", "\x1B[23m"),
			underline: f("\x1B[4m", "\x1B[24m"),
			inverse: f("\x1B[7m", "\x1B[27m"),
			hidden: f("\x1B[8m", "\x1B[28m"),
			strikethrough: f("\x1B[9m", "\x1B[29m"),
			black: f("\x1B[30m", "\x1B[39m"),
			red: f("\x1B[31m", "\x1B[39m"),
			green: f("\x1B[32m", "\x1B[39m"),
			yellow: f("\x1B[33m", "\x1B[39m"),
			blue: f("\x1B[34m", "\x1B[39m"),
			magenta: f("\x1B[35m", "\x1B[39m"),
			cyan: f("\x1B[36m", "\x1B[39m"),
			white: f("\x1B[37m", "\x1B[39m"),
			gray: f("\x1B[90m", "\x1B[39m"),
			bgBlack: f("\x1B[40m", "\x1B[49m"),
			bgRed: f("\x1B[41m", "\x1B[49m"),
			bgGreen: f("\x1B[42m", "\x1B[49m"),
			bgYellow: f("\x1B[43m", "\x1B[49m"),
			bgBlue: f("\x1B[44m", "\x1B[49m"),
			bgMagenta: f("\x1B[45m", "\x1B[49m"),
			bgCyan: f("\x1B[46m", "\x1B[49m"),
			bgWhite: f("\x1B[47m", "\x1B[49m"),
			blackBright: f("\x1B[90m", "\x1B[39m"),
			redBright: f("\x1B[91m", "\x1B[39m"),
			greenBright: f("\x1B[92m", "\x1B[39m"),
			yellowBright: f("\x1B[93m", "\x1B[39m"),
			blueBright: f("\x1B[94m", "\x1B[39m"),
			magentaBright: f("\x1B[95m", "\x1B[39m"),
			cyanBright: f("\x1B[96m", "\x1B[39m"),
			whiteBright: f("\x1B[97m", "\x1B[39m"),
			bgBlackBright: f("\x1B[100m", "\x1B[49m"),
			bgRedBright: f("\x1B[101m", "\x1B[49m"),
			bgGreenBright: f("\x1B[102m", "\x1B[49m"),
			bgYellowBright: f("\x1B[103m", "\x1B[49m"),
			bgBlueBright: f("\x1B[104m", "\x1B[49m"),
			bgMagentaBright: f("\x1B[105m", "\x1B[49m"),
			bgCyanBright: f("\x1B[106m", "\x1B[49m"),
			bgWhiteBright: f("\x1B[107m", "\x1B[49m")
		};
	};
	module.exports = createColors();
	module.exports.createColors = createColors;
}));
//#endregion
//#region ../prompts/dist/index.mjs
var import_picocolors = /* @__PURE__ */ __toESM(require_picocolors(), 1);
function isUnicodeSupported() {
	if (process$1.platform !== "win32") return process$1.env.TERM !== "linux";
	return Boolean(process$1.env.CI) || Boolean(process$1.env.WT_SESSION) || Boolean(process$1.env.TERMINUS_SUBLIME) || process$1.env.ConEmuTask === "{cmd::Cmder}" || process$1.env.TERM_PROGRAM === "Terminus-Sublime" || process$1.env.TERM_PROGRAM === "vscode" || process$1.env.TERM === "xterm-256color" || process$1.env.TERM === "alacritty" || process$1.env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
const unicode = isUnicodeSupported();
const isCI = () => process.env.CI === "true";
const unicodeOr = (c, fallback) => unicode ? c : fallback;
const S_POINTER_ACTIVE = unicodeOr("›", ">");
const S_STEP_ACTIVE = S_POINTER_ACTIVE;
const S_STEP_CANCEL = unicodeOr("■", "x");
const S_STEP_ERROR = unicodeOr("▲", "x");
const S_STEP_SUBMIT = unicodeOr("◇", "o");
const S_BAR = unicodeOr("│", "|");
const S_BAR_END = unicodeOr("└", "—");
const S_CHECKBOX_ACTIVE = unicodeOr("◻", "[•]");
const S_CHECKBOX_SELECTED = unicodeOr("◼", "[+]");
const S_CHECKBOX_INACTIVE = unicodeOr("◻", "[ ]");
const S_INFO = unicodeOr("●", "•");
const S_SUCCESS = unicodeOr("◆", "*");
const S_WARN = unicodeOr("▲", "!");
const S_ERROR = unicodeOr("■", "x");
const completeColor = (value) => import_picocolors.default.gray(value);
const symbol = (state) => {
	switch (state) {
		case "initial":
		case "active": return import_picocolors.default.blue(S_STEP_ACTIVE);
		case "cancel": return import_picocolors.default.red(S_STEP_CANCEL);
		case "error": return import_picocolors.default.yellow(S_STEP_ERROR);
		case "submit": return completeColor(S_STEP_SUBMIT);
		default: return import_picocolors.default.blue(S_STEP_ACTIVE);
	}
};
const symbolBar = (state) => {
	switch (state) {
		case "initial":
		case "active": return import_picocolors.default.blue(S_BAR);
		case "cancel": return import_picocolors.default.red(S_BAR);
		case "error": return import_picocolors.default.yellow(S_BAR);
		case "submit": return completeColor(S_BAR);
		default: return import_picocolors.default.blue(S_BAR);
	}
};
const getCodePointsLength = (() => {
	const SURROGATE_PAIR_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
	return (input) => {
		let surrogatePairsNr = 0;
		SURROGATE_PAIR_RE.lastIndex = 0;
		while (SURROGATE_PAIR_RE.test(input)) surrogatePairsNr += 1;
		return input.length - surrogatePairsNr;
	};
})();
const isFullWidth$1 = (x) => {
	return x === 12288 || x >= 65281 && x <= 65376 || x >= 65504 && x <= 65510;
};
const isWideNotCJKTNotEmoji = (x) => {
	return x === 8987 || x === 9001 || x >= 12272 && x <= 12287 || x >= 12289 && x <= 12350 || x >= 12441 && x <= 12543 || x >= 12549 && x <= 12591 || x >= 12593 && x <= 12686 || x >= 12688 && x <= 12771 || x >= 12783 && x <= 12830 || x >= 12832 && x <= 12871 || x >= 12880 && x <= 19903 || x >= 65040 && x <= 65049 || x >= 65072 && x <= 65106 || x >= 65108 && x <= 65126 || x >= 65128 && x <= 65131 || x >= 127488 && x <= 127490 || x >= 127504 && x <= 127547 || x >= 127552 && x <= 127560 || x >= 131072 && x <= 196605 || x >= 196608 && x <= 262141;
};
const ANSI_RE$1 = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\u001b\]8;[^;]*;.*?(?:\u0007|\u001b\u005c)/y;
const CONTROL_RE$1 = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
const CJKT_WIDE_RE = /(?:(?![\uFF61-\uFF9F\uFF00-\uFFEF])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Tangut}]){1,1000}/uy;
const TAB_RE$1 = /\t{1,1000}/y;
const EMOJI_RE$1 = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0061}-\u{E007A}]{2}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{1,3}\u{E007F}|(?:\p{Emoji}\uFE0F\u20E3?|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation})(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F\u20E3?))*/uy;
const LATIN_RE$1 = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
const MODIFIER_RE$1 = /\p{M}+/gu;
const NO_TRUNCATION$3 = {
	limit: Infinity,
	ellipsis: ""
};
const getStringTruncatedWidth$1 = (input, truncationOptions = {}, widthOptions = {}) => {
	const LIMIT = truncationOptions.limit ?? Infinity;
	const ELLIPSIS = truncationOptions.ellipsis ?? "";
	const ELLIPSIS_WIDTH = truncationOptions?.ellipsisWidth ?? (ELLIPSIS ? getStringTruncatedWidth$1(ELLIPSIS, NO_TRUNCATION$3, widthOptions).width : 0);
	const ANSI_WIDTH = 0;
	const CONTROL_WIDTH = widthOptions.controlWidth ?? 0;
	const TAB_WIDTH = widthOptions.tabWidth ?? 8;
	const EMOJI_WIDTH = widthOptions.emojiWidth ?? 2;
	const FULL_WIDTH_WIDTH = 2;
	const REGULAR_WIDTH = widthOptions.regularWidth ?? 1;
	const WIDE_WIDTH = widthOptions.wideWidth ?? FULL_WIDTH_WIDTH;
	const PARSE_BLOCKS = [
		[LATIN_RE$1, REGULAR_WIDTH],
		[ANSI_RE$1, ANSI_WIDTH],
		[CONTROL_RE$1, CONTROL_WIDTH],
		[TAB_RE$1, TAB_WIDTH],
		[EMOJI_RE$1, EMOJI_WIDTH],
		[CJKT_WIDE_RE, WIDE_WIDTH]
	];
	let indexPrev = 0;
	let index = 0;
	let length = input.length;
	let lengthExtra = 0;
	let truncationEnabled = false;
	let truncationIndex = length;
	let truncationLimit = Math.max(0, LIMIT - ELLIPSIS_WIDTH);
	let unmatchedStart = 0;
	let unmatchedEnd = 0;
	let width = 0;
	let widthExtra = 0;
	outer: while (true) {
		if (unmatchedEnd > unmatchedStart || index >= length && index > indexPrev) {
			const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrev, index);
			lengthExtra = 0;
			for (const char of unmatched.replaceAll(MODIFIER_RE$1, "")) {
				const codePoint = char.codePointAt(0) || 0;
				if (isFullWidth$1(codePoint)) widthExtra = FULL_WIDTH_WIDTH;
				else if (isWideNotCJKTNotEmoji(codePoint)) widthExtra = WIDE_WIDTH;
				else widthExtra = REGULAR_WIDTH;
				if (width + widthExtra > truncationLimit) truncationIndex = Math.min(truncationIndex, Math.max(unmatchedStart, indexPrev) + lengthExtra);
				if (width + widthExtra > LIMIT) {
					truncationEnabled = true;
					break outer;
				}
				lengthExtra += char.length;
				width += widthExtra;
			}
			unmatchedStart = unmatchedEnd = 0;
		}
		if (index >= length) break outer;
		for (let i = 0, l = PARSE_BLOCKS.length; i < l; i++) {
			const [BLOCK_RE, BLOCK_WIDTH] = PARSE_BLOCKS[i];
			BLOCK_RE.lastIndex = index;
			if (BLOCK_RE.test(input)) {
				lengthExtra = BLOCK_RE === CJKT_WIDE_RE ? getCodePointsLength(input.slice(index, BLOCK_RE.lastIndex)) : BLOCK_RE === EMOJI_RE$1 ? 1 : BLOCK_RE.lastIndex - index;
				widthExtra = lengthExtra * BLOCK_WIDTH;
				if (width + widthExtra > truncationLimit) truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / BLOCK_WIDTH));
				if (width + widthExtra > LIMIT) {
					truncationEnabled = true;
					break outer;
				}
				width += widthExtra;
				unmatchedStart = indexPrev;
				unmatchedEnd = index;
				index = indexPrev = BLOCK_RE.lastIndex;
				continue outer;
			}
		}
		index += 1;
	}
	return {
		width: truncationEnabled ? truncationLimit : width,
		index: truncationEnabled ? truncationIndex : length,
		truncated: truncationEnabled,
		ellipsed: truncationEnabled && LIMIT >= ELLIPSIS_WIDTH
	};
};
const NO_TRUNCATION$2 = {
	limit: Infinity,
	ellipsis: "",
	ellipsisWidth: 0
};
const fastStringWidth$1 = (input, options = {}) => {
	return getStringTruncatedWidth$1(input, NO_TRUNCATION$2, options).width;
};
const ESC = "\x1B";
const CSI = "";
const END_CODE = 39;
const ANSI_ESCAPE_BELL = "\x07";
const ANSI_CSI = "[";
const ANSI_OSC = "]";
const ANSI_SGR_TERMINATOR = "m";
const ANSI_ESCAPE_LINK = `${ANSI_OSC}8;;`;
const GROUP_REGEX = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`, "y");
const getClosingCode = (openingCode) => {
	if (openingCode >= 30 && openingCode <= 37) return 39;
	if (openingCode >= 90 && openingCode <= 97) return 39;
	if (openingCode >= 40 && openingCode <= 47) return 49;
	if (openingCode >= 100 && openingCode <= 107) return 49;
	if (openingCode === 1 || openingCode === 2) return 22;
	if (openingCode === 3) return 23;
	if (openingCode === 4) return 24;
	if (openingCode === 7) return 27;
	if (openingCode === 8) return 28;
	if (openingCode === 9) return 29;
	if (openingCode === 0) return 0;
};
const wrapAnsiCode = (code) => `${ESC}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;
const wrapAnsiHyperlink = (url) => `${ESC}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;
const wrapWord = (rows, word, columns) => {
	const characters = word[Symbol.iterator]();
	let isInsideEscape = false;
	let isInsideLinkEscape = false;
	let lastRow = rows.at(-1);
	let visible = lastRow === void 0 ? 0 : fastStringWidth$1(lastRow);
	let currentCharacter = characters.next();
	let nextCharacter = characters.next();
	let rawCharacterIndex = 0;
	while (!currentCharacter.done) {
		const character = currentCharacter.value;
		const characterLength = fastStringWidth$1(character);
		if (visible + characterLength <= columns) rows[rows.length - 1] += character;
		else {
			rows.push(character);
			visible = 0;
		}
		if (character === ESC || character === CSI) {
			isInsideEscape = true;
			isInsideLinkEscape = word.startsWith(ANSI_ESCAPE_LINK, rawCharacterIndex + 1);
		}
		if (isInsideEscape) {
			if (isInsideLinkEscape) {
				if (character === ANSI_ESCAPE_BELL) {
					isInsideEscape = false;
					isInsideLinkEscape = false;
				}
			} else if (character === ANSI_SGR_TERMINATOR) isInsideEscape = false;
		} else {
			visible += characterLength;
			if (visible === columns && !nextCharacter.done) {
				rows.push("");
				visible = 0;
			}
		}
		currentCharacter = nextCharacter;
		nextCharacter = characters.next();
		rawCharacterIndex += character.length;
	}
	lastRow = rows.at(-1);
	if (!visible && lastRow !== void 0 && lastRow.length && rows.length > 1) rows[rows.length - 2] += rows.pop();
};
const stringVisibleTrimSpacesRight = (string) => {
	const words = string.split(" ");
	let last = words.length;
	while (last) {
		if (fastStringWidth$1(words[last - 1])) break;
		last--;
	}
	if (last === words.length) return string;
	return words.slice(0, last).join(" ") + words.slice(last).join("");
};
const exec = (string, columns, options = {}) => {
	if (options.trim !== false && string.trim() === "") return "";
	let returnValue = "";
	let escapeCode;
	let escapeUrl;
	const words = string.split(" ");
	let rows = [""];
	let rowLength = 0;
	for (let index = 0; index < words.length; index++) {
		const word = words[index];
		if (options.trim !== false) {
			const row = rows.at(-1) ?? "";
			const trimmed = row.trimStart();
			if (row.length !== trimmed.length) {
				rows[rows.length - 1] = trimmed;
				rowLength = fastStringWidth$1(trimmed);
			}
		}
		if (index !== 0) {
			if (rowLength >= columns && (options.wordWrap === false || options.trim === false)) {
				rows.push("");
				rowLength = 0;
			}
			if (rowLength || options.trim === false) {
				rows[rows.length - 1] += " ";
				rowLength++;
			}
		}
		const wordLength = fastStringWidth$1(word);
		if (options.hard && wordLength > columns) {
			const remainingColumns = columns - rowLength;
			const breaksStartingThisLine = 1 + Math.floor((wordLength - remainingColumns - 1) / columns);
			if (Math.floor((wordLength - 1) / columns) < breaksStartingThisLine) rows.push("");
			wrapWord(rows, word, columns);
			rowLength = fastStringWidth$1(rows.at(-1) ?? "");
			continue;
		}
		if (rowLength + wordLength > columns && rowLength && wordLength) {
			if (options.wordWrap === false && rowLength < columns) {
				wrapWord(rows, word, columns);
				rowLength = fastStringWidth$1(rows.at(-1) ?? "");
				continue;
			}
			rows.push("");
			rowLength = 0;
		}
		if (rowLength + wordLength > columns && options.wordWrap === false) {
			wrapWord(rows, word, columns);
			rowLength = fastStringWidth$1(rows.at(-1) ?? "");
			continue;
		}
		rows[rows.length - 1] += word;
		rowLength += wordLength;
	}
	if (options.trim !== false) rows = rows.map((row) => stringVisibleTrimSpacesRight(row));
	const preString = rows.join("\n");
	let inSurrogate = false;
	for (let i = 0; i < preString.length; i++) {
		const character = preString[i];
		returnValue += character;
		if (!inSurrogate) {
			inSurrogate = character >= "\ud800" && character <= "\udbff";
			if (inSurrogate) continue;
		} else inSurrogate = false;
		if (character === ESC || character === CSI) {
			GROUP_REGEX.lastIndex = i + 1;
			const groups = GROUP_REGEX.exec(preString)?.groups;
			if (groups?.code !== void 0) {
				const code = Number.parseFloat(groups.code);
				escapeCode = code === END_CODE ? void 0 : code;
			} else if (groups?.uri !== void 0) escapeUrl = groups.uri.length === 0 ? void 0 : groups.uri;
		}
		if (preString[i + 1] === "\n") {
			if (escapeUrl) returnValue += wrapAnsiHyperlink("");
			const closingCode = escapeCode ? getClosingCode(escapeCode) : void 0;
			if (escapeCode && closingCode) returnValue += wrapAnsiCode(closingCode);
		} else if (character === "\n") {
			if (escapeCode && getClosingCode(escapeCode)) returnValue += wrapAnsiCode(escapeCode);
			if (escapeUrl) returnValue += wrapAnsiHyperlink(escapeUrl);
		}
	}
	return returnValue;
};
const CRLF_OR_LF = /\r?\n/;
function wrapAnsi(string, columns, options) {
	return String(string).normalize().split(CRLF_OR_LF).map((line) => exec(line, columns, options)).join("\n");
}
const trimLines = (groups, initialLineCount, startIndex, endIndex, maxLines) => {
	let lineCount = initialLineCount;
	let removals = 0;
	for (let i = startIndex; i < endIndex; i++) {
		const group = groups[i];
		lineCount = lineCount - group.length;
		removals++;
		if (lineCount <= maxLines) break;
	}
	return {
		lineCount,
		removals
	};
};
const limitOptions = (params) => {
	const { cursor, options, style } = params;
	const output = params.output ?? process.stdout;
	const columns = getColumns(output);
	const columnPadding = params.columnPadding ?? 0;
	const rowPadding = params.rowPadding ?? 4;
	const maxWidth = columns - columnPadding;
	const rows = getRows(output);
	const overflowFormat = import_picocolors.default.dim("...");
	const paramMaxItems = params.maxItems ?? Number.POSITIVE_INFINITY;
	const outputMaxItems = Math.max(rows - rowPadding, 0);
	const maxItems = Math.max(Math.min(paramMaxItems, outputMaxItems), 5);
	let slidingWindowLocation = 0;
	if (cursor >= maxItems - 3) slidingWindowLocation = Math.max(Math.min(cursor - maxItems + 3, options.length - maxItems), 0);
	let shouldRenderTopEllipsis = maxItems < options.length && slidingWindowLocation > 0;
	let shouldRenderBottomEllipsis = maxItems < options.length && slidingWindowLocation + maxItems < options.length;
	const slidingWindowLocationEnd = Math.min(slidingWindowLocation + maxItems, options.length);
	const lineGroups = [];
	let lineCount = 0;
	if (shouldRenderTopEllipsis) lineCount++;
	if (shouldRenderBottomEllipsis) lineCount++;
	const slidingWindowLocationWithEllipsis = slidingWindowLocation + (shouldRenderTopEllipsis ? 1 : 0);
	const slidingWindowLocationEndWithEllipsis = slidingWindowLocationEnd - (shouldRenderBottomEllipsis ? 1 : 0);
	for (let i = slidingWindowLocationWithEllipsis; i < slidingWindowLocationEndWithEllipsis; i++) {
		const wrappedLines = wrapAnsi(style(options[i], i === cursor), maxWidth, {
			hard: true,
			trim: false
		}).split("\n");
		lineGroups.push(wrappedLines);
		lineCount += wrappedLines.length;
	}
	if (lineCount > outputMaxItems) {
		let precedingRemovals = 0;
		let followingRemovals = 0;
		let newLineCount = lineCount;
		const cursorGroupIndex = cursor - slidingWindowLocationWithEllipsis;
		const trimLinesLocal = (startIndex, endIndex) => trimLines(lineGroups, newLineCount, startIndex, endIndex, outputMaxItems);
		if (shouldRenderTopEllipsis) {
			({lineCount: newLineCount, removals: precedingRemovals} = trimLinesLocal(0, cursorGroupIndex));
			if (newLineCount > outputMaxItems) ({lineCount: newLineCount, removals: followingRemovals} = trimLinesLocal(cursorGroupIndex + 1, lineGroups.length));
		} else {
			({lineCount: newLineCount, removals: followingRemovals} = trimLinesLocal(cursorGroupIndex + 1, lineGroups.length));
			if (newLineCount > outputMaxItems) ({lineCount: newLineCount, removals: precedingRemovals} = trimLinesLocal(0, cursorGroupIndex));
		}
		if (precedingRemovals > 0) {
			shouldRenderTopEllipsis = true;
			lineGroups.splice(0, precedingRemovals);
		}
		if (followingRemovals > 0) {
			shouldRenderBottomEllipsis = true;
			lineGroups.splice(lineGroups.length - followingRemovals, followingRemovals);
		}
	}
	const result = [];
	if (shouldRenderTopEllipsis) result.push(overflowFormat);
	for (const lineGroup of lineGroups) for (const line of lineGroup) result.push(line);
	if (shouldRenderBottomEllipsis) result.push(overflowFormat);
	return result;
};
/**
* Render-milestone markers for the PTY snapshot suite
* (crates/vp_cli_snapshots): invisible window-title updates the runner
* synchronizes on via `expect-milestone` interactions. Emission is gated on
* `VP_EMIT_MILESTONES=1`, which only the runner sets; real terminals and
* piped output never see these markers as content (they only update the
* window title, which the runner's PTY captures).
*
* Protocol (shared with vite-task's `pty_terminal_test_client` crate):
* `OSC 2 ; pty-terminal-test:<32-hex-id>:<base64url(name)> ST`. The runner
* decodes the title with `decode_milestone_title`, ignoring ordinary title
* updates. A fresh random id per emission keeps repeated milestones with the
* same name observable as distinct title changes through Windows ConPTY.
*/
const MILESTONE_TITLE_MARKER = "pty-terminal-test:";
const OSC2_OPEN = "\x1B]2;";
const ST = "\x1B\\";
const MILESTONES_ENABLED = process.env.VP_EMIT_MILESTONES === "1";
/**
* Returns the encoded milestone byte sequence for `name`, or an empty string
* when emission is disabled. Append the result to a rendered prompt frame so
* the marker arrives in the output stream together with the render it marks.
*/
function milestone(name) {
	if (!MILESTONES_ENABLED) return "";
	const id = randomBytes(16).toString("hex");
	const encodedName = Buffer.from(name, "utf8").toString("base64url");
	return `${OSC2_OPEN}${MILESTONE_TITLE_MARKER}${id}:${encodedName}${ST}`;
}
/**
* Milestone for a prompt render, following the runner naming convention
* `<kind>:<id>:<state>` (e.g. `select:template:1`, `confirm:approve:yes`,
* `text:project-name:my-app`). `id` defaults to the prompt kind; pass
* `testId` at ambiguous call sites (multiple prompts of one kind in a flow).
*/
function promptMilestone(kind, id, state) {
	return milestone(`${kind}:${id ?? kind}:${state}`);
}
const confirm = (opts) => {
	const active = opts.active ?? "Yes";
	const inactive = opts.inactive ?? "No";
	return new r({
		active,
		inactive,
		signal: opts.signal,
		input: opts.input,
		output: opts.output,
		initialValue: opts.initialValue ?? true,
		render() {
			const hasGuide = opts.withGuide ?? false;
			const nestedPrefix = "  ";
			const title = `${hasGuide ? `${import_picocolors.default.gray(S_BAR)}\n` : ""}${symbol(this.state)} ${opts.message}\n`;
			const value = this.value ? active : inactive;
			switch (this.state) {
				case "submit": return `${title}${hasGuide ? `${import_picocolors.default.gray(S_BAR)} ` : nestedPrefix}${import_picocolors.default.dim(value)}\n${promptMilestone("confirm", opts.testId, "submit")}`;
				case "cancel": return `${title}${hasGuide ? `${import_picocolors.default.gray(S_BAR)} ` : nestedPrefix}${import_picocolors.default.strikethrough(import_picocolors.default.dim(value))}${hasGuide ? `\n${import_picocolors.default.gray(S_BAR)}` : ""}\n${promptMilestone("confirm", opts.testId, "cancel")}`;
				default: {
					const defaultPrefix = hasGuide ? `${import_picocolors.default.blue(S_BAR)} ` : nestedPrefix;
					const defaultPrefixEnd = hasGuide ? import_picocolors.default.blue(S_BAR_END) : "";
					return `${title}${defaultPrefix}${this.value ? `${import_picocolors.default.blue(S_POINTER_ACTIVE)} ${import_picocolors.default.bold(active)}` : `${import_picocolors.default.dim(" ")} ${import_picocolors.default.dim(active)}`}${opts.vertical ? hasGuide ? `\n${import_picocolors.default.blue(S_BAR)} ` : `\n${nestedPrefix}` : ` ${import_picocolors.default.dim("/")} `}${!this.value ? `${import_picocolors.default.blue(S_POINTER_ACTIVE)} ${import_picocolors.default.bold(inactive)}` : `${import_picocolors.default.dim(" ")} ${import_picocolors.default.dim(inactive)}`}\n${defaultPrefixEnd}\n${promptMilestone("confirm", opts.testId, this.value ? "yes" : "no")}`;
				}
			}
		}
	}).prompt();
};
const log = {
	message: (message = [], { symbol = import_picocolors.default.gray(S_BAR), secondarySymbol = import_picocolors.default.gray(S_BAR), output = process.stdout, spacing = 1, withGuide } = {}) => {
		const parts = [];
		const hasGuide = withGuide ?? false;
		const spacingString = !hasGuide ? "" : secondarySymbol;
		const prefix = !hasGuide ? "" : `${symbol}  `;
		const secondaryPrefix = !hasGuide ? "" : `${secondarySymbol}  `;
		for (let i = 0; i < spacing; i++) parts.push(spacingString);
		const messageParts = Array.isArray(message) ? message : message.split("\n");
		if (messageParts.length > 0) {
			const [firstLine, ...lines] = messageParts;
			if (firstLine.length > 0) parts.push(`${prefix}${firstLine}`);
			else parts.push(hasGuide ? symbol : "");
			for (const ln of lines) if (ln.length > 0) parts.push(`${secondaryPrefix}${ln}`);
			else parts.push(hasGuide ? secondarySymbol : "");
		}
		output.write(`${parts.join("\n")}\n`);
	},
	info: (message, opts) => {
		log.message(message, {
			...opts,
			symbol: import_picocolors.default.blue(S_INFO)
		});
	},
	success: (message, opts) => {
		log.message(message, {
			...opts,
			symbol: completeColor(S_SUCCESS)
		});
	},
	step: (message, opts) => {
		log.message(message, {
			...opts,
			symbol: completeColor(S_STEP_SUBMIT)
		});
	},
	warn: (message, opts) => {
		log.message(message, {
			...opts,
			symbol: import_picocolors.default.yellow(S_WARN)
		});
	},
	/** alias for `log.warn()`. */
	warning: (message, opts) => {
		log.warn(message, opts);
	},
	error: (message, opts) => {
		log.message(message, {
			...opts,
			symbol: import_picocolors.default.red(S_ERROR)
		});
	}
};
const cancel = (message = "", opts) => {
	(opts?.output ?? process.stdout).write(`${import_picocolors.default.red(message)}\n\n`);
};
const intro = (title = "", opts) => {
	(opts?.output ?? process.stdout).write(`${title}\n\n`);
};
const outro = (message = "", opts) => {
	(opts?.output ?? process.stdout).write(`${message}\n\n`);
};
const computeLabel$1 = (label, format) => {
	return label.split("\n").map((line) => format(line)).join("\n");
};
const withMarkerAndCheckbox = (marker, checkbox, checkboxWidth, label, format, firstLineSuffix = "") => {
	const lines = label.split("\n");
	const continuationPrefix = `  ${" ".repeat(checkboxWidth)} `;
	if (lines.length === 1) return `${marker} ${checkbox} ${format(lines[0])}${firstLineSuffix}`;
	const [firstLine, ...rest] = lines;
	return [`${marker} ${checkbox} ${format(firstLine)}${firstLineSuffix}`, ...rest.map((line) => `${continuationPrefix}${format(line)}`)].join("\n");
};
const multiselect = (opts) => {
	const opt = (option, state) => {
		const label = option.label ?? String(option.value);
		const hint = option.hint ? ` ${import_picocolors.default.gray(`(${option.hint})`)}` : "";
		if (state === "disabled") return withMarkerAndCheckbox(import_picocolors.default.gray(" "), import_picocolors.default.gray(S_CHECKBOX_INACTIVE), S_CHECKBOX_INACTIVE.length, label, (str) => import_picocolors.default.strikethrough(import_picocolors.default.gray(str)), option.hint ? ` ${import_picocolors.default.dim(`(${option.hint ?? "disabled"})`)}` : "");
		if (state === "active") return withMarkerAndCheckbox(import_picocolors.default.blue(S_POINTER_ACTIVE), import_picocolors.default.blue(S_CHECKBOX_ACTIVE), S_CHECKBOX_ACTIVE.length, label, (text) => import_picocolors.default.blue(import_picocolors.default.bold(text)), hint);
		if (state === "selected") return withMarkerAndCheckbox(import_picocolors.default.dim(" "), import_picocolors.default.blue(S_CHECKBOX_SELECTED), S_CHECKBOX_SELECTED.length, label, import_picocolors.default.dim, hint);
		if (state === "cancelled") return computeLabel$1(label, (text) => import_picocolors.default.strikethrough(import_picocolors.default.dim(text)));
		if (state === "active-selected") return withMarkerAndCheckbox(import_picocolors.default.blue(S_POINTER_ACTIVE), import_picocolors.default.blue(S_CHECKBOX_SELECTED), S_CHECKBOX_SELECTED.length, label, (text) => import_picocolors.default.blue(import_picocolors.default.bold(text)), hint);
		if (state === "submitted") return computeLabel$1(label, import_picocolors.default.dim);
		return withMarkerAndCheckbox(import_picocolors.default.dim(" "), import_picocolors.default.dim(S_CHECKBOX_INACTIVE), S_CHECKBOX_INACTIVE.length, label, import_picocolors.default.dim);
	};
	const required = opts.required ?? true;
	const hint = "  " + import_picocolors.default.reset(import_picocolors.default.dim(`Press ${import_picocolors.default.gray(import_picocolors.default.bgWhite(import_picocolors.default.inverse(" space ")))} to select, ${import_picocolors.default.gray(import_picocolors.default.bgWhite(import_picocolors.default.inverse(" enter ")))} to submit`));
	return new a({
		options: opts.options,
		signal: opts.signal,
		input: opts.input,
		output: opts.output,
		initialValues: opts.initialValues,
		required,
		cursorAt: opts.cursorAt,
		validate(selected) {
			if (required && (selected === void 0 || selected.length === 0)) return `Please select at least one option.\n${hint}`;
		},
		render() {
			const hasGuide = opts.withGuide ?? false;
			const nestedPrefix = "  ";
			const formatMessageLines = (message) => {
				return message.split("\n").map((line, index) => `${index === 0 ? `${symbol(this.state)} ` : nestedPrefix}${line}`).join("\n");
			};
			const wrappedMessage = hasGuide ? wrapTextWithPrefix(opts.output, opts.message, `${symbolBar(this.state)} `, `${symbol(this.state)} `) : formatMessageLines(opts.message);
			const title = `${hasGuide ? `${import_picocolors.default.gray(S_BAR)}\n` : ""}${wrappedMessage}\n`;
			const value = this.value ?? [];
			const styleOption = (option, active) => {
				if (option.disabled) return opt(option, "disabled");
				const selected = value.includes(option.value);
				if (active && selected) return opt(option, "active-selected");
				if (selected) return opt(option, "selected");
				return opt(option, active ? "active" : "inactive");
			};
			switch (this.state) {
				case "submit": {
					const submitText = this.options.filter(({ value: optionValue }) => value.includes(optionValue)).map((option) => opt(option, "submitted")).join(import_picocolors.default.dim(", ")) || import_picocolors.default.dim("none");
					const submitPrefix = hasGuide ? `${import_picocolors.default.gray(S_BAR)} ` : nestedPrefix;
					return `${title}${wrapTextWithPrefix(opts.output, submitText, submitPrefix)}\n`;
				}
				case "cancel": {
					const label = this.options.filter(({ value: optionValue }) => value.includes(optionValue)).map((option) => opt(option, "cancelled")).join(import_picocolors.default.dim(", "));
					if (label.trim() === "") return hasGuide ? `${title}${import_picocolors.default.gray(S_BAR)}\n` : `${title.trimEnd()}\n`;
					const cancelPrefix = hasGuide ? `${import_picocolors.default.gray(S_BAR)} ` : nestedPrefix;
					const wrappedLabel = wrapTextWithPrefix(opts.output, label, cancelPrefix);
					return hasGuide ? `${title}${wrappedLabel}\n${import_picocolors.default.gray(S_BAR)}\n` : `${title}${wrappedLabel}\n`;
				}
				case "error": {
					const prefix = hasGuide ? `${import_picocolors.default.yellow(S_BAR)} ` : nestedPrefix;
					const footer = hasGuide ? this.error.split("\n").map((ln, i) => i === 0 ? `${import_picocolors.default.yellow(S_BAR_END)} ${import_picocolors.default.yellow(ln)}` : `  ${ln}`).join("\n") : `${nestedPrefix}${import_picocolors.default.yellow(this.error)}`;
					const titleLineCount = title.split("\n").length;
					const footerLineCount = footer.split("\n").length + 1;
					return `${title}${prefix}${limitOptions({
						output: opts.output,
						options: this.options,
						cursor: this.cursor,
						maxItems: opts.maxItems,
						columnPadding: prefix.length,
						rowPadding: titleLineCount + footerLineCount,
						style: styleOption
					}).join(`\n${prefix}`)}\n${hint}\n${footer}\n`;
				}
				default: {
					const prefix = hasGuide ? `${import_picocolors.default.blue(S_BAR)} ` : nestedPrefix;
					const titleLineCount = title.split("\n").length;
					const footerLineCount = hasGuide ? 2 : 1;
					return `${title}${prefix}${limitOptions({
						output: opts.output,
						options: this.options,
						cursor: this.cursor,
						maxItems: opts.maxItems,
						columnPadding: prefix.length,
						rowPadding: titleLineCount + footerLineCount,
						style: styleOption
					}).join(`\n${prefix}`)}\n${hint}\n${hasGuide ? import_picocolors.default.blue(S_BAR_END) : ""}\n`;
				}
			}
		}
	}).prompt();
};
const defaultStyleFn = import_picocolors.default.magenta;
const removeTrailingDots = (msg) => {
	return msg.replace(/\.+$/, "");
};
const formatTimer = (durationMs) => {
	const duration = durationMs / 1e3;
	const min = Math.floor(duration / 60);
	const secs = Math.floor(duration % 60);
	return import_picocolors.default.gray(min > 0 ? `(${min}m ${secs}s)` : `(${secs}s)`);
};
const spinner = ({ indicator = "dots", onCancel, output = process.stdout, cancelMessage, errorMessage, frames = unicode ? [
	"◒",
	"◐",
	"◓",
	"◑"
] : [
	"•",
	"o",
	"O",
	"0"
], delay = unicode ? 80 : 120, signal, ...opts } = {}) => {
	const isCI$1 = isCI();
	let unblock;
	let loop;
	let isSpinnerActive = false;
	let isCancelled = false;
	let _message = "";
	let _prevMessage;
	let _origin = performance.now();
	let _elapsedMs = 0;
	const columns = getColumns(output);
	const styleFn = opts?.styleFrame ?? defaultStyleFn;
	const getElapsedMs = () => {
		if (!isSpinnerActive) return _elapsedMs;
		return _elapsedMs + (performance.now() - _origin);
	};
	const handleExit = (code) => {
		const msg = code > 1 ? errorMessage ?? settings.messages.error : cancelMessage ?? settings.messages.cancel;
		isCancelled = code === 1;
		if (isSpinnerActive) {
			_stop(msg, code);
			if (isCancelled && typeof onCancel === "function") onCancel();
		}
	};
	const errorEventHandler = () => handleExit(2);
	const signalEventHandler = () => handleExit(1);
	const registerHooks = () => {
		process.on("uncaughtExceptionMonitor", errorEventHandler);
		process.on("unhandledRejection", errorEventHandler);
		process.on("SIGINT", signalEventHandler);
		process.on("SIGTERM", signalEventHandler);
		process.on("exit", handleExit);
		if (signal) signal.addEventListener("abort", signalEventHandler);
	};
	const clearHooks = () => {
		process.removeListener("uncaughtExceptionMonitor", errorEventHandler);
		process.removeListener("unhandledRejection", errorEventHandler);
		process.removeListener("SIGINT", signalEventHandler);
		process.removeListener("SIGTERM", signalEventHandler);
		process.removeListener("exit", handleExit);
		if (signal) signal.removeEventListener("abort", signalEventHandler);
	};
	const clearPrevMessage = () => {
		if (_prevMessage === void 0) return;
		if (isCI$1) output.write("\n");
		const prevLines = wrapAnsi(_prevMessage, columns, {
			hard: true,
			trim: false
		}).split("\n");
		if (prevLines.length > 1) output.write(import_src.cursor.up(prevLines.length - 1));
		output.write(import_src.cursor.to(0));
		output.write(import_src.erase.down());
	};
	const hasGuide = opts.withGuide ?? false;
	const startLoop = () => {
		isSpinnerActive = true;
		unblock = block({ output });
		_origin = performance.now();
		_prevMessage = void 0;
		if (hasGuide) output.write(`${import_picocolors.default.gray(S_BAR)}\n`);
		let frameIndex = 0;
		let indicatorTimer = 0;
		registerHooks();
		const renderFrame = () => {
			if (isCI$1 && _message === _prevMessage) return;
			clearPrevMessage();
			_prevMessage = _message;
			const frame = styleFn(frames[frameIndex]);
			let outputMessage;
			if (isCI$1) outputMessage = `${frame}  ${_message}...`;
			else if (indicator === "timer") outputMessage = `${frame}  ${_message} ${formatTimer(getElapsedMs())}`;
			else {
				const loadingDots = ".".repeat(Math.floor(indicatorTimer)).slice(0, 3);
				outputMessage = `${frame}  ${_message}${loadingDots}`;
			}
			const wrapped = wrapAnsi(outputMessage, columns, {
				hard: true,
				trim: false
			});
			output.write(wrapped);
			frameIndex = frameIndex + 1 < frames.length ? frameIndex + 1 : 0;
			indicatorTimer = indicatorTimer < 4 ? indicatorTimer + .125 : 0;
		};
		renderFrame();
		loop = setInterval(renderFrame, delay);
	};
	const start = (msg = "") => {
		_elapsedMs = 0;
		_message = removeTrailingDots(msg);
		startLoop();
	};
	const _stop = (msg = "", code = 0, silent = false, preserveElapsed = false) => {
		if (!isSpinnerActive) return;
		isSpinnerActive = false;
		clearInterval(loop);
		clearPrevMessage();
		const elapsedMs = getElapsedMs();
		const step = code === 0 ? completeColor(S_STEP_SUBMIT) : code === 1 ? import_picocolors.default.red(S_STEP_CANCEL) : import_picocolors.default.red(S_STEP_ERROR);
		_message = msg ?? _message;
		if (!silent) {
			if (indicator === "timer") output.write(`${step} ${_message} ${formatTimer(elapsedMs)}\n\n`);
			else output.write(`${step} ${_message}\n\n`);
		}
		if (!preserveElapsed) _elapsedMs = 0;
		_prevMessage = void 0;
		clearHooks();
		unblock();
	};
	const pause = () => {
		if (!isSpinnerActive) return;
		_elapsedMs = getElapsedMs();
		_stop(_message, 0, true, true);
	};
	const resume = (msg = _message) => {
		if (isSpinnerActive) return;
		_message = removeTrailingDots(msg);
		startLoop();
	};
	const stop = (msg = "") => _stop(msg, 0);
	const cancel = (msg = "") => _stop(msg, 1);
	const error = (msg = "") => _stop(msg, 2);
	const clear = () => _stop("", 0, true);
	const message = (msg = "") => {
		_message = removeTrailingDots(msg ?? _message);
	};
	return {
		start,
		pause,
		resume,
		stop,
		message,
		cancel,
		error,
		clear,
		get isCancelled() {
			return isCancelled;
		}
	};
};
const computeLabel = (label, format) => {
	if (!label.includes("\n")) return format(label);
	return label.split("\n").map((line) => format(line)).join("\n");
};
const withMarker = (marker, label, format, firstLineSuffix = "") => {
	const lines = label.split("\n");
	if (lines.length === 1) return `${marker} ${format(lines[0])}${firstLineSuffix}`;
	const [firstLine, ...rest] = lines;
	return [`${marker} ${format(firstLine)}${firstLineSuffix}`, ...rest.map((line) => `  ${format(line)}`)].join("\n");
};
const select = (opts) => {
	const opt = (option, state) => {
		const label = option.label ?? String(option.value);
		const hint = option.hint ? `: ${import_picocolors.default.gray(option.hint)}` : "";
		switch (state) {
			case "disabled": return withMarker(import_picocolors.default.gray(" "), label, (text) => import_picocolors.default.strikethrough(import_picocolors.default.gray(text)), option.hint ? `: ${import_picocolors.default.gray(option.hint ?? "disabled")}` : "");
			case "selected": return computeLabel(label, import_picocolors.default.dim);
			case "active": return withMarker(import_picocolors.default.blue(S_POINTER_ACTIVE), label, (text) => import_picocolors.default.blue(import_picocolors.default.bold(text)), hint);
			case "cancelled": return computeLabel(label, (str) => import_picocolors.default.strikethrough(import_picocolors.default.dim(str)));
			default: return withMarker(import_picocolors.default.dim(" "), label, (text) => text, hint);
		}
	};
	return new n$1({
		options: opts.options,
		signal: opts.signal,
		input: opts.input,
		output: opts.output,
		initialValue: opts.initialValue,
		render() {
			const hasGuide = opts.withGuide ?? false;
			const nestedPrefix = "  ";
			const formatMessageLines = (message) => {
				return message.split("\n").map((line, index) => `${index === 0 ? `${symbol(this.state)} ` : nestedPrefix}${line}`).join("\n");
			};
			const hasMessage = opts.message.trim().length > 0;
			const messageLines = !hasMessage ? "" : hasGuide ? wrapTextWithPrefix(opts.output, opts.message, `${symbolBar(this.state)} `, `${symbol(this.state)} `) : formatMessageLines(opts.message);
			const title = hasMessage ? `${hasGuide ? `${import_picocolors.default.gray(S_BAR)}\n` : ""}${messageLines}\n` : "";
			switch (this.state) {
				case "submit": {
					const submitPrefix = hasGuide ? `${import_picocolors.default.gray(S_BAR)} ` : nestedPrefix;
					return `${title}${wrapTextWithPrefix(opts.output, opt(this.options[this.cursor], "selected"), submitPrefix)}\n${promptMilestone("select", opts.testId, "submit")}`;
				}
				case "cancel": {
					const cancelPrefix = hasGuide ? `${import_picocolors.default.gray(S_BAR)} ` : nestedPrefix;
					return `${title}${wrapTextWithPrefix(opts.output, opt(this.options[this.cursor], "cancelled"), cancelPrefix)}${hasGuide ? `\n${import_picocolors.default.gray(S_BAR)}` : ""}\n${promptMilestone("select", opts.testId, "cancel")}`;
				}
				default: {
					const prefix = hasGuide ? `${import_picocolors.default.blue(S_BAR)} ` : nestedPrefix;
					const prefixEnd = hasGuide ? import_picocolors.default.blue(S_BAR_END) : "";
					const titleLineCount = title ? title.split("\n").length : 0;
					const footerLineCount = hasGuide ? 2 : 1;
					return `${title}${prefix}${limitOptions({
						output: opts.output,
						cursor: this.cursor,
						options: this.options,
						maxItems: opts.maxItems,
						columnPadding: prefix.length,
						rowPadding: titleLineCount + footerLineCount,
						style: (item, active) => opt(item, item.disabled ? "disabled" : active ? "active" : "inactive")
					}).join(`\n${prefix}`)}\n${prefixEnd}\n${promptMilestone("select", opts.testId, String(this.cursor))}`;
				}
			}
		}
	}).prompt();
};
const text = (opts) => {
	return new n({
		validate: opts.validate,
		placeholder: opts.placeholder,
		defaultValue: opts.defaultValue,
		initialValue: opts.initialValue,
		output: opts.output,
		signal: opts.signal,
		input: opts.input,
		render() {
			const hasGuide = opts?.withGuide ?? false;
			const nestedPrefix = "  ";
			const title = `${hasGuide ? `${import_picocolors.default.gray(S_BAR)}\n` : ""}${symbol(this.state)} ${opts.message}\n`;
			const placeholder = opts.placeholder ? import_picocolors.default.inverse(opts.placeholder[0]) + import_picocolors.default.dim(opts.placeholder.slice(1)) : import_picocolors.default.inverse(import_picocolors.default.hidden("_"));
			const userInput = !this.userInput ? placeholder : this.userInputWithCursor;
			const value = this.value ?? "";
			switch (this.state) {
				case "error": {
					const errorText = this.error ? ` ${import_picocolors.default.yellow(this.error)}` : "";
					const errorPrefix = hasGuide ? `${import_picocolors.default.yellow(S_BAR)} ` : nestedPrefix;
					const errorPrefixEnd = hasGuide ? import_picocolors.default.yellow(S_BAR_END) : "";
					return `${title.trim()}\n${errorPrefix}${userInput}\n${errorPrefixEnd}${errorText}\n${promptMilestone("text", opts.testId, "error")}`;
				}
				case "submit": {
					const valueText = value ? import_picocolors.default.dim(value) : "";
					return `${title}${hasGuide ? `${import_picocolors.default.gray(S_BAR)} ` : nestedPrefix}${valueText}\n${promptMilestone("text", opts.testId, "submit")}`;
				}
				case "cancel": {
					const valueText = value ? import_picocolors.default.strikethrough(import_picocolors.default.dim(value)) : "";
					const cancelPrefix = hasGuide ? `${import_picocolors.default.gray(S_BAR)} ` : nestedPrefix;
					return `${title}${cancelPrefix}${valueText}${value.trim() ? `\n${cancelPrefix}` : ""}\n${promptMilestone("text", opts.testId, "cancel")}`;
				}
				default: return `${title}${hasGuide ? `${import_picocolors.default.blue(S_BAR)} ` : nestedPrefix}${userInput}\n${hasGuide ? import_picocolors.default.blue(S_BAR_END) : ""}\n${promptMilestone("text", opts.testId, this.value ?? "")}`;
			}
		}
	}).prompt();
};
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/internal/constants.js
var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		MAX_LENGTH: 256,
		MAX_SAFE_COMPONENT_LENGTH: 16,
		MAX_SAFE_BUILD_LENGTH: 250,
		MAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER || 
		/* istanbul ignore next */ 9007199254740991,
		RELEASE_TYPES: [
			"major",
			"premajor",
			"minor",
			"preminor",
			"patch",
			"prepatch",
			"prerelease"
		],
		SEMVER_SPEC_VERSION: "2.0.0",
		FLAG_INCLUDE_PRERELEASE: 1,
		FLAG_LOOSE: 2
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/internal/debug.js
var require_debug = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/internal/re.js
var require_re = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { MAX_SAFE_COMPONENT_LENGTH, MAX_SAFE_BUILD_LENGTH, MAX_LENGTH } = require_constants();
	const debug = require_debug();
	exports = module.exports = {};
	const re = exports.re = [];
	const safeRe = exports.safeRe = [];
	const src = exports.src = [];
	const safeSrc = exports.safeSrc = [];
	const t = exports.t = {};
	let R = 0;
	const LETTERDASHNUMBER = "[a-zA-Z0-9-]";
	const safeRegexReplacements = [
		["\\s", 1],
		["\\d", MAX_LENGTH],
		[LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
	];
	const makeSafeRegex = (value) => {
		for (const [token, max] of safeRegexReplacements) value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
		return value;
	};
	const createToken = (name, value, isGlobal) => {
		const safe = makeSafeRegex(value);
		const index = R++;
		debug(name, index, value);
		t[name] = index;
		src[index] = value;
		safeSrc[index] = safe;
		re[index] = new RegExp(value, isGlobal ? "g" : void 0);
		safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
	};
	createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
	createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
	createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
	createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
	createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
	createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
	createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
	createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
	createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
	createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
	createToken("FULL", `^${src[t.FULLPLAIN]}$`);
	createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
	createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
	createToken("GTLT", "((?:<|>)?=?)");
	createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
	createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
	createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
	createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COERCEPLAIN", `(^|[^\\d])(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
	createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
	createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
	createToken("COERCERTL", src[t.COERCE], true);
	createToken("COERCERTLFULL", src[t.COERCEFULL], true);
	createToken("LONETILDE", "(?:~>?)");
	createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
	exports.tildeTrimReplace = "$1~";
	createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
	createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("LONECARET", "(?:\\^)");
	createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
	exports.caretTrimReplace = "$1^";
	createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
	createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
	createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
	createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
	exports.comparatorTrimReplace = "$1$2$3";
	createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
	createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
	createToken("STAR", "(<|>)?=?\\s*\\*");
	createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
	createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/internal/parse-options.js
var require_parse_options = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const looseOption = Object.freeze({ loose: true });
	const emptyOpts = Object.freeze({});
	const parseOptions = (options) => {
		if (!options) return emptyOpts;
		if (typeof options !== "object") return looseOption;
		return options;
	};
	module.exports = parseOptions;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/internal/identifiers.js
var require_identifiers = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const numeric = /^[0-9]+$/;
	const compareIdentifiers = (a, b) => {
		if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1;
		const anum = numeric.test(a);
		const bnum = numeric.test(b);
		if (anum && bnum) {
			a = +a;
			b = +b;
		}
		return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
	};
	const rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
	module.exports = {
		compareIdentifiers,
		rcompareIdentifiers
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/classes/semver.js
var require_semver$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const debug = require_debug();
	const { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
	const { safeRe: re, t } = require_re();
	const parseOptions = require_parse_options();
	const { compareIdentifiers } = require_identifiers();
	const isPrereleaseIdentifier = (prerelease, identifier) => {
		const identifiers = identifier.split(".");
		if (identifiers.length > prerelease.length) return false;
		for (let i = 0; i < identifiers.length; i++) if (compareIdentifiers(prerelease[i], identifiers[i]) !== 0) return false;
		return true;
	};
	module.exports = class SemVer {
		constructor(version, options) {
			options = parseOptions(options);
			if (version instanceof SemVer) {
				if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) return version;
				else version = version.version;
			} else if (typeof version !== "string") throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
			if (version.length > MAX_LENGTH) throw new TypeError(`version is longer than ${MAX_LENGTH} characters`);
			debug("SemVer", version, options);
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
			if (!m) throw new TypeError(`Invalid Version: ${version}`);
			this.raw = version;
			this.major = +m[1];
			this.minor = +m[2];
			this.patch = +m[3];
			if (this.major > MAX_SAFE_INTEGER || this.major < 0) throw new TypeError("Invalid major version");
			if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) throw new TypeError("Invalid minor version");
			if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) throw new TypeError("Invalid patch version");
			if (!m[4]) this.prerelease = [];
			else this.prerelease = m[4].split(".").map((id) => {
				if (/^[0-9]+$/.test(id)) {
					const num = +id;
					if (num >= 0 && num < MAX_SAFE_INTEGER) return num;
				}
				return id;
			});
			this.build = m[5] ? m[5].split(".") : [];
			this.format();
		}
		format() {
			this.version = `${this.major}.${this.minor}.${this.patch}`;
			if (this.prerelease.length) this.version += `-${this.prerelease.join(".")}`;
			return this.version;
		}
		toString() {
			return this.version;
		}
		compare(other) {
			debug("SemVer.compare", this.version, this.options, other);
			if (!(other instanceof SemVer)) {
				if (typeof other === "string" && other === this.version) return 0;
				other = new SemVer(other, this.options);
			}
			if (other.version === this.version) return 0;
			return this.compareMain(other) || this.comparePre(other);
		}
		compareMain(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			if (this.major < other.major) return -1;
			if (this.major > other.major) return 1;
			if (this.minor < other.minor) return -1;
			if (this.minor > other.minor) return 1;
			if (this.patch < other.patch) return -1;
			if (this.patch > other.patch) return 1;
			return 0;
		}
		comparePre(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			if (this.prerelease.length && !other.prerelease.length) return -1;
			else if (!this.prerelease.length && other.prerelease.length) return 1;
			else if (!this.prerelease.length && !other.prerelease.length) return 0;
			let i = 0;
			do {
				const a = this.prerelease[i];
				const b = other.prerelease[i];
				debug("prerelease compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		compareBuild(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			let i = 0;
			do {
				const a = this.build[i];
				const b = other.build[i];
				debug("build compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		inc(release, identifier, identifierBase) {
			if (release.startsWith("pre")) {
				if (!identifier && identifierBase === false) throw new Error("invalid increment argument: identifier is empty");
				if (identifier) {
					const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
					if (!match || match[1] !== identifier) throw new Error(`invalid identifier: ${identifier}`);
				}
			}
			switch (release) {
				case "premajor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor = 0;
					this.major++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "preminor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "prepatch":
					this.prerelease.length = 0;
					this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "prerelease":
					if (this.prerelease.length === 0) this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "release":
					if (this.prerelease.length === 0) throw new Error(`version ${this.raw} is not a prerelease`);
					this.prerelease.length = 0;
					break;
				case "major":
					if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) this.major++;
					this.minor = 0;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "minor":
					if (this.patch !== 0 || this.prerelease.length === 0) this.minor++;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "patch":
					if (this.prerelease.length === 0) this.patch++;
					this.prerelease = [];
					break;
				case "pre": {
					const base = Number(identifierBase) ? 1 : 0;
					if (this.prerelease.length === 0) this.prerelease = [base];
					else {
						let i = this.prerelease.length;
						while (--i >= 0) if (typeof this.prerelease[i] === "number") {
							this.prerelease[i]++;
							i = -2;
						}
						if (i === -1) {
							if (identifier === this.prerelease.join(".") && identifierBase === false) throw new Error("invalid increment argument: identifier already exists");
							this.prerelease.push(base);
						}
					}
					if (identifier) {
						let prerelease = [identifier, base];
						if (identifierBase === false) prerelease = [identifier];
						if (isPrereleaseIdentifier(this.prerelease, identifier)) {
							const prereleaseBase = this.prerelease[identifier.split(".").length];
							if (isNaN(prereleaseBase)) this.prerelease = prerelease;
						} else this.prerelease = prerelease;
					}
					break;
				}
				default: throw new Error(`invalid increment argument: ${release}`);
			}
			this.raw = this.format();
			if (this.build.length) this.raw += `+${this.build.join(".")}`;
			return this;
		}
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/parse.js
var require_parse = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const parse = (version, options, throwErrors = false) => {
		if (version instanceof SemVer) return version;
		try {
			return new SemVer(version, options);
		} catch (er) {
			if (!throwErrors) return null;
			throw er;
		}
	};
	module.exports = parse;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/valid.js
var require_valid$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const parse = require_parse();
	const valid = (version, options) => {
		const v = parse(version, options);
		return v ? v.version : null;
	};
	module.exports = valid;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/clean.js
var require_clean = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const parse = require_parse();
	const clean = (version, options) => {
		const s = parse(version.trim().replace(/^[=v]+/, ""), options);
		return s ? s.version : null;
	};
	module.exports = clean;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/inc.js
var require_inc = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const inc = (version, release, options, identifier, identifierBase) => {
		if (typeof options === "string") {
			identifierBase = identifier;
			identifier = options;
			options = void 0;
		}
		try {
			return new SemVer(version instanceof SemVer ? version.version : version, options).inc(release, identifier, identifierBase).version;
		} catch (er) {
			return null;
		}
	};
	module.exports = inc;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/diff.js
var require_diff = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const parse = require_parse();
	const diff = (version1, version2) => {
		const v1 = parse(version1, null, true);
		const v2 = parse(version2, null, true);
		const comparison = v1.compare(v2);
		if (comparison === 0) return null;
		const v1Higher = comparison > 0;
		const highVersion = v1Higher ? v1 : v2;
		const lowVersion = v1Higher ? v2 : v1;
		const highHasPre = !!highVersion.prerelease.length;
		if (!!lowVersion.prerelease.length && !highHasPre) {
			if (!lowVersion.patch && !lowVersion.minor) return "major";
			if (lowVersion.compareMain(highVersion) === 0) {
				if (lowVersion.minor && !lowVersion.patch) return "minor";
				return "patch";
			}
		}
		const prefix = highHasPre ? "pre" : "";
		if (v1.major !== v2.major) return prefix + "major";
		if (v1.minor !== v2.minor) return prefix + "minor";
		if (v1.patch !== v2.patch) return prefix + "patch";
		return "prerelease";
	};
	module.exports = diff;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/major.js
var require_major = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const major = (a, loose) => new SemVer(a, loose).major;
	module.exports = major;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/minor.js
var require_minor = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const minor = (a, loose) => new SemVer(a, loose).minor;
	module.exports = minor;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/patch.js
var require_patch = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const patch = (a, loose) => new SemVer(a, loose).patch;
	module.exports = patch;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/prerelease.js
var require_prerelease = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const parse = require_parse();
	const prerelease = (version, options) => {
		const parsed = parse(version, options);
		return parsed && parsed.prerelease.length ? parsed.prerelease : null;
	};
	module.exports = prerelease;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/compare.js
var require_compare = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
	module.exports = compare;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/rcompare.js
var require_rcompare = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const rcompare = (a, b, loose) => compare(b, a, loose);
	module.exports = rcompare;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/compare-loose.js
var require_compare_loose = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const compareLoose = (a, b) => compare(a, b, true);
	module.exports = compareLoose;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/compare-build.js
var require_compare_build = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const compareBuild = (a, b, loose) => {
		const versionA = new SemVer(a, loose);
		const versionB = new SemVer(b, loose);
		return versionA.compare(versionB) || versionA.compareBuild(versionB);
	};
	module.exports = compareBuild;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/sort.js
var require_sort = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compareBuild = require_compare_build();
	const sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
	module.exports = sort;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/rsort.js
var require_rsort = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compareBuild = require_compare_build();
	const rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
	module.exports = rsort;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/gt.js
var require_gt = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const gt = (a, b, loose) => compare(a, b, loose) > 0;
	module.exports = gt;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/lt.js
var require_lt = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const lt = (a, b, loose) => compare(a, b, loose) < 0;
	module.exports = lt;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/eq.js
var require_eq = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const eq = (a, b, loose) => compare(a, b, loose) === 0;
	module.exports = eq;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/neq.js
var require_neq = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const neq = (a, b, loose) => compare(a, b, loose) !== 0;
	module.exports = neq;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/gte.js
var require_gte = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const gte = (a, b, loose) => compare(a, b, loose) >= 0;
	module.exports = gte;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/lte.js
var require_lte = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const lte = (a, b, loose) => compare(a, b, loose) <= 0;
	module.exports = lte;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/cmp.js
var require_cmp = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const eq = require_eq();
	const neq = require_neq();
	const gt = require_gt();
	const gte = require_gte();
	const lt = require_lt();
	const lte = require_lte();
	const cmp = (a, op, b, loose) => {
		switch (op) {
			case "===":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a === b;
			case "!==":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a !== b;
			case "":
			case "=":
			case "==": return eq(a, b, loose);
			case "!=": return neq(a, b, loose);
			case ">": return gt(a, b, loose);
			case ">=": return gte(a, b, loose);
			case "<": return lt(a, b, loose);
			case "<=": return lte(a, b, loose);
			default: throw new TypeError(`Invalid operator: ${op}`);
		}
	};
	module.exports = cmp;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/coerce.js
var require_coerce = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const parse = require_parse();
	const { safeRe: re, t } = require_re();
	const coerce = (version, options) => {
		if (version instanceof SemVer) return version;
		if (typeof version === "number") version = String(version);
		if (typeof version !== "string") return null;
		options = options || {};
		let match = null;
		if (!options.rtl) match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
		else {
			const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
			let next;
			while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
				if (!match || next.index + next[0].length !== match.index + match[0].length) match = next;
				coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
			}
			coerceRtlRegex.lastIndex = -1;
		}
		if (match === null) return null;
		const major = match[2];
		const minor = match[3] || "0";
		const patch = match[4] || "0";
		const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
		const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
		return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
	};
	module.exports = coerce;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/truncate.js
var require_truncate = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const parse = require_parse();
	const constants = require_constants();
	const SemVer = require_semver$1();
	const truncate = (version, truncation, options) => {
		if (!constants.RELEASE_TYPES.includes(truncation)) return null;
		const clonedVersion = cloneInputVersion(version, options);
		return clonedVersion && doTruncation(clonedVersion, truncation);
	};
	const cloneInputVersion = (version, options) => {
		const versionStringToParse = version instanceof SemVer ? version.version : version;
		return parse(versionStringToParse, options);
	};
	const doTruncation = (version, truncation) => {
		if (isPrerelease(truncation)) return version.version;
		version.prerelease = [];
		switch (truncation) {
			case "major":
				version.minor = 0;
				version.patch = 0;
				break;
			case "minor": version.patch = 0;
		}
		return version.format();
	};
	const isPrerelease = (type) => {
		return type.startsWith("pre");
	};
	module.exports = truncate;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/internal/lrucache.js
var require_lrucache = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var LRUCache = class {
		constructor() {
			this.max = 1e3;
			this.map = /* @__PURE__ */ new Map();
		}
		get(key) {
			const value = this.map.get(key);
			if (value === void 0) return;
			else {
				this.map.delete(key);
				this.map.set(key, value);
				return value;
			}
		}
		delete(key) {
			return this.map.delete(key);
		}
		set(key, value) {
			if (!this.delete(key) && value !== void 0) {
				if (this.map.size >= this.max) {
					const firstKey = this.map.keys().next().value;
					this.delete(firstKey);
				}
				this.map.set(key, value);
			}
			return this;
		}
	};
	module.exports = LRUCache;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/classes/range.js
var require_range = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SPACE_CHARACTERS = /\s+/g;
	module.exports = class Range {
		constructor(range, options) {
			options = parseOptions(options);
			if (range instanceof Range) {
				if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) return range;
				else return new Range(range.raw, options);
			}
			if (range instanceof Comparator) {
				this.raw = range.value;
				this.set = [[range]];
				this.formatted = void 0;
				return this;
			}
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
			this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
			if (!this.set.length) throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
			if (this.set.length > 1) {
				const first = this.set[0];
				this.set = this.set.filter((c) => !isNullSet(c[0]));
				if (this.set.length === 0) this.set = [first];
				else if (this.set.length > 1) {
					for (const c of this.set) if (c.length === 1 && isAny(c[0])) {
						this.set = [c];
						break;
					}
				}
			}
			this.formatted = void 0;
		}
		get range() {
			if (this.formatted === void 0) {
				this.formatted = "";
				for (let i = 0; i < this.set.length; i++) {
					if (i > 0) this.formatted += "||";
					const comps = this.set[i];
					for (let k = 0; k < comps.length; k++) {
						if (k > 0) this.formatted += " ";
						this.formatted += comps[k].toString().trim();
					}
				}
			}
			return this.formatted;
		}
		format() {
			return this.range;
		}
		toString() {
			return this.range;
		}
		parseRange(range) {
			range = range.replace(BUILDSTRIPRE, "");
			const memoKey = ((this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE)) + ":" + range;
			const cached = cache.get(memoKey);
			if (cached) return cached;
			const loose = this.options.loose;
			const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
			range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
			debug("hyphen replace", range);
			range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
			debug("comparator trim", range);
			range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
			debug("tilde trim", range);
			range = range.replace(re[t.CARETTRIM], caretTrimReplace);
			debug("caret trim", range);
			let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
			if (loose) rangeList = rangeList.filter((comp) => {
				debug("loose invalid filter", comp, this.options);
				return !!comp.match(re[t.COMPARATORLOOSE]);
			});
			debug("range list", rangeList);
			const rangeMap = /* @__PURE__ */ new Map();
			const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
			for (const comp of comparators) {
				if (isNullSet(comp)) return [comp];
				rangeMap.set(comp.value, comp);
			}
			if (rangeMap.size > 1 && rangeMap.has("")) rangeMap.delete("");
			const result = [...rangeMap.values()];
			cache.set(memoKey, result);
			return result;
		}
		intersects(range, options) {
			if (!(range instanceof Range)) throw new TypeError("a Range is required");
			return this.set.some((thisComparators) => {
				return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
					return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
						return rangeComparators.every((rangeComparator) => {
							return thisComparator.intersects(rangeComparator, options);
						});
					});
				});
			});
		}
		test(version) {
			if (!version) return false;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			for (let i = 0; i < this.set.length; i++) if (testSet(this.set[i], version, this.options)) return true;
			return false;
		}
	};
	const cache = new (require_lrucache())();
	const parseOptions = require_parse_options();
	const Comparator = require_comparator();
	const debug = require_debug();
	const SemVer = require_semver$1();
	const { safeRe: re, src, t, comparatorTrimReplace, tildeTrimReplace, caretTrimReplace } = require_re();
	const { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
	const BUILDSTRIPRE = new RegExp(src[t.BUILD], "g");
	const isNullSet = (c) => c.value === "<0.0.0-0";
	const isAny = (c) => c.value === "";
	const isSatisfiable = (comparators, options) => {
		let result = true;
		const remainingComparators = comparators.slice();
		let testComparator = remainingComparators.pop();
		while (result && remainingComparators.length) {
			result = remainingComparators.every((otherComparator) => {
				return testComparator.intersects(otherComparator, options);
			});
			testComparator = remainingComparators.pop();
		}
		return result;
	};
	const parseComparator = (comp, options) => {
		comp = comp.replace(re[t.BUILD], "");
		debug("comp", comp, options);
		comp = replaceCarets(comp, options);
		debug("caret", comp);
		comp = replaceTildes(comp, options);
		debug("tildes", comp);
		comp = replaceXRanges(comp, options);
		debug("xrange", comp);
		comp = replaceStars(comp, options);
		debug("stars", comp);
		return comp;
	};
	const isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
	const invalidXRangeOrder = (M, m, p) => isX(M) && !isX(m) || isX(m) && p && !isX(p);
	const replaceTildes = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
	};
	const replaceTilde = (comp, options) => {
		const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
		const z = options.includePrerelease ? "-0" : "";
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("tilde", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
			else if (isX(p)) ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
			else if (pr) {
				debug("replaceTilde pr", pr);
				ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
			} else ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
			debug("tilde return", ret);
			return ret;
		});
	};
	const replaceCarets = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
	};
	const replaceCaret = (comp, options) => {
		debug("caret", comp, options);
		const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
		const z = options.includePrerelease ? "-0" : "";
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("caret", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
			else if (isX(p)) {
				if (M === "0") ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
				else ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
			} else if (pr) {
				debug("replaceCaret pr", pr);
				if (M === "0") {
					if (m === "0") ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
					else ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
				} else ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
			} else {
				debug("no pr");
				if (M === "0") {
					if (m === "0") ret = `>=${M}.${m}.${p} <${M}.${m}.${+p + 1}-0`;
					else ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
				} else ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
			}
			debug("caret return", ret);
			return ret;
		});
	};
	const replaceXRanges = (comp, options) => {
		debug("replaceXRanges", comp, options);
		return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
	};
	const replaceXRange = (comp, options) => {
		comp = comp.trim();
		const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
		return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
			debug("xRange", comp, ret, gtlt, M, m, p, pr);
			if (invalidXRangeOrder(M, m, p)) return comp;
			const xM = isX(M);
			const xm = xM || isX(m);
			const xp = xm || isX(p);
			const anyX = xp;
			if (gtlt === "=" && anyX) gtlt = "";
			pr = options.includePrerelease ? "-0" : "";
			if (xM) {
				if (gtlt === ">" || gtlt === "<") ret = "<0.0.0-0";
				else ret = "*";
			} else if (gtlt && anyX) {
				if (xm) m = 0;
				p = 0;
				if (gtlt === ">") {
					gtlt = ">=";
					if (xm) {
						M = +M + 1;
						m = 0;
						p = 0;
					} else {
						m = +m + 1;
						p = 0;
					}
				} else if (gtlt === "<=") {
					gtlt = "<";
					if (xm) M = +M + 1;
					else m = +m + 1;
				}
				if (gtlt === "<") pr = "-0";
				ret = `${gtlt + M}.${m}.${p}${pr}`;
			} else if (xm) ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
			else if (xp) ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
			debug("xRange return", ret);
			return ret;
		});
	};
	const replaceStars = (comp, options) => {
		debug("replaceStars", comp, options);
		return comp.trim().replace(re[t.STAR], "");
	};
	const replaceGTE0 = (comp, options) => {
		debug("replaceGTE0", comp, options);
		return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
	};
	const hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
		if (isX(fM)) from = "";
		else if (isX(fm)) from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
		else if (isX(fp)) from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
		else if (fpr) from = `>=${from}`;
		else from = `>=${from}${incPr ? "-0" : ""}`;
		if (isX(tM)) to = "";
		else if (isX(tm)) to = `<${+tM + 1}.0.0-0`;
		else if (isX(tp)) to = `<${tM}.${+tm + 1}.0-0`;
		else if (tpr) to = `<=${tM}.${tm}.${tp}-${tpr}`;
		else if (incPr) to = `<${tM}.${tm}.${+tp + 1}-0`;
		else to = `<=${to}`;
		return `${from} ${to}`.trim();
	};
	const testSet = (set, version, options) => {
		for (let i = 0; i < set.length; i++) if (!set[i].test(version)) return false;
		if (version.prerelease.length && !options.includePrerelease) {
			for (let i = 0; i < set.length; i++) {
				debug(set[i].semver);
				if (set[i].semver === Comparator.ANY) continue;
				if (set[i].semver.prerelease.length > 0) {
					const allowed = set[i].semver;
					if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) return true;
				}
			}
			return false;
		}
		return true;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/classes/comparator.js
var require_comparator = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const ANY = Symbol("SemVer ANY");
	module.exports = class Comparator {
		static get ANY() {
			return ANY;
		}
		constructor(comp, options) {
			options = parseOptions(options);
			if (comp instanceof Comparator) {
				if (comp.loose === !!options.loose) return comp;
				else comp = comp.value;
			}
			comp = comp.trim().split(/\s+/).join(" ");
			debug("comparator", comp, options);
			this.options = options;
			this.loose = !!options.loose;
			this.parse(comp);
			if (this.semver === ANY) this.value = "";
			else this.value = this.operator + this.semver.version;
			debug("comp", this);
		}
		parse(comp) {
			const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
			const m = comp.match(r);
			if (!m) throw new TypeError(`Invalid comparator: ${comp}`);
			this.operator = m[1] !== void 0 ? m[1] : "";
			if (this.operator === "=") this.operator = "";
			if (!m[2]) this.semver = ANY;
			else this.semver = new SemVer(m[2], this.options.loose);
		}
		toString() {
			return this.value;
		}
		test(version) {
			debug("Comparator.test", version, this.options.loose);
			if (this.semver === ANY || version === ANY) return true;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			return cmp(version, this.operator, this.semver, this.options);
		}
		intersects(comp, options) {
			if (!(comp instanceof Comparator)) throw new TypeError("a Comparator is required");
			if (this.operator === "") {
				if (this.value === "") return true;
				return new Range(comp.value, options).test(this.value);
			} else if (comp.operator === "") {
				if (comp.value === "") return true;
				return new Range(this.value, options).test(comp.semver);
			}
			options = parseOptions(options);
			if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) return false;
			if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) return false;
			if (this.operator.startsWith(">") && comp.operator.startsWith(">")) return true;
			if (this.operator.startsWith("<") && comp.operator.startsWith("<")) return true;
			if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) return true;
			if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) return true;
			if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) return true;
			return false;
		}
	};
	const parseOptions = require_parse_options();
	const { safeRe: re, t } = require_re();
	const cmp = require_cmp();
	const debug = require_debug();
	const SemVer = require_semver$1();
	const Range = require_range();
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/satisfies.js
var require_satisfies = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Range = require_range();
	const satisfies = (version, range, options) => {
		try {
			range = new Range(range, options);
		} catch (er) {
			return false;
		}
		return range.test(version);
	};
	module.exports = satisfies;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/ranges/to-comparators.js
var require_to_comparators = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Range = require_range();
	const toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
	module.exports = toComparators;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const Range = require_range();
	const maxSatisfying = (versions, range, options) => {
		let max = null;
		let maxSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!max || maxSV.compare(v) === -1) {
					max = v;
					maxSV = new SemVer(max, options);
				}
			}
		});
		return max;
	};
	module.exports = maxSatisfying;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const Range = require_range();
	const minSatisfying = (versions, range, options) => {
		let min = null;
		let minSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!min || minSV.compare(v) === 1) {
					min = v;
					minSV = new SemVer(min, options);
				}
			}
		});
		return min;
	};
	module.exports = minSatisfying;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/ranges/min-version.js
var require_min_version = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const Range = require_range();
	const gt = require_gt();
	const minVersion = (range, loose) => {
		range = new Range(range, loose);
		let minver = new SemVer("0.0.0");
		if (range.test(minver)) return minver;
		minver = new SemVer("0.0.0-0");
		if (range.test(minver)) return minver;
		minver = null;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let setMin = null;
			comparators.forEach((comparator) => {
				const compver = new SemVer(comparator.semver.version);
				switch (comparator.operator) {
					case ">":
						if (compver.prerelease.length === 0) compver.patch++;
						else compver.prerelease.push(0);
						compver.raw = compver.format();
					case "":
					case ">=":
						if (!setMin || gt(compver, setMin)) setMin = compver;
						break;
					case "<":
					case "<=": break;
					/* istanbul ignore next */
					default: throw new Error(`Unexpected operation: ${comparator.operator}`);
				}
			});
			if (setMin && (!minver || gt(minver, setMin))) minver = setMin;
		}
		if (minver && range.test(minver)) return minver;
		return null;
	};
	module.exports = minVersion;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/ranges/valid.js
var require_valid = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Range = require_range();
	const validRange = (range, options) => {
		try {
			return new Range(range, options).range || "*";
		} catch (er) {
			return null;
		}
	};
	module.exports = validRange;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/ranges/outside.js
var require_outside = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const Comparator = require_comparator();
	const { ANY } = Comparator;
	const Range = require_range();
	const satisfies = require_satisfies();
	const gt = require_gt();
	const lt = require_lt();
	const lte = require_lte();
	const gte = require_gte();
	const outside = (version, range, hilo, options) => {
		version = new SemVer(version, options);
		range = new Range(range, options);
		let gtfn, ltefn, ltfn, comp, ecomp;
		switch (hilo) {
			case ">":
				gtfn = gt;
				ltefn = lte;
				ltfn = lt;
				comp = ">";
				ecomp = ">=";
				break;
			case "<":
				gtfn = lt;
				ltefn = gte;
				ltfn = gt;
				comp = "<";
				ecomp = "<=";
				break;
			default: throw new TypeError("Must provide a hilo val of \"<\" or \">\"");
		}
		if (satisfies(version, range, options)) return false;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let high = null;
			let low = null;
			comparators.forEach((comparator) => {
				if (comparator.semver === ANY) comparator = new Comparator(">=0.0.0");
				high = high || comparator;
				low = low || comparator;
				if (gtfn(comparator.semver, high.semver, options)) high = comparator;
				else if (ltfn(comparator.semver, low.semver, options)) low = comparator;
			});
			if (high.operator === comp || high.operator === ecomp) return false;
			if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) return false;
			else if (low.operator === ecomp && ltfn(version, low.semver)) return false;
		}
		return true;
	};
	module.exports = outside;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/ranges/gtr.js
var require_gtr = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const outside = require_outside();
	const gtr = (version, range, options) => outside(version, range, ">", options);
	module.exports = gtr;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/ranges/ltr.js
var require_ltr = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const outside = require_outside();
	const ltr = (version, range, options) => outside(version, range, "<", options);
	module.exports = ltr;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/ranges/intersects.js
var require_intersects = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Range = require_range();
	const intersects = (r1, r2, options) => {
		r1 = new Range(r1, options);
		r2 = new Range(r2, options);
		return r1.intersects(r2, options);
	};
	module.exports = intersects;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/ranges/simplify.js
var require_simplify = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const satisfies = require_satisfies();
	const compare = require_compare();
	module.exports = (versions, range, options) => {
		const set = [];
		let first = null;
		let prev = null;
		const v = versions.sort((a, b) => compare(a, b, options));
		for (const version of v) if (satisfies(version, range, options)) {
			prev = version;
			if (!first) first = version;
		} else {
			if (prev) set.push([first, prev]);
			prev = null;
			first = null;
		}
		if (first) set.push([first, null]);
		const ranges = [];
		for (const [min, max] of set) if (min === max) ranges.push(min);
		else if (!max && min === v[0]) ranges.push("*");
		else if (!max) ranges.push(`>=${min}`);
		else if (min === v[0]) ranges.push(`<=${max}`);
		else ranges.push(`${min} - ${max}`);
		const simplified = ranges.join(" || ");
		const original = typeof range.raw === "string" ? range.raw : String(range);
		return simplified.length < original.length ? simplified : range;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/ranges/subset.js
var require_subset = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Range = require_range();
	const Comparator = require_comparator();
	const { ANY } = Comparator;
	const satisfies = require_satisfies();
	const compare = require_compare();
	const subset = (sub, dom, options = {}) => {
		if (sub === dom) return true;
		sub = new Range(sub, options);
		dom = new Range(dom, options);
		let sawNonNull = false;
		OUTER: for (const simpleSub of sub.set) {
			for (const simpleDom of dom.set) {
				const isSub = simpleSubset(simpleSub, simpleDom, options);
				sawNonNull = sawNonNull || isSub !== null;
				if (isSub) continue OUTER;
			}
			if (sawNonNull) return false;
		}
		return true;
	};
	const minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
	const minimumVersion = [new Comparator(">=0.0.0")];
	const simpleSubset = (sub, dom, options) => {
		if (sub === dom) return true;
		if (sub.length === 1 && sub[0].semver === ANY) {
			if (dom.length === 1 && dom[0].semver === ANY) return true;
			else if (options.includePrerelease) sub = minimumVersionWithPreRelease;
			else sub = minimumVersion;
		}
		if (dom.length === 1 && dom[0].semver === ANY) {
			if (options.includePrerelease) return true;
			else dom = minimumVersion;
		}
		const eqSet = /* @__PURE__ */ new Set();
		let gt, lt;
		for (const c of sub) if (c.operator === ">" || c.operator === ">=") gt = higherGT(gt, c, options);
		else if (c.operator === "<" || c.operator === "<=") lt = lowerLT(lt, c, options);
		else eqSet.add(c.semver);
		if (eqSet.size > 1) return null;
		let gtltComp;
		if (gt && lt) {
			gtltComp = compare(gt.semver, lt.semver, options);
			if (gtltComp > 0) return null;
			else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) return null;
		}
		for (const eq of eqSet) {
			if (gt && !satisfies(eq, String(gt), options)) return null;
			if (lt && !satisfies(eq, String(lt), options)) return null;
			for (const c of dom) if (!satisfies(eq, String(c), options)) return false;
			return true;
		}
		let higher, lower;
		let hasDomLT, hasDomGT;
		let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
		let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
		if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) needDomLTPre = false;
		for (const c of dom) {
			hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
			hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
			if (gt) {
				if (needDomGTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) needDomGTPre = false;
				}
				if (c.operator === ">" || c.operator === ">=") {
					higher = higherGT(gt, c, options);
					if (higher === c && higher !== gt) return false;
				} else if (gt.operator === ">=" && !c.test(gt.semver)) return false;
			}
			if (lt) {
				if (needDomLTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) needDomLTPre = false;
				}
				if (c.operator === "<" || c.operator === "<=") {
					lower = lowerLT(lt, c, options);
					if (lower === c && lower !== lt) return false;
				} else if (lt.operator === "<=" && !c.test(lt.semver)) return false;
			}
			if (!c.operator && (lt || gt) && gtltComp !== 0) return false;
		}
		if (gt && hasDomLT && !lt && gtltComp !== 0) return false;
		if (lt && hasDomGT && !gt && gtltComp !== 0) return false;
		if (needDomGTPre || needDomLTPre) return false;
		return true;
	};
	const higherGT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
	};
	const lowerLT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
	};
	module.exports = subset;
}));
//#endregion
//#region ../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/index.js
var require_semver = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const internalRe = require_re();
	const constants = require_constants();
	const SemVer = require_semver$1();
	const identifiers = require_identifiers();
	module.exports = {
		parse: require_parse(),
		valid: require_valid$1(),
		clean: require_clean(),
		inc: require_inc(),
		diff: require_diff(),
		major: require_major(),
		minor: require_minor(),
		patch: require_patch(),
		prerelease: require_prerelease(),
		compare: require_compare(),
		rcompare: require_rcompare(),
		compareLoose: require_compare_loose(),
		compareBuild: require_compare_build(),
		sort: require_sort(),
		rsort: require_rsort(),
		gt: require_gt(),
		lt: require_lt(),
		eq: require_eq(),
		neq: require_neq(),
		gte: require_gte(),
		lte: require_lte(),
		cmp: require_cmp(),
		coerce: require_coerce(),
		truncate: require_truncate(),
		Comparator: require_comparator(),
		Range: require_range(),
		satisfies: require_satisfies(),
		toComparators: require_to_comparators(),
		maxSatisfying: require_max_satisfying(),
		minSatisfying: require_min_satisfying(),
		minVersion: require_min_version(),
		validRange: require_valid(),
		outside: require_outside(),
		gtr: require_gtr(),
		ltr: require_ltr(),
		intersects: require_intersects(),
		simplifyRange: require_simplify(),
		subset: require_subset(),
		SemVer,
		re: internalRe.re,
		src: internalRe.src,
		tokens: internalRe.t,
		SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
		RELEASE_TYPES: constants.RELEASE_TYPES,
		compareIdentifiers: identifiers.compareIdentifiers,
		rcompareIdentifiers: identifiers.rcompareIdentifiers
	};
}));
//#endregion
//#region src/types/package.ts
const PackageManager = {
	pnpm: "pnpm",
	npm: "npm",
	yarn: "yarn",
	bun: "bun"
};
const DependencyType = {
	dependencies: "dependencies",
	devDependencies: "devDependencies",
	peerDependencies: "peerDependencies",
	optionalDependencies: "optionalDependencies"
};
//#endregion
//#region src/utils/spinner.ts
var import_semver = /* @__PURE__ */ __toESM(require_semver(), 1);
function getSpinner(interactive) {
	if (interactive) return spinner();
	return {
		start: (msg) => {
			if (msg) log.info(msg);
		},
		stop: (msg) => {
			if (msg) log.info(msg);
		},
		message: (msg) => {
			if (msg) log.info(msg);
		}
	};
}
function getSilentSpinner() {
	return {
		start: () => {},
		stop: () => {},
		message: () => {}
	};
}
//#endregion
//#region src/utils/approve-builds.ts
/**
* pnpm prints this prefix whenever it gates a dependency's build (install /
* postinstall) script behind explicit approval. It appears both in the pnpm
* >= 11 hard-error line (`[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts:
* better-sqlite3@11.0.0, esbuild@0.25.0`) and the pnpm 10 warning box
* (`Ignored build scripts: esbuild.`).
*/
const IGNORED_BUILDS_MARKER = "Ignored build scripts:";
/** pnpm >= 11 turns the gated-builds warning into a hard exit-1 with this code. */
const IGNORED_BUILDS_ERROR_CODE = "ERR_PNPM_IGNORED_BUILDS";
/** Box-drawing / list characters pnpm wraps the pnpm-10 warning message in. */
const BOX_CHARS = /[│|╮╯╰╭─]/gu;
/** Non-global form, for testing whether a line is a box-bordered continuation. */
const BOX_LINE = /[│|╮╯╰╭─]/u;
function isPnpmIgnoredBuildsError(output) {
	return output.includes(IGNORED_BUILDS_ERROR_CODE);
}
/**
* Strip a trailing `@version` from a (possibly scoped) package spec.
* `better-sqlite3@11.0.0` -> `better-sqlite3`, `@scope/pkg@1.2.3` ->
* `@scope/pkg`, `esbuild` -> `esbuild`.
*/
function stripPackageVersion(spec) {
	const at = spec.lastIndexOf("@");
	return at > 0 ? spec.slice(0, at) : spec;
}
/**
* Collect the name `extract` pulls from each item, dropping empties and
* duplicates while preserving first-seen order. The three install-output
* parsers (pnpm / bun / yarn) differ only in how a name is read from each token
* or line; this captures their shared dedupe-in-order loop.
*/
function dedupeNames(items, extract) {
	const names = [];
	const seen = /* @__PURE__ */ new Set();
	for (const item of items) {
		const name = extract(item);
		if (!name || seen.has(name)) continue;
		seen.add(name);
		names.push(name);
	}
	return names;
}
/**
* Parse the package names pnpm reports under "Ignored build scripts:" from
* captured install output. Handles both the pnpm >= 11 single-line error and
* the pnpm 10 boxed warning, strips version suffixes, and dedupes while
* preserving first-seen order. Returns `[]` when the marker is absent.
*/
function parseIgnoredBuilds(output) {
	if (!output) return [];
	const clean = stripVTControlCharacters(output);
	const markerIndex = clean.indexOf(IGNORED_BUILDS_MARKER);
	if (markerIndex === -1) return [];
	const lines = clean.slice(markerIndex + 22).split("\n");
	const listLines = [];
	for (const line of lines) {
		if (listLines.length > 0 && (/approve-builds/u.test(line) || !BOX_LINE.test(line))) break;
		listLines.push(line);
	}
	const segment = listLines.join(" ").replace(BOX_CHARS, " ").replace(/[.\s]+$/u, "").trim();
	if (!segment) return [];
	return dedupeNames(segment.split(","), (rawToken) => {
		const token = rawToken.trim();
		return token ? stripPackageVersion(token) : null;
	});
}
/**
* Parse the package names from `bun pm untrusted` output. bun does not hard-fail
* on gated builds; after install it lists each blocked package on its own line
* as `./node_modules/<name> @<version>` (scoped: `@scope/pkg`, nested:
* `./node_modules/a/node_modules/b`). The name after the last `node_modules/`
* is what `bun pm trust` expects. Returns deduped names in first-seen order;
* `[]` when nothing is blocked.
*/
function parseBunUntrusted(output) {
	if (!output) return [];
	return dedupeNames(output.split("\n"), (rawLine) => {
		const line = rawLine.trim();
		if (!line.startsWith("./node_modules/") && !line.startsWith("node_modules/")) return null;
		const match = line.slice(line.lastIndexOf("node_modules/") + 13).match(/^(@?[^\s]+) @[^\s]+$/u);
		return match ? match[1] : null;
	});
}
/**
* npm >= 12 skips dependency install scripts that the `allowScripts` allowlist
* in package.json does not cover, and reports them on stderr:
*
* ```
* npm warn install-scripts 2 packages had install scripts blocked because they are not covered by allowScripts:
* npm warn install-scripts   core-js@3.49.0 (postinstall: node -e "try{require('./postinstall')}catch(e){}")
* npm warn install-scripts   esbuild@0.28.1 (postinstall: node install.js)
* ```
*
* npm 11.16 - 11.x print a similar warning ("install scripts not yet covered by
* allowScripts") but still run the scripts, so only the npm 12 "blocked" wording
* is parsed.
*/
const NPM_BLOCKED_SCRIPTS_MARKER = "install scripts blocked because they are not covered by allowScripts";
/**
* A blocked-package entry line: `npm warn install-scripts   <spec> (<lifecycle>:
* <command>)`. Anchoring on the lifecycle name keeps the count line ("2 packages
* had install scripts blocked ...") and the trailing hint line from matching.
*/
const NPM_BLOCKED_ENTRY = /^npm warn install-scripts\s+(\S+) \((?:pre|post)?install:/u;
/**
* Parse the package names npm >= 12 reports as having blocked install scripts
* from captured `npm install` / `npm ci` output. Strips version suffixes and
* dedupes while preserving first-seen order. Returns `[]` when the warning is
* absent (including the npm 11.x advisory variant, where scripts still run).
*/
function parseNpmBlockedScripts(output) {
	if (!output) return [];
	const clean = stripVTControlCharacters(output);
	if (!clean.includes(NPM_BLOCKED_SCRIPTS_MARKER)) return [];
	return dedupeNames(clean.split("\n"), (rawLine) => {
		const match = rawLine.trim().match(NPM_BLOCKED_ENTRY);
		return match ? stripPackageVersion(match[1]) : null;
	});
}
const YARN_DISABLED_BUILDS_MARKER = "lists build scripts, but all build scripts have been disabled";
/**
* Yarn (Berry) gates build scripts when `enableScripts` is false: each gated
* package is reported on its own line as `<descriptor> lists build scripts, but
* all build scripts have been disabled` (e.g. `core-js@npm:3.39.0 lists build
* scripts...`). Yarn does not fail the install. Returns deduped package names.
*/
function parseYarnDisabledBuilds(output) {
	if (!output) return [];
	return dedupeNames(output.split("\n"), (rawLine) => {
		const line = stripVTControlCharacters(rawLine);
		const markerIndex = line.indexOf(YARN_DISABLED_BUILDS_MARKER);
		if (markerIndex === -1) return null;
		return yarnDescriptorName(line.slice(0, markerIndex).trim().split(/\s+/u).filter((token) => token && !/^\[[0-9a-f]+\]$/u.test(token)).pop() ?? "");
	});
}
/**
* Extract the package name from a yarn descriptor by dropping the trailing
* `@<range>`: `core-js@npm:3.39.0` -> `core-js`, `@scope/pkg@npm:1.0.0` ->
* `@scope/pkg`.
*/
function yarnDescriptorName(descriptor) {
	const match = descriptor.match(/^(@[^@/]+\/[^@]+|[^@]+)@/u);
	return match ? match[1] : descriptor;
}
/**
* Parse the gated build-script package names from an install log, dispatching on
* the package manager: pnpm prints `Ignored build scripts:`, yarn prints
* `... build scripts have been disabled`, npm >= 12 prints `... install scripts
* blocked ...`. bun is not parsed here (its blocked packages are queried
* separately via `bun pm untrusted`).
*/
function parseInstallGatedBuilds(output, packageManager) {
	if (packageManager === PackageManager.pnpm) return parseIgnoredBuilds(output);
	if (packageManager === PackageManager.yarn) return parseYarnDisabledBuilds(output);
	if (packageManager === PackageManager.npm) return parseNpmBlockedScripts(output);
	return [];
}
/**
* Collect the names a project directly depends on (the dependencies it can
* meaningfully approve). peerDependencies are intentionally excluded: they are
* not installed into the project's own tree.
*/
function collectDirectDependencyNames(pkg) {
	const names = /* @__PURE__ */ new Set();
	if (!pkg) return names;
	for (const field of [
		"dependencies",
		"devDependencies",
		"optionalDependencies"
	]) {
		const deps = pkg[field];
		if (deps && typeof deps === "object") for (const [name, spec] of Object.entries(deps)) {
			names.add(name);
			if (typeof spec === "string" && spec.startsWith("npm:")) {
				const aliased = stripPackageVersion(spec.slice(4));
				if (aliased) names.add(aliased);
			}
		}
	}
	return names;
}
function filterToDirectDependencies(ignored, direct) {
	return ignored.filter((name) => direct.has(name));
}
/**
* pnpm gained positional `approve-builds <pkg>` in pnpm 11; pnpm 10 only accepts
* `--all` (and otherwise opens an interactive picker), so a non-interactive
* positional approve there silently does nothing. When the version is unknown,
* assume a modern pnpm (vp provisions 11+).
*/
function pnpmSupportsPositionalApprove(version) {
	if (!version) return true;
	const major = Number.parseInt(version, 10);
	return Number.isNaN(major) || major >= 11;
}
/** Package managers that gate build scripts and expose an approval workflow. */
const GATED_BUILD_PACKAGE_MANAGERS = /* @__PURE__ */ new Set([
	PackageManager.pnpm,
	PackageManager.bun,
	PackageManager.yarn,
	PackageManager.npm
]);
/**
* Narrow a package manager's gated builds down to the ones worth surfacing
* during `vp create`: packages the generated project depends on directly.
* Transitive gated builds (e.g. `esbuild` pulled in by Vite) are noise the user
* did not choose, so they are dropped. Returns `[]` for package managers that
* do not gate build scripts (npm < 12, yarn classic), since there is nothing to
* approve.
*/
function resolveApproveBuildTargets(projectDir, pendingBuilds, packageManager) {
	if (!packageManager || !GATED_BUILD_PACKAGE_MANAGERS.has(packageManager) || !pendingBuilds || pendingBuilds.length === 0) return [];
	let pkg;
	try {
		pkg = readJsonFile(path.join(projectDir, "package.json"));
	} catch {
		return [];
	}
	const direct = collectDirectDependencyNames(pkg);
	return filterToDirectDependencies([...new Set(pendingBuilds)], direct);
}
/**
* Enumerate the packages whose build scripts a package manager gated during the
* install, as raw names (still unfiltered by direct dependency).
*
* - pnpm, yarn, and npm >= 12 report them in their install output, so the names
*   are parsed there (see {@link parseInstallGatedBuilds}) and passed in via
*   `pendingBuildsFromInstall`.
* - bun exits 0 and only prints a count, so `bun pm untrusted` is queried here.
*
* Other package managers run build scripts by default and return `[]`.
*/
async function detectGatedBuilds(installCwd, packageManager, pendingBuildsFromInstall) {
	if (packageManager === PackageManager.pnpm || packageManager === PackageManager.yarn || packageManager === PackageManager.npm) return pendingBuildsFromInstall ?? [];
	if (packageManager === PackageManager.bun) {
		const { exitCode, stdout, stderr } = await runCommandSilently({
			command: process.env.VP_CLI_BIN ?? "vp",
			args: [
				"exec",
				"bun",
				"pm",
				"untrusted"
			],
			cwd: installCwd,
			envs: process.env
		});
		if (exitCode !== 0) return [];
		return parseBunUntrusted(`${stdout.toString()}\n${stderr.toString()}`);
	}
	return [];
}
function lastLines(text, count) {
	return text.split("\n").slice(-count).join("\n");
}
function printApproveBuildsGuidance(targets, packageManager) {
	log.warn(`Build scripts were not run for: ${accent(targets.join(", "))}.`);
	if (packageManager === PackageManager.yarn) {
		log.info(`These dependencies may not work until built. Enable them in the workspace root package.json (${accent("dependenciesMeta.<pkg>.built: true")}) and reinstall, or re-create with ${accent("--approve-builds")}.`);
		return;
	}
	const command = packageManager === PackageManager.bun || packageManager === PackageManager.npm ? `vp pm approve-builds ${targets.join(" ")}` : "vp pm approve-builds";
	log.info(`These dependencies may not work until built. Run ${accent(command)} in the project to approve them, or re-create with ${accent("--approve-builds")}.`);
}
/**
* Run a `vp` build/approval command and report the outcome through a spinner.
* On failure the approval has still been recorded (pnpm/bun/npm config or
* yarn's `dependenciesMeta`), so the retry hint points back at `retryCommand`
* (`vp install` unless the package manager needs an explicit rebuild). Returns
* `true` when the command succeeded, `false` when the build exited non-zero.
*/
async function runBuildAndReport(args, cwd, packages, interactive, silent, extraEnv, retryCommand = "vp install") {
	const spinner = silent ? getSilentSpinner() : getSpinner(interactive);
	spinner.start(`Building ${packages.join(", ")}...`);
	const { exitCode, stdout, stderr } = await runCommandSilently({
		command: process.env.VP_CLI_BIN ?? "vp",
		args,
		cwd,
		envs: extraEnv ? {
			...process.env,
			...extraEnv
		} : process.env
	});
	if (exitCode === 0) {
		spinner.stop(`Built ${packages.join(", ")}`);
		return true;
	}
	spinner.stop(`Build failed for ${packages.join(", ")}`);
	const output = `${stdout.toString()}\n${stderr.toString()}`.trim();
	if (output) log.info(lastLines(output, 20));
	log.warn(`Build scripts failed for ${accent(packages.join(", "))}. They were approved; fix the build toolchain and run ${accent(retryCommand)} to retry.`);
	return false;
}
/**
* Approve gated install scripts for npm >= 12, then run them. npm's approval
* (`npm approve-scripts`, via `vp pm approve-builds`) only records the
* `allowScripts` allowlist in package.json: scripts the install already skipped
* do not run on approval, and a plain reinstall short-circuits on the
* up-to-date tree without running them either. `npm rebuild` is what executes
* the newly approved scripts, so approval and rebuild are two steps.
*/
async function approveNpmScripts(installCwd, packages, interactive, silent) {
	const approveCommand = `vp pm approve-builds ${packages.join(" ")}`;
	const { exitCode, stdout, stderr } = await runCommandSilently({
		command: process.env.VP_CLI_BIN ?? "vp",
		args: [
			"pm",
			"approve-builds",
			...packages
		],
		cwd: installCwd,
		envs: process.env
	});
	if (exitCode !== 0) {
		const output = `${stdout.toString()}\n${stderr.toString()}`.trim();
		if (output) log.info(lastLines(output, 20));
		log.warn(`Approving build scripts failed for ${accent(packages.join(", "))}. Run ${accent(approveCommand)} in the project to retry.`);
		return false;
	}
	return runBuildAndReport([
		"pm",
		"rebuild",
		...packages
	], installCwd, packages, interactive, silent, void 0, `vp pm rebuild ${packages.join(" ")}`);
}
/**
* Mark each package as build-allowed in yarn's `dependenciesMeta[<pkg>].built`,
* preserving existing metadata. Guards against a non-object container or
* per-package value so a hand-authored scalar doesn't corrupt package.json.
* Mutates and returns `pkg`.
*/
function addYarnBuiltDependenciesMeta(pkg, packages) {
	const existing = pkg.dependenciesMeta;
	const meta = existing && typeof existing === "object" ? { ...existing } : {};
	for (const name of packages) {
		const current = meta[name];
		meta[name] = {
			...current && typeof current === "object" ? current : {},
			built: true
		};
	}
	pkg.dependenciesMeta = meta;
	return pkg;
}
/**
* Approve gated builds for yarn. Unlike pnpm/bun, yarn has no `approve-builds`
* command: a package's build is enabled by setting `dependenciesMeta[name].built`
* to true in package.json, after which a reinstall runs its build script.
*
* The metadata is written to the install root's manifest (`installCwd`), not the
* created package: yarn only honors `dependenciesMeta.<pkg>.built` from the
* workspace root, so a child-package entry is ignored and the build never runs.
*/
async function approveYarnBuilds(installCwd, packages, interactive, silent) {
	const pkgPath = path.join(installCwd, "package.json");
	let pkg;
	try {
		pkg = readJsonFile(pkgPath);
	} catch {
		printApproveBuildsGuidance(packages, PackageManager.yarn);
		return true;
	}
	writeJsonFile(pkgPath, addYarnBuiltDependenciesMeta(pkg, packages));
	return runBuildAndReport(["install"], installCwd, packages, interactive, silent, { YARN_ENABLE_IMMUTABLE_INSTALLS: "false" });
}
/**
* Surface the package manager's gated build scripts after a `vp create` install
* and let the user act on them:
* - `--approve-builds`: approve + build every target, no prompt.
* - interactive: a default-off multiselect so each package is approved
*   individually (pnpm gates them for security, so nothing is opt-in by
*   default).
* - non-interactive: print guidance pointing at `vp pm approve-builds`.
*
* Returns `false` only when an approved build actually ran and failed (so a
* non-interactive `--approve-builds` caller can surface a non-zero exit);
* approving nothing or printing guidance returns `true`.
*/
async function approveBuilds(options) {
	const { cwd, packageManager, packageManagerVersion, targets, interactive, autoApprove, silent = false } = options;
	if (targets.length === 0) return true;
	let selected;
	if (autoApprove) selected = targets;
	else if (interactive) {
		const answer = await multiselect({
			message: "These dependencies have build scripts (e.g. native builds) that were not run. Select which to approve and build:",
			options: targets.map((name) => ({
				value: name,
				label: name
			})),
			initialValues: [],
			required: false
		});
		selected = isCancel(answer) ? [] : answer;
	} else selected = [];
	if (selected.length === 0) {
		printApproveBuildsGuidance(targets, packageManager);
		return true;
	}
	if (packageManager === PackageManager.yarn) return approveYarnBuilds(cwd, selected, interactive, silent);
	if (packageManager === PackageManager.npm) return approveNpmScripts(cwd, selected, interactive, silent);
	if (packageManager === PackageManager.pnpm && !pnpmSupportsPositionalApprove(packageManagerVersion)) {
		printApproveBuildsGuidance(selected, packageManager);
		return !(autoApprove && !interactive);
	}
	return runBuildAndReport([
		"pm",
		"approve-builds",
		...selected
	], cwd, selected, interactive, silent);
}
//#endregion
//#region src/utils/yaml.ts
var import_dist = require_dist();
function readYamlFile(file) {
	const content = fs.readFileSync(file, "utf-8");
	return (0, import_dist.parse)(content);
}
function editYamlFile(file, callback) {
	const content = fs.readFileSync(file, "utf-8");
	const doc = (0, import_dist.parseDocument)(content);
	callback(doc);
	fs.writeFileSync(file, doc.toString({ singleQuote: true }), "utf-8");
}
function scalarString(value) {
	return new import_dist.Scalar(value);
}
//#endregion
//#region src/utils/preview-registry.ts
const DEFAULT_BRIDGE_REGISTRY = "https://registry-bridge.viteplus.dev/";
const REGISTRY_MARKER = "# vite-plus preview build registry bridge (auto-added by vp)";
const BRIDGE_HOST = "registry-bridge.viteplus.dev";
/**
* Registry bridge that serves PR preview builds as ordinary `0.0.0-commit.<sha>`
* versions (and proxies everything else to npmjs). Only ever used for preview
* builds (see {@link isPreviewVitePlusVersion}); real releases never resolve
* through it. Overridable via `VP_REGISTRY_BRIDGE` for testing or an alternate
* bridge host; read at call time so the override applies per process.
*/
function bridgeRegistry() {
	return process.env.VP_REGISTRY_BRIDGE || DEFAULT_BRIDGE_REGISTRY;
}
/**
* A preview / test build is published as `0.0.0-commit.<sha>` (and, generally,
* any `0.0.0-<prerelease>`). A real release is never `0.0.0`, so this reliably
* flags a build under test with no false positives on real-user migrations.
*/
function isPreviewVitePlusVersion(version = process.env.VP_VERSION || VITE_PLUS_VERSION) {
	return version.startsWith("0.0.0-");
}
/**
* Berry reads `.yarnrc.yml` and ignores `.npmrc`, so the registry must be
* written to the right file. Detect Berry without an install: a `.yarnrc.yml`
* is Berry-only, a Berry lockfile carries a `__metadata:` block, and a
* `packageManager: "yarn@>=2"` pin selects Berry up front.
*/
function isYarnBerryProject(projectRoot) {
	if (fs.existsSync(path.join(projectRoot, ".yarnrc.yml"))) return true;
	const yarnLock = path.join(projectRoot, "yarn.lock");
	if (fs.existsSync(yarnLock)) try {
		if (fs.readFileSync(yarnLock, "utf8").includes("__metadata:")) return true;
	} catch {}
	try {
		const pkg = readJsonFile(path.join(projectRoot, "package.json"));
		const pm = typeof pkg.packageManager === "string" ? pkg.packageManager : "";
		const major = /^yarn@(\d+)/.exec(pm)?.[1];
		if (major && Number(major) >= 2) return true;
	} catch {}
	return false;
}
function ensureNpmrcRegistry(projectRoot) {
	const npmrc = path.join(projectRoot, ".npmrc");
	const bridge = bridgeRegistry();
	let content = "";
	if (fs.existsSync(npmrc)) {
		content = fs.readFileSync(npmrc, "utf8");
		if (content.includes(REGISTRY_MARKER) || content.includes(bridge)) return;
	}
	const prefix = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
	fs.appendFileSync(npmrc, `${prefix}${REGISTRY_MARKER}\nregistry=${bridge}\n`);
}
const YARN_ORIGINAL_REGISTRY_COMMENT_PREFIX = " vite-plus preview bridge (auto-added by vp); original npmRegistryServer: ";
function ensureYarnBerryRegistry(projectRoot) {
	const yarnrc = path.join(projectRoot, ".yarnrc.yml");
	if (!fs.existsSync(yarnrc)) fs.writeFileSync(yarnrc, "");
	editYamlFile(yarnrc, (doc) => {
		const current = doc.get("npmRegistryServer");
		if (current === bridgeRegistry()) return;
		doc.set("npmRegistryServer", bridgeRegistry());
		const node = doc.get("npmRegistryServer", true);
		if (node instanceof import_dist.Scalar && typeof current === "string" && !current.includes(BRIDGE_HOST)) node.comment = `${YARN_ORIGINAL_REGISTRY_COMMENT_PREFIX}${current}`;
	});
}
function clearNpmrcRegistry(projectRoot) {
	const npmrc = path.join(projectRoot, ".npmrc");
	if (!fs.existsSync(npmrc)) return false;
	const original = fs.readFileSync(npmrc, "utf8");
	if (!original.includes(REGISTRY_MARKER)) return false;
	const lines = original.split("\n");
	const kept = [];
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].trim() === REGISTRY_MARKER) {
			if (lines[i + 1]?.startsWith("registry=")) i++;
			continue;
		}
		kept.push(lines[i]);
	}
	const result = kept.join("\n").replace(/\n{2,}$/, "\n");
	if (result.trim() === "") fs.rmSync(npmrc);
	else fs.writeFileSync(npmrc, result.endsWith("\n") ? result : `${result}\n`);
	return true;
}
function clearYarnBerryRegistry(projectRoot) {
	const yarnrc = path.join(projectRoot, ".yarnrc.yml");
	if (!fs.existsSync(yarnrc)) return false;
	const content = fs.readFileSync(yarnrc, "utf8");
	if (!content.includes(BRIDGE_HOST) && !content.includes(bridgeRegistry())) return false;
	let cleared = false;
	editYamlFile(yarnrc, (doc) => {
		const current = doc.get("npmRegistryServer");
		if (typeof current === "string" && (current.includes(BRIDGE_HOST) || current === bridgeRegistry())) {
			const node = doc.get("npmRegistryServer", true);
			const original = (node instanceof import_dist.Scalar ? node.comment : void 0)?.split(YARN_ORIGINAL_REGISTRY_COMMENT_PREFIX.trimStart())[1]?.trim();
			if (original) {
				doc.set("npmRegistryServer", original);
				const restored = doc.get("npmRegistryServer", true);
				if (restored instanceof import_dist.Scalar) restored.comment = void 0;
			} else doc.delete("npmRegistryServer");
			cleared = true;
		}
	});
	return cleared;
}
/**
* Reconcile the project's registry config with the running build:
*
* - Preview / test build: point the project at the registry bridge (`.npmrc`, or
*   `.yarnrc.yml` for Yarn Berry) so the `0.0.0-commit.<sha>` versions that
*   migrate/create just pinned resolve during this install and in the project's
*   own CI.
* - Real release: remove any bridge registry a PRIOR preview run left behind, so
*   real installs resolve from npmjs instead of the test bridge.
*
* No-op and idempotent in the common case. Returns true when it changed config.
*/
function reconcilePreviewBridgeRegistry(projectRoot, version = process.env.VP_VERSION || VITE_PLUS_VERSION, packageManager) {
	if (isPreviewVitePlusVersion(version)) {
		if (packageManager === PackageManager.yarn ? isYarnBerryProject(projectRoot) : packageManager === void 0 && isYarnBerryProject(projectRoot)) ensureYarnBerryRegistry(projectRoot);
		else ensureNpmrcRegistry(projectRoot);
		return true;
	}
	const clearedNpmrc = clearNpmrcRegistry(projectRoot);
	const clearedYarnrc = clearYarnBerryRegistry(projectRoot);
	return clearedNpmrc || clearedYarnrc;
}
//#endregion
//#region src/utils/prompts.ts
/**
* pnpm v11 promoted `ERR_PNPM_IGNORED_BUILDS` from a warning to a hard
* exit-1. Auto-installs run by `vp migrate` / `vp create` happen before the
* user has a chance to approve build scripts via `pnpm.onlyBuiltDependencies`,
* so transitive deps like `esbuild` would fail the install. Pass
* `--ignore-scripts` in that window so the orchestration succeeds; the user's
* own subsequent `vp install` keeps default pnpm behavior.
*/
function shouldIgnoreScriptsForAutoInstall(packageManager, packageManagerVersion) {
	if (packageManager !== PackageManager.pnpm) return false;
	const coerced = packageManagerVersion ? import_semver.default.coerce(packageManagerVersion)?.version : void 0;
	if (!coerced) return false;
	return import_semver.default.gte(coerced, "11.0.0");
}
function cancelAndExit(message = "Operation cancelled", exitCode = 0) {
	cancel(message);
	process.exit(exitCode);
}
async function selectPackageManager(interactive, silent = false) {
	if (interactive) {
		const selected = await select({
			message: "Which package manager would you like to use?",
			options: [
				{
					value: PackageManager.pnpm,
					hint: "recommended"
				},
				{ value: PackageManager.yarn },
				{ value: PackageManager.npm },
				{ value: PackageManager.bun }
			],
			initialValue: PackageManager.pnpm
		});
		if (isCancel(selected)) cancelAndExit();
		return selected;
	} else {
		if (!silent) log.info(`Using default package manager: ${accent(PackageManager.pnpm)}`);
		return PackageManager.pnpm;
	}
}
async function downloadPackageManager$1(packageManager, version, interactive, silent = false) {
	const spinner = silent ? getSilentSpinner() : getSpinner(interactive);
	spinner.start(`${packageManager}@${version} installing...`);
	const downloadResult = await downloadPackageManager({
		name: packageManager,
		version
	});
	spinner.stop(`${packageManager}@${downloadResult.version} installed`);
	return downloadResult;
}
async function runViteInstall(cwd, interactive, extraArgs, options) {
	reconcilePreviewBridgeRegistry(cwd, void 0, options?.packageManager);
	if (process.env.VP_SKIP_INSTALL) return {
		durationMs: 0,
		status: "skipped"
	};
	const detectIgnoredBuilds = options?.detectIgnoredBuilds === true;
	const installArgs = [...extraArgs ?? []];
	if (!detectIgnoredBuilds && shouldIgnoreScriptsForAutoInstall(options?.packageManager, options?.packageManagerVersion) && !installArgs.includes("--ignore-scripts")) installArgs.push("--ignore-scripts");
	const spinner = options?.silent ? getSilentSpinner() : getSpinner(interactive);
	const startTime = Date.now();
	spinner.start(`Installing dependencies...`);
	const { exitCode, stderr, stdout } = await runCommandSilently({
		command: process.env.VP_CLI_BIN ?? "vp",
		args: ["install", ...installArgs],
		cwd,
		envs: process.env
	});
	const combinedOutput = `${stdout.toString()}\n${stderr.toString()}`;
	const pendingBuilds = detectIgnoredBuilds ? parseInstallGatedBuilds(combinedOutput, options?.packageManager) : void 0;
	const ignoredBuildsOnly = exitCode !== 0 && detectIgnoredBuilds && isPnpmIgnoredBuildsError(combinedOutput);
	if (exitCode === 0 || ignoredBuildsOnly) {
		spinner.stop(`Dependencies installed`);
		return {
			durationMs: Date.now() - startTime,
			exitCode,
			status: "installed",
			pendingBuilds
		};
	} else {
		spinner.stop(`Install failed`);
		log.info(stdout.toString());
		log.error(stderr.toString());
		log.info(`You may need to run "vp install" manually in ${cwd}`);
		return {
			durationMs: Date.now() - startTime,
			exitCode,
			status: "failed"
		};
	}
}
async function runViteFmt(cwd, interactive, paths, options) {
	const spinner = options?.silent ? getSilentSpinner() : getSpinner(interactive);
	const startTime = Date.now();
	spinner.start(`Formatting code...`);
	const { exitCode, stderr, stdout } = await runCommandSilently({
		command: options?.command ?? process.env.VP_CLI_BIN ?? "vp",
		args: [
			...options?.commandArgs ?? [],
			"fmt",
			...paths ?? []
		],
		cwd,
		envs: process.env
	});
	if (exitCode === 0) {
		spinner.stop(`Code formatted`);
		return {
			durationMs: Date.now() - startTime,
			exitCode,
			status: "formatted"
		};
	} else {
		spinner.stop(`Format failed`);
		log.info(stdout.toString());
		log.error(stderr.toString());
		const joinedPaths = (paths ?? []).join(" ");
		const hint = joinedPaths.length === 0 ? `You may need to run "vp fmt" manually in ${cwd}` : joinedPaths.length <= 256 ? `You may need to run "vp fmt ${joinedPaths}" manually in ${cwd}` : `You may need to run "vp fmt" manually on the ${paths?.length} changed files in ${cwd}`;
		log.info(hint);
		return {
			durationMs: Date.now() - startTime,
			exitCode,
			status: "failed"
		};
	}
}
async function upgradeYarn(cwd, interactive, silent = false) {
	const spinner = silent ? getSilentSpinner() : getSpinner(interactive);
	spinner.start(`Running yarn set version stable...`);
	const { exitCode, stderr, stdout } = await runCommandSilently({
		command: "yarn",
		args: [
			"set",
			"version",
			"stable"
		],
		cwd,
		envs: process.env
	});
	if (exitCode === 0) spinner.stop(`Yarn upgraded to stable version`);
	else {
		spinner.stop(`yarn upgrade failed`);
		log.info(stdout.toString());
		log.error(stderr.toString());
	}
}
async function promptGitHooks(options) {
	if (options.hooks === false) return false;
	if (options.hooks === true) return true;
	if (options.interactive) {
		const selected = await confirm({
			message: options.message ?? "Set up pre-commit hooks to run formatting, linting, and type checking with auto-fixes?",
			initialValue: true
		});
		if (isCancel(selected)) {
			cancelAndExit();
			return false;
		}
		return selected;
	}
	return true;
}
async function promptGitInit(options) {
	if (options.git === false) return false;
	if (options.git === true) return true;
	if (options.interactive) {
		const selected = await confirm({
			message: "Initialize a git repository?",
			initialValue: true
		});
		if (isCancel(selected)) {
			cancelAndExit();
			return false;
		}
		return selected;
	}
	return false;
}
async function resolveGitInit(options, isMonorepo) {
	if (isMonorepo) return false;
	return promptGitInit(options);
}
function defaultInteractive() {
	return !process.env.CI && process.stdin.isTTY;
}
//#endregion
export { isCancel as A, log as C, spinner as D, select as E, text as O, intro as S, outro as T, getSpinner as _, resolveGitInit as a, require_semver as b, selectPackageManager as c, readYamlFile as d, scalarString as f, getSilentSpinner as g, resolveApproveBuildTargets as h, promptGitHooks as i, require_picocolors as k, upgradeYarn as l, detectGatedBuilds as m, defaultInteractive as n, runViteFmt as o, approveBuilds as p, downloadPackageManager$1 as r, runViteInstall as s, cancelAndExit as t, editYamlFile as u, DependencyType as v, multiselect as w, confirm as x, PackageManager as y };
