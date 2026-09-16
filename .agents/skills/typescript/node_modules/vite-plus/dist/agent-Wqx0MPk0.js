import { A as isCancel, C as log, E as select, w as multiselect } from "./prompts-DF3yU-eU.js";
import path from "node:path";
import { styleText } from "node:util";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
//#region src/utils/path.ts
function findPkgRoot() {
	let dir = import.meta.dirname;
	while (dir !== path.dirname(dir)) {
		if (fs.existsSync(path.join(dir, "package.json"))) return dir;
		dir = path.dirname(dir);
	}
	return dir;
}
const pkgRoot = findPkgRoot();
const templatesDir = path.join(pkgRoot, "templates");
const rulesDir = path.join(pkgRoot, "rules");
function displayRelative(to, from = process.cwd()) {
	return path.relative(from, to).replaceAll("\\", "/");
}
//#endregion
//#region src/utils/agent.ts
const AGENTS = [
	{
		id: "agents",
		label: "AGENTS.md",
		targetPath: "AGENTS.md",
		hint: "Codex, Amp, OpenCode, and similar agents",
		aliases: [
			"agents.md",
			"chatgpt",
			"chatgpt-codex",
			"codex",
			"amp",
			"kilo",
			"kilo-code",
			"kiro",
			"kiro-cli",
			"opencode",
			"other"
		]
	},
	{
		id: "claude",
		label: "CLAUDE.md",
		targetPath: "CLAUDE.md",
		hint: "Claude Code",
		aliases: ["claude.md", "claude-code"]
	},
	{
		id: "gemini",
		label: "GEMINI.md",
		targetPath: "GEMINI.md",
		hint: "Gemini CLI",
		aliases: ["gemini.md", "gemini-cli"]
	},
	{
		id: "copilot",
		label: ".github/copilot-instructions.md",
		targetPath: ".github/copilot-instructions.md",
		hint: "GitHub Copilot",
		aliases: ["github-copilot", "copilot-instructions.md"]
	},
	{
		id: "cursor",
		label: ".cursor/rules/viteplus.mdc",
		targetPath: ".cursor/rules/viteplus.mdc",
		hint: "Cursor",
		aliases: ["viteplus.mdc"]
	},
	{
		id: "jetbrains",
		label: ".aiassistant/rules/viteplus.md",
		targetPath: ".aiassistant/rules/viteplus.md",
		hint: "JetBrains AI Assistant",
		aliases: [
			"jetbrains",
			"jetbrains-ai-assistant",
			"aiassistant",
			"viteplus.md"
		]
	}
];
const AGENT_DEFAULT_ID = "agents";
const AGENT_STANDARD_PATH = "AGENTS.md";
const COPILOT_AGENT_ID = "copilot";
const COPILOT_SETUP_WORKFLOW_PATH = ".github/workflows/copilot-setup-steps.yml";
const AGENT_INSTRUCTIONS_START_MARKER = "<!--VITE PLUS START-->";
const AGENT_INSTRUCTIONS_END_MARKER = "<!--VITE PLUS END-->";
const AGENT_ALIASES = Object.fromEntries(AGENTS.flatMap((option) => (option.aliases ?? []).map((alias) => [normalizeAgentName(alias), option.id])));
const COPILOT_SETUP_WORKFLOW_CONTENT = `name: "Copilot Setup Steps"

on:
  workflow_dispatch:
  push:
    paths:
      - .github/workflows/copilot-setup-steps.yml
  pull_request:
    paths:
      - .github/workflows/copilot-setup-steps.yml

jobs:
  copilot-setup-steps:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Checkout code
        uses: actions/checkout@v6
        with:
          persist-credentials: false
      - name: Set up Vite+
        uses: voidzero-dev/setup-vp@v1
        with:
          cache: true
          run-install: true
      - name: Verify Vite+
        run: vp --version
`;
async function selectAgentTargets({ interactive, agent, onCancel }) {
	if (agent === false) return {
		targetPaths: void 0,
		selectedAgents: []
	};
	if (interactive && !agent) {
		const selectedAgentIds = await multiselect({
			message: "Which coding agent instruction files should Vite+ create?",
			options: AGENTS.map((option) => ({
				label: option.label,
				value: option.id,
				hint: option.hint
			})),
			initialValues: [AGENT_DEFAULT_ID],
			required: false
		});
		if (isCancel(selectedAgentIds)) {
			onCancel();
			return {
				targetPaths: void 0,
				selectedAgents: []
			};
		}
		if (selectedAgentIds.length === 0) return {
			targetPaths: void 0,
			selectedAgents: []
		};
		const selectedAgents = resolveAgentOptions(selectedAgentIds);
		return {
			targetPaths: getAgentTargetPaths(selectedAgents),
			selectedAgents
		};
	}
	const selectedAgents = resolveAgentOptions(agent ?? AGENT_DEFAULT_ID);
	return {
		targetPaths: getAgentTargetPaths(selectedAgents),
		selectedAgents
	};
}
async function selectAgentTargetPaths({ interactive, agent, onCancel }) {
	return (await selectAgentTargets({
		interactive,
		agent,
		onCancel
	})).targetPaths;
}
function detectExistingAgentTargetPaths(projectRoot) {
	const detectedPaths = [];
	const seenTargetPaths = /* @__PURE__ */ new Set();
	for (const option of AGENTS) {
		if (seenTargetPaths.has(option.targetPath)) continue;
		seenTargetPaths.add(option.targetPath);
		const targetPath = path.join(projectRoot, option.targetPath);
		if (fs.existsSync(targetPath) && !fs.lstatSync(targetPath).isSymbolicLink()) detectedPaths.push(option.targetPath);
	}
	return detectedPaths.length > 0 ? detectedPaths : void 0;
}
/**
* Silently update agent instruction files that contain Vite+ markers.
* - No agent files → no writes
* - No Vite+ markers → no writes
* - Markers present, content up to date → no writes
* - Markers present, content outdated → update marked section
*/
function updateExistingAgentInstructions(projectRoot) {
	const targetPaths = detectExistingAgentTargetPaths(projectRoot);
	if (!targetPaths) return;
	const templatePath = path.join(pkgRoot, "AGENTS.md");
	if (!fs.existsSync(templatePath)) return;
	const templateContent = fs.readFileSync(templatePath, "utf-8");
	for (const targetPath of targetPaths) try {
		const fullPath = path.join(projectRoot, targetPath);
		const existing = fs.readFileSync(fullPath, "utf-8");
		const updated = replaceMarkedAgentInstructionsSection(existing, templateContent);
		if (updated !== void 0 && updated !== existing) fs.writeFileSync(fullPath, updated);
	} catch {}
}
function resolveAgentOptions(agent) {
	const agentNames = parseAgentNames(agent);
	const resolvedAgentNames = agentNames.length > 0 ? agentNames : [AGENT_DEFAULT_ID];
	const dedupedAgents = [];
	const seenAgentIds = /* @__PURE__ */ new Set();
	for (const name of resolvedAgentNames) {
		const option = resolveSingleAgentOption(name);
		if (seenAgentIds.has(option.id)) continue;
		seenAgentIds.add(option.id);
		dedupedAgents.push(option);
	}
	return dedupedAgents;
}
function getAgentTargetPaths(agents) {
	const dedupedTargetPaths = [];
	const seenTargetPaths = /* @__PURE__ */ new Set();
	for (const agent of agents) {
		if (seenTargetPaths.has(agent.targetPath)) continue;
		seenTargetPaths.add(agent.targetPath);
		dedupedTargetPaths.push(agent.targetPath);
	}
	return dedupedTargetPaths;
}
function parseAgentNames(agent) {
	if (!agent) return [];
	return (Array.isArray(agent) ? agent : [agent]).filter((value) => typeof value === "string").flatMap((value) => value.split(",")).map((value) => value.trim()).filter((value) => value.length > 0);
}
function resolveSingleAgentOption(agent) {
	const normalized = normalizeAgentName(agent);
	const alias = AGENT_ALIASES[normalized];
	const resolved = alias ? normalizeAgentName(alias) : normalized;
	return AGENTS.find((option) => normalizeAgentName(option.id) === resolved || normalizeAgentName(option.label) === resolved || normalizeAgentName(option.targetPath) === resolved || option.aliases?.some((candidate) => normalizeAgentName(candidate) === resolved)) ?? AGENTS.find((option) => option.id === AGENT_DEFAULT_ID);
}
/** Order target paths for the shared detect/write traversal: AGENTS.md first. */
function orderAgentTargetPaths(projectRoot, targetPaths) {
	const orderedPaths = targetPaths.includes(AGENT_STANDARD_PATH) ? [AGENT_STANDARD_PATH, ...targetPaths.filter((p) => p !== AGENT_STANDARD_PATH)] : targetPaths;
	const dedupedPaths = [];
	const seenDestinationPaths = /* @__PURE__ */ new Set();
	for (const targetPath of orderedPaths) {
		const destinationKey = path.resolve(path.join(projectRoot, targetPath));
		if (seenDestinationPaths.has(destinationKey)) continue;
		seenDestinationPaths.add(destinationKey);
		dedupedPaths.push(targetPath);
	}
	return dedupedPaths;
}
/**
* Classify an existing agent instruction file for the shared detect/write
* traversal. Registers the file's realpath in the caller-owned `seenRealPaths`.
*/
async function classifyExistingAgentTarget(destinationPath, incomingContent, seenRealPaths) {
	if (fs.lstatSync(destinationPath).isSymbolicLink()) return { kind: "symlink" };
	const destinationRealPath = await fsPromises.realpath(destinationPath);
	if (seenRealPaths.has(destinationRealPath)) return { kind: "duplicate" };
	seenRealPaths.add(destinationRealPath);
	const existingContent = await fsPromises.readFile(destinationPath, "utf-8");
	const updatedContent = replaceMarkedAgentInstructionsSection(existingContent, incomingContent);
	if (updatedContent !== void 0) return {
		kind: "markers",
		existingContent,
		updatedContent
	};
	return {
		kind: "conflict",
		existingContent
	};
}
/**
* Detect agent instruction files that would conflict (exist without markers).
* Returns only files that need a user decision (append or skip).
* Read-only — does not write or modify any files.
*/
async function detectAgentConflicts({ projectRoot, targetPaths }) {
	if (!targetPaths || targetPaths.length === 0) return [];
	const sourcePath = path.join(pkgRoot, "AGENTS.md");
	if (!fs.existsSync(sourcePath)) return [];
	const incomingContent = await fsPromises.readFile(sourcePath, "utf-8");
	const shouldLinkToAgents = targetPaths.includes(AGENT_STANDARD_PATH);
	const conflicts = [];
	const seenRealPaths = /* @__PURE__ */ new Set();
	for (const targetPathToCheck of orderAgentTargetPaths(projectRoot, targetPaths)) {
		const destinationPath = path.join(projectRoot, targetPathToCheck);
		if (shouldLinkToAgents && targetPathToCheck !== AGENT_STANDARD_PATH) {
			if (await getExistingPathKind(destinationPath) !== "file") continue;
		}
		if (!fs.existsSync(destinationPath)) continue;
		if ((await classifyExistingAgentTarget(destinationPath, incomingContent, seenRealPaths)).kind === "conflict") conflicts.push({ targetPath: targetPathToCheck });
	}
	return conflicts;
}
async function writeAgentInstructions({ projectRoot, targetPath, targetPaths, interactive, conflictDecisions, silent = false }) {
	const paths = [...targetPaths ?? [], ...targetPath ? [targetPath] : []];
	if (paths.length === 0) return;
	const sourcePath = path.join(pkgRoot, "AGENTS.md");
	if (!fs.existsSync(sourcePath)) {
		if (!silent) log.warn("Agent instructions template not found; skipping.");
		return;
	}
	const seenRealPaths = /* @__PURE__ */ new Set();
	const incomingContent = await fsPromises.readFile(sourcePath, "utf-8");
	const shouldLinkToAgents = paths.includes(AGENT_STANDARD_PATH);
	for (const targetPathToWrite of orderAgentTargetPaths(projectRoot, paths)) {
		const destinationPath = path.join(projectRoot, targetPathToWrite);
		await fsPromises.mkdir(path.dirname(destinationPath), { recursive: true });
		if (shouldLinkToAgents && targetPathToWrite !== AGENT_STANDARD_PATH) {
			if (await tryLinkTargetToAgents(projectRoot, targetPathToWrite, silent)) continue;
		}
		if (fs.existsSync(destinationPath)) {
			const state = await classifyExistingAgentTarget(destinationPath, incomingContent, seenRealPaths);
			if (state.kind === "symlink") {
				if (!silent) log.info(`Skipped writing ${targetPathToWrite} (symlink)`);
				continue;
			}
			if (state.kind === "duplicate") {
				if (!silent) log.info(`Skipped writing ${targetPathToWrite} (duplicate target)`);
				continue;
			}
			if (state.kind === "markers") {
				if (state.updatedContent !== state.existingContent) await fsPromises.writeFile(destinationPath, state.updatedContent);
				continue;
			}
			let conflictAction;
			const preResolved = conflictDecisions?.get(targetPathToWrite);
			if (preResolved) conflictAction = preResolved;
			else if (interactive) {
				const action = await select({
					message: `Agent instructions already exist at ${targetPathToWrite}.\n  ` + styleText("gray", "The Vite+ template includes guidance on `vp` commands, the build pipeline, and project conventions."),
					options: [{
						label: "Append",
						value: "append",
						hint: "Add template content to the end"
					}, {
						label: "Skip",
						value: "skip",
						hint: "Leave existing file unchanged"
					}],
					initialValue: "skip"
				});
				conflictAction = isCancel(action) || action === "skip" ? "skip" : "append";
			} else conflictAction = "skip";
			if (conflictAction === "append") await appendAgentContent(destinationPath, targetPathToWrite, state.existingContent, incomingContent, silent);
			else {
				const suffix = !preResolved && !interactive ? " (already exists)" : "";
				if (!silent) log.info(`Skipped writing ${targetPathToWrite}${suffix}`);
			}
			continue;
		}
		await fsPromises.writeFile(destinationPath, incomingContent);
		if (!silent) log.success(`Wrote agent instructions to ${targetPathToWrite}`);
		seenRealPaths.add(await fsPromises.realpath(destinationPath));
	}
}
async function writeCopilotSetupWorkflow({ projectRoot, silent = false }) {
	const destinationPath = path.join(projectRoot, COPILOT_SETUP_WORKFLOW_PATH);
	await fsPromises.mkdir(path.dirname(destinationPath), { recursive: true });
	if (fs.existsSync(destinationPath)) {
		if (!silent) log.info(`Skipped writing ${COPILOT_SETUP_WORKFLOW_PATH} (already exists)`);
		return;
	}
	await fsPromises.writeFile(destinationPath, COPILOT_SETUP_WORKFLOW_CONTENT);
	if (!silent) log.success(`Wrote Copilot setup workflow to ${COPILOT_SETUP_WORKFLOW_PATH}`);
}
async function appendAgentContent(destinationPath, targetPath, existingContent, incomingContent, silent = false) {
	const separator = existingContent.endsWith("\n") ? "" : "\n";
	await fsPromises.appendFile(destinationPath, `${separator}\n${incomingContent}`);
	if (!silent) log.success(`Appended agent instructions to ${targetPath}`);
}
function normalizeAgentName(value) {
	return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function replaceMarkedAgentInstructionsSection(existing, incoming) {
	const existingRange = getMarkedRange(existing, AGENT_INSTRUCTIONS_START_MARKER, AGENT_INSTRUCTIONS_END_MARKER);
	if (!existingRange) return;
	const incomingRange = getMarkedRange(incoming, AGENT_INSTRUCTIONS_START_MARKER, AGENT_INSTRUCTIONS_END_MARKER);
	if (!incomingRange) return;
	return `${existing.slice(0, existingRange.start)}${incoming.slice(incomingRange.start, incomingRange.end)}${existing.slice(existingRange.end)}`;
}
async function tryLinkTargetToAgents(projectRoot, targetPath, silent = false) {
	const destinationPath = path.join(projectRoot, targetPath);
	const agentsPath = path.join(projectRoot, AGENT_STANDARD_PATH);
	const symlinkTarget = path.relative(path.dirname(destinationPath), agentsPath);
	const existing = await getExistingPathKind(destinationPath);
	if (existing === "file") return false;
	if (existing === "symlink") {
		const currentLink = await fsPromises.readlink(destinationPath);
		if (path.resolve(path.dirname(destinationPath), currentLink) === agentsPath) {
			if (!silent) log.info(`Skipped linking ${targetPath} (already linked to ${AGENT_STANDARD_PATH})`);
			return true;
		}
		await fsPromises.unlink(destinationPath);
	}
	try {
		await fsPromises.symlink(symlinkTarget, destinationPath);
	} catch (err) {
		if (err.code === "EPERM") {
			await fsPromises.copyFile(agentsPath, destinationPath);
			if (!silent) log.success(`Copied ${AGENT_STANDARD_PATH} to ${targetPath}`);
			return true;
		}
		throw err;
	}
	if (!silent) log.success(`Linked ${targetPath} to ${AGENT_STANDARD_PATH}`);
	return true;
}
async function getExistingPathKind(filePath) {
	if (!fs.existsSync(filePath)) return "missing";
	return (await fsPromises.lstat(filePath)).isSymbolicLink() ? "symlink" : "file";
}
function getMarkedRange(content, startMarker, endMarker) {
	const start = content.indexOf(startMarker);
	if (start === -1) return;
	const endMarkerIndex = content.indexOf(endMarker, start + startMarker.length);
	if (endMarkerIndex === -1) return;
	return {
		start,
		end: endMarkerIndex + endMarker.length
	};
}
//#endregion
export { selectAgentTargets as a, writeCopilotSetupWorkflow as c, templatesDir as d, selectAgentTargetPaths as i, displayRelative as l, detectAgentConflicts as n, updateExistingAgentInstructions as o, detectExistingAgentTargetPaths as r, writeAgentInstructions as s, COPILOT_AGENT_ID as t, rulesDir as u };
