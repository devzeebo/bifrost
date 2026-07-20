import type { EngineContext } from "./types.js";

export type ToolContent = { type: "text"; text: string };

export type ToolResult = {
  content: ToolContent[];
  isError?: boolean;
};

export type ToolDefinition<TInput extends Record<string, unknown> = Record<string, unknown>> = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: TInput, context: EngineContext) => Promise<ToolResult> | ToolResult;
};

export type ToolkitDefinition = {
  name: string;
  version: string;
  tools: ToolDefinition[] | ((context: EngineContext) => ToolDefinition[]);
};

export type ToolkitFactory = (context: EngineContext) => ToolkitDefinition;

export type ToolkitModuleRef = string;

export type ResolvedToolkitDefinition = ToolkitDefinition & {
  tools: ToolDefinition[];
};

export function resolveToolkit(
  toolkit: ToolkitDefinition | ToolkitFactory,
  context: EngineContext,
): ResolvedToolkitDefinition {
  const definition = typeof toolkit === "function" ? toolkit(context) : toolkit;
  const tools =
    typeof definition.tools === "function" ? definition.tools(context) : definition.tools;

  return {
    ...definition,
    tools,
  };
}

export type ToolkitContext = Pick<EngineContext, "workItemId" | "workingDir">;

export function toToolkitContext(context: EngineContext): ToolkitContext {
  return {
    workItemId: context.workItemId,
    workingDir: context.workingDir,
  };
}

export function stubEngineContext(partial: ToolkitContext): EngineContext {
  return {
    workItemId: partial.workItemId,
    workingDir: partial.workingDir,
    agent: {
      name: "",
      description: "",
      tools: [],
      template: { parameters: {} },
      promptBody: "",
    },
    state: {},
    metadata: {},
    instructions: "",
    setState: async () => undefined,
  };
}

export function isToolkitModuleRef(toolkit: unknown): toolkit is ToolkitModuleRef {
  return typeof toolkit === "string";
}
