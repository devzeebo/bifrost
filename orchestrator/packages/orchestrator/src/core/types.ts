// FR-4: Agent Definition File types

import type { AgentDefinition as BaseAgentDefinition } from "@bifrost-ai/engine";

export type { AgentDefinition as BaseAgentDefinition, Template } from "@bifrost-ai/engine";

export type HookResult = {
  outcome: "success" | "follow-up" | "fatal" | "skip";
  message?: string;
};

export type HookExecutionContext = {
  projectDir: string;
  hookName: string;
  params: Record<string, unknown>;
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
