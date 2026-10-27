import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect } from "vite-plus/test";
import test, { withAspect } from "vitest-gwt";

import {
  createTranscript,
  type SessionMetrics,
  type Transcript,
  type TranscriptItem,
} from "./transcript.ts";
import type { LineUsage } from "./usage.ts";

describe("createTranscript", () => {
  withAspect(
    async function (this: Context) {
      this.folder = await mkdtemp(join(tmpdir(), "agent-transcript-"));
    },
    async function (this: Context) {
      await rm(this.folder, { recursive: true, force: true });
    },
  );

  test("appends each line to the array and the session file", {
    given: {
      a_new_session,
    },
    when: {
      two_lines_are_appended,
    },
    then: {
      the_snapshot_has_both_lines,
      the_file_is_the_two_lines,
      the_first_line_was_not_rewritten,
    },
  });

  test("loads an existing session and only appends new lines", {
    given: {
      a_session_file_with_one_line,
    },
    when: {
      the_transcript_is_opened_and_one_line_is_appended,
    },
    then: {
      the_snapshot_has_both_lines,
      the_file_is_the_two_lines,
    },
  });

  test("writes session metrics on each turn", {
    given: {
      a_new_session,
      two_turn_usages,
    },
    when: {
      two_turns_are_recorded,
    },
    then: {
      the_metrics_file_after_the_first_turn_has_that_turn,
      the_metrics_file_has_both_turns,
    },
  });

  test("continues metrics from an existing session file", {
    given: {
      a_session_with_saved_metrics,
    },
    when: {
      another_turn_is_recorded,
    },
    then: {
      the_metrics_file_includes_the_saved_total,
    },
  });

  test("rejects a metrics file that is not finite numbers", {
    given: {
      a_metrics_file_with_a_bad_turn_count,
    },
    when: {
      the_transcript_is_opened,
    },
    then: {
      expect_error,
    },
  });

  test("rejects a session id that is not a file name", {
    given: {
      a_session_id_with_a_path,
    },
    when: {
      the_transcript_is_opened,
    },
    then: {
      expect_error,
    },
  });
});

type Context = {
  folder: string;
  sessionId: string;
  transcript: Transcript;
  firstLine: TranscriptItem;
  secondLine: TranscriptItem;
  fileAfterFirstLine: string;
  errorMessage: string;
  firstUsage: LineUsage;
  secondUsage: LineUsage;
  metricsAfterFirstTurn: SessionMetrics;
  savedMetrics: SessionMetrics;
};

function a_new_session(this: Context) {
  this.sessionId = "session-1";
  this.firstLine = { role: "user", content: "hello" };
  this.secondLine = { role: "user", content: "again" };
}

async function a_session_file_with_one_line(this: Context) {
  this.sessionId = "session-1";
  this.firstLine = { role: "user", content: "hello" };
  this.secondLine = { role: "user", content: "again" };
  await writeFile(
    join(this.folder, "session-1.jsonl"),
    `${JSON.stringify(this.firstLine)}\n`,
    "utf8",
  );
}

function two_turn_usages(this: Context) {
  this.firstUsage = {
    inputTokens: 11,
    outputTokens: 4,
    totalTokens: 15,
    cachedTokens: 7,
    cacheWriteTokens: 2,
    reasoningTokens: 1,
    cost: 0.02,
  };
  this.secondUsage = {
    inputTokens: 20,
    outputTokens: 3,
    totalTokens: 23,
    cost: 0.03,
  };
}

async function a_session_with_saved_metrics(this: Context) {
  this.sessionId = "session-1";
  this.savedMetrics = {
    turns: 1,
    inputTokens: 11,
    outputTokens: 4,
    totalTokens: 15,
    cachedTokens: 7,
    cacheWriteTokens: 2,
    reasoningTokens: 1,
    cost: 0.02,
  };
  this.secondUsage = {
    inputTokens: 5,
    outputTokens: 1,
    totalTokens: 6,
  };
  await writeFile(
    join(this.folder, "session-1_metrics.json"),
    `${JSON.stringify(this.savedMetrics)}\n`,
    "utf8",
  );
}

async function a_metrics_file_with_a_bad_turn_count(this: Context) {
  this.sessionId = "session-1";
  this.errorMessage = "Metrics field turns must be a finite number";
  await writeFile(join(this.folder, "session-1_metrics.json"), '{"turns":"nope"}\n', "utf8");
}

function a_session_id_with_a_path(this: Context) {
  this.sessionId = "../secret";
  this.errorMessage = "Session id must be a file name";
}

async function two_lines_are_appended(this: Context) {
  this.transcript = await createTranscript({ folder: this.folder, sessionId: this.sessionId });
  await this.transcript.appendLine(this.firstLine);
  this.fileAfterFirstLine = await readFile(join(this.folder, `${this.sessionId}.jsonl`), "utf8");
  await this.transcript.appendLine(this.secondLine);
}

async function the_transcript_is_opened_and_one_line_is_appended(this: Context) {
  this.transcript = await createTranscript({ folder: this.folder, sessionId: this.sessionId });
  await this.transcript.appendLine(this.secondLine);
}

const metricsPath = (folder: string, sessionId: string): string =>
  join(folder, `${sessionId}_metrics.json`);

const summedMetrics = (first: SessionMetrics, usage: LineUsage): SessionMetrics => ({
  turns: first.turns + 1,
  inputTokens: first.inputTokens + usage.inputTokens,
  outputTokens: first.outputTokens + usage.outputTokens,
  totalTokens: first.totalTokens + usage.totalTokens,
  cachedTokens: first.cachedTokens + (usage.cachedTokens ?? 0),
  cacheWriteTokens: first.cacheWriteTokens + (usage.cacheWriteTokens ?? 0),
  reasoningTokens: first.reasoningTokens + (usage.reasoningTokens ?? 0),
  cost: first.cost + (usage.cost ?? 0),
});

async function two_turns_are_recorded(this: Context) {
  this.transcript = await createTranscript({ folder: this.folder, sessionId: this.sessionId });
  await this.transcript.recordTurn(this.firstUsage);
  this.metricsAfterFirstTurn = JSON.parse(
    await readFile(metricsPath(this.folder, this.sessionId), "utf8"),
  ) as SessionMetrics;
  await this.transcript.recordTurn(this.secondUsage);
}

async function another_turn_is_recorded(this: Context) {
  this.transcript = await createTranscript({ folder: this.folder, sessionId: this.sessionId });
  await this.transcript.recordTurn(this.secondUsage);
}

async function the_transcript_is_opened(this: Context) {
  await createTranscript({ folder: this.folder, sessionId: this.sessionId });
}

function the_snapshot_has_both_lines(this: Context) {
  expect(this.transcript.snapshot()).toEqual([this.firstLine, this.secondLine]);
}

async function the_file_is_the_two_lines(this: Context) {
  const contents = await readFile(join(this.folder, `${this.sessionId}.jsonl`), "utf8");
  expect(contents).toBe(`${JSON.stringify(this.firstLine)}\n${JSON.stringify(this.secondLine)}\n`);
}

function the_metrics_file_after_the_first_turn_has_that_turn(this: Context) {
  expect(this.metricsAfterFirstTurn).toEqual({
    turns: 1,
    inputTokens: 11,
    outputTokens: 4,
    totalTokens: 15,
    cachedTokens: 7,
    cacheWriteTokens: 2,
    reasoningTokens: 1,
    cost: 0.02,
  });
}

async function the_metrics_file_has_both_turns(this: Context) {
  const metrics = JSON.parse(
    await readFile(metricsPath(this.folder, this.sessionId), "utf8"),
  ) as SessionMetrics;
  expect(metrics).toEqual(summedMetrics(this.metricsAfterFirstTurn, this.secondUsage));
}

async function the_metrics_file_includes_the_saved_total(this: Context) {
  const metrics = JSON.parse(
    await readFile(metricsPath(this.folder, this.sessionId), "utf8"),
  ) as SessionMetrics;
  expect(metrics).toEqual(summedMetrics(this.savedMetrics, this.secondUsage));
}

function the_first_line_was_not_rewritten(this: Context) {
  expect(this.fileAfterFirstLine).toBe(`${JSON.stringify(this.firstLine)}\n`);
}

function expect_error(this: Context, error: Error) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe(this.errorMessage);
}
