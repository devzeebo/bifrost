# ATIF — Agent Trajectory Interchange Format

ATIF is a JSON specification for logging the complete interaction history of autonomous LLM agents. It is designed to unify the data requirements of debugging, visualization, supervised fine-tuning (SFT), and reinforcement-learning (RL) pipelines.

ATIF lives in the `@atif` scope and is **a standalone concern** — it is not imported by any `@bifrost-ai/*` runtime package. The orchestrator may produce or consume ATIF files at runtime, but there is no code dependency between them.

> Specification reference: `atif/atif-1-7.md` (v1.7, April 2026).

## Packages

| Package       | Scope   | Role                                |
| ------------- | ------- | ----------------------------------- |
| `core`        | `@atif` | ATIF trajectory types + type guards |
| `claude-code` | `@atif` | Claude Code JSONL → ATIF converter  |

### `@atif/core`

Type-only package. Exports the schema types and a set of type-guard utilities:

- **Schema types:** `StepSource`, `ContentPartType`, `ImageMediaType`, `ContextManagementType`, `ContextManagementBoundary`, `ImageSourceSchema`, `ContentPartSchema`, `ExtraMetadata`, `AgentSchema`, `MetricsSchema`, `FinalMetricsSchema`, `SubagentTrajectoryRefSchema`, `ObservationResultSchema`, `ObservationSchema`, `ToolCallSchema`, `ContextManagement`, `StepObject`, `Trajectory`.
- **Type guards:** `isMultimodalContent`, `isImageContentPart`, `isTextContentPart`, `hasMultimodalContent`, `isDeterministicDispatch`, `shouldFilterFromSFT`, `isContextBoundary`.

### `@atif/claude-code`

Converts **Claude Code JSONL conversation logs** into **ATIF `Trajectory`** objects.

Modules:

| File           | Responsibility                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `parser.ts`    | `parseJsonlStream(stream)` / `parseJsonlString(str)` → `JsonlEntry[]`                                                      |
| `types.ts`     | `JsonlEntry` union (`UserEntry`, `AssistantEntry`, …) + `ContentBlock` + type guards                                       |
| `converter.ts` | `convertEntriesToTrajectory(entries, options)` → `Trajectory`; `groupEntries`, `extractSessionMetadata`, `buildTrajectory` |
| `steps.ts`     | `buildUserStep`, `buildAgentStep`, `extractToolCalls`, `buildObservation`, `convertMessageContent`                         |
| `subagents.ts` | `detectAgentCalls`, `extractSubagentRefs`, `extractSubagentTrajectories`                                                   |
| `metrics.ts`   | `extractMetrics`, `aggregateMetrics`, `calculateCost`                                                                      |

## Conversion Pipeline

```
JSONL stream
  → parseJsonlStream        → JsonlEntry[]
  → groupEntries            → EntryGroup[]
  → buildTrajectory         → Trajectory
      ├─ steps      (buildUserStep / buildAgentStep)
      ├─ metrics    (extractMetrics / aggregateMetrics)
      └─ subagents  (extractSubagentRefs)
```

`ConversionOptions` controls inclusion/exclusion of system steps, attachments, and subagent references (strategy over the same input).

## Patterns

### Pipeline

`converter.ts` chains parse → group → build, each stage feeding the next with no cross-stage barrier.

### Builder

`steps.ts` assembles complex `StepObject`s from parts with multiple optional fields (`buildUserStep`, `buildAgentStep`).

### Type guards

`types.ts` provides discriminator functions (`isUserEntry`, `isAssistantEntry`, `isAttachmentEntry`, `isSystemEntry`, `isMetadataEntry`, `isToolUseBlock`, `isToolResultBlock`, `isTextBlock`, `isToolResultEntry`) for safe narrowing over the `JsonlEntry` / `ContentBlock` union types.

## Relationship to the Orchestrator

None at the code level. `@atif/*` imports only `@atif/core`; no `@bifrost-ai/*` package imports `@atif/*`. The two concerns are decoupled: the orchestrator runs agents, ATIF describes their trajectories.

Back to the main docs: [../ARCHITECTURE.md](../ARCHITECTURE.md).
