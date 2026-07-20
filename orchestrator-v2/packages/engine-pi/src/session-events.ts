import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { Debugger } from "debug";

const asScalar = (value: unknown, fallback = "-"): string => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return `${value}`;
  }
  if (value === undefined || value === null) {
    return fallback;
  }
  return fallback;
};

const preview = (value: unknown, max = 200): string => {
  if (value === undefined || value === null) {
    return "-";
  }
  if (typeof value === "string") {
    const oneLine = value.replace(/\s+/g, " ").trim();
    return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return `${value}`;
  }
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json.length > max ? `${json.slice(0, max)}…` : json;
    } catch {
      return "[unserializable]";
    }
  }
  return "-";
};

const formatToolArgs = (args: unknown): string => {
  if (!args || typeof args !== "object") {
    return preview(args);
  }
  const entries = Object.entries(args as Record<string, unknown>).slice(0, 4);
  return entries.map(([key, val]) => `${key}=${preview(val, 80)}`).join(", ") || "-";
};

const messageField = (message: unknown, field: "role" | "stopReason"): string => {
  if (message === undefined || message === null || typeof message !== "object") {
    return "-";
  }
  if (!(field in message)) {
    return "-";
  }
  return asScalar((message as Record<string, unknown>)[field]);
};

/**
 * Log high-signal Pi session events. Skips noisy streaming deltas so hangs
 * after partial output are still obvious from the last lifecycle line.
 */
export function logSessionEvent(debug: Debugger, event: AgentSessionEvent): void {
  switch (event.type) {
    case "agent_start":
      debug("event agent_start");
      break;
    case "agent_end":
      debug("event agent_end willRetry=%s messages=%s", event.willRetry, event.messages.length);
      break;
    case "agent_settled":
      debug("event agent_settled");
      break;
    case "turn_start":
      debug("event turn_start");
      break;
    case "turn_end":
      debug(
        "event turn_end stopReason=%s toolResults=%s",
        messageField(event.message, "stopReason"),
        event.toolResults?.length ?? 0,
      );
      break;
    case "message_start":
      debug("event message_start role=%s", messageField(event.message, "role"));
      break;
    case "message_update": {
      const update = event.assistantMessageEvent;
      if (update.type === "text_end") {
        debug("text: %s", preview(update.content, 500));
      } else if (update.type === "thinking_end") {
        debug("thinking: %s", preview(update.content, 300));
      } else if (update.type === "toolcall_end") {
        debug(
          "toolcall: %s args=%s",
          asScalar(update.toolCall.name, "?"),
          formatToolArgs(update.toolCall.arguments),
        );
      }
      // Skip text_delta / thinking_delta / toolcall_delta noise
      break;
    }
    case "message_end":
      debug(
        "event message_end role=%s stopReason=%s",
        messageField(event.message, "role"),
        messageField(event.message, "stopReason"),
      );
      break;
    case "tool_execution_start":
      debug(
        "event tool_start name=%s id=%s args=%s",
        event.toolName,
        event.toolCallId,
        formatToolArgs(event.args),
      );
      break;
    case "tool_execution_end":
      debug(
        "event tool_end name=%s id=%s isError=%s result=%s",
        event.toolName,
        event.toolCallId,
        event.isError,
        preview(event.result, 300),
      );
      break;
    case "auto_retry_start":
      debug(
        "event auto_retry_start attempt=%s/%s delayMs=%s error=%s",
        event.attempt,
        event.maxAttempts,
        event.delayMs,
        preview(event.errorMessage, 200),
      );
      break;
    case "auto_retry_end":
      debug(
        "event auto_retry_end success=%s attempt=%s finalError=%s",
        event.success,
        event.attempt,
        preview(event.finalError, 200),
      );
      break;
    case "compaction_start":
      debug("event compaction_start reason=%s", event.reason);
      break;
    case "compaction_end":
      debug(
        "event compaction_end reason=%s aborted=%s willRetry=%s error=%s",
        event.reason,
        event.aborted,
        event.willRetry,
        preview(event.errorMessage, 200),
      );
      break;
    case "queue_update":
      debug(
        "event queue_update steering=%s followUp=%s",
        event.steering.length,
        event.followUp.length,
      );
      break;
    default:
      debug("event %s", event.type);
      break;
  }
}

export type SessionActivity = {
  lastEventType: string;
  lastEventAt: number;
};

export function createPromptHeartbeat(
  debug: Debugger,
  activity: SessionActivity,
  intervalMs = 15_000,
): () => void {
  const startedAt = Date.now();
  const timer = setInterval(() => {
    const idleMs = Date.now() - activity.lastEventAt;
    debug(
      "heartbeat waitingOnPrompt elapsedMs=%s idleSinceLastEventMs=%s lastEvent=%s",
      Date.now() - startedAt,
      idleMs,
      activity.lastEventType,
    );
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
