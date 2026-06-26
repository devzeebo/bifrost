# 20250624-005. Template-Based Prompt Rendering

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Agent prompts need dynamic content injection. Examples: taskId, taskState values, metadata fields. Hardcoding prompt content limits reusability. Framework needs structured template system.

## Decision

Use Handlebars for prompt templates. Agent definition includes `template.parameters` (schema) and `promptBody` (template). Orchestrator renders template with context data before engine execution.

```typescript
export type Template = {
  parameters: Record<string, unknown>; // Schema for validation
};

export type AgentDefinition = {
  template: Template;
  promptBody: string; // Handlebars template
  // ...
};

// Rendering (via handlebars-renderer.ts)
const renderedPrompt = renderPrompt(agent.promptBody, {
  taskId: task.id,
  metadata: task.metadata,
  taskState: currentTaskState,
});
```

## Consequences

**Positive:**

- Dynamic prompt content without code changes
- Reusable agents across different contexts
- Template syntax familiar to many developers
- Validation via template.parameters schema
- Access to taskId, metadata, taskState

**Negative:**

- Handlebars escaping can cause issues
- Template errors caught at runtime (engine time)
- Limited to Handlebars features (no custom helpers initially)
- Complex templates become hard to read

## Changelog

- Implement Handlebars-based prompt rendering with template parameter validation
