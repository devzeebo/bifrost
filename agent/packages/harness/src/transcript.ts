import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ResponseInputItem } from "openai/resources/responses/responses.js";

export type TranscriptItem = ResponseInputItem;

export type Transcript = {
  appendLine: (item: TranscriptItem) => Promise<void>;
  snapshot: () => readonly TranscriptItem[];
};

export type TranscriptOptions = {
  readonly folder: string;
  readonly sessionId: string;
};

const sessionFileName = (sessionId: string): string => {
  if (!/^[A-Za-z0-9._-]+$/.test(sessionId) || sessionId === "." || sessionId === "..") {
    throw new Error("Session id must be a file name");
  }
  return `${sessionId}.jsonl`;
};

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

const parseLines = (contents: string): TranscriptItem[] => {
  if (contents === "") {
    return [];
  }
  const lines = contents.endsWith("\n") ? contents.slice(0, -1).split("\n") : contents.split("\n");
  return lines.map((line, index) => {
    if (line === "") {
      throw new Error(`Transcript line ${index + 1} is empty`);
    }
    try {
      return JSON.parse(line) as TranscriptItem;
    } catch {
      throw new Error(`Transcript line ${index + 1} is not valid JSON`);
    }
  });
};

const readLines = async (path: string): Promise<TranscriptItem[]> => {
  try {
    return parseLines(await readFile(path, "utf8"));
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
};

export const createTranscript = async ({
  folder,
  sessionId,
}: TranscriptOptions): Promise<Transcript> => {
  const directory = folder.trim();
  if (directory === "") {
    throw new Error("Transcript folder is required");
  }

  await mkdir(directory, { recursive: true });
  const path = join(directory, sessionFileName(sessionId));
  const input = await readLines(path);

  return {
    appendLine: async (item) => {
      input.push(item);
      try {
        await appendFile(path, `${JSON.stringify(item)}\n`, "utf8");
      } catch (error) {
        input.pop();
        throw error;
      }
    },
    snapshot: () => [...input],
  };
};
