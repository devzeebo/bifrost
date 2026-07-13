import type {
  CreateDraftWorkItemInput,
  ScriptContext,
  WorkItemResult,
  WorkItemSourceClient,
  WorkItemStatus,
  WorkItemDependency,
} from "@bifrost-ai/interfaces-work";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { continueStep, failStep, rewindStep } from "./step-result.js";
import { runStepDecorator } from "./step-wrapper.js";
import type { StepWrapperState } from "./types.js";

type Context = {
  result: WorkItemResult;
  source: MockSource;
  innerResult: unknown;
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
  workflowWorkItemId: "workflow-1",
  workingDir: "/tmp",
};

describe("runStepDecorator", () => {
  test("continue step result completes wrapper", {
    given: { continue_step_fixture },
    when: { running_decorator },
    then: { outcome_is_completed },
  });

  test("fail step result fails wrapper", {
    given: { fail_step_fixture },
    when: { running_decorator },
    then: { outcome_is_failed },
  });

  test("rewind step result rewinds workflow", {
    given: { rewind_step_fixture },
    when: { running_decorator },
    then: { workflow_is_rewound },
  });
});

function continue_step_fixture(this: Context) {
  this.source = new MockSource();
  this.innerResult = continueStep("done");
}

function fail_step_fixture(this: Context) {
  this.source = new MockSource();
  this.innerResult = failStep("boom");
}

function rewind_step_fixture(this: Context) {
  this.source = new MockSource();
  this.innerResult = rewindStep("flow:step1-1[a]", "try again");
}

async function running_decorator(this: Context) {
  this.result = await runStepDecorator(
    wrapperState,
    makeCtx(this.source),
    async () => this.innerResult,
  );
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

function makeCtx(source: MockSource): ScriptContext {
  return {
    cwd: "/tmp",
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
    source,
    async setState() {},
  };
}
