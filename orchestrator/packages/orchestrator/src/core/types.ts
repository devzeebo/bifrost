// FR-4: Agent Definition File types

import type { AgentDefinition as BaseAgentDefinition, AgentTool } from "@bifrost-ai/engine";

export type {
  AgentDefinition as BaseAgentDefinition,
  AgentTool,
  Template,
} from "@bifrost-ai/engine";

export type OrchestrationContext = {
  projectDir: string;
  tools?: AgentTool[];
  instructions: string;
};

export type HookResult = {
  outcome: "success" | "follow-up" | "fatal" | "skip";
  message?: string;
};

export type HookExecutionContext = {
  taskId: string;
  hookName: string;
  context: OrchestrationContext;
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

export type BeforeDispatchHookContext = {
  taskId: string;
  agentId: string;
  hookName: string;
  context: OrchestrationContext;
  taskState: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type BeforeDispatchHookResult = {
  outcome: "success" | "fatal" | "skip";
  message?: string;
};

export type BeforeDispatchHookFn = (
  ctx: BeforeDispatchHookContext,
) => Promise<BeforeDispatchHookResult>;

export type BeforeDispatchHookSpec = {
  name: string;
  fn: BeforeDispatchHookFn;
};
