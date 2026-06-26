# 20250624-010. Monorepo Package Structure

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Framework has multiple concerns: engine interfaces, task source interfaces, orchestrator core, concrete implementations. Need clear separation while maintaining type safety and build efficiency.

## Decision

Monorepo with npm workspaces. Core interfaces separate from implementations. Each implementation depends only on interfaces, not other implementations.

```
packages/
├── engine/                    # Core Engine interface
├── task-source/              # Core TaskSource interface
├── orchestrator/             # Core orchestration logic
├── engine-claude-code/        # Claude Code engine impl
├── engine-devin-cli/          # Devin CLI engine impl
├── task-source-memory/        # In-memory task source
└── task-source-bifrost/       # Bifrost API task source
```

**Dependency graph:**

```mermaid
graph TD
    Orchestrator[orchestrator] --> Engine[engine]
    Orchestrator --> TaskSource[task-source]
    Engine --> ClaudeCode[engine-claude-code]
    Engine --> DevinCLI[engine-devin-cli]
    TaskSource --> Memory[task-source-memory]
    TaskSource --> Bifrost[task-source-bifrost]

    style Orchestrator fill:#e1f5ff
    style Engine fill:#f0f0f0
    style TaskSource fill:#f0f0f0
    style ClaudeCode fill:#e8f5e9
    style DevinCLI fill:#e8f5e9
    style Memory fill:#fff9c4
    style Bifrost fill:#fff9c4
```

## Consequences

**Positive:**

- Clear separation of concerns
- Interface stability enforced (interfaces don't depend on impls)
- Independent versioning possible
- Easy to add new implementations
- Type safety across workspace
- npm workspaces for local linking

**Negative:**

- Build complexity (workspaces, linking)
- Package interdependencies can be confusing
- Publishing requires multiple packages
- Circular dependencies risk

## Changelog

- Organize as monorepo with npm workspaces for clear separation of interfaces and implementations
