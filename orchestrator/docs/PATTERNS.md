# Pattern Library: Bifrost Orchestrator

Recurring patterns observed across the codebase, with locations and examples.

## Ports & Adapters

**Location:** `task-source/src/interface.ts`, `engine/src/interface.ts`, plus all adapter packages.

The orchestrator core depends only on the `TaskSource` and `Engine` interfaces. Each has multiple adapters that satisfy the contract independently.

```ts
// engine/src/interface.ts — the port
export type Engine = {
  execute: (context: EngineContext, sessionId?: string) => Promise<EngineResult>;
};
```

Adapters: `TestEngine`, `ClaudeCodeEngine` (SDK), `DevinCliEngine` (CLI), `MemoryTaskSource`, `BifrostTaskSource` (HTTP).

## Dependency Injection

**Location:** `orchestrator/src/orchestrator-class.ts:25`.

Constructor injection of the two ports; the orchestrator stores them as fields and never references a concrete adapter.

```ts
public constructor(options: OrchestratorOptions) {
  this.taskSource = options.taskSource;
  this.engine = options.engine;
  this.projectDir = options.projectDir ?? process.cwd();
  this.agents = new Map<string, AgentDefinition>();
  this.beforeDispatchHooks = [];
}
```

## Strategy

**Location:** `engine/src/interface.ts`, all engine packages.

`Engine.execute` is the strategy interface. Each implementation is a concrete, interchangeable strategy. Adding a new execution backend means implementing one method.

## Registry

**Location:** `orchestrator/src/orchestrator-class.ts:22` (agents), `engine-claude-code/src/claude-code-engine.ts` (MCP toolkits).

Agents and MCP toolkits are stored in `Map`s and looked up by name:

```ts
private readonly agents: Map<string, AgentDefinition>;

public registerAgent(agent: AgentDefinition): void {
  this.agents.set(agent.name, agent);
}
```

## Template Method

**Location:** `orchestrator/src/core/orchestrator.ts:183` (`orchestrate`).

The orchestration lifecycle is a fixed sequence of steps: set up state → Start hooks → validate → render → engine loop → complete. Hooks and the engine are the variable steps plugged into the fixed skeleton.

## Observer / Hook Chain

**Location:** `orchestrator/src/core/hook-executor.ts`.

Hooks run as an ordered chain. Each result drives early-exit control flow (`fatal`, `skip`, `pause`) or continuation (`success`, `follow-up`). Thrown errors normalize to `fatal`.

```ts
// Simplified shape — executeHooks runs Start/Stop; executeBeforeDispatchHooks runs the pre-dispatch gate.
const stopHookResults = await executeHooks({
  hooks: agent.hooks.Stop,
  lifecycle: "Stop",
  context: hookContext,
});

for (const hook of stopHookResults) {
  if (hook.outcome === "fatal") {
    /* failTask, return */
  }
  if (hook.outcome === "pause") {
    /* pauseTask, return */
  }
  if (hook.outcome === "follow-up") {
    needsFollowUp = true;
    break;
  }
}
```

## Builder

**Location:** `engine-claude-code/src/claude-code-engine.ts` (prompt).

Prompts are assembled from parts with optional fields:

```ts
const buildPrompt = (options: BuildPromptOptions): string => {
  const { agent, instructions } = options;
  const parts: string[] = [
    promptSection("AgentDefinition", agent.promptBody),
    promptSection("FeatureDefinition", instructions),
  ];
  return parts.join("\n");
};
```

## Factory

**Location:** `task-source-bifrost/src/config/` (`loadConfig`, `loadToken`).

Functional factories create config/credential objects. `loadAgent` (`orchestrator/src/agent-helper.ts`) parses an agent definition and deep-merges a partial override.

## Adapter (interface translation)

**Location:** `engine-devin-cli/src/permission-manager.ts`.

Translates the orchestrator's tool vocabulary into the Devin CLI's permission format:

```ts
const toolMap: Record<string, string> = {
  Read: "Read(**)",
  Write: "Write(**)",
  Edit: "Write(**)",
  Bash: "Exec(**)",
  Run: "Exec(**)",
  WebSearch: "Fetch(**)",
  WebBrowse: "Fetch(**)",
};
```

## Error Normalization (no custom exceptions)

**Location:** throughout; canonical form in every engine.

All engines catch and convert to a failure `EngineResult` rather than throwing:

```ts
static #handleError(message: string, error: unknown): EngineResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    success: false,
    skipFulfill: false,
    lastMessage: `${message}: ${errorMessage}`,
    stats: null,
  };
}
```

## Testing Patterns

### Unit test

**Location:** `orchestrator/src/core/orchestrator.spec.ts`.

Mocks `TaskSource` and `Engine` as plain object literals, drives the lifecycle, asserts on outcome/telemetry/state. Given-When-Then structure. Covers happy path, validation failure, and each hook outcome (`fatal`, `skip`, `pause`, `follow-up`).

### Integration test

**Location:** `task-source-bifrost/src/integration.spec.ts`, `client/bifrost-http-client.spec.ts`.

Exercises the HTTP client and config/credential loaders against the Bifrost API contract, using `BIFROST_TEST_HOME` to redirect credential reads.

### Mock shape

```ts
const engine: Engine = {
  async execute(_ctx, _sessionId) {
    return { success: true, skipFulfill: false, lastMessage: "ok", stats: null };
  },
};
```
