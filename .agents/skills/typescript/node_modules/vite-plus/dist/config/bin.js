import { t as renderCliDoc } from "../help-BmKpeOP9.js";
import { i as log, o as printHeader } from "../terminal-MKGAuy-p.js";
import { i as promptGitHooks, n as defaultInteractive } from "../prompts-DF3yU-eU.js";
import { t as lib_default } from "../lib-L3DWSRQp.js";
import { o as updateExistingAgentInstructions } from "../agent-Wqx0MPk0.js";
import { c as isHooksUserDisabled, l as resolveHooksLocation, o as install, s as isGitHooksEnvDisabled } from "../hooks-DFqViZqZ.js";
import { join } from "node:path";
import { existsSync } from "node:fs";
//#region src/config/bin.ts
async function main() {
	const args = lib_default(process.argv.slice(3), {
		boolean: [
			"help",
			"hooks",
			"agent"
		],
		string: ["hooks-dir"],
		alias: { h: "help" }
	});
	if (args.help) {
		const helpMessage = renderCliDoc({
			usage: "vp config [OPTIONS]",
			summary: "Configure Vite+ for the current project (hook dispatcher + agent integration).",
			documentationUrl: "https://viteplus.dev/guide/commit-hooks",
			sections: [{
				title: "Options",
				rows: [
					{
						label: "--hooks-dir <path>",
						description: "Custom hooks directory (default: .vite-hooks, or last used in this clone)"
					},
					{
						label: "--no-hooks",
						description: "Skip hook dispatcher installation"
					},
					{
						label: "--no-agent",
						description: "Skip updating coding agent instructions"
					},
					{
						label: "-h, --help",
						description: "Show this help message"
					}
				]
			}, {
				title: "Environment",
				rows: [{
					label: "VP_GIT_HOOKS=0",
					description: "Skip hook dispatcher installation"
				}]
			}]
		});
		printHeader();
		log(helpMessage);
		return;
	}
	const dir = args["hooks-dir"];
	const skipHooks = args.hooks === false;
	const skipAgent = args.agent === false;
	const interactive = defaultInteractive();
	const lifecycleEvent = process.env.npm_lifecycle_event;
	const isLifecycleScript = lifecycleEvent === "prepare" || lifecycleEvent === "postinstall";
	const root = process.cwd();
	if (!skipHooks && isGitHooksEnvDisabled()) log("skip install (git hooks disabled)");
	else if (!skipHooks) {
		const location = resolveHooksLocation(dir);
		if ("isError" in location) {
			if (location.message) log(location.message);
			if (location.isError) process.exit(1);
		} else {
			const isFirstHooksRun = !existsSync(join(location.baseDir, location.dir, "_", "pre-commit"));
			let shouldSetupHooks = true;
			if (isHooksUserDisabled()) {
				log("skip install (hooks disabled; run `vp hooks enable` to re-enable)");
				shouldSetupHooks = false;
			} else if (interactive && isFirstHooksRun && !dir && !isLifecycleScript) shouldSetupHooks = await promptGitHooks({
				interactive,
				message: "Install the Git hook dispatcher for this project?"
			});
			if (shouldSetupHooks) {
				const { message, isError } = install(dir);
				if (message) {
					log(message);
					if (isError) process.exit(1);
				}
			}
		}
	}
	if (!skipAgent) updateExistingAgentInstructions(root);
}
main();
//#endregion
export {};
