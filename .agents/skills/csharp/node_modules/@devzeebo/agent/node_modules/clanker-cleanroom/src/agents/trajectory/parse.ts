import { jsonl } from "js-jsonl";

import type { AgentFs } from "../agent-fs.js";
import { TRAJECTORY_FILE } from "./constants.js";
import type { Trajectory, TrajectoryEvent, TrajectoryKind, TrajectoryToolCall } from "./types.js";

export type TrajectoryAdapter = (rawEvents: readonly unknown[]) => TrajectoryEvent[];

export function parseTrajectory(
  ndjson: string,
  provider: TrajectoryKind,
  adaptEvents: TrajectoryAdapter,
): Trajectory {
  const rawEvents = jsonl.parse(ndjson);
  const events = adaptEvents(rawEvents);
  return createTrajectory(provider, events);
}

export async function readTrajectory(
  output: AgentFs,
  provider: TrajectoryKind,
  adaptEvents: TrajectoryAdapter,
): Promise<Trajectory> {
  const ndjson = await output.readText(TRAJECTORY_FILE);
  return parseTrajectory(ndjson, provider, adaptEvents);
}

function createTrajectory(
  provider: TrajectoryKind,
  events: readonly TrajectoryEvent[],
): Trajectory {
  return {
    provider,
    events,
    sessionId() {
      for (const event of events) {
        if (event.kind === "system" && event.sessionId !== null) {
          return event.sessionId;
        }
      }
      return null;
    },
    result() {
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const event = events[i];
        if (event?.kind === "result") {
          return event;
        }
      }
      return null;
    },
    assistantMessages() {
      return events
        .filter((event): event is Extract<TrajectoryEvent, { kind: "assistant" }> => {
          return event.kind === "assistant";
        })
        .map((event) => event.text);
    },
    toolCalls() {
      const byId = new Map<string, TrajectoryToolCall>();
      for (const event of events) {
        if (event.kind !== "tool") {
          continue;
        }
        const existing = byId.get(event.callId);
        if (existing === undefined) {
          byId.set(event.callId, {
            callId: event.callId,
            name: event.name,
            args: event.args,
            result: event.result,
          });
          continue;
        }
        byId.set(event.callId, {
          callId: event.callId,
          name: event.name === "tool_result" ? existing.name : event.name,
          args: event.args ?? existing.args,
          result: event.result ?? existing.result,
        });
      }
      return [...byId.values()];
    },
  };
}
