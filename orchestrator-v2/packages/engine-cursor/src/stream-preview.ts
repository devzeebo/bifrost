import type { SDKMessage } from "@cursor/sdk";

const formatToolInput = (input: unknown): string => {
  if (!input || typeof input !== "object") {
    // oxlint-disable-next-line typescript/no-base-to-string -- will never be "[object Object]"
    return String(input ?? "");
  }
  const entries = Object.entries(input as Record<string, unknown>).slice(0, 3);
  return entries.map(([key, val]) => `${key}=${String(val)}`).join(", ");
};

const extractAssistantPreview = (message: SDKMessage): string | null => {
  if (message.type !== "assistant") {
    return null;
  }

  const content = message.message.content;
  const parts: string[] = [];

  for (const block of content) {
    if (block.type === "text" && block.text) {
      parts.push(block.text.replace(/\n/g, " "));
    } else if (block.type === "tool_use" && block.name) {
      const args = formatToolInput(block.input);
      parts.push(`ToolCall(${block.name}${args ? `, ${args}` : ""})`);
    }
  }

  return parts.length > 0 ? parts.join(" | ") : null;
};

export const getMessagePreview = (message: SDKMessage): string => {
  if (message.type === "assistant") {
    return extractAssistantPreview(message) ?? "";
  }

  if (message.type === "thinking") {
    return message.text.replace(/\n/g, " ");
  }

  if (message.type === "tool_call") {
    return `ToolCall(${message.name}, ${message.status})`;
  }

  if (message.type === "user") {
    const parts: string[] = [];
    for (const block of message.message.content) {
      if (block.type === "text" && block.text) {
        parts.push(block.text.replace(/\n/g, " "));
      }
    }
    return parts.join(" | ");
  }

  return "";
};
