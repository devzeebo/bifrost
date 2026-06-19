/**
 * Step building logic for converting JSONL entries to ATIF steps
 */

import type {
  ObservationResultSchema,
  StepObject,
  ToolCallSchema,
  ObservationSchema,
  ContentPartSchema,
  ImageMediaType,
} from "@atif/core";
import {
  type AssistantEntry,
  type ContentBlock,
  type ConversionOptions,
  type ToolResultContentBlock,
  type ToolUseContentBlock,
  type UserEntry,
  isTextBlock,
  isToolResultBlock,
  isToolUseBlock,
} from "./types.js";
import { extractMetrics } from "./metrics.js";

/**
 * Extract text content from a message
 */
const extractMessageText = (content: ContentBlock[]): string => {
  const textBlocks = content.filter(isTextBlock);
  return textBlocks.map((block) => block.text).join("\n");
};

/**
 * Extract tool calls from assistant message content
 */
const extractToolCalls = (content: ContentBlock[]): ToolCallSchema[] => {
  const toolCalls: ToolCallSchema[] = [];
  const toolUseBlocks = content.filter(isToolUseBlock) as ToolUseContentBlock[];

  for (const block of toolUseBlocks) {
    const toolCall: ToolCallSchema = {
      tool_call_id: block.id,
      function_name: block.name,
      arguments: block.input as Record<string, unknown>,
      extra: {},
    };
    toolCalls.push(toolCall);
  }

  return toolCalls;
};

/**
 * Extract content from tool result block
 */
const extractToolResultContent = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    // Handle array of content blocks
    return JSON.stringify(content);
  }

  if (typeof content === "object" && content !== null) {
    return JSON.stringify(content);
  }

  return String(content);
};

/**
 * Build extra metadata from entry
 */
const buildStepExtra = (entry: UserEntry | AssistantEntry): Record<string, unknown> => {
  const extra: Record<string, unknown> = {
    uuid: entry.uuid,
    timestamp: entry.timestamp,
    sessionId: entry.sessionId,
    version: entry.version,
    userType: entry.userType,
    entrypoint: entry.entrypoint,
    cwd: entry.cwd,
    gitBranch: entry.gitBranch,
    slug: entry.slug,
  };

  if (entry.parentUuid) {
    extra.parentUuid = entry.parentUuid;
  }

  if ("isSidechain" in entry) {
    extra.isSidechain = entry.isSidechain;
  }

  // Add tool result specific data if present
  if ("toolUseResult" in entry && entry.toolUseResult) {
    extra.toolUseResult = {
      status: entry.toolUseResult.status,
      totalDurationMs: entry.toolUseResult.totalDurationMs,
      totalTokens: entry.toolUseResult.totalTokens,
      totalToolUseCount: entry.toolUseResult.totalToolUseCount,
    };
  }

  return extra;
};

/**
 * Build observation from tool results
 */
const buildObservation = (toolResults: UserEntry[]): ObservationSchema | undefined => {
  if (toolResults.length === 0) {
    return undefined;
  }

  const results: ObservationResultSchema[] = [];

  for (const resultEntry of toolResults) {
    const resultBlocks = resultEntry.message.content.filter(
      isToolResultBlock,
    ) as ToolResultContentBlock[];

    for (const resultBlock of resultBlocks) {
      const result: ObservationResultSchema = {
        source_call_id: resultBlock.tool_use_id,
        content: extractToolResultContent(resultBlock.content),
        extra: buildStepExtra(resultEntry),
      };
      results.push(result);
    }
  }

  return { results };
};

/**
 * Convert message content to ATIF format (string or ContentPart array)
 */
const convertMessageContent = (content: ContentBlock[]): string | ContentPartSchema[] => {
  // Check if there are any non-text blocks (images, etc.)
  const hasMultimedia = content.some((block) => block.type !== "text");

  if (!hasMultimedia) {
    // Simple text message
    return extractMessageText(content);
  }

  // Convert to ContentPart array
  const contentParts: ContentPartSchema[] = [];

  for (const block of content) {
    if (isTextBlock(block)) {
      contentParts.push({
        type: "text",
        text: block.text,
      });
    } else if (block.type === "image") {
      // Handle image blocks
      contentParts.push({
        type: "image",
        source: {
          media_type: block.source.media_type as ImageMediaType,
          path: block.source.type, // This might need adjustment based on actual structure
        },
      });
    }
  }

  return contentParts;
};

/**
 * Build a user step from a user entry
 */
export const buildUserStep = (
  entry: UserEntry,
  stepId: number,
  options?: ConversionOptions,
): StepObject => {
  const step: StepObject = {
    step_id: stepId,
    timestamp: entry.timestamp,
    source: "user",
    message: convertMessageContent(entry.message.content),
    extra: options?.metadataStrategy === "include" ? buildStepExtra(entry) : undefined,
  };

  return step;
};

/**
 * Parameters for building an agent step
 */
type BuildAgentStepParams = {
  entry: AssistantEntry;
  toolResults: UserEntry[];
  stepId: number;
  options?: ConversionOptions;
};

/**
 * Build an agent step from an assistant entry
 */
export const buildAgentStep = (params: BuildAgentStepParams): StepObject => {
  const { entry, toolResults, stepId, options } = params;
  const toolCalls = extractToolCalls(entry.message.content);
  const observation = buildObservation(toolResults);
  const metrics = extractMetrics(entry.message.usage);

  const step: StepObject = {
    step_id: stepId,
    timestamp: entry.timestamp,
    source: "agent",
    message: convertMessageContent(entry.message.content),
    model_name: entry.message.model,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    observation,
    metrics,
    extra: options?.metadataStrategy === "include" ? buildStepExtra(entry) : undefined,
  };

  return step;
};
