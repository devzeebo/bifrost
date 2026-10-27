import { randomUUID } from "node:crypto";

import type { JsonObjectSchema, Tool } from "@agent/tools";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems.js";
import type {
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses.js";

import type { ModelClient } from "./modelClient.ts";
import { createTranscript, type Transcript, type TranscriptLine } from "./transcript.ts";
import type { LineUsage } from "./usage.ts";

const defaultMaxTurns = 8;
const transcriptFolderEnv = "AGENT_TRANSCRIPT_FOLDER";

export type RunResult =
  | { readonly status: "completed"; readonly text: string; readonly transcript: Transcript }
  | { readonly status: "refused"; readonly text: string; readonly transcript: Transcript }
  | { readonly status: "max_turns"; readonly transcript: Transcript }
  | { readonly status: "failed"; readonly error: Error; readonly transcript: Transcript };

export type HarnessOptions = {
  readonly client: ModelClient;
  readonly model: string;
  readonly tools: readonly Tool<never>[];
  readonly instructions?: string;
  readonly maxTurns?: number;
  readonly transcriptFolder?: string;
  readonly sessionId?: string;
};

const resolveTranscriptFolder = (folder: string | undefined): string => {
  const value = (folder ?? process.env[transcriptFolderEnv])?.trim();
  if (value === undefined || value === "") {
    throw new Error(
      "Transcript folder is required. Pass transcriptFolder or set AGENT_TRANSCRIPT_FOLDER",
    );
  }
  return value;
};

const toFunctionTool = (tool: Tool<never>): FunctionTool => ({
  type: "function",
  name: tool.name,
  description: tool.description,
  strict: true,
  parameters: toParameters(tool.parameters),
});

const toParameters = (schema: JsonObjectSchema): FunctionTool["parameters"] => ({
  type: schema.type,
  properties: schema.properties,
  required: [...schema.required],
  additionalProperties: schema.additionalProperties,
  ...(schema.description === undefined ? {} : { description: schema.description }),
});

const findRefusal = (output: readonly ResponseOutputItem[]): string | undefined => {
  for (const item of output) {
    if (item.type !== "message") {
      continue;
    }
    for (const part of item.content) {
      if (part.type === "refusal") {
        return part.refusal;
      }
    }
  }
  return undefined;
};

const isFunctionCall = (item: ResponseOutputItem): item is ResponseFunctionToolCall =>
  item.type === "function_call";

const executeCall = async (
  call: ResponseFunctionToolCall,
  tools: ReadonlyMap<string, Tool<never>>,
): Promise<string> => {
  const tool = tools.get(call.name);
  if (tool === undefined) {
    return `Error: Unknown tool: ${call.name}`;
  }

  let args: never;
  try {
    args = JSON.parse(call.arguments) as never;
  } catch {
    return "Error: Tool arguments were not valid JSON";
  }

  try {
    return await tool.execute(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
};

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const lineWithUsage = (item: ResponseInputItem, usage: LineUsage | undefined): TranscriptLine =>
  usage === undefined ? item : { ...item, usage };

const toModelInput = (line: TranscriptLine): ResponseInputItem => {
  if (!("usage" in line)) {
    return line;
  }
  const { usage: _usage, ...item } = line;
  return item;
};

const toolOutputLine = (call: ResponseFunctionToolCall, output: string): TranscriptLine => ({
  type: "function_call_output",
  call_id: call.call_id,
  output,
  ...(call.caller == null ? {} : { caller: call.caller }),
});

export const createHarness = ({
  client,
  model,
  tools,
  instructions,
  maxTurns = defaultMaxTurns,
  transcriptFolder,
  sessionId,
}: HarnessOptions) => {
  const toolsByName = new Map<string, Tool<never>>();
  for (const tool of tools) {
    if (toolsByName.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`);
    }
    toolsByName.set(tool.name, tool);
  }

  const functionTools = [...toolsByName.values()].map(toFunctionTool);

  const run = async (prompt: string, transcript?: Transcript): Promise<RunResult> => {
    const resolvedSessionId = sessionId ?? randomUUID();
    const record =
      transcript ??
      (await createTranscript({
        folder: resolveTranscriptFolder(transcriptFolder),
        sessionId: resolvedSessionId,
      }));

    await record.appendLine({ role: "user", content: prompt });

    for (let turn = 0; turn < maxTurns; turn += 1) {
      let response;
      try {
        const modelInput = record.snapshot().map(toModelInput);
        // #region agent log
        fetch("http://127.0.0.1:7731/ingest/0bcf0e04-b5a1-4e54-a3e3-9542ca6ec229", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "876c11" },
          body: JSON.stringify({
            sessionId: "876c11",
            runId: "pre-fix",
            hypothesisId: "A-C-E",
            location: "harness.ts:createResponse",
            message: "model input for turn",
            data: {
              turn,
              sessionId: resolvedSessionId,
              itemCount: modelInput.length,
              items: modelInput.map((item) => ({
                type: "type" in item ? item.type : "role" in item ? item.role : "unknown",
                keys: Object.keys(item),
                hasUsage: "usage" in item,
              })),
              toolNames: functionTools.map((tool) => tool.name),
              toolsJson: JSON.stringify(functionTools),
              firstItemJson: JSON.stringify(modelInput[0] ?? null),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        response = await client.createResponse({
          model,
          input: modelInput,
          tools: functionTools,
          store: false,
          sessionId: resolvedSessionId,
          ...(instructions === undefined ? {} : { instructions }),
        });
      } catch (error) {
        return { status: "failed", error: toError(error), transcript: record };
      }

      if (response.status !== "completed") {
        return {
          status: "failed",
          error: new Error(`Response ended with status ${response.status}`),
          transcript: record,
        };
      }

      for (const item of toResponseInputItems(response.output)) {
        await record.appendLine(lineWithUsage(item, response.usage));
      }
      await record.recordTurn(response.usage);
      const calls = response.output.filter(isFunctionCall);
      if (calls.length === 0) {
        const refusal = findRefusal(response.output);
        if (refusal !== undefined) {
          return { status: "refused", text: refusal, transcript: record };
        }
        return { status: "completed", text: response.outputText, transcript: record };
      }

      const outputs = await Promise.all(
        calls.map(async (call) => ({
          call,
          output: await executeCall(call, toolsByName),
        })),
      );
      for (const { call, output } of outputs) {
        await record.appendLine(toolOutputLine(call, output));
      }
    }

    return { status: "max_turns", transcript: record };
  };

  return { run };
};
