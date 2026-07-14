import type {
  CreateDraftWorkItemInput,
  ScriptContext,
  WorkItemSourceClient,
  WorkItemStatus,
  WorkItemDependency,
} from "@bifrost-ai/interfaces-work";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { continueStep, failStep, pauseStep } from "./step-result.js";
import { runStepDecorator } from "./step-wrapper.js";
import type { StepWrapperState } from "./types.js";

type Context = {
  error: Error | null;
  workItemSource: MockSource;
  innerResult: unknown;
};

class MockSource implements WorkItemSourceClient {
  public workflowStateUpdates: Array<{ workItemId: string; state: Record<string, unknown> }> = [];
  public paused: Array<{ workItemId: string }> = [];

  async completeWorkItem(): Promise<void> {
    throw new Error("not implemented");
  }

  async failWorkItem(): Promise<void> {
    throw new Error("not implemented");
  }

  async pauseWorkItem(workItemId: string): Promise<void> {
    this.paused.push({ workItemId });
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

  test("pause step result pauses work item", {
    given: { pause_step_fixture },
    when: { running_decorator },
    then: { work_item_is_paused },
  });

  test("thrown inner error is converted to fail transition", {
    given: { thrown_error_fixture },
    when: { running_decorator },
    then: { fail_is_thrown },
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

function pause_step_fixture(this: Context) {
  this.workItemSource = new MockSource();
  this.innerResult = pauseStep();
}

function thrown_error_fixture(this: Context) {
  this.workItemSource = new MockSource();
  this.innerResult = new Error("boom");
}

async function running_decorator(this: Context) {
  this.error = null;
  try {
    await runStepDecorator("step-child-1", wrapperState, makeCtx(this.workItemSource), async () => {
      if (this.innerResult instanceof Error) {
        throw this.innerResult;
      }
      return this.innerResult;
    });
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

function work_item_is_paused(this: Context) {
  expect(this.error).toBeNull();
  expect(this.workItemSource.paused).toEqual([{ workItemId: "step-child-1" }]);
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
