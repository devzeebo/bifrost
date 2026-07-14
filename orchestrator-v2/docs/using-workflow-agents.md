# Using Workflow Agents

A plain-language guide to running multi-step jobs. For how a Workflow Agent schedules and verifies children internally, see [agent-4-workflow.md](agent-4-workflow.md).

## What is a Workflow Agent?

A **Workflow Agent** is a coordinator. It does not talk to an AI itself. Instead, it breaks a big job into steps, runs them in the right order, and checks that everything finished successfully.

Think of it like a recipe:

1. **Prep** — get ingredients ready (a small script step)
2. **Cook** — the main AI work (a Task Agent step)
3. **Plate** — wrap up and summarize (another script step)

The workflow sets up all the steps up front, waits while they run, then does a final check.

## When to use one

Use a Workflow Agent when one AI conversation is not enough:

- Research, then implement, then test
- Prepare files, then run an AI agent, then verify the output
- Run two independent jobs in parallel after a shared first step

Use a [Task Agent](using-task-agents.md) when a single AI conversation is all you need.

## What you need

| Piece                     | What it does                                      |
| ------------------------- | ------------------------------------------------- |
| **A Workflow definition** | Lists the steps and their order                   |
| **Task Agents**           | Registered for any step that needs an AI          |
| **Script functions**      | Optional small code steps before or after AI work |
| **A runner**              | Registers the workflow and its dependencies       |
| **A work item**           | Says “run this workflow now”                      |

## Step 1 — Define your workflow

Build a workflow with the `Workflow` class. Each call to `.step(...)` adds one or more steps.

### Sequential steps

Steps in separate `.step()` calls run one after another:

```typescript
import { script, task, Workflow } from "@bifrost-ai/agent-4-workflow";
import { continueStep } from "@bifrost-ai/agent-4-workflow";

export function createMyFlow(): Workflow {
  return new Workflow({ name: "my-flow" })
    .step(script(prepare, "prepare"))
    .step(task("reviewer"))
    .step(script(summarize, "summarize"));
}
```

This runs: **prepare → reviewer → summarize**.

### Parallel steps

Pass multiple items in one `.step()` call to run them at the same time (after earlier steps finish):

```typescript
new Workflow({ name: "diamond" })
  .step(task("plan"))
  .step(task("build"), task("document")) // both run after plan
  .step(task("review")); // runs after both finish
```

```
        plan
       /    \
   build   document
       \    /
       review
```

### Two kinds of steps

| Kind       | How to add it                  | Good for                                            |
| ---------- | ------------------------------ | --------------------------------------------------- |
| **Task**   | `task("agent-name")`           | AI work — `name` must match a registered Task Agent |
| **Script** | `script(myFn, "display-name")` | Short code: setup, logging, validation, cleanup     |

A **script step** is a plain async function. Return `continueStep()` when the step succeeds:

```typescript
import { continueStep } from "@bifrost-ai/agent-4-workflow";
import type { WorkflowScriptFn } from "@bifrost-ai/agent-4-workflow";

export const prepare: WorkflowScriptFn = async ({ cwd }) => {
  console.log(`Getting ready in ${cwd}`);
  return continueStep("prepared");
};
```

Return `failStep("reason")` if the step should stop the workflow.

### Step decorators (optional)

Decorators wrap a step with extra behavior — logging, retries, enriching child state, and so on. Pass them as the last argument to `.step()`:

```typescript
import type { DecoratorFn } from "@bifrost-ai/interfaces-work";

const logStep: DecoratorFn = async (workItem, _ctx, next) => {
  console.log(`Starting ${workItem.name}`);
  const result = await next();
  console.log(`Finished ${workItem.name}`);
  return result;
};

new Workflow({ name: "my-flow" }).step(task("reviewer"), [{ name: "logStep", fn: logStep }]);
```

You can also register decorators by name if you prefer to reuse them across steps.

### Retrying flaky steps

Use the built-in `retry` decorator to retry a step when inner execution throws:

```typescript
import { retry, task, Workflow } from "@bifrost-ai/agent-4-workflow";

new Workflow({ name: "my-flow" }).step(task("flaky-task"), [retry(4)]);
```

`retry` auto-registers when you import `@bifrost-ai/agent-4-workflow/augment`. It writes `state.retry = { maxAttempts, currentAttempt }` and retries `next()` until success or attempts are exhausted.

### Enriching task steps

The workflow framework creates child work items with `workingDir` and a back-reference to the parent workflow. It does **not** copy instructions, engine choice, or template parameters into task steps — that is your job, typically via **step decorators**.

A decorator on a `task("reviewer")` step can run before the Task Agent and call `ctx.setState(...)` to add fields like `instructions`, `engineName`, or template parameter values that the Task Agent expects.

## Step 2 — Register everything on the runner

Import both agent augments, register Task Agents your workflow references, then register the workflow:

```typescript
import { Runner, createDataRegistry } from "@bifrost-ai/runner";
import "@bifrost-ai/agent-3-task/augment";
import "@bifrost-ai/agent-4-workflow/augment";
import { loadAgent, taskAgentDataGuards } from "@bifrost-ai/agent-3-task";
import { CursorEngine } from "@bifrost-ai/engine-cursor";

import { createMyFlow } from "./agents/my-flow/workflow.js";

const runner = new Runner({ data: createDataRegistry(taskAgentDataGuards) });

runner.registerEngine("cursor", new CursorEngine());
runner.registerTaskAgent("reviewer", await loadAgent("./agents/reviewer/AGENT.md"));
runner.registerWorkflowAgent(createMyFlow());

await runner.start();
```

`registerWorkflowAgent` does several things for you:

- Registers the workflow as a script looked up by the workflow **`name`** (for example `"my-flow"`)
- Auto-registers inline script steps
- Checks that every `task("...")` step has a matching Task Agent registered under that name
- Checks that named decorators exist on the runner

See [examples/lvl4/runner.ts](../examples/lvl4/runner.ts) and [examples/lvl4/agents/cowsay-flow/](../examples/lvl4/agents/cowsay-flow/) for a working example.

## Step 3 — Send it work

A workflow work item needs:

| Field              | Required | Meaning                                                           |
| ------------------ | -------- | ----------------------------------------------------------------- |
| `name`             | Yes      | Must match the workflow definition name (for example `"my-flow"`) |
| `state.workingDir` | Yes      | Folder passed down to child steps                                 |

With Bifrost runes, `kind` is typically `"workflow"`. The runner resolves the workflow script by **`name`**, not `kind`.

Example:

```typescript
{
  workItemId: "workflow-1",
  kind: "workflow",
  name: "my-flow",
  state: {
    workingDir: "/path/to/repo",
  },
}
```

## What happens when it runs

In plain terms, the workflow runs **twice**:

**First run — set up**

1. Creates a child work item for every step (task or script).
2. Wires up “step B waits for step A” dependencies.
3. Promotes all children to live; the work item source only dispatches those whose dependencies are satisfied.
4. Pauses itself until all children finish.

**While waiting**

- Child steps run on the runner like any other work item.
- Steps with no dependencies start right away.
- Later steps start when their prerequisites complete.
- Parallel steps in the same group can run at the same time.

**Second run — wrap up**

1. Checks that every child completed successfully.
2. If yes, the workflow is done.
3. If any child failed or is still outstanding, the workflow **fails immediately**. It does not pause and wait.

You do not need to manually start each child step. The workflow creates them on the first run; the work item source handles scheduling as dependencies clear.

## Task Agent vs Workflow Agent

|                     | Task Agent          | Workflow Agent              |
| ------------------- | ------------------- | --------------------------- |
| **Job**             | One AI conversation | Coordinate many steps       |
| **Talks to AI?**    | Yes                 | No                          |
| **How many runs?**  | Once                | Twice (set up, then verify) |
| **Has child jobs?** | No                  | Yes — one per step          |

## Quick checklist

- [ ] Every `task("name")` in the workflow has a matching `registerTaskAgent("name", ...)`
- [ ] Workflow definition `name` matches the work item `name`
- [ ] Work item `state` includes `workingDir`
- [ ] Task steps have decorators (or another mechanism) that supply `instructions`, `engineName`, and any required template parameters
- [ ] Script steps return `continueStep()` on success
- [ ] Any named decorators used in steps are registered on the runner

## Related

- [Workflow Agent lifecycle](agent-4-workflow.md) — scheduling, blocking, and verification details
- [Using Task Agents](using-task-agents.md) — how to write and register AI agents
- [Runner](runner.md) — runner setup and script stack
- [Root README](../README.md) — orchestrator and runner quick start
