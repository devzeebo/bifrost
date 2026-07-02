import type { ScriptContext } from "@bifrost-ai/interfaces-task";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { runTaskAgent } from "./run-task-agent.js";
import type { TaskAgentConfig } from "./types.js";
import type { AgentDefinition, Engine, EngineContext, EngineResult } from "@bifrost-ai/engine";
import { TestEngine } from "@bifrost-ai/engine";

type Context = {
  config: TaskAgentConfig;
  ctx: ScriptContext;
  result: Awaited<ReturnType<typeof runTaskAgent>>;
  engine: TestEngine | TrackingEngine;
};

const sampleAgent: AgentDefinition = {
  name: "reviewer",
  description: "Code review agent",
  tools: [],
  template: { parameters: {} },
  promptBody: "Review the code.",
};

class TrackingEngine implements Engine {
  public executeCalls: { sessionId?: string }[] = [];

  public constructor(private readonly inner: TestEngine) {}

  public async execute(context: EngineContext, sessionId?: string): Promise<EngineResult> {
    this.executeCalls.push({ sessionId });
    return this.inner.execute(context, sessionId);
  }
}

function makeScriptContext(taskState: Record<string, unknown>): ScriptContext {
  const state = { ...taskState };

  return {
    taskId: "task-123",
    agentType: "task",
    agentName: sampleAgent.name,
    get taskState() {
      return state;
    },
    metadata: { priority: "high" },
    async setState(nextState) {
      Object.assign(state, nextState);
    },
  };
}

function validTaskState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    workingDir: "/home/user/project",
    instructions: "Review this code for quality",
    ...overrides,
  };
}

describe("runTaskAgent", () => {
  test("returns completed with telemetry when engine succeeds", {
    given: { task_agent_with_test_engine, valid_state_context },
    when: { task_agent_run },
    then: {
      outcome_is_completed,
      telemetry_is_returned,
      session_id_is_persisted,
    },
  });

  test("passes existing sessionId to the engine", {
    given: { tracking_engine, context_with_existing_session },
    when: { task_agent_run },
    then: {
      engine_received_session_id,
      follow_up_outcome_returned,
    },
  });

  test("fails immediately when required task state fields are missing", {
    given: { task_agent_with_test_engine, empty_state_context },
    when: { task_agent_run },
    then: { missing_fields_failure },
  });

  test("fails when engine returns unsuccessful result", {
    given: { failing_engine, valid_state_context },
    when: { task_agent_run },
    then: { engine_failure_returned },
  });

  test("fails when engine throws", {
    given: { throwing_engine, valid_state_context },
    when: { task_agent_run },
    then: { thrown_error_returned },
  });
});

function task_agent_with_test_engine(this: Context) {
  this.engine = new TestEngine();
  this.config = { engine: this.engine, agent: sampleAgent };
}

function tracking_engine(this: Context) {
  const inner = new TestEngine();
  const tracking = new TrackingEngine(inner);
  this.engine = tracking;
  this.config = { engine: tracking, agent: sampleAgent };
}

function failing_engine(this: Context) {
  this.engine = new TestEngine({ success: false, lastMessage: "Engine failed" });
  this.config = { engine: this.engine, agent: sampleAgent };
}

function throwing_engine(this: Context) {
  this.engine = new TestEngine({ simulateError: true });
  this.config = { engine: this.engine, agent: sampleAgent };
}

function valid_state_context(this: Context) {
  this.ctx = makeScriptContext(validTaskState());
}

function context_with_existing_session(this: Context) {
  this.ctx = makeScriptContext(validTaskState({ sessionId: "existing-session-42" }));
}

function empty_state_context(this: Context) {
  this.ctx = makeScriptContext({});
}

async function task_agent_run(this: Context) {
  this.result = await runTaskAgent(this.ctx, this.config);
}

function outcome_is_completed(this: Context) {
  expect(this.result.outcome).toBe("completed");
  expect(this.result.message).toContain("reviewer");
}

function telemetry_is_returned(this: Context) {
  expect(this.result.telemetry).toMatchObject({
    inputTokens: expect.any(Number),
    outputTokens: expect.any(Number),
    totalCostUsd: expect.any(Number),
    numTurns: expect.any(Number),
  });
}

function session_id_is_persisted(this: Context) {
  expect(this.ctx.taskState.sessionId).toMatch(/^test-session-/);
}

function engine_received_session_id(this: Context) {
  const tracking = this.engine as TrackingEngine;
  expect(tracking.executeCalls[0]?.sessionId).toBe("existing-session-42");
}

function follow_up_outcome_returned(this: Context) {
  expect(this.result.outcome).toBe("completed");
  expect(this.result.message).toContain("Follow-up");
  expect(this.result.message).toContain("existing-session-42");
}

function missing_fields_failure(this: Context) {
  expect(this.result.outcome).toBe("failed");
  expect(this.result.message).toContain("workingDir");
  expect(this.result.message).toContain("instructions");
}

function engine_failure_returned(this: Context) {
  expect(this.result.outcome).toBe("failed");
  expect(this.result.message).toContain("Engine failed");
}

function thrown_error_returned(this: Context) {
  expect(this.result.outcome).toBe("failed");
  expect(this.result.message).toBe("Simulated engine error");
}
