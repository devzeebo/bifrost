# Using Task Agents

A plain-language guide to running a single AI job. For how a Task Agent runs internally, see [agent-3-task.md](agent-3-task.md).

## What is a Task Agent?

A **Task Agent** is one focused job for an AI. You give it instructions, it talks to an AI engine (like Claude or Cursor), and it finishes with a result.

Think of it like handing a contractor a work order:

- Here is what I need done (instructions).
- Here is where to work (a folder on disk).
- Go do it, then tell me when you are finished.

A Task Agent does not split work into smaller jobs. It is the **leaf** — the thing that actually runs the AI conversation. If you need several steps in order, use a [Workflow Agent](using-workflow-agents.md) instead.

## When to use one

Use a Task Agent when the whole job fits in **one AI conversation**:

- Review a pull request
- Write a single file or function
- Answer a research question
- Refactor one module

If the job naturally breaks into “first do X, then Y, then Z,” consider a workflow instead.

## What you need

| Piece | What it does |
| ----- | ------------ |
| **AGENT.md** | Describes the agent: name, tools, prompt template, and parameter declarations |
| **An engine** | The AI backend (for example `claude` or `cursor`) |
| **A runner** | The process that receives work and runs agents |
| **A work item** | A message that says “run this agent now” with the right settings |

## Step 1 — Write an AGENT.md file

An agent is defined in a markdown file with a small header block at the top. The header uses YAML; the rest of the file is the prompt.

```markdown
---
name: reviewer
description: Reviews code and leaves helpful feedback
tools: []
template:
  parameters:
    user_prompt: string
---

Review the code carefully. Focus on bugs, readability, and tests.

{{user_prompt}}
```

**Header fields:**

| Field | Required | Meaning |
| ----- | -------- | ------- |
| `name` | Yes | Short name for the agent |
| `description` | Yes | One-line summary of what it does |
| `tools` | Yes | Tools the AI may use (can be an empty list `[]`) |
| `template.parameters` | No | Declares inputs the prompt can use (see below) |
| `model` | No | Which model to use (engine-specific) |

**Prompt body:** Write the instructions the AI should follow. Use `{{parameterName}}` placeholders for values that will come from work item `state` once [template rendering is implemented](https://github.com/devzeebo/bifrost/issues/56).

**Parameters:** Each entry in `template.parameters` is a name and type. Parameters **without** a `?` suffix will be required in work item `state` at run time. A `?` suffix marks a parameter as optional (for example `phrase: string?`). Parameter declaration and validation are parsed today; substitution into the prompt is not implemented yet.

```yaml
template:
  parameters:
    user_prompt: string    # required in state (once rendering lands)
    phrase: string?        # optional
```

## Step 2 — Register the agent on your runner

In your runner setup file, import the Task Agent helpers, register at least one engine, then register your agent by name:

```typescript
import { Runner, createDataRegistry } from "@bifrost-ai/runner";
import "@bifrost-ai/agent-3-task/augment";
import { loadAgent, taskAgentDataGuards } from "@bifrost-ai/agent-3-task";
import { CursorEngine } from "@bifrost-ai/engine-cursor";

const runner = new Runner({ data: createDataRegistry(taskAgentDataGuards) });

runner.registerEngine("cursor", new CursorEngine());
runner.registerTaskAgent("reviewer", await loadAgent("./agents/reviewer/AGENT.md"));

await runner.start();
```

Important details:

- `registerTaskAgent("reviewer", ...)` registers a script looked up by **`name`**, not `kind`.
- The first argument must match the work item's `name` field when the job is dispatched.
- The agent definition is loaded at registration time, not on each dispatch.
- You must register an engine before dispatching work. The work item says which engine to use.

See [examples/lvl4/runner.ts](../examples/lvl4/runner.ts) for a full example.

## Step 3 — Send it work

When the orchestrator dispatches a work item to the runner, the Task Agent expects these fields in `state`:

| Field | Required | Meaning |
| ----- | -------- | ------- |
| `workingDir` | Yes | Folder where the AI should work |
| `instructions` | Yes | What to do this time (often copied from a task description) |
| `engineName` | Yes | Which registered engine to use (for example `"cursor"`) |
| `sessionId` | No | Resume a previous conversation instead of starting fresh |

Any **required** `template.parameters` from your AGENT.md should also appear in `state` once template rendering is implemented. Optional parameters (declared with `?`) can be omitted.

The runner looks up the script by **`name`**. With Bifrost runes, `kind` is typically `"task"` and `name` is the agent name from the `agent:<name>` tag.

Example work item (simplified):

```typescript
{
  workItemId: "task-1",
  kind: "task",
  name: "reviewer",        // must match registerTaskAgent name
  state: {
    workingDir: "/path/to/repo",
    instructions: "Review the login changes in PR #42",
    engineName: "cursor",
    user_prompt: "Focus on the auth module",
  },
}
```

If you use Bifrost runes as your work item source, a **mapper** can copy rune fields into this shape. See [examples/lvl4/mappers/map-task-work-item.ts](../examples/lvl4/mappers/map-task-work-item.ts).

## What happens when it runs

In plain terms:

1. The runner picks up the work item and finds the script by `name`.
2. The Task Agent calls the registered engine with the agent definition and work item state.
3. The engine runs the AI conversation (possibly across several back-and-forth turns).
4. When the engine finishes, runner conventions mark the work item complete — or failed if something went wrong.

The Task Agent does not pause and wait for you. It runs start to finish in one go.

## Quick checklist

- [ ] AGENT.md has `name`, `description`, `tools`, and a prompt body
- [ ] Every `{{token}}` in the prompt is declared in `template.parameters`
- [ ] Runner calls `registerEngine` for the engine you plan to use
- [ ] Runner calls `registerTaskAgent` with the same name as the work item `name`
- [ ] Work item `state` includes `workingDir`, `instructions`, and `engineName`

## Related

- [Task Agent lifecycle](agent-3-task.md) — what happens inside during a run
- [Using Workflow Agents](using-workflow-agents.md) — chaining multiple Task Agents
- [Runner](runner.md) — runner setup, config, and script stack
- [Root README](../README.md) — orchestrator and runner quick start
