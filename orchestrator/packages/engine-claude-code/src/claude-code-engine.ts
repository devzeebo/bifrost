import type {
  AgentDefinition,
  AgentTool,
  Engine,
  EngineContext,
  EngineResult,
  ExecutionStats,
} from "@bifrost-ai/engine";
import {
  query,
  type SDKMessage,
  type SDKAssistantMessage,
  type SDKSystemMessage,
  type SDKResultSuccess,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import createDebug from "debug";

const debug = createDebug("bifrost");

const isSystemInit = (message: SDKMessage): message is SDKSystemMessage =>
  message.type === "system" && message.subtype === "init";

const isResultSuccess = (message: SDKMessage): message is SDKResultSuccess =>
  message.type === "result" && message.subtype === "success";

const extractContent = (message: SDKAssistantMessage): string | null => {
  const msg = message.message as { content?: { type?: string; text?: string }[] | null } | null;
  if (!msg?.content) {
    return null;
  }

  const textBlocks = msg.content.filter((block) => block.type === "text" && block.text);
  if (textBlocks.length === 0) {
    return null;
  }

  return textBlocks.map((block) => block.text ?? "").join("\n");
};

const getMessagePreview = (message: SDKMessage): string => {
  if (message.type === "assistant") {
    const content = extractContent(message as SDKAssistantMessage);
    if (content) {
      return content.substring(0, 100).replace(/\n/g, " ");
    }
  } else if (message.type === "user") {
    const userMsg = message as { content?: string };
    if (userMsg.content) {
      return userMsg.content.substring(0, 100).replace(/\n/g, " ");
    }
  } else if (message.type === "system") {
    const sysMsg = message as { message?: string };
    if (sysMsg.message) {
      return sysMsg.message.substring(0, 100).replace(/\n/g, " ");
    }
  }
  return "";
};

type BuildPromptOptions = {
  agent: AgentDefinition;
  taskState: Record<string, unknown>;
  metadata: Record<string, unknown>;
  instructions: string;
};

const promptSection = (name: string, body: string) => `<${name}>${body}</${name}>`;

const buildPrompt = (options: BuildPromptOptions): string => {
  const { agent, metadata: _metadata, instructions } = options;
  const parts: string[] = [
    promptSection("AgentDefinition", agent.promptBody),
    promptSection("FeatureDefinition", instructions),
  ];

  return parts.join("\n");
};

const buildStats = (resultData: SDKResultSuccess): ExecutionStats => {
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

export class ClaudeCodeEngine implements Engine {
  private toolkits = new Map<string, McpSdkServerConfigWithInstance | ToolkitConstructor>();

  public registerToolkit(
    name: string,
    toolkit: McpSdkServerConfigWithInstance | ToolkitConstructor,
  ): void {
    this.toolkits.set(name, toolkit);
  }

  private resolveToolOptions(
    tools: AgentTool[],
    context: EngineContext,
  ): {
    bareToolNames: string[];
    toolOptions: { tools: string[]; allowedTools: string[]; denyTools?: string[] };
    mcpServersOption: { mcpServers: Record<string, McpSdkServerConfigWithInstance> } | undefined;
  } {
    const bareToolNames = [
      ...new Set(
        tools.map((tool) => (typeof tool === "string" ? tool.replace(/\(.*\)$/, "") : tool.name)),
      ),
    ];
    const allowedTools = tools.flatMap((tool) => {
      if (typeof tool === "string") {
        return [tool];
      }
      return (tool.allow ?? []).map((pattern: string) => `${tool.name}(${pattern})`);
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
      ...(denyPatterns.length > 0 && { denyTools: denyPatterns }),
    };

    const activeServerNames = new Set(
      bareToolNames
        .map((toolName) => mcpServerNamePattern.exec(toolName)?.[1])
        .filter(
          (serverName): serverName is string => serverName !== null && serverName !== undefined,
        ),
    );
    const mcpServers: Record<string, McpSdkServerConfigWithInstance> = {};
    for (const name of activeServerNames) {
      const entry = this.toolkits.get(name);
      if (entry !== undefined && entry !== null) {
        mcpServers[name] = typeof entry === "function" ? entry(context) : entry;
      }
    }
    const mcpServersOption = Object.keys(mcpServers).length > 0 ? { mcpServers } : undefined;

    return { bareToolNames, toolOptions, mcpServersOption };
  }

  public async execute(context: EngineContext, sessionId?: string): Promise<EngineResult> {
    const { agent, taskState, metadata, instructions, workingDir } = context;
    const { model, tools } = agent;

    const prompt = sessionId
      ? instructions
      : buildPrompt({ agent, taskState, metadata, instructions });

    debug("engine execute workingDir=%s sessionId=%s", workingDir, sessionId ?? "none");
    debug("engine prompt: %s", prompt);

    const { toolOptions, mcpServersOption } = this.resolveToolOptions(tools, context);

    const options = sessionId
      ? {
          cwd: workingDir,
          permissionMode: "dontAsk" as const,
          resume: sessionId,
          ...(model && { model }),
          ...toolOptions,
          ...mcpServersOption,
        }
      : {
          cwd: workingDir,
          permissionMode: "dontAsk" as const,
          ...(model && { model }),
          ...toolOptions,
          ...mcpServersOption,
        };

    if (!sessionId) {
      debug("engine options: %o", options);
    }

    let lastMessage: string | null = null;
    let resultData: SDKResultSuccess | undefined = undefined;
    let returnedSessionId: string | undefined = sessionId;

    try {
      const queryGenerator = query({ prompt, options });

      for await (const message of queryGenerator) {
        const preview = getMessagePreview(message);
        debug(
          "engine message type=%s subtype=%s preview=%s",
          message.type,
          (message as { subtype?: string }).subtype ?? "-",
          preview ? `"${preview}..."` : "-",
        );

        if (isSystemInit(message)) {
          returnedSessionId = message.session_id;
          debug("engine session_id=%s", returnedSessionId);
        }

        if (isResultSuccess(message)) {
          resultData = message;
          lastMessage = resultData.result;
          debug("engine result: %s", lastMessage);
        }

        if (message.type === "assistant") {
          const content = extractContent(message);
          if (content) {
            lastMessage = content;
          }
        }
      }
    } catch (error) {
      debug("engine error: %o", error);
      return {
        success: false,
        skipFulfill: false,
        lastMessage: error instanceof Error ? error.message : String(error),
        stats: null,
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
