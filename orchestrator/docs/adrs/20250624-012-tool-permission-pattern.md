# 20250624-012. Tool Permission Pattern

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Agents need access to specific tools (Read, Edit, Write, etc.) but should be restricted to prevent accidental damage. Framework needs fine-grained tool control. Some agents need broad access (Read all files), others need narrow (Edit only \*.ts files). Some tools should be explicitly denied even if broadly allowed.

## Decision

Tool specification via string or object patterns. String patterns use glob syntax. Object patterns specify `name`, `allow` list, `deny` list. Deny overrides allow. Tools passed to engine for permission enforcement.

```typescript
export type AgentTool =
  | string // Glob pattern: "Read(./**)", "Edit(*.ts)"
  | {
      name: string; // Tool name: "Read", "Edit"
      allow?: string[]; // Allow list: ["./src/**", "*.md"]
      deny?: string[]; // Deny list (overrides allow): ["*.config.ts"]
    };

// Agent definition
export type AgentDefinition = {
  tools: AgentTool[];
  // ...
};

// Examples
tools: [
  "Read(./**)", // Allow reading everything
  "Edit(*.ts)", // Allow editing .ts files
  {
    name: "Write",
    allow: ["./src/**/*.ts"],
    deny: ["*.config.ts"], // Can write to src but not config files
  },
];
```

## Consequences

**Positive:**

- Fine-grained tool control
- Glob patterns for familiar file matching
- Allow/deny lists for complex permissions
- Deny overrides allow (defense-in-depth)
- Engine enforces permissions

**Negative:**

- Pattern syntax inconsistency (string vs object)
- No permission testing/before execution validation
- Tool name extraction from string patterns is fragile
- No wildcard exclusions (must use deny list)

## Changelog

- Implement tool permission pattern with glob patterns and allow/deny lists
