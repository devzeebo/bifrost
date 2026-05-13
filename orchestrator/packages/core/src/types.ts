// FR-4: Agent Definition File types

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

export type HookSpec = {
  name: string;
  scriptPath: string;
  timeout?: number;
};
