import type { JsonObjectSchema, Tool } from "@agent/tools";
import type {
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseOutputItem,
} from "openai/resources/responses/responses.js";

import type { ModelClient } from "./modelClient.ts";
import { createTranscript, type Transcript } from "./transcript.ts";

const defaultMaxTurns = 8;

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

export const createHarness = ({
  client,
  model,
  tools,
  instructions,
  maxTurns = defaultMaxTurns,
}: HarnessOptions) => {
  const toolsByName = new Map<string, Tool<never>>();
  for (const tool of tools) {
    if (toolsByName.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`);
    }
    toolsByName.set(tool.name, tool);
  }

  const functionTools = [...toolsByName.values()].map(toFunctionTool);

  const run = async (
    prompt: string,
    transcript: Transcript = createTranscript(),
  ): Promise<RunResult> => {
    transcript.appendUser(prompt);

    for (let turn = 0; turn < maxTurns; turn += 1) {
      let response;
      try {
        response = await client.createResponse({
          model,
          input: transcript.snapshot(),
          tools: functionTools,
          store: false,
          ...(instructions === undefined ? {} : { instructions }),
        });
      } catch (error) {
        return { status: "failed", error: toError(error), transcript };
      }

      if (response.status !== "completed") {
        return {
          status: "failed",
          error: new Error(`Response ended with status ${response.status}`),
          transcript,
        };
      }

      transcript.appendModelOutput(response.output);
      const calls = response.output.filter(isFunctionCall);
      if (calls.length === 0) {
        const refusal = findRefusal(response.output);
        if (refusal !== undefined) {
          return { status: "refused", text: refusal, transcript };
        }
        return { status: "completed", text: response.outputText, transcript };
      }

      const outputs = await Promise.all(
        calls.map(async (call) => ({
          call,
          output: await executeCall(call, toolsByName),
        })),
      );
      for (const { call, output } of outputs) {
        transcript.appendToolOutput(call, output);
      }
    }

    return { status: "max_turns", transcript };
  };

  return { run };
};
