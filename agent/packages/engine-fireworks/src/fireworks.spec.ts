import type { EngineCall, EngineContext } from "@agent/engines";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { fireworksEngine } from "./fireworks.ts";

const call: EngineCall = {
  body: {
    model: "accounts/fireworks/models/glm",
    input: "hello",
    store: false,
    stream: false,
  },
  headers: { "x-existing": "1" },
};

describe("fireworksEngine", () => {
  test("sets session affinity from the session id", {
    given: {
      a_session_id,
    },
    when: {
      the_call_is_prepared,
    },
    then: {
      the_affinity_header_is_the_session_id,
      the_body_is_unchanged,
      receive_is_absent,
    },
  });

  test("omits session affinity when the session id is missing", {
    given: {
      no_session_id,
    },
    when: {
      the_call_is_prepared,
    },
    then: {
      the_call_is_unchanged,
    },
  });
});

type Context = {
  context: EngineContext;
  prepared: EngineCall;
};

function a_session_id(this: Context) {
  this.context = { sessionId: "session-1" };
}

function no_session_id(this: Context) {
  this.context = {};
}

async function the_call_is_prepared(this: Context) {
  if (fireworksEngine.prepare === undefined) {
    throw new Error("expected a prepare hook");
  }
  this.prepared = await fireworksEngine.prepare(call, this.context);
}

function the_affinity_header_is_the_session_id(this: Context) {
  expect(this.prepared.headers).toEqual({
    "x-existing": "1",
    "x-session-affinity": "session-1",
  });
}

function the_body_is_unchanged(this: Context) {
  expect(this.prepared.body).toBe(call.body);
}

function the_call_is_unchanged(this: Context) {
  expect(this.prepared).toBe(call);
}

function receive_is_absent() {
  expect(fireworksEngine.receive).toBeUndefined();
}
