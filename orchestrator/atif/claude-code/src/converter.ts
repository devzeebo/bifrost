/**
 * Core conversion logic from JSONL entries to ATIF trajectory
 * Handles grouping, conversion, and trajectory assembly
 */

import type { Trajectory, StepObject, AgentSchema, ExtraMetadata } from "@atif/core";
import {
  type AssistantEntry,
  type ConversionOptions,
  type EntryGroup,
  type JsonlEntry,
  type SessionMetadata,
  isAssistantEntry,
  isToolResultEntry,
  isUserEntry,
} from "./types.js";
import { buildUserStep, buildAgentStep } from "./steps.js";
import { aggregateMetrics } from "./metrics.js";

/**
 * Default conversion options
 */
const DEFAULT_OPTIONS: ConversionOptions = {
  includeSystemSteps: false,
  includeAttachments: false,
  extractSubagents: true,
  metadataStrategy: "include",
};

/**
 * Group related entries together (assistant + tool results)
 */
export const groupEntries = (entries: JsonlEntry[]): EntryGroup[] => {
  const groups: EntryGroup[] = [];
  const pendingToolCalls = new Map<string, EntryGroup>();

  for (const entry of entries) {
    if (isUserEntry(entry)) {
      // Check if this is a tool result for a pending agent step
      if (isToolResultEntry(entry)) {
        const toolResults = entry.message.content;
        if (toolResults.length > 0) {
          const firstResult = toolResults[0] as { tool_use_id?: string };
          if (firstResult.tool_use_id) {
            const pendingGroup = pendingToolCalls.get(firstResult.tool_use_id);
            if (pendingGroup) {
              // This is a tool result, add it to the pending group
              // For now, we'll handle this in convertGroupToStep
              // by linking via tool_use_id
            }
          }
        }
      }

      // Standalone user message (not a tool result)
      const group: EntryGroup = {
        mainEntry: entry,
        toolResults: [],
        attachments: [],
      };
      groups.push(group);
    } else if (isAssistantEntry(entry)) {
      // Check if this assistant entry has tool calls
      const hasToolCalls = entry.message.content.some((block) => block.type === "tool_use");

      if (hasToolCalls) {
        const group: EntryGroup = {
          mainEntry: entry,
          toolResults: [],
          attachments: [],
        };
        groups.push(group);

        // Register pending tool calls for this group
        const toolCalls = entry.message.content.filter((block) => block.type === "tool_use");
        for (const toolCall of toolCalls) {
          pendingToolCalls.set((toolCall as { id: string }).id, group);
        }
      } else {
        // Assistant message without tool calls - standalone
        const group: EntryGroup = {
          mainEntry: entry,
          toolResults: [],
          attachments: [],
        };
        groups.push(group);
      }
    }
  }

  return groups;
};

/**
 * Extract session metadata from JSONL entries
 */
export const extractSessionMetadata = (entries: JsonlEntry[]): SessionMetadata => {
  if (entries.length === 0) {
    return {
      sessionId: "unknown",
      version: "unknown",
      totalEntries: 0,
    };
  }

  const firstEntry = entries[0] as {
    sessionId: string;
    version: string;
    timestamp: string;
    cwd?: string;
    gitBranch?: string;
  };

  const lastEntry = entries[entries.length - 1] as { timestamp: string };

  // Find first assistant entry to get model name
  const model: string | undefined = entries
    .filter((entry): entry is AssistantEntry => entry.type === "assistant")
    .map((entry) => entry.message.model as string)
    .find(Boolean);

  return {
    sessionId: firstEntry.sessionId,
    version: firstEntry.version,
    startTime: firstEntry.timestamp,
    endTime: lastEntry.timestamp,
    cwd: firstEntry.cwd,
    gitBranch: firstEntry.gitBranch,
    model,
    totalEntries: entries.length,
  };
};

/**
 * Build the final ATIF trajectory from grouped entries
 */
export const buildTrajectory = (
  groups: EntryGroup[],
  sessionMetadata: SessionMetadata,
  options: ConversionOptions,
): Trajectory => {
  const steps: StepObject[] = [];
  let stepId = 1;

  // Convert each group to a step
  for (const group of groups) {
    if (isUserEntry(group.mainEntry)) {
      const step = buildUserStep(group.mainEntry, stepId, options);
      steps.push(step);
      stepId += 1;
    } else if (isAssistantEntry(group.mainEntry)) {
      const step = buildAgentStep({
        entry: group.mainEntry,
        toolResults: group.toolResults,
        stepId,
        options,
      });
      steps.push(step);
      stepId += 1;
    }
  }

  // Build agent schema
  const agent: AgentSchema = {
    name: "claude-code",
    version: sessionMetadata.version,
    model_name: sessionMetadata.model,
  };

  // Aggregate metrics
  const finalMetrics = aggregateMetrics(steps);

  // Build extra metadata
  const extra: ExtraMetadata = {};
  if (options.metadataStrategy === "include") {
    extra.sessionMetadata = {
      sessionId: sessionMetadata.sessionId,
      startTime: sessionMetadata.startTime,
      endTime: sessionMetadata.endTime,
      cwd: sessionMetadata.cwd,
      gitBranch: sessionMetadata.gitBranch,
      totalEntries: sessionMetadata.totalEntries,
    };
  }

  // Build trajectory
  const trajectory: Trajectory = {
    schema_version: "ATIF-v1.7",
    session_id: sessionMetadata.sessionId,
    agent,
    steps,
    final_metrics: finalMetrics,
    notes: `Converted from Claude Code JSONL with ${sessionMetadata.totalEntries} entries`,
    extra: Object.keys(extra).length > 0 ? extra : undefined,
  };

  return trajectory;
};

/**
 * Main conversion function - JSONL entries to ATIF trajectory
 */
export const convertEntriesToTrajectory = (
  entries: JsonlEntry[],
  options?: Partial<ConversionOptions>,
): Trajectory => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Extract session metadata
  const sessionMetadata = extractSessionMetadata(entries);

  // Group related entries
  const groups = groupEntries(entries);

  // Build trajectory
  const trajectory = buildTrajectory(groups, sessionMetadata, mergedOptions);

  return trajectory;
};
