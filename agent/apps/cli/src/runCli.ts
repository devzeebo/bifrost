import { randomUUID } from "node:crypto";

import type { Engine } from "@agent/engines";
import {
  createHarness,
  createOpenAIModelClient,
  type RunResult,
} from "@agent/harness";
import type { Tool } from "@agent/tools";
import { renderUsage } from "citty";
import { config } from "dotenv";
import util from "util";

import { mainCommand, runHelpCommand } from "./commands.ts";
import { loadEngines } from "./loadEngines.ts";
import { loadTools } from "./loadTools.ts";
import { chooseFromMenu } from "./menu.ts";
import { parseCli, type RunOptions } from "./parseCli.ts";

util.inspect.defaultOptions.depth = null;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const writeHelp = async (subject: "main" | "run"): Promise<void> => {
  const usage =
    subject === "run"
      ? await renderUsage(runHelpCommand)
      : await renderUsage(mainCommand);
  process.stdout.write(`${usage}\n`);
};

const watchTool = (tool: Tool): Tool => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters,
  execute: async (args) => {
    process.stderr.write(`${tool.name}\n`);
    return tool.execute(args);
  },
});

const executeRun = async (options: RunOptions): Promise<number> => {
  if (options.prompt === undefined || options.prompt.trim() === "") {
    process.stderr.write("Prompt is required\n");
    return 1;
  }

  let tools: Tool[];
  try {
    tools = await loadTools(options.toolPaths);
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }

  let engines: Engine[];
  try {
    engines = await loadEngines(options.enginePaths);
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }

  const visibleTools = options.verbose ? tools.map(watchTool) : tools;
  const sessionId = options.sessionId ?? randomUUID();
  if (options.sessionId === undefined) {
    process.stderr.write(`session ${sessionId}\n`);
  }

  let result: RunResult;
  try {
    const harness = createHarness({
      client: createOpenAIModelClient({ engines }),
      model: options.model,
      tools: visibleTools,
      sessionId,
      ...(options.instructions === undefined
        ? {}
        : { instructions: options.instructions }),
      ...(options.maxTurns === undefined ? {} : { maxTurns: options.maxTurns }),
      ...(options.transcriptFolder === undefined
        ? {}
        : { transcriptFolder: options.transcriptFolder }),
    });
    result = await harness.run(options.prompt);
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }

  switch (result.status) {
    case "completed":
    case "refused":
      process.stdout.write(`${result.text}\n`);
      return 0;
    case "max_turns":
      process.stderr.write("Reached the maximum number of turns\n");
      return 1;
    case "failed":
      process.stderr.write(`${result.error.message}\n`);
      return 1;
  }
};

const runMenu = async (): Promise<number> => {
  const choice = await chooseFromMenu();
  if (choice.type === "quit") {
    return 0;
  }
  if (choice.type === "help") {
    await writeHelp("main");
    return 0;
  }
  return executeRun({
    prompt: choice.prompt,
    model: choice.model,
    toolPaths: [],
    enginePaths: [],
    verbose: false,
  });
};

export const runCli = async (argv: readonly string[]): Promise<number> => {
  config({ quiet: true });

  const parsed = parseCli(argv);
  switch (parsed.type) {
    case "help":
      await writeHelp(parsed.subject);
      return 0;
    case "error":
      process.stderr.write(`${parsed.message}\n`);
      return 1;
    case "menu":
      if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
        await writeHelp("main");
        return 0;
      }
      return runMenu();
    case "run":
      return executeRun(parsed.options);
  }
};
