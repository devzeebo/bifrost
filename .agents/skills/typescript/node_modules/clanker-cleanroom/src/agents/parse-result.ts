import { jsonl } from "js-jsonl";

import { asRecord } from "./trajectory/values.js";

/**
 * Parse agent CLI output (single JSON object or JSONL stream) and return the
 * terminal `result` event when present.
 */
export function parseAgentJsonOutput(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === "") {
    throw new Error("Agent produced empty trajectory; expected JSON output");
  }

  let events: unknown[];
  try {
    events = jsonl.parse(trimmed);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Agent trajectory was not valid JSON: ${detail}\nTrajectory:\n${text}`);
  }

  let lastResult: unknown;

  for (const event of events) {
    const record = asRecord(event);
    if (record?.type === "result") {
      lastResult = event;
    }
  }

  if (lastResult !== undefined) {
    return lastResult;
  }

  if (events.length === 1) {
    return events[0];
  }

  throw new Error("Agent trajectory has no terminal result event");
}
