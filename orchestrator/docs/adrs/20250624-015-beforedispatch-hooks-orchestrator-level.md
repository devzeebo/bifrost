# 20250624-015. BeforeDispatch Hooks for Orchestrator-Level Control

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Agent-level hooks (Start/Stop) operate within individual agent execution. Some concerns need orchestration-level control before agent dispatch. Examples: global rate limiting, circuit breakers, cross-agent validation, feature flags. Framework needs extension point before agent selection and execution.

## Decision

BeforeDispatch hooks registered on Orchestrator (not agents). Execute before agent lookup and engine execution. Can abort or skip task before agent dispatched. Separate from agent Start/Stop hooks.

```typescript
export class Orchestrator {
  private readonly beforeDispatchHooks: BeforeDispatchHookSpec[];

  public addBeforeDispatch(hook: BeforeDispatchHookSpec): void {
    this.beforeDispatchHooks.push(hook);
  }

  public async run(): Promise<void> {
    for await (const task of this.taskSource.watchTasks()) {
      // Execute BeforeDispatch hooks BEFORE agent lookup
      const beforeDispatchResults = await executeBeforeDispatchHooks({
        hooks: this.beforeDispatchHooks,
        context: {
          taskId: task.id,
          agentId: task.agentId,
          context,
          taskState: task.taskState,
          metadata: task.metadata,
        },
      });

      const fatalResult = beforeDispatchResults.find((h) => h.outcome === "fatal");
      if (fatalResult) {
        await this.taskSource.failTask(task.id, fatalResult.message);
        continue;
      }

      const skipResult = beforeDispatchResults.find((h) => h.outcome === "skip");
      if (skipResult) {
        await this.taskSource.completeTask(task.id);
        continue;
      }

      // NOW lookup agent and execute
      const agent = this.agents.get(task.agentId);
      // ... rest of orchestration
    }
  }
}
```

**BeforeDispatch vs Start/Stop:**

- **BeforeDispatch**: Orchestrator-level, before agent lookup, global concerns
- **Start**: Agent-level, after agent lookup, agent-specific setup
- **Stop**: Agent-level, after engine execution, agent-specific validation

## Consequences

**Positive:**

- Global cross-cutting concerns (rate limiting, circuit breakers)
- Agent-agnostic logic execution
- Early exit (before agent lookup)
- Separate from agent lifecycle

**Negative:**

- No access to agent definition (agent not looked up yet)
- No taskState mutation (different context type)
- Cannot trigger follow-up (only fatal/skip outcomes)
- Manual registration required

## Changelog

- Add BeforeDispatch hooks for orchestrator-level cross-cutting concerns
