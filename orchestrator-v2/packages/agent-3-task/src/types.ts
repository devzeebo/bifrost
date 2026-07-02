import type { AgentDefinition, Engine } from "@bifrost-ai/engine";

export type TaskAgentState = {
  workingDir: string;
  instructions: string;
  sessionId?: string;
};

export type TaskAgentConfig = {
  engine: Engine;
  agent: AgentDefinition;
};

export type ParsedTaskAgentState =
  | { ok: true; state: TaskAgentState }
  | { ok: false; missing: string[] };

const REQUIRED_FIELDS = ["workingDir", "instructions"] as const;

export function parseTaskAgentState(taskState: Record<string, unknown>): ParsedTaskAgentState {
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
  const sessionId = taskState.sessionId;

  if (typeof workingDir !== "string" || workingDir.length === 0) {
    missing.push("workingDir");
  }
  if (typeof instructions !== "string") {
    missing.push("instructions");
  }
  if (sessionId !== undefined && typeof sessionId !== "string") {
    missing.push("sessionId");
  }

  if (missing.length > 0) {
    return { ok: false, missing: [...new Set(missing)] };
  }

  return {
    ok: true,
    state: {
      workingDir: workingDir as string,
      instructions: instructions as string,
      ...(sessionId !== undefined ? { sessionId: sessionId as string } : {}),
    },
  };
}

export function missingFieldsMessage(missing: string[]): string {
  return `Task agent state is missing required fields: ${missing.join(", ")}`;
}
