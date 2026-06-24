# Coding Standards: Bifrost Orchestrator

Extracted from the existing codebase. Follow these when adding code.

## Naming Conventions

### Files

- **Pattern:** kebab-case.
- **Examples:** `bifrost-task-source.ts`, `devin-parser.ts`, `hook-executor.ts`.
- One barrel `index.ts` per package, re-exporting the public surface.

### Types

- **Pattern:** PascalCase.
- **Use `type`, not `interface`** — enforced by oxlint (`consistent-type-definitions: ["error", "type"]`).
- **Examples:** `AgentDefinition`, `EngineContext`, `OrchestrationResult`.

### Functions / Variables

- **Pattern:** camelCase.
- **Examples:** `parseAgentDefinition`, `validateTaskState`, `runEngineLoop`.

### Constants

- No `UPPER_SNAKE_CASE` convention is enforced; plain camelCase is common for module-level values.

### Private members

- **Pattern:** `#` private fields and private static methods.
- **Examples:** `#tasks`, `#currentSessionId`, `#handleError`, `#buildArgs`.

## Code Organization

### File structure

1. Type imports first (`import type { ... }`), then value imports.
2. Type definitions.
3. Implementation (functions / class).
4. Barrel `index.ts` re-exports only the public surface.

### Class structure

1. Constructor-injected dependencies (stored as fields).
2. Public API methods.
3. Private `#` methods.

## Formatting

- **Tooling:** Prettier (`.prettierrc` if present) + oxlint.
- **Indentation:** 2 spaces.
- **Quotes:** double.
- **Trailing commas:** yes.
- **Semicolons:** yes.

## Patterns in Use

### Dependency Injection

Constructor-injected ports. The orchestrator depends on `TaskSource` and `Engine` abstractions, never on concrete adapters:

```ts
export type OrchestratorOptions = {
  taskSource: TaskSource;
  engine: Engine;
  projectDir?: string;
};
```

### Ports & Adapters

`TaskSource` and `Engine` are interface ports; `memory` / `bifrost` and `test` / `claude-code` / `devin-cli` are swappable adapters implementing them.

### Error Handling

No custom error classes. Catch and normalize:

```ts
// Engines never throw — return a failure result.
catch (error) {
  return {
    success: false,
    skipFulfill: false,
    lastMessage: error instanceof Error ? error.message : String(error),
    stats: null,
  };
}
```

```ts
// Message normalization is repeated everywhere — keep it consistent:
const message = error instanceof Error ? error.message : String(error);
```

### Logging

Use the `debug` package with the `bifrost` namespace:

```ts
import createDebug from "debug";
const debug = createDebug("bifrost");
debug("task %s %s", task.id, result.outcome);
```

See [PATTERNS.md](./PATTERNS.md) for the full pattern catalog.

## Async Conventions

- All I/O returns `Promise<T>`.
- Streams use `AsyncGenerator<T>` (`watchTasks`).
- `setState` callbacks are async (`Promise<void>`).
- `no-await-in-loop` is **off** — sequential awaits in loops are accepted where the loop is inherently sequential (engine follow-ups, hook execution).

## Testing Conventions

### Location

- Colocated: `*.spec.ts` next to the source file.
- Integration specs live alongside unit specs (e.g. `task-source-bifrost/src/integration.spec.ts`).

### Framework

- **Vitest** with globals enabled (`describe`, `it`, `expect` available without import).
- Environment: `node`.
- Setup: `vitest.setup.ts`.

### Structure

- Given-When-Then style.
- Mock `TaskSource` and `Engine` with plain object literals implementing the interfaces.
- `BIFROST_TEST_HOME` env var redirects credential loading in tests.

### Test overrides (oxlint)

For `*.spec.ts` only, these relax:

- `no-non-null-assertion`: off
- `no-empty-function`: off
- `prefer-destructuring`: off

## oxlint Configuration Highlights

Categories set to error: `correctness`, `perf`, `restriction`, `style`, `suspicious`. Plugin: `typescript`.

Notable **disabled** rules (do not assume these are enforced):

- `max-params`, `no-magic-numbers`, `max-statements`
- `no-await-in-loop`, `no-void`, `no-ternary`, `no-undefined`
- `typescript/explicit-function-return-type`, `typescript/explicit-module-boundary-types`
- `sort-keys`, `sort-imports`, `capitalized-comments`, `no-underscore-dangle`

## Build Conventions

- Each package builds with Vite in library mode (`vite.base.ts`).
- Output: ES module only (`formats: ["es"]`), `target: "node24"`.
- Externals: all `dependencies` + `peerDependencies` + tsconfig `references` + `node:*` built-ins. **Do not bundle cross-package or Node built-in deps.**
- `emptyOutDir: true` — build wipes `dist/`.
- Type declarations emitted via `vite-plugin-dts`.

## Git Conventions

(Not specified in repo config — follow the team convention. Recent history uses short imperative subjects, lowercase: `remove substring`, `fix status check`, `fix tests`.)
