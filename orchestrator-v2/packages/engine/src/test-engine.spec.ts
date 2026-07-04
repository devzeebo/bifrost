import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { TestEngine } from "./test-engine.js";
import type { AgentDefinition, EngineContext } from "./types.js";

type Context = {
  engine: TestEngine;
  context: EngineContext;
  result: Awaited<ReturnType<TestEngine["execute"]>>;
  startTime: number;
  duration: number;
};

const sampleAgent: AgentDefinition = {
  name: "test-agent",
  description: "",
  tools: [],
  template: { parameters: {} },
  promptBody: "",
};

function makeContext(overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    workItemId: "work-item-1",
    workingDir: "/test/project",
    agent: sampleAgent,
    state: {},
    metadata: {},
    instructions: "test instructions",
    setState: async () => {},
    ...overrides,
  };
}

describe("TestEngine", () => {
  test("executes and returns success with telemetry", {
    given: { test_engine },
    when: { engine_executed },
    then: {
      result_is_successful,
      telemetry_is_present,
      session_id_is_assigned,
    },
  });

  test("continues an existing session when sessionId is provided", {
    given: { test_engine, context_prepared },
    when: { first_execution, second_execution_with_session },
    then: {
      follow_up_message_returned,
      session_id_is_unchanged,
    },
  });

  test("returns configured failure without throwing", {
    given: { failing_test_engine },
    when: { engine_executed },
    then: { result_is_unsuccessful },
  });

  test("simulates configured delay", {
    given: { delayed_test_engine },
    when: { timed_execution },
    then: { delay_was_observed },
  });
});

function test_engine(this: Context) {
  this.engine = new TestEngine();
  this.context = makeContext();
}

function context_prepared(this: Context) {
  this.engine = new TestEngine();
  this.context = makeContext();
}

function failing_test_engine(this: Context) {
  this.engine = new TestEngine({ success: false, lastMessage: "Execution failed" });
  this.context = makeContext();
}

function delayed_test_engine(this: Context) {
  this.engine = new TestEngine({ simulateDelay: 100 });
  this.context = makeContext();
}

async function engine_executed(this: Context) {
  this.result = await this.engine.execute(this.context);
}

async function first_execution(this: Context) {
  this.result = await this.engine.execute(this.context);
}

async function second_execution_with_session(this: Context) {
  this.result = await this.engine.execute(this.context, this.result.sessionId);
}

async function timed_execution(this: Context) {
  this.startTime = Date.now();
  await this.engine.execute(this.context);
  this.duration = Date.now() - this.startTime;
}

function result_is_successful(this: Context) {
  expect(this.result.success).toBe(true);
  expect(this.result.lastMessage).toContain("complete");
}

function telemetry_is_present(this: Context) {
  expect(this.result.stats).toMatchObject({
    durationMs: expect.any(Number),
    inputTokens: expect.any(Number),
    outputTokens: expect.any(Number),
    cacheReadTokens: expect.any(Number),
    cacheCreationTokens: expect.any(Number),
    totalCostUsd: expect.any(Number),
    numTurns: expect.any(Number),
  });
}

function session_id_is_assigned(this: Context) {
  expect(this.result.sessionId).toMatch(/^test-session-/);
}

function follow_up_message_returned(this: Context) {
  expect(this.result.lastMessage).toContain("Follow-up");
}

function session_id_is_unchanged(this: Context) {
  expect(this.result.sessionId).toMatch(/^test-session-/);
}

function result_is_unsuccessful(this: Context) {
  expect(this.result.success).toBe(false);
  expect(this.result.lastMessage).toContain("Execution failed");
}

function delay_was_observed(this: Context) {
  expect(this.duration).toBeGreaterThanOrEqual(95);
}
