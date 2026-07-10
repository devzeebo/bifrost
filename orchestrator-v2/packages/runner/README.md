# @bifrost-ai/runner

Remote script runner for Bifrost orchestrator v2.

Design background: [docs/runner.md](../../docs/runner.md) · [docs/temporal/script-stack.md](../../docs/temporal/script-stack.md)

## Purpose

Runners dial the orchestrator, execute registered scripts locally through a composable decorator stack, and report signed outcomes.

## Script stack

Execution composes three layers, outermost first:

```
conventions → flow decorators → script
```

| Layer          | Declared on | API                                                   |
| -------------- | ----------- | ----------------------------------------------------- |
| **Script**     | Runner      | `registerScript(kind, fn)`                            |
| **Decorator**  | Runner      | `registerDecorator(name, fn)`                         |
| **Convention** | Runner      | `addConvention(name)` — defaults to `["failOnError"]` |
| **Flow**       | Work item   | `workItem.flow` — decorator names, outermost first    |

Both conventions and flow use the same decorator registry. The built-in `failOnError` convention catches thrown errors and maps them to `{ outcome: "failed" }`.

## Public API

### `Runner`

```typescript
import type { ScriptFn } from "@bifrost-ai/interfaces-work";
import { Runner, createDataRegistry } from "@bifrost-ai/runner";

const echo: ScriptFn = async (workItem, ctx) => {
  await ctx.setState({ echoed: workItem.metadata.message });
  return { outcome: "completed" };
};

const runner = new Runner({ data: createDataRegistry(guards) });
runner.registerScript("echo", echo);
runner.addConvention("log"); // optional runner-wide decorator
await runner.start();
```

### Lower-level exports

- `registerScriptAgent(runner, name, fn)` — adapt legacy `{ workItem, cwd, setState }` scripts
- `composeStack`, `executeScriptStack`, `resolveStack` — in-process stack execution
- `createScriptContext` — build RPC-backed `ScriptContext` for a dispatch
- `failOnError`, `FAIL_ON_ERROR_DECORATOR` — built-in error-handling convention
- `createDataRegistry(guards)` — typed data registry
- `Registry` — generic name-keyed registry

## Config schema

See [docs/runner.md](../../docs/runner.md) for `runner.yaml` fields and trust model.

## Module map

| Module                         | Responsibility                                       |
| ------------------------------ | ---------------------------------------------------- |
| `runner.ts`                    | `Runner` class lifecycle                             |
| `script-stack.ts`              | Compose and execute script + decorator stacks        |
| `script-context.ts`            | Per-dispatch `ScriptContext` with RPC `setState`     |
| `conventions/fail-on-error.ts` | Built-in `failOnError` convention                    |
| `dispatch-handler.ts`          | Handle `dispatch` RPC → execute stack → terminal RPC |
| `data-registry.ts`             | Typed sub-registries for engines, agent defs, etc.   |
