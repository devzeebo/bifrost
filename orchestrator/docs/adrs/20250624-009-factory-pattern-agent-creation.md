# 20250624-009. Factory Pattern for Agent Creation

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Agents need consistent loading pattern. AGENT.md files contain metadata (frontmatter) and prompt (markdown). Framework needs structured way to parse, validate, and extend agent definitions.

## Decision

Factory pattern with `loadAgent()` helper. Each agent package exports `createXAgent()` async function that loads AGENT.md, parses frontmatter/prompt, registers hooks, returns AgentDefinition.

**Frontmatter constraints:**

- **Static**: Frontmatter fields cannot be templated. Only `promptBody` supports Handlebars.
- **Required fields**: `name`, `description`, `tools`
- **Optional fields**: `model`, `template.parameters`
- **Validation**: Used Handlebars tokens must be declared in `template.parameters` (built-in: `taskId`, `metadata`, `taskState`)

```typescript
// Agent package structure
my-agent/
├── src/
│   ├── index.ts           # Factory function
│   ├── AGENT.md           # Definition
│   └── hooks/
│       ├── Start.d/
│       └── Stop.d/

// Factory function
export const createMyAgent = async (): Promise<AgentDefinition> => {
  const agent: AgentDefinition = await loadAgent(AGENT_MD);

  agent.hooks.Start.push({ name: "setup", fn: startHook_setup });
  agent.hooks.Stop.push({ name: "validate", fn: stopHook_validate });

  return agent;
};

// AGENT.md with frontmatter (static, not templated)
---
model: sonnet
name: my-agent
description: What this agent does
tools:
  - Read(./**)
  - Edit(*.ts)
template:
  parameters:
    baselineData?: object[]
    prNumber?: string
---
# Agent Prompt (templated)

You are working on PR #{{prNumber}}.

Baseline data: {{baselineData.length}} items found.
```

**Validation rules:**

- All Handlebars tokens in `promptBody` must be declared in `template.parameters`
- Built-in tokens allowed without declaration: `taskId`, `metadata`, `taskState`
- Optional parameters end with `?` (e.g., `prNumber?`)
- Nested paths supported: `context.prDescription` requires `context` or `context?`

## Consequences

**Positive:**

- Consistent agent loading pattern
- AGENT.md as single source of truth
- Hooks registered after loading
- Extensible (add fields to frontmatter)
- Async factory allows complex initialization
- Template validation catches undeclared tokens

**Negative:**

- Frontmatter static (no templating support)
- Requires Vite `?raw` import for AGENT.md
- Frontmatter errors caught at runtime
- Factory naming convention not enforced
- No built-in agent validation beyond required fields
- Cannot dynamically generate tools/description based on context

## Changelog

- Implement factory pattern for agent creation with AGENT.md frontmatter parsing and validation
