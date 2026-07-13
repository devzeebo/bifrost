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
  error: Error | null;
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
    kind: "task",
    name,
    flow: [],
    metadata: { priority: "high" },
    state: liveState,
  };

  const ctx: WorkItemExecutionContext<Pick<TaskAgentDataSchema, "engine">> = {
    data: makeData(engine),
    handlers: emptyHandlers,
    workItemSource: {
      async completeWorkItem() {
        throw new Error("not implemented");
      },
      async failWorkItem() {
        throw new Error("not implemented");
      },
      async pauseWorkItem() {
        throw new Error("not implemented");
      },
      async createDraftWorkItem() {
        throw new Error("not implemented");
      },
      async startWorkItem() {
        throw new Error("not implemented");
      },
      async setDependency() {
        throw new Error("not implemented");
      },
      async getDependencies() {
        return [];
      },
      async getWorkItemStatus() {
        return "live";
      },
      async setState() {
        throw new Error("not implemented");
      },
    },
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
  test("completes when engine succeeds", {
    given: { task_agent_with_test_engine, valid_state_context },
    when: { task_agent_run },
    then: {
      run_succeeds,
      session_id_is_persisted,
    },
  });

  test("passes existing sessionId to the engine", {
    given: { tracking_engine, context_with_existing_session },
    when: { task_agent_run },
    then: {
      engine_received_session_id,
      run_succeeds,
    },
  });

  test("throws when required task state fields are missing", {
    given: { task_agent_with_test_engine, empty_state_context },
    when: { task_agent_run },
    then: { missing_fields_failure },
  });

  test("throws when engine name is unknown", {
    given: { task_agent_with_test_engine, context_with_unknown_engine },
    when: { task_agent_run },
    then: { unknown_engine_failure },
  });

  test("throws when engine returns unsuccessful result", {
    given: { failing_engine, valid_state_context },
    when: { task_agent_run },
    then: { engine_failure_thrown },
  });

  test("throws when engine throws", {
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
  this.error = null;
  try {
    await runTaskAgent(this.workItem, this.ctx, sampleAgent);
  } catch (error) {
    this.error = error as Error;
  }
}

function run_succeeds(this: Context) {
  expect(this.error).toBeNull();
}

function session_id_is_persisted(this: Context) {
  expect(this.workItem.state.sessionId).toMatch(/^test-session-/);
}

function engine_received_session_id(this: Context) {
  const tracking = this.engine as TrackingEngine;
  expect(tracking.executeCalls[0]?.sessionId).toBe("existing-session-42");
}

function missing_fields_failure(this: Context) {
  expect(this.error?.message).toContain("workingDir");
  expect(this.error?.message).toContain("instructions");
  expect(this.error?.message).toContain("engineName");
}

function unknown_engine_failure(this: Context) {
  expect(this.error?.message).toBe("Unknown engine: missing");
}

function engine_failure_thrown(this: Context) {
  expect(this.error?.message).toContain("Engine failed");
}

function thrown_error_returned(this: Context) {
  expect(this.error?.message).toBe("Simulated engine error");
}
