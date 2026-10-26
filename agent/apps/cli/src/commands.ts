import { defineCommand, type ArgsDef } from "citty";

export const runArgs = {
  prompt: {
    type: "positional",
    description: "Prompt text",
    required: false,
  },
  model: {
    type: "string",
    description: "Model id",
    required: true,
  },
  instructions: {
    type: "string",
    description: "System instructions",
  },
  tools: {
    type: "string",
    description: "Path to a tools module. Repeat to load more than one",
  },
  "max-turns": {
    type: "string",
    description: "Maximum model responses",
  },
  session: {
    type: "string",
    description: "Session id. The transcript is stored as <id>.jsonl",
  },
  "transcript-folder": {
    type: "string",
    description: "Folder for transcript files. Falls back to AGENT_TRANSCRIPT_FOLDER",
  },
  verbose: {
    type: "boolean",
    description: "Print tool names to stderr",
  },
} satisfies ArgsDef;

export const runCommand = defineCommand({
  meta: {
    name: "run",
    description: "Send a prompt through the harness",
  },
  args: runArgs,
});

export const runHelpCommand = defineCommand({
  meta: {
    name: "agent run",
    description: "Send a prompt through the harness",
  },
  args: runArgs,
});

export const helpCommand = defineCommand({
  meta: {
    name: "help",
    description: "Show help",
  },
});

export const mainCommand = defineCommand({
  meta: {
    name: "agent",
    description: "Run an agentic harness",
  },
  subCommands: {
    run: runCommand,
    help: helpCommand,
  },
});
