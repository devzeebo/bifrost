/** Provider id for a trajectory stream (e.g. `"cursor"`, `"claude"`). */
export type TrajectoryKind = string;

export type TrajectoryEvent =
  | { kind: "system"; sessionId: string | null; model: string | null; raw: unknown }
  | { kind: "user"; text: string; raw: unknown }
  | { kind: "assistant"; text: string; raw: unknown }
  | {
      kind: "tool";
      phase: "started" | "completed";
      callId: string;
      name: string;
      args: unknown;
      result: unknown;
      raw: unknown;
    }
  | {
      kind: "result";
      text: string;
      isError: boolean;
      durationMs: number | null;
      costUsd: number | null;
      raw: unknown;
    }
  | { kind: "other"; type: string; raw: unknown };

export type TrajectoryToolCall = {
  callId: string;
  name: string;
  args: unknown;
  result: unknown;
};

export type Trajectory = {
  readonly provider: TrajectoryKind;
  readonly events: readonly TrajectoryEvent[];
  sessionId(): string | null;
  result(): Extract<TrajectoryEvent, { kind: "result" }> | null;
  assistantMessages(): string[];
  toolCalls(): readonly TrajectoryToolCall[];
};
