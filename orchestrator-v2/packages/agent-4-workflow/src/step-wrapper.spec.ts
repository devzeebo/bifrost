import type {
  CreateDraftWorkItemInput,
  ScriptContext,
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
  error: Error | null;
  workItemSource: MockSource;
  innerResult: unknown;
};

class MockSource implements WorkItemSourceClient {
  public workflowStateUpdates: Array<{ workItemId: string; state: Record<string, unknown> }> = [];

  async completeWorkItem(): Promise<void> {
    throw new Error("not implemented");
  }

  async failWorkItem(): Promise<void> {
    throw new Error("not implemented");
  }

  async pauseWorkItem(): Promise<void> {
    throw new Error("not implemented");
  }

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
    then: { run_succeeds },
  });

  test("fail step result throws", {
    given: { fail_step_fixture },
    when: { running_decorator },
    then: { fail_is_thrown },
  });

  test("rewind step result rewinds workflow", {
    given: { rewind_step_fixture },
    when: { running_decorator },
    then: { workflow_is_rewound },
  });
});

function continue_step_fixture(this: Context) {
  this.workItemSource = new MockSource();
  this.innerResult = continueStep("done");
}

function fail_step_fixture(this: Context) {
  this.workItemSource = new MockSource();
  this.innerResult = failStep("boom");
}

function rewind_step_fixture(this: Context) {
  this.workItemSource = new MockSource();
  this.innerResult = rewindStep("flow:step1-1[a]", "try again");
}

async function running_decorator(this: Context) {
  this.error = null;
  try {
    await runStepDecorator(
      "step-child-1",
      wrapperState,
      makeCtx(this.workItemSource),
      async () => this.innerResult,
    );
  } catch (error) {
    this.error = error as Error;
  }
}

function run_succeeds(this: Context) {
  expect(this.error).toBeNull();
}

function fail_is_thrown(this: Context) {
  expect(this.error?.message).toBe("boom");
}

function workflow_is_rewound(this: Context) {
  expect(this.error?.message).toBe("try again");
  expect(this.workItemSource.workflowStateUpdates).toEqual([
    {
      workItemId: "workflow-1",
      state: { rewindTarget: "flow:step1-1[a]", phase: "schedule" },
    },
  ]);
}

function makeCtx(workItemSource: MockSource): ScriptContext {
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
    workItemSource,
    async setState() {},
  };
}
