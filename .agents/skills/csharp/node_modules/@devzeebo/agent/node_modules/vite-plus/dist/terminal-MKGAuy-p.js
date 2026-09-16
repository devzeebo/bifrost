import { shouldPrintVitePlusHeader, vitePlusHeader } from "../binding/index.js";
import { styleText } from "node:util";
//#region src/utils/terminal.ts
function log(message) {
	console.log(message);
}
/**
* Emit the Vite+ banner (header line + trailing blank line) to stdout.
* Gating (non-TTY, git hooks) lives in `shouldPrintVitePlusHeader` on the
* Rust side so both CLIs stay in sync.
*/
function printHeader() {
	if (!shouldPrintVitePlusHeader()) return;
	log(vitePlusHeader());
	log("");
}
function accent(text) {
	return styleText("blue", text);
}
function muted(text) {
	return styleText("gray", text);
}
function success(text) {
	return styleText("green", text);
}
function formatDuration(durationMs) {
	if (durationMs < 1e3) return `${Math.max(1, durationMs)}ms`;
	const durationSeconds = durationMs / 1e3;
	if (durationSeconds < 10) return `${durationSeconds.toFixed(1)}s`;
	return `${Math.round(durationSeconds)}s`;
}
function warnMsg(msg) {
	console.error(styleText(["yellow", "bold"], "warn:"), msg);
}
function errorMsg(msg) {
	console.error(styleText(["red", "bold"], "error:"), msg);
}
//#endregion
export { muted as a, warnMsg as c, log as i, errorMsg as n, printHeader as o, formatDuration as r, success as s, accent as t };
