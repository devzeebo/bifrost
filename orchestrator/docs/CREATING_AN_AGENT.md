# Creating an Agent

This guide shows how to create a new agent in the Bifrost Orchestrator by walking through the structure and patterns used in existing agents like `@agents/bdd-red`.

## TL;DR

- **Agent = Definition + Lifecycle Hooks**: Create an `AGENT.md` with metadata/prompt, then register hooks in `index.ts`
- **Three files minimum**: `AGENT.md` (agent spec), `index.ts` (factory), `package.json` (metadata)
- **Hooks run before/after execution**: Start hooks prepare context, Stop hooks validate results
- **Use `loadAgent()`**: Parses AGENT.md into an `AgentDefinition` you can extend with hooks
- **Factory pattern**: Export `create[AgentName]Agent()` async function returning `AgentDefinition`

## Table of Contents

  - [Agent Anatomy](L41-L65)
  - [Step 1: Create AGENT.md](L66-L82)
- [Agent Name](L83-L355)
  - [Your Purpose](L87-L90)
  - [Core Principles](L91-L95)
  - [Workflow](L96-L110)
    - [Step 1 - Do this](L98-L100)
    - [Step 2 - Do that](L101-L110)
  - [Step 2: Create Factory Function](L111-L141)
  - [Step 3: Implement Hooks (Optional)](L142-L167)
    - [Start Hooks](L146-L167)
  - [Setup Results](L168-L218)
    - [Stop Hooks](L178-L218)
  - [Step 4: Configure Package.json](L219-L236)
  - [Step 5: Register Agent](L237-L242)
  - [Common Patterns](L243-L250)
    - [Modifying Agent Instructions](L245-L250)
  - [Current Inventory](L251-L300)
    - [State Between Hooks](L257-L269)
    - [Tool Permissions](L270-L287)
    - [Follow-up Loops](L288-L300)
  - [Testing Agents](L301-L321)
  - [Example: Complete Agent](L322-L355)
- [BDD Red Phase Agent](L356-L367)
  - [Further Reading](L362-L367)

## Agent Anatomy

An agent in Bifrost Orchestrator consists of:

1. **AGENT.md** - Frontmatter metadata + markdown prompt (the agent's "brain")
2. **index.ts** - Factory function that loads the definition and registers hooks
3. **hooks/** - Optional lifecycle hooks (Start.d/ and Stop.d/)
4. **lib/** - Optional helper libraries

```
my-agent/
├── src/
│   ├── index.ts           # factory function
│   ├── AGENT.md           # agent definition
│   ├── hooks/
│   │   ├── Start.d/
│   │   │   └── setup.ts
│   │   └── Stop.d/
│   │       └── validate.ts
│   └── lib/
│       └── helpers.ts
├── package.json
└── tsconfig.json
```

## Step 1: Create AGENT.md

The AGENT.md file defines your agent's identity, capabilities, and instructions. It uses YAML frontmatter for metadata and markdown for the prompt.

```yaml
---
model: sonnet                    # Claude model to use
name: my-agent                   # Agent identifier
description: What this agent does
tools:                           # Allowed tools (glob patterns supported)
  - Read(./**)
  - Edit(*.ts)
  - Write(*.ts)
  - Glob(./**)
  - Grep(./**)
---

# Agent Name

You are a specialized agent that...

## Your Purpose

Describe what this agent accomplishes.

## Core Principles

1. First principle
2. Second principle

## Workflow

### Step 1 - Do this
...

### Step 2 - Do that
...
```

**Key frontmatter fields:**
- `model`: Claude model (`sonnet`, `opus`, `haiku`)
- `name`: Agent identifier
- `description`: One-line summary
- `tools`: Whitelist of allowed tools (glob patterns like `Read(./**)`, `Edit(*.ts)`)

## Step 2: Create Factory Function

Export an async function that loads the agent definition and registers hooks:

```typescript
// src/index.ts
import { AgentDefinition, loadAgent } from "@bifrost-ai/orchestrator";
import { startHook_setup } from "./hooks/Start.d/setup";
import { stopHook_validate } from "./hooks/Stop.d/validate";
import AGENT_MD from "./AGENT.md?raw";

export const createMyAgent = async (): Promise<AgentDefinition> => {
  const agent: AgentDefinition = await loadAgent(AGENT_MD);

  // Register Start hooks (run before agent execution)
  agent.hooks.Start.push({ name: "setup", fn: startHook_setup });

  // Register Stop hooks (run after agent execution)
  agent.hooks.Stop.push({ name: "validate", fn: stopHook_validate });

  return agent;
};
```

**Pattern:**
1. Import `loadAgent` and hook functions
2. Import AGENT.md with `?raw` suffix (Vite feature)
3. Call `loadAgent()` to parse the markdown
4. Push hooks onto `agent.hooks.Start` or `agent.hooks.Stop`
5. Return the agent definition

## Step 3: Implement Hooks (Optional)

Hooks inject logic into the agent lifecycle. They receive execution context and can modify state or return outcomes.

### Start Hooks

Run before the agent executes. Use for setup, data collection, or context injection.

```typescript
// src/hooks/Start.d/setup.ts
import { HookExecutionContext, HookFn } from "@bifrost-ai/orchestrator";

export const startHook_setup: HookFn = async ({
  context,
  setTaskState,
}: HookExecutionContext) => {
  const { projectDir } = context;

  // Collect data or run setup logic
  const data = await someSetupFunction(projectDir);

  // Store data for later hooks
  await setTaskState({ baselineData: data });

  // Inject context into the agent's prompt
  context.instructions += `
## Setup Results

Found ${data.length} items to process.
`;

  // Return outcome (success | follow-up | abort)
  return { outcome: "success" };
};
```

### Stop Hooks

Run after the agent executes. Use for validation, verification, or follow-up logic.

```typescript
// src/hooks/Stop.d/validate.ts
import { HookExecutionContext, HookFn } from "@bifrost-ai/orchestrator";

export const stopHook_validate: HookFn = async ({
  context: { projectDir },
  getTaskState,
}: HookExecutionContext) => {
  // Retrieve state from Start hooks
  const state = getTaskState();
  const baseline = state.baselineData ?? [];

  // Run validation logic
  const result = await validateResults(projectDir, baseline);

  if (!result.isValid) {
    return {
      outcome: "follow-up",
      message: `Validation failed: ${result.reason}`,
    };
  }

  return { outcome: "success" };
};
```

**Hook outcomes:**
- `success`: Proceed to next phase
- `follow-up`: Agent needs another attempt (message shown to agent)
- `abort`: Stop execution with error

**Hook context:**
- `context.projectDir`: Working directory
- `context.instructions`: Agent prompt (mutable, append to add context)
- `setTaskState(data)`: Store data for later hooks
- `getTaskState()`: Retrieve data from prior hooks

## Step 4: Configure Package.json

Add metadata and ensure proper module setup:

```json
{
  "name": "@agents/my-agent",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@bifrost-ai/orchestrator": "workspace:*"
  }
}
```

## Step 5: Register Agent

Add your agent to the orchestrator's agent registry so it can be dispatched to tasks.

**Pattern varies by registration method** - consult your orchestrator configuration for where agents are registered.

## Common Patterns

### Modifying Agent Instructions

Hooks can append to `context.instructions` to inject dynamic data into the agent's prompt:

```typescript
context.instructions += `
## Current Inventory

${items.map(item => `- ${item.name}: ${item.count}`).join("\n")}
`;
```

### State Between Hooks

Use `setTaskState()` in Start hooks and `getTaskState()` in Stop hooks:

```typescript
// Start hook
await setTaskState({ baseline: [1, 2, 3] });

// Stop hook
const state = getTaskState();
const baseline = state.baseline ?? [];
```

### Tool Permissions

Specify tools in AGENT.md frontmatter using glob patterns:

```yaml
tools:
  - Read(./**)                  # Read anything in working directory
  - Edit(*.ts)                   # Edit TypeScript files
  - Edit(*.tsx)
  - Write(*.spec.ts)            # Write test files
  - Glob(./**)
  - Grep(./**)
  - Search(./**)
  - LSP                         # Language server features
  - mcp__context7__*            # All context7 MCP tools
  - mcp__devzeebo_node__*       # All devzeebo node MCP tools
```

### Follow-up Loops

Stop hooks can trigger follow-up loops by returning `outcome: "follow-up"`:

```typescript
if (!hasNewFailingTests) {
  return {
    outcome: "follow-up",
    message: "No new failing tests found. Add at least one failing test.",
  };
}
```

## Testing Agents

Test your agent hooks independently:

```typescript
// src/hooks/Start.d/setup.spec.ts
import { describe, it, expect } from "vitest";
import { startHook_setup } from "./setup";

describe("startHook_setup", () => {
  it("should collect baseline data", async () => {
    const result = await startHook_setup({
      context: { projectDir: "/tmp" },
      setTaskState: async (data) => {},
    });

    expect(result.outcome).toBe("success");
  });
});
```

## Example: Complete Agent

Based on the `@agents/bdd-red` pattern:

```typescript
// src/index.ts
import { AgentDefinition, loadAgent } from "@bifrost-ai/orchestrator";
import { startHook_collectTests } from "./hooks/Start.d/collect-tests";
import { stopHook_checkTests } from "./hooks/Stop.d/check-tests";
import AGENT_MD from "./AGENT.md?raw";

export const createBddRedAgent = async (): Promise<AgentDefinition> => {
  const agent: AgentDefinition = await loadAgent(AGENT_MD);

  agent.hooks.Start.push({ name: "collectTests", fn: startHook_collectTests });
  agent.hooks.Stop.push({ name: "checkTests", fn: stopHook_checkTests });

  return agent;
};
```

```yaml
---
model: sonnet
name: bdd-red
description: Runs the BDD Red phase - writes failing tests that specify desired behavior
tools:
  - Read(./**)
  - Edit(*.spec.ts)
  - Write(*.spec.ts)
  - Glob(./**)
  - Grep(./**)
---

# BDD Red Phase Agent

You execute the **Red** phase of the BDD cycle. Write failing tests that specify desired behavior.
...
```

## Further Reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Orchestrator architecture and hook system
- [PATTERNS.md](./PATTERNS.md) - Common patterns in the codebase
- [CODING_STANDARDS.md](./CODING_STANDARDS.md) - TypeScript conventions and style
