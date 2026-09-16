import { a as ansiStyles, t as stripAnsi } from "./strip-ansi-C3wrWz9t.js";
import { t as isFullwidthCodePoint } from "./is-fullwidth-code-point-BUNlIICg.js";
import { t as wrapAnsi } from "./wrap-ansi-DNjkuBEp.js";
import process$1 from "node:process";
import os from "node:os";
//#region ../../node_modules/.pnpm/environment@1.1.0/node_modules/environment/index.js
const isBrowser = globalThis.window?.document !== void 0;
globalThis.process?.versions?.node;
globalThis.process?.versions?.bun;
globalThis.Deno?.version?.deno;
globalThis.process?.versions?.electron;
globalThis.navigator?.userAgent?.includes("jsdom");
typeof WorkerGlobalScope !== "undefined" && globalThis instanceof WorkerGlobalScope;
typeof DedicatedWorkerGlobalScope !== "undefined" && globalThis instanceof DedicatedWorkerGlobalScope;
typeof SharedWorkerGlobalScope !== "undefined" && globalThis instanceof SharedWorkerGlobalScope;
typeof ServiceWorkerGlobalScope !== "undefined" && globalThis instanceof ServiceWorkerGlobalScope;
const platform = globalThis.navigator?.userAgentData?.platform;
platform === "macOS" || globalThis.navigator?.platform === "MacIntel" || globalThis.navigator?.userAgent?.includes(" Mac ") === true || globalThis.process?.platform;
platform === "Windows" || globalThis.navigator?.platform === "Win32" || globalThis.process?.platform;
platform === "Linux" || globalThis.navigator?.platform?.startsWith("Linux") === true || globalThis.navigator?.userAgent?.includes(" Linux ") === true || globalThis.process?.platform;
platform === "iOS" || globalThis.navigator?.platform === "MacIntel" && globalThis.navigator?.maxTouchPoints > 1 || /iPad|iPhone|iPod/.test(globalThis.navigator?.platform);
platform === "Android" || globalThis.navigator?.platform === "Android" || globalThis.navigator?.userAgent?.includes(" Android ") === true || globalThis.process?.platform;
//#endregion
//#region ../../node_modules/.pnpm/ansi-escapes@7.2.0/node_modules/ansi-escapes/base.js
const ESC = "\x1B[";
!isBrowser && process$1.env.TERM_PROGRAM;
const isWindows = !isBrowser && process$1.platform === "win32";
!isBrowser && (process$1.env.TERM?.startsWith("screen") || process$1.env.TERM?.startsWith("tmux") || process$1.env.TMUX);
isBrowser || process$1.cwd;
const cursorUp = (count = 1) => ESC + count + "A";
const eraseLines = (count) => {
	let clear = "";
	for (let i = 0; i < count; i++) clear += eraseLine + (i < count - 1 ? cursorUp() : "");
	if (count) clear += "\x1B[G";
	return clear;
};
const eraseLine = "\x1B[2K";
const isOldWindows = () => {
	if (isBrowser || !isWindows) return false;
	const parts = os.release().split(".");
	const major = Number(parts[0]);
	const build = Number(parts[2] ?? 0);
	if (major < 10) return true;
	if (major === 10 && build < 10586) return true;
	return false;
};
isOldWindows();
//#endregion
//#region ../../node_modules/.pnpm/mimic-function@5.0.1/node_modules/mimic-function/index.js
const copyProperty = (to, from, property, ignoreNonConfigurable) => {
	if (property === "length" || property === "prototype") return;
	if (property === "arguments" || property === "caller") return;
	const toDescriptor = Object.getOwnPropertyDescriptor(to, property);
	const fromDescriptor = Object.getOwnPropertyDescriptor(from, property);
	if (!canCopyProperty(toDescriptor, fromDescriptor) && ignoreNonConfigurable) return;
	Object.defineProperty(to, property, fromDescriptor);
};
const canCopyProperty = function(toDescriptor, fromDescriptor) {
	return toDescriptor === void 0 || toDescriptor.configurable || toDescriptor.writable === fromDescriptor.writable && toDescriptor.enumerable === fromDescriptor.enumerable && toDescriptor.configurable === fromDescriptor.configurable && (toDescriptor.writable || toDescriptor.value === fromDescriptor.value);
};
const changePrototype = (to, from) => {
	const fromPrototype = Object.getPrototypeOf(from);
	if (fromPrototype === Object.getPrototypeOf(to)) return;
	Object.setPrototypeOf(to, fromPrototype);
};
const wrappedToString = (withName, fromBody) => `/* Wrapped ${withName}*/\n${fromBody}`;
const toStringDescriptor = Object.getOwnPropertyDescriptor(Function.prototype, "toString");
const toStringName = Object.getOwnPropertyDescriptor(Function.prototype.toString, "name");
const changeToString = (to, from, name) => {
	const withName = name === "" ? "" : `with ${name.trim()}() `;
	const newToString = wrappedToString.bind(null, withName, from.toString());
	Object.defineProperty(newToString, "name", toStringName);
	const { writable, enumerable, configurable } = toStringDescriptor;
	Object.defineProperty(to, "toString", {
		value: newToString,
		writable,
		enumerable,
		configurable
	});
};
function mimicFunction(to, from, { ignoreNonConfigurable = false } = {}) {
	const { name } = to;
	for (const property of Reflect.ownKeys(from)) copyProperty(to, from, property, ignoreNonConfigurable);
	changePrototype(to, from);
	changeToString(to, from, name);
	return to;
}
//#endregion
//#region ../../node_modules/.pnpm/onetime@7.0.0/node_modules/onetime/index.js
const calledFunctions = /* @__PURE__ */ new WeakMap();
const onetime = (function_, options = {}) => {
	if (typeof function_ !== "function") throw new TypeError("Expected a function");
	let returnValue;
	let callCount = 0;
	const functionName = function_.displayName || function_.name || "<anonymous>";
	const onetime = function(...arguments_) {
		calledFunctions.set(onetime, ++callCount);
		if (callCount === 1) {
			returnValue = function_.apply(this, arguments_);
			function_ = void 0;
		} else if (options.throw === true) throw new Error(`Function \`${functionName}\` can only be called once`);
		return returnValue;
	};
	mimicFunction(onetime, function_);
	calledFunctions.set(onetime, callCount);
	return onetime;
};
onetime.callCount = (function_) => {
	if (!calledFunctions.has(function_)) throw new Error(`The given function \`${function_.name}\` is not wrapped by the \`onetime\` package`);
	return calledFunctions.get(function_);
};
//#endregion
//#region ../../node_modules/.pnpm/signal-exit@4.1.0/node_modules/signal-exit/dist/mjs/signals.js
/**
* This is not the set of all possible signals.
*
* It IS, however, the set of all signals that trigger
* an exit on either Linux or BSD systems.  Linux is a
* superset of the signal names supported on BSD, and
* the unknown signals just fail to register, so we can
* catch that easily enough.
*
* Windows signals are a different set, since there are
* signals that terminate Windows processes, but don't
* terminate (or don't even exist) on Posix systems.
*
* Don't bother with SIGKILL.  It's uncatchable, which
* means that we can't fire any callbacks anyway.
*
* If a user does happen to register a handler on a non-
* fatal signal like SIGWINCH or something, and then
* exit, it'll end up firing `process.emit('exit')`, so
* the handler will be fired anyway.
*
* SIGBUS, SIGFPE, SIGSEGV and SIGILL, when not raised
* artificially, inherently leave the process in a
* state from which it is not safe to try and enter JS
* listeners.
*/
const signals = [];
signals.push("SIGHUP", "SIGINT", "SIGTERM");
if (process.platform !== "win32") signals.push("SIGALRM", "SIGABRT", "SIGVTALRM", "SIGXCPU", "SIGXFSZ", "SIGUSR2", "SIGTRAP", "SIGSYS", "SIGQUIT", "SIGIOT");
if (process.platform === "linux") signals.push("SIGIO", "SIGPOLL", "SIGPWR", "SIGSTKFLT");
//#endregion
//#region ../../node_modules/.pnpm/signal-exit@4.1.0/node_modules/signal-exit/dist/mjs/index.js
const processOk = (process) => !!process && typeof process === "object" && typeof process.removeListener === "function" && typeof process.emit === "function" && typeof process.reallyExit === "function" && typeof process.listeners === "function" && typeof process.kill === "function" && typeof process.pid === "number" && typeof process.on === "function";
const kExitEmitter = Symbol.for("signal-exit emitter");
const global = globalThis;
const ObjectDefineProperty = Object.defineProperty.bind(Object);
var Emitter = class {
	emitted = {
		afterExit: false,
		exit: false
	};
	listeners = {
		afterExit: [],
		exit: []
	};
	count = 0;
	id = Math.random();
	constructor() {
		if (global[kExitEmitter]) return global[kExitEmitter];
		ObjectDefineProperty(global, kExitEmitter, {
			value: this,
			writable: false,
			enumerable: false,
			configurable: false
		});
	}
	on(ev, fn) {
		this.listeners[ev].push(fn);
	}
	removeListener(ev, fn) {
		const list = this.listeners[ev];
		const i = list.indexOf(fn);
		/* c8 ignore start */
		if (i === -1) return;
		/* c8 ignore stop */
		if (i === 0 && list.length === 1) list.length = 0;
		else list.splice(i, 1);
	}
	emit(ev, code, signal) {
		if (this.emitted[ev]) return false;
		this.emitted[ev] = true;
		let ret = false;
		for (const fn of this.listeners[ev]) ret = fn(code, signal) === true || ret;
		if (ev === "exit") ret = this.emit("afterExit", code, signal) || ret;
		return ret;
	}
};
var SignalExitBase = class {};
const signalExitWrap = (handler) => {
	return {
		onExit(cb, opts) {
			return handler.onExit(cb, opts);
		},
		load() {
			return handler.load();
		},
		unload() {
			return handler.unload();
		}
	};
};
var SignalExitFallback = class extends SignalExitBase {
	onExit() {
		return () => {};
	}
	load() {}
	unload() {}
};
var SignalExit = class extends SignalExitBase {
	/* c8 ignore start */
	#hupSig = process$2.platform === "win32" ? "SIGINT" : "SIGHUP";
	/* c8 ignore stop */
	#emitter = new Emitter();
	#process;
	#originalProcessEmit;
	#originalProcessReallyExit;
	#sigListeners = {};
	#loaded = false;
	constructor(process) {
		super();
		this.#process = process;
		this.#sigListeners = {};
		for (const sig of signals) this.#sigListeners[sig] = () => {
			const listeners = this.#process.listeners(sig);
			let { count } = this.#emitter;
			/* c8 ignore start */
			const p = process;
			if (typeof p.__signal_exit_emitter__ === "object" && typeof p.__signal_exit_emitter__.count === "number") count += p.__signal_exit_emitter__.count;
			/* c8 ignore stop */
			if (listeners.length === count) {
				this.unload();
				const ret = this.#emitter.emit("exit", null, sig);
				/* c8 ignore start */
				const s = sig === "SIGHUP" ? this.#hupSig : sig;
				if (!ret) process.kill(process.pid, s);
			}
		};
		this.#originalProcessReallyExit = process.reallyExit;
		this.#originalProcessEmit = process.emit;
	}
	onExit(cb, opts) {
		/* c8 ignore start */
		if (!processOk(this.#process)) return () => {};
		/* c8 ignore stop */
		if (this.#loaded === false) this.load();
		const ev = opts?.alwaysLast ? "afterExit" : "exit";
		this.#emitter.on(ev, cb);
		return () => {
			this.#emitter.removeListener(ev, cb);
			if (this.#emitter.listeners["exit"].length === 0 && this.#emitter.listeners["afterExit"].length === 0) this.unload();
		};
	}
	load() {
		if (this.#loaded) return;
		this.#loaded = true;
		this.#emitter.count += 1;
		for (const sig of signals) try {
			const fn = this.#sigListeners[sig];
			if (fn) this.#process.on(sig, fn);
		} catch (_) {}
		this.#process.emit = (ev, ...a) => {
			return this.#processEmit(ev, ...a);
		};
		this.#process.reallyExit = (code) => {
			return this.#processReallyExit(code);
		};
	}
	unload() {
		if (!this.#loaded) return;
		this.#loaded = false;
		signals.forEach((sig) => {
			const listener = this.#sigListeners[sig];
			/* c8 ignore start */
			if (!listener) throw new Error("Listener not defined for signal: " + sig);
			/* c8 ignore stop */
			try {
				this.#process.removeListener(sig, listener);
			} catch (_) {}
			/* c8 ignore stop */
		});
		this.#process.emit = this.#originalProcessEmit;
		this.#process.reallyExit = this.#originalProcessReallyExit;
		this.#emitter.count -= 1;
	}
	#processReallyExit(code) {
		/* c8 ignore start */
		if (!processOk(this.#process)) return 0;
		this.#process.exitCode = code || 0;
		/* c8 ignore stop */
		this.#emitter.emit("exit", this.#process.exitCode, null);
		return this.#originalProcessReallyExit.call(this.#process, this.#process.exitCode);
	}
	#processEmit(ev, ...args) {
		const og = this.#originalProcessEmit;
		if (ev === "exit" && processOk(this.#process)) {
			if (typeof args[0] === "number") this.#process.exitCode = args[0];
			/* c8 ignore start */
			const ret = og.call(this.#process, ev, ...args);
			/* c8 ignore start */
			this.#emitter.emit("exit", this.#process.exitCode, null);
			/* c8 ignore stop */
			return ret;
		} else return og.call(this.#process, ev, ...args);
	}
};
const process$2 = globalThis.process;
const { onExit, load, unload } = signalExitWrap(processOk(process$2) ? new SignalExit(process$2) : new SignalExitFallback());
//#endregion
//#region ../../node_modules/.pnpm/restore-cursor@5.1.0/node_modules/restore-cursor/index.js
const terminal = process$1.stderr.isTTY ? process$1.stderr : process$1.stdout.isTTY ? process$1.stdout : void 0;
const restoreCursor = terminal ? onetime(() => {
	onExit(() => {
		terminal.write("\x1B[?25h");
	}, { alwaysLast: true });
}) : () => {};
//#endregion
//#region ../../node_modules/.pnpm/cli-cursor@5.0.0/node_modules/cli-cursor/index.js
let isHidden = false;
const cliCursor = {};
cliCursor.show = (writableStream = process$1.stderr) => {
	if (!writableStream.isTTY) return;
	isHidden = false;
	writableStream.write("\x1B[?25h");
};
cliCursor.hide = (writableStream = process$1.stderr) => {
	if (!writableStream.isTTY) return;
	restoreCursor();
	isHidden = true;
	writableStream.write("\x1B[?25l");
};
cliCursor.toggle = (force, writableStream) => {
	if (force !== void 0) isHidden = force;
	if (isHidden) cliCursor.show(writableStream);
	else cliCursor.hide(writableStream);
};
//#endregion
//#region ../../node_modules/.pnpm/slice-ansi@7.1.2/node_modules/slice-ansi/index.js
const ESCAPES = /* @__PURE__ */ new Set([27, 155]);
const CODE_POINT_0 = "0".codePointAt(0);
const CODE_POINT_9 = "9".codePointAt(0);
const MAX_ANSI_SEQUENCE_LENGTH = 19;
const endCodesSet = /* @__PURE__ */ new Set();
const endCodesMap = /* @__PURE__ */ new Map();
for (const [start, end] of ansiStyles.codes) {
	endCodesSet.add(ansiStyles.color.ansi(end));
	endCodesMap.set(ansiStyles.color.ansi(start), ansiStyles.color.ansi(end));
}
function getEndCode(code) {
	if (endCodesSet.has(code)) return code;
	if (endCodesMap.has(code)) return endCodesMap.get(code);
	code = code.slice(2);
	if (code.includes(";")) code = code[0] + "0";
	const returnValue = ansiStyles.codes.get(Number.parseInt(code, 10));
	if (returnValue) return ansiStyles.color.ansi(returnValue);
	return ansiStyles.reset.open;
}
function findNumberIndex(string) {
	for (let index = 0; index < string.length; index++) {
		const codePoint = string.codePointAt(index);
		if (codePoint >= CODE_POINT_0 && codePoint <= CODE_POINT_9) return index;
	}
	return -1;
}
function parseAnsiCode(string, offset) {
	string = string.slice(offset, offset + MAX_ANSI_SEQUENCE_LENGTH);
	const startIndex = findNumberIndex(string);
	if (startIndex !== -1) {
		let endIndex = string.indexOf("m", startIndex);
		if (endIndex === -1) endIndex = string.length;
		return string.slice(0, endIndex + 1);
	}
}
function tokenize(string, endCharacter = Number.POSITIVE_INFINITY) {
	const returnValue = [];
	let index = 0;
	let visibleCount = 0;
	while (index < string.length) {
		const codePoint = string.codePointAt(index);
		if (ESCAPES.has(codePoint)) {
			const code = parseAnsiCode(string, index);
			if (code) {
				returnValue.push({
					type: "ansi",
					code,
					endCode: getEndCode(code)
				});
				index += code.length;
				continue;
			}
		}
		const isFullWidth = isFullwidthCodePoint(codePoint);
		const character = String.fromCodePoint(codePoint);
		returnValue.push({
			type: "character",
			value: character,
			isFullWidth
		});
		index += character.length;
		visibleCount += isFullWidth ? 2 : character.length;
		if (visibleCount >= endCharacter) break;
	}
	return returnValue;
}
function reduceAnsiCodes(codes) {
	let returnValue = [];
	for (const code of codes) if (code.code === ansiStyles.reset.open) returnValue = [];
	else if (endCodesSet.has(code.code)) returnValue = returnValue.filter((returnValueCode) => returnValueCode.endCode !== code.code);
	else {
		returnValue = returnValue.filter((returnValueCode) => returnValueCode.endCode !== code.endCode);
		returnValue.push(code);
	}
	return returnValue;
}
function undoAnsiCodes(codes) {
	return reduceAnsiCodes(codes).map(({ endCode }) => endCode).reverse().join("");
}
function sliceAnsi(string, start, end) {
	const tokens = tokenize(string, end);
	let activeCodes = [];
	let position = 0;
	let returnValue = "";
	let include = false;
	for (const token of tokens) {
		if (end !== void 0 && position >= end) break;
		if (token.type === "ansi") {
			activeCodes.push(token);
			if (include) returnValue += token.code;
		} else {
			if (!include && position >= start) {
				include = true;
				activeCodes = reduceAnsiCodes(activeCodes);
				returnValue = activeCodes.map(({ code }) => code).join("");
			}
			if (include) returnValue += token.value;
			position += token.isFullWidth ? 2 : token.value.length;
		}
	}
	returnValue += undoAnsiCodes(activeCodes);
	return returnValue;
}
//#endregion
//#region ../../node_modules/.pnpm/log-update@6.1.0/node_modules/log-update/index.js
const defaultTerminalHeight = 24;
const getWidth = ({ columns = 80 }) => columns;
const fitToTerminalHeight = (stream, text) => {
	const terminalHeight = stream.rows ?? defaultTerminalHeight;
	const lines = text.split("\n");
	const toRemove = Math.max(0, lines.length - terminalHeight);
	return toRemove ? sliceAnsi(text, stripAnsi(lines.slice(0, toRemove).join("\n")).length + 1) : text;
};
function createLogUpdate(stream, { showCursor = false } = {}) {
	let previousLineCount = 0;
	let previousWidth = getWidth(stream);
	let previousOutput = "";
	const reset = () => {
		previousOutput = "";
		previousWidth = getWidth(stream);
		previousLineCount = 0;
	};
	const render = (...arguments_) => {
		if (!showCursor) cliCursor.hide();
		let output = fitToTerminalHeight(stream, arguments_.join(" ") + "\n");
		const width = getWidth(stream);
		if (output === previousOutput && previousWidth === width) return;
		previousOutput = output;
		previousWidth = width;
		output = wrapAnsi(output, width, {
			trim: false,
			hard: true,
			wordWrap: false
		});
		stream.write(eraseLines(previousLineCount) + output);
		previousLineCount = output.split("\n").length;
	};
	render.clear = () => {
		stream.write(eraseLines(previousLineCount));
		reset();
	};
	render.done = () => {
		reset();
		if (!showCursor) cliCursor.show();
	};
	return render;
}
createLogUpdate(process$1.stdout);
createLogUpdate(process$1.stderr);
//#endregion
export { createLogUpdate };
