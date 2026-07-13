import type {
  CreateDraftWorkItemInput,
  ScriptContext,
  WorkItem,
  WorkItemSourceClient,
  WorkItemStatus,
} from "@bifrost-ai/interfaces-work";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { runWorkflowAgent } from "./run-workflow-agent.js";
import type { WorkflowDefinition } from "./types.js";

type Context = {
  workItem: WorkItem;
  ctx: ScriptContext;
  definition: WorkflowDefinition;
  result: Awaited<ReturnType<typeof runWorkflowAgent>>;
  source: MockSource;
};

class MockSource implements WorkItemSourceClient {
  public drafts: Array<{
    input: Parameters<WorkItemSourceClient["createDraftWorkItem"]>[0];
    id: string;
  }> = [];
  public started: string[] = [];
  public dependencies: Array<{ workItemId: string; dependsOnWorkItemId: string }> = [];
  public statuses = new Map<string, WorkItemStatus>();
  private nextId = 1;

  async createDraftWorkItem(input: CreateDraftWorkItemInput) {
    const id = `child-${this.nextId}`;
    this.nextId += 1;
    this.drafts.push({ input, id });
    this.statuses.set(id, "draft");
    return id;
  }

  async startWorkItem(workItemId: string) {
    this.started.push(workItemId);
    this.statuses.set(workItemId, "live");
  }

  async setDependency(workItemId: string, dependsOnWorkItemId: string) {
    this.dependencies.push({ workItemId, dependsOnWorkItemId });
  }

  async getDependencies() {
    return [];
  }

  async getWorkItemStatus(workItemId: string) {
    return this.statuses.get(workItemId) ?? "draft";
  }

  async setState() {}
}

const linearDefinition: WorkflowDefinition = {
  name: "linear",
  steps: [
    { id: "step-a", innerKind: "task", innerName: "a", dependsOn: [] },
    { id: "step-b", innerKind: "task", innerName: "b", dependsOn: ["step-a"] },
    { id: "step-c", innerKind: "task", innerName: "c", dependsOn: ["step-b"] },
  ],
};

describe("runWorkflowAgent", () => {
  test("schedule pass creates children and pauses", {
    given: { schedule_fixture },
    when: { running_workflow },
    then: { outcome_is_paused, children_created_and_started },
  });

  test("verify pass fails when a child failed", {
    given: { verify_fixture_with_failed_child },
    when: { running_workflow },
    then: { outcome_is_failed },
  });

  test("verify pass completes when all children completed", {
    given: { verify_fixture_all_completed },
    when: { running_workflow },
    then: { outcome_is_completed },
  });

  test("verify pass pauses when a child is still live", {
    given: { verify_fixture_with_live_child },
    when: { running_workflow },
    then: { outcome_is_paused },
  });
});

function schedule_fixture(this: Context) {
  this.source = new MockSource();
  this.definition = linearDefinition;
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      definitionName: "linear",
      phase: "schedule",
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.source);
}

function verify_fixture_with_failed_child(this: Context) {
  this.source = new MockSource();
  this.definition = linearDefinition;
  this.source.statuses.set("child-1", "completed");
  this.source.statuses.set("child-2", "failed");
  this.source.statuses.set("child-3", "completed");
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      definitionName: "linear",
      phase: "verify",
      childIds: {
        "step-a": "child-1",
        "step-b": "child-2",
        "step-c": "child-3",
      },
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.source);
}

function verify_fixture_all_completed(this: Context) {
  this.source = new MockSource();
  this.definition = linearDefinition;
  for (const id of ["child-1", "child-2", "child-3"]) {
    this.source.statuses.set(id, "completed");
  }
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      definitionName: "linear",
      phase: "verify",
      childIds: {
        "step-a": "child-1",
        "step-b": "child-2",
        "step-c": "child-3",
      },
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.source);
}

function verify_fixture_with_live_child(this: Context) {
  this.source = new MockSource();
  this.definition = linearDefinition;
  this.source.statuses.set("child-1", "completed");
  this.source.statuses.set("child-2", "live");
  this.source.statuses.set("child-3", "completed");
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      definitionName: "linear",
      phase: "verify",
      childIds: {
        "step-a": "child-1",
        "step-b": "child-2",
        "step-c": "child-3",
      },
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.source);
}

async function running_workflow(this: Context) {
  this.result = await runWorkflowAgent(this.workItem, this.ctx, this.definition);
}

function outcome_is_paused(this: Context) {
  expect(this.result.outcome).toBe("paused");
}

function children_created_and_started(this: Context) {
  expect(this.source.drafts).toHaveLength(3);
  expect(this.source.drafts[0]?.input).toMatchObject({
    kind: "task",
    name: "a",
    flow: ["step-a"],
    state: { workflowWorkItemId: "workflow-1", workingDir: "/tmp" },
  });
  expect(this.source.started).toEqual(["child-1", "child-2", "child-3"]);
  expect(this.source.dependencies.some((dep) => dep.workItemId === "workflow-1")).toBe(true);
}

function outcome_is_failed(this: Context) {
  expect(this.result.outcome).toBe("failed");
}

function outcome_is_completed(this: Context) {
  expect(this.result.outcome).toBe("completed");
}

function makeCtx(source: MockSource): ScriptContext {
  const state: Record<string, unknown> = {};
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
    async setState(nextState) {
      Object.assign(state, nextState);
    },
  };
}
