import type {
  CreateDraftWorkItemInput,
  WorkItem,
  WorkItemExecutionContext,
  WorkItemHandler,
  WorkItemResult,
  WorkItemSourceClient,
  WorkItemStatus,
  WorkItemDependency,
} from "@bifrost-ai/interfaces-work";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { continueStep, failStep, rewindStep } from "./step-result.js";
import { runStepWrapper } from "./step-wrapper.js";
import type { StepWrapperState } from "./types.js";

type Context = {
  workItem: WorkItem;
  ctx: WorkItemExecutionContext;
  result: WorkItemResult;
  source: MockSource;
  innerHandler: WorkItemHandler;
};

class MockSource implements WorkItemSourceClient {
  public workflowStateUpdates: Array<{ workItemId: string; state: Record<string, unknown> }> = [];

  async createDraftWorkItem(_input: CreateDraftWorkItemInput): Promise<string> {
    throw new Error("not implemented");
  }

  async startWorkItem(_workItemId: string): Promise<void> {
    throw new Error("not implemented");
  }

  async setDependency(_workItemId: string, _dependsOnWorkItemId: string): Promise<void> {
    throw new Error("not implemented");
  }

  async getDependencies(_workItemId: string): Promise<WorkItemDependency[]> {
    return [];
  }

  async getWorkItemStatus(_workItemId: string): Promise<WorkItemStatus> {
    return "live";
  }

  async setState(workItemId: string, state: Record<string, unknown>): Promise<void> {
    this.workflowStateUpdates.push({ workItemId, state });
  }
}

const wrapperState: StepWrapperState = {
  stepId: "flow:step1-1[a]",
  workflowWorkItemId: "workflow-1",
  innerKind: "script",
  innerName: "a",
  workingDir: "/tmp",
};

describe("runStepWrapper", () => {
  test("continue step result completes wrapper", {
    given: { continue_step_fixture },
    when: { running_wrapper },
    then: { outcome_is_completed },
  });

  test("fail step result fails wrapper", {
    given: { fail_step_fixture },
    when: { running_wrapper },
    then: { outcome_is_failed },
  });

  test("rewind step result rewinds workflow", {
    given: { rewind_step_fixture },
    when: { running_wrapper },
    then: { workflow_is_rewound },
  });
});

function continue_step_fixture(this: Context) {
  this.source = new MockSource();
  this.innerHandler = {
    kind: "script",
    name: "a",
    async run() {
      return continueStep("done") as unknown as WorkItemResult;
    },
  };
  this.workItem = makeWorkItem();
  this.ctx = makeCtx(this.source, this.innerHandler);
}

function fail_step_fixture(this: Context) {
  this.source = new MockSource();
  this.innerHandler = {
    kind: "script",
    name: "a",
    async run() {
      return failStep("boom") as unknown as WorkItemResult;
    },
  };
  this.workItem = makeWorkItem();
  this.ctx = makeCtx(this.source, this.innerHandler);
}

function rewind_step_fixture(this: Context) {
  this.source = new MockSource();
  this.innerHandler = {
    kind: "script",
    name: "a",
    async run() {
      return rewindStep("flow:step1-1[a]", "try again") as unknown as WorkItemResult;
    },
  };
  this.workItem = makeWorkItem();
  this.ctx = makeCtx(this.source, this.innerHandler);
}

async function running_wrapper(this: Context) {
  this.result = await runStepWrapper(this.workItem, this.ctx, wrapperState);
}

function outcome_is_completed(this: Context) {
  expect(this.result.outcome).toBe("completed");
  expect(this.result.message).toBe("done");
}

function outcome_is_failed(this: Context) {
  expect(this.result.outcome).toBe("failed");
  expect(this.result.message).toBe("boom");
}

function workflow_is_rewound(this: Context) {
  expect(this.result.outcome).toBe("failed");
  expect(this.result.message).toBe("try again");
  expect(this.source.workflowStateUpdates).toEqual([
    {
      workItemId: "workflow-1",
      state: { rewindTarget: "flow:step1-1[a]", phase: "schedule" },
    },
  ]);
}

function makeWorkItem(): WorkItem {
  return {
    workItemId: "child-1",
    kind: "script",
    name: "flow:step1-1[a]",
    state: { ...wrapperState },
    metadata: {},
  };
}

function makeCtx(source: MockSource, innerHandler: WorkItemHandler): WorkItemExecutionContext {
  return {
    data: {
      get() {
        return {
          get() {
            return undefined;
          },
          has() {
            return false;
          },
          register() {},
        };
      },
    },
    handlers: {
      get(kind, name) {
        if (kind === innerHandler.kind && name === innerHandler.name) {
          return innerHandler;
        }
        return undefined;
      },
      has(kind, name) {
        return kind === innerHandler.kind && name === innerHandler.name;
      },
    },
    source,
    async setState() {},
  };
}
