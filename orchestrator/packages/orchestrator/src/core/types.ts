// FR-4: Agent Definition File types

import type { AgentDefinition as BaseAgentDefinition, AgentTool } from "@bifrost-ai/engine";

export type {
  AgentDefinition as BaseAgentDefinition,
  AgentTool,
  Template,
} from "@bifrost-ai/engine";

export type ExecutionOverrides = {
  tools?: AgentTool[];
  cwd?: string;
  instructions?: string;
};

export type HookResult = {
  outcome: "success" | "follow-up" | "fatal" | "skip";
  message?: string;
  overrides?: ExecutionOverrides;
};

export type HookExecutionContext = {
  taskId: string;
  projectDir: string;
  hookName: string;
  params: Record<string, unknown>;
  metadata: Record<string, unknown>;
  getTaskState: () => Record<string, unknown>;
  setTaskState: (newState: Record<string, unknown>) => Promise<void>;
};

export type HookFn = (ctx: HookExecutionContext) => Promise<HookResult>;

export type HookSpec = {
  name: string;
  fn: HookFn;
};

export type Hooks = {
  Start: HookSpec[];
  Stop: HookSpec[];
};

export type AgentDefinition = BaseAgentDefinition & {
  hooks: Hooks;
};
