import type {
  FunctionTool,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses.js";

import type { LineUsage } from "./usage.ts";

export type ModelRequest = {
  readonly model: string;
  readonly input: readonly ResponseInputItem[];
  readonly tools: readonly FunctionTool[];
  readonly store: false;
  readonly sessionId: string;
  readonly instructions?: string;
};

export type ModelResponse = {
  readonly status: string;
  readonly outputText: string;
  readonly output: readonly ResponseOutputItem[];
  readonly usage?: LineUsage;
};

export type ModelClient = {
  createResponse: (request: ModelRequest) => Promise<ModelResponse>;
};
