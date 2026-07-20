import type {
  AgentTool,
  Engine,
  EngineContext,
  EngineResult,
  ToolkitModuleRef,
} from "@bifrost-ai/engine";
import { isToolkitModuleRef } from "@bifrost-ai/engine";
import {
  Agent,
  CursorAgentError,
  type McpServerConfig,
  type RunResult,
  type SDKMessage,
  type SettingSource,
} from "@cursor/sdk";
import createDebug from "debug";

import { bindToolkitToCursor } from "./bind-toolkit.js";
import { materializeCursorPolicies } from "./materialize-policies.js";
import { buildPrompt } from "./prompt.js";
import { mapRunResultToStats } from "./stats.js";
import { getMessagePreview } from "./stream-preview.js";

const debug = createDebug("bifrost:engine:cursor");

const DEFAULT_MODEL = "composer-2.5";
const DEFAULT_EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_SETTING_SOURCES: SettingSource[] = ["project"];
const mcpServerNamePattern = /^mcp__([^_]+(?:_[^_]+)*)__/;

export type CursorEngineConfig = {
  apiKey?: string;
  model?: string;
  settingSources?: SettingSource[];
  mode?: "agent" | "plan";
  executionTimeoutMs?: number;
  /** Route local tool calls through Auto-review. Defaults to true. */
  autoReview?: boolean;
  /** Enable local sandbox (also switches SDK into allowlist approval mode). Defaults to true. */
  sandbox?: boolean;
};

export type McpToolkitConstructor = (context: EngineContext) => McpServerConfig;

export type RegisteredToolkit = ToolkitModuleRef | McpServerConfig | McpToolkitConstructor;

class ExecutionTimeoutError extends Error {
  public constructor(public readonly timeoutMs: number) {
    super(`Execution timed out after ${timeoutMs}ms`);
    this.name = "ExecutionTimeoutError";
  }
}

export class CursorEngine implements Engine {
  private readonly config: CursorEngineConfig;
  private toolkits = new Map<string, RegisteredToolkit>();

  public constructor(config: CursorEngineConfig = {}) {
    this.config = config;
  }

  public registerToolkit(name: string, toolkit: RegisteredToolkit): void {
    this.toolkits.set(name, toolkit);
  }

  private resolveApiKey(): string | undefined {
    return this.config.apiKey ?? process.env.CURSOR_API_KEY;
  }

  private resolveModel(agentModel?: string): { id: string } {
    const modelId = agentModel ?? this.config.model ?? DEFAULT_MODEL;
    return { id: modelId };
  }

  private async resolveMcpServers(
    tools: AgentTool[],
    context: EngineContext,
  ): Promise<Record<string, McpServerConfig> | undefined> {
    const bareToolNames = [
      ...new Set(
        tools.map((tool) => (typeof tool === "string" ? tool.replace(/\(.*\)$/, "") : tool.name)),
      ),
    ];

    const activeServerNames = new Set(
      bareToolNames
        .map((toolName) => mcpServerNamePattern.exec(toolName)?.[1])
        .filter(
          (serverName): serverName is string => serverName !== null && serverName !== undefined,
        ),
    );

    if (activeServerNames.size === 0) {
      return undefined;
    }

    debug("creating tools workingDir=%s", context.workingDir);

    const mcpServers: Record<string, McpServerConfig> = {};
    for (const name of activeServerNames) {
      const entry = this.toolkits.get(name);
      if (entry === undefined) {
        continue;
      }

      if (isToolkitModuleRef(entry)) {
        mcpServers[name] = bindToolkitToCursor(entry, context);
      } else if (typeof entry === "function") {
        mcpServers[name] = entry(context);
      } else {
        mcpServers[name] = entry;
      }
    }

    debug("mcp tools created count=%s", Object.keys(mcpServers).length);

    return Object.keys(mcpServers).length > 0 ? mcpServers : undefined;
  }

  private async streamRun(run: {
    stream: () => AsyncGenerator<SDKMessage, void>;
  }): Promise<{ lastMessage: string | null; numTurns: number }> {
    let lastMessage: string | null = null;
    let numTurns = 0;

    for await (const message of run.stream()) {
      const preview = getMessagePreview(message);
      debug("message type=%s preview=%s", message.type, preview ? `"${preview}..."` : "-");

      if (message.type === "usage") {
        numTurns += 1;
      }

      if (message.type === "assistant") {
        if (preview) {
          lastMessage = preview;
        }
      }
    }

    return { lastMessage, numTurns: numTurns > 0 ? numTurns : 1 };
  }

  private async withExecutionTimeout<T>(
    run: { cancel: () => Promise<void> },
    timeoutMs: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new ExecutionTimeoutError(timeoutMs));
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      if (error instanceof ExecutionTimeoutError) {
        await run.cancel().catch(() => undefined);
      }
      throw error;
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  private mapFinishedResult(
    result: RunResult,
    agentId: string,
    lastMessage: string | null,
    numTurns: number,
    modelId?: string,
  ): EngineResult {
    const stats = mapRunResultToStats(
      {
        durationMs: result.durationMs,
        usage: result.usage,
        modelId: result.model?.id ?? modelId,
      },
      numTurns,
    );

    return {
      success: true,
      skipFulfill: false,
      lastMessage: result.result ?? lastMessage ?? "No response from Cursor",
      stats,
      sessionId: agentId,
    };
  }

  public async execute(context: EngineContext, sessionId?: string): Promise<EngineResult> {
    const { agent, instructions, workingDir } = context;
    const apiKey = this.resolveApiKey();

    if (!apiKey) {
      return {
        success: false,
        skipFulfill: false,
        lastMessage: "Missing Cursor API key (set CURSOR_API_KEY or pass apiKey in config)",
        stats: null,
      };
    }

    const prompt = sessionId ? instructions : buildPrompt({ agent, instructions });
    const model = this.resolveModel(agent.model);
    const mcpServers = await this.resolveMcpServers(agent.tools, context);
    const settingSources = this.config.settingSources ?? DEFAULT_SETTING_SOURCES;
    const autoReview = this.config.autoReview ?? true;
    const sandboxEnabled = this.config.sandbox ?? true;
    const executionTimeoutMs = this.config.executionTimeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;

    debug("execute workingDir=%s sessionId=%s", workingDir, sessionId ?? "none");
    debug("prompt: %s", prompt);

    try {
      const policies = await materializeCursorPolicies({
        workingDir,
        workItemId: context.workItemId,
        tools: agent.tools,
      });
      debug(
        "policies shellPermitted=%s terminalAllowlist=%o mcpAllowlist=%o",
        policies.shellPermitted,
        policies.permissions.terminalAllowlist,
        policies.permissions.mcpAllowlist,
      );

      const localOptions = {
        cwd: workingDir,
        settingSources,
        autoReview,
        sandboxOptions: { enabled: sandboxEnabled },
      };

      const agentHandle = sessionId
        ? await this.withExecutionTimeout(
            { cancel: async () => undefined },
            executionTimeoutMs,
            () =>
              Agent.resume(sessionId, {
                apiKey,
                model,
                local: localOptions,
                ...(mcpServers && { mcpServers }),
              }),
          )
        : await this.withExecutionTimeout(
            { cancel: async () => undefined },
            executionTimeoutMs,
            () =>
              Agent.create({
                apiKey,
                model,
                local: localOptions,
                ...(mcpServers && { mcpServers }),
                ...(this.config.mode && { mode: this.config.mode }),
              }),
          );

      const run = await this.withExecutionTimeout(
        { cancel: async () => undefined },
        executionTimeoutMs,
        () => agentHandle.send(prompt),
      );
      debug("run started id=%s requestId=%s", run.id, run.requestId ?? "-");

      const { lastMessage, numTurns } = await this.withExecutionTimeout(
        run,
        executionTimeoutMs,
        () => this.streamRun(run),
      );
      const result = await this.withExecutionTimeout(run, executionTimeoutMs, () => run.wait());

      if (result.status === "error" || result.status === "cancelled") {
        return {
          success: false,
          skipFulfill: false,
          lastMessage: result.result ?? result.status,
          stats: mapRunResultToStats(
            {
              durationMs: result.durationMs,
              usage: result.usage,
              modelId: result.model?.id ?? model.id,
            },
            numTurns,
          ),
          sessionId: agentHandle.agentId,
        };
      }

      return this.mapFinishedResult(result, agentHandle.agentId, lastMessage, numTurns, model.id);
    } catch (error) {
      debug("error: %o", error);

      if (error instanceof ExecutionTimeoutError) {
        return {
          success: false,
          skipFulfill: false,
          lastMessage: error.message,
          stats: null,
        };
      }

      if (error instanceof CursorAgentError) {
        return {
          success: false,
          skipFulfill: false,
          lastMessage: error.message,
          stats: null,
        };
      }

      return {
        success: false,
        skipFulfill: false,
        lastMessage: error instanceof Error ? error.message : String(error),
        stats: null,
      };
    }
  }
}
