# Architecture: Bifrost Orchestrator

## Overview

The Bifrost Orchestrator is a TypeScript monorepo that executes AI-agent tasks. It watches a stream of tasks, matches each to a registered agent, runs lifecycle hooks, renders a prompt, and delegates execution to a pluggable engine — all driven by three small interface contracts.

The core insight: **one orchestration loop** wires **three ports** (`TaskSource`, `Engine`, `AgentDefinition`) together through a **hook system**. Each port has swappable adapters, so the same orchestrator can pull tasks from memory or an HTTP API and execute them via the Claude Code SDK, the Devin CLI, or a test mock.

## Tech Stack

| Layer     | Technology                       | Purpose                                               |
| --------- | -------------------------------- | ----------------------------------------------------- |
| Language  | TypeScript 6 (ESM)               | Type-safe source                                      |
| Runtime   | Node ≥ 24                        | Execution                                             |
| Build     | Vite (lib mode)                  | Per-package `dist` bundles                            |
| Test      | Vitest                           | Colocated `*.spec.ts`, globals                        |
| Lint      | oxlint                           | correctness/perf/restriction/style/suspicious = error |
| Format    | Prettier                         | Style                                                 |
| Packaging | npm workspaces + pnpm workspaces | Monorepo                                              |
| Logging   | `debug` (namespace `bifrost`)    | Debug output                                          |

## Architecture Pattern

**Ports & Adapters (hexagonal) over dependency injection.** The `orchestrator` package is the core. `TaskSource` and `Engine` are injected ports; each has 2–3 adapters. The orchestrator never knows whether tasks come from memory or a remote API, nor which engine runs them.

```
         ┌───────────────────────────────────────────┐
         │              Orchestrator                 │
         │  (orchestrator-class.ts → orchestrate())  │
         │                                           │
   watchTasks()      BeforeDispatch ─┐    ┌── execute() ──→ Engine
   completeTask()    Start hooks     │    │   (sessionId resume)
   failTask()        Validate ───────┼──→ ├── Stop hooks
   pauseTask()       Render prompt   │    │   (follow-up loop, max 10)
   setState()        Engine loop ────┘    │
        ▲                                 │
        │                                 ▼
   ┌────┴───────────┐              ┌───────────────────┐
   │  TaskSource    │              │     Engine        │
   ├────────────────┤              ├───────────────────┤
   │ memory         │              │ test              │
   │ bifrost (HTTP) │              │ claude-code (SDK) │
   └────────────────┘              │ devin-cli (spawn) │
                                   └───────────────────┘
```

## Directory Structure

```
orchestrator/
├── packages/                      @bifrost-ai scope (runtime)
│   ├── orchestrator/              Core loop, hooks, parser, validator, prompt render
│   │   └── src/
│   │       ├── index.ts           Public barrel
│   │       ├── orchestrator-class.ts   Orchestrator class (public API)
│   │       ├── agent-helper.ts    loadAgent() convenience
│   │       └── core/
│   │           ├── types.ts       AgentDefinition, hook + context types
│   │           ├── orchestrator.ts     orchestrate() + runEngineLoop()
│   │           ├── hook-executor.ts    executeHooks() / executeBeforeDispatchHooks()
│   │           ├── agent-parser.ts     AGENT.md → AgentDefinition
│   │           ├── handlebars-renderer.ts   renderPrompt()
│   │           └── validator.ts   validateTaskState() vs parameter schema
│   ├── engine/                    Engine interface + types + TestEngine
│   ├── engine-claude-code/        Adapter → @anthropic-ai/claude-agent-sdk
│   ├── engine-devin-cli/          Adapter → devin CLI (spawn)
│   ├── task-source/               TaskSource interface + Task types
│   ├── task-source-memory/        In-memory store (tests/dev)
│   └── task-source-bifrost/       HTTP adapter to Bifrost "runes" API
├── atif/                          @atif scope (standalone) — see docs/atif/
└── (root configs)                 tsconfig, vite.base, vitest, oxlint
```

## Package Map

| Package               | Scope         | Role                                               |
| --------------------- | ------------- | -------------------------------------------------- |
| `orchestrator`        | `@bifrost-ai` | Core loop, hooks, parser, validator, prompt render |
| `engine`              | `@bifrost-ai` | `Engine` interface + types + `TestEngine`          |
| `engine-claude-code`  | `@bifrost-ai` | Adapter → `@anthropic-ai/claude-agent-sdk`         |
| `engine-devin-cli`    | `@bifrost-ai` | Adapter → `devin` CLI (spawn)                      |
| `task-source`         | `@bifrost-ai` | `TaskSource` interface + `Task` types              |
| `task-source-memory`  | `@bifrost-ai` | In-memory store (tests/dev)                        |
| `task-source-bifrost` | `@bifrost-ai` | HTTP adapter to Bifrost "runes" API                |

ATIF (`@atif/core`, `@atif/claude-code`) is a separate, standalone concern — documented in [docs/atif/](./atif/README.md).

## The Three Contracts (Ports)

### TaskSource

`task-source/src/interface.ts`:

```ts
export type TaskSource = {
  watchTasks: () => AsyncGenerator<Task>;
  completeTask: (taskId: string) => Promise<void>;
  failTask: (taskId: string, error: string) => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  setState: (taskId: string, taskState: Record<string, unknown>) => Promise<void>;
};

// Task = { id, agentId, taskState, metadata, instructions }
```

### Engine

`engine/src/interface.ts` — a single method:

```ts
export type Engine = {
  execute: (context: EngineContext, sessionId?: string) => Promise<EngineResult>;
};

// EngineContext in:  { taskId, workingDir, agent, taskState, metadata, instructions, setState }
// EngineResult out:  { success, skipFulfill, lastMessage, stats: ExecutionStats | null, sessionId? }
```

`ExecutionStats` carries `{ durationMs, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, totalCostUsd, numTurns }`.

### AgentDefinition

`orchestrator/src/core/types.ts` — extends the base engine definition with hooks:

```ts
export type AgentDefinition = BaseAgentDefinition & {
  hooks: Hooks; // { Start: HookSpec[]; Stop: HookSpec[] }
};
```

Parsed from an **AGENT.md** file (YAML frontmatter + Handlebars body) via `gray-matter`. The parser cross-validates every `{{token}}` in the body against the declared `template.parameters`.

For a hands-on guide to authoring, hooking, and registering an agent, see [Authoring an Agent](./AGENTS.md).

## Data Flow (Task Lifecycle)

`Orchestrator.run()` (`orchestrator-class.ts:43`):

1. `taskSource.watchTasks()` async generator yields tasks.
2. Agent lookup by `task.agentId` — miss → `failTask`.
3. **BeforeDispatch** hooks — `fatal`→fail, `skip`→complete, else continue.
4. `orchestrate()` (`core/orchestrator.ts:183`):
   - Mutable `currentTaskState` closure + `getTaskState`/`setTaskState` (persists via `taskSource.setState`).
   - **Start** hooks — may mutate `context` (`projectDir`/`tools`/`instructions`) and state. `fatal`→fail, `skip`→complete.
   - **Validate** `taskState` against `agent.template.parameters` (nested; `?` suffix = optional).
   - **Render** Handlebars `promptBody` with `{ taskId, metadata, taskState }`.
   - **Engine loop** (`runEngineLoop`, max 10 iterations): `engine.execute(ctx, sessionId)` → aggregate telemetry → **Stop** hooks. Stop `follow-up`→re-execute with new instructions; `pause`→`pauseTask`; `fatal`→fail.
   - `completeTask`, return telemetry.
5. Outer try/catch → `failTask`.

Session continuity: the `sessionId` returned by the engine is threaded into the next `execute()` call across follow-ups.

## Hook System

Three stages, outcome-driven control flow:

| Hook             | Lives on     | Outcomes                                   |
| ---------------- | ------------ | ------------------------------------------ |
| `BeforeDispatch` | orchestrator | success / fatal / skip                     |
| `Start`          | agent        | success / follow-up / fatal / skip / pause |
| `Stop`           | agent        | success / follow-up / fatal / pause        |

Hooks receive `{ taskId, hookName, context, params, metadata, getTaskState, setTaskState }`. A thrown error is normalized to a `fatal` outcome (`hook-executor.ts`). Processing early-exits on `fatal`/`skip`. The validator accumulates errors rather than failing fast.

## Adapter Details

- **memory task source** — `Map` + `Set` store, 50 ms polling, single-process. Dev/test only.
- **bifrost task source** — HTTP client (bearer token + `X-Bifrost-Realm` header); endpoints `/api/ready`, `/api/claim-rune`, `/api/fulfill-rune`, `/api/update-rune-state`. Adaptive polling 1 s → 30 s with exponential backoff + ±20% jitter. Filters runes by `agent:<id>` tag. Config in `.bifrost.yaml`; credentials in `~/.config/bifrost/credentials.yaml` (or `BIFROST_TEST_HOME`).
- **claude-code engine** — wraps `@anthropic-ai/claude-agent-sdk` `query()`, streams messages, extracts the session ID, builds the prompt from `<AgentDefinition>` + `<FeatureDefinition>`, and resolves tools + MCP toolkits via a registry.
- **devin-cli engine** — spawns a `devin -p --` process, parses stdout (sessionId / summary / stats via regex). `PermissionManager` maps orchestrator tools to Devin permissions (`Edit`→`Write`, `Bash`→`Exec`) and writes a temp config file.

## Error Handling

- **No custom error classes.** Standard `Error` with message propagation.
- **Engines never throw.** `execute()` catches everything and returns `{ success: false, stats: null, lastMessage }`.
- **Hooks throw → `fatal` outcome**, normalized in `hook-executor.ts`.
- **Validator accumulates** all errors before failing (not fail-fast).
- **Orchestrator outer try/catch** → `failTask` on any uncaught error.
- **Bifrost client** throws on HTTP 404/409 with a `status` property attached.

## Key Components

| Component               | Location                      | Responsibility                                |
| ----------------------- | ----------------------------- | --------------------------------------------- |
| `Orchestrator`          | `orchestrator-class.ts`       | Public class: register agents/hooks, run loop |
| `orchestrate`           | `core/orchestrator.ts`        | Single-task lifecycle                         |
| `runEngineLoop`         | `core/orchestrator.ts`        | Engine + Stop-hook follow-up loop             |
| `executeHooks`          | `core/hook-executor.ts`       | Run hook sequence, normalize outcomes         |
| `parseAgentDefinition`  | `core/agent-parser.ts`        | AGENT.md → AgentDefinition                    |
| `validateTaskState`     | `core/validator.ts`           | Schema validation                             |
| `renderPrompt`          | `core/handlebars-renderer.ts` | Handlebars rendering                          |
| `loadAgent`             | `agent-helper.ts`             | Parse + deep-merge agent config               |
| `Engine` / `TaskSource` | `engine/` / `task-source/`    | Port interfaces                               |
