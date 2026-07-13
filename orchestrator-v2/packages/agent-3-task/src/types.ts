import type { AgentDefinition, Engine } from "@bifrost-ai/engine";

export const ENGINE_DATA_TYPE = "engine";
export const AGENT_DEFINITION_DATA_TYPE = "agentDefinition";

export type TaskAgentDataSchema = {
  engine: Engine;
  agentDefinition: AgentDefinition;
};

export type TaskAgentState = {
  workingDir: string;
  instructions: string;
  engineName: string;
  sessionId?: string;
};

export type TaskAgentStateParseResult = { ok: true } | { ok: false; missing: string[] };

const REQUIRED_FIELDS = ["workingDir", "instructions", "engineName"] as const;

export function parseTaskAgentState(taskState: Record<string, unknown>): TaskAgentStateParseResult {
  const missing: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in taskState) || taskState[field] === undefined) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const workingDir = taskState.workingDir;
  const instructions = taskState.instructions;
  const engineName = taskState.engineName;
  const sessionId = taskState.sessionId;

  if (typeof workingDir !== "string" || workingDir.length === 0) {
    missing.push("workingDir");
  }
  if (typeof instructions !== "string") {
    missing.push("instructions");
  }
  if (typeof engineName !== "string" || engineName.length === 0) {
    missing.push("engineName");
  }
  if (sessionId !== undefined && typeof sessionId !== "string") {
    missing.push("sessionId");
  }

  if (missing.length > 0) {
    return { ok: false, missing: [...new Set(missing)] };
  }

  return { ok: true };
}

export function missingFieldsMessage(missing: string[]): string {
  return `Task agent state is missing required fields: ${missing.join(", ")}`;
}

export function isEngine(value: unknown): value is Engine {
  return (
    typeof value === "object" &&
    value !== null &&
    "execute" in value &&
    typeof value.execute === "function"
  );
}

export function isAgentDefinition(value: unknown): value is AgentDefinition {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<AgentDefinition>;
  return (
    typeof record.name === "string" &&
    typeof record.description === "string" &&
    Array.isArray(record.tools) &&
    record.template !== null &&
    typeof record.template === "object" &&
    typeof record.promptBody === "string"
  );
}

export const taskAgentDataGuards = {
  engine: isEngine,
  agentDefinition: isAgentDefinition,
} as const;
