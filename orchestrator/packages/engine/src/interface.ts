import type { EngineContext, EngineResult } from "./types.js";

// FR-2: Engine Interface
export type Engine = {
  // Execute a task
  execute: (context: EngineContext) => Promise<EngineResult>;

  // Optional method for follow-up execution
  sendFollowUp?: (message: string) => Promise<EngineResult>;
};
