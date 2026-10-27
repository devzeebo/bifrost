import type { Response } from "openai/resources/responses/responses.js";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import {
  defineEngine,
  prepareEngines,
  receiveEngines,
  type Engine,
  type EngineCall,
  type EngineResult,
} from "./engine.ts";

type EngineDefinition = Parameters<typeof defineEngine>[0];

const call: EngineCall = {
  body: {
    model: "m1",
    input: [],
    store: false,
    stream: false,
  },
  headers: {},
};

const responseBody = (outputText: string): Response =>
  ({
    id: "resp_1",
    created_at: 0,
    output_text: outputText,
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    model: "m1",
    object: "response",
    output: [],
    parallel_tool_calls: true,
    temperature: null,
    tool_choice: "auto",
    tools: [],
    top_p: null,
    status: "completed",
  }) as Response;

const result = (outputText: string): EngineResult => ({
  body: responseBody(outputText),
  headers: {},
});

describe("defineEngine", () => {
  test("returns an engine that implements one hook", {
    given: {
      a_prepare_definition,
    },
    when: {
      defining_the_engine,
    },
    then: {
      the_engine_keeps_its_name,
      the_engine_has_no_receive_hook,
    },
  });

  test("rejects an empty name", {
    given: {
      a_definition_with_an_empty_name,
    },
    when: {
      defining_the_engine,
    },
    then: {
      expect_error,
    },
  });

  test("rejects an engine with neither hook", {
    given: {
      a_definition_with_no_hooks,
    },
    when: {
      defining_the_engine,
    },
    then: {
      expect_error,
    },
  });
});

describe("prepareEngines", () => {
  test("applies prepare hooks from left to right", {
    given: {
      a_sync_prepare_and_an_async_prepare,
    },
    when: {
      the_call_is_prepared,
    },
    then: {
      both_prepare_headers_are_set,
    },
  });

  test("skips an engine that has no prepare hook", {
    given: {
      a_receive_only_engine,
    },
    when: {
      the_call_is_prepared,
    },
    then: {
      the_call_is_unchanged,
    },
  });
});

describe("receiveEngines", () => {
  test("applies receive hooks from left to right", {
    given: {
      two_receive_hooks,
    },
    when: {
      the_result_is_received,
    },
    then: {
      the_later_hook_sees_the_earlier_text,
    },
  });

  test("skips an engine that has no receive hook", {
    given: {
      a_prepare_only_engine,
    },
    when: {
      the_result_is_received,
    },
    then: {
      the_result_is_unchanged,
    },
  });
});

type Context = {
  definition: EngineDefinition;
  engine: Engine;
  engines: readonly Engine[];
  prepared: EngineCall;
  received: EngineResult;
  errorMessage: string;
};

function a_prepare_definition(this: Context) {
  this.definition = {
    name: "prepare-only",
    prepare: (current) => current,
  };
}

function a_definition_with_an_empty_name(this: Context) {
  this.definition = {
    name: " ",
    prepare: (current) => current,
  };
  this.errorMessage = "Engine name is required";
}

function a_definition_with_no_hooks(this: Context) {
  this.definition = { name: "empty" };
  this.errorMessage = "Engine must implement prepare or receive";
}

function defining_the_engine(this: Context) {
  this.engine = defineEngine(this.definition);
}

function the_engine_keeps_its_name(this: Context) {
  expect(this.engine.name).toBe("prepare-only");
}

function the_engine_has_no_receive_hook(this: Context) {
  expect(this.engine.receive).toBeUndefined();
}

function a_sync_prepare_and_an_async_prepare(this: Context) {
  this.engines = [
    defineEngine({
      name: "first",
      prepare: (current) => ({
        body: current.body,
        headers: { ...current.headers, first: "1" },
      }),
    }),
    defineEngine({
      name: "second",
      prepare: (current) =>
        Promise.resolve({
          body: current.body,
          headers: { ...current.headers, second: "2" },
        }),
    }),
  ];
}

function a_receive_only_engine(this: Context) {
  this.engines = [
    defineEngine({
      name: "receive-only",
      receive: (current) => current,
    }),
  ];
}

async function the_call_is_prepared(this: Context) {
  this.prepared = await prepareEngines(call, this.engines, {});
}

function both_prepare_headers_are_set(this: Context) {
  expect(this.prepared.headers).toEqual({ first: "1", second: "2" });
  expect(this.prepared.body).toBe(call.body);
}

function the_call_is_unchanged(this: Context) {
  expect(this.prepared).toBe(call);
}

function two_receive_hooks(this: Context) {
  this.engines = [
    defineEngine({
      name: "first",
      receive: (current) => ({
        body: { ...current.body, output_text: `${current.body.output_text}+1` },
        headers: current.headers,
      }),
    }),
    defineEngine({
      name: "second",
      receive: (current) =>
        Promise.resolve({
          body: { ...current.body, output_text: `${current.body.output_text}+2` },
          headers: current.headers,
        }),
    }),
  ];
}

function a_prepare_only_engine(this: Context) {
  this.engines = [
    defineEngine({
      name: "prepare-only",
      prepare: (current) => current,
    }),
  ];
}

async function the_result_is_received(this: Context) {
  this.received = await receiveEngines(result("hello"), this.engines, {});
}

function the_later_hook_sees_the_earlier_text(this: Context) {
  expect(this.received.body.output_text).toBe("hello+1+2");
}

function the_result_is_unchanged(this: Context) {
  expect(this.received.body.output_text).toBe("hello");
}

function expect_error(this: Context, error: Error) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe(this.errorMessage);
}
