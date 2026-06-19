/**
 * JSONL format type definitions for Claude Code conversation logs
 * These types represent the structure of Claude Code's JSONL export format
 */

/**
 * Base metadata fields present in all JSONL entries
 */
export type BaseJsonlMetadata = {
  uuid: string;
  timestamp: string;
  sessionId: string;
  version: string;
  userType: string;
  entrypoint: string;
  cwd: string;
  gitBranch: string;
  slug: string;
  parentUuid: string | null;
  isSidechain: boolean;
};

/**
 * User message entry
 */
export type UserEntry = BaseJsonlMetadata & {
  type: "user";
  promptId?: string;
  message: {
    role: "user";
    content: ContentBlock[];
  };
  permissionMode?: string;
  isMeta?: boolean;
  toolUseResult?: ToolResultData;
};

/**
 * Assistant message entry
 */
export type AssistantEntry = BaseJsonlMetadata & {
  type: "assistant";
  message: {
    model: string;
    id: string;
    type: "message";
    role: "assistant";
    content: ContentBlock[];
    stop_reason: string | null;
    stop_sequence: unknown;
    stop_details: unknown;
    usage: UsageStats;
    diagnostics: unknown;
  };
  requestId: string;
};

/**
 * Attachment entry (hooks, system events, etc.)
 */
export type AttachmentEntry = BaseJsonlMetadata & {
  type: "attachment";
  attachment: {
    type: string;
    [key: string]: unknown;
  };
};

/**
 * System entry (mode changes, session metadata, etc.)
 */
export type SystemEntry = BaseJsonlMetadata & {
  type: "system";
  subtype?: string;
  [key: string]: unknown;
};

/**
 * Metadata entry types (session info, titles, etc.)
 */
export type MetadataEntry = BaseJsonlMetadata & {
  type:
    | "last-prompt"
    | "ai-title"
    | "agent-name"
    | "mode"
    | "permission-mode"
    | "file-history-snapshot";
  [key: string]: unknown;
};

/**
 * Union type for all JSONL entry types
 */
export type JsonlEntry = UserEntry | AssistantEntry | AttachmentEntry | SystemEntry | MetadataEntry;

/**
 * Content block types in messages
 */
export type ContentBlock =
  | TextContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock
  | ImageContentBlock;

/**
 * Text content block
 */
export type TextContentBlock = {
  type: "text";
  text: string;
};

/**
 * Tool use content block (from assistant making tool calls)
 */
export type ToolUseContentBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

/**
 * Tool result content block (from user returning tool results)
 */
export type ToolResultContentBlock = {
  tool_use_id: string;
  type: "tool_result";
  content?: unknown;
  is_error?: boolean;
};

/**
 * Image content block
 */
export type ImageContentBlock = {
  type: "image";
  source: {
    type: string;
    media_type: string;
    data: string;
  };
};

/**
 * Token usage statistics from LLM calls
 */
export type UsageStats = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  server_tool_use?: {
    web_search_requests: number;
    web_fetch_requests: number;
  };
  service_tier?: string;
  cache_creation?: {
    ephemeral_1h_input_tokens?: number;
    ephemeral_5m_input_tokens?: number;
  };
  inference_geo?: string;
  iterations?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    type: string;
  }[];
  speed?: string;
};

/**
 * Extended tool result data from toolUseResult field
 */
export type ToolResultData = {
  status: string;
  prompt?: string;
  agentId?: string;
  agentType?: string;
  content?: unknown;
  totalDurationMs?: number;
  totalTokens?: number;
  totalToolUseCount?: number;
  usage?: UsageStats;
  toolStats?: {
    readCount: number;
    searchCount: number;
    bashCount: number;
    editFileCount: number;
    linesAdded: number;
    linesRemoved: number;
    otherToolCount: number;
  };
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  interrupted?: boolean;
  isImage?: boolean;
  noOutputExpected?: boolean;
};

/**
 * Session metadata extracted from JSONL entries
 */
export type SessionMetadata = {
  sessionId: string;
  version: string;
  startTime?: string;
  endTime?: string;
  cwd?: string;
  gitBranch?: string;
  model?: string;
  totalEntries: number;
};

/**
 * Conversion options for controlling the transformation
 */
export type ConversionOptions = {
  includeSystemSteps?: boolean;
  includeAttachments?: boolean;
  extractSubagents?: boolean;
  metadataStrategy?: "include" | "exclude";
};

/**
 * Entry group representing related JSONL entries (assistant + tool results)
 */
export type EntryGroup = {
  mainEntry: UserEntry | AssistantEntry;
  toolResults: UserEntry[];
  attachments: AttachmentEntry[];
};

/**
 * Discriminator for UserEntry
 */
export const isUserEntry = (entry: JsonlEntry): entry is UserEntry => entry.type === "user";

/**
 * Discriminator for AssistantEntry
 */
export const isAssistantEntry = (entry: JsonlEntry): entry is AssistantEntry =>
  entry.type === "assistant";

/**
 * Discriminator for AttachmentEntry
 */
export const isAttachmentEntry = (entry: JsonlEntry): entry is AttachmentEntry =>
  entry.type === "attachment";

/**
 * Discriminator for SystemEntry
 */
export const isSystemEntry = (entry: JsonlEntry): entry is SystemEntry => entry.type === "system";

/**
 * Discriminator for MetadataEntry
 */
export const isMetadataEntry = (entry: JsonlEntry): entry is MetadataEntry =>
  [
    "last-prompt",
    "ai-title",
    "agent-name",
    "mode",
    "permission-mode",
    "file-history-snapshot",
  ].includes(entry.type);

/**
 * Check if content block is a tool use
 */
export const isToolUseBlock = (block: ContentBlock): block is ToolUseContentBlock =>
  block.type === "tool_use";

/**
 * Check if content block is a tool result
 */
export const isToolResultBlock = (block: ContentBlock): block is ToolResultContentBlock =>
  block.type === "tool_result";

/**
 * Check if content block is text
 */
export const isTextBlock = (block: ContentBlock): block is TextContentBlock =>
  block.type === "text";

/**
 * Check if user entry contains tool results
 */
export const isToolResultEntry = (entry: UserEntry): boolean =>
  entry.message.content.some(isToolResultBlock);
