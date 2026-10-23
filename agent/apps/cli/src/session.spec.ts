import type { TranscriptItem } from "@agent/harness";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { readSession, serializeSession } from "./session.ts";

describe("readSession", () => {
  test("reads the transcript it wrote", {
    given: {
      a_serialized_session,
    },
    when: {
      the_session_is_read,
    },
    then: {
      the_transcript_matches,
    },
  });

  test("rejects a session with another version", {
    given: {
      a_session_with_version_two,
    },
    when: {
      the_session_is_read,
    },
    then: {
      expect_error,
    },
  });
});

type Context = {
  contents: string;
  input: readonly TranscriptItem[];
  read: TranscriptItem[];
};

function a_serialized_session(this: Context) {
  this.input = [{ role: "user", content: "hello" }];
  this.contents = serializeSession(this.input);
}

function a_session_with_version_two(this: Context) {
  this.contents = JSON.stringify({ version: 2, input: [] });
}

function the_session_is_read(this: Context) {
  this.read = readSession(this.contents);
}

function the_transcript_matches(this: Context) {
  expect(this.read).toEqual(this.input);
}

function expect_error(this: Context, error: Error) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe("Session file must be { version: 1, input: [] }");
}
