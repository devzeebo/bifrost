import { mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  AgentTool,
  Engine,
  EngineContext,
  EngineResult,
  ToolkitDefinition,
  ToolkitFactory,
  ToolkitModuleRef,
} from "@bifrost-ai/engine";
import { isToolkitModuleRef, resolveToolkit } from "@bifrost-ai/engine";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  resolveCliModel,
  SessionManager,
  SettingsManager,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import createDebug from "debug";

import { bindToolkitToPi, loadToolkitModule } from "./bind-toolkit.js";
import { createPermissionExtension } from "./permission-extension.js";
import { buildPrompt } from "./prompt.js";
import { createPromptHeartbeat, logSessionEvent, type SessionActivity } from "./session-events.js";
import { mapSessionStats } from "./stats.js";
import { mapAgentToolsToPiPermissions } from "./tool-permissions.js";

const debug = createDebug("bifrost:engine:pi");

const SESSION_DIR_NAME = path.join(".bifrost", "pi-sessions");
const PROMPT_HEARTBEAT_MS = 15_000;

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type PiEngineConfig = {
  /** Default model reference, e.g. "anthropic/claude-opus-4-5:high" */
  model?: string;
  thinkingLevel?: ThinkingLevel;
  /** Runtime API key overrides: provider → key */
  apiKeys?: Record<string, string>;
  agentDir?: string;
  /** Extra Pi extension entry paths (absolute or package-relative files). */
  additionalExtensionPaths?: string[];
};

export type ToolkitConstructor = (context: EngineContext) => ToolDefinition[];

export type RegisteredToolkit =
  | ToolkitModuleRef
  | ToolkitDefinition
  | ToolkitFactory
  | ToolkitConstructor;

export class PiEngine implements Engine {
  private readonly config: PiEngineConfig;
  private toolkits = new Map<string, RegisteredToolkit>();

  public constructor(config: PiEngineConfig = {}) {
    this.config = config;
  }

  public registerToolkit(name: string, toolkit: RegisteredToolkit): void {
    this.toolkits.set(name, toolkit);
  }

  private async resolveCustomTools(
    toolkitNames: string[],
    context: EngineContext,
  ): Promise<ToolDefinition[]> {
    const customTools: ToolDefinition[] = [];

    for (const name of toolkitNames) {
      const entry = this.toolkits.get(name);
      if (entry === undefined) {
        continue;
      }

      if (typeof entry === "function") {
        // ToolkitFactory returns ToolkitDefinition; ToolkitConstructor returns ToolDefinition[]
        const result = entry(context);
        if (Array.isArray(result)) {
          customTools.push(...result);
          continue;
        }
        const definition = resolveToolkit(result, context);
        customTools.push(...bindToolkitToPi(definition, context));
        continue;
      }

      if (isToolkitModuleRef(entry)) {
        const toolkit = await loadToolkitModule(entry);
        const definition = resolveToolkit(toolkit, context);
        customTools.push(...bindToolkitToPi(definition, context));
        continue;
      }

      const definition = resolveToolkit(entry, context);
      customTools.push(...bindToolkitToPi(definition, context));
    }

    debug("custom tools created count=%s", customTools.length);
    return customTools;
  }

  private async resolveModel(
    modelRuntime: ModelRuntime,
    agentModel?: string,
  ): Promise<{
    model: Awaited<ReturnType<typeof resolveCliModel>>["model"];
    thinkingLevel?: ThinkingLevel;
  }> {
    const modelRef = agentModel ?? this.config.model;
    if (modelRef === undefined || modelRef.length === 0) {
      return { model: undefined, thinkingLevel: this.config.thinkingLevel };
    }

    const resolved = resolveCliModel({
      cliModel: modelRef,
      modelRuntime,
    });

    if (resolved.error !== undefined) {
      throw new Error(`Failed to resolve Pi model "${modelRef}": ${resolved.error}`);
    }
    if (resolved.warning !== undefined) {
      debug("model warning: %s", resolved.warning);
    }

    return {
      model: resolved.model,
      thinkingLevel: resolved.thinkingLevel ?? this.config.thinkingLevel,
    };
  }

  private async createSessionManager(
    workingDir: string,
    sessionId?: string,
  ): Promise<SessionManager> {
    const sessionDir = path.join(workingDir, SESSION_DIR_NAME);
    await mkdir(sessionDir, { recursive: true });

    if (sessionId !== undefined && sessionId.length > 0) {
      debug("opening session path=%s", sessionId);
      return SessionManager.open(sessionId, sessionDir, workingDir);
    }

    return SessionManager.create(workingDir, sessionDir);
  }

  public async execute(context: EngineContext, sessionId?: string): Promise<EngineResult> {
    const { agent, instructions, workingDir } = context;
    const { model: agentModel, tools } = agent;

    const prompt =
      sessionId !== undefined && sessionId.length > 0
        ? instructions
        : buildPrompt({ agent, instructions });

    debug("execute workingDir=%s sessionId=%s", workingDir, sessionId ?? "none");
    debug("prompt: %s", prompt);

    const permissions = mapAgentToolsToPiPermissions(tools as AgentTool[]);
    debug(
      "permissions hasTools=%s tools=%s toolkits=%s",
      permissions.hasTools,
      permissions.allowedToolNames.join(",") || "(none)",
      permissions.toolkitNames.join(",") || "(none)",
    );
    const customTools = await this.resolveCustomTools(permissions.toolkitNames, context);

    // Ensure custom tool names from active toolkits are on the allowlist
    const customToolNames = customTools.map((tool) => tool.name);
    const allowedToolNames = [...new Set([...permissions.allowedToolNames, ...customToolNames])];
    debug("allowedToolNames=%s", allowedToolNames.join(",") || "(none)");

    const agentDir = this.config.agentDir ?? getAgentDir();
    debug("agentDir=%s", agentDir);
    const settingsManager = SettingsManager.inMemory({
      compaction: { enabled: true },
      retry: { enabled: true },
    });

    const resourceLoader = new DefaultResourceLoader({
      cwd: workingDir,
      agentDir,
      settingsManager,
      extensionFactories: [createPermissionExtension(permissions.rules)],
      additionalExtensionPaths: [...(this.config.additionalExtensionPaths ?? [])],
      // Skip discovered project/user extensions; still load additionalExtensionPaths + factories
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
    });
    debug("resourceLoader.reload start");
    await resourceLoader.reload();
    debug("resourceLoader.reload done");

    debug("ModelRuntime.create start");
    const modelRuntime = await ModelRuntime.create({
      authPath: path.join(agentDir, "auth.json"),
      modelsPath: path.join(agentDir, "models.json"),
    });
    debug("ModelRuntime.create done");

    if (this.config.apiKeys !== undefined) {
      for (const [provider, key] of Object.entries(this.config.apiKeys)) {
        await modelRuntime.setRuntimeApiKey(provider, key);
        debug("runtime api key set provider=%s", provider);
      }
    }

    let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;

    try {
      const { model, thinkingLevel } = await this.resolveModel(modelRuntime, agentModel);
      debug(
        "model resolved provider=%s id=%s thinkingLevel=%s",
        model?.provider ?? "none",
        model?.id ?? "none",
        thinkingLevel ?? "default",
      );
      const sessionManager = await this.createSessionManager(workingDir, sessionId);

      const startMs = Date.now();

      debug("createAgentSession start");
      const created = await createAgentSession({
        cwd: workingDir,
        agentDir,
        modelRuntime,
        ...(model !== undefined && { model }),
        ...(thinkingLevel !== undefined && { thinkingLevel }),
        ...(permissions.hasTools ? { tools: allowedToolNames } : { noTools: "all" as const }),
        customTools,
        resourceLoader,
        sessionManager,
        settingsManager,
      });
      debug(
        "createAgentSession done sessionId=%s modelFallback=%s",
        created.session.sessionId,
        created.modelFallbackMessage ?? "-",
      );

      session = created.session;

      await session.bindExtensions({
        mode: "print",
        onError: (err) => {
          debug(
            "extension error path=%s event=%s error=%s",
            err.extensionPath,
            err.event,
            err.error,
          );
        },
      });
      debug("bindExtensions done");

      let numTurns = 0;
      const activity: SessionActivity = {
        lastEventType: "none",
        lastEventAt: Date.now(),
      };

      const unsubscribe = session.subscribe((event) => {
        activity.lastEventType = event.type;
        activity.lastEventAt = Date.now();
        logSessionEvent(debug, event);
        if (event.type === "turn_end") {
          numTurns += 1;
        }
      });

      const stopHeartbeat = createPromptHeartbeat(debug, activity, PROMPT_HEARTBEAT_MS);

      try {
        debug("prompt start");
        await session.prompt(prompt);
        debug("prompt done turns=%s elapsedMs=%s", numTurns, Date.now() - startMs);
      } finally {
        stopHeartbeat();
        unsubscribe();
      }

      const lastMessage = session.getLastAssistantText() ?? null;
      const sessionStats = session.getSessionStats();
      const stats = mapSessionStats(
        sessionStats,
        Date.now() - startMs,
        numTurns > 0 ? numTurns : 1,
      );
      const returnedSessionId = session.sessionFile ?? session.sessionId;

      debug("result sessionId=%s lastMessage=%s", returnedSessionId, lastMessage);

      return {
        success: true,
        skipFulfill: false,
        lastMessage: lastMessage ?? "No response from Pi",
        stats,
        sessionId: returnedSessionId,
      };
    } catch (error) {
      debug("error: %o", error);
      return {
        success: false,
        skipFulfill: false,
        lastMessage: error instanceof Error ? error.message : String(error),
        stats: null,
        ...(session !== undefined && {
          sessionId: session.sessionFile ?? session.sessionId,
        }),
      };
    } finally {
      if (session !== undefined) {
        debug("session.dispose");
        session.dispose();
      }
    }
  }
}
