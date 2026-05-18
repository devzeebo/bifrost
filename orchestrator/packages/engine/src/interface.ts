import type { EngineContext, EngineResult } from "./types";

// FR-2: Engine Interface
export type Engine = {
  // Execute a task. Pass sessionId to continue an existing session.
  execute: (context: EngineContext, sessionId?: string) => Promise<EngineResult>;
};

// Re-export types for convenience
export type { EngineContext, EngineResult };
