# 20250624-011. Task State Validation System

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Agents declare expected parameters via `template.parameters` schema. Hooks modify task state dynamically. Framework needs to validate task state against agent schema before engine execution. Missing or invalid parameters should cause task failure, not runtime errors in prompts.

## Decision

Schema validation system via `validateTaskState()`. Called after Start hooks, before prompt rendering. Required parameters (no `?` suffix) must exist. Optional parameters (with `?` suffix) may be missing. Recursive validation for nested objects.

```typescript
export const validateTaskState = (
  taskState: Record<string, unknown>,
  schema: Record<string, unknown>,
): ValidationResult => {
  const errors: string[] = [];

  // Validate each top-level schema parameter
  for (const [key, schemaNode] of Object.entries(schema)) {
    const isOptional = key.endsWith("?");
    const baseKey = isOptional ? key.slice(0, -1) : key;

    const value = taskState[baseKey] ?? taskState[key];

    if (value === undefined || value === null || value === "") {
      if (!isOptional) {
        errors.push(`Missing required parameter: ${baseKey}`);
      }
    } else {
      validateValue(value, schemaNode, baseKey);
    }
  }

  return { valid: errors.length === 0, errors };
};
```

**Schema rules:**

- Required parameters: key without `?` suffix (e.g., `prNumber`)
- Optional parameters: key with `?` suffix (e.g., `baselineData?`)
- Nested objects: recursive validation
- Built-in values excluded: `taskId`, `metadata`, `taskState`

## Consequences

**Positive:**

- Catch missing parameters before engine execution
- Clear error messages for missing fields
- Optional parameters supported via `?` suffix
- Recursive validation for nested schemas
- Early failure (saves LLM cost)

**Negative:**

- Schema structure implicit (no Zod/JSON Schema)
- No type validation (only existence checks)
- Validation happens at runtime, not build time
- Schema changes require updating all agents

## Changelog

- Implement task state validation system with schema-based parameter checking
