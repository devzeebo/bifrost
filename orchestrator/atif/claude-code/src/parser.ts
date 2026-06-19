/**
 * JSONL stream parser for Claude Code conversation logs
 * Processes JSONL data line-by-line using Node.js streams
 */

import { createInterface } from "readline";
import type { Readable } from "stream";
import type { JsonlEntry } from "./types.js";

/**
 * Error thrown when JSONL parsing fails
 */
export class JsonlParseError extends Error {
  public readonly lineIndex: number;
  public readonly lineContent: string;

  public constructor(message: string, lineIndex: number, lineContent: string) {
    super(message);
    this.name = "JsonlParseError";
    this.lineIndex = lineIndex;
    this.lineContent = lineContent;
  }
}

/**
 * Error thrown when JSONL entry validation fails
 */
export class JsonlValidationError extends Error {
  public readonly entry: JsonlEntry;

  public constructor(message: string, entry: JsonlEntry) {
    super(message);
    this.name = "JsonlValidationError";
    this.entry = entry;
  }
}

/**
 * Validate basic structure of a JSONL entry
 */
export const validateEntry = (entry: unknown): entry is JsonlEntry => {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const entryRecord = entry as Record<string, unknown>;

  // Required fields for all entries
  if (typeof entryRecord.type !== "string") {
    return false;
  }

  if (typeof entryRecord.uuid !== "string") {
    return false;
  }

  if (typeof entryRecord.timestamp !== "string") {
    return false;
  }

  if (typeof entryRecord.sessionId !== "string") {
    return false;
  }

  return true;
};

/**
 * Categorize a JSONL entry into its specific type
 */
export const categorizeEntry = (entry: JsonlEntry): string => {
  switch (entry.type) {
    case "user":
    case "assistant":
    case "attachment":
    case "system":
    case "last-prompt":
    case "ai-title":
    case "agent-name":
    case "mode":
    case "permission-mode":
    case "file-history-snapshot":
      return entry.type;
    default:
      return "unknown";
  }
};

/**
 * Parse a JSONL stream and return array of entries
 *
 * @param stream - Readable stream of JSONL data
 * @param validate - Whether to validate each entry (default: true)
 * @returns Promise resolving to array of JSONL entries
 * @throws JsonlParseError if JSON parsing fails
 * @throws JsonlValidationError if validation fails
 */
export const parseJsonlStream = async (
  stream: Readable,
  validate = true,
): Promise<JsonlEntry[]> => {
  const entries: JsonlEntry[] = [];
  const rl = createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let lineIndex = 0;

  for await (const line of rl) {
    lineIndex += 1;

    // Skip empty lines
    if (!line.trim()) {
      // Skip to next iteration
      // eslint-disable-next-line no-continue
      continue;
    }

    try {
      const entry = JSON.parse(line) as unknown;

      if (validate) {
        if (!validateEntry(entry)) {
          throw new JsonlValidationError(
            `Entry validation failed at line ${lineIndex}`,
            entry as JsonlEntry,
          );
        }
      }

      entries.push(entry as JsonlEntry);
    } catch (error) {
      if (error instanceof JsonlValidationError) {
        throw error;
      }

      throw new JsonlParseError(
        `Failed to parse JSON at line ${lineIndex}: ${error instanceof Error ? error.message : String(error)}`,
        lineIndex,
        line,
      );
    }
  }

  return entries;
};

/**
 * Parse a JSONL string (for testing/convenience)
 *
 * @param jsonString - String containing JSONL data
 * @param validate - Whether to validate each entry (default: true)
 * @returns Array of JSONL entries
 */
export const parseJsonlString = (jsonString: string, validate = true): JsonlEntry[] => {
  const entries: JsonlEntry[] = [];
  const lines = jsonString.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string;
    const lineIndex = index + 1;

    // Skip empty lines
    if (!line.trim()) {
      // eslint-disable-next-line no-continue
      continue;
    }

    try {
      const entry = JSON.parse(line) as unknown;

      if (validate) {
        if (!validateEntry(entry)) {
          throw new JsonlValidationError(
            `Entry validation failed at line ${lineIndex}`,
            entry as JsonlEntry,
          );
        }
      }

      entries.push(entry as JsonlEntry);
    } catch (error) {
      if (error instanceof JsonlValidationError) {
        throw error;
      }

      throw new JsonlParseError(
        `Failed to parse JSON at line ${lineIndex}: ${error instanceof Error ? error.message : String(error)}`,
        lineIndex,
        line,
      );
    }
  }

  return entries;
};
