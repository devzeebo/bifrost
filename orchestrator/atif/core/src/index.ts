/**
 * Agent Trajectory Interchange Format (ATIF) v1.7 TypeScript Types
 *
 * This represents the standardized JSON-based specification for logging
 * the complete interaction history of autonomous LLM agents.
 */

/**
 * The source of a step - system prompts, user messages, or agent responses
 */
export type StepSource = "system" | "user" | "agent";

/**
 * Content part types for multimodal content
 */
export type ContentPartType = "text" | "image";

/**
 * Supported MIME types for images
 */
export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * Context management transformation types
 */
export type ContextManagementType = "compaction" | "pruning" | "injection";

/**
 * Context management boundary types
 */
export type ContextManagementBoundary = "replace" | "append" | "truncate";

/**
 * Image source specification for multimodal content
 */
export type ImageSourceSchema = {
  media_type: ImageMediaType;
  path: string;
};

/**
 * Content part for multimodal messages (text or image)
 */
export type ContentPartSchema = {
  type: ContentPartType;
  text?: string; // Required when type is "text"
  source?: ImageSourceSchema; // Required when type is "image"
};

/**
 * Custom metadata extension point
 * Allows arbitrary properties not covered by core schema
 */
export type ExtraMetadata = Record<string, unknown>;

/**
 * Agent configuration schema
 */
export type AgentSchema = {
  name: string; // Required: The name of the agent system
  version: string; // Required: Version identifier
  model_name?: string; // Optional: Default LLM model
  tool_definitions?: {
    // Optional: Tool/function definitions
    type: string;
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }[];
  extra?: ExtraMetadata; // Optional: Custom agent configuration
};

/**
 * Metrics for individual LLM calls
 */
export type MetricsSchema = {
  prompt_tokens?: number; // Total input tokens (cached + non-cached)
  completion_tokens?: number; // Total tokens generated
  cached_tokens?: number; // Subset that were cache hits
  cost_usd?: number; // Monetary cost of API call
  prompt_token_ids?: number[]; // Token IDs for prompt tokens
  completion_token_ids?: number[]; // Token IDs for completion tokens
  logprobs?: number[]; // Log probabilities for each completion token
  extra?: ExtraMetadata; // Provider-specific metrics
};

/**
 * Reference to a delegated subagent trajectory
 */
export type SubagentTrajectoryRefSchema = {
  trajectory_id?: string; // Canonical ID for embedded references (v1.7+)
  trajectory_path?: string; // External file reference
  session_id?: string; // Informational only, run-scoped (NOT a resolution key)
  extra?: ExtraMetadata; // Custom metadata about subagent execution
};

/**
 * Individual observation result from tool calls or system events
 */
export type ObservationResultSchema = {
  source_call_id?: string; // Correlates with tool_call_id
  content?: string | ContentPartSchema[]; // Result output
  subagent_trajectory_ref?: SubagentTrajectoryRefSchema[]; // Subagent references
  extra?: ExtraMetadata; // Custom observation metadata (v1.7+)
};

/**
 * Container for environment feedback and system event results
 */
export type ObservationSchema = {
  results: ObservationResultSchema[]; // Array of result objects
};

/**
 * Tool call invocation details
 */
export type ToolCallSchema = {
  tool_call_id: string; // Unique identifier for this call
  function_name: string; // Name of function/tool being invoked
  arguments: Record<string, unknown>; // Arguments passed to function (can be empty {})
  extra?: ExtraMetadata; // Custom tool-call metadata (v1.7+)
};

/**
 * Context management convention for system steps
 */
export type ContextManagement = {
  type: ContextManagementType;
  boundary: ContextManagementBoundary;
};

/**
 * Individual step in the trajectory
 */
export type StepObject = {
  step_id: number; // Required: Ordinal index starting from 1
  timestamp?: string; // Optional: ISO 8601 timestamp
  source: StepSource; // Required: Originator of this step
  model_name?: string; // Optional: LLM model (only for agent source)
  reasoning_effort?: string | number; // Optional: Effort measure (agent only)
  message: string | ContentPartSchema[]; // Required: Dialogue message (can be empty string)
  reasoning_content?: string; // Optional: Internal reasoning (agent only)
  tool_calls?: ToolCallSchema[]; // Optional: Agent's actions (agent only)
  observation?: ObservationSchema; // Optional: Environment feedback
  metrics?: MetricsSchema; // Optional: LLM metrics (agent only)
  extra?: ExtraMetadata; // Optional: Custom step metadata
  llm_call_count?: number; // Optional: Number of LLM inferences (v1.7+)
  is_copied_context?: boolean; // Optional: Context copy flag for SFT filtering
};

/**
 * Aggregate metrics for entire trajectory
 */
export type FinalMetricsSchema = {
  total_prompt_tokens?: number; // Sum of prompt tokens across all steps
  total_completion_tokens?: number; // Sum of completion tokens
  total_cached_tokens?: number; // Sum of cached tokens
  total_cost_usd?: number; // Total cost in USD
  total_steps?: number; // Total number of steps
  extra?: ExtraMetadata; // Custom aggregate metrics
};

/**
 * Root ATIF Trajectory object
 * Represents the complete interaction history of an autonomous LLM agent
 */
export type Trajectory = {
  schema_version: string; // Required: ATIF compatibility (e.g., "ATIF-v1.7")
  session_id?: string; // Optional: Run-scoped identifier (relaxed in v1.7)
  trajectory_id?: string; // Optional: Per-document unique ID (required for embedded)
  agent: AgentSchema; // Required: Agent configuration
  steps: StepObject[]; // Required: Complete interaction history
  notes?: string; // Optional: Developer notes
  final_metrics?: FinalMetricsSchema; // Optional: Summary metrics
  continued_trajectory_ref?: string; // Optional: Reference to continuation file
  extra?: ExtraMetadata; // Optional: Custom root-level metadata
  subagent_trajectories?: Trajectory[]; // Optional: Embedded subagent trajectories (v1.7+)
};

/**
 * Type guard to check if content is multimodal (array of ContentPart)
 */
export const isMultimodalContent = (
  content: string | ContentPartSchema[],
): content is ContentPartSchema[] => Array.isArray(content);

/**
 * Type guard to check if a content part is an image
 */
export const isImageContentPart = (
  part: ContentPartSchema,
): part is ContentPartSchema & {
  type: "image";
  source: ImageSourceSchema;
} => part.type === "image" && part.source !== undefined;

/**
 * Type guard to check if a content part is text
 */
export const isTextContentPart = (
  part: ContentPartSchema,
): part is ContentPartSchema & {
  type: "text";
  text: string;
} => part.type === "text" && typeof part.text === "string";

/**
 * Check if trajectory contains multimodal content
 */
export const hasMultimodalContent = (trajectory: Trajectory): boolean => {
  for (const step of trajectory.steps) {
    if (isMultimodalContent(step.message)) {
      return true;
    }
    if (step.observation) {
      for (const result of step.observation.results) {
        if (result.content && isMultimodalContent(result.content)) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 * Check if a step represents a deterministic (non-LLM) dispatch
 */
export const isDeterministicDispatch = (step: StepObject): boolean =>
  step.source === "agent" && step.llm_call_count === 0;

/**
 * Check if a step should be filtered from SFT training data
 */
export const shouldFilterFromSFT = (step: StepObject): boolean =>
  step.is_copied_context === true || isDeterministicDispatch(step);

/**
 * Check if a step is a context management boundary step
 */
export const isContextBoundary = (step: StepObject): boolean =>
  step.source === "system" &&
  step.extra?.context_management !== undefined &&
  (step.extra.context_management as ContextManagement).boundary === "replace";
