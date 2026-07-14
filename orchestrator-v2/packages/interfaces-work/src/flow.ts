export type FlowEntry = string | { name: string; args?: unknown[] };

export type NormalizedFlowEntry = { name: string; args: unknown[] };

export function isFlowEntry(value: unknown): value is FlowEntry {
  if (typeof value === "string") {
    return value.length > 0;
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as { name?: unknown; args?: unknown };
  if (typeof record.name !== "string" || record.name.length === 0) {
    return false;
  }

  if (record.args !== undefined && !Array.isArray(record.args)) {
    return false;
  }

  return true;
}

export function normalizeFlowEntry(entry: FlowEntry): NormalizedFlowEntry {
  if (typeof entry === "string") {
    return { name: entry, args: [] };
  }

  return { name: entry.name, args: entry.args ?? [] };
}

export function getFlowEntryName(entry: FlowEntry): string {
  return typeof entry === "string" ? entry : entry.name;
}

export function getFlowEntryArgs(entry: FlowEntry): unknown[] {
  return typeof entry === "string" ? [] : (entry.args ?? []);
}
