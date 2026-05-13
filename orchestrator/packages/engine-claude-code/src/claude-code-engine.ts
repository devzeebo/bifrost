import type { Engine, EngineContext, EngineResult, ExecutionStats } from "@bifrost-ai/engine";
import {
  query,
  type SDKMessage,
  type SDKAssistantMessage,
  type SDKSystemMessage,
  type SDKResultSuccess,
} from "@anthropic-ai/claude-agent-sdk";

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

const buildPrompt = (
  agentName: string,
  taskState: Record<string, unknown>,
  metadata: Record<string, unknown>,
): string => {
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

  if (metadata.instructions) {
    parts.push(`\nInstructions: ${metadata.instructions}`);
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
  private sessionId?: string;

  public async execute(context: EngineContext): Promise<EngineResult> {
    const { agentName, taskState, metadata, workingDir, verbose } = context;

    const prompt = buildPrompt(agentName, taskState, metadata);

    const options = {
      workingDir,
      permissionMode: "acceptEdits" as const,
      verbose,
    };

    let lastMessage: string | null = null;
    let resultData: SDKResultSuccess | undefined = undefined;

    try {
      const queryGenerator = query({ prompt, options });

      for await (const message of queryGenerator) {
        if (verbose) {
          console.log("[claude-code-engine]", JSON.stringify(message));
        }

        if (isSystemInit(message)) {
          this.sessionId = message.session_id;
        }

        if (isResultSuccess(message)) {
          resultData = message;
          lastMessage = resultData.result;
        }

        if (message.type === "assistant") {
          const content = extractContent(message);
          if (content) {
            lastMessage = content;
          }
        }
      }
    } catch (error) {
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
    };
  }

  public async sendFollowUp(message: string): Promise<EngineResult> {
    if (!this.sessionId) {
      throw new Error("No active session to follow up on");
    }

    let lastMessage: string | null = null;
    let resultData: SDKResultSuccess | undefined = undefined;

    try {
      const queryGenerator = query({
        prompt: message,
        options: {
          resume: this.sessionId,
        },
      });

      for await (const msg of queryGenerator) {
        if (isResultSuccess(msg)) {
          resultData = msg;
          lastMessage = resultData.result;
        }

        if (msg.type === "assistant") {
          const content = extractContent(msg);
          if (content) {
            lastMessage = content;
          }
        }
      }
    } catch (error) {
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
    };
  }
}
