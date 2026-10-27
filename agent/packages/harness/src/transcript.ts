import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ResponseInputItem } from "openai/resources/responses/responses.js";

import type { LineUsage } from "./usage.ts";

export type TranscriptItem = ResponseInputItem;

export type TranscriptLine = TranscriptItem & {
  readonly usage?: LineUsage;
};

export type SessionMetrics = {
  readonly turns: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly cachedTokens: number;
  readonly cacheWriteTokens: number;
  readonly reasoningTokens: number;
  readonly cost: number;
};

export type Transcript = {
  appendLine: (item: TranscriptLine) => Promise<void>;
  recordTurn: (usage?: LineUsage) => Promise<void>;
  snapshot: () => readonly TranscriptLine[];
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

const metricsFileName = (sessionId: string): string => {
  const transcriptName = sessionFileName(sessionId);
  return `${transcriptName.slice(0, -".jsonl".length)}_metrics.json`;
};

const emptyMetrics = (): SessionMetrics => ({
  turns: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  cachedTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
  cost: 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readMetric = (value: Record<string, unknown>, name: keyof SessionMetrics): number => {
  const field = value[name];
  if (typeof field !== "number" || !Number.isFinite(field)) {
    throw new Error(`Metrics field ${name} must be a finite number`);
  }
  return field;
};

const parseMetrics = (contents: string): SessionMetrics => {
  let value: unknown;
  try {
    value = JSON.parse(contents) as unknown;
  } catch {
    throw new Error("Metrics file is not valid JSON");
  }
  if (!isRecord(value)) {
    throw new Error("Metrics file must be an object");
  }
  return {
    turns: readMetric(value, "turns"),
    inputTokens: readMetric(value, "inputTokens"),
    outputTokens: readMetric(value, "outputTokens"),
    totalTokens: readMetric(value, "totalTokens"),
    cachedTokens: readMetric(value, "cachedTokens"),
    cacheWriteTokens: readMetric(value, "cacheWriteTokens"),
    reasoningTokens: readMetric(value, "reasoningTokens"),
    cost: readMetric(value, "cost"),
  };
};

const addTurn = (metrics: SessionMetrics, usage: LineUsage | undefined): SessionMetrics => ({
  turns: metrics.turns + 1,
  inputTokens: metrics.inputTokens + (usage?.inputTokens ?? 0),
  outputTokens: metrics.outputTokens + (usage?.outputTokens ?? 0),
  totalTokens: metrics.totalTokens + (usage?.totalTokens ?? 0),
  cachedTokens: metrics.cachedTokens + (usage?.cachedTokens ?? 0),
  cacheWriteTokens: metrics.cacheWriteTokens + (usage?.cacheWriteTokens ?? 0),
  reasoningTokens: metrics.reasoningTokens + (usage?.reasoningTokens ?? 0),
  cost: metrics.cost + (usage?.cost ?? 0),
});

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

const readMetrics = async (path: string): Promise<SessionMetrics> => {
  try {
    return parseMetrics(await readFile(path, "utf8"));
  } catch (error) {
    if (isNotFound(error)) {
      return emptyMetrics();
    }
    throw error;
  }
};

const parseLines = (contents: string): TranscriptLine[] => {
  if (contents === "") {
    return [];
  }
  const lines = contents.endsWith("\n") ? contents.slice(0, -1).split("\n") : contents.split("\n");
  return lines.map((line, index) => {
    if (line === "") {
      throw new Error(`Transcript line ${index + 1} is empty`);
    }
    try {
      return JSON.parse(line) as TranscriptLine;
    } catch {
      throw new Error(`Transcript line ${index + 1} is not valid JSON`);
    }
  });
};

const readLines = async (path: string): Promise<TranscriptLine[]> => {
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
  const metricsPath = join(directory, metricsFileName(sessionId));
  const input = await readLines(path);
  let metrics = await readMetrics(metricsPath);

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
    recordTurn: async (usage) => {
      const previous = metrics;
      metrics = addTurn(metrics, usage);
      try {
        await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
      } catch (error) {
        metrics = previous;
        throw error;
      }
    },
    snapshot: () => [...input],
  };
};
