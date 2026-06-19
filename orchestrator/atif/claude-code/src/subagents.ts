/**
 * Sub-agent trajectory extraction and reference building
 * Handles detection of Agent tool calls and creation of trajectory references
 */

import type { SubagentTrajectoryRefSchema, Trajectory } from "@atif/core";
import {
  type AssistantEntry,
  type JsonlEntry,
  type UserEntry,
  isAssistantEntry,
  isToolResultEntry,
  isUserEntry,
} from "./types.js";

/**
 * Detect Agent tool calls in assistant entries
 */
export const detectAgentCalls = (
  entries: JsonlEntry[],
): {
  assistantEntry: AssistantEntry;
  toolCallId: string;
  subagentType: string;
  prompt: string;
}[] => {
  const agentCalls: {
    assistantEntry: AssistantEntry;
    toolCallId: string;
    subagentType: string;
    prompt: string;
  }[] = [];

  for (const entry of entries) {
    if (isAssistantEntry(entry)) {
      const toolUses = entry.message.content.filter((block) => block.type === "tool_use");

      for (const toolUse of toolUses) {
        if (toolUse.type === "tool_use" && toolUse.name === "Agent") {
          const input = toolUse.input as {
            subagent_type?: string;
            prompt?: string;
          };

          if (input.subagent_type && input.prompt) {
            agentCalls.push({
              assistantEntry: entry,
              toolCallId: toolUse.id,
              subagentType: input.subagent_type,
              prompt: input.prompt,
            });
          }
        }
      }
    }
  }

  return agentCalls;
};

/**
 * Find tool result entries for a specific tool call
 */
const findToolResults = (toolCallId: string, entries: JsonlEntry[]): UserEntry[] => {
  const results: UserEntry[] = [];

  for (const entry of entries) {
    if (isUserEntry(entry) && isToolResultEntry(entry)) {
      const resultBlocks = entry.message.content.filter((block) => block.type === "tool_result");

      for (const resultBlock of resultBlocks) {
        if (resultBlock.type === "tool_result" && resultBlock.tool_use_id === toolCallId) {
          results.push(entry);
          break;
        }
      }
    }
  }

  return results;
};

/**
 * Extract sub-agent trajectory references from entries
 */
export const extractSubagentRefs = (entries: JsonlEntry[]): SubagentTrajectoryRefSchema[] => {
  const refs: SubagentTrajectoryRefSchema[] = [];
  const agentCalls = detectAgentCalls(entries);

  for (const agentCall of agentCalls) {
    const toolResults = findToolResults(agentCall.toolCallId, entries);

    for (const result of toolResults) {
      if (result.toolUseResult) {
        const ref: SubagentTrajectoryRefSchema = {
          trajectory_id: undefined,
          trajectory_path: undefined,
          session_id: result.toolUseResult.agentId,
          extra: {
            agentType: result.toolUseResult.agentType,
            status: result.toolUseResult.status,
            totalDurationMs: result.toolUseResult.totalDurationMs,
            totalTokens: result.toolUseResult.totalTokens,
            totalToolUseCount: result.toolUseResult.totalToolUseCount,
          },
        };

        refs.push(ref);
      }
    }
  }

  return refs;
};

/**
 * Extract sub-agent trajectories (placeholder for future implementation)
 *
 * Note: Full recursive extraction requires Claude Code to export embedded
 * subagent trajectories as separate files or within the main JSONL.
 * Currently, this creates placeholder references only.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const extractSubagentTrajectories = (entries: JsonlEntry[]): Trajectory[] =>
  // TODO: Implement full recursive extraction when Claude Code adds
  // embedded trajectory export capability
  [];
