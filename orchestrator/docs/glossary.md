# Glossary

Terms of art specific to the Bifrost Orchestrator. One-line definitions. Link to deeper pages where relevant.

---

- **Agent**: Specialized AI entity with prompt, tools, and lifecycle hooks. See [AGENT.md](./CREATING_AN_AGENT.md#agent-anatomy) format.
- **AgentDefinition**: Type extending BaseAgentDefinition with hooks. See [orchestrator/src/core/types.ts:44](../packages/orchestrator/src/core/types.ts#L44).
- **AgentTool**: Tool permission definition—string or object with name/allow/deny. See [engine/src/types.ts:5](../packages/engine/src/types.ts#L5).
- **BeforeDispatch Hook**: Orchestrator-level pre-dispatch gate. Runs before agent lookup. Outcomes: success, fatal, skip. See [ARCHITECTURE.md](./ARCHITECTURE.md#hook-system).
- **Engine**: Port interface for LLM/agent execution. Single `execute()` method. See [engine/src/interface.ts:4](../packages/engine/src/interface.ts#L4).
- **EngineContext**: Input to engine: taskId, workingDir, agent, taskState, metadata, setState, instructions. See [engine/src/types.ts:22](../packages/engine/src/types.ts#L22).
- **EngineResult**: Engine output: success, skipFulfill, lastMessage, stats, sessionId. See [engine/src/types.ts:33](../packages/engine/src/types.ts#L33).
- **ExecutionStats**: Telemetry: durationMs, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, totalCostUsd, numTurns. See [engine/src/types.ts:42](../packages/engine/src/types.ts#L42).
- **Follow-up**: Stop hook outcome requesting re-execution. Loops back to engine with new instructions (max 10). See [ARCHITECTURE.md](./ARCHITECTURE.md#data-flow-task-lifecycle).
- **Handlebars**: Template rendering system for agent prompts. See [orchestrator/src/core/handlebars-renderer.ts](../packages/orchestrator/src/core/handlebars-renderer.ts).
- **Hook**: Lifecycle extension point. Receives HookExecutionContext, returns HookResult. See [PATTERNS.md](./PATTERNS.md#observer--hook-chain).
- **HookExecutionContext**: Context to hooks: taskId, hookName, context, params, metadata, getTaskState, setTaskState. See [orchestrator/src/core/types.ts:22](../packages/orchestrator/src/core/types.ts#L22).
- **HookResult**: Hook outcome: success, follow-up, fatal, skip, pause. See [orchestrator/src/core/types.ts:17](../packages/orchestrator/src/core/types.ts#L17).
- **HookSpec**: Hook definition with name and function. See [orchestrator/src/core/types.ts:34](../packages/orchestrator/src/core/types.ts#L34).
- **Hooks**: Collection of Start and Stop hooks on an agent. See [orchestrator/src/core/types.ts:39](../packages/orchestrator/src/core/types.ts#L39).
- **OrchestrationContext**: Orchestrator-level context: projectDir, tools, instructions. See [orchestrator/src/core/types.ts:11](../packages/orchestrator/src/core/types.ts#L11).
- **Orchestrator**: Core class managing task loop. Registers agents/hooks, watches tasks, dispatches to engines. See [orchestrator-class.ts](../packages/orchestrator/src/orchestrator-class.ts).
- **Port**: Interface contract (TaskSource, Engine) with swappable adapters. See [ARCHITECTURE.md](./ARCHITECTURE.md#architecture-pattern).
- **Rune**: Bifrost API term for task. Claimed via `/api/claim-rune`, fulfilled via `/api/fulfill-rune`. See [ARCHITECTURE.md](./ARCHITECTURE.md#adapter-details).
- **Session**: Continuation mechanism for multi-turn engine interactions. Threaded via sessionId across follow-ups. See [ARCHITECTURE.md](./ARCHITECTURE.md#data-flow-task-lifecycle).
- **Start Hook**: Agent-level pre-execution hook. Mutates context/state. See [CREATING_AN_AGENT.md](./CREATING_AN_AGENT.md#start-hooks).
- **State Persistence**: TaskState updates via `taskSource.setState()` during execution. See [task-source/src/interface.ts:13](../packages/task-source/src/interface.ts#L13).
- **Stop Hook**: Agent-level post-execution hook. Validates results, may trigger follow-up. See [CREATING_AN_AGENT.md](./CREATING_AN_AGENT.md#stop-hooks).
- **Task**: Unit of work: id, agentId, taskState, metadata, instructions. See [task-source/src/types.ts:13](../packages/task-source/src/types.ts#L13).
- **TaskSource**: Port interface for task retrieval/management. Async generator for tasks. See [task-source/src/interface.ts:3](../packages/task-source/src/interface.ts#L3).
- **TaskState**: Mutable key-value state persisted during execution. See [ARCHITECTURE.md](./ARCHITECTURE.md#data-flow-task-lifecycle).
- **Template**: Parameter schema for Handlebars rendering. See [engine/src/types.ts:1](../packages/engine/src/types.ts#L1).
- **Tool**: Capability granted to agent (Read, Edit, Bash, etc.). Glob patterns define scope. See [CREATING_AN_AGENT.md](./CREATING_AN_AGENT.md#tool-permissions).

## Template for new entries

```markdown
- **Term**: one-line plain-English definition. See [[related-page]] for details.
```

## External conventions we use

- **ADR** — Architectural Decision Record.
- **AsyncGenerator** — JavaScript async iterator pattern for streaming tasks.
- **Dependency Injection** — Constructor injection of ports (TaskSource, Engine).
- **Factory Pattern** — Functional factories create config/credential objects.
- **Handlebars** — Mustache template syntax for prompt rendering.
- **Hexagonal Architecture** — Ports & Adapters pattern for swappable implementations.
- **Observer Pattern** — Hooks run as ordered chain, each result drives control flow.
- **Registry Pattern** — Agents and MCP toolkits stored in Maps, looked up by name.
- **Strategy Pattern** — Engine.execute is strategy interface, each implementation is concrete strategy.
- **Template Method** — Fixed orchestration lifecycle with variable hook/engine steps.
- **YAML Frontmatter** — Metadata format in AGENT.md files (parsed via gray-matter).
