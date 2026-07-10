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
2. **Wrappers** — `wrapperName → Wrapper`. A wrapper is a registered object
   with optional `before` and `after` functions. A `before` function _prepares_
   the work item; an `after` function _checks_ the work item after the inner
   scripts have run. Wrappers are self-contained — their functions are
   registered directly on the wrapper, not looked up from the scripts
   dictionary.

The work item has an optional `flow` array that names wrappers (not script
kinds) to apply around the work item's `kind`. This allows scheduling a
sequence of wrappers so that we can alter behavior without publishing hundreds
of slight variations.

```typescript
type ScriptFn = (workItem: WorkItem) => Promise<unknown>;

type Wrapper = {
  before?: ScriptFn; // prepares the work item
  after?: ScriptFn; // checks the work item
};

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
  wrappers: Record<string, Wrapper>;
};
```

When a runner receives the work item, it resolves the core script from `kind`
and the wrappers from `flow`, then executes them in onion order: each wrapper's
`before` runs on the way in, the core script runs at the center, and each
wrapper's `after` runs on the way out.

```typescript
// given
const item = {
  kind: "myScript",
  flow: ["wrapper1", "wrapper2", "wrapper3"],
};

const stack = {
  scripts: {
    myScript: myScriptFn,
  },
  wrappers: {
    wrapper1: { before: prepareEnvFn },
    wrapper2: { after: validateOutputFn },
    wrapper3: { before: prepareSomethingFn, after: doSomethingFn },
  },
};

// execution order:
// 1. wrapper1.before -> prepareEnvFn
// 2. wrapper2.before -> (skipped — no before)
// 3. wrapper3.before -> prepareSomethingFn
// 4. myScript
// 5. wrapper3.after  -> doSomethingFn
// 6. wrapper2.after  -> validateOutputFn
// 7. wrapper1.after  -> (skipped — no after)
```

All functions (core scripts and wrapper hooks) must satisfy `ScriptFn`. This
guarantees a static interface. If a script needs to pass data to the next
script, it should modify the work item's `state`.

## Example

A level 3 task agent exists called "write-tests". This task agent knows what
good tests look like.

A level 4 workflow agent wants to write some typescript tests. It schedules a
work item with `kind: "write-tests"` and a wrapper that prepares the test
context before execution and validates the output afterward without needing a
standalone follow-up script.

```typescript
const item = {
  kind: "write-tests",
  flow: ["typescript-tests"],
};

const stack = {
  scripts: {
    "write-tests": writeTestsFn,
  },
  wrappers: {
    "typescript-tests": {
      before: prepareTsContextFn,
      after: validateTsTestsFn,
    },
  },
};

// execution order:
// 1. prepareTsContextFn -> modifies the instructions to explain vitest-gwt and vitest
// 2. writeTestsFn       -> writes the tests
// 3. validateTsTestsFn  -> calls vitest and checks that the tests FAIL
```
