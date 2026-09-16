import { r as __toESM, t as __commonJSMin } from "../rolldown-runtime-CMFfr-1z.js";
import { t as renderCliDoc } from "../help-BmKpeOP9.js";
import { i as log, n as errorMsg, o as printHeader } from "../terminal-MKGAuy-p.js";
import { a as resolveViteConfig } from "../resolve-vite-config-ipGb39Jo.js";
import { t as lib_default } from "../lib-L3DWSRQp.js";
import { createRequire } from "node:module";
import path, { basename, delimiter, dirname, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { formatWithOptions, inspect, promisify } from "node:util";
import { closeSync, constants, openSync, readSync, statSync } from "node:fs";
import { cwd } from "node:process";
import l__default from "node:readline";
import nodeTty from "node:tty";
import crypto from "node:crypto";
import { EOL } from "node:os";
import fsPromises, { constants as constants$2 } from "node:fs/promises";
import { PassThrough, Writable } from "node:stream";
import { exec, spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import * as tty from "tty";
import { format } from "util";
import { EOL as EOL$1 } from "os";
import { StringDecoder } from "string_decoder";
import { Writable as Writable$1 } from "stream";
import { randomUUID as randomUUID$1 } from "crypto";
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/colors.js
/**
* @example NO_COLOR
* @example NO_COLOR=1
* @example NO_COLOR=true
*/
const TRUTHRY_ENV_VAR_VALUES = [
	"",
	"1",
	"true"
];
/**
* @example FORCE_COLOR=0
* @example FORCE_COLOR=false
*/
const FALSY_ENV_VAR_VALUES = ["0", "false"];
/**
* @returns `true` if ANSI colors are supported
*
* @param {NodeJS.Process} [p]
* @param {boolean} [isTty]
*/
const supportsAnsiColors = (p = process, isTty = nodeTty.isatty(1)) => {
	const noColor = p?.env?.NO_COLOR?.toLowerCase();
	if (TRUTHRY_ENV_VAR_VALUES.includes(noColor)) return false;
	const forceColor = p?.env?.FORCE_COLOR?.toLowerCase();
	if (TRUTHRY_ENV_VAR_VALUES.includes(forceColor)) return true;
	else if (FALSY_ENV_VAR_VALUES.includes(forceColor)) return false;
	const forceTty = p?.env?.FORCE_TTY;
	if (TRUTHRY_ENV_VAR_VALUES.includes(forceTty)) return true;
	else if (FALSY_ENV_VAR_VALUES.includes(forceTty)) return false;
	if (isTty) return true;
	/**
	* Assume CI supports color
	* @see {@link https://github.com/alexeyraspopov/picocolors/blob/0e7c4af2de299dd7bc5916f2bddd151fa2f66740/picocolors.js#L4}
	* @see {@link https://github.com/tinylibs/tinyrainbow/blob/071034bf2eafa28d91ef0ba48a3837420d81a40a/src/index.ts#L91}
	*/
	if (TRUTHRY_ENV_VAR_VALUES.includes(p?.env?.CI)) return true;
	if (p?.env?.TERM && p.env.TERM === "dumb") return false;
	/**
	* Assume Windows supports color
	* @see {@link https://github.com/alexeyraspopov/picocolors/blob/0e7c4af2de299dd7bc5916f2bddd151fa2f66740/picocolors.js#L4}
	* @see {@link https://github.com/tinylibs/tinyrainbow/blob/071034bf2eafa28d91ef0ba48a3837420d81a40a/src/index.ts#L89}
	*/
	if (p?.platform === "win32") return true;
	return false;
};
/**
* @deprecated replace this with Node.js builtin after minimum supported version is >=20.18.0
* @example util.styleText('red', 'test') !== 'text'
*/
const SUPPORTS_COLOR = supportsAnsiColors();
const ANSI_RESET = "\x1B[0m";
/**
* @callback WrapAnsi
* @param {string} text
* @returns {string}
*/
/**
* @deprecated replace this with Node.js builtin after minimum supported version is >=20.18.0
* @example (format) => (text) => util.styleText(format, text)
*
* @param {string} code
* @param {boolean} [supported]
* @returns {WrapAnsi}
*
*/
const wrapAnsiColor = (code, supported = SUPPORTS_COLOR) => {
	if (supported) return (text) => code + text + ANSI_RESET;
	return (text) => text;
};
const red$1 = wrapAnsiColor("\x1B[0;31m");
const yellow$1 = wrapAnsiColor("\x1B[0;33m");
const blue$1 = wrapAnsiColor("\x1B[0;34m");
const blackBright$1 = wrapAnsiColor("\x1B[0;90m");
const bold$1 = wrapAnsiColor("\x1B[1m");
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/debug.js
const format$1 = (...args) => formatWithOptions({ colors: SUPPORTS_COLOR }, ...args);
let activeLogger;
const enableDebug = (logger = console) => {
	if (!activeLogger) activeLogger = logger;
};
/** @param {string} name */
const createDebug = (name) => {
	let previous = process.hrtime.bigint();
	return (...args) => {
		if (!activeLogger) return;
		const now = process.hrtime.bigint();
		const ms = (now - previous) / 1000000n;
		previous = now;
		activeLogger.debug(blackBright$1(name + ": ") + format$1(...args) + blackBright$1(` +${ms}ms`));
	};
};
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
const isWindows$1 = process.platform === "win32";
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
	if (options.shell === true || !isWindows$1) return {
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
		return exec$1(command, args, {
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
		const rl = l__default.createInterface({ input: streamCombined });
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
const exec$1 = x;
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/execGit.js
const debugLog$15 = createDebug("lint-staged:execGit");
/** @example "warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it" */
const GIT_CRLF_WARNING = /^warning.*CRLF.*the next time Git touches it/i;
/**
* Explicitly never recurse commands into submodules, overriding local/global configuration.
* @see https://git-scm.com/docs/git-config#Documentation/git-config.txt-submodulerecurse
*/
const NO_SUBMODULE_RECURSE = ["-c", "submodule.recurse=false"];
[...NO_SUBMODULE_RECURSE];
/** @type {(cmd: string[], options?: { cwd?: string }) => Promise<string>} */
const execGit = async (cmd, options) => {
	debugLog$15("Running git command:", cmd);
	const result = exec$1("git", [...NO_SUBMODULE_RECURSE, ...cmd], { nodeOptions: {
		cwd: options?.cwd,
		stdio: ["ignore"]
	} });
	let output = "";
	for await (const line of result) {
		if (GIT_CRLF_WARNING.test(line)) {
			debugLog$15("Stripped Git CRLF warning: %s", line);
			continue;
		}
		output += line + "\n";
	}
	output = output.trimEnd();
	if (result.exitCode > 0) throw new Error(output, { cause: result });
	return output;
};
var eventemitter3_default = (/* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	var has = Object.prototype.hasOwnProperty;
	var prefix = "~";
	/**
	* Constructor to create a storage for our `EE` objects.
	* An `Events` instance is a plain object whose properties are event names.
	*
	* @constructor
	* @private
	*/
	function Events() {}
	if (Object.create) {
		Events.prototype = Object.create(null);
		if (!new Events().__proto__) prefix = false;
	}
	/**
	* Representation of a single event listener.
	*
	* @param {Function} fn The listener function.
	* @param {*} context The context to invoke the listener with.
	* @param {Boolean} [once=false] Specify if the listener is a one-time listener.
	* @constructor
	* @private
	*/
	function EE(fn, context, once) {
		this.fn = fn;
		this.context = context;
		this.once = once || false;
	}
	/**
	* Add a listener for a given event.
	*
	* @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn The listener function.
	* @param {*} context The context to invoke the listener with.
	* @param {Boolean} once Specify if the listener is a one-time listener.
	* @returns {EventEmitter}
	* @private
	*/
	function addListener(emitter, event, fn, context, once) {
		if (typeof fn !== "function") throw new TypeError("The listener must be a function");
		var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
		if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
		else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
		else emitter._events[evt] = [emitter._events[evt], listener];
		return emitter;
	}
	/**
	* Clear event by name.
	*
	* @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	* @param {(String|Symbol)} evt The Event name.
	* @private
	*/
	function clearEvent(emitter, evt) {
		if (--emitter._eventsCount === 0) emitter._events = new Events();
		else delete emitter._events[evt];
	}
	/**
	* Minimal `EventEmitter` interface that is molded against the Node.js
	* `EventEmitter` interface.
	*
	* @constructor
	* @public
	*/
	function EventEmitter() {
		this._events = new Events();
		this._eventsCount = 0;
	}
	/**
	* Return an array listing the events for which the emitter has registered
	* listeners.
	*
	* @returns {Array}
	* @public
	*/
	EventEmitter.prototype.eventNames = function eventNames() {
		var names = [], events, name;
		if (this._eventsCount === 0) return names;
		for (name in events = this._events) if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
		if (Object.getOwnPropertySymbols) return names.concat(Object.getOwnPropertySymbols(events));
		return names;
	};
	/**
	* Return the listeners registered for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @returns {Array} The registered listeners.
	* @public
	*/
	EventEmitter.prototype.listeners = function listeners(event) {
		var evt = prefix ? prefix + event : event, handlers = this._events[evt];
		if (!handlers) return [];
		if (handlers.fn) return [handlers.fn];
		for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) ee[i] = handlers[i].fn;
		return ee;
	};
	/**
	* Return the number of listeners listening to a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @returns {Number} The number of listeners.
	* @public
	*/
	EventEmitter.prototype.listenerCount = function listenerCount(event) {
		var evt = prefix ? prefix + event : event, listeners = this._events[evt];
		if (!listeners) return 0;
		if (listeners.fn) return 1;
		return listeners.length;
	};
	/**
	* Calls each of the listeners registered for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @returns {Boolean} `true` if the event had listeners, else `false`.
	* @public
	*/
	EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
		var evt = prefix ? prefix + event : event;
		if (!this._events[evt]) return false;
		var listeners = this._events[evt], len = arguments.length, args, i;
		if (listeners.fn) {
			if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
			switch (len) {
				case 1: return listeners.fn.call(listeners.context), true;
				case 2: return listeners.fn.call(listeners.context, a1), true;
				case 3: return listeners.fn.call(listeners.context, a1, a2), true;
				case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
				case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
				case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
			}
			for (i = 1, args = new Array(len - 1); i < len; i++) args[i - 1] = arguments[i];
			listeners.fn.apply(listeners.context, args);
		} else {
			var length = listeners.length, j;
			for (i = 0; i < length; i++) {
				if (listeners[i].once) this.removeListener(event, listeners[i].fn, void 0, true);
				switch (len) {
					case 1:
						listeners[i].fn.call(listeners[i].context);
						break;
					case 2:
						listeners[i].fn.call(listeners[i].context, a1);
						break;
					case 3:
						listeners[i].fn.call(listeners[i].context, a1, a2);
						break;
					case 4:
						listeners[i].fn.call(listeners[i].context, a1, a2, a3);
						break;
					default:
						if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) args[j - 1] = arguments[j];
						listeners[i].fn.apply(listeners[i].context, args);
				}
			}
		}
		return true;
	};
	/**
	* Add a listener for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn The listener function.
	* @param {*} [context=this] The context to invoke the listener with.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.on = function on(event, fn, context) {
		return addListener(this, event, fn, context, false);
	};
	/**
	* Add a one-time listener for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn The listener function.
	* @param {*} [context=this] The context to invoke the listener with.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.once = function once(event, fn, context) {
		return addListener(this, event, fn, context, true);
	};
	/**
	* Remove the listeners of a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn Only remove the listeners that match this function.
	* @param {*} context Only remove the listeners that have this context.
	* @param {Boolean} once Only remove one-time listeners.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
		var evt = prefix ? prefix + event : event;
		if (!this._events[evt]) return this;
		if (!fn) {
			clearEvent(this, evt);
			return this;
		}
		var listeners = this._events[evt];
		if (listeners.fn) {
			if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) clearEvent(this, evt);
		} else {
			for (var i = 0, events = [], length = listeners.length; i < length; i++) if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) events.push(listeners[i]);
			if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
			else clearEvent(this, evt);
		}
		return this;
	};
	/**
	* Remove all listeners, or those of the specified event.
	*
	* @param {(String|Symbol)} [event] The event name.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
		var evt;
		if (event) {
			evt = prefix ? prefix + event : event;
			if (this._events[evt]) clearEvent(this, evt);
		} else {
			this._events = new Events();
			this._eventsCount = 0;
		}
		return this;
	};
	EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
	EventEmitter.prototype.addListener = EventEmitter.prototype.on;
	EventEmitter.prefixed = prefix;
	EventEmitter.EventEmitter = EventEmitter;
	if ("undefined" !== typeof module) module.exports = EventEmitter;
})))(), 1)).default;
//#endregion
//#region ../../node_modules/.pnpm/colorette@2.0.20/node_modules/colorette/index.js
const { env = {}, argv = [], platform = "" } = typeof process === "undefined" ? {} : process;
const isDisabled = "NO_COLOR" in env || argv.includes("--no-color");
const isForced = "FORCE_COLOR" in env || argv.includes("--color");
const isWindows = platform === "win32";
const isDumbTerminal = env.TERM === "dumb";
const isCompatibleTerminal = tty && tty.isatty && tty.isatty(1) && env.TERM && !isDumbTerminal;
const isCI = "CI" in env && ("GITHUB_ACTIONS" in env || "GITLAB_CI" in env || "CIRCLECI" in env);
const isColorSupported = !isDisabled && (isForced || isWindows && !isDumbTerminal || isCompatibleTerminal || isCI);
const replaceClose = (index, string, close, replace, head = string.substring(0, index) + replace, tail = string.substring(index + close.length), next = tail.indexOf(close)) => head + (next < 0 ? tail : replaceClose(next, tail, close, replace));
const clearBleed = (index, string, open, close, replace) => index < 0 ? open + string + close : open + replaceClose(index, string, close, replace) + close;
const filterEmpty = (open, close, replace = open, at = open.length + 1) => (string) => string || !(string === "" || string === void 0) ? clearBleed(("" + string).indexOf(close, at), string, open, close, replace) : "";
const init = (open, close, replace) => filterEmpty(`\x1b[${open}m`, `\x1b[${close}m`, replace);
const colors = {
	reset: init(0, 0),
	bold: init(1, 22, "\x1B[22m\x1B[1m"),
	dim: init(2, 22, "\x1B[22m\x1B[2m"),
	italic: init(3, 23),
	underline: init(4, 24),
	inverse: init(7, 27),
	hidden: init(8, 28),
	strikethrough: init(9, 29),
	black: init(30, 39),
	red: init(31, 39),
	green: init(32, 39),
	yellow: init(33, 39),
	blue: init(34, 39),
	magenta: init(35, 39),
	cyan: init(36, 39),
	white: init(37, 39),
	gray: init(90, 39),
	bgBlack: init(40, 49),
	bgRed: init(41, 49),
	bgGreen: init(42, 49),
	bgYellow: init(43, 49),
	bgBlue: init(44, 49),
	bgMagenta: init(45, 49),
	bgCyan: init(46, 49),
	bgWhite: init(47, 49),
	blackBright: init(90, 39),
	redBright: init(91, 39),
	greenBright: init(92, 39),
	yellowBright: init(93, 39),
	blueBright: init(94, 39),
	magentaBright: init(95, 39),
	cyanBright: init(96, 39),
	whiteBright: init(97, 39),
	bgBlackBright: init(100, 49),
	bgRedBright: init(101, 49),
	bgGreenBright: init(102, 49),
	bgYellowBright: init(103, 49),
	bgBlueBright: init(104, 49),
	bgMagentaBright: init(105, 49),
	bgCyanBright: init(106, 49),
	bgWhiteBright: init(107, 49)
};
const createColors = ({ useColor = isColorSupported } = {}) => useColor ? colors : Object.keys(colors).reduce((colors, key) => ({
	...colors,
	[key]: String
}), {});
const { reset, bold, dim, italic, underline, inverse, hidden, strikethrough, black, red, green, yellow, blue, magenta, cyan, white, gray, bgBlack, bgRed, bgGreen, bgYellow, bgBlue, bgMagenta, bgCyan, bgWhite, blackBright, redBright, greenBright, yellowBright, blueBright, magentaBright, cyanBright, whiteBright, bgBlackBright, bgRedBright, bgGreenBright, bgYellowBright, bgBlueBright, bgMagentaBright, bgCyanBright, bgWhiteBright } = createColors();
//#endregion
//#region ../../node_modules/.pnpm/listr2@9.0.5/node_modules/listr2/dist/index.js
var import_rfdc = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = rfdc;
	function copyBuffer(cur) {
		if (cur instanceof Buffer) return Buffer.from(cur);
		return new cur.constructor(cur.buffer.slice(), cur.byteOffset, cur.length);
	}
	function rfdc(opts) {
		opts = opts || {};
		if (opts.circles) return rfdcCircles(opts);
		const constructorHandlers = /* @__PURE__ */ new Map();
		constructorHandlers.set(Date, (o) => new Date(o));
		constructorHandlers.set(Map, (o, fn) => new Map(cloneArray(Array.from(o), fn)));
		constructorHandlers.set(Set, (o, fn) => new Set(cloneArray(Array.from(o), fn)));
		if (opts.constructorHandlers) for (const handler of opts.constructorHandlers) constructorHandlers.set(handler[0], handler[1]);
		let handler = null;
		return opts.proto ? cloneProto : clone;
		function cloneArray(a, fn) {
			const keys = Object.keys(a);
			const a2 = new Array(keys.length);
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				const cur = a[k];
				if (typeof cur !== "object" || cur === null) a2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) a2[k] = handler(cur, fn);
				else if (ArrayBuffer.isView(cur)) a2[k] = copyBuffer(cur);
				else a2[k] = fn(cur);
			}
			return a2;
		}
		function clone(o) {
			if (typeof o !== "object" || o === null) return o;
			if (Array.isArray(o)) return cloneArray(o, clone);
			if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) return handler(o, clone);
			const o2 = {};
			for (const k in o) {
				if (Object.hasOwnProperty.call(o, k) === false) continue;
				const cur = o[k];
				if (typeof cur !== "object" || cur === null) o2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) o2[k] = handler(cur, clone);
				else if (ArrayBuffer.isView(cur)) o2[k] = copyBuffer(cur);
				else o2[k] = clone(cur);
			}
			return o2;
		}
		function cloneProto(o) {
			if (typeof o !== "object" || o === null) return o;
			if (Array.isArray(o)) return cloneArray(o, cloneProto);
			if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) return handler(o, cloneProto);
			const o2 = {};
			for (const k in o) {
				const cur = o[k];
				if (typeof cur !== "object" || cur === null) o2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) o2[k] = handler(cur, cloneProto);
				else if (ArrayBuffer.isView(cur)) o2[k] = copyBuffer(cur);
				else o2[k] = cloneProto(cur);
			}
			return o2;
		}
	}
	function rfdcCircles(opts) {
		const refs = [];
		const refsNew = [];
		const constructorHandlers = /* @__PURE__ */ new Map();
		constructorHandlers.set(Date, (o) => new Date(o));
		constructorHandlers.set(Map, (o, fn) => new Map(cloneArray(Array.from(o), fn)));
		constructorHandlers.set(Set, (o, fn) => new Set(cloneArray(Array.from(o), fn)));
		if (opts.constructorHandlers) for (const handler of opts.constructorHandlers) constructorHandlers.set(handler[0], handler[1]);
		let handler = null;
		return opts.proto ? cloneProto : clone;
		function cloneArray(a, fn) {
			const keys = Object.keys(a);
			const a2 = new Array(keys.length);
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				const cur = a[k];
				if (typeof cur !== "object" || cur === null) a2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) a2[k] = handler(cur, fn);
				else if (ArrayBuffer.isView(cur)) a2[k] = copyBuffer(cur);
				else {
					const index = refs.indexOf(cur);
					if (index !== -1) a2[k] = refsNew[index];
					else a2[k] = fn(cur);
				}
			}
			return a2;
		}
		function clone(o) {
			if (typeof o !== "object" || o === null) return o;
			if (Array.isArray(o)) return cloneArray(o, clone);
			if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) return handler(o, clone);
			const o2 = {};
			refs.push(o);
			refsNew.push(o2);
			for (const k in o) {
				if (Object.hasOwnProperty.call(o, k) === false) continue;
				const cur = o[k];
				if (typeof cur !== "object" || cur === null) o2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) o2[k] = handler(cur, clone);
				else if (ArrayBuffer.isView(cur)) o2[k] = copyBuffer(cur);
				else {
					const i = refs.indexOf(cur);
					if (i !== -1) o2[k] = refsNew[i];
					else o2[k] = clone(cur);
				}
			}
			refs.pop();
			refsNew.pop();
			return o2;
		}
		function cloneProto(o) {
			if (typeof o !== "object" || o === null) return o;
			if (Array.isArray(o)) return cloneArray(o, cloneProto);
			if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) return handler(o, cloneProto);
			const o2 = {};
			refs.push(o);
			refsNew.push(o2);
			for (const k in o) {
				const cur = o[k];
				if (typeof cur !== "object" || cur === null) o2[k] = cur;
				else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) o2[k] = handler(cur, cloneProto);
				else if (ArrayBuffer.isView(cur)) o2[k] = copyBuffer(cur);
				else {
					const i = refs.indexOf(cur);
					if (i !== -1) o2[k] = refsNew[i];
					else o2[k] = cloneProto(cur);
				}
			}
			refs.pop();
			refsNew.pop();
			return o2;
		}
	}
})))(), 1);
/**
* Generic ANSI escape characters for terminal based operations.
*/
const ANSI_ESCAPE_CODES = {
	CURSOR_HIDE: "\x1B[?25l",
	CURSOR_SHOW: "\x1B[?25h"
};
/**
* Environment variables for Listr.
*/
let ListrEnvironmentVariables = /* @__PURE__ */ function(ListrEnvironmentVariables$1) {
	ListrEnvironmentVariables$1["FORCE_UNICODE"] = "LISTR_FORCE_UNICODE";
	ListrEnvironmentVariables$1["FORCE_TTY"] = "LISTR_FORCE_TTY";
	ListrEnvironmentVariables$1["DISABLE_COLOR"] = "NO_COLOR";
	ListrEnvironmentVariables$1["FORCE_COLOR"] = "FORCE_COLOR";
	return ListrEnvironmentVariables$1;
}({});
/**
* The actual error type that is collected and to help identify where the error is triggered from.
*/
let ListrErrorTypes = /* @__PURE__ */ function(ListrErrorTypes$1) {
	/** Task has failed and will try to retry. */
	ListrErrorTypes$1["WILL_RETRY"] = "WILL_RETRY";
	/** Task has failed and will try to rollback. */
	ListrErrorTypes$1["WILL_ROLLBACK"] = "WILL_ROLLBACK";
	/** Task has failed, ran the rollback action but the rollback action itself has failed. */
	ListrErrorTypes$1["HAS_FAILED_TO_ROLLBACK"] = "HAS_FAILED_TO_ROLLBACK";
	/** Task has failed. */
	ListrErrorTypes$1["HAS_FAILED"] = "HAS_FAILED";
	/** Task has failed, but exitOnError is set to false, so will ignore this error. */
	ListrErrorTypes$1["HAS_FAILED_WITHOUT_ERROR"] = "HAS_FAILED_WITHOUT_ERROR";
	return ListrErrorTypes$1;
}({});
/**
* Events that are triggered by Listr.
*
* These are stateful and singleton events by being attached to the main Listr class and propagating to the subtasks.
*
* @see {@link https://listr2.kilic.dev/listr/events.html}
*/
let ListrEventType = /* @__PURE__ */ function(ListrEventType$1) {
	/** Indicates that underlying renderer should refresh the current render. */
	ListrEventType$1["SHOULD_REFRESH_RENDER"] = "SHOUD_REFRESH_RENDER";
	return ListrEventType$1;
}({});
let ListrRendererSelection = /* @__PURE__ */ function(ListrRendererSelection$1) {
	ListrRendererSelection$1["PRIMARY"] = "PRIMARY";
	ListrRendererSelection$1["SECONDARY"] = "SECONDARY";
	ListrRendererSelection$1["SILENT"] = "SILENT";
	return ListrRendererSelection$1;
}({});
/**
* Internal events that are fired from the Task.
*
* @see {@link https://listr2.kilic.dev/task/events.html}
*/
let ListrTaskEventType = /* @__PURE__ */ function(ListrTaskEventType$1) {
	/** Title has changed for the current Task. */
	ListrTaskEventType$1["TITLE"] = "TITLE";
	/**
	* State has changed for the current Task.
	*
	* @see {@link module:listr2.ListrTaskState}
	*/
	ListrTaskEventType$1["STATE"] = "STATE";
	/** The current Task has been marked as enabled. */
	ListrTaskEventType$1["ENABLED"] = "ENABLED";
	/** The current Task is currently processing subtasks. */
	ListrTaskEventType$1["SUBTASK"] = "SUBTASK";
	/** The current Task is now processing a prompt. */
	ListrTaskEventType$1["PROMPT"] = "PROMPT";
	/** The current Task is now dumping output. */
	ListrTaskEventType$1["OUTPUT"] = "OUTPUT";
	/**
	* The current Task is now dumping a message.
	*
	* @see {module:Listr2.ListrTaskMessage}
	*/
	ListrTaskEventType$1["MESSAGE"] = "MESSAGE";
	/** The current Task is closed and no further action in expected. */
	ListrTaskEventType$1["CLOSED"] = "CLOSED";
	return ListrTaskEventType$1;
}({});
/**
* Tasks can be in various states during the execution.
*
* Whenever a state change occurs, the task will emit a {@link module:listr2.ListrTaskEventType.STATE} with the appropriate state.
*/
let ListrTaskState = /* @__PURE__ */ function(ListrTaskState$1) {
	/** Task has not started yet, waiting for pick-up. */
	ListrTaskState$1["WAITING"] = "WAITING";
	/** Task has started. */
	ListrTaskState$1["STARTED"] = "STARTED";
	/** Task has been completed. */
	ListrTaskState$1["COMPLETED"] = "COMPLETED";
	/** Task has failed. */
	ListrTaskState$1["FAILED"] = "FAILED";
	/** Task has been skipped. */
	ListrTaskState$1["SKIPPED"] = "SKIPPED";
	/** Task is currently trying to rollback. */
	ListrTaskState$1["ROLLING_BACK"] = "ROLLING_BACK";
	/** Task has rolledback successfully after failing. */
	ListrTaskState$1["ROLLED_BACK"] = "ROLLED_BACK";
	/** Task is currently retrying. */
	ListrTaskState$1["RETRY"] = "RETRY";
	/** Task is currently paused. */
	ListrTaskState$1["PAUSED"] = "PAUSED";
	/** Task is currently trying to process a prompt. */
	ListrTaskState$1["PROMPT"] = "PROMPT";
	/** Task has successfully processed the prompt. */
	ListrTaskState$1["PROMPT_COMPLETED"] = "PROMPT_COMPLETED";
	/** Task has failed to process the prompt. */
	ListrTaskState$1["PROMPT_FAILED"] = "PROMPT_FAILED";
	return ListrTaskState$1;
}({});
var EventManager = class {
	emitter = new eventemitter3_default();
	emit(dispatch, args) {
		this.emitter.emit(dispatch, args);
	}
	on(dispatch, handler) {
		this.emitter.addListener(dispatch, handler);
	}
	once(dispatch, handler) {
		this.emitter.once(dispatch, handler);
	}
	off(dispatch, handler) {
		this.emitter.off(dispatch, handler);
	}
	complete() {
		this.emitter.removeAllListeners();
	}
};
/**
* Tests to see if the object is an RxJS {@link Observable}
* @param obj the object to test
*/
function isObservable(obj) {
	return !!obj && typeof obj === "object" && typeof obj.subscribe === "function";
}
/**
* Tests to see if the object is an Readable or NodeJS.ReadableStream {@link Readable, NodeJS.ReadableStream}
* @param obj the object to test
*/
function isReadable(obj) {
	return !!obj && typeof obj === "object" && obj.readable === true && typeof obj.read === "function" && typeof obj.on === "function";
}
function isUnicodeSupported() {
	/* istanbul ignore next */
	return !!process.env[ListrEnvironmentVariables.FORCE_UNICODE] || process.platform !== "win32" || !!process.env.CI || !!process.env.WT_SESSION || process.env.TERM_PROGRAM === "vscode" || process.env.TERM === "xterm-256color" || process.env.TERM === "alacritty";
}
const CLEAR_LINE_REGEX = "(?:\\u001b|\\u009b)\\[[\\=><~/#&.:=?%@~_-]*[0-9]*[\\a-ln-tqyz=><~/#&.:=?%@~_-]+";
const BELL_REGEX = /\u0007/;
function cleanseAnsi(chunk) {
	return String(chunk).replace(new RegExp(CLEAR_LINE_REGEX, "gmi"), "").replace(new RegExp(BELL_REGEX, "gmi"), "").trim();
}
/**
* Creates color palette through underlying dependency of `colorette`.
*
* @see {@link https://www.npmjs.com/package/colorette}
*/
const color = createColors();
function indent(string, count) {
	return string.replace(/^(?!\s*$)/gm, " ".repeat(count));
}
const FIGURES_MAIN = {
	warning: "⚠",
	cross: "✖",
	arrowDown: "↓",
	tick: "✔",
	arrowRight: "→",
	pointer: "❯",
	checkboxOn: "☒",
	arrowLeft: "←",
	squareSmallFilled: "◼",
	pointerSmall: "›"
};
const FIGURES_FALLBACK = {
	...FIGURES_MAIN,
	warning: "‼",
	cross: "×",
	tick: "√",
	pointer: ">",
	checkboxOn: "[×]",
	squareSmallFilled: "■"
};
const figures = isUnicodeSupported() ? FIGURES_MAIN : FIGURES_FALLBACK;
function splat(message, ...splat$1) {
	return format(String(message), ...splat$1);
}
/** Default ListrLogLevels for the logger */
let ListrLogLevels = /* @__PURE__ */ function(ListrLogLevels$1) {
	ListrLogLevels$1["STARTED"] = "STARTED";
	ListrLogLevels$1["COMPLETED"] = "COMPLETED";
	ListrLogLevels$1["FAILED"] = "FAILED";
	ListrLogLevels$1["SKIPPED"] = "SKIPPED";
	ListrLogLevels$1["OUTPUT"] = "OUTPUT";
	ListrLogLevels$1["TITLE"] = "TITLE";
	ListrLogLevels$1["ROLLBACK"] = "ROLLBACK";
	ListrLogLevels$1["RETRY"] = "RETRY";
	ListrLogLevels$1["PROMPT"] = "PROMPT";
	ListrLogLevels$1["PAUSED"] = "PAUSED";
	return ListrLogLevels$1;
}({});
const LISTR_LOGGER_STYLE = {
	icon: {
		[ListrLogLevels.STARTED]: figures.pointer,
		[ListrLogLevels.FAILED]: figures.cross,
		[ListrLogLevels.SKIPPED]: figures.arrowDown,
		[ListrLogLevels.COMPLETED]: figures.tick,
		[ListrLogLevels.OUTPUT]: figures.pointerSmall,
		[ListrLogLevels.TITLE]: figures.arrowRight,
		[ListrLogLevels.RETRY]: figures.warning,
		[ListrLogLevels.ROLLBACK]: figures.arrowLeft,
		[ListrLogLevels.PAUSED]: figures.squareSmallFilled
	},
	color: {
		[ListrLogLevels.STARTED]: color.yellow,
		[ListrLogLevels.FAILED]: color.red,
		[ListrLogLevels.SKIPPED]: color.yellow,
		[ListrLogLevels.COMPLETED]: color.green,
		[ListrLogLevels.RETRY]: color.yellowBright,
		[ListrLogLevels.ROLLBACK]: color.redBright,
		[ListrLogLevels.PAUSED]: color.yellowBright
	}
};
const LISTR_LOGGER_STDERR_LEVELS = [
	ListrLogLevels.RETRY,
	ListrLogLevels.ROLLBACK,
	ListrLogLevels.FAILED
];
/**
* Creates a new Listr2 logger.
*
* This logger is used throughout the renderers for consistency.
*
* @see {@link https://listr2.kilic.dev/renderer/logger.html}
*/
var ListrLogger = class {
	process;
	constructor(options) {
		this.options = options;
		this.options = {
			useIcons: true,
			toStderr: [],
			...options ?? {}
		};
		this.options.fields ??= {};
		this.options.fields.prefix ??= [];
		this.options.fields.suffix ??= [];
		this.process = this.options.processOutput ?? new ProcessOutput();
	}
	log(level, message, options) {
		const output = this.format(level, message, options);
		if (this.options.toStderr.includes(level)) {
			this.process.toStderr(output);
			return;
		}
		this.process.toStdout(output);
	}
	toStdout(message, options, eol = true) {
		this.process.toStdout(this.format(null, message, options), eol);
	}
	toStderr(message, options, eol = true) {
		this.process.toStderr(this.format(null, message, options), eol);
	}
	wrap(message, options) {
		if (!message) return message;
		return this.applyFormat(`[${message}]`, options);
	}
	splat(...args) {
		const message = args.shift() ?? "";
		return args.length === 0 ? message : splat(message, args);
	}
	suffix(message, ...suffixes) {
		suffixes.filter(Boolean).forEach((suffix) => {
			message += this.spacing(message);
			if (typeof suffix === "string") message += this.wrap(suffix);
			else if (typeof suffix === "object") {
				suffix.args ??= [];
				if (typeof suffix.condition === "function" ? !suffix.condition(...suffix.args) : !(suffix.condition ?? true)) return message;
				message += this.wrap(typeof suffix.field === "function" ? suffix.field(...suffix.args) : suffix.field, { format: suffix?.format(...suffix.args) });
			}
		});
		return message;
	}
	prefix(message, ...prefixes) {
		prefixes.filter(Boolean).forEach((prefix) => {
			message = this.spacing(message) + message;
			if (typeof prefix === "string") message = this.wrap(prefix) + message;
			else if (typeof prefix === "object") {
				prefix.args ??= [];
				if (typeof prefix.condition === "function" ? !prefix.condition(...prefix.args) : !(prefix.condition ?? true)) return message;
				message = this.wrap(typeof prefix.field === "function" ? prefix.field(...prefix.args) : prefix.field, { format: prefix?.format() }) + message;
			}
		});
		return message;
	}
	fields(message, options) {
		if (this.options?.fields?.prefix) message = this.prefix(message, ...this.options.fields.prefix);
		if (options?.prefix) message = this.prefix(message, ...options.prefix);
		if (options?.suffix) message = this.suffix(message, ...options.suffix);
		if (this.options?.fields?.suffix) message = this.suffix(message, ...this.options.fields.suffix);
		return message;
	}
	icon(level, icon) {
		if (!level) return null;
		if (!icon) {
			const i = this.options.icon?.[level];
			icon = typeof i === "function" ? i() : i;
		}
		const coloring = this.options.color?.[level];
		if (icon && coloring) icon = coloring(icon);
		return icon;
	}
	format(level, message, options) {
		if (!Array.isArray(message)) message = [message];
		message = this.splat(message.shift(), ...message).toString().split(EOL$1).filter((m) => !m || m.trim() !== "").map((m) => {
			return this.style(level, this.fields(m, {
				prefix: Array.isArray(options?.prefix) ? options.prefix : [options?.prefix],
				suffix: Array.isArray(options?.suffix) ? options.suffix : [options?.suffix]
			}));
		}).join(EOL$1);
		return message;
	}
	style(level, message) {
		if (!level || !message) return message;
		const icon = this.icon(level, !this.options.useIcons && this.wrap(level));
		if (icon) message = icon + " " + message;
		return message;
	}
	applyFormat(message, options) {
		if (options?.format) return options.format(message);
		return message;
	}
	spacing(message) {
		return typeof message === "undefined" || message.trim() === "" ? "" : " ";
	}
};
var ProcessOutputBuffer = class {
	buffer = [];
	decoder = new StringDecoder();
	constructor(options) {
		this.options = options;
	}
	get all() {
		return this.buffer;
	}
	get last() {
		return this.buffer.at(-1);
	}
	get length() {
		return this.buffer.length;
	}
	write(data, ...args) {
		const callback = args[args.length - 1];
		this.buffer.push({
			time: Date.now(),
			stream: this.options?.stream,
			entry: this.decoder.write(typeof data === "string" ? Buffer.from(data, typeof args[0] === "string" ? args[0] : void 0) : Buffer.from(data))
		});
		if (this.options?.limit) this.buffer = this.buffer.slice(-this.options.limit);
		if (typeof callback === "function") callback();
		return true;
	}
	reset() {
		this.buffer = [];
	}
};
var ProcessOutputStream = class {
	method;
	buffer;
	constructor(stream) {
		this.stream = stream;
		this.method = stream.write;
		this.buffer = new ProcessOutputBuffer({ stream });
	}
	get out() {
		return Object.assign({}, this.stream, { write: this.write.bind(this) });
	}
	hijack() {
		this.stream.write = this.buffer.write.bind(this.buffer);
	}
	release() {
		this.stream.write = this.method;
		const buffer = [...this.buffer.all];
		this.buffer.reset();
		return buffer;
	}
	write(...args) {
		return this.method.apply(this.stream, args);
	}
};
/**
* Creates a new Listr2 process-output controller.
*
* This is used to control the flow to `process.stdout` and `process.stderr` for all renderers.
*
* @see {@link https://listr2.kilic.dev/renderer/process-output.html}
*/
var ProcessOutput = class {
	stream;
	active;
	constructor(stdout, stderr, options) {
		this.options = options;
		this.stream = {
			stdout: new ProcessOutputStream(stdout ?? process.stdout),
			stderr: new ProcessOutputStream(stderr ?? process.stderr)
		};
		this.options = {
			dump: ["stdout", "stderr"],
			leaveEmptyLine: true,
			...options
		};
	}
	get stdout() {
		return this.stream.stdout.out;
	}
	get stderr() {
		return this.stream.stderr.out;
	}
	hijack() {
		if (this.active) throw new Error("ProcessOutput has been already hijacked!");
		this.stream.stdout.write(ANSI_ESCAPE_CODES.CURSOR_HIDE);
		Object.values(this.stream).forEach((stream) => stream.hijack());
		this.active = true;
	}
	release() {
		const output = Object.entries(this.stream).map(([name, stream]) => ({
			name,
			buffer: stream.release()
		})).filter((output$1) => this.options.dump.includes(output$1.name)).flatMap((output$1) => output$1.buffer).sort((a, b) => a.time - b.time).map((message) => {
			return {
				...message,
				entry: cleanseAnsi(message.entry)
			};
		}).filter((message) => message.entry);
		if (output.length > 0) {
			if (this.options.leaveEmptyLine) this.stdout.write(EOL$1);
			output.forEach((message) => {
				(message.stream ?? this.stdout).write(message.entry + EOL$1);
			});
		}
		this.stream.stdout.write(ANSI_ESCAPE_CODES.CURSOR_SHOW);
		this.active = false;
	}
	toStdout(buffer, eol = true) {
		if (eol) buffer = buffer + EOL$1;
		return this.stream.stdout.write(buffer);
	}
	toStderr(buffer, eol = true) {
		if (eol) buffer = buffer + EOL$1;
		return this.stream.stderr.write(buffer);
	}
};
/* istanbul ignore next */
function createWritable(cb) {
	const writable = new Writable$1();
	writable.rows = Infinity;
	writable.columns = Infinity;
	writable.write = (chunk) => {
		cb(chunk.toString());
		return true;
	};
	return writable;
}
/* istanbul ignore next */
var Spinner = class {
	spinner = !isUnicodeSupported() ? [
		"-",
		"\\",
		"|",
		"/"
	] : [
		"⠋",
		"⠙",
		"⠹",
		"⠸",
		"⠼",
		"⠴",
		"⠦",
		"⠧",
		"⠇",
		"⠏"
	];
	id;
	spinnerPosition = 0;
	spin() {
		this.spinnerPosition = ++this.spinnerPosition % this.spinner.length;
	}
	fetch() {
		return this.spinner[this.spinnerPosition];
	}
	isRunning() {
		return !!this.id;
	}
	start(cb, interval = 100) {
		this.id = setInterval(() => {
			this.spin();
			if (cb) cb();
		}, interval);
	}
	stop() {
		clearInterval(this.id);
	}
};
let ListrDefaultRendererLogLevels = /* @__PURE__ */ function(ListrDefaultRendererLogLevels$1) {
	ListrDefaultRendererLogLevels$1["SKIPPED_WITH_COLLAPSE"] = "SKIPPED_WITH_COLLAPSE";
	ListrDefaultRendererLogLevels$1["SKIPPED_WITHOUT_COLLAPSE"] = "SKIPPED_WITHOUT_COLLAPSE";
	ListrDefaultRendererLogLevels$1["OUTPUT"] = "OUTPUT";
	ListrDefaultRendererLogLevels$1["OUTPUT_WITH_BOTTOMBAR"] = "OUTPUT_WITH_BOTTOMBAR";
	ListrDefaultRendererLogLevels$1["PENDING"] = "PENDING";
	ListrDefaultRendererLogLevels$1["COMPLETED"] = "COMPLETED";
	ListrDefaultRendererLogLevels$1["COMPLETED_WITH_FAILED_SUBTASKS"] = "COMPLETED_WITH_FAILED_SUBTASKS";
	ListrDefaultRendererLogLevels$1["COMPLETED_WITH_FAILED_SISTER_TASKS"] = "COMPLETED_WITH_SISTER_TASKS_FAILED";
	ListrDefaultRendererLogLevels$1["RETRY"] = "RETRY";
	ListrDefaultRendererLogLevels$1["ROLLING_BACK"] = "ROLLING_BACK";
	ListrDefaultRendererLogLevels$1["ROLLED_BACK"] = "ROLLED_BACK";
	ListrDefaultRendererLogLevels$1["FAILED"] = "FAILED";
	ListrDefaultRendererLogLevels$1["FAILED_WITH_FAILED_SUBTASKS"] = "FAILED_WITH_SUBTASKS";
	ListrDefaultRendererLogLevels$1["WAITING"] = "WAITING";
	ListrDefaultRendererLogLevels$1["PAUSED"] = "PAUSED";
	return ListrDefaultRendererLogLevels$1;
}({});
const LISTR_DEFAULT_RENDERER_STYLE = {
	icon: {
		[ListrDefaultRendererLogLevels.SKIPPED_WITH_COLLAPSE]: figures.arrowDown,
		[ListrDefaultRendererLogLevels.SKIPPED_WITHOUT_COLLAPSE]: figures.warning,
		[ListrDefaultRendererLogLevels.OUTPUT]: figures.pointerSmall,
		[ListrDefaultRendererLogLevels.OUTPUT_WITH_BOTTOMBAR]: figures.pointerSmall,
		[ListrDefaultRendererLogLevels.PENDING]: figures.pointer,
		[ListrDefaultRendererLogLevels.COMPLETED]: figures.tick,
		[ListrDefaultRendererLogLevels.COMPLETED_WITH_FAILED_SUBTASKS]: figures.warning,
		[ListrDefaultRendererLogLevels.COMPLETED_WITH_FAILED_SISTER_TASKS]: figures.squareSmallFilled,
		[ListrDefaultRendererLogLevels.RETRY]: figures.warning,
		[ListrDefaultRendererLogLevels.ROLLING_BACK]: figures.warning,
		[ListrDefaultRendererLogLevels.ROLLED_BACK]: figures.arrowLeft,
		[ListrDefaultRendererLogLevels.FAILED]: figures.cross,
		[ListrDefaultRendererLogLevels.FAILED_WITH_FAILED_SUBTASKS]: figures.pointer,
		[ListrDefaultRendererLogLevels.WAITING]: figures.squareSmallFilled,
		[ListrDefaultRendererLogLevels.PAUSED]: figures.squareSmallFilled
	},
	color: {
		[ListrDefaultRendererLogLevels.SKIPPED_WITH_COLLAPSE]: color.yellow,
		[ListrDefaultRendererLogLevels.SKIPPED_WITHOUT_COLLAPSE]: color.yellow,
		[ListrDefaultRendererLogLevels.PENDING]: color.yellow,
		[ListrDefaultRendererLogLevels.COMPLETED]: color.green,
		[ListrDefaultRendererLogLevels.COMPLETED_WITH_FAILED_SUBTASKS]: color.yellow,
		[ListrDefaultRendererLogLevels.COMPLETED_WITH_FAILED_SISTER_TASKS]: color.red,
		[ListrDefaultRendererLogLevels.RETRY]: color.yellowBright,
		[ListrDefaultRendererLogLevels.ROLLING_BACK]: color.redBright,
		[ListrDefaultRendererLogLevels.ROLLED_BACK]: color.redBright,
		[ListrDefaultRendererLogLevels.FAILED]: color.red,
		[ListrDefaultRendererLogLevels.FAILED_WITH_FAILED_SUBTASKS]: color.red,
		[ListrDefaultRendererLogLevels.WAITING]: color.dim,
		[ListrDefaultRendererLogLevels.PAUSED]: color.yellowBright
	}
};
/**
* A basic function to parse minutes and tasks passed given a duration.
* Useful for renderers to show the task time.
*/
/* istanbul ignore next */
function parseTimer(duration) {
	const seconds = Math.floor(duration / 1e3);
	const minutes = Math.floor(seconds / 60);
	let parsedTime;
	if (seconds === 0 && minutes === 0) parsedTime = `0.${Math.floor(duration / 100)}s`;
	if (seconds > 0) parsedTime = `${seconds % 60}s`;
	if (minutes > 0) parsedTime = `${minutes}m${parsedTime}`;
	return parsedTime;
}
/* istanbul ignore next */
const PRESET_TIMER = {
	condition: true,
	field: parseTimer,
	format: () => color.dim
};
var DefaultRenderer = class DefaultRenderer {
	static nonTTY = false;
	static rendererOptions = {
		indentation: 2,
		clearOutput: false,
		showSubtasks: true,
		collapseSubtasks: true,
		collapseSkips: true,
		showSkipMessage: true,
		suffixSkips: false,
		collapseErrors: true,
		showErrorMessage: true,
		suffixRetries: true,
		lazy: false,
		removeEmptyLines: true,
		formatOutput: "wrap",
		pausedTimer: {
			...PRESET_TIMER,
			format: () => color.yellowBright
		}
	};
	static rendererTaskOptions = { outputBar: true };
	prompt;
	activePrompt;
	spinner;
	logger;
	updater;
	truncate;
	wrap;
	buffer = {
		output: /* @__PURE__ */ new Map(),
		bottom: /* @__PURE__ */ new Map()
	};
	cache = {
		render: /* @__PURE__ */ new Map(),
		rendererOptions: /* @__PURE__ */ new Map(),
		rendererTaskOptions: /* @__PURE__ */ new Map()
	};
	constructor(tasks, options, events) {
		this.tasks = tasks;
		this.options = options;
		this.events = events;
		this.options = {
			...DefaultRenderer.rendererOptions,
			...this.options,
			icon: {
				...LISTR_DEFAULT_RENDERER_STYLE.icon,
				...options?.icon ?? {}
			},
			color: {
				...LISTR_DEFAULT_RENDERER_STYLE.color,
				...options?.color ?? {}
			}
		};
		this.spinner = this.options.spinner ?? new Spinner();
		this.logger = this.options.logger ?? new ListrLogger({
			useIcons: true,
			toStderr: []
		});
		this.logger.options.icon = this.options.icon;
		this.logger.options.color = this.options.color;
	}
	async render() {
		const { createLogUpdate } = await import("../log-update-DHZRyJ2m.js");
		const { default: truncate } = await import("../cli-truncate-Bg3RDXpi.js");
		const { default: wrap } = await import("../wrap-ansi-DUi52C6W.js");
		this.updater = createLogUpdate(this.logger.process.stdout);
		this.truncate = truncate;
		this.wrap = wrap;
		this.logger.process.hijack();
		/* istanbul ignore if */
		if (!this.options?.lazy) this.spinner.start(() => {
			this.update();
		});
		this.events.on(ListrEventType.SHOULD_REFRESH_RENDER, () => {
			this.update();
		});
	}
	update() {
		this.updater(this.create());
	}
	end() {
		this.spinner.stop();
		this.updater.clear();
		this.updater.done();
		if (!this.options.clearOutput) this.logger.process.toStdout(this.create({ prompt: false }));
		this.logger.process.release();
	}
	create(options) {
		options = {
			tasks: true,
			bottomBar: true,
			prompt: true,
			...options
		};
		const render = [];
		const renderTasks = this.renderer(this.tasks);
		const renderBottomBar = this.renderBottomBar();
		const renderPrompt = this.renderPrompt();
		if (options.tasks && renderTasks.length > 0) render.push(...renderTasks);
		if (options.bottomBar && renderBottomBar.length > 0) {
			if (render.length > 0) render.push("");
			render.push(...renderBottomBar);
		}
		if (options.prompt && renderPrompt.length > 0) {
			if (render.length > 0) render.push("");
			render.push(...renderPrompt);
		}
		return render.join(EOL$1);
	}
	style(task, output = false) {
		const rendererOptions = this.cache.rendererOptions.get(task.id);
		if (task.isSkipped()) {
			if (output || rendererOptions.collapseSkips) return this.logger.icon(ListrDefaultRendererLogLevels.SKIPPED_WITH_COLLAPSE);
			else if (rendererOptions.collapseSkips === false) return this.logger.icon(ListrDefaultRendererLogLevels.SKIPPED_WITHOUT_COLLAPSE);
		}
		if (output) {
			if (this.shouldOutputToBottomBar(task)) return this.logger.icon(ListrDefaultRendererLogLevels.OUTPUT_WITH_BOTTOMBAR);
			return this.logger.icon(ListrDefaultRendererLogLevels.OUTPUT);
		}
		if (task.hasSubtasks()) {
			if (task.isStarted() || task.isPrompt() && rendererOptions.showSubtasks !== false && !task.subtasks.every((subtask) => !subtask.hasTitle())) return this.logger.icon(ListrDefaultRendererLogLevels.PENDING);
			else if (task.isCompleted() && task.subtasks.some((subtask) => subtask.hasFailed())) return this.logger.icon(ListrDefaultRendererLogLevels.COMPLETED_WITH_FAILED_SUBTASKS);
			else if (task.hasFailed()) return this.logger.icon(ListrDefaultRendererLogLevels.FAILED_WITH_FAILED_SUBTASKS);
		}
		if (task.isStarted() || task.isPrompt()) return this.logger.icon(ListrDefaultRendererLogLevels.PENDING, !this.options?.lazy && this.spinner.fetch());
		else if (task.isCompleted()) return this.logger.icon(ListrDefaultRendererLogLevels.COMPLETED);
		else if (task.isRetrying()) return this.logger.icon(ListrDefaultRendererLogLevels.RETRY, !this.options?.lazy && this.spinner.fetch());
		else if (task.isRollingBack()) return this.logger.icon(ListrDefaultRendererLogLevels.ROLLING_BACK, !this.options?.lazy && this.spinner.fetch());
		else if (task.hasRolledBack()) return this.logger.icon(ListrDefaultRendererLogLevels.ROLLED_BACK);
		else if (task.hasFailed()) return this.logger.icon(ListrDefaultRendererLogLevels.FAILED);
		else if (task.isPaused()) return this.logger.icon(ListrDefaultRendererLogLevels.PAUSED);
		return this.logger.icon(ListrDefaultRendererLogLevels.WAITING);
	}
	format(message, icon, level) {
		if (message.trim() === "") return [];
		if (icon) message = icon + " " + message;
		let parsed;
		const columns = (process.stdout.columns ?? 80) - level * this.options.indentation - 2;
		switch (this.options.formatOutput) {
			case "truncate":
				parsed = message.split(EOL$1).map((s, i) => {
					return this.truncate(this.indent(s, i), columns);
				});
				break;
			case "wrap":
				parsed = this.wrap(message, columns, {
					hard: true,
					trim: false
				}).split(EOL$1).map((s, i) => this.indent(s, i));
				break;
			default: throw new ListrRendererError("Format option for the renderer is wrong.");
		}
		if (this.options.removeEmptyLines) parsed = parsed.filter(Boolean);
		return parsed.map((str) => indent(str, level * this.options.indentation));
	}
	shouldOutputToOutputBar(task) {
		const outputBar = this.cache.rendererTaskOptions.get(task.id).outputBar;
		return typeof outputBar === "number" && outputBar !== 0 || typeof outputBar === "boolean" && outputBar !== false;
	}
	shouldOutputToBottomBar(task) {
		const bottomBar = this.cache.rendererTaskOptions.get(task.id).bottomBar;
		return typeof bottomBar === "number" && bottomBar !== 0 || typeof bottomBar === "boolean" && bottomBar !== false || !task.hasTitle();
	}
	renderer(tasks, level = 0) {
		return tasks.flatMap((task) => {
			if (!task.isEnabled()) return [];
			if (this.cache.render.has(task.id)) return this.cache.render.get(task.id);
			this.calculate(task);
			this.setupBuffer(task);
			const rendererOptions = this.cache.rendererOptions.get(task.id);
			const rendererTaskOptions = this.cache.rendererTaskOptions.get(task.id);
			const output = [];
			if (task.isPrompt()) {
				if (this.activePrompt && this.activePrompt !== task.id) throw new ListrRendererError("Only one prompt can be active at the given time, please re-evaluate your task design.");
				else if (!this.activePrompt) {
					task.on(ListrTaskEventType.PROMPT, (prompt) => {
						const cleansed = cleanseAnsi(prompt);
						if (cleansed) this.prompt = cleansed;
					});
					task.on(ListrTaskEventType.STATE, (state) => {
						if (state === ListrTaskState.PROMPT_COMPLETED || task.hasFinalized() || task.hasReset()) {
							this.prompt = null;
							this.activePrompt = null;
							task.off(ListrTaskEventType.PROMPT);
						}
					});
					this.activePrompt = task.id;
				}
			}
			if (task.hasTitle()) if (!(tasks.some((task$1) => task$1.hasFailed()) && !task.hasFailed() && task.options.exitOnError !== false && !(task.isCompleted() || task.isSkipped()))) if (task.hasFailed() && rendererOptions.collapseErrors) output.push(...this.format(!task.hasSubtasks() && task.message.error && rendererOptions.showErrorMessage ? task.message.error : task.title, this.style(task), level));
			else if (task.isSkipped() && rendererOptions.collapseSkips) output.push(...this.format(this.logger.suffix(task.message.skip && rendererOptions.showSkipMessage ? task.message.skip : task.title, {
				field: ListrLogLevels.SKIPPED,
				condition: rendererOptions.suffixSkips,
				format: () => color.dim
			}), this.style(task), level));
			else if (task.isRetrying()) output.push(...this.format(this.logger.suffix(task.title, {
				field: `${ListrLogLevels.RETRY}:${task.message.retry.count}`,
				format: () => color.yellow,
				condition: rendererOptions.suffixRetries
			}), this.style(task), level));
			else if (task.isCompleted() && task.hasTitle() && assertFunctionOrSelf(rendererTaskOptions.timer?.condition, task.message.duration)) output.push(...this.format(this.logger.suffix(task?.title, {
				...rendererTaskOptions.timer,
				args: [task.message.duration]
			}), this.style(task), level));
			else if (task.isPaused()) output.push(...this.format(this.logger.suffix(task.title, {
				...rendererOptions.pausedTimer,
				args: [task.message.paused - Date.now()]
			}), this.style(task), level));
			else output.push(...this.format(task.title, this.style(task), level));
			else output.push(...this.format(task.title, this.logger.icon(ListrDefaultRendererLogLevels.COMPLETED_WITH_FAILED_SISTER_TASKS), level));
			if (!task.hasSubtasks() || !rendererOptions.showSubtasks) {
				if (task.hasFailed() && rendererOptions.collapseErrors === false && (rendererOptions.showErrorMessage || !rendererOptions.showSubtasks)) output.push(...this.dump(task, level, ListrLogLevels.FAILED));
				else if (task.isSkipped() && rendererOptions.collapseSkips === false && (rendererOptions.showSkipMessage || !rendererOptions.showSubtasks)) output.push(...this.dump(task, level, ListrLogLevels.SKIPPED));
			}
			if (task.isPending() || rendererTaskOptions.persistentOutput) output.push(...this.renderOutputBar(task, level));
			if (rendererOptions.showSubtasks !== false && task.hasSubtasks() && (task.isPending() || task.hasFinalized() && !task.hasTitle() || task.isCompleted() && rendererOptions.collapseSubtasks === false && !task.subtasks.some((subtask) => this.cache.rendererOptions.get(subtask.id)?.collapseSubtasks === true) || task.subtasks.some((subtask) => this.cache.rendererOptions.get(subtask.id)?.collapseSubtasks === false) || task.subtasks.some((subtask) => subtask.hasFailed()) || task.subtasks.some((subtask) => subtask.hasRolledBack()))) {
				const subtaskLevel = !task.hasTitle() ? level : level + 1;
				const subtaskRender = this.renderer(task.subtasks, subtaskLevel);
				output.push(...subtaskRender);
			}
			if (task.hasFinalized()) {
				if (!rendererTaskOptions.persistentOutput) {
					this.buffer.bottom.delete(task.id);
					this.buffer.output.delete(task.id);
				}
			}
			if (task.isClosed()) {
				this.cache.render.set(task.id, output);
				this.reset(task);
			}
			return output;
		});
	}
	renderOutputBar(task, level) {
		const output = this.buffer.output.get(task.id);
		if (!output) return [];
		return output.all.flatMap((o) => this.dump(task, level, ListrLogLevels.OUTPUT, o.entry));
	}
	renderBottomBar() {
		if (this.buffer.bottom.size === 0) return [];
		return Array.from(this.buffer.bottom.values()).flatMap((output) => output.all).sort((a, b) => a.time - b.time).map((output) => output.entry);
	}
	renderPrompt() {
		if (!this.prompt) return [];
		return [this.prompt];
	}
	calculate(task) {
		if (this.cache.rendererOptions.has(task.id) && this.cache.rendererTaskOptions.has(task.id)) return;
		const rendererOptions = {
			...this.options,
			...task.rendererOptions
		};
		this.cache.rendererOptions.set(task.id, rendererOptions);
		this.cache.rendererTaskOptions.set(task.id, {
			...DefaultRenderer.rendererTaskOptions,
			timer: rendererOptions.timer,
			...task.rendererTaskOptions
		});
	}
	setupBuffer(task) {
		if (this.buffer.bottom.has(task.id) || this.buffer.output.has(task.id)) return;
		const rendererTaskOptions = this.cache.rendererTaskOptions.get(task.id);
		if (this.shouldOutputToBottomBar(task) && !this.buffer.bottom.has(task.id)) {
			this.buffer.bottom.set(task.id, new ProcessOutputBuffer({ limit: typeof rendererTaskOptions.bottomBar === "number" ? rendererTaskOptions.bottomBar : 1 }));
			task.on(ListrTaskEventType.OUTPUT, (output) => {
				const data = this.dump(task, -1, ListrLogLevels.OUTPUT, output);
				this.buffer.bottom.get(task.id).write(data.join(EOL$1));
			});
			task.on(ListrTaskEventType.STATE, (state) => {
				switch (state) {
					case ListrTaskState.RETRY || ListrTaskState.ROLLING_BACK: this.buffer.bottom.delete(task.id);
				}
			});
		} else if (this.shouldOutputToOutputBar(task) && !this.buffer.output.has(task.id)) {
			this.buffer.output.set(task.id, new ProcessOutputBuffer({ limit: typeof rendererTaskOptions.outputBar === "number" ? rendererTaskOptions.outputBar : 1 }));
			task.on(ListrTaskEventType.OUTPUT, (output) => {
				this.buffer.output.get(task.id).write(output);
			});
			task.on(ListrTaskEventType.STATE, (state) => {
				switch (state) {
					case ListrTaskState.RETRY || ListrTaskState.ROLLING_BACK: this.buffer.output.delete(task.id);
				}
			});
		}
	}
	reset(task) {
		this.cache.rendererOptions.delete(task.id);
		this.cache.rendererTaskOptions.delete(task.id);
		this.buffer.output.delete(task.id);
	}
	dump(task, level, source = ListrLogLevels.OUTPUT, data) {
		if (!data) switch (source) {
			case ListrLogLevels.OUTPUT:
				data = task.output;
				break;
			case ListrLogLevels.SKIPPED:
				data = task.message.skip;
				break;
			case ListrLogLevels.FAILED:
				data = task.message.error;
				break;
		}
		if (task.hasTitle() && source === ListrLogLevels.FAILED && data === task.title || typeof data !== "string") return [];
		if (source === ListrLogLevels.OUTPUT) data = cleanseAnsi(data);
		return this.format(data, this.style(task, true), level + 1);
	}
	indent(str, i) {
		return i > 0 ? indent(str.trimEnd(), this.options.indentation) : str.trimEnd();
	}
};
var SilentRenderer = class {
	static nonTTY = true;
	static rendererOptions;
	static rendererTaskOptions;
	constructor(tasks, options) {
		this.tasks = tasks;
		this.options = options;
	}
	render() {}
	end() {}
};
var SimpleRenderer = class SimpleRenderer {
	static nonTTY = true;
	static rendererOptions = { pausedTimer: {
		...PRESET_TIMER,
		field: (time) => `${ListrLogLevels.PAUSED}:${time}`,
		format: () => color.yellowBright
	} };
	static rendererTaskOptions = {};
	logger;
	cache = {
		rendererOptions: /* @__PURE__ */ new Map(),
		rendererTaskOptions: /* @__PURE__ */ new Map()
	};
	constructor(tasks, options) {
		this.tasks = tasks;
		this.options = options;
		this.options = {
			...SimpleRenderer.rendererOptions,
			...options,
			icon: {
				...LISTR_LOGGER_STYLE.icon,
				...options?.icon ?? {}
			},
			color: {
				...LISTR_LOGGER_STYLE.color,
				...options?.color ?? {}
			}
		};
		this.logger = this.options.logger ?? new ListrLogger({
			useIcons: true,
			toStderr: LISTR_LOGGER_STDERR_LEVELS
		});
		this.logger.options.icon = this.options.icon;
		this.logger.options.color = this.options.color;
		if (this.options.timestamp) this.logger.options.fields.prefix.unshift(this.options.timestamp);
	}
	end() {}
	render() {
		this.renderer(this.tasks);
	}
	renderer(tasks) {
		tasks.forEach((task) => {
			this.calculate(task);
			task.once(ListrTaskEventType.CLOSED, () => {
				this.reset(task);
			});
			const rendererOptions = this.cache.rendererOptions.get(task.id);
			const rendererTaskOptions = this.cache.rendererTaskOptions.get(task.id);
			task.on(ListrTaskEventType.SUBTASK, (subtasks) => {
				this.renderer(subtasks);
			});
			task.on(ListrTaskEventType.STATE, (state) => {
				if (!task.hasTitle()) return;
				if (state === ListrTaskState.STARTED) this.logger.log(ListrLogLevels.STARTED, task.title);
				else if (state === ListrTaskState.COMPLETED) {
					const timer = rendererTaskOptions?.timer;
					this.logger.log(ListrLogLevels.COMPLETED, task.title, timer && { suffix: {
						...timer,
						condition: !!task.message?.duration && timer.condition,
						args: [task.message.duration]
					} });
				} else if (state === ListrTaskState.PROMPT) {
					this.logger.process.hijack();
					task.on(ListrTaskEventType.PROMPT, (prompt) => {
						this.logger.process.toStderr(prompt, false);
					});
				} else if (state === ListrTaskState.PROMPT_COMPLETED) {
					task.off(ListrTaskEventType.PROMPT);
					this.logger.process.release();
				}
			});
			task.on(ListrTaskEventType.OUTPUT, (output) => {
				this.logger.log(ListrLogLevels.OUTPUT, output);
			});
			task.on(ListrTaskEventType.MESSAGE, (message) => {
				if (message.error) this.logger.log(ListrLogLevels.FAILED, task.title, { suffix: {
					field: `${ListrLogLevels.FAILED}: ${message.error}`,
					format: () => color.red
				} });
				else if (message.skip) this.logger.log(ListrLogLevels.SKIPPED, task.title, { suffix: {
					field: `${ListrLogLevels.SKIPPED}: ${message.skip}`,
					format: () => color.yellow
				} });
				else if (message.rollback) this.logger.log(ListrLogLevels.ROLLBACK, task.title, { suffix: {
					field: `${ListrLogLevels.ROLLBACK}: ${message.rollback}`,
					format: () => color.red
				} });
				else if (message.retry) this.logger.log(ListrLogLevels.RETRY, task.title, { suffix: {
					field: `${ListrLogLevels.RETRY}:${message.retry.count}`,
					format: () => color.red
				} });
				else if (message.paused) {
					const timer = rendererOptions?.pausedTimer;
					this.logger.log(ListrLogLevels.PAUSED, task.title, timer && { suffix: {
						...timer,
						condition: !!message?.paused && timer.condition,
						args: [message.paused - Date.now()]
					} });
				}
			});
		});
	}
	calculate(task) {
		if (this.cache.rendererOptions.has(task.id) && this.cache.rendererTaskOptions.has(task.id)) return;
		const rendererOptions = {
			...this.options,
			...task.rendererOptions
		};
		this.cache.rendererOptions.set(task.id, rendererOptions);
		this.cache.rendererTaskOptions.set(task.id, {
			...SimpleRenderer.rendererTaskOptions,
			timer: rendererOptions.timer,
			...task.rendererTaskOptions
		});
	}
	reset(task) {
		this.cache.rendererOptions.delete(task.id);
		this.cache.rendererTaskOptions.delete(task.id);
	}
};
var TestRendererSerializer = class {
	constructor(options) {
		this.options = options;
	}
	serialize(event, data, task) {
		return JSON.stringify(this.generate(event, data, task));
	}
	generate(event, data, task) {
		const output = {
			event,
			data
		};
		if (typeof this.options?.task !== "boolean") {
			const t = Object.fromEntries(this.options.task.map((entity) => {
				const property = task[entity];
				if (typeof property === "function") return [entity, property.call(task)];
				return [entity, property];
			}));
			if (Object.keys(task).length > 0) output.task = t;
		}
		return output;
	}
};
var TestRenderer = class TestRenderer {
	static nonTTY = true;
	static rendererOptions = {
		subtasks: true,
		state: Object.values(ListrTaskState),
		output: true,
		prompt: true,
		title: true,
		messages: [
			"skip",
			"error",
			"retry",
			"rollback",
			"paused"
		],
		messagesToStderr: [
			"error",
			"rollback",
			"retry"
		],
		task: [
			"hasRolledBack",
			"isRollingBack",
			"isCompleted",
			"isSkipped",
			"hasFinalized",
			"hasSubtasks",
			"title",
			"hasReset",
			"hasTitle",
			"isPrompt",
			"isPaused",
			"isPending",
			"isSkipped",
			"isStarted",
			"hasFailed",
			"isEnabled",
			"isRetrying",
			"path"
		]
	};
	static rendererTaskOptions;
	logger;
	serializer;
	constructor(tasks, options) {
		this.tasks = tasks;
		this.options = options;
		this.options = {
			...TestRenderer.rendererOptions,
			...this.options
		};
		this.logger = this.options.logger ?? new ListrLogger({ useIcons: false });
		this.serializer = new TestRendererSerializer(this.options);
	}
	render() {
		this.renderer(this.tasks);
	}
	end() {}
	renderer(tasks) {
		tasks.forEach((task) => {
			if (this.options.subtasks) task.on(ListrTaskEventType.SUBTASK, (subtasks) => {
				this.renderer(subtasks);
			});
			if (this.options.state) task.on(ListrTaskEventType.STATE, (state) => {
				this.logger.toStdout(this.serializer.serialize(ListrTaskEventType.STATE, state, task));
			});
			if (this.options.output) task.on(ListrTaskEventType.OUTPUT, (data) => {
				this.logger.toStdout(this.serializer.serialize(ListrTaskEventType.OUTPUT, data, task));
			});
			if (this.options.prompt) task.on(ListrTaskEventType.PROMPT, (prompt) => {
				this.logger.toStdout(this.serializer.serialize(ListrTaskEventType.PROMPT, prompt, task));
			});
			if (this.options.title) task.on(ListrTaskEventType.TITLE, (title) => {
				this.logger.toStdout(this.serializer.serialize(ListrTaskEventType.TITLE, title, task));
			});
			task.on(ListrTaskEventType.MESSAGE, (message) => {
				const parsed = Object.fromEntries(Object.entries(message).map(([key, value]) => {
					if (this.options.messages.includes(key)) return [key, value];
				}).filter(Boolean));
				if (Object.keys(parsed).length > 0) {
					const output = this.serializer.serialize(ListrTaskEventType.MESSAGE, parsed, task);
					if (this.options.messagesToStderr.some((state) => Object.keys(parsed).includes(state))) this.logger.toStderr(output);
					else this.logger.toStdout(output);
				}
			});
		});
	}
};
const RENDERERS = {
	default: DefaultRenderer,
	simple: SimpleRenderer,
	verbose: class VerboseRenderer {
		static nonTTY = true;
		static rendererOptions = {
			logTitleChange: false,
			pausedTimer: {
				...PRESET_TIMER,
				format: () => color.yellowBright
			}
		};
		static rendererTaskOptions;
		logger;
		cache = {
			rendererOptions: /* @__PURE__ */ new Map(),
			rendererTaskOptions: /* @__PURE__ */ new Map()
		};
		constructor(tasks, options) {
			this.tasks = tasks;
			this.options = options;
			this.options = {
				...VerboseRenderer.rendererOptions,
				...this.options,
				icon: {
					...LISTR_LOGGER_STYLE.icon,
					...options?.icon ?? {}
				},
				color: {
					...LISTR_LOGGER_STYLE.color,
					...options?.color ?? {}
				}
			};
			this.logger = this.options.logger ?? new ListrLogger({
				useIcons: false,
				toStderr: LISTR_LOGGER_STDERR_LEVELS
			});
			this.logger.options.icon = this.options.icon;
			this.logger.options.color = this.options.color;
			if (this.options.timestamp) this.logger.options.fields.prefix.unshift(this.options.timestamp);
		}
		render() {
			this.renderer(this.tasks);
		}
		end() {}
		renderer(tasks) {
			tasks.forEach((task) => {
				this.calculate(task);
				task.once(ListrTaskEventType.CLOSED, () => {
					this.reset(task);
				});
				const rendererOptions = this.cache.rendererOptions.get(task.id);
				const rendererTaskOptions = this.cache.rendererTaskOptions.get(task.id);
				task.on(ListrTaskEventType.SUBTASK, (subtasks) => {
					this.renderer(subtasks);
				});
				task.on(ListrTaskEventType.STATE, (state) => {
					if (!task.hasTitle()) return;
					if (state === ListrTaskState.STARTED) this.logger.log(ListrLogLevels.STARTED, task.title);
					else if (state === ListrTaskState.COMPLETED) {
						const timer = rendererTaskOptions.timer;
						this.logger.log(ListrLogLevels.COMPLETED, task.title, timer && { suffix: {
							...timer,
							condition: !!task.message?.duration && timer.condition,
							args: [task.message.duration]
						} });
					}
				});
				task.on(ListrTaskEventType.OUTPUT, (data) => {
					this.logger.log(ListrLogLevels.OUTPUT, data);
				});
				task.on(ListrTaskEventType.PROMPT, (prompt) => {
					const cleansed = cleanseAnsi(prompt);
					if (cleansed) this.logger.log(ListrLogLevels.PROMPT, cleansed);
				});
				if (this.options?.logTitleChange !== false) task.on(ListrTaskEventType.TITLE, (title) => {
					this.logger.log(ListrLogLevels.TITLE, title);
				});
				task.on(ListrTaskEventType.MESSAGE, (message) => {
					if (message?.error) this.logger.log(ListrLogLevels.FAILED, message.error);
					else if (message?.skip) this.logger.log(ListrLogLevels.SKIPPED, message.skip);
					else if (message?.rollback) this.logger.log(ListrLogLevels.ROLLBACK, message.rollback);
					else if (message?.retry) this.logger.log(ListrLogLevels.RETRY, task.title, { suffix: message.retry.count.toString() });
					else if (message?.paused) {
						const timer = rendererOptions?.pausedTimer;
						this.logger.log(ListrLogLevels.PAUSED, task.title, timer && { suffix: {
							...timer,
							condition: !!message?.paused && timer.condition,
							args: [message.paused - Date.now()]
						} });
					}
				});
			});
		}
		calculate(task) {
			if (this.cache.rendererOptions.has(task.id) && this.cache.rendererTaskOptions.has(task.id)) return;
			const rendererOptions = {
				...this.options,
				...task.rendererOptions
			};
			this.cache.rendererOptions.set(task.id, rendererOptions);
			this.cache.rendererTaskOptions.set(task.id, {
				...VerboseRenderer.rendererTaskOptions,
				timer: rendererOptions.timer,
				...task.rendererTaskOptions
			});
		}
		reset(task) {
			this.cache.rendererOptions.delete(task.id);
			this.cache.rendererTaskOptions.delete(task.id);
		}
	},
	test: TestRenderer,
	silent: SilentRenderer
};
function isRendererSupported(renderer) {
	return process.stdout.isTTY === true || renderer.nonTTY === true;
}
function getRendererClass(renderer) {
	if (typeof renderer === "string") return RENDERERS[renderer] ?? RENDERERS.default;
	return typeof renderer === "function" ? renderer : RENDERERS.default;
}
function getRenderer$1(options) {
	if (assertFunctionOrSelf(options?.silentRendererCondition)) return {
		renderer: getRendererClass("silent"),
		selection: ListrRendererSelection.SILENT
	};
	const r = {
		renderer: getRendererClass(options.renderer),
		options: options.rendererOptions,
		selection: ListrRendererSelection.PRIMARY
	};
	if (!isRendererSupported(r.renderer) || assertFunctionOrSelf(options?.fallbackRendererCondition)) return {
		renderer: getRendererClass(options.fallbackRenderer),
		options: options.fallbackRendererOptions,
		selection: ListrRendererSelection.SECONDARY
	};
	return r;
}
/**
* This function asserts the given value as a function or itself.
* If the value itself is a function it will evaluate it with the passed in arguments,
* elsewise it will directly return itself.
*/
function assertFunctionOrSelf(functionOrSelf, ...args) {
	if (typeof functionOrSelf === "function") return functionOrSelf(...args);
	else return functionOrSelf;
}
const clone = (0, import_rfdc.default)({ circles: true });
/**
* Deep clones a object in the easiest manner.
*/
function cloneObject(obj) {
	return clone(obj);
}
var Concurrency = class {
	concurrency;
	count;
	queue;
	constructor(options) {
		this.concurrency = options.concurrency;
		this.count = 0;
		this.queue = /* @__PURE__ */ new Set();
	}
	add(fn) {
		if (this.count < this.concurrency) return this.run(fn);
		return new Promise((resolve) => {
			const callback = () => resolve(this.run(fn));
			this.queue.add(callback);
		});
	}
	flush() {
		for (const callback of this.queue) {
			if (this.count >= this.concurrency) break;
			this.queue.delete(callback);
			callback();
		}
	}
	run(fn) {
		this.count++;
		const promise = fn();
		const cleanup = () => {
			this.count--;
			this.flush();
		};
		promise.then(cleanup, () => {
			this.queue.clear();
		});
		return promise;
	}
};
function delay(time) {
	return new Promise((resolve) => {
		setTimeout(resolve, time);
	});
}
/**
* Internal error handling mechanism for Listr collects the errors and details for a failed task.
*
* @see {@link https://listr2.kilic.dev/task/error-handling.html}
*/
var ListrError = class extends Error {
	path;
	ctx;
	constructor(error, type, task) {
		super(error.message);
		this.error = error;
		this.type = type;
		this.task = task;
		this.name = "ListrError";
		this.path = task.path;
		if (task?.options.collectErrors === "full") {
			this.task = cloneObject(task);
			this.ctx = cloneObject(task.listr.ctx);
		}
		this.stack = error?.stack;
	}
};
/**
* Internal error coming from renderer.
*/
var ListrRendererError = class extends Error {};
/**
* Internal error handling mechanism for Listr prompts to identify the failing cause is coming from a prompt.
*
* @see {@link https://listr2.kilic.dev/task/prompts.html}
*/
var PromptError = class extends Error {};
/**
* The original Task that is defined by the user is wrapped with the TaskWrapper to provide additional functionality.
*
* @see {@link https://listr2.kilic.dev/task/task.html}
*/
var TaskWrapper = class {
	constructor(task) {
		this.task = task;
	}
	/* istanbul ignore next */
	get title() {
		return this.task.title;
	}
	/**
	* Title of the current task.
	*
	* @see {@link https://listr2.kilic.dev/task/title.html}
	*/
	set title(title) {
		title = Array.isArray(title) ? title : [title];
		this.task.title$ = splat(title.shift(), ...title);
	}
	/* istanbul ignore next */
	get output() {
		return this.task.output;
	}
	/* istanbul ignore next */
	/**
	* Send output from the current task to the renderer.
	*
	* @see {@link https://listr2.kilic.dev/task/output.html}
	*/
	set output(output) {
		output = Array.isArray(output) ? output : [output];
		this.task.output$ = splat(output.shift(), ...output);
	}
	/* istanbul ignore next */
	/** Send an output to the output channel as prompt. */
	set promptOutput(output) {
		this.task.promptOutput$ = output;
	}
	/**
	* Creates a new set of Listr subtasks.
	*
	* @see {@link https://listr2.kilic.dev/task/subtasks.html}
	*/
	newListr(task, options) {
		let tasks;
		if (typeof task === "function") tasks = task(this);
		else tasks = task;
		return new Listr(tasks, options, this.task);
	}
	/**
	* Report an error that has to be collected and handled.
	*
	* @see {@link https://listr2.kilic.dev/task/error-handling.html}
	*/
	report(error, type) {
		if (this.task.options.collectErrors !== false) this.task.listr.errors.push(new ListrError(error, type, this.task));
		this.task.message$ = { error: error.message ?? this.task?.title };
	}
	/**
	* Skip the current task.
	*
	* @see {@link https://listr2.kilic.dev/task/skip.html}
	*/
	skip(message, ...metadata) {
		this.task.state$ = ListrTaskState.SKIPPED;
		if (message) this.task.message$ = { skip: message ? splat(message, ...metadata) : this.task?.title };
	}
	/**
	* Check whether this task is currently in a retry state.
	*
	* @see {@link https://listr2.kilic.dev/task/retry.html}
	*/
	isRetrying() {
		return this.task.isRetrying() ? this.task.retry : { count: 0 };
	}
	/* istanbul ignore next */
	/**
	* Create a new prompt for getting user input through the prompt adapter.
	* This will create a new prompt through the adapter if the task is not currently rendering a prompt or will return the active instance.
	*
	* This part of the application requires optional peer dependencies, please refer to documentation.
	*
	* @see {@link https://listr2.kilic.dev/task/prompt.html}
	*/
	prompt(adapter) {
		if (this.task.prompt) return this.task.prompt;
		return new adapter(this.task, this);
	}
	/* istanbul ignore next */
	/**
	* Generates a fake stdout for your use case, where it will be tunnelled through Listr to handle the rendering process.
	*
	* @see {@link https://listr2.kilic.dev/renderer/process-output.html}
	*/
	stdout(type) {
		return createWritable((chunk) => {
			switch (type) {
				case ListrTaskEventType.PROMPT:
					this.promptOutput = chunk;
					break;
				default: this.output = chunk;
			}
		});
	}
	/** Run this task. */
	run(ctx) {
		return this.task.run(ctx, this);
	}
};
var ListrTaskEventManager = class extends EventManager {};
/**
* Creates and handles a runnable instance of the Task.
*/
var Task = class extends ListrTaskEventManager {
	/** Unique id per task, can be used for identifying a Task. */
	id = randomUUID$1();
	/** The current state of the task. */
	state = ListrTaskState.WAITING;
	/** Subtasks of the current task. */
	subtasks;
	/** Title of the task. */
	title;
	/** Initial/Untouched version of the title for using whenever task has a reset. */
	initialTitle;
	/** Output channel for the task. */
	output;
	/** Current state of the retry process whenever the task is retrying. */
	retry;
	/**
	* A channel for messages.
	*
	* This requires a separate channel for messages like error, skip or runtime messages to further utilize in the renderers.
	*/
	message = {};
	/** Current prompt instance or prompt error whenever the task is prompting. */
	prompt;
	/** Parent task of the current task. */
	parent;
	/** Enable flag of this task. */
	enabled;
	/** User provided Task callback function to run. */
	taskFn;
	/** Marks the task as closed. This is different from finalized since this is not really related to task itself. */
	closed;
	constructor(listr, task, options, rendererOptions, rendererTaskOptions) {
		super();
		this.listr = listr;
		this.task = task;
		this.options = options;
		this.rendererOptions = rendererOptions;
		this.rendererTaskOptions = rendererTaskOptions;
		if (task.title) {
			const title = Array.isArray(task?.title) ? task.title : [task.title];
			this.title = splat(title.shift(), ...title);
			this.initialTitle = this.title;
		}
		this.taskFn = task.task;
		this.parent = listr.parentTask;
	}
	/**
	* Update the current state of the Task and emit the neccassary events.
	*/
	set state$(state) {
		this.state = state;
		this.emit(ListrTaskEventType.STATE, state);
		if (this.hasSubtasks() && this.hasFailed()) {
			for (const subtask of this.subtasks) if (subtask.state === ListrTaskState.STARTED) subtask.state$ = ListrTaskState.FAILED;
		}
		this.listr.events.emit(ListrEventType.SHOULD_REFRESH_RENDER);
	}
	/**
	* Update the current output of the Task and emit the neccassary events.
	*/
	set output$(data) {
		this.output = data;
		this.emit(ListrTaskEventType.OUTPUT, data);
		this.listr.events.emit(ListrEventType.SHOULD_REFRESH_RENDER);
	}
	/**
	* Update the current prompt output of the Task and emit the neccassary events.
	*/
	set promptOutput$(data) {
		this.emit(ListrTaskEventType.PROMPT, data);
		if (cleanseAnsi(data)) this.listr.events.emit(ListrEventType.SHOULD_REFRESH_RENDER);
	}
	/**
	* Update or extend the current message of the Task and emit the neccassary events.
	*/
	set message$(data) {
		this.message = {
			...this.message,
			...data
		};
		this.emit(ListrTaskEventType.MESSAGE, data);
		this.listr.events.emit(ListrEventType.SHOULD_REFRESH_RENDER);
	}
	/**
	* Update the current title of the Task and emit the neccassary events.
	*/
	set title$(title) {
		this.title = title;
		this.emit(ListrTaskEventType.TITLE, title);
		this.listr.events.emit(ListrEventType.SHOULD_REFRESH_RENDER);
	}
	/**
	* Current task path in the hierarchy.
	*/
	get path() {
		return [...this.listr.path, this.initialTitle];
	}
	/**
	* Checks whether the current task with the given context should be set as enabled.
	*/
	async check(ctx) {
		if (this.state === ListrTaskState.WAITING) {
			this.enabled = await assertFunctionOrSelf(this.task?.enabled ?? true, ctx);
			this.emit(ListrTaskEventType.ENABLED, this.enabled);
			this.listr.events.emit(ListrEventType.SHOULD_REFRESH_RENDER);
		}
		return this.enabled;
	}
	/** Returns whether this task has subtasks. */
	hasSubtasks() {
		return this.subtasks?.length > 0;
	}
	/** Returns whether this task is finalized in someform. */
	hasFinalized() {
		return this.isCompleted() || this.hasFailed() || this.isSkipped() || this.hasRolledBack();
	}
	/** Returns whether this task is in progress. */
	isPending() {
		return this.isStarted() || this.isPrompt() || this.hasReset();
	}
	/** Returns whether this task has started. */
	isStarted() {
		return this.state === ListrTaskState.STARTED;
	}
	/** Returns whether this task is skipped. */
	isSkipped() {
		return this.state === ListrTaskState.SKIPPED;
	}
	/** Returns whether this task has been completed. */
	isCompleted() {
		return this.state === ListrTaskState.COMPLETED;
	}
	/** Returns whether this task has been failed. */
	hasFailed() {
		return this.state === ListrTaskState.FAILED;
	}
	/** Returns whether this task has an active rollback task going on. */
	isRollingBack() {
		return this.state === ListrTaskState.ROLLING_BACK;
	}
	/** Returns whether the rollback action was successful. */
	hasRolledBack() {
		return this.state === ListrTaskState.ROLLED_BACK;
	}
	/** Returns whether this task has an actively retrying task going on. */
	isRetrying() {
		return this.state === ListrTaskState.RETRY;
	}
	/** Returns whether this task has some kind of reset like retry and rollback going on. */
	hasReset() {
		return this.state === ListrTaskState.RETRY || this.state === ListrTaskState.ROLLING_BACK;
	}
	/** Returns whether enabled function resolves to true. */
	isEnabled() {
		return this.enabled;
	}
	/** Returns whether this task actually has a title. */
	hasTitle() {
		return typeof this?.title === "string";
	}
	/** Returns whether this task has a prompt inside. */
	isPrompt() {
		return this.state === ListrTaskState.PROMPT;
	}
	/** Returns whether this task is currently paused. */
	isPaused() {
		return this.state === ListrTaskState.PAUSED;
	}
	/** Returns whether this task is closed. */
	isClosed() {
		return this.closed;
	}
	/** Pause the given task for certain time. */
	async pause(time) {
		const state = this.state;
		this.state$ = ListrTaskState.PAUSED;
		this.message$ = { paused: Date.now() + time };
		await delay(time);
		this.state$ = state;
		this.message$ = { paused: null };
	}
	/** Run the current task. */
	async run(context, wrapper) {
		const handleResult = (result) => {
			if (result instanceof Listr) {
				result.options = {
					...this.options,
					...result.options
				};
				result.rendererClass = getRendererClass("silent");
				this.subtasks = result.tasks;
				result.errors = this.listr.errors;
				this.emit(ListrTaskEventType.SUBTASK, this.subtasks);
				result = result.run(context);
			} else if (result instanceof Promise) result = result.then(handleResult);
			else if (isReadable(result)) result = new Promise((resolve, reject) => {
				result.on("data", (data) => {
					this.output$ = data.toString();
				});
				result.on("error", (error) => reject(error));
				result.on("end", () => resolve(null));
			});
			else if (isObservable(result)) result = new Promise((resolve, reject) => {
				result.subscribe({
					next: (data) => {
						this.output$ = data;
					},
					error: reject,
					complete: resolve
				});
			});
			return result;
		};
		const startTime = Date.now();
		this.state$ = ListrTaskState.STARTED;
		const skipped = await assertFunctionOrSelf(this.task?.skip ?? false, context);
		if (skipped) {
			if (typeof skipped === "string") this.message$ = { skip: skipped };
			else if (this.hasTitle()) this.message$ = { skip: this.title };
			else this.message$ = { skip: "Skipped task without a title." };
			this.state$ = ListrTaskState.SKIPPED;
			return;
		}
		try {
			const retryCount = typeof this.task?.retry === "number" && this.task.retry > 0 ? this.task.retry + 1 : typeof this.task?.retry === "object" && this.task.retry.tries > 0 ? this.task.retry.tries + 1 : 1;
			const retryDelay = typeof this.task.retry === "object" && this.task.retry.delay;
			for (let retries = 1; retries <= retryCount; retries++) try {
				await handleResult(this.taskFn(context, wrapper));
				break;
			} catch (err) {
				if (retries !== retryCount) {
					this.retry = {
						count: retries,
						error: err
					};
					this.message$ = { retry: this.retry };
					this.title$ = this.initialTitle;
					this.output = void 0;
					wrapper.report(err, ListrErrorTypes.WILL_RETRY);
					this.state$ = ListrTaskState.RETRY;
					if (retryDelay) await this.pause(retryDelay);
				} else throw err;
			}
			if (this.isStarted() || this.isRetrying()) {
				this.message$ = { duration: Date.now() - startTime };
				this.state$ = ListrTaskState.COMPLETED;
			}
		} catch (error) {
			if (this.prompt instanceof PromptError) error = this.prompt;
			if (this.task?.rollback) {
				wrapper.report(error, ListrErrorTypes.WILL_ROLLBACK);
				try {
					this.state$ = ListrTaskState.ROLLING_BACK;
					await this.task.rollback(context, wrapper);
					this.message$ = { rollback: this.title };
					this.state$ = ListrTaskState.ROLLED_BACK;
				} catch (err) {
					this.state$ = ListrTaskState.FAILED;
					wrapper.report(err, ListrErrorTypes.HAS_FAILED_TO_ROLLBACK);
					this.close();
					throw err;
				}
				if (this.listr.options?.exitAfterRollback !== false) {
					this.close();
					throw error;
				}
			} else {
				this.state$ = ListrTaskState.FAILED;
				if (this.listr.options.exitOnError !== false && await assertFunctionOrSelf(this.task?.exitOnError, context) !== false) {
					wrapper.report(error, ListrErrorTypes.HAS_FAILED);
					this.close();
					throw error;
				} else if (!this.hasSubtasks()) wrapper.report(error, ListrErrorTypes.HAS_FAILED_WITHOUT_ERROR);
			}
		} finally {
			this.close();
		}
	}
	close() {
		this.emit(ListrTaskEventType.CLOSED);
		this.listr.events.emit(ListrEventType.SHOULD_REFRESH_RENDER);
		this.complete();
	}
};
var ListrEventManager = class extends EventManager {};
/**
* Create a new task list with Listr.
*
* @see {@link https://listr2.kilic.dev/listr/listr.html}
*/
var Listr = class {
	tasks = [];
	errors = [];
	ctx;
	events;
	path = [];
	rendererClass;
	rendererClassOptions;
	rendererSelection;
	boundSignalHandler;
	concurrency;
	renderer;
	constructor(task, options, parentTask) {
		this.task = task;
		this.options = options;
		this.parentTask = parentTask;
		this.options = {
			concurrent: false,
			renderer: "default",
			fallbackRenderer: "simple",
			exitOnError: true,
			exitAfterRollback: true,
			collectErrors: false,
			registerSignalListeners: true,
			...this.parentTask?.options ?? {},
			...options
		};
		if (this.options.concurrent === true) this.options.concurrent = Infinity;
		else if (typeof this.options.concurrent !== "number") this.options.concurrent = 1;
		this.concurrency = new Concurrency({ concurrency: this.options.concurrent });
		if (parentTask) {
			this.path = [...parentTask.listr.path, parentTask.title];
			this.errors = parentTask.listr.errors;
		}
		if (this.parentTask?.listr.events instanceof ListrEventManager) this.events = this.parentTask.listr.events;
		else this.events = new ListrEventManager();
		/* istanbul ignore if */
		if (this.options?.forceTTY || process.env[ListrEnvironmentVariables.FORCE_TTY]) {
			process.stdout.isTTY = true;
			process.stderr.isTTY = true;
		}
		/* istanbul ignore if */
		if (this.options?.forceUnicode) process.env[ListrEnvironmentVariables.FORCE_UNICODE] = "1";
		const renderer = getRenderer$1({
			renderer: this.options.renderer,
			rendererOptions: this.options.rendererOptions,
			fallbackRenderer: this.options.fallbackRenderer,
			fallbackRendererOptions: this.options.fallbackRendererOptions,
			fallbackRendererCondition: this.options?.fallbackRendererCondition,
			silentRendererCondition: this.options?.silentRendererCondition
		});
		this.rendererClass = renderer.renderer;
		this.rendererClassOptions = renderer.options;
		this.rendererSelection = renderer.selection;
		/* istanbul ignore next */
		this.add(task ?? []);
		/* istanbul ignore if */
		if (this.options.registerSignalListeners) {
			this.boundSignalHandler = this.signalHandler.bind(this);
			process.once("SIGINT", this.boundSignalHandler).setMaxListeners(0);
		}
	}
	/**
	* Whether this is the root task.
	*/
	isRoot() {
		return !this.parentTask;
	}
	/**
	* Whether this is a subtask of another task list.
	*/
	isSubtask() {
		return !!this.parentTask;
	}
	/**
	* Add tasks to current task list.
	*
	* @see {@link https://listr2.kilic.dev/task/task.html}
	*/
	add(tasks) {
		this.tasks.push(...this.generate(tasks));
	}
	/**
	* Run the task list.
	*
	* @see {@link https://listr2.kilic.dev/listr/listr.html#run-the-generated-task-list}
	*/
	async run(context) {
		if (!this.renderer) this.renderer = new this.rendererClass(this.tasks, this.rendererClassOptions, this.events);
		await this.renderer.render();
		this.ctx = this.options?.ctx ?? context ?? {};
		try {
			await Promise.all(this.tasks.map((task) => task.check(this.ctx)));
			await Promise.all(this.tasks.map((task) => this.concurrency.add(() => this.runTask(task))));
			this.renderer.end();
			this.removeSignalHandler();
		} catch (err) {
			if (this.options.exitOnError !== false) {
				this.renderer.end(err);
				this.removeSignalHandler();
				throw err;
			}
		}
		return this.ctx;
	}
	generate(tasks) {
		tasks = Array.isArray(tasks) ? tasks : [tasks];
		return tasks.map((task) => {
			let rendererTaskOptions;
			if (this.rendererSelection === ListrRendererSelection.PRIMARY) rendererTaskOptions = task.rendererOptions;
			else if (this.rendererSelection === ListrRendererSelection.SECONDARY) rendererTaskOptions = task.fallbackRendererOptions;
			return new Task(this, task, this.options, this.rendererClassOptions, rendererTaskOptions);
		});
	}
	async runTask(task) {
		if (!await task.check(this.ctx)) return;
		return new TaskWrapper(task).run(this.ctx);
	}
	signalHandler() {
		this.tasks?.forEach(async (task) => {
			if (task.isPending()) task.state$ = ListrTaskState.FAILED;
		});
		if (this.isRoot()) {
			this.renderer?.end(/* @__PURE__ */ new Error("Interrupted."));
			process.exit(127);
		}
	}
	removeSignalHandler() {
		if (this.boundSignalHandler) process.removeListener("SIGINT", this.boundSignalHandler);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/figures.js
const info = blue$1(figures.arrowRight);
const error = red$1(figures.cross);
const warning = yellow$1(figures.warning);
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/messages.js
const configurationError = (opt, helpMsg, value) => `${red$1(`${error} Validation Error:`)}

  Invalid value for '${bold$1(opt)}': ${bold$1(inspect(value))}

  ${helpMsg}`;
const NOT_GIT_REPO = red$1(`${error} Current directory is not a git directory!`);
const FAILED_GET_STAGED_FILES = red$1(`${error} Failed to get staged files!`);
const incorrectBraces = (before, after) => yellow$1(`${warning} Detected incorrect braces with only single value: \`${before}\`. Reformatted as: \`${after}\`
`);
const NO_CONFIGURATION = `${error} lint-staged could not find any valid configuration.`;
const NO_STAGED_FILES = `${info} lint-staged could not find any staged files.`;
const NO_TASKS = `${info} lint-staged could not find any staged files matching configured tasks.`;
const skippingBackup = (hasInitialCommit, diff) => {
	return yellow$1(`${warning} Skipping backup because ${diff !== void 0 ? "`--diff` was used" : (hasInitialCommit ? "`--no-stash` was used" : "there’s no initial commit yet") + ". This might result in data loss"}.\n`);
};
const SKIPPING_HIDE_PARTIALLY_CHANGED = yellow$1(`${warning} Skipping hiding unstaged changes from partially staged files because \`--no-hide-partially-staged\` was used.\n`);
const DEPRECATED_GIT_ADD = yellow$1(`${warning} Some of your tasks use \`git add\` command. Please remove it from the config since all modifications made by tasks will be automatically added to the git commit index.
`);
const TASK_ERROR = "Skipped because of errors from tasks.";
const PREVENTED_TASK_MODIFICATIONS = `\n${error} lint-staged failed because \`--fail-on-changes\` was used.`;
const SKIPPED_GIT_ERROR = "Skipped because of previous git error.";
const GIT_ERROR = `\n  ${red$1(`${error} lint-staged failed due to a git error.`)}`;
const invalidOption = (name, value, message) => `${red$1(`${error} Validation Error:`)}

  Invalid value for option '${bold$1(name)}': ${bold$1(value)}

  ${message}

See https://github.com/okonet/lint-staged#command-line-flags`;
const PREVENTED_EMPTY_COMMIT = `
  ${yellow$1(`${warning} lint-staged prevented an empty git commit.
  Use the --allow-empty option to continue, or check your task configuration`)}
`;
const restoreStashExample = (hash = "h0a0s0h0") => `Any lost modifications can be restored from a git stash:

  > git stash list --format="%h %s"
  ${hash} On main: lint-staged automatic backup
  > git apply --index ${hash}`;
red$1(`${error} Failed to read config from stdin.`);
const failedToLoadConfig = (filepath) => red$1(`${error} Failed to read config from file "${filepath}".`);
const failedToParseConfig = (filepath, error) => `${red$1(`${error} Failed to parse config from file "${filepath}".`)}

${error}

See https://github.com/okonet/lint-staged#configuration.`;
const UNSTAGED_CHANGES_BACKUP_STASH_LOCATION = `Unstaged changes have been kept back in a patch file:`;
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/printTaskOutput.js
/**
* Handle logging of listr `ctx.output` to the specified `logger`
* @param {Object} ctx - The listr initial state
* @param {Object} logger - The logger
*/
const printTaskOutput = (ctx = {}, logger) => {
	if (!Array.isArray(ctx.output)) return;
	const log = ctx.errors?.size > 0 ? logger.error : logger.log;
	for (const line of ctx.output) log(line);
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/normalizePath.js
/**
* Reimplementation of "normalize-path"
* @see https://github.com/jonschlinkert/normalize-path/blob/52c3a95ebebc2d98c1ad7606cbafa7e658656899/index.js
*/
/*!
* normalize-path <https://github.com/jonschlinkert/normalize-path>
*
* Copyright (c) 2014-2018, Jon Schlinkert.
* Released under the MIT License.
*/
/**
* A file starting with \\?\
* @see https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file#win32-file-namespaces
*/
const WIN32_FILE_NS = "\\\\?\\";
/**
* A file starting with \\.\
* @see https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file#win32-file-namespaces
*/
const WIN32_DEVICE_NS = "\\\\.\\";
/**
* Normalize input file path to use POSIX separators
* @param {String} input
* @returns String
*/
const normalizePath = (input) => {
	if (input === path.posix.sep || input === path.win32.sep) return path.posix.sep;
	let normalized = input.split(/[/\\]+/).join(path.posix.sep);
	/** Handle win32 Namespaced paths by changing e.g. \\.\ to //./ */
	if (input.startsWith(WIN32_FILE_NS) || input.startsWith(WIN32_DEVICE_NS)) normalized = normalized.replace(/^\/(\.|\?)/, "//$1");
	/** Remove trailing slash */
	if (normalized.endsWith(path.posix.sep)) normalized = normalized.slice(0, -1);
	return normalized;
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/chunkFiles.js
const debugLog$14 = createDebug("lint-staged:chunkFiles");
/**
* Chunk array into sub-arrays
* @param {Array} arr
* @param {Number} chunkCount
* @returns {Array<Array>}
*/
const chunkArray = (arr, chunkCount) => {
	if (chunkCount === 1) return [arr];
	const chunked = [];
	let position = 0;
	for (let i = 0; i < chunkCount; i++) {
		const chunkLength = Math.ceil((arr.length - position) / (chunkCount - i));
		chunked.push([]);
		chunked[i] = arr.slice(position, chunkLength + position);
		position += chunkLength;
	}
	return chunked;
};
/**
* Chunk files into sub-arrays based on the length of the resulting argument string
*
* @typedef {import('./getStagedFiles.js').StagedFile[]} StagedFile
*
* @param {Object} opts
* @param {Array<StagedFile>} opts.files
* @param {String} [opts.baseDir] The optional base directory to resolve relative paths.
* @param {number} [opts.maxArgLength] the maximum argument string length
* @param {Boolean} [opts.relative] whether files are relative to `topLevelDir` or should be resolved as absolute
* @returns {Array<Array<StagedFile>>}
*/
const chunkFiles = ({ files, baseDir, maxArgLength = null, relative = false }) => {
	const normalizedFiles = files.map((file) => {
		return {
			filepath: normalizePath(relative || !baseDir ? file.filepath : path.resolve(baseDir, file.filepath)),
			status: file.status
		};
	});
	if (!maxArgLength) {
		debugLog$14("Skip chunking files because of undefined maxArgLength");
		return [normalizedFiles];
	}
	/** Calculate total character length of all filepaths, with added spaces in between */
	const fileListLength = normalizedFiles.reduce((sum, file) => sum + file.filepath.length, 0) + Math.max(normalizedFiles.length - 1, 0);
	debugLog$14(`Resolved an argument string length of ${fileListLength} characters from ${normalizedFiles.length} files`);
	const chunkCount = Math.min(Math.ceil(fileListLength / maxArgLength), normalizedFiles.length);
	debugLog$14(`Creating ${chunkCount} chunks for maxArgLength of ${maxArgLength}`);
	return chunkArray(normalizedFiles, chunkCount);
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
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/matchFiles.js
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
/**
* Match list of files against a pattern.
*
* @param {string} pattern
* @param {import('./getStagedFiles.js').StagedFile[]} files
*/
const matchFiles = (files, pattern, cwd = process.cwd()) => {
	const isMatch = (0, import_picomatch.default)(pattern, {
		cwd,
		dot: true,
		matchBase: !pattern.includes("/"),
		posixSlashes: true,
		strictBrackets: true
	});
	return files.filter((file) => isMatch(file.filepath));
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/generateTasks.js
const debugLog$13 = createDebug("lint-staged:generateTasks");
/**
* Generates all task commands, and filelist
*
* @param {object} options
* @param {Object} [options.config] - Task configuration
* @param {Object} [options.cwd] - Current working directory
* @param {import('./getStagedFiles.js').StagedFile[]} [options.files] - Staged filepaths
* @param {boolean} [options.relative] - Whether filepaths to should be relative to cwd
*/
const generateTasks = ({ config, cwd = process.cwd(), files, relative = false }) => {
	debugLog$13("Generating linter tasks");
	/** @type {StagedFile[]} */
	const relativeFiles = files.map((file) => ({
		filepath: normalizePath(path.relative(cwd, file.filepath)),
		status: file.status
	}));
	return Object.entries(config).map(([pattern, commands]) => {
		const isParentDirPattern = pattern.startsWith("../");
		const includedFiles = relativeFiles.filter((file) => {
			if (isParentDirPattern) return true;
			return !file.filepath.startsWith("..") && !path.isAbsolute(file.filepath);
		});
		const task = {
			pattern,
			commands,
			fileList: matchFiles(includedFiles, pattern, cwd).map((file) => ({
				filepath: normalizePath(relative ? file.filepath : path.resolve(cwd, file.filepath)),
				status: file.status
			}))
		};
		debugLog$13("Generated task: \n%O", task);
		return task;
	});
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/getAbortController.js
const Signal = {
	SIGINT: "SIGINT",
	SIGKILL: "SIGKILL"
};
/**
* Get an AbortController used to cancel running tasks on failure/interruption.
* @returns AbortController
*/
const getAbortController = (nodeProcess = process) => {
	const abortController = new AbortController();
	nodeProcess.on(Signal.SIGINT, () => {
		abortController.abort(Signal.SIGINT);
	});
	return abortController;
};
//#endregion
//#region ../../node_modules/.pnpm/string-argv@0.3.2/node_modules/string-argv/index.js
function parseArgsStringToArgv(value, env, file) {
	var myRegexp = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi;
	var myString = value;
	var myArray = [];
	if (env) myArray.push(env);
	if (file) myArray.push(file);
	var match;
	do {
		match = myRegexp.exec(myString);
		if (match !== null) myArray.push(firstString(match[1], match[6], match[0]));
	} while (match !== null);
	return myArray;
}
function firstString() {
	var args = [];
	for (var _i = 0; _i < arguments.length; _i++) args[_i] = arguments[_i];
	for (var i = 0; i < args.length; i++) {
		var arg = args[i];
		if (typeof arg === "string") return arg;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/killSubprocesses.js
const execAsync = promisify(exec);
/**
* End process by pid, forcefully, including child processes
*
* @see {@link https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill}
*
* @param {number} pid
*/
const killWin32Subprocesses = async (pid) => {
	await execAsync(`taskkill /pid ${pid} /T /F`);
};
/**
* Kill all processes in the group by using negative pid
*
* @see {@link https://pubs.opengroup.org/onlinepubs/9699919799/functions/kill.html}
*
* @param {number} pid
*/
const killUnixSubprocesses = async (pid) => {
	process.kill(-pid, "SIGKILL");
};
/**
* @param {number} pid
* @param {boolean} [isWin32]
*/
const killSubProcesses = async (pid, isWin32 = process.platform === "win32") => {
	try {
		if (isWin32) await killWin32Subprocesses(pid);
		else await killUnixSubprocesses(pid);
	} catch {}
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/symbols.js
const ApplyEmptyCommitError = Symbol("ApplyEmptyCommitError");
const ConfigNotFoundError = /* @__PURE__ */ new Error("Configuration could not be found");
const ConfigFormatError = /* @__PURE__ */ new Error("Configuration should be an object or a function");
const ConfigEmptyError = /* @__PURE__ */ new Error("Configuration should not be empty");
const GetBackupStashError = Symbol("GetBackupStashError");
const GetStagedFilesError = Symbol("GetStagedFilesError");
const GitError = Symbol("GitError");
const GitRepoError = Symbol("GitRepoError");
const HideUnstagedChangesError = Symbol("HideUnstagedChangesError");
const InvalidOptionsError = /* @__PURE__ */ new Error("Invalid Options");
const RestoreMergeStatusError = Symbol("RestoreMergeStatusError");
const RestoreOriginalStateError = Symbol("RestoreOriginalStateError");
const RestoreUnstagedChangesError = Symbol("RestoreUnstagedChangesError");
const TaskError = Symbol("TaskError");
const FailOnChangesError = Symbol("FailOnChangesError");
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/state.js
const getInitialState = ({ failOnChanges = false, hideUnstaged = false, hidePartiallyStaged = !hideUnstaged, quiet = false, revert = true } = {}) => ({
	backupHash: null,
	errors: /* @__PURE__ */ new Set([]),
	shouldFailOnChanges: failOnChanges,
	hasFilesToHide: null,
	output: [],
	quiet,
	shouldBackup: null,
	shouldHidePartiallyStaged: hidePartiallyStaged,
	shouldHideUnstaged: hideUnstaged,
	shouldRevert: revert,
	unstagedDiffSha256: null,
	unstagedPatch: null
});
const shouldHidePartiallyStagedFiles = (ctx) => ctx.shouldHidePartiallyStaged && ctx.hasFilesToHide;
const shouldRestoreUnstagedChanges = (ctx) => (ctx.shouldHideUnstaged || ctx.shouldHidePartiallyStaged) && ctx.hasFilesToHide;
const applyModificationsSkipped = (ctx) => {
	if (!ctx.shouldRevert || !ctx.shouldBackup) return false;
	if (ctx.errors.has(GitError)) return GIT_ERROR;
	if (ctx.errors.has(TaskError)) return TASK_ERROR;
};
const restoreUnstagedChangesSkipped = (ctx) => {
	if (ctx.errors.has(GitError)) return GIT_ERROR;
	if (!ctx.shouldRevert) {}
	if (ctx.errors.has(TaskError)) return TASK_ERROR;
};
const restoreOriginalStateEnabled = (ctx) => !!ctx.shouldRevert && !!ctx.shouldBackup && (ctx.errors.has(FailOnChangesError) || ctx.errors.has(TaskError) || ctx.errors.has(RestoreUnstagedChangesError));
const restoreOriginalStateSkipped = (ctx) => {
	if (ctx.errors.has(GitError) && !ctx.errors.has(RestoreUnstagedChangesError)) return GIT_ERROR;
};
const cleanupEnabled = (ctx) => ctx.shouldBackup;
const cleanupSkipped = (ctx) => {
	if (ctx.errors.has(FailOnChangesError) && !ctx.shouldRevert) return true;
	if (restoreOriginalStateSkipped(ctx)) return GIT_ERROR;
	if (ctx.errors.has(RestoreOriginalStateError)) return GIT_ERROR;
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/getSpawnedTask.js
const debugLog$12 = createDebug("lint-staged:getSpawnedTask");
/**
* Handle task console output.
*
* @param {string} command
* @param {string} output
* @param {ReturnType<typeof getInitialState>} ctx context
* @param {keyof typeof Signal | undefined} signal
* @param {import('tinyexec').Result} [errorResult]
*/
const handleTaskOutput = (command, output, ctx, signal, errorResult) => {
	if (output) {
		const outputTitle = errorResult ? red$1(`${error} ${command}:`) : `${info} ${command}:`;
		ctx.output.push([...ctx.quiet ? [] : ["", outputTitle], output].join("\n"));
		return;
	}
	if (ctx.quiet) return;
	if (signal === "SIGINT") ctx.output.push(red$1(`\n${error} Task interrupted: ${command}`));
	else if (signal === "SIGKILL") ctx.output.push(red$1(`\n${error} Task killed: ${command}`));
	else if (errorResult) ctx.output.push(red$1(`\n${error} Task failed to spawn: ${command}`), signal);
};
/**
* Create a error output depending on process result.
*
* @param {string} command
* @param {import('tinyexec').Result} result
* @param {ReturnType<typeof getInitialState>} ctx context
* @param {keyof typeof Signal | undefined} signal
* @returns {Error}
*/
const createTaskError = (command, result, ctx, signal = "FAILED") => {
	ctx.errors.add(TaskError);
	return new Error(`${red$1(command)} ${blackBright$1(`[${signal}]`)}`, { cause: result });
};
/**
* Returns the task function for the linter.
*
* @param {Object} options
* @param {AbortController} options.abortController
* @param {boolean} [options.color]
* @param {string} options.command — Linter task
* @param {string} [options.continueOnError]
* @param {string} [options.cwd]
* @param {String} options.topLevelDir - Current git repo top-level path
* @param {Boolean} options.isFn - Whether the linter task is a function
* @param {string[]} options.files — Filepaths to run the linter task against
* @param {Boolean} [options.verbose] — Always show task verbose
* @returns {() => Promise<Array<string>>}
*/
const getSpawnedTask = ({ abortController, color, command, continueOnError = false, cwd = process.cwd(), files, topLevelDir, isFn, verbose = false }) => {
	const [cmd, ...args] = parseArgsStringToArgv(command);
	debugLog$12("cmd:", cmd);
	debugLog$12("args:", args);
	/** @type {import('tinyexec').Options}*/
	const tinyExecOptions = { nodeOptions: {
		cwd: /^git(\.exe)?/i.test(cmd) ? topLevelDir : cwd,
		env: color ? { FORCE_COLOR: "true" } : { NO_COLOR: "true" },
		stdio: ["ignore"]
	} };
	debugLog$12("Tinyexec options:", tinyExecOptions);
	/** @param {ReturnType<typeof getInitialState>} ctx context */
	return async (ctx = getInitialState()) => {
		const result = exec$1(cmd, isFn ? args : args.concat(files), tinyExecOptions);
		const taskFailed = () => result.exitCode > 0 || result.process?.signalCode;
		/** @type {keyof typeof Signal | undefined} */
		let signal;
		abortController.signal.addEventListener("abort", async () => {
			if (taskFailed() || !result.process) return;
			signal = abortController.signal.reason;
			const pid = result.process.pid;
			result.process.kill(abortController.signal.reason);
			await killSubProcesses(pid);
		}, { once: true });
		let output = "";
		try {
			for await (const line of result) output += line + "\n";
		} catch (error) {
			/** Probably failed to spawn (ENOENT) */
			const errorSignal = error instanceof Error && error.code || "FAILED";
			if (continueOnError !== true)
 /** Other tasks should be killed */
			abortController.abort(Signal.SIGKILL);
			handleTaskOutput(command, output, ctx, errorSignal, result);
			throw createTaskError(command, result, ctx, errorSignal);
		}
		output = output.trimEnd();
		if (taskFailed()) {
			if (continueOnError !== true)
 /** Other tasks should be killed */
			abortController.abort(Signal.SIGKILL);
			if (result.process?.pid) await killSubProcesses(result.process.pid);
			handleTaskOutput(command, output, ctx, signal, result);
			throw createTaskError(command, result, ctx, result.process?.signalCode ?? signal);
		}
		if (verbose) handleTaskOutput(command, output, ctx, signal);
	};
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/getFunctionTask.js
const debugLog$11 = createDebug("lint-staged:getFunctionTasks");
/**
* @typedef {{ title: string; task: Function }} FunctionTask
* @type {(commands: FunctionTask|Array<string|Function>|string|Function) => boolean}
* @returns `true` if command is a function task
*/
const isFunctionTask = (commands) => typeof commands === "object" && !Array.isArray(commands);
/**
* Handles function configuration and pushes the tasks into the task array
*
* @param {object} command
* @param {import('./getStagedFiles.js').StagedFile[]} files
* @throws {Error} If the function configuration is not valid
*/
const getFunctionTask = async (command, files) => {
	debugLog$11("Creating Listr tasks for function %o", command);
	const task = async (ctx) => {
		try {
			await command.task(files.map((file) => file.filepath));
		} catch (e) {
			throw createTaskError(command.title, e, ctx);
		}
	};
	return [{
		title: command.title,
		task
	}];
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/getRenderer.js
const EOLRegex = new RegExp(EOL + "$");
const bindLogger = (consoleLogMethod) => new Writable({ write: function(chunk, encoding, next) {
	consoleLogMethod(chunk.toString().replace(EOLRegex, ""));
	next();
} });
const getMainRendererOptions = ({ color, debug, quiet }, logger, env) => {
	if (quiet) return { renderer: "silent" };
	if (env.NODE_ENV === "test") return {
		renderer: "test",
		rendererOptions: { logger: new ListrLogger({ processOutput: new ProcessOutput(bindLogger(logger.log), bindLogger(logger.error)) }) }
	};
	if (debug || !color) return { renderer: "verbose" };
	return {
		renderer: "update",
		rendererOptions: { formatOutput: "truncate" }
	};
};
const getFallbackRenderer = ({ renderer }, { color = false }) => {
	if (renderer === "silent" || renderer === "test" || !color) return renderer;
	return "verbose";
};
const getRenderer = ({ color, debug, quiet }, logger, env = process.env) => {
	const mainRendererOptions = getMainRendererOptions({
		color,
		debug,
		quiet
	}, logger, env);
	return {
		...mainRendererOptions,
		fallbackRenderer: getFallbackRenderer(mainRendererOptions, { color })
	};
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/getSpawnedTasks.js
const debugLog$10 = createDebug("lint-staged:getSpawnedTasks");
/**
* Creates and returns an array of listr tasks which map to the given commands.
*
* @param {object} options
* @param {AbortController} options.abortController
* @param {boolean} [options.color]
* @param {Array<string|Function>|string|Function} options.commands
* @param {string} options.continueOnError
* @param {string} options.cwd
* @param {import('./getStagedFiles.js').StagedFile[]} options.files
* @param {string} options.topLevelDir
* @param {Boolean} verbose
*/
const getSpawnedTasks = async ({ abortController, color, commands, continueOnError, cwd, files, topLevelDir, verbose }) => {
	debugLog$10("Creating Listr tasks for commands %o", commands);
	const cmdTasks = [];
	const commandArray = Array.isArray(commands) ? commands : [commands];
	const filepaths = files.map((f) => f.filepath);
	for (const cmd of commandArray) {
		const isFn = typeof cmd === "function";
		/** Pass copy of file list to prevent mutation by function from config file. */
		const resolved = isFn ? await cmd([...filepaths]) : cmd;
		const resolvedArray = Array.isArray(resolved) ? resolved : [resolved];
		for (const command of resolvedArray) {
			if (isFn && typeof command !== "string") throw new Error(configurationError("[Function]", "Function task should return a string or an array of strings", resolved));
			const task = getSpawnedTask({
				abortController,
				color,
				command,
				continueOnError,
				cwd,
				files: filepaths,
				topLevelDir,
				isFn,
				verbose
			});
			cmdTasks.push({
				title: command,
				command,
				task
			});
		}
	}
	return cmdTasks;
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/getDiffCommand.js
/** @type {(diff?: string, diffFilter?: string) => string[]} */
const getDiffCommand = (diff, diffFilter) => {
	/**
	*  Docs for --diff-filter option:
	* @see https://git-scm.com/docs/git-diff#Documentation/git-diff.txt---diff-filterACDMRTUXB82308203
	*/
	const diffFilterArg = diffFilter !== void 0 ? diffFilter.trim() : "ACMR";
	/** Use `--diff branch1...branch2` or `--diff="branch1 branch2", or fall back to default staged files */
	const diffArgs = diff !== void 0 ? diff.trim().split(" ") : ["--staged"];
	return [
		"diff",
		`--diff-filter=${diffFilterArg}`,
		...diffArgs
	];
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/parseGitZOutput.js
/**
* Return array of strings split from the output of `git <something> -z`.
* With `-z`, git prints `fileA\u0000fileB\u0000fileC\u0000` so we need to
* remove the last occurrence of `\u0000` before splitting
*/
const parseGitZOutput = (input) => input ? input.replace(/\u0000$/, "").split("\0") : [];
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/getStagedFiles.js
/**
* @typedef {'A'|'C'|'D'|'M'|'R'|'T'|'U'|'X'} FileSatus
* @typedef { { filepath: string; status: FileSatus }} StagedFile
*
* @param {Object} args
* @param {string} [args.cwd]
* @param {string} [args.diff]
* @param {string} [args.diffFilter]
* @retuns {Promise<StagedFile[] | null>}
*/
const getStagedFiles = async ({ cwd = process.cwd(), diff, diffFilter } = {}) => {
	try {
		/**
		* With the raw output lines look like:
		*
		* :000000 100644 0000000 780ccd3\u0000A\u0000.gitmodules\u0000
		* :000000 160000 0000000 1bb568e\u0000A\u0000submodule\u0000
		*
		* @see https://git-scm.com/docs/git-diff#_raw_output_format
		*/
		const output = await execGit([
			...getDiffCommand(diff, diffFilter),
			"--raw",
			"-z"
		], { cwd });
		if (!output) return [];
		/**
		* Split from all colons and remove the first one, after which lines will look like:
		*
		* 000000 100644 0000000 780ccd3 A\u0000.gitmodules\u0000
		* 000000 160000 0000000 47e5cff A\u0000submodule\u0000
		*
		* where '\u0000' is the NUL character from '-z' option. After that we
		* parse the lines by splitting from NUL, and then split the first
		* part from space. This yields us enough info both filter out submodule
		* roots and get the filename.
		*/
		return output.slice(1).split("\0:").map(parseGitZOutput).flatMap(([info, src, dst]) => {
			const [, dstMode, , , statusWithScore] = info.split(" ");
			/**
			* Filter out submodules and symlinks
			* @see https://github.com/git/git/blob/cb96e1697ad6e54d11fc920c95f82977f8e438f8/Documentation/git-fast-import.adoc?plain=1#L634-L646
			*/
			if (dstMode === "160000" || dstMode === "120000") return [];
			/**
			* @example "M"
			* @example "R86"
			*
			* - A: addition of a file
			* - C: copy of a file into a new one
			* - D: deletion of a file
			* - M: modification of the contents or mode of a file
			* - R: renaming of a file
			* - T: change in the type of the file (regular file, symbolic link or submodule)
			* - U: file is unmerged (you must complete the merge before it can be committed)
			* - X: "unknown" change type (most probably a bug, please report it)
			*/
			const status = statusWithScore[0];
			/** "dst" exists when moving files, otherwise it's undefined and only "src" exists */
			const filename = dst ?? src;
			return [{
				filepath: normalizePath(path.resolve(cwd, filename)),
				status
			}];
		});
	} catch {
		return null;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/file.js
const debugLog$9 = createDebug("lint-staged:file");
/**
* Read contents of a file to buffer
* @param {String} filename
* @param {Boolean} [ignoreENOENT=true] — Whether to throw if the file doesn't exist
* @returns {Promise<Buffer>}
*/
const readFile$1 = async (filename, ignoreENOENT = true) => {
	debugLog$9("Reading file `%s`", filename);
	try {
		return await fsPromises.readFile(filename);
	} catch (error) {
		if (ignoreENOENT && error.code === "ENOENT") {
			debugLog$9("File `%s` doesn't exist, ignoring...", filename);
			return null;
		} else throw error;
	}
};
/**
* Remove a file
* @param {String} filename
* @param {Boolean} [ignoreENOENT=true] — Whether to throw if the file doesn't exist
*/
const unlink = async (filename, ignoreENOENT = true) => {
	debugLog$9("Removing file `%s`", filename);
	try {
		await fsPromises.unlink(filename);
	} catch (error) {
		if (ignoreENOENT && error.code === "ENOENT") debugLog$9("File `%s` doesn't exist, ignoring...", filename);
		else throw error;
	}
};
/**
* Write buffer to file
* @param {String} filename
* @param {Buffer} buffer
*/
const writeFile = async (filename, buffer) => {
	debugLog$9("Writing file `%s`", filename);
	await fsPromises.writeFile(filename, buffer);
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/gitWorkflow.js
const debugLog$8 = createDebug("lint-staged:GitWorkflow");
const MERGE_HEAD = "MERGE_HEAD";
const MERGE_MODE = "MERGE_MODE";
const MERGE_MSG = "MERGE_MSG";
const RENAME = /\x00/;
/**
* From list of files, split renames and flatten into two files `to`NUL`from`.
* @param {string[]} files
* @param {Boolean} [includeRenameFrom=true] Whether or not to include the `from` renamed file, which is no longer on disk
*/
const processRenames = (files, includeRenameFrom = true) => files.reduce((flattened, file) => {
	if (RENAME.test(file)) {
		const [to, from] = file.split(RENAME);
		if (includeRenameFrom) flattened.push(from);
		flattened.push(to);
	} else flattened.push(file);
	return flattened;
}, []);
const STASH = "lint-staged automatic backup";
const PATCH_UNSTAGED = "lint-staged_unstaged.patch";
const GIT_DIFF_ARGS = [
	"--binary",
	"--unified=0",
	"--no-color",
	"--no-ext-diff",
	"--src-prefix=a/",
	"--dst-prefix=b/",
	"--patch",
	"--submodule=short"
];
const GIT_APPLY_ARGS = [
	"-v",
	"--whitespace=nowarn",
	"--recount",
	"--unidiff-zero"
];
const handleError = (error, ctx, symbol) => {
	ctx.errors.add(GitError);
	if (symbol) ctx.errors.add(symbol);
	throw error;
};
const calculateSha256 = (input) => crypto.createHash("sha256").update(input, "utf-8").digest("hex");
/**
* The lines are wrapped in double quotes
* @returns {string[]}
*/
const cleanGitStashOutput = (lines) => lines.map((line) => line.replace(/^"(.*)"$/, "$1"));
var GitWorkflow = class {
	/**
	* @param {Object} opts
	* @param {import('./getStagedFiles.js').StagedFile[][]} opts.matchedFileChunks
	*/
	constructor({ allowEmpty, diff, diffFilter, failOnChanges, gitConfigDir, matchedFileChunks, topLevelDir }) {
		this.execGit = (args, options = {}) => execGit(args, {
			...options,
			cwd: topLevelDir
		});
		this.allowEmpty = allowEmpty;
		this.deletedFiles = [];
		this.diff = diff;
		this.diffFilter = diffFilter;
		this.gitConfigDir = gitConfigDir;
		this.failOnChanges = !!failOnChanges;
		/** @type {import('./getStagedFiles.js').StagedFile[][]} */
		this.matchedFileChunks = matchedFileChunks;
		this.topLevelDir = topLevelDir;
		/**
		* These three files hold state about an ongoing git merge
		* Resolve paths during constructor
		*/
		this.mergeHeadFilename = path.resolve(gitConfigDir, MERGE_HEAD);
		this.mergeModeFilename = path.resolve(gitConfigDir, MERGE_MODE);
		this.mergeMsgFilename = path.resolve(gitConfigDir, MERGE_MSG);
	}
	/**
	* Get absolute path to file hidden inside .git
	* @param {string} filename
	*/
	getHiddenFilepath(filename) {
		return path.resolve(this.gitConfigDir, `./${filename}`);
	}
	/**
	* Get name of backup stash
	*/
	async getBackupStash(ctx) {
		const index = (await this.execGit([
			"stash",
			"list",
			"--format=\"%h %s\"",
			"-z"
		]).then(parseGitZOutput).then(cleanGitStashOutput)).findIndex((line) => line.startsWith(ctx.backupHash));
		if (index === -1) {
			ctx.errors.add(GetBackupStashError);
			throw new Error("lint-staged automatic backup is missing!");
		}
		return String(index);
	}
	/**
	* Get a list of unstaged deleted files
	*/
	async getDeletedFiles() {
		debugLog$8("Getting deleted files...");
		const deletedFiles = (await this.execGit(["ls-files", "--deleted"])).split("\n").filter(Boolean).map((file) => path.resolve(this.topLevelDir, file));
		debugLog$8("Found deleted files:", deletedFiles);
		return deletedFiles;
	}
	/**
	* Save meta information about ongoing git merge
	*/
	async backupMergeStatus() {
		debugLog$8("Backing up merge state...");
		await Promise.all([
			readFile$1(this.mergeHeadFilename).then((buffer) => this.mergeHeadBuffer = buffer),
			readFile$1(this.mergeModeFilename).then((buffer) => this.mergeModeBuffer = buffer),
			readFile$1(this.mergeMsgFilename).then((buffer) => this.mergeMsgBuffer = buffer)
		]);
		debugLog$8("Done backing up merge state!");
	}
	/**
	* Restore meta information about ongoing git merge
	*/
	async restoreMergeStatus(ctx) {
		debugLog$8("Restoring merge state...");
		try {
			await Promise.all([
				this.mergeHeadBuffer && writeFile(this.mergeHeadFilename, this.mergeHeadBuffer),
				this.mergeModeBuffer && writeFile(this.mergeModeFilename, this.mergeModeBuffer),
				this.mergeMsgBuffer && writeFile(this.mergeMsgFilename, this.mergeMsgBuffer)
			]);
			debugLog$8("Done restoring merge state!");
		} catch (error) {
			debugLog$8("Failed restoring merge state with error:");
			debugLog$8(error);
			handleError(/* @__PURE__ */ new Error("Merge state could not be restored due to an error!"), ctx, RestoreMergeStatusError);
		}
	}
	/**
	* Get a list of all files with both staged and unstaged modifications.
	* Renames have special treatment, since the single status line includes
	* both the "from" and "to" filenames, where "from" is no longer on disk.
	*/
	async getUnstagedFiles({ onlyPartial = false } = {}) {
		debugLog$8("Getting partially staged files...");
		/**
		* See https://git-scm.com/docs/git-status#_short_format
		* Entries returned in machine format are separated by a NUL character.
		* The first letter of each entry represents current index status,
		* and second the working tree. Index and working tree status codes are
		* separated from the file name by a space. If an entry includes a
		* renamed file, the file names are separated by a NUL character
		* (e.g. `to`\0`from`)
		*/
		const unstagedFiles = (await this.execGit(["status", "-z"])).split(/\x00(?=[ AMDRCU?!]{2} |$)/).filter((line) => {
			const [index, workingTree] = line;
			const updatedInIndex = index !== " " && index !== "?";
			const updatedInWorkingTree = workingTree !== " " && workingTree !== "?";
			if (onlyPartial) return updatedInIndex && updatedInWorkingTree;
			return updatedInWorkingTree;
		}).map((line) => line.slice(3)).filter(Boolean);
		debugLog$8(`Found ${onlyPartial ? "partially staged" : "unstaged"} files:`, unstagedFiles);
		return unstagedFiles.length ? unstagedFiles : null;
	}
	/**
	* Create a diff of unstaged or partially staged files and backup stash if enabled.
	*/
	async prepare(ctx, task) {
		try {
			debugLog$8(task.title);
			if (ctx.shouldBackup) {
				await this.backupMergeStatus();
				this.deletedFiles = await this.getDeletedFiles();
			}
			if (ctx.shouldHideUnstaged) {
				this.unstagedFiles = await this.getUnstagedFiles({ onlyPartial: false });
				ctx.hasFilesToHide = !!this.unstagedFiles;
			} else if (ctx.shouldHidePartiallyStaged) {
				this.unstagedFiles = await this.getUnstagedFiles({ onlyPartial: true });
				ctx.hasFilesToHide = !!this.unstagedFiles;
			}
			if (this.unstagedFiles) {
				const unstagedPatch = this.getHiddenFilepath(PATCH_UNSTAGED);
				ctx.unstagedPatch = unstagedPatch;
				const files = processRenames(this.unstagedFiles);
				await this.execGit([
					"diff",
					...GIT_DIFF_ARGS,
					"--output",
					unstagedPatch,
					"--",
					...files
				]);
			}
			if (ctx.shouldBackup) {
				if (ctx.shouldHideUnstaged) {
					/** Save stash of all changes, clearing the working tree but keeping staged files as-is */
					await this.execGit([
						"stash",
						"push",
						"--keep-index",
						"--message",
						STASH
					]);
					/** The stash line starts with the short hash, so we split from space and choose the first part */
					ctx.backupHash = (await this.execGit([
						"stash",
						"list",
						"--format=\"%h %s\"",
						"-z"
					]).then(parseGitZOutput).then(cleanGitStashOutput)).find((line) => line.includes(STASH))?.split(" ")[0];
				} else {
					/** Save stash of all changes, keeping all files as-is */
					const stashHash = await this.execGit(["stash", "create"]);
					ctx.backupHash = await this.execGit([
						"rev-parse",
						"--short",
						stashHash
					]);
					await this.execGit([
						"stash",
						"store",
						"--quiet",
						"--message",
						STASH,
						ctx.backupHash
					]);
				}
				task.title = `Backed up original state in git stash (${ctx.backupHash})`;
				debugLog$8(task.title);
			}
		} catch (error) {
			handleError(error, ctx);
		}
	}
	async hidePartiallyStagedChanges(ctx) {
		try {
			const files = processRenames(this.unstagedFiles, false);
			await this.execGit([
				"checkout",
				"--force",
				"--",
				...files
			]);
		} catch (error) {
			/**
			* `git checkout --force` doesn't throw errors, so it shouldn't be possible to get here.
			* If this does fail, the handleError method will set ctx.gitError and lint-staged will fail.
			*/
			handleError(error, ctx, HideUnstagedChangesError);
		}
	}
	async runTasks(ctx, task, { listrTasks, concurrent }) {
		if (ctx.shouldFailOnChanges) {
			debugLog$8("Calculating SHA-256 hash of unstaged changes because \"--fail-on-changes\" was used...");
			const diff = await this.execGit([
				"diff",
				"--patch",
				"--unified=0"
			]);
			ctx.unstagedDiffSha256 = calculateSha256(diff);
			debugLog$8("SHA-256 hash of unstaged changes is %s", ctx.unstagedDiffSha256);
		}
		return task.newListr(listrTasks, { concurrent });
	}
	/**
	* Applies back task modifications, and unstaged changes hidden in the stash.
	* In case of a merge-conflict retry with 3-way merge.
	*/
	async applyModifications(ctx) {
		if (ctx.shouldFailOnChanges) {
			debugLog$8("Calculating SHA-256 hash of changes after tasks because \"--fail-on-changes\" was used...");
			const diff = await this.execGit([
				"diff",
				"--patch",
				"--unified=0"
			]);
			const diffSha256 = calculateSha256(diff);
			debugLog$8("SHA-256 hash of changes after tasks is %s", diffSha256);
			if (ctx.unstagedDiffSha256 !== diffSha256) {
				ctx.errors.add(FailOnChangesError);
				throw new Error("Tasks modified files and --fail-on-changes was used!");
			}
		}
		debugLog$8("Adding task modifications to index...");
		for (const files of this.matchedFileChunks) {
			const addableFiles = (await Promise.allSettled(files.map(async (f) => {
				if (f.status === "D") {
					await fsPromises.access(f.filepath);
					return f.filepath;
				} else return f.filepath;
			}))).flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
			await this.execGit([
				"add",
				"--",
				...addableFiles
			]);
		}
		debugLog$8("Done adding task modifications to index!");
		if (!await this.execGit([
			...getDiffCommand(this.diff, this.diffFilter),
			"--name-only",
			"-z"
		]) && !this.allowEmpty) handleError(/* @__PURE__ */ new Error("Prevented an empty git commit!"), ctx, ApplyEmptyCommitError);
	}
	/**
	* Restore unstaged changes to partially changed files. If it at first fails,
	* this is probably because of conflicts between new task modifications.
	* 3-way merge usually fixes this, and in case it doesn't we should just give up and throw.
	*/
	async restoreUnstagedChanges(ctx) {
		debugLog$8("Restoring unstaged changes...");
		const unstagedPatch = this.getHiddenFilepath(PATCH_UNSTAGED);
		try {
			await this.execGit([
				"apply",
				...GIT_APPLY_ARGS,
				unstagedPatch
			]);
		} catch (applyError) {
			debugLog$8("Error while restoring changes:");
			debugLog$8(applyError);
			debugLog$8("Retrying with 3-way merge");
			try {
				await this.execGit([
					"apply",
					...GIT_APPLY_ARGS,
					"--3way",
					unstagedPatch
				]);
			} catch (threeWayApplyError) {
				debugLog$8("Error while restoring unstaged changes using 3-way merge:");
				debugLog$8(threeWayApplyError);
				handleError(/* @__PURE__ */ new Error("Unstaged changes could not be restored due to a merge conflict!"), ctx, RestoreUnstagedChangesError);
			}
		}
	}
	/**
	* Restore original HEAD state in case of errors
	*/
	async restoreOriginalState(ctx) {
		try {
			debugLog$8("Restoring original state...");
			await this.execGit([
				"reset",
				"--hard",
				"HEAD"
			]);
			await this.execGit([
				"stash",
				"apply",
				"--quiet",
				"--index",
				await this.getBackupStash(ctx)
			]);
			await this.restoreMergeStatus(ctx);
			await Promise.all(this.deletedFiles.map((file) => unlink(file)));
			await unlink(this.getHiddenFilepath(PATCH_UNSTAGED));
			debugLog$8("Done restoring original state!");
		} catch (error) {
			handleError(error, ctx, RestoreOriginalStateError);
		}
	}
	/**
	* Drop the created stashes after everything has run
	*/
	async cleanup(ctx) {
		try {
			debugLog$8("Dropping backup stash...");
			await this.execGit([
				"stash",
				"drop",
				"--quiet",
				await this.getBackupStash(ctx)
			]);
			debugLog$8("Done dropping backup stash!");
		} catch (error) {
			handleError(error, ctx);
		}
	}
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/groupFilesByConfig.js
const debugLog$7 = createDebug("lint-staged:groupFilesByConfig");
/**
* @typedef {import('./getStagedFiles.js').StagedFile} StagedFile
* @type {(args: { config: {[key: string]: { config: any; files: string[] }}; files: StagedFile[]; singleConfigMode?: boolean }) => Promise<{[key: string]: { config: any; files: StagedFile[] } }>
*/
const groupFilesByConfig = async ({ configs, files, singleConfigMode }) => {
	debugLog$7("Grouping %d files by %d configurations", files.length, Object.keys(configs).length);
	/** @type {Set<StagedFile>} */
	const filesSet = new Set(files);
	/** @type {{[key: string]: { config: any; files: StagedFile[] } }} */
	const filesByConfig = {};
	/** Configs are sorted deepest first by `searchConfigs` */
	for (const [filepath, config] of Object.entries(configs)) {
		/** When passed an explicit config object via the Node.js API‚ or an explicit path, skip logic */
		if (singleConfigMode) {
			filesByConfig[filepath] = {
				config,
				files
			};
			break;
		}
		const dir = path.normalize(path.dirname(filepath));
		/** Check if file is inside directory of the configuration file */
		const isInsideDir = (file) => {
			const relative = path.relative(dir, file.filepath);
			return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
		};
		/** This config should match all files since it has a parent glob */
		const includeAllFiles = Object.keys(config).some((glob) => glob.startsWith(".."));
		const scopedFiles = new Set(includeAllFiles ? filesSet : void 0);
		/**
		* Without a parent glob, if file is inside the config file's directory,
		* assign it to that configuration.
		*/
		if (!includeAllFiles) filesSet.forEach((file) => {
			if (isInsideDir(file)) scopedFiles.add(file);
		});
		/** Files should only match a single config */
		scopedFiles.forEach((file) => {
			filesSet.delete(file);
		});
		filesByConfig[filepath] = {
			config,
			files: Array.from(scopedFiles)
		};
	}
	return filesByConfig;
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/resolveGitRepo.js
const debugLog$6 = createDebug("lint-staged:resolveGitRepo");
/**
* Relative path up to the repo top-level directory
* @example "../"
*/
const CDUP = "--show-cdup";
/**
* Absolute repo top-level directory
*
* @example <caption>Git on macOS</caption>
* "/Users/iiro/Documents/git/lint-staged"
*
* @example <caption>Git for Windows</caption>
* "C:\Users\iiro\Documents\git\lint-staged"
*
* @example <caption>Git installed with MSYS2, this doesn't work when used as CWD with Node.js child_process</caption>
* "/c/Users/iiro/Documents/git/lint-staged"
*/
const TOPLEVEL = "--show-toplevel";
/**
* Absolute .git directory, similar to top-level
*
* @example "/Users/iiro/Documents/git/lint-staged/.git"
*/
const ABSOLUTE_GIT_DIR = "--absolute-git-dir";
/** Resolve git directory and possible submodule paths */
const resolveGitRepo = async (cwd = process.cwd()) => {
	try {
		debugLog$6("Resolving git repo from `%s`", cwd);
		debugLog$6("Unset GIT_DIR (was `%s`)", process.env.GIT_DIR);
		delete process.env.GIT_DIR;
		debugLog$6("Unset GIT_WORK_TREE (was `%s`)", process.env.GIT_WORK_TREE);
		delete process.env.GIT_WORK_TREE;
		const [relativeTopLevelDir, topLevel, absoluteGitDir] = (await execGit([
			"rev-parse",
			CDUP,
			TOPLEVEL,
			ABSOLUTE_GIT_DIR
		], { cwd })).split("\n");
		const topLevelDir = normalizePath(path.join(cwd, relativeTopLevelDir));
		debugLog$6("Resolved git repository top-level directory to be `%s`", topLevelDir);
		const relativeGitConfigDir = path.relative(topLevel, absoluteGitDir);
		const gitConfigDir = normalizePath(path.join(topLevelDir, relativeGitConfigDir));
		debugLog$6("Resolved git config directory to be `%s`", gitConfigDir);
		return {
			topLevelDir,
			gitConfigDir
		};
	} catch (error) {
		debugLog$6("Failed to resolve git repo with error:", error);
		return {
			error,
			topLevelDir: null,
			gitConfigDir: null
		};
	}
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/configFiles.js
const CONFIG_NAME = "lint-staged";
const PACKAGE_JSON_FILE = "package.json";
const PACKAGE_YAML_FILES = ["package.yaml", "package.yml"];
/**
* The list of files `lint-staged` will read configuration
* from, in the declared order.
*/
const CONFIG_FILE_NAMES = [
	PACKAGE_JSON_FILE,
	...PACKAGE_YAML_FILES,
	".lintstagedrc",
	".lintstagedrc.json",
	".lintstagedrc.yaml",
	".lintstagedrc.yml",
	".lintstagedrc.mjs",
	".lintstagedrc.mts",
	".lintstagedrc.js",
	".lintstagedrc.ts",
	".lintstagedrc.cjs",
	".lintstagedrc.cts",
	"lint-staged.config.mjs",
	"lint-staged.config.mts",
	"lint-staged.config.js",
	"lint-staged.config.ts",
	"lint-staged.config.cjs",
	"lint-staged.config.cts"
];
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/resolveConfig.js
/**
* require() does not exist for ESM, so we must create it to use require.resolve().
* @see https://nodejs.org/api/module.html#modulecreaterequirefilename
*/
const require$1 = createRequire(import.meta.url);
function resolveConfig(configPath) {
	try {
		return require$1.resolve(configPath);
	} catch {
		return configPath;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/loadConfig.js
/** @typedef {import('./index').Logger} Logger */
const debugLog$5 = createDebug("lint-staged:loadConfig");
const readFile = async (filename) => fsPromises.readFile(path.resolve(filename), "utf-8");
const jsonParse = async (filename) => {
	const isPackageFile = PACKAGE_JSON_FILE.includes(path.basename(filename));
	try {
		const content = await readFile(filename);
		const json = JSON.parse(content);
		return isPackageFile ? json[CONFIG_NAME] : json;
	} catch (error) {
		if (path.basename(filename) === "package.json") {
			debugLog$5("Ignoring invalid JSON file %s", filename);
			return;
		}
		throw error;
	}
};
const yamlParse = async (filename) => {
	const isPackageFile = PACKAGE_YAML_FILES.includes(path.basename(filename));
	try {
		const [YAML, content] = await Promise.all([import("../dist-Dqv1-Clg.js").then((m) => /* @__PURE__ */ __toESM(m.default, 1)), readFile(filename)]);
		const yaml = YAML.parse(content);
		return isPackageFile ? yaml[CONFIG_NAME] : yaml;
	} catch (error) {
		if (isPackageFile) {
			debugLog$5("Ignoring invalid YAML file %s", filename);
			return;
		}
		throw error;
	}
};
const dynamicImport = (path) => import(pathToFileURL(path)).then((module) => module.default);
const NO_EXT = "noExt";
/**
* `lilconfig` doesn't support yaml files by default,
* so we add custom loaders for those. Files without
* an extensions are assumed to be yaml — this
* assumption is in `cosmiconfig` as well.
*/
const loaders = {
	[NO_EXT]: yamlParse,
	".cjs": dynamicImport,
	".cts": dynamicImport,
	".js": dynamicImport,
	".json": jsonParse,
	".mjs": dynamicImport,
	".mts": dynamicImport,
	".ts": dynamicImport,
	".yaml": yamlParse,
	".yml": yamlParse
};
const loadConfigByExt = async (filename) => {
	const filepath = path.resolve(filename);
	const ext = path.extname(filepath) || NO_EXT;
	const loader = loaders[ext];
	return {
		config: await loader(filepath),
		filepath
	};
};
/** @param {string} configPath */
const loadConfig = async (configPath, logger) => {
	try {
		debugLog$5("Loading configuration from `%s`...", configPath);
		const result = await loadConfigByExt(resolveConfig(configPath));
		const config = await result.config ?? null;
		const filepath = result.filepath;
		if (config) debugLog$5("Successfully loaded config from `%s`:\n%O", filepath, config);
		else debugLog$5("Found no config in %s", filepath);
		return {
			config,
			filepath
		};
	} catch (error) {
		debugLog$5("Failed to load configuration from `%s` with error:\n", configPath, error);
		logger.error(failedToLoadConfig(configPath));
		return {};
	}
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/validateBraces.js
/**
* A correctly-formed brace expansion must contain unquoted opening and closing braces,
* and at least one unquoted comma or a valid sequence expression.
* Any incorrectly formed brace expansion is left unchanged.
*
* @see https://www.gnu.org/software/bash/manual/html_node/Brace-Expansion.html
*
* Lint-staged uses `micromatch` for brace expansion, and its behavior is to treat
* invalid brace expansions as literal strings, which means they (typically) do not match
* anything.
*
* This RegExp tries to match most cases of invalid brace expansions, so that they can be
* detected, warned about, and re-formatted by removing the braces and thus hopefully
* matching the files as intended by the user. The only real fix is to remove the incorrect
* braces from user configuration, but this is left to the user (after seeing the warning).
*
* @example <caption>Globs with brace expansions</caption>
* - *.{js,tx}        // expanded as *.js, *.ts
* - *.{{j,t}s,css}   // expanded as *.js, *.ts, *.css
* - file_{1..10}.css  // expanded as file_1.css, file_2.css, …, file_10.css
*
* @example <caption>Globs with incorrect brace expansions</caption>
* - *.{js}       // should just be *.js
* - *.{js,{ts}}  // should just be *.{js,ts}
* - *.\{js\}     // escaped braces, so they're treated literally
* - *.${js}      // dollar-sign inhibits expansion, so treated literally
* - *.{js\,ts}   // the comma is escaped, so treated literally
*/
const getIncorrectBracesRegexp = () => /(?<![\\$])({)(?:(?!(?<!\\),|\.\.|\{|\}).)*?(?<!\\)(})/g;
/**
* @param {string} pattern
* @returns {string}
*/
const stripIncorrectBraces = (pattern) => {
	let output = `${pattern}`;
	const regexp = getIncorrectBracesRegexp();
	let match = regexp.exec(output);
	while (match) {
		const fullMatch = match[0];
		const withoutBraces = fullMatch.replace(/{/, "").replace(/}/, "");
		output = output.replace(fullMatch, withoutBraces);
		regexp.lastIndex = 0;
		match = regexp.exec(output);
	}
	return output;
};
/**
* This RegExp matches "duplicate" opening and closing braces, without any other braces
* in between, where the duplication is redundant and should be removed.
*
* @example *.{{js,ts}}  // should just be *.{js,ts}
*/
const DOUBLE_BRACES_REGEXP = /{{[^}{]*}}/;
/**
* @param {string} pattern
* @returns {string}
*/
const stripDoubleBraces = (pattern) => {
	let output = `${pattern}`;
	const match = DOUBLE_BRACES_REGEXP.exec(pattern)?.[0];
	if (match) {
		const withoutBraces = match.replace("{{", "{").replace("}}", "}");
		output = output.replace(match, withoutBraces);
	}
	return output;
};
/**
* Validate and remove incorrect brace expansions from glob pattern.
* For example `*.{js}` is incorrect because it doesn't contain a `,` or `..`,
* and will be reformatted as `*.js`.
*
* @param {string} pattern the glob pattern
* @param {*} logger
* @returns {string}
*/
const validateBraces = (pattern, logger) => {
	const fixedPattern = stripDoubleBraces(stripIncorrectBraces(pattern));
	if (fixedPattern !== pattern) logger.warn(incorrectBraces(pattern, fixedPattern));
	return fixedPattern;
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/validateConfig.js
/** @typedef {import('./index').Logger} Logger */
const debugLog$4 = createDebug("lint-staged:validateConfig");
const validateConfigLogic = (config, configPath, logger) => {
	debugLog$4("Validating config from `%s`...", configPath);
	if (!config || typeof config !== "object" && typeof config !== "function") throw ConfigFormatError;
	/**
	* Function configurations receive all staged files as their argument.
	* They are not further validated here to make sure the function gets
	* evaluated only once.
	*
	* @see getSpawnedTasks
	*/
	if (typeof config === "function") return { "*": config };
	if (Object.entries(config).length === 0) throw ConfigEmptyError;
	const errors = [];
	/**
	* Create a new validated config because the keys (patterns) might change.
	* Since the Object.reduce method already loops through each entry in the config,
	* it can be used for validating the values at the same time.
	*/
	const validatedConfig = Object.entries(config).reduce((collection, [pattern, task]) => {
		if (Array.isArray(task)) {
			/** Array with invalid values */
			if (task.some((item) => typeof item !== "string" && typeof item !== "function")) errors.push(configurationError(pattern, "Should be an array of strings or functions.", task));
		} else if (typeof task === "object") {
			/** Invalid function task */
			if (typeof task.title !== "string" || typeof task.task !== "function") errors.push(configurationError(pattern, "Function task should contain `title` and `task` fields, where `title` should be a string and `task` should be a function.", task));
		} else if (typeof task !== "string" && typeof task !== "function")
 /** Singular invalid value */
		errors.push(configurationError(pattern, "Should be a string, a function, an object or an array of strings and functions.", task));
		/**
		* A typical configuration error is using invalid brace expansion, like `*.{js}`.
		* These are automatically fixed and warned about.
		*/
		const fixedPattern = validateBraces(pattern, logger);
		return Object.assign(collection, { [fixedPattern]: task });
	}, {});
	if (errors.length) {
		const message = errors.join("\n\n");
		logger.error(failedToParseConfig(configPath, message));
		throw new Error(message);
	}
	debugLog$4("Validated config from `%s`:", configPath);
	debugLog$4(inspect(config, { compact: false }));
	return validatedConfig;
};
/**
* Runs config validation. Throws error if the config is not valid.
* @param {Object} config
* @param {string} configPath
* @param {Logger} logger
* @returns {Object} config
*/
const validateConfig = (config, configPath, logger) => {
	try {
		return validateConfigLogic(config, configPath, logger);
	} catch (error) {
		logger.error(failedToParseConfig(configPath, error));
		throw error;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/searchConfigs.js
/** @typedef {import('./index').Logger} Logger */
const debugLog$3 = createDebug("lint-staged:searchConfigs");
const EXEC_GIT = [
	"ls-files",
	"-z",
	"--full-name",
	"-t"
];
const CONFIG_PATHSPEC = CONFIG_FILE_NAMES.map((f) => `:(glob)**/${f}`);
const numberOfLevels = (file) => file.split("/").length;
const sortAlphabetically = (a, b) => a.localeCompare(b);
const sortDeepestParth = (a, b) => numberOfLevels(a) > numberOfLevels(b) ? -1 : 1;
/**
* Get all possible config files from git
*
* @param {object} options
* @param {string} options.cwd
* @param {string} options.topLevelDir
* @returns {Promise<string[]>}
*/
const listConfigFilesFromGit = async ({ cwd, topLevelDir }) => execGit([
	...EXEC_GIT,
	"--cached",
	"--others",
	"--exclude-standard",
	"--",
	...CONFIG_PATHSPEC
], { cwd }).then(parseGitZOutput).then((lines) => {
	const possibleConfigFiles = lines.flatMap((line) => {
		/**
		* Leave out lines starting with "S " to ignore not-checked-out files in a sparse repo.
		* The "S" status means a tracked file that is "skip-worktree"
		* @see https://git-scm.com/docs/git-ls-files#Documentation/git-ls-files.txt--t
		*/
		if (line.startsWith("S ")) return [];
		const relativePath = line.replace(/^[HSMRCK?U] /, "");
		return [normalizePath(path.join(topLevelDir, relativePath))];
	});
	debugLog$3("Found possible config files from git:", possibleConfigFiles);
	return possibleConfigFiles;
});
/**
* Get all possible config files from filesystem, starting from `cwd` and
* moving upwards if nothing is found.
*
* @param {object} options
* @param {string} options.cwd
* @param {string[]} [possibleConfigFiles]
* @returns {Promise<string[]>}
*/
const listConfigFilesFromFs = async ({ cwd }) => {
	debugLog$3("Listing possible configs from filesystem starting from \"%s\"...", cwd);
	const possibleConfigFiles = (await Promise.allSettled(CONFIG_FILE_NAMES.map(async (f) => {
		const filepath = path.join(cwd, f);
		await fsPromises.access(filepath, constants$2.F_OK);
		return filepath;
	}))).flatMap((r) => r.status === "fulfilled" ? [normalizePath(r.value)] : []);
	if (possibleConfigFiles.length > 0) {
		debugLog$3("Found possible config files from filesystem:", possibleConfigFiles);
		return possibleConfigFiles;
	}
	const parentDir = path.dirname(cwd);
	if (parentDir === cwd) return [];
	return listConfigFilesFromFs({ cwd: parentDir });
};
/**
* Search all config files from the git repository, preferring those inside `cwd`.
*
* @param {object} options
* @param {Object} [options.configObject] - Explicit config object from the js API
* @param {string} [options.configPath] - Explicit path to a config file
* @param {string} [options.cwd] - Current working directory
* @param {string} [options.topLevelDir] - Top-level directory of the git repo
* @param {Logger} logger
*
* @returns {Promise<{ [key: string]: { config: *, files: string[] } }>} found configs with filepath as key, and config as value
*/
const searchConfigs = async ({ configObject, configPath, cwd = process.cwd(), topLevelDir = cwd }, logger) => {
	debugLog$3("Searching for configuration files...");
	if (configObject) {
		debugLog$3("Using single direct configuration object...");
		return { "": validateConfig(configObject, "config object", logger) };
	}
	if (configPath) {
		debugLog$3("Using single configuration path...");
		const { config, filepath } = await loadConfig(configPath, logger);
		if (!config) return {};
		return { [configPath]: validateConfig(config, filepath, logger) };
	}
	const possibleConfigFiles = /* @__PURE__ */ new Set();
	const addToSet = (files) => {
		files.forEach((f) => {
			possibleConfigFiles.add(f);
		});
	};
	await Promise.all([listConfigFilesFromGit({
		cwd,
		topLevelDir
	}).then(addToSet), listConfigFilesFromFs({ cwd }).then(addToSet)]);
	/** Create object with key as config file, and value as null */
	const configs = Array.from(possibleConfigFiles).sort(sortAlphabetically).sort(sortDeepestParth).reduce((acc, configPath) => Object.assign(acc, { [configPath]: null }), {});
	/** Load and validate all configs to the above object */
	await Promise.all(Object.keys(configs).map((configPath) => loadConfig(configPath, logger).then(({ config, filepath }) => {
		if (config) {
			if (configPath !== filepath) debugLog$3("Config file \"%s\" resolved to \"%s\"", configPath, filepath);
			configs[configPath] = validateConfig(config, filepath, logger);
		}
	})));
	/** Get validated configs from the above object, without any `null` values (not found) */
	const foundConfigs = Object.entries(configs).reduce((acc, [key, value]) => {
		if (value) Object.assign(acc, { [key]: value });
		return acc;
	}, {});
	debugLog$3("Found %d config files", Object.keys(foundConfigs).length);
	return foundConfigs;
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/runAll.js
/** @typedef {import('./index').Logger} Logger */
const debugLog$2 = createDebug("lint-staged:runAll");
/**
* @param {ReturnType<typeof getInitialState>} ctx context
* @param {unknown} cause error cause
*/
const createError = (ctx, cause) => Object.assign(new Error("lint-staged failed", { cause }), { ctx });
/**
* Executes all tasks and either resolves or rejects the promise
*
* @param {object} options
* @param {boolean} [options.allowEmpty] - Allow empty commits when tasks revert all staged changes
* @param {boolean} [options.color] - Enable or disable ANSI color codes in output.
* @param {boolean | number} [options.concurrent] - The number of tasks to run concurrently, or false to run tasks serially
* @param {Object} [options.configObject] - Explicit config object from the js API
* @param {string} [options.configPath] - Explicit path to a config file
* @param {boolean} [options.continueOnError] - Run all tasks to completion even if one fails
* @param {string} [options.cwd] - Current working directory
* @param {boolean} [options.debug] - Enable debug mode
* @param {string} [options.diff] - Override the default "--staged" flag of "git diff" to get list of files
* @param {string} [options.diffFilter] - Override the default "--diff-filter=ACMR" flag of "git diff" to get list of files
* @param {boolean} [options.failOnChanges] - Fail with exit code 1 when tasks modify tracked files
* @param {boolean} [options.hidePartiallyStaged] - Whether to hide unstaged changes from partially staged files before running tasks
* @param {boolean} [options.hideUnstaged] - Whether to hide all unstaged changes before running tasks
* @param {number} [options.maxArgLength] - Maximum argument string length
* @param {boolean} [options.quiet] - Disable lint-staged's own console output
* @param {boolean} [options.relative] - Pass relative filepaths to tasks
* @param {boolean} [options.revert] - revert to original state in case of errors
* @param {boolean} [options.stash] - Enable the backup stash, and revert in case of errors
* @param {boolean} [options.verbose] - Show task output even when tasks succeed; by default only failed output is shown
* @param {Logger} logger
* @returns {Promise}
*/
const runAll = async ({ allowEmpty = false, color = false, concurrent = true, configObject, configPath, continueOnError = false, cwd, debug = false, diff, diffFilter, failOnChanges = false, hideUnstaged = false, hidePartiallyStaged = !hideUnstaged, maxArgLength, quiet = false, relative = false, stash = diff === void 0, revert = stash, verbose = false }, logger = console) => {
	debugLog$2("Running all linter scripts...");
	const hasExplicitCwd = !!cwd;
	cwd = hasExplicitCwd ? path.resolve(cwd) : process.cwd();
	debugLog$2("Using working directory `%s`", cwd);
	const ctx = getInitialState({
		failOnChanges,
		hidePartiallyStaged,
		hideUnstaged,
		quiet,
		revert
	});
	const { topLevelDir, gitConfigDir } = await resolveGitRepo(cwd);
	if (!topLevelDir) {
		if (!quiet) ctx.output.push(NOT_GIT_REPO);
		ctx.errors.add(GitRepoError);
		throw createError(ctx, GitRepoError);
	}
	const hasInitialCommit = await execGit(["log", "-1"], { cwd: topLevelDir }).then(() => true).catch(() => false);
	ctx.shouldBackup = hasInitialCommit && stash;
	if (!ctx.shouldBackup && !quiet) logger.warn(skippingBackup(hasInitialCommit, diff));
	if (!ctx.shouldHidePartiallyStaged && !ctx.shouldHideUnstaged && !quiet) logger.warn(SKIPPING_HIDE_PARTIALLY_CHANGED);
	const [stagedFiles, foundConfigs] = await Promise.all([getStagedFiles({
		cwd: topLevelDir,
		diff,
		diffFilter
	}), searchConfigs({
		configObject,
		configPath,
		cwd,
		topLevelDir
	}, logger)]);
	if (!stagedFiles) {
		if (!quiet) ctx.output.push(FAILED_GET_STAGED_FILES);
		ctx.errors.add(GetStagedFilesError);
		throw createError(ctx, GetStagedFilesError);
	}
	debugLog$2("Loaded list of staged files in git:\n%O", stagedFiles);
	if (stagedFiles.length === 0) {
		if (!quiet) ctx.output.push(NO_STAGED_FILES);
		return ctx;
	}
	const numberOfConfigs = Object.keys(foundConfigs).length;
	if (numberOfConfigs === 0) {
		ctx.errors.add(ConfigNotFoundError);
		throw createError(ctx, ConfigNotFoundError);
	}
	const filesByConfig = await groupFilesByConfig({
		configs: foundConfigs,
		files: stagedFiles,
		singleConfigMode: configObject || configPath !== void 0
	});
	const hasMultipleConfigs = numberOfConfigs > 1;
	let hasDeprecatedGitAdd = false;
	const listrOptions = {
		ctx,
		exitOnError: false,
		registerSignalListeners: false,
		...getRenderer({
			color,
			debug,
			quiet
		}, logger)
	};
	const listrTasks = [];
	/** @type {Set<import('./getStagedFiles.js').StagedFile>} */
	const matchedFiles = /* @__PURE__ */ new Set();
	const abortController = getAbortController();
	for (const [configPath, { config, files }] of Object.entries(filesByConfig)) {
		const configName = configPath ? normalizePath(path.relative(cwd, configPath)) : "Config object";
		const stagedFileChunks = chunkFiles({
			baseDir: topLevelDir,
			files,
			maxArgLength,
			relative
		});
		const groupCwd = hasMultipleConfigs && !hasExplicitCwd ? path.dirname(configPath) : cwd;
		const chunkCount = stagedFileChunks.length;
		if (chunkCount > 1) debugLog$2("Chunked staged files from `%s` into %d part", configPath, chunkCount);
		for (const [index, files] of stagedFileChunks.entries()) {
			const chunkListrTasks = await Promise.all(generateTasks({
				config,
				cwd: groupCwd,
				files,
				relative
			}).map((task) => (isFunctionTask(task.commands) ? getFunctionTask(task.commands, task.fileList) : getSpawnedTasks({
				abortController,
				color,
				commands: task.commands,
				continueOnError,
				cwd: groupCwd,
				files: task.fileList,
				topLevelDir,
				verbose
			})).then((subTasks) => {
				task.fileList.forEach((file) => {
					const normalizedFile = path.isAbsolute(file.filepath) ? file : {
						filepath: normalizePath(path.join(groupCwd, file.filepath)),
						status: file.status
					};
					matchedFiles.add(normalizedFile);
				});
				hasDeprecatedGitAdd = hasDeprecatedGitAdd || subTasks.some((subTask) => subTask.command === "git add");
				const fileCount = task.fileList.length;
				return {
					title: `${task.pattern}${blackBright$1(` — ${fileCount} ${fileCount === 1 ? "file" : "files"}`)}`,
					task: async (ctx, task) => task.newListr(subTasks, {
						concurrent: false,
						exitOnError: !continueOnError
					}),
					skip: () => {
						if (fileCount === 0) return `${task.pattern}${blackBright$1(" — no files")}`;
						return false;
					}
				};
			})));
			listrTasks.push({
				title: `${configName}${blackBright$1(` — ${files.length} ${files.length > 1 ? "files" : "file"}`)}` + (chunkCount > 1 ? blackBright$1(` (chunk ${index + 1}/${chunkCount})...`) : ""),
				task: (ctx, task) => task.newListr(chunkListrTasks, {
					concurrent,
					exitOnError: !continueOnError
				}),
				skip: () => {
					if (ctx.errors.has(GitError)) return SKIPPED_GIT_ERROR;
					if (chunkListrTasks.every((task) => task.skip())) return `${configName}${blackBright$1(" — no tasks to run")}`;
					return false;
				}
			});
		}
	}
	if (hasDeprecatedGitAdd && !quiet) logger.warn(DEPRECATED_GIT_ADD);
	if (listrTasks.every((task) => task.skip())) {
		if (!quiet) ctx.output.push(NO_TASKS);
		return ctx;
	}
	const git = new GitWorkflow({
		allowEmpty,
		diff,
		diffFilter,
		failOnChanges,
		gitConfigDir,
		matchedFileChunks: chunkFiles({
			baseDir: cwd,
			files: Array.from(matchedFiles),
			maxArgLength,
			relative: false
		}),
		topLevelDir
	});
	await new Listr([
		{
			title: ctx.shouldBackup ? "Backing up original state..." : "Preparing lint-staged...",
			task: (ctx, task) => git.prepare(ctx, task)
		},
		{
			title: "Hiding unstaged changes to partially staged files...",
			task: (ctx) => git.hidePartiallyStagedChanges(ctx),
			enabled: shouldHidePartiallyStagedFiles
		},
		{
			title: `Running tasks for ${diff ? "changed" : "staged"} files...`,
			task: (ctx, task) => git.runTasks(ctx, task, {
				listrTasks,
				concurrent
			}),
			skip: () => listrTasks.every((task) => task.skip())
		},
		{
			title: "Applying modifications from tasks...",
			task: (ctx) => git.applyModifications(ctx),
			skip: applyModificationsSkipped
		},
		{
			title: "Restoring unstaged changes...",
			task: (ctx) => git.restoreUnstagedChanges(ctx),
			enabled: shouldRestoreUnstagedChanges,
			skip: restoreUnstagedChangesSkipped
		},
		{
			title: "Reverting to original state because of errors...",
			task: (ctx) => git.restoreOriginalState(ctx),
			enabled: restoreOriginalStateEnabled,
			skip: restoreOriginalStateSkipped
		},
		{
			title: "Cleaning up temporary files...",
			task: (ctx) => git.cleanup(ctx),
			enabled: cleanupEnabled,
			skip: cleanupSkipped
		}
	], listrOptions).run();
	if (ctx.errors.size > 0) throw createError(ctx);
	return ctx;
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/validateOptions.js
const debugLog$1 = createDebug("lint-staged:validateOptions");
/**
* Validate lint-staged options, either from the Node.js API or the command line flags.
* @param {*} options
* @param {boolean|string} [options.cwd] - Current working directory
* @throws {InvalidOptionsError}
*/
const validateOptions = async (options = {}, logger) => {
	debugLog$1("Validating options...");
	/** Ensure the passed cwd option exists; it might also be relative */
	if (typeof options.cwd === "string") try {
		const resolved = path.resolve(options.cwd);
		await fsPromises.access(resolved, constants.F_OK);
	} catch (error) {
		debugLog$1("Failed to validate options: %o", options);
		logger.error(invalidOption("cwd", options.cwd, error.message));
		throw InvalidOptionsError;
	}
	debugLog$1("Validated options: %o", options);
};
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/version.js
const getVersion = async () => "16.4.0";
//#endregion
//#region ../../node_modules/.pnpm/lint-staged@16.4.0/node_modules/lint-staged/lib/index.js
const debugLog = createDebug("lint-staged");
/**
* Get the maximum length of a command-line argument string based on current platform
*
* https://serverfault.com/questions/69430/what-is-the-maximum-length-of-a-command-line-in-mac-os-x
* https://support.microsoft.com/en-us/help/830473/command-prompt-cmd-exe-command-line-string-limitation
* https://unix.stackexchange.com/a/120652
*/
const getMaxArgLength = () => {
	switch (process.platform) {
		case "darwin": return 262144;
		case "win32": return 8191;
		default: return 131072;
	}
};
/**
* @typedef {(...any) => void} LogFunction
* @typedef {{ error: LogFunction, log: LogFunction, warn: LogFunction }} Logger
*
* Root lint-staged function that is called from `bin/lint-staged`.
*
* @param {object} options
* @param {Object} [options.allowEmpty] - Allow empty commits when tasks revert all staged changes
* @param {boolean} [options.color] - Enable or disable ANSI color codes in output.
* @param {boolean | number} [options.concurrent] - The number of tasks to run concurrently, or false to run tasks serially
* @param {object}  [options.config] - Object with configuration for programmatic API
* @param {string} [options.configPath] - Path to configuration file
* @param {boolean} [options.continueOnError] - Run all tasks to completion even if one fails
* @param {Object} [options.cwd] - Current working directory
* @param {boolean} [options.debug] - Enable debug mode
* @param {string} [options.diff] - Override the default "--staged" flag of "git diff" to get list of files
* @param {string} [options.diffFilter] - Override the default "--diff-filter=ACMR" flag of "git diff" to get list of files
* @param {boolean} [options.failOnChanges] - Fail with exit code 1 when tasks modify tracked files
* @param {boolean} [options.hidePartiallyStaged] - Whether to hide unstaged changes from partially staged files before running tasks
* @param {boolean} [options.hideUnstaged] - Whether to hide all unstaged changes before running tasks
* @param {number} [options.maxArgLength] - Maximum argument string length
* @param {boolean} [options.quiet] - Disable lint-staged’s own console output
* @param {boolean} [options.relative] - Pass relative filepaths to tasks
* @param {boolean} [options.revert] - revert to original state in case of errors
* @param {boolean} [options.stash] - Enable the backup stash, and revert in case of errors
* @param {boolean} [options.verbose] - Show task output even when tasks succeed; by default only failed output is shown
* @param {Logger} [logger]
*
* @returns {Promise<boolean>} Promise of whether the task passed or failed
*/
const lintStaged = async ({ allowEmpty = false, color = SUPPORTS_COLOR, concurrent = true, config: configObject, configPath, continueOnError = false, cwd, debug = false, diff, diffFilter, failOnChanges = false, hideUnstaged = false, hidePartiallyStaged = !hideUnstaged, maxArgLength = getMaxArgLength() / 2, quiet = false, relative = false, stash = diff === void 0, revert = !failOnChanges && !!stash, verbose = false } = {}, logger = console) => {
	if (debug) {
		enableDebug(logger);
		debugLog("Running `lint-staged@%s` on Node.js %s (%s)", await getVersion(), process.version, process.platform);
	}
	const gitVersion = await execGit(["version", "--build-options"], { cwd });
	debugLog("%s", gitVersion);
	const options = {
		allowEmpty,
		color,
		concurrent,
		configObject,
		configPath,
		continueOnError,
		cwd,
		debug,
		diff,
		diffFilter,
		failOnChanges,
		hidePartiallyStaged,
		hideUnstaged,
		maxArgLength,
		quiet,
		relative,
		revert,
		stash,
		verbose
	};
	await validateOptions(options, logger);
	debugLog("Unset GIT_LITERAL_PATHSPECS (was `%s`)", process.env.GIT_LITERAL_PATHSPECS);
	delete process.env.GIT_LITERAL_PATHSPECS;
	try {
		const ctx = await runAll(options, logger);
		debugLog("Tasks were executed successfully!");
		printTaskOutput(ctx, logger);
		return true;
	} catch (runAllError) {
		if (runAllError?.ctx?.errors) {
			const { ctx } = runAllError;
			if (ctx.errors.has(ConfigNotFoundError)) logger.error(NO_CONFIGURATION);
			else if (ctx.errors.has(ApplyEmptyCommitError)) logger.warn(PREVENTED_EMPTY_COMMIT);
			else if (ctx.errors.has(FailOnChangesError)) {
				logger.warn(PREVENTED_TASK_MODIFICATIONS + "\n");
				logger.warn(restoreStashExample(ctx.backupHash));
			} else if (ctx.errors.has(RestoreUnstagedChangesError)) {
				logger.warn(UNSTAGED_CHANGES_BACKUP_STASH_LOCATION);
				logger.warn(ctx.unstagedPatch);
			} else if ((ctx.errors.has(GitError) || cleanupSkipped(ctx)) && !ctx.errors.has(GetBackupStashError)) {
				logger.error(GIT_ERROR);
				if (ctx.shouldBackup) logger.error(restoreStashExample(ctx.backupHash) + "\n");
			}
			printTaskOutput(ctx, logger);
			return false;
		}
		throw runAllError;
	}
};
//#endregion
//#region src/staged/args.ts
function parseStagedArgs(argv) {
	return lib_default(argv, {
		alias: {
			h: "help",
			p: "concurrent",
			d: "debug",
			q: "quiet",
			r: "relative",
			v: "verbose"
		},
		boolean: [
			"help",
			"allow-empty",
			"debug",
			"continue-on-error",
			"fail-on-changes",
			"hide-partially-staged",
			"hide-unstaged",
			"quiet",
			"relative",
			"revert",
			"stash",
			"verbose"
		],
		string: [
			"concurrent",
			"cwd",
			"diff",
			"diff-filter"
		]
	});
}
function normalizeStagedArgs(args) {
	return {
		concurrent: normalizeConcurrent(args.concurrent),
		cwd: normalizeStringOption(args.cwd, "cwd", "path"),
		diff: normalizeStringOption(args.diff, "diff", "string"),
		diffFilter: normalizeStringOption(args["diff-filter"], "diff-filter", "string")
	};
}
function normalizeConcurrent(value) {
	if (value == null) return;
	if (value === true || value === false) return value;
	if (value === "") return true;
	if (value === "true") return true;
	if (value === "false") return false;
	const number = Number(value);
	if (Number.isFinite(number) && number > 0) return number;
	throw new Error("Option \"--concurrent\" must be true, false, or a number greater than 0.");
}
function normalizeStringOption(value, option, valueName) {
	if (value == null) return;
	if (value === false) throw new Error(`Option "--no-${option}" is not supported. Use "--${option} <${valueName}>".`);
	if (typeof value !== "string" || value === "") throw new Error(`Option "--${option}" requires a value.`);
	return value;
}
//#endregion
//#region src/staged/bin.ts
const args = parseStagedArgs(process.argv.slice(3));
if (args.help) {
	const helpMessage = renderCliDoc({
		usage: "vp staged [options]",
		summary: "Run linters on staged files using staged config from vite.config.ts.",
		documentationUrl: "https://viteplus.dev/guide/commit-hooks",
		sections: [{
			title: "Options",
			rows: [
				{
					label: "--allow-empty",
					description: "Allow empty commits when tasks revert all staged changes"
				},
				{
					label: "-p, --concurrent <number|boolean>",
					description: "Number of tasks to run concurrently, or false for serial"
				},
				{
					label: "--continue-on-error",
					description: "Run all tasks to completion even if one fails"
				},
				{
					label: "--cwd <path>",
					description: "Working directory to run all tasks in"
				},
				{
					label: "-d, --debug",
					description: "Enable debug output"
				},
				{
					label: "--diff <string>",
					description: "Override the default --staged flag of git diff"
				},
				{
					label: "--diff-filter <string>",
					description: "Override the default --diff-filter=ACMR flag of git diff"
				},
				{
					label: "--fail-on-changes",
					description: "Fail with exit code 1 when tasks modify tracked files"
				},
				{
					label: "--hide-partially-staged",
					description: "Hide unstaged changes from partially staged files"
				},
				{
					label: "--hide-unstaged",
					description: "Hide all unstaged changes before running tasks"
				},
				{
					label: "--no-stash",
					description: "Disable the backup stash"
				},
				{
					label: "-q, --quiet",
					description: "Disable console output"
				},
				{
					label: "-r, --relative",
					description: "Pass filepaths relative to cwd to tasks"
				},
				{
					label: "--revert",
					description: "Revert to original state in case of errors"
				},
				{
					label: "-v, --verbose",
					description: "Show task output even when tasks succeed"
				},
				{
					label: "-h, --help",
					description: "Show this help message"
				}
			]
		}]
	});
	printHeader();
	log(helpMessage);
} else {
	let normalizedArgs;
	try {
		normalizedArgs = normalizeStagedArgs(args);
	} catch (err) {
		printHeader();
		errorMsg(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
	const options = {};
	if (args["allow-empty"] != null) options.allowEmpty = args["allow-empty"];
	if (args.debug != null) options.debug = args.debug;
	if (args["continue-on-error"] != null) options.continueOnError = args["continue-on-error"];
	if (args["fail-on-changes"] != null) options.failOnChanges = args["fail-on-changes"];
	if (args["hide-partially-staged"] != null) options.hidePartiallyStaged = args["hide-partially-staged"];
	if (args["hide-unstaged"] != null) options.hideUnstaged = args["hide-unstaged"];
	if (args.quiet != null) options.quiet = args.quiet;
	if (args.relative != null) options.relative = args.relative;
	if (args.revert != null) options.revert = args.revert;
	if (args.stash != null) options.stash = args.stash;
	if (args.verbose != null) options.verbose = args.verbose;
	let stagedConfig;
	try {
		stagedConfig = (await resolveViteConfig(normalizedArgs.cwd ?? process.cwd())).staged;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`Failed to load vite.config: ${message}`);
		process.exit(1);
	}
	if (stagedConfig) options.config = stagedConfig;
	else {
		printHeader();
		errorMsg("No \"staged\" config found in vite.config.ts. Please add a staged config:");
		log("");
		log("  // vite.config.ts");
		log("  export default defineConfig({");
		log("    staged: { '*': 'vp check --fix' },");
		log("  });");
		process.exit(1);
	}
	if (normalizedArgs.cwd != null) options.cwd = normalizedArgs.cwd;
	if (normalizedArgs.diff != null) options.diff = normalizedArgs.diff;
	if (normalizedArgs.diffFilter != null) options.diffFilter = normalizedArgs.diffFilter;
	if (normalizedArgs.concurrent != null) options.concurrent = normalizedArgs.concurrent;
	const success = await lintStaged(options);
	process.exit(success ? 0 : 1);
}
//#endregion
export {};
