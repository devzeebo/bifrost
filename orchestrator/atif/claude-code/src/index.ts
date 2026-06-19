/**
 * Claude Code JSONL to ATIF Converter
 *
 * Main entry point for converting Claude Code conversation logs
 * from JSONL format to ATIF (Agent Trajectory Interchange Format) v1.7
 */

import type { Readable } from "stream";
import type { Trajectory } from "@atif/core";
import type { ConversionOptions, JsonlEntry } from "./types.js";

// Import converter functions for use in main functions
import { parseJsonlString } from "./parser.js";
import { convertEntriesToTrajectory as convertEntriesToTrajectoryInternal } from "./converter.js";

// Re-export ATIF core types for convenience
export type {
  Trajectory,
  AgentSchema,
  StepObject,
  MetricsSchema,
  FinalMetricsSchema,
  ToolCallSchema,
  ObservationSchema,
  ObservationResultSchema,
  ContentPartSchema,
  ImageSourceSchema,
  SubagentTrajectoryRefSchema,
  ContextManagement,
  ExtraMetadata,
} from "@atif/core";

// Re-export converter types
export type {
  JsonlEntry,
  UserEntry,
  AssistantEntry,
  AttachmentEntry,
  SystemEntry,
  ContentBlock,
  UsageStats,
  ConversionOptions,
  SessionMetadata,
  EntryGroup,
} from "./types.js";

// Re-export converter functions
export { parseJsonlStream, parseJsonlString } from "./parser.js";
export { convertEntriesToTrajectory } from "./converter.js";
export { buildUserStep, buildAgentStep } from "./steps.js";
export { extractMetrics, aggregateMetrics } from "./metrics.js";
export { detectAgentCalls, extractSubagentRefs } from "./subagents.js";

// Re-export type guards
export {
  isUserEntry,
  isAssistantEntry,
  isAttachmentEntry,
  isSystemEntry,
  isMetadataEntry,
  isToolUseBlock,
  isToolResultBlock,
  isTextBlock,
  isToolResultEntry,
} from "./types.js";

/**
 * Main conversion function: Convert Claude Code JSONL stream to ATIF Trajectory
 *
 * @param stream - Readable stream of JSONL data
 * @param options - Conversion options
 * @returns Promise resolving to ATIF Trajectory
 *
 * @example
 * ```typescript
 * import { createReadStream } from 'fs';
 * import { convertJsonlToAtif } from '@atif/claude-code';
 *
 * const jsonlStream = createReadStream('session.jsonl');
 * const trajectory = await convertJsonlToAtif(jsonlStream);
 *
 * console.log(`Converted ${trajectory.steps.length} steps`);
 * ```
 */
export const convertJsonlToAtif = async (
  stream: Readable,
  options?: Partial<ConversionOptions>,
): Promise<Trajectory> => {
  // Dynamically import parser to avoid circular dependencies
  const { parseJsonlStream } = await import("./parser.js");
  const { convertEntriesToTrajectory } = await import("./converter.js");

  // Parse JSONL stream
  const entries = await parseJsonlStream(stream);

  // Convert to trajectory
  const trajectory = convertEntriesToTrajectory(entries, options);

  return trajectory;
};

/**
 * Convert Claude Code JSONL string to ATIF Trajectory
 * Convenience function for testing or when JSONL data is already in memory
 *
 * @param jsonString - String containing JSONL data
 * @param options - Conversion options
 * @returns ATIF Trajectory
 *
 * @example
 * ```typescript
 * import { readFileSync } from 'fs';
 * import { convertJsonlStringToAtif } from '@atif/claude-code';
 *
 * const jsonlString = readFileSync('session.jsonl', 'utf-8');
 * const trajectory = convertJsonlStringToAtif(jsonlString);
 * ```
 */
export const convertJsonlStringToAtif = (
  jsonString: string,
  options?: Partial<ConversionOptions>,
): Trajectory => {
  // Parse JSONL string
  const entries = parseJsonlString(jsonString);

  // Convert to trajectory
  const trajectory = convertEntriesToTrajectoryInternal(entries, options);

  return trajectory;
};

/**
 * Convert Claude Code JSONL entries to ATIF Trajectory
 * Direct conversion when you already have parsed entries
 *
 * @param entries - Array of parsed JSONL entries
 * @param options - Conversion options
 * @returns ATIF Trajectory
 */
export const convertEntriesToTrajectoryDirect = (
  entries: JsonlEntry[],
  options?: Partial<ConversionOptions>,
): Trajectory => convertEntriesToTrajectoryInternal(entries, options);
