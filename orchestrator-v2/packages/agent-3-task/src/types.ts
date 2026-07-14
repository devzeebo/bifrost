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

const REQUIRED_FIELDS = ["workingDir", "instructions", "engineName"] as const;

export function getTaskAgentStateMissingFields(taskState: Record<string, unknown>): string[] {
  const missing: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in taskState) || taskState[field] === undefined) {
      missing.push(field);
    }
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

  return [...new Set(missing)];
}

export function verifyIsTaskAgentState(
  taskState: Record<string, unknown>,
): asserts taskState is TaskAgentState {
  const missing = getTaskAgentStateMissingFields(taskState);
  if (missing.length > 0) {
    throw new Error(missingFieldsMessage(missing));
  }
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
