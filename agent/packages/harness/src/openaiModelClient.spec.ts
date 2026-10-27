import { defineEngine, type Engine } from "@agent/engines";
import { describe, expect, vi } from "vite-plus/test";
import test from "vitest-gwt";

import type { ModelResponse } from "./modelClient.ts";
import { createOpenAIModelClient } from "./openaiModelClient.ts";

const { create } = vi.hoisted(() => ({
  create: vi.fn<
    (
      body: unknown,
      options?: unknown,
    ) => {
      withResponse: () => Promise<{
        data: {
          status: string;
          output_text: string;
          output: readonly never[];
          usage: {
            input_tokens: number;
            output_tokens: number;
            total_tokens: number;
          };
        };
        response: Response;
        request_id: null;
      }>;
    }
  >(),
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = { create };
  },
}));

const completedBody = {
  status: "completed",
  output_text: "hello",
  output: [],
  usage: { input_tokens: 3, output_tokens: 4, total_tokens: 7 },
};

describe("createOpenAIModelClient", () => {
  test("sends headers added by a prepare hook", {
    given: {
      a_prepare_engine,
    },
    when: {
      a_response_is_created,
    },
    then: {
      the_create_call_includes_the_header,
      the_mapped_response_keeps_the_text,
    },
  });

  test("maps the body returned by a receive hook", {
    given: {
      a_receive_engine,
    },
    when: {
      a_response_is_created,
    },
    then: {
      the_mapped_response_uses_the_rewritten_text,
    },
  });
});

type Context = {
  engines: readonly Engine[];
  response: ModelResponse;
};

function a_prepare_engine(this: Context) {
  this.engines = [
    defineEngine({
      name: "affinity",
      prepare: (call, context) => ({
        body: call.body,
        headers: {
          ...call.headers,
          "x-session-affinity": context.sessionId ?? "",
        },
      }),
    }),
  ];
}

function a_receive_engine(this: Context) {
  this.engines = [
    defineEngine({
      name: "rewrite",
      receive: (result) => ({
        headers: result.headers,
        body: {
          ...result.body,
          output_text: result.headers["x-cache"] ?? result.body.output_text,
        },
      }),
    }),
  ];
}

async function a_response_is_created(this: Context) {
  create.mockReset();
  create.mockImplementation(() => ({
    withResponse: () =>
      Promise.resolve({
        data: completedBody,
        response: new Response(null, { headers: { "x-cache": "hit" } }),
        request_id: null,
      }),
  }));
  const client = createOpenAIModelClient({ engines: this.engines });
  this.response = await client.createResponse({
    model: "m1",
    input: [],
    tools: [],
    store: false,
    sessionId: "session-1",
  });
}

function the_create_call_includes_the_header() {
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ model: "m1", stream: false, store: false }),
    { headers: { "x-session-affinity": "session-1" } },
  );
}

function the_mapped_response_keeps_the_text(this: Context) {
  expect(this.response).toEqual({
    status: "completed",
    outputText: "hello",
    output: [],
    usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
  });
}

function the_mapped_response_uses_the_rewritten_text(this: Context) {
  expect(this.response.outputText).toBe("hit");
}
