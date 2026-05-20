import type { Engine, EngineContext, EngineResult, ExecutionStats } from "@bifrost-ai/engine";
import {
  query,
  type SDKMessage,
  type SDKAssistantMessage,
  type SDKSystemMessage,
  type SDKResultSuccess,
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
  agentName: string;
  taskState: Record<string, unknown>;
  metadata: Record<string, unknown>;
  instructions?: string;
};

const buildPrompt = (options: BuildPromptOptions): string => {
  const { agentName: _agentName, taskState, metadata, instructions } = options;
  const parts: string[] = [];

  if (metadata.description) {
    parts.push(`Task: ${metadata.description}`);
  }

  if (Object.keys(taskState).length > 0) {
    parts.push("\nContext:");
    for (const [key, value] of Object.entries(taskState)) {
      parts.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  if (instructions) {
    parts.push(`\nInstructions: ${instructions}`);
  }

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

export class ClaudeCodeEngine implements Engine {
  // oxlint-disable-next-line class-methods-use-this -- method doesn't use `this`, that's fine
  public async execute(context: EngineContext, sessionId?: string): Promise<EngineResult> {
    const { agent, taskState, metadata, instructions, workingDir } = context;
    const { name: agentName, model, tools } = agent;

    const prompt = buildPrompt({ agentName, taskState, metadata, instructions });

    debug("engine execute workingDir=%s sessionId=%s", workingDir, sessionId ?? "none");
    debug("engine prompt: %s", prompt);

    const toolOptions = { tools, allowedTools: tools };

    const options = sessionId
      ? {
          workingDir,
          permissionMode: "dontAsk" as const,
          resume: sessionId,
          ...(model && { model }),
          ...toolOptions,
        }
      : {
          workingDir,
          permissionMode: "dontAsk" as const,
          ...(model && { model }),
          ...toolOptions,
        };

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
