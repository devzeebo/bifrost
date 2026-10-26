import { parseArgs } from "citty";

import { runArgs } from "./commands.ts";

export type RunOptions = {
  readonly prompt?: string;
  readonly model: string;
  readonly instructions?: string;
  readonly toolPaths: readonly string[];
  readonly maxTurns?: number;
  readonly sessionId?: string;
  readonly transcriptFolder?: string;
  readonly verbose: boolean;
};

export type ParsedCli =
  | { readonly type: "menu" }
  | { readonly type: "help"; readonly subject: "main" | "run" }
  | { readonly type: "run"; readonly options: RunOptions }
  | { readonly type: "error"; readonly message: string };

const knownFlags = [
  "--model",
  "--instructions",
  "--tools",
  "--max-turns",
  "--session",
  "--transcript-folder",
  "--verbose",
  "--help",
  "-h",
];

const isKnownFlag = (arg: string): boolean =>
  knownFlags.some((flag) => arg === flag || arg.startsWith(`${flag}=`));

const readArg = (args: object, key: string): unknown =>
  key in args ? Reflect.get(args, key) : undefined;

const stringList = (value: unknown): readonly string[] => {
  if (typeof value === "string" && value !== "") {
    return [value];
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  return [];
};

const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const parseMaxTurns = (value: unknown): number | undefined | "invalid" => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return "invalid";
  }
  return Number(value);
};

export const parseCli = (argv: readonly string[]): ParsedCli => {
  if (argv.length === 0) {
    return { type: "menu" };
  }

  const [command, ...rest] = argv;
  if (command === "help" || command === "--help" || command === "-h") {
    return { type: "help", subject: "main" };
  }
  if (command !== "run") {
    return { type: "error", message: `Unknown command \`${command ?? ""}\`` };
  }
  if (rest.includes("--help") || rest.includes("-h")) {
    return { type: "help", subject: "run" };
  }

  const unknown = rest.find((arg) => arg.startsWith("-") && !isKnownFlag(arg));
  if (unknown !== undefined) {
    return { type: "error", message: `Unknown argument \`${unknown}\`` };
  }

  let args;
  try {
    args = parseArgs([...rest], runArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { type: "error", message };
  }

  const maxTurns = parseMaxTurns(readArg(args, "max-turns"));
  if (maxTurns === "invalid") {
    return { type: "error", message: "max-turns must be a positive integer" };
  }

  const model = optionalString(readArg(args, "model"));
  if (model === undefined) {
    return { type: "error", message: "Model is required. Pass --model" };
  }

  const prompt = optionalString(readArg(args, "prompt"));
  const instructions = optionalString(readArg(args, "instructions"));
  const sessionId = optionalString(readArg(args, "session"));
  const transcriptFolder = optionalString(readArg(args, "transcript-folder"));
  const options: RunOptions = {
    model,
    toolPaths: stringList(readArg(args, "tools")),
    verbose: readArg(args, "verbose") === true,
    ...(prompt === undefined ? {} : { prompt }),
    ...(instructions === undefined ? {} : { instructions }),
    ...(sessionId === undefined ? {} : { sessionId }),
    ...(transcriptFolder === undefined ? {} : { transcriptFolder }),
    ...(maxTurns === undefined ? {} : { maxTurns }),
  };

  return { type: "run", options };
};
