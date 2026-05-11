import type { EngineContext, EngineResult } from "./types";

// FR-2: Engine Interface
export type Engine = {
  // Execute a task
  execute: (context: EngineContext) => Promise<EngineResult>;

  // Optional method for follow-up execution
  sendFollowUp?: (message: string) => Promise<EngineResult>;
};

// Re-export types for convenience
export type { EngineContext, EngineResult };
