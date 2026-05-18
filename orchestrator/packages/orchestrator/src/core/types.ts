// FR-4: Agent Definition File types

export type HookResult = {
  outcome: "success" | "follow-up" | "fatal" | "skip";
  message?: string;
};

export type HookExecutionContext = {
  projectDir: string;
  hookName: string;
  params: Record<string, unknown>;
  taskState: Record<string, unknown>;
  setTaskState: (newState: Record<string, unknown>) => Promise<void>;
};

export type HookFn = (ctx: HookExecutionContext) => Promise<HookResult>;

export type HookSpec = {
  name: string;
  fn: HookFn;
};

export type AgentDefinition = {
  name: string;
  description: string;
  tools: string[];
  toolClasses: string[];
  template: Template;
  hooks: Hooks;
  promptBody: string;
};

export type Template = {
  parameters: Record<string, unknown>;
};

export type Hooks = {
  Start: HookSpec[];
  Stop: HookSpec[];
};
