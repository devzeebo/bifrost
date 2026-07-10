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
2. **Wrappers** — `wrapperName → WrapperFn`. A wrapper is a decorator: it
   receives the work item and a `next` callback that continues the inner flow.
   The wrapper controls when (or whether) to invoke `next`, giving it full
   flexibility to prepare, check, retry, or short-circuit the child flow.

The work item has an optional `flow` array that names wrappers (not script
kinds) to apply around the work item's `kind`. This allows scheduling a
sequence of decorators so that we can alter behavior without publishing
hundreds of slight variations.

```typescript
type ScriptFn = (workItem: WorkItem) => Promise<unknown>;

type WrapperFn = (
  workItem: WorkItem,
  next: () => Promise<unknown>,
) => Promise<unknown>;

type WorkItem = {
  workItemId: string;
  kind: string; // scriptKind used to lookup the core script
  flow: string[]; // wrapper names, outermost first
  state: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

// Runner configuration
type ScriptStack = {
  scripts: Record<string, ScriptFn>;
  wrappers: Record<string, WrapperFn>;
};
```

When a runner receives the work item, it resolves the core script from `kind`
and the wrappers from `flow`, then nests them: the outermost wrapper in
`flow` receives a `next` that runs the rest of the stack, ending with the core
script at the center.

```typescript
// given
const item = {
  kind: "myScript",
  flow: ["wrapper1", "wrapper2"],
};

const stack = {
  scripts: {
    myScript: myScriptFn,
  },
  wrappers: {
    wrapper1,
    wrapper2,
  },
};

// equivalent to:
// wrapper1(item, () => wrapper2(item, () => myScriptFn(item)))
```

A wrapper must call `next()` to continue the child flow. It may call `next()`
zero times (short-circuit), once (typical), or many times (retry). It may run
logic before `next()` (prepare), after `next()` (check), or around both.

```typescript
const retry: WrapperFn = async (workItem, next) => {
  let i = 0;
  while (true) {
    try {
      return await next();
    } catch (e) {
      if (++i >= 3) throw e;
    }
  }
};
```

Core scripts must satisfy `ScriptFn`; wrappers must satisfy `WrapperFn`. If a
script needs to pass data to the next script, it should modify the work item's
`state`.

## Example

A level 3 task agent exists called "write-tests". This task agent knows what
good tests look like.

A level 4 workflow agent wants to write some typescript tests. It schedules a
work item with `kind: "write-tests"` and a wrapper that prepares the test
context before execution and validates the output afterward — without needing a
standalone follow-up script.

```typescript
const typescriptTests: WrapperFn = async (workItem, next) => {
  await prepareTsContext(workItem); // modify instructions for vitest-gwt
  await next(); // write-tests runs here
  await validateTsTests(workItem); // run vitest, expect tests to fail
};

const item = {
  kind: "write-tests",
  flow: ["typescript-tests"],
};

const stack = {
  scripts: {
    "write-tests": writeTestsFn,
  },
  wrappers: {
    "typescript-tests": typescriptTests,
  },
};
```
