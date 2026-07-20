import type {
  AgentDefinition,
  AgentTool,
  Engine,
  EngineContext,
  EngineResult,
  ExecutionStats,
  ToolkitModuleRef,
} from "@bifrost-ai/engine";
import { isToolkitModuleRef, resolveToolkit } from "@bifrost-ai/engine";
import {
  query,
  type SDKMessage,
  type SDKAssistantMessage,
  type SDKSystemMessage,
  type SDKResultError,
  type SDKResultMessage,
  type SDKResultSuccess,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import createDebug from "debug";

import { bindToolkitToClaude, loadToolkitModule } from "./bind-toolkit.js";

const debug = createDebug("bifrost:engine:claude-code");

const isSystemInit = (message: SDKMessage): message is SDKSystemMessage =>
  message.type === "system" && message.subtype === "init";

const isResultMessage = (message: SDKMessage): message is SDKResultMessage =>
  message.type === "result";

const isResultSuccess = (message: SDKMessage): message is SDKResultSuccess =>
  isResultMessage(message) && message.subtype === "success";

const isResultError = (message: SDKMessage): message is SDKResultError =>
  isResultMessage(message) && message.subtype !== "success";

const formatResultError = (message: SDKResultError): string =>
  message.errors.length > 0 ? message.errors.join("; ") : message.subtype;

type ContentBlock = {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
};

const formatToolInput = (input: unknown): string => {
  if (!input || typeof input !== "object") {
    // oxlint-disable-next-line typescript/no-base-to-string -- will never be "[object Object]"
    return String(input ?? "");
  }
  const entries = Object.entries(input as Record<string, unknown>).slice(0, 3);
  return entries.map(([key, val]) => `${key}=${String(val)}`).join(", ");
};

const extractContent = (message: SDKAssistantMessage): string | null => {
  const msg = message.message as { content?: ContentBlock[] | null } | null;
  if (!msg?.content) {
    return null;
  }

  const parts: string[] = [];
  for (const block of msg.content) {
    if (block.type === "text" && block.text) {
      parts.push(block.text.replace(/\n/g, " "));
    } else if (block.type === "tool_use" && block.name) {
      const args = formatToolInput(block.input);
      parts.push(`ToolCall(${block.name}${args ? `, ${args}` : ""})`);
    }
  }

  return parts.length > 0 ? parts.join(" | ") : null;
};

const extractToolResultPreview = (resultContent: unknown): string => {
  if (typeof resultContent === "string") {
    return resultContent;
  }
  if (Array.isArray(resultContent)) {
    return resultContent.map((block: ContentBlock) => block.text ?? "").join("");
  }
  return "";
};

const extractUserPreview = (message: SDKMessage): string | null => {
  const userMsg = message as { message?: { content?: string | ContentBlock[] } };
  const content = userMsg.message?.content;
  if (!content) {
    return null;
  }
  if (typeof content === "string") {
    return content.replace(/\n/g, " ");
  }

  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "tool_result") {
      const preview = extractToolResultPreview(block.content);
      parts.push(
        `ToolResult(${block.tool_use_id ?? "?"}${preview ? `: ${preview.replace(/\n/g, " ")}` : ""})`,
      );
    } else if (block.type === "text" && block.text) {
      parts.push(block.text.replace(/\n/g, " "));
    }
  }
  return parts.length > 0 ? parts.join(" | ") : null;
};

const getMessagePreview = (message: SDKMessage): string => {
  if (message.type === "assistant") {
    return extractContent(message as SDKAssistantMessage) ?? "";
  } else if (message.type === "user") {
    return extractUserPreview(message) ?? "";
  } else if (message.type === "system") {
    const sysMsg = message as { message?: string };
    if (sysMsg.message) {
      return sysMsg.message.replace(/\n/g, " ");
    }
  }
  return "";
};

type BuildPromptOptions = {
  agent: AgentDefinition;
  instructions: string;
};

const promptSection = (name: string, body: string) => `<${name}>${body}</${name}>`;

const buildPrompt = (options: BuildPromptOptions): string => {
  const { agent, instructions } = options;
  const parts: string[] = [
    promptSection("AgentDefinition", agent.promptBody),
    promptSection("FeatureDefinition", instructions),
  ];

  return parts.join("\n");
};

const buildStats = (
  resultData: Pick<SDKResultSuccess, "usage" | "duration_ms" | "total_cost_usd" | "num_turns">,
): ExecutionStats => {
  const { usage, duration_ms, total_cost_usd, num_turns } = resultData;

  return {
    durationMs: duration_ms,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    totalCostUsd: total_cost_usd,
    numTurns: num_turns,
  };
};

const mcpServerNamePattern = /^mcp__([^_]+(?:_[^_]+)*)__/;

export type ToolkitConstructor = (context: EngineContext) => McpSdkServerConfigWithInstance;

export type RegisteredToolkit =
  | ToolkitModuleRef
  | McpSdkServerConfigWithInstance
  | ToolkitConstructor;

export class ClaudeCodeEngine implements Engine {
  private toolkits = new Map<string, RegisteredToolkit>();

  public registerToolkit(name: string, toolkit: RegisteredToolkit): void {
    this.toolkits.set(name, toolkit);
  }

  private async resolveToolOptions(
    tools: AgentTool[],
    context: EngineContext,
  ): Promise<{
    bareToolNames: string[];
    toolOptions: { tools: string[]; allowedTools: string[]; disallowedTools?: string[] };
    mcpServersOption: { mcpServers: Record<string, McpSdkServerConfigWithInstance> } | undefined;
  }> {
    const bareToolNames = [
      ...new Set(
        tools.map((tool) => (typeof tool === "string" ? tool.replace(/\(.*\)$/, "") : tool.name)),
      ),
    ];
    const allowedTools = tools.flatMap((tool) => {
      if (typeof tool === "string") {
        return [tool];
      }
      if (tool.allow && tool.allow.length > 0) {
        return tool.allow.map((pattern: string) => `${tool.name}(${pattern})`);
      }
      return [tool.name];
    });
    const denyPatterns = tools.flatMap((tool) => {
      if (typeof tool === "string") {
        return [];
      }
      return (tool.deny ?? []).map((pattern: string) => `${tool.name}(${pattern})`);
    });
    const toolOptions = {
      tools: bareToolNames,
      allowedTools,
      ...(denyPatterns.length > 0 && { disallowedTools: denyPatterns }),
    };

    const activeServerNames = new Set(
      bareToolNames
        .map((toolName) => mcpServerNamePattern.exec(toolName)?.[1])
        .filter(
          (serverName): serverName is string => serverName !== null && serverName !== undefined,
        ),
    );

    debug("creating tools workingDir=%s", context.workingDir);

    const mcpServers: Record<string, McpSdkServerConfigWithInstance> = {};
    for (const name of activeServerNames) {
      const entry = this.toolkits.get(name);
      if (entry === undefined || entry === null) {
        continue;
      }

      if (isToolkitModuleRef(entry)) {
        const toolkit = await loadToolkitModule(entry);
        const definition = resolveToolkit(toolkit, context);
        mcpServers[name] = bindToolkitToClaude(definition, context);
      } else if (typeof entry === "function") {
        mcpServers[name] = entry(context);
      } else {
        mcpServers[name] = entry;
      }
    }

    debug("mcp tools created count=%s", Object.keys(mcpServers).length);

    const mcpServersOption = Object.keys(mcpServers).length > 0 ? { mcpServers } : undefined;

    return { bareToolNames, toolOptions, mcpServersOption };
  }

  public async execute(context: EngineContext, sessionId?: string): Promise<EngineResult> {
    const { agent, instructions, workingDir } = context;
    const { model, tools } = agent;

    const prompt = sessionId ? instructions : buildPrompt({ agent, instructions });

    debug("execute workingDir=%s sessionId=%s", workingDir, sessionId ?? "none");
    debug("prompt: %s", prompt);

    const { toolOptions, mcpServersOption } = await this.resolveToolOptions(tools, context);

    const options = {
      cwd: workingDir,
      permissionMode: "dontAsk" as const,
      ...(sessionId && { resume: sessionId }),
      ...(model && { model }),
      ...toolOptions,
      ...mcpServersOption,
    };

    if (!sessionId) {
      debug("options: %o", options);
    }

    let lastMessage: string | null = null;
    let resultData: SDKResultSuccess | undefined = undefined;
    let errorResultData: SDKResultError | undefined = undefined;
    let returnedSessionId: string | undefined = sessionId;

    try {
      const queryGenerator = query({ prompt, options });

      for await (const message of queryGenerator) {
        const preview = getMessagePreview(message);
        debug(
          "message type=%s subtype=%s preview=%s",
          message.type,
          (message as { subtype?: string }).subtype ?? "-",
          preview ? `"${preview}..."` : "-",
        );

        if (isSystemInit(message)) {
          returnedSessionId = message.session_id;
          debug("session_id=%s", returnedSessionId);
        }

        if (isResultSuccess(message)) {
          resultData = message;
          lastMessage = resultData.result;
          debug("result: %s", lastMessage);
        } else if (isResultError(message)) {
          errorResultData = message;
          lastMessage = formatResultError(message);
          debug("result error subtype=%s message=%s", message.subtype, lastMessage);
        }

        if (message.type === "assistant") {
          const content = extractContent(message);
          if (content) {
            lastMessage = content;
          }
        }
      }
    } catch (error) {
      debug("error: %o", error);
      return {
        success: false,
        skipFulfill: false,
        lastMessage: error instanceof Error ? error.message : String(error),
        stats: null,
      };
    }

    if (errorResultData) {
      return {
        success: false,
        skipFulfill: false,
        lastMessage: lastMessage ?? "Claude execution failed",
        stats: buildStats(errorResultData),
        sessionId: returnedSessionId,
      };
    }

    const stats = resultData ? buildStats(resultData) : null;

    return {
      success: true,
      skipFulfill: false,
      lastMessage: lastMessage ?? "No response from Claude",
      stats,
      sessionId: returnedSessionId,
    };
  }
}
