import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineTool, type Tool } from "@agent/tools";
import type { ResponseOutputItem } from "openai/resources/responses/responses.js";
import { describe, expect } from "vite-plus/test";
import test, { withAspect } from "vitest-gwt";

import { createHarness, type RunResult } from "./harness.ts";
import type { SessionMetrics } from "./transcript.ts";
import type { ModelClient, ModelRequest, ModelResponse } from "./modelClient.ts";
import type { LineUsage } from "./usage.ts";

const emptyParameters = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

const message = (text: string): ModelResponse => ({
  status: "completed",
  outputText: text,
  output: [
    {
      id: "msg_1",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text, annotations: [] }],
    },
  ],
});

const refusal = (text: string): ModelResponse => ({
  status: "completed",
  outputText: "",
  output: [
    {
      id: "msg_refusal",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "refusal", refusal: text }],
    },
  ],
});

const functionCall = (name: string, callId: string, args = "{}"): ResponseOutputItem => ({
  type: "function_call",
  name,
  arguments: args,
  call_id: callId,
});

const functionCalls = (
  calls: readonly { readonly name: string; readonly callId: string }[],
): ModelResponse => ({
  status: "completed",
  outputText: "",
  output: calls.map((call) => functionCall(call.name, call.callId)),
});

const echoTool = (
  execute: Tool<{ readonly text: string }>["execute"],
): Tool<{ readonly text: string }> =>
  defineTool({
    name: "echo",
    description: "Echoes text",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    execute,
  });

const parseJsonl = (contents: string): unknown[] =>
  contents
    .slice(0, contents.endsWith("\n") ? -1 : undefined)
    .split("\n")
    .map((line) => JSON.parse(line) as unknown);

describe("createHarness", () => {
  withAspect(
    async function (this: Context) {
      this.transcriptFolder = await mkdtemp(join(tmpdir(), "agent-transcript-"));
    },
    async function (this: Context) {
      await rm(this.transcriptFolder, { recursive: true, force: true });
      if (this.envFolder !== undefined) {
        await rm(this.envFolder, { recursive: true, force: true });
      }
    },
  );

  test("returns assistant text when the model does not call a tool", {
    given: {
      instructions_and_a_text_response,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      the_run_completes_with_the_text,
      the_request_includes_the_prompt_and_instructions,
    },
  });

  test("records response usage on each model line and leaves it out of the next request", {
    given: {
      tool_calls_with_usage_followed_by_text,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      each_model_line_keeps_its_response_usage,
      the_follow_up_request_omits_usage,
      the_metrics_file_sums_each_response_once,
    },
  });

  test("sends tool output back and finishes with the following message", {
    given: {
      a_tool_call_followed_by_text,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      the_run_completes_with_the_text,
      the_transcript_keeps_the_call_id,
    },
  });

  test("runs every tool call from one response together", {
    given: {
      two_tool_calls_then_text,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      both_tools_ran_at_the_same_time,
      the_transcript_keeps_both_call_ids,
    },
  });

  test("feeds a thrown tool error back to the model", {
    given: {
      a_tool_that_throws_then_text,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      the_run_completes_with_the_text,
      the_model_received_the_tool_error,
    },
  });

  test("feeds unparseable tool arguments back to the model", {
    given: {
      a_tool_call_with_invalid_json_then_text,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      the_model_received_the_invalid_json_error,
    },
  });

  test("feeds an unknown tool name back to the model", {
    given: {
      an_unknown_tool_call_then_text,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      the_run_completes_with_the_text,
      the_model_received_the_unknown_tool_error,
    },
  });

  test("stops after the default number of model responses", {
    given: {
      a_model_that_always_calls_a_tool,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      the_run_stops_at_the_turn_limit,
    },
  });

  test("fails when the response does not complete", {
    given: {
      an_incomplete_response,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      the_run_fails_before_recording_model_output,
    },
  });

  test("fails when the model client throws", {
    given: {
      a_client_that_throws,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      the_run_fails_with_the_client_error,
    },
  });

  test("returns the refusal text", {
    given: {
      a_refusal,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      the_run_is_refused,
    },
  });

  test("rejects two tools with the same name", {
    given: {
      two_tools_named_echo,
    },
    when: {
      the_harness_is_created,
    },
    then: {
      expect_error,
    },
  });

  test("writes each turn to the transcript file before the next model call", {
    given: {
      a_tool_call_that_records_the_file_before_the_next_turn,
    },
    when: {
      the_prompt_is_run,
    },
    then: {
      the_run_completes_with_the_text,
      the_file_was_written_before_the_next_turn,
      the_transcript_file_matches_the_snapshot,
    },
  });

  test("reads the transcript folder from the environment", {
    given: {
      instructions_and_a_text_response,
    },
    when: {
      the_prompt_is_run_with_the_folder_env,
    },
    then: {
      the_run_completes_with_the_text,
      the_env_folder_contains_the_session_file,
    },
  });

  test("requires a transcript folder", {
    given: {
      no_folder_is_configured,
    },
    when: {
      the_prompt_is_run_without_a_folder,
    },
    then: {
      expect_error,
    },
  });
});

type Context = {
  client: ModelClient;
  requests: ModelRequest[];
  tools: Tool<never>[];
  instructions?: string;
  maxTurns?: number;
  prompt: string;
  expectedText: string;
  result: RunResult;
  maxInFlight: number;
  errorMessage: string;
  transcriptFolder: string;
  envFolder?: string;
  persistedBeforeSecondTurn: string;
  usage: LineUsage;
  followUpUsage: LineUsage;
};

function scripted(this: Context, responses: readonly ModelResponse[]) {
  const queue = [...responses];
  this.requests = [];
  this.client = {
    createResponse: (request) => {
      this.requests.push(request);
      const next = queue.shift();
      if (next === undefined) {
        return Promise.reject(new Error("No scripted response"));
      }
      return Promise.resolve(next);
    },
  };
}

function instructions_and_a_text_response(this: Context) {
  scripted.call(this, [message("hello back")]);
  this.tools = [];
  this.instructions = "Be brief";
  this.prompt = "Hello";
  this.expectedText = "hello back";
}

function tool_calls_with_usage_followed_by_text(this: Context) {
  this.usage = {
    inputTokens: 11,
    outputTokens: 4,
    totalTokens: 15,
    cachedTokens: 7,
    cacheWriteTokens: 2,
    reasoningTokens: 1,
    cost: 0.02,
  };
  this.followUpUsage = {
    inputTokens: 20,
    outputTokens: 3,
    totalTokens: 23,
    cost: 0.03,
  };
  scripted.call(this, [
    {
      ...functionCalls([
        { name: "one", callId: "call_one" },
        { name: "two", callId: "call_two" },
      ]),
      usage: this.usage,
    },
    { ...message("both"), usage: this.followUpUsage },
  ]);
  this.tools = [
    defineTool({
      name: "one",
      description: "First tool",
      parameters: emptyParameters,
      execute: () => "one",
    }),
    defineTool({
      name: "two",
      description: "Second tool",
      parameters: emptyParameters,
      execute: () => "two",
    }),
  ];
  this.prompt = "Both";
}

function a_tool_call_followed_by_text(this: Context) {
  scripted.call(this, [functionCalls([{ name: "echo", callId: "call_1" }]), message("done")]);
  this.tools = [echoTool(() => "pong")];
  this.prompt = "Ping";
  this.expectedText = "done";
}

function two_tool_calls_then_text(this: Context) {
  scripted.call(this, [
    functionCalls([
      { name: "one", callId: "call_one" },
      { name: "two", callId: "call_two" },
    ]),
    message("both"),
  ]);
  let inFlight = 0;
  this.maxInFlight = 0;
  const track = (name: string): Tool["execute"] => {
    return async () => {
      inFlight += 1;
      this.maxInFlight = Math.max(this.maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return name;
    };
  };
  this.tools = [
    defineTool({
      name: "one",
      description: "First tool",
      parameters: emptyParameters,
      execute: track("one"),
    }),
    defineTool({
      name: "two",
      description: "Second tool",
      parameters: emptyParameters,
      execute: track("two"),
    }),
  ];
  this.prompt = "Both";
}

function a_tool_that_throws_then_text(this: Context) {
  scripted.call(this, [
    functionCalls([{ name: "echo", callId: "call_err" }]),
    message("recovered"),
  ]);
  this.tools = [
    echoTool(() => {
      throw new Error("boom");
    }),
  ];
  this.prompt = "Break";
  this.expectedText = "recovered";
}

function a_tool_call_with_invalid_json_then_text(this: Context) {
  scripted.call(this, [
    {
      status: "completed",
      outputText: "",
      output: [functionCall("echo", "call_bad", "{")],
    },
    message("ok"),
  ]);
  this.tools = [echoTool(() => "unused")];
  this.prompt = "Break the arguments";
}

function an_unknown_tool_call_then_text(this: Context) {
  scripted.call(this, [
    functionCalls([{ name: "missing", callId: "call_missing" }]),
    message("ok"),
  ]);
  this.tools = [];
  this.prompt = "Call something";
  this.expectedText = "ok";
}

function a_model_that_always_calls_a_tool(this: Context) {
  this.requests = [];
  this.client = {
    createResponse: (request) => {
      this.requests.push(request);
      return Promise.resolve(functionCalls([{ name: "echo", callId: "call_repeat" }]));
    },
  };
  this.tools = [echoTool(() => "ok")];
  this.prompt = "Loop";
}

function an_incomplete_response(this: Context) {
  scripted.call(this, [{ status: "incomplete", outputText: "", output: [] }]);
  this.tools = [];
  this.prompt = "Stop";
}

function a_client_that_throws(this: Context) {
  this.requests = [];
  this.client = {
    createResponse: () => Promise.reject(new Error("network down")),
  };
  this.tools = [];
  this.prompt = "Hello";
}

function a_refusal(this: Context) {
  scripted.call(this, [refusal("I will not do that")]);
  this.tools = [];
  this.prompt = "Do the thing";
}

function two_tools_named_echo(this: Context) {
  this.client = {
    createResponse: () => Promise.reject(new Error("unused")),
  };
  this.tools = [echoTool(() => "a"), echoTool(() => "b")];
  this.errorMessage = "Duplicate tool name: echo";
}

async function the_prompt_is_run(this: Context) {
  const harness = createHarness({
    client: this.client,
    model: "test-model",
    tools: this.tools,
    transcriptFolder: this.transcriptFolder,
    sessionId: "session",
    ...(this.instructions === undefined ? {} : { instructions: this.instructions }),
    ...(this.maxTurns === undefined ? {} : { maxTurns: this.maxTurns }),
  });
  this.result = await harness.run(this.prompt);
}

function a_tool_call_that_records_the_file_before_the_next_turn(this: Context) {
  this.requests = [];
  this.tools = [echoTool(() => "pong")];
  this.prompt = "Ping";
  this.expectedText = "done";
  this.client = {
    createResponse: async (request) => {
      this.requests.push(request);
      if (this.requests.length === 2) {
        this.persistedBeforeSecondTurn = await readFile(
          join(this.transcriptFolder, "session.jsonl"),
          "utf8",
        );
      }
      if (this.requests.length === 1) {
        return functionCalls([{ name: "echo", callId: "call_1" }]);
      }
      return message("done");
    },
  };
}

async function the_prompt_is_run_with_the_folder_env(this: Context) {
  this.envFolder = await mkdtemp(join(tmpdir(), "agent-transcript-env-"));
  const previous = process.env["AGENT_TRANSCRIPT_FOLDER"];
  process.env["AGENT_TRANSCRIPT_FOLDER"] = this.envFolder;
  try {
    const harness = createHarness({
      client: this.client,
      model: "test-model",
      tools: this.tools,
      sessionId: "session",
      ...(this.instructions === undefined ? {} : { instructions: this.instructions }),
    });
    this.result = await harness.run(this.prompt);
  } finally {
    if (previous === undefined) {
      delete process.env["AGENT_TRANSCRIPT_FOLDER"];
    } else {
      process.env["AGENT_TRANSCRIPT_FOLDER"] = previous;
    }
  }
}

function no_folder_is_configured(this: Context) {
  this.errorMessage =
    "Transcript folder is required. Pass transcriptFolder or set AGENT_TRANSCRIPT_FOLDER";
}

async function the_prompt_is_run_without_a_folder(this: Context) {
  const previous = process.env["AGENT_TRANSCRIPT_FOLDER"];
  delete process.env["AGENT_TRANSCRIPT_FOLDER"];
  try {
    const harness = createHarness({
      client: {
        createResponse: () => Promise.reject(new Error("unused")),
      },
      model: "test-model",
      tools: [],
    });
    await harness.run("Hello");
  } finally {
    if (previous === undefined) {
      delete process.env["AGENT_TRANSCRIPT_FOLDER"];
    } else {
      process.env["AGENT_TRANSCRIPT_FOLDER"] = previous;
    }
  }
}

function the_file_was_written_before_the_next_turn(this: Context) {
  const second = this.requests[1];
  if (second === undefined) {
    throw new Error("expected a second model call");
  }
  expect(parseJsonl(this.persistedBeforeSecondTurn)).toEqual(
    JSON.parse(JSON.stringify(second.input)) as unknown,
  );
}

async function the_transcript_file_matches_the_snapshot(this: Context) {
  const contents = await readFile(join(this.transcriptFolder, "session.jsonl"), "utf8");
  expect(parseJsonl(contents)).toEqual(
    JSON.parse(JSON.stringify(this.result.transcript.snapshot())) as unknown,
  );
}

async function the_env_folder_contains_the_session_file(this: Context) {
  const folder = this.envFolder;
  if (folder === undefined) {
    throw new Error("expected an environment transcript folder");
  }
  const contents = await readFile(join(folder, "session.jsonl"), "utf8");
  expect(parseJsonl(contents)).toEqual(
    JSON.parse(JSON.stringify(this.result.transcript.snapshot())) as unknown,
  );
}

function the_harness_is_created(this: Context) {
  createHarness({
    client: this.client,
    model: "test-model",
    tools: this.tools,
  });
}

function the_run_completes_with_the_text(this: Context) {
  expect(this.result).toMatchObject({ status: "completed", text: this.expectedText });
}

function the_request_includes_the_prompt_and_instructions(this: Context) {
  const request = this.requests[0];
  expect(request?.model).toBe("test-model");
  expect(request?.store).toBe(false);
  expect(request?.instructions).toBe("Be brief");
  expect(request?.input[0]).toEqual({ role: "user", content: "Hello" });
  expect(request?.tools).toEqual([]);
}

function each_model_line_keeps_its_response_usage(this: Context) {
  if (this.result.status !== "completed") {
    throw new Error("expected a completed run");
  }
  const snapshot = this.result.transcript.snapshot();
  const done = message("both").output[0];
  expect(snapshot).toEqual([
    { role: "user", content: "Both" },
    { ...functionCall("one", "call_one"), usage: this.usage },
    { ...functionCall("two", "call_two"), usage: this.usage },
    { type: "function_call_output", call_id: "call_one", output: "one" },
    { type: "function_call_output", call_id: "call_two", output: "two" },
    { ...done, usage: this.followUpUsage },
  ]);
}

async function the_metrics_file_sums_each_response_once(this: Context) {
  const contents = await readFile(join(this.transcriptFolder, "session_metrics.json"), "utf8");
  const metrics = JSON.parse(contents) as SessionMetrics;
  expect(metrics).toEqual({
    turns: 2,
    inputTokens: this.usage.inputTokens + this.followUpUsage.inputTokens,
    outputTokens: this.usage.outputTokens + this.followUpUsage.outputTokens,
    totalTokens: this.usage.totalTokens + this.followUpUsage.totalTokens,
    cachedTokens: (this.usage.cachedTokens ?? 0) + (this.followUpUsage.cachedTokens ?? 0),
    cacheWriteTokens:
      (this.usage.cacheWriteTokens ?? 0) + (this.followUpUsage.cacheWriteTokens ?? 0),
    reasoningTokens: (this.usage.reasoningTokens ?? 0) + (this.followUpUsage.reasoningTokens ?? 0),
    cost: (this.usage.cost ?? 0) + (this.followUpUsage.cost ?? 0),
  });
}

function the_follow_up_request_omits_usage(this: Context) {
  expect(this.requests[1]?.input).toEqual([
    { role: "user", content: "Both" },
    functionCall("one", "call_one"),
    functionCall("two", "call_two"),
    { type: "function_call_output", call_id: "call_one", output: "one" },
    { type: "function_call_output", call_id: "call_two", output: "two" },
  ]);
}

function the_transcript_keeps_the_call_id(this: Context) {
  if (this.result.status !== "completed") {
    throw new Error("expected a completed run");
  }
  expect(this.result.transcript.snapshot()).toEqual([
    { role: "user", content: "Ping" },
    functionCall("echo", "call_1"),
    { type: "function_call_output", call_id: "call_1", output: "pong" },
    message("done").output[0],
  ]);
}

function both_tools_ran_at_the_same_time(this: Context) {
  expect(this.maxInFlight).toBe(2);
}

function the_transcript_keeps_both_call_ids(this: Context) {
  if (this.result.status !== "completed") {
    throw new Error("expected a completed run");
  }
  const snapshot = this.result.transcript.snapshot();
  expect(snapshot.slice(1, 5)).toEqual([
    functionCall("one", "call_one"),
    functionCall("two", "call_two"),
    { type: "function_call_output", call_id: "call_one", output: "one" },
    { type: "function_call_output", call_id: "call_two", output: "two" },
  ]);
}

function the_model_received_the_tool_error(this: Context) {
  const followUp = this.requests[1];
  expect(followUp?.input.at(-1)).toEqual({
    type: "function_call_output",
    call_id: "call_err",
    output: "Error: boom",
  });
}

function the_model_received_the_invalid_json_error(this: Context) {
  const followUp = this.requests[1];
  expect(followUp?.input.at(-1)).toEqual({
    type: "function_call_output",
    call_id: "call_bad",
    output: "Error: Tool arguments were not valid JSON",
  });
}

function the_model_received_the_unknown_tool_error(this: Context) {
  const followUp = this.requests[1];
  expect(followUp?.input.at(-1)).toEqual({
    type: "function_call_output",
    call_id: "call_missing",
    output: "Error: Unknown tool: missing",
  });
}

function the_run_stops_at_the_turn_limit(this: Context) {
  expect(this.requests).toHaveLength(8);
  expect(this.result.status).toBe("max_turns");
}

function the_run_fails_before_recording_model_output(this: Context) {
  expect(this.result.status).toBe("failed");
  if (this.result.status !== "failed") {
    return;
  }
  expect(this.result.error.message).toBe("Response ended with status incomplete");
  expect(this.result.transcript.snapshot()).toEqual([{ role: "user", content: "Stop" }]);
}

function the_run_fails_with_the_client_error(this: Context) {
  expect(this.result.status).toBe("failed");
  if (this.result.status !== "failed") {
    return;
  }
  expect(this.result.error.message).toBe("network down");
}

function the_run_is_refused(this: Context) {
  expect(this.result).toMatchObject({ status: "refused", text: "I will not do that" });
}

function expect_error(this: Context, error: Error) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe(this.errorMessage);
}
