# 20250624-016. Model Selection Pattern

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Different agents require different Claude models (Sonnet for coding, Opus for complex reasoning, Haiku for fast tasks). Framework needs to support per-agent model selection without hardcoding. Engine implementations must receive model specification from agent definition.

## Decision

Optional `model` field in AgentDefinition frontmatter. Parsed from AGENT.md YAML. Passed to engine in EngineContext. Engine resolves model to concrete implementation (e.g., "sonnet" → "claude-sonnet-4-6"). Falls back to engine default if unspecified.

```typescript
// AGENT.md frontmatter
---
model: sonnet
name: code-review-agent
---

// AgentDefinition
export type AgentDefinition = {
  model?: string;  // Optional model identifier
  // ...
};

// EngineContext receives model
export type EngineContext = {
  agent: AgentDefinition;  // Contains model field
  // ...
};

// Engine resolves model
const modelId = resolveModel(context.agent.model ?? "default");
```

## Consequences

**Positive:**

- Per-agent model selection
- Model specified in AGENT.md (single source of truth)
- Engine handles model resolution
- Optional (falls back to engine default)

**Negative:**

- Model naming convention not enforced
- No model capability validation
- Engine-specific model names (not portable across engines)
- No model alias/alias resolution

## Changelog

- Implement model selection pattern via optional AgentDefinition.model field
