import type { EngineContext, EngineResult } from "./types.js";

export type Engine = {
  execute: (context: EngineContext, sessionId?: string) => Promise<EngineResult>;
};

export type { EngineContext, EngineResult };
