import type { TranscriptItem } from "@agent/harness";

export type SessionFile = {
  readonly version: 1;
  readonly input: readonly TranscriptItem[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSessionFile = (value: unknown): value is SessionFile => {
  if (!isRecord(value) || value["version"] !== 1 || !Array.isArray(value["input"])) {
    return false;
  }
  return value["input"].every((item) => isRecord(item));
};

export const readSession = (contents: string): TranscriptItem[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("Session file is not valid JSON");
  }
  if (!isSessionFile(parsed)) {
    throw new Error("Session file must be { version: 1, input: [] }");
  }
  return [...parsed.input];
};

export const serializeSession = (input: readonly TranscriptItem[]): string =>
  `${JSON.stringify({ version: 1, input }, null, 2)}\n`;
