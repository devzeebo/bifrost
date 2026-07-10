import type {
  DataRegistry,
  Registry,
  WorkItem,
  WorkItemExecutionContext,
} from "@bifrost-ai/interfaces-work";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { runTaskAgent } from "./run-task-agent.js";
import type { AgentDefinition, Engine, EngineContext, EngineResult } from "@bifrost-ai/engine";
import { TestEngine } from "@bifrost-ai/engine";
import type { TaskAgentDataSchema } from "./types.js";

type Context = {
  workItem: WorkItem;
  ctx: WorkItemExecutionContext<Pick<TaskAgentDataSchema, "engine">>;
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

const emptyHandlers = {
  get() {
    return undefined;
  },
  has() {
    return false;
  },
};

function makeData(engine: Engine): DataRegistry<Pick<TaskAgentDataSchema, "engine">> {
  const engines = new Map<string, Engine>([["test", engine]]);

  const engineRegistry: Registry<Engine> = {
    register(name, item) {
      engines.set(name, item);
    },
    get(name) {
      return engines.get(name);
    },
    has(name) {
      return engines.has(name);
    },
  };

  return {
    get() {
      return engineRegistry;
    },
  };
}

function makeExecutionFixture(
  state: Record<string, unknown>,
  engine: Engine,
  name = sampleAgent.name,
): { workItem: WorkItem; ctx: WorkItemExecutionContext<Pick<TaskAgentDataSchema, "engine">> } {
  const liveState = { ...state };

  const workItem: WorkItem = {
    workItemId: "work-item-123",
    kind: name,
    flow: [],
    metadata: { priority: "high" },
    state: liveState,
  };

  const ctx: WorkItemExecutionContext<Pick<TaskAgentDataSchema, "engine">> = {
    data: makeData(engine),
    handlers: emptyHandlers,
    async setState(nextState) {
      Object.assign(liveState, nextState);
    },
  };

  return { workItem, ctx };
}

function validTaskState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    workingDir: "/home/user/project",
    instructions: "Review this code for quality",
    engineName: "test",
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

  test("fails when engine name is unknown", {
    given: { task_agent_with_test_engine, context_with_unknown_engine },
    when: { task_agent_run },
    then: { unknown_engine_failure },
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
}

function tracking_engine(this: Context) {
  this.engine = new TrackingEngine(new TestEngine());
}

function failing_engine(this: Context) {
  this.engine = new TestEngine({ success: false, lastMessage: "Engine failed" });
}

function throwing_engine(this: Context) {
  this.engine = new TestEngine({ simulateError: true });
}

function valid_state_context(this: Context) {
  const fixture = makeExecutionFixture(validTaskState(), this.engine);
  this.workItem = fixture.workItem;
  this.ctx = fixture.ctx;
}

function context_with_existing_session(this: Context) {
  const fixture = makeExecutionFixture(
    validTaskState({ sessionId: "existing-session-42" }),
    this.engine,
  );
  this.workItem = fixture.workItem;
  this.ctx = fixture.ctx;
}

function empty_state_context(this: Context) {
  const fixture = makeExecutionFixture({}, this.engine);
  this.workItem = fixture.workItem;
  this.ctx = fixture.ctx;
}

function context_with_unknown_engine(this: Context) {
  const fixture = makeExecutionFixture(validTaskState({ engineName: "missing" }), this.engine);
  this.workItem = fixture.workItem;
  this.ctx = fixture.ctx;
}

async function task_agent_run(this: Context) {
  this.result = await runTaskAgent(this.workItem, this.ctx, sampleAgent);
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
  expect(this.workItem.state.sessionId).toMatch(/^test-session-/);
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
  expect(this.result.message).toContain("engineName");
}

function unknown_engine_failure(this: Context) {
  expect(this.result.outcome).toBe("failed");
  expect(this.result.message).toBe("Unknown engine: missing");
}

function engine_failure_returned(this: Context) {
  expect(this.result.outcome).toBe("failed");
  expect(this.result.message).toContain("Engine failed");
}

function thrown_error_returned(this: Context) {
  expect(this.result.outcome).toBe("failed");
  expect(this.result.message).toBe("Simulated engine error");
}
