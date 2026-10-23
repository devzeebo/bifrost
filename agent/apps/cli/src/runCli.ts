import { readFile, writeFile } from "node:fs/promises";

import {
  createHarness,
  createOpenAIModelClient,
  createTranscript,
  type TranscriptItem,
} from "@agent/harness";
import type { Tool } from "@agent/tools";
import { renderUsage } from "citty";

import { mainCommand, runHelpCommand } from "./commands.ts";
import { loadTools } from "./loadTools.ts";
import { chooseFromMenu } from "./menu.ts";
import { parseCli, resolveModel, type RunOptions } from "./parseCli.ts";
import { readSession, serializeSession } from "./session.ts";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

const writeHelp = async (subject: "main" | "run"): Promise<void> => {
  const usage =
    subject === "run" ? await renderUsage(runHelpCommand) : await renderUsage(mainCommand);
  process.stdout.write(`${usage}\n`);
};

const readSessionFile = async (path: string): Promise<TranscriptItem[]> => {
  try {
    return readSession(await readFile(path, "utf8"));
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
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

const executeRun = async (options: RunOptions, env: NodeJS.ProcessEnv): Promise<number> => {
  if (options.prompt === undefined || options.prompt.trim() === "") {
    process.stderr.write("Prompt is required\n");
    return 1;
  }

  const model = resolveModel(options.model, env);
  if (model === undefined) {
    process.stderr.write("Model is required. Pass --model or set AGENT_MODEL\n");
    return 1;
  }

  let tools: Tool[];
  try {
    tools = await loadTools(options.toolPaths);
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }

  const visibleTools = options.verbose ? tools.map(watchTool) : tools;

  let items: TranscriptItem[] = [];
  if (options.sessionPath !== undefined) {
    try {
      items = await readSessionFile(options.sessionPath);
    } catch (error) {
      process.stderr.write(`${errorMessage(error)}\n`);
      return 1;
    }
  }

  let harness: ReturnType<typeof createHarness>;
  try {
    harness = createHarness({
      client: createOpenAIModelClient(),
      model,
      tools: visibleTools,
      ...(options.instructions === undefined ? {} : { instructions: options.instructions }),
      ...(options.maxTurns === undefined ? {} : { maxTurns: options.maxTurns }),
    });
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }

  const result = await harness.run(options.prompt, createTranscript(items));
  if (options.sessionPath !== undefined) {
    await writeFile(options.sessionPath, serializeSession(result.transcript.snapshot()), "utf8");
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

const runMenu = async (env: NodeJS.ProcessEnv): Promise<number> => {
  const choice = await chooseFromMenu(env);
  if (choice.type === "quit") {
    return 0;
  }
  if (choice.type === "help") {
    await writeHelp("main");
    return 0;
  }
  return executeRun(
    { prompt: choice.prompt, model: choice.model, toolPaths: [], verbose: false },
    env,
  );
};

export const runCli = async (
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> => {
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
      return runMenu(env);
    case "run":
      return executeRun(parsed.options, env);
  }
};
