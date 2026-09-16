import { t as renderCliDoc } from "../help-BmKpeOP9.js";
import { i as log, o as printHeader } from "../terminal-MKGAuy-p.js";
import { t as lib_default } from "../lib-L3DWSRQp.js";
import { i as enable, r as disable, t as DEFAULT_HOOKS_DIR, u as status } from "../hooks-DFqViZqZ.js";
//#region src/hooks/args.ts
const KNOWN_HOOKS_ARG_KEYS = /* @__PURE__ */ new Set([
	"_",
	"help",
	"h",
	"hooks-dir"
]);
/**
* Reject leftover positionals and unknown flags before enable/disable mutate state.
*/
function unexpectedHooksArgsError(args) {
	const extra = args._.map(String).filter((value) => value !== "");
	if (extra.length > 0) return `Unexpected argument "${extra[0]}". Use --hooks-dir <path> to set a custom hooks directory.`;
	for (const key of Object.keys(args)) if (!KNOWN_HOOKS_ARG_KEYS.has(key)) return `Unknown option "--${key}".`;
	return null;
}
//#endregion
//#region src/hooks/bin.ts
const SUBCOMMANDS = [
	"enable",
	"disable",
	"status"
];
function isSubcommand(value) {
	return !!value && SUBCOMMANDS.includes(value);
}
function printHelp() {
	const helpMessage = renderCliDoc({
		usage: "vp hooks <COMMAND> [OPTIONS]",
		summary: "Manage the Vite+ Git hook dispatcher for this repository.",
		documentationUrl: "https://viteplus.dev/guide/commit-hooks",
		sections: [
			{
				title: "Commands",
				rows: [
					{
						label: "enable",
						description: "Install or refresh the hook dispatcher (sets core.hooksPath)"
					},
					{
						label: "disable",
						description: "Disable hooks: unset core.hooksPath, remove <dir>/_, persist preference"
					},
					{
						label: "status",
						description: "Show preference, core.hooksPath, and dispatcher state"
					}
				]
			},
			{
				title: "Options",
				rows: [{
					label: "--hooks-dir <path>",
					description: `Custom hooks directory (default: ${DEFAULT_HOOKS_DIR}, or last used)`
				}, {
					label: "-h, --help",
					description: "Show this help message"
				}]
			},
			{
				title: "Environment",
				rows: [{
					label: "VP_GIT_HOOKS=0",
					description: "Skip dispatcher install in enable (and skip hooks at commit time)"
				}]
			},
			{
				title: "Examples",
				lines: [
					"  vp hooks enable",
					"  vp hooks enable --hooks-dir .custom-hooks",
					"  vp hooks disable",
					"  vp hooks status"
				]
			}
		]
	});
	printHeader();
	log(helpMessage);
}
function applyResult(result) {
	if (result.message) log(result.message);
	if (result.isError) process.exit(1);
}
async function main() {
	const raw = process.argv.slice(3);
	const first = raw[0];
	const wantsHelp = raw.includes("-h") || raw.includes("--help");
	if (!first || first === "-h" || first === "--help") {
		printHelp();
		return;
	}
	if (!isSubcommand(first)) {
		log(`Unknown hooks command "${first}". Expected one of: ${SUBCOMMANDS.join(", ")}`);
		process.exit(1);
	}
	const subcommand = first;
	const args = lib_default(raw.slice(1), {
		boolean: ["help"],
		string: ["hooks-dir"],
		alias: { h: "help" }
	});
	if (args.help || wantsHelp) {
		printHelp();
		return;
	}
	const unexpected = unexpectedHooksArgsError(args);
	if (unexpected) {
		log(unexpected);
		process.exit(1);
	}
	const dirFlag = args["hooks-dir"];
	switch (subcommand) {
		case "enable":
			applyResult(enable(dirFlag));
			return;
		case "disable":
			applyResult(disable(dirFlag));
			return;
		case "status":
			applyResult(status(dirFlag));
			return;
	}
}
main();
//#endregion
export {};
