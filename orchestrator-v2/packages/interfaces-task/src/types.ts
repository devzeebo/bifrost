import type { AgentType, ExecutionStats } from "@bifrost-ai/interfaces-task-source";

export type ReadonlyRegistry<T> = {
  get(name: string): T | undefined;
  has(name: string): boolean;
};

export type Registry<T> = ReadonlyRegistry<T> & {
  register(name: string, item: T): void;
};

export type DataRegistry<T extends Record<string, unknown>> = {
  get<K extends keyof T & string>(type: K): ReadonlyRegistry<T[K]>;
};

export type MutableDataRegistry<T extends Record<string, unknown>> = {
  get<K extends keyof T & string>(type: K): Registry<T[K]>;
};

export type AgentRegistry = {
  get(agentType: string, name: string): unknown;
  has(agentType: string, name: string): boolean;
};

export type ScriptContext<TData extends Record<string, unknown> = Record<string, unknown>> = {
  taskId: string;
  agentType: AgentType;
  agentName: string;
  taskState: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly data: DataRegistry<TData>;
  readonly agents: AgentRegistry;
  setState: (state: Record<string, unknown>) => Promise<void>;
};

export type ScriptResult = {
  outcome: "completed" | "failed" | "paused";
  message?: string;
  telemetry?: ExecutionStats;
};

export type ScriptTaskDefinition<TData extends Record<string, unknown> = Record<string, unknown>> =
  {
    name: string;
    run: (ctx: ScriptContext<TData>) => Promise<ScriptResult>;
  };

export function isScriptTaskDefinition(value: unknown): value is ScriptTaskDefinition {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<ScriptTaskDefinition>;
  return typeof record.name === "string" && typeof record.run === "function";
}
