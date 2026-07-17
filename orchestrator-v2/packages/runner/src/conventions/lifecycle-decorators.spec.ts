import type { DecoratorFn, ScriptContext, WorkItem } from "@bifrost-ai/interfaces-work";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { completeOnSuccess } from "./complete-on-success.js";
import { failOnError } from "./fail-on-error.js";

type Context = {
  workItem: WorkItem;
  ctx: ScriptContext;
  workItemSource: {
    completed: string[];
    failed: Array<{ workItemId: string; error: string }>;
    status: string;
  };
  error: Error | null;
};

const baseWorkItem = (): WorkItem => ({
  workItemId: "wi-1",
  kind: "script",
  name: "task",
  flow: [],
  state: {},
  metadata: {},
});

function makeCtx(workItemSource: Context["workItemSource"]): ScriptContext {
  return {
    cwd: "/tmp",
    data: {
      get() {
        return {
          register() {},
          get() {
            return undefined;
          },
          has() {
            return false;
          },
        };
      },
    },
    workItemSource: {
      async completeWorkItem(workItemId: string) {
        workItemSource.completed.push(workItemId);
        workItemSource.status = "completed";
      },
      async failWorkItem(workItemId: string, error: string) {
        workItemSource.failed.push({ workItemId, error });
        workItemSource.status = "failed";
      },
      async pauseWorkItem() {
        workItemSource.status = "paused";
      },
      async createDraftWorkItem() {
        return "draft-1";
      },
      async startWorkItem() {},
      async setDependency() {},
      async getDependencies() {
        return [];
      },
      async getWorkItemStatus() {
        return workItemSource.status as "live";
      },
      async setState() {},
      async updateWorkItemMetadata() {},
    },
    async setState() {},
  };
}

describe("lifecycle decorators", () => {
  test("failOnError records failure via workItemSource", {
    given: { failing_script_context },
    when: { running_fail_on_error },
    then: { failure_recorded },
  });

  test("completeOnSuccess completes when status is still live", {
    given: { succeeding_script_context },
    when: { running_complete_on_success },
    then: { work_item_completed },
  });

  test("completeOnSuccess skips complete when status is paused", {
    given: { paused_script_context },
    when: { running_complete_on_success },
    then: { work_item_not_completed },
  });
});

function failing_script_context(this: Context) {
  this.workItem = baseWorkItem();
  this.workItemSource = { completed: [], failed: [], status: "live" };
  this.ctx = makeCtx(this.workItemSource);
}

function succeeding_script_context(this: Context) {
  this.workItem = baseWorkItem();
  this.workItemSource = { completed: [], failed: [], status: "live" };
  this.ctx = makeCtx(this.workItemSource);
}

function paused_script_context(this: Context) {
  this.workItem = baseWorkItem();
  this.workItemSource = { completed: [], failed: [], status: "paused" };
  this.ctx = makeCtx(this.workItemSource);
}

async function running_fail_on_error(this: Context) {
  this.error = null;
  const decorator = failOnError as DecoratorFn;
  try {
    await decorator(this.workItem, this.ctx, async () => {
      throw new Error("boom");
    });
  } catch (error) {
    this.error = error as Error;
  }
}

async function running_complete_on_success(this: Context) {
  this.error = null;
  const decorator = completeOnSuccess as DecoratorFn;
  try {
    await decorator(this.workItem, this.ctx, async () => undefined);
  } catch (error) {
    this.error = error as Error;
  }
}

function failure_recorded(this: Context) {
  expect(this.error).toBeNull();
  expect(this.workItemSource.failed).toEqual([{ workItemId: "wi-1", error: "boom" }]);
}

function work_item_completed(this: Context) {
  expect(this.error).toBeNull();
  expect(this.workItemSource.completed).toEqual(["wi-1"]);
}

function work_item_not_completed(this: Context) {
  expect(this.error).toBeNull();
  expect(this.workItemSource.completed).toEqual([]);
}
