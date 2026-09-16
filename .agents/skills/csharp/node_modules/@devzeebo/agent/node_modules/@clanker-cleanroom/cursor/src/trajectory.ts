import {
  asRecord,
  extractTextContent,
  readString,
  readTokenCount,
  type TrajectoryEvent,
} from "clanker-cleanroom";

export function adaptCursorEvents(rawEvents: readonly unknown[]): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = [];

  for (const raw of rawEvents) {
    const record = asRecord(raw);
    if (record === undefined) {
      events.push({ kind: "other", type: "unknown", raw });
      continue;
    }

    const type = readString(record.type) ?? "unknown";

    switch (type) {
      case "system":
        events.push({
          kind: "system",
          sessionId: readString(record.session_id),
          model: readString(record.model),
          raw,
        });
        break;
      case "user":
        events.push({
          kind: "user",
          text: extractTextContent(record.message),
          raw,
        });
        break;
      case "assistant":
        events.push({
          kind: "assistant",
          text: extractTextContent(record.message),
          raw,
        });
        break;
      case "tool_call":
        events.push(adaptCursorToolCall(record, raw));
        break;
      case "result":
        events.push({
          kind: "result",
          text: readString(record.result) ?? "",
          isError: record.is_error === true,
          durationMs: readTokenCount(record.duration_ms),
          costUsd: readTokenCount(record.total_cost_usd),
          raw,
        });
        break;
      default:
        events.push({ kind: "other", type, raw });
    }
  }

  return events;
}

function adaptCursorToolCall(
  record: Record<string, unknown>,
  raw: unknown,
): Extract<TrajectoryEvent, { kind: "tool" }> {
  const subtype = readString(record.subtype);
  const phase = subtype === "completed" ? "completed" : "started";
  const toolCall = asRecord(record.tool_call) ?? {};
  const name = Object.keys(toolCall)[0] ?? "unknown";
  const details = asRecord(toolCall[name]) ?? {};

  return {
    kind: "tool",
    phase,
    callId: readString(record.call_id) ?? "",
    name,
    args: details.args ?? null,
    result: details.result ?? null,
    raw,
  };
}
