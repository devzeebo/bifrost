export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function extractTextContent(message: unknown): string {
  const record = asRecord(message);
  const content = record?.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }

  const parts: string[] = [];
  for (const block of content) {
    const item = asRecord(block);
    if (item?.type === "text" && typeof item.text === "string") {
      parts.push(item.text);
    }
  }
  return parts.join("");
}
