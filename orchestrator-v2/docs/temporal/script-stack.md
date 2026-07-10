# Script Stack

## Problem

The runner currently finds work item scripts via a complicated lookup. Each
agent layer feels disconnected and bespoke. This makes extending them very
difficult.

## Proposed Solution

The script stack. The runner has a single source of work item mapped scripts.

We have two dictionaries:

1. **Scripts** — `scriptKind → ScriptFn`. The runner does a simple lookup to
   find the function to execute. The scriptKind is a first-class field on the
   work item.
2. **Decorators** — `decoratorName → DecoratorFn`. A decorator wraps inner
   execution via a `next` callback. Both scripts and decorators receive a
   shared `ScriptContext` (`cwd`, `data`, `setState`).

The work item has a `flow` array naming decorators (outermost first) to apply
around the work item's `kind`.

**Conventions** are runner-level decorators applied to every work item before
`flow`. The default convention is `failOnError`, which catches thrown errors
and maps them to `{ outcome: "failed" }`.

```typescript
type ScriptContext = {
  cwd: string;
  data: DataRegistry<Record<string, unknown>>;
  setState: (state: Record<string, unknown>) => Promise<void>;
};

type ScriptFn = (workItem: WorkItem, ctx: ScriptContext) => Promise<unknown>;

type DecoratorFn = (
  workItem: WorkItem,
  ctx: ScriptContext,
  next: () => Promise<unknown>,
) => Promise<unknown>;

type WorkItem = {
  workItemId: string;
  kind: string; // scriptKind used to lookup the core script
  flow: string[]; // decorator names, outermost first
  state: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

// Runner configuration
type ScriptStack = {
  scripts: Record<string, ScriptFn>;
  decorators: Record<string, DecoratorFn>;
  conventions: string[]; // runner-level decorator names, outermost first
};
```

When a runner receives the work item, it resolves the core script from `kind`,
conventions from the runner config, and decorators from `flow`, then nests them:

```
conventions → flow → script
```

```typescript
// given
const item = {
  kind: "myScript",
  flow: ["decorator1", "decorator2"],
};

// runner.conventions = ["failOnError"]

// equivalent to:
// failOnError(item, ctx, () =>
//   decorator1(item, ctx, () =>
//     decorator2(item, ctx, () =>
//       myScriptFn(item, ctx))))
```

A decorator must call `next()` to continue the child flow. It may call `next()`
zero times (short-circuit), once (typical), or many times (retry). It may run
logic before `next()` (prepare), after `next()` (check), or around both.

```typescript
const retry: DecoratorFn = async (workItem, ctx, next) => {
  let i = 0;
  while (true) {
    try {
      return await next();
    } catch (e) {
      if (++i >= 3) throw e;
    }
  }
};

const failOnError: DecoratorFn = async (workItem, ctx, next) => {
  try {
    return await next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { outcome: "failed", message };
  }
};
```

Core scripts must satisfy `ScriptFn`; decorators must satisfy `DecoratorFn`. If a
script needs to pass data to the next layer, it should modify the work item's
`state` or call `ctx.setState`.

## Example

A level 3 task agent exists called "write-tests". This task agent knows what
good tests look like.

A level 4 workflow agent wants to write some typescript tests. It schedules a
work item with `kind: "write-tests"` and a wrapper that prepares the test
context before execution and validates the output afterward — without needing a
standalone follow-up script.

```typescript
const typescriptTests: DecoratorFn = async (workItem, ctx, next) => {
  await prepareTsContext(workItem, ctx); // modify instructions for vitest-gwt
  await next(); // write-tests runs here
  await validateTsTests(workItem, ctx); // run vitest, expect tests to fail
};

const item = {
  kind: "write-tests",
  flow: ["typescript-tests"],
};

const stack = {
  scripts: {
    "write-tests": writeTestsFn,
  },
  decorators: {
    "typescript-tests": typescriptTests,
  },
  conventions: ["failOnError"],
};
```
