import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect } from "vite-plus/test";
import test, { withAspect } from "vitest-gwt";

import { createTranscript, type Transcript, type TranscriptItem } from "./transcript.ts";

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

function the_first_line_was_not_rewritten(this: Context) {
  expect(this.fileAfterFirstLine).toBe(`${JSON.stringify(this.firstLine)}\n`);
}

function expect_error(this: Context, error: Error) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe(this.errorMessage);
}
