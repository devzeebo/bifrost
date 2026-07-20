import type {
  CreateDraftWorkItemInput,
  DependencyRelationship,
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
  error: Error | null;
  workItemSource: MockSource;
  hookCalls: string[];
};

class MockSource implements WorkItemSourceClient {
  public drafts: Array<{
    input: Parameters<WorkItemSourceClient["createDraftWorkItem"]>[0];
    id: string;
  }> = [];
  public started: string[] = [];
  public dependencies: Array<{
    blockerId: string;
    relationship: DependencyRelationship;
    blockedId: string;
  }> = [];
  public statuses = new Map<string, WorkItemStatus>();
  public paused: string[] = [];
  public completed: string[] = [];
  public failed: Array<{ workItemId: string; error: string }> = [];
  private nextId = 1;

  async completeWorkItem(workItemId: string) {
    this.completed.push(workItemId);
    this.statuses.set(workItemId, "completed");
  }

  async failWorkItem(workItemId: string, error: string) {
    this.failed.push({ workItemId, error });
    this.statuses.set(workItemId, "failed");
  }

  async pauseWorkItem(workItemId: string) {
    this.paused.push(workItemId);
    this.statuses.set(workItemId, "paused");
  }

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

  async setDependency(blockerId: string, relationship: DependencyRelationship, blockedId: string) {
    this.dependencies.push({ blockerId, relationship, blockedId });
  }

  async getDependencies() {
    return [];
  }

  async getWorkItemStatus(workItemId: string) {
    return this.statuses.get(workItemId) ?? "draft";
  }

  async setState() {}

  async updateWorkItemMetadata() {}
}

const linearDefinition: WorkflowDefinition = {
  name: "linear",
  steps: [
    { id: "step-a", innerKind: "task", innerName: "a", dependsOn: [], flow: ["step-a"] },
    {
      id: "step-b",
      innerKind: "task",
      innerName: "b",
      dependsOn: ["step-a"],
      flow: ["step-b"],
    },
    {
      id: "step-c",
      innerKind: "task",
      innerName: "c",
      dependsOn: ["step-b"],
      flow: ["step-c"],
    },
  ],
};

describe("runWorkflowAgent", () => {
  test("schedule pass creates children and pauses", {
    given: { schedule_fixture },
    when: { running_workflow },
    then: { workflow_is_paused, children_created_and_started },
  });

  test("verify pass throws when a child failed", {
    given: { verify_fixture_with_failed_child },
    when: { running_workflow },
    then: { workflow_throws },
  });

  test("verify pass completes when all children completed", {
    given: { verify_fixture_all_completed },
    when: { running_workflow },
    then: { run_succeeds },
  });

  test("verify pass throws when a child is still live", {
    given: { verify_fixture_with_live_child },
    when: { running_workflow },
    then: { workflow_throws_not_completed },
  });

  test("schedule hooks run in order", {
    given: { schedule_hooks_fixture },
    when: { running_workflow },
    then: { schedule_hooks_ran_in_order },
  });

  test("onBeforeCreateStepList can filter steps", {
    given: { schedule_filter_steps_fixture },
    when: { running_workflow },
    then: { only_filtered_steps_drafted },
  });

  test("onBeforeDraftChildren can set draft metadata", {
    given: { schedule_draft_metadata_fixture },
    when: { running_workflow },
    then: { drafts_include_branch_metadata },
  });

  test("schedule hooks are skipped when childIds already exist", {
    given: { schedule_existing_child_ids_fixture },
    when: { running_workflow },
    then: { schedule_hooks_not_called },
  });

  test("verify hooks run on verify pass", {
    given: { verify_hooks_fixture },
    when: { running_workflow },
    then: { verify_hooks_ran_in_order },
  });

  test("schedule hook failure propagates", {
    given: { schedule_hook_failure_fixture },
    when: { running_workflow },
    then: { workflow_throws_hook_error },
  });

  test("multiple hooks on same lifecycle run in order", {
    given: { multiple_schedule_hooks_fixture },
    when: { running_workflow },
    then: { multiple_schedule_hooks_ran_in_order },
  });

  test("chained onBeforeCreateStepList hooks filter sequentially", {
    given: { chained_filter_steps_fixture },
    when: { running_workflow },
    then: { chained_filter_keeps_step_a },
  });
});

function schedule_fixture(this: Context) {
  this.workItemSource = new MockSource();
  this.definition = linearDefinition;
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "schedule",
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

function verify_fixture_with_failed_child(this: Context) {
  this.workItemSource = new MockSource();
  this.definition = linearDefinition;
  this.workItemSource.statuses.set("child-1", "completed");
  this.workItemSource.statuses.set("child-2", "failed");
  this.workItemSource.statuses.set("child-3", "completed");
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "verify",
      childIds: {
        "step-a": "child-1",
        "step-b": "child-2",
        "step-c": "child-3",
      },
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

function verify_fixture_all_completed(this: Context) {
  this.workItemSource = new MockSource();
  this.definition = linearDefinition;
  for (const id of ["child-1", "child-2", "child-3"]) {
    this.workItemSource.statuses.set(id, "completed");
  }
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "verify",
      childIds: {
        "step-a": "child-1",
        "step-b": "child-2",
        "step-c": "child-3",
      },
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

function verify_fixture_with_live_child(this: Context) {
  this.workItemSource = new MockSource();
  this.definition = linearDefinition;
  this.workItemSource.statuses.set("child-1", "completed");
  this.workItemSource.statuses.set("child-2", "live");
  this.workItemSource.statuses.set("child-3", "completed");
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "verify",
      childIds: {
        "step-a": "child-1",
        "step-b": "child-2",
        "step-c": "child-3",
      },
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

async function running_workflow(this: Context) {
  this.error = null;
  try {
    await runWorkflowAgent(this.workItem, this.ctx, this.definition);
  } catch (error) {
    this.error = error as Error;
  }
}

function workflow_is_paused(this: Context) {
  expect(this.error).toBeNull();
  expect(this.workItemSource.paused).toContain("workflow-1");
}

function children_created_and_started(this: Context) {
  expect(this.workItemSource.drafts).toHaveLength(3);
  expect(this.workItemSource.drafts[0]?.input).toMatchObject({
    kind: "task",
    name: "a",
    flow: ["step-a"],
    state: {
      workflowWorkItemId: "workflow-1",
      workingDir: "/tmp",
    },
    metadata: {},
  });
  expect(this.workItemSource.started).toEqual(["child-1", "child-2", "child-3"]);
  step_dependencies_block_in_order.call(this);
  children_block_workflow.call(this);
}

function step_dependencies_block_in_order(this: Context) {
  expect(this.workItemSource.dependencies).toContainEqual({
    blockerId: "child-1",
    relationship: "blocks",
    blockedId: "child-2",
  });
  expect(this.workItemSource.dependencies).toContainEqual({
    blockerId: "child-2",
    relationship: "blocks",
    blockedId: "child-3",
  });
}

function children_block_workflow(this: Context) {
  for (const childId of ["child-1", "child-2", "child-3"]) {
    expect(this.workItemSource.dependencies).toContainEqual({
      blockerId: childId,
      relationship: "blocks",
      blockedId: "workflow-1",
    });
  }
}

function workflow_throws(this: Context) {
  expect(this.error?.message).toContain("failed");
}

function workflow_throws_not_completed(this: Context) {
  expect(this.error?.message).toContain("is not completed");
}

function run_succeeds(this: Context) {
  expect(this.error).toBeNull();
}

function schedule_hooks_fixture(this: Context) {
  this.hookCalls = [];
  this.workItemSource = new MockSource();
  this.definition = {
    ...linearDefinition,
    hooks: {
      onBeforeCreateStepList: [
        () => {
          this.hookCalls.push("onBeforeCreateStepList");
        },
      ],
      onBeforeDraftChildren: [
        () => {
          this.hookCalls.push("onBeforeDraftChildren");
        },
      ],
      onBeforeWireDependencies: [
        () => {
          this.hookCalls.push("onBeforeWireDependencies");
        },
      ],
      onBeforeStartChildren: [
        () => {
          this.hookCalls.push("onBeforeStartChildren");
        },
      ],
      onAfterStartChildren: [
        () => {
          this.hookCalls.push("onAfterStartChildren");
        },
      ],
    },
  };
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "schedule",
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

function schedule_hooks_ran_in_order(this: Context) {
  expect(this.error).toBeNull();
  expect(this.hookCalls).toEqual([
    "onBeforeCreateStepList",
    "onBeforeDraftChildren",
    "onBeforeWireDependencies",
    "onBeforeStartChildren",
    "onAfterStartChildren",
  ]);
}

function schedule_filter_steps_fixture(this: Context) {
  this.hookCalls = [];
  this.workItemSource = new MockSource();
  this.definition = {
    ...linearDefinition,
    hooks: {
      onBeforeCreateStepList: [
        ({ schedule }) => {
          return schedule.steps.filter((step) => step.id === "step-a");
        },
      ],
    },
  };
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "schedule",
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

function only_filtered_steps_drafted(this: Context) {
  expect(this.error).toBeNull();
  expect(this.workItemSource.drafts).toHaveLength(1);
  expect(this.workItemSource.drafts[0]?.input.name).toBe("a");
}

function schedule_draft_metadata_fixture(this: Context) {
  this.workItemSource = new MockSource();
  this.definition = {
    ...linearDefinition,
    hooks: {
      onBeforeDraftChildren: [
        ({ schedule }) => {
          schedule.draftMetadata.branch = "feature/story-1";
        },
      ],
    },
  };
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "schedule",
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

function drafts_include_branch_metadata(this: Context) {
  expect(this.error).toBeNull();
  for (const draft of this.workItemSource.drafts) {
    expect(draft.input.metadata).toMatchObject({
      branch: "feature/story-1",
    });
  }
}

function schedule_existing_child_ids_fixture(this: Context) {
  this.hookCalls = [];
  this.workItemSource = new MockSource();
  this.definition = {
    ...linearDefinition,
    hooks: {
      onBeforeCreateStepList: [
        () => {
          this.hookCalls.push("onBeforeCreateStepList");
        },
      ],
    },
  };
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "schedule",
      childIds: {
        "step-a": "child-1",
      },
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

function schedule_hooks_not_called(this: Context) {
  expect(this.error).toBeNull();
  expect(this.hookCalls).toEqual([]);
  expect(this.workItemSource.drafts).toHaveLength(0);
}

function verify_hooks_fixture(this: Context) {
  this.hookCalls = [];
  this.workItemSource = new MockSource();
  this.definition = {
    ...linearDefinition,
    hooks: {
      onBeforeVerify: [
        () => {
          this.hookCalls.push("onBeforeVerify");
        },
      ],
      onAfterVerify: [
        () => {
          this.hookCalls.push("onAfterVerify");
        },
      ],
      onBeforeCreateStepList: [
        () => {
          this.hookCalls.push("onBeforeCreateStepList");
        },
      ],
    },
  };
  for (const id of ["child-1", "child-2", "child-3"]) {
    this.workItemSource.statuses.set(id, "completed");
  }
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "verify",
      childIds: {
        "step-a": "child-1",
        "step-b": "child-2",
        "step-c": "child-3",
      },
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

function verify_hooks_ran_in_order(this: Context) {
  expect(this.error).toBeNull();
  expect(this.hookCalls).toEqual(["onBeforeVerify", "onAfterVerify"]);
}

function schedule_hook_failure_fixture(this: Context) {
  this.workItemSource = new MockSource();
  this.definition = {
    ...linearDefinition,
    hooks: {
      onBeforeDraftChildren: [
        () => {
          throw new Error("hook failed");
        },
      ],
    },
  };
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "schedule",
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

function workflow_throws_hook_error(this: Context) {
  expect(this.error?.message).toBe("hook failed");
}

function multiple_schedule_hooks_fixture(this: Context) {
  this.hookCalls = [];
  this.workItemSource = new MockSource();
  this.definition = {
    ...linearDefinition,
    hooks: {
      onBeforeDraftChildren: [
        () => {
          this.hookCalls.push("first");
        },
        () => {
          this.hookCalls.push("second");
        },
      ],
    },
  };
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "schedule",
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

function multiple_schedule_hooks_ran_in_order(this: Context) {
  expect(this.error).toBeNull();
  expect(this.hookCalls).toEqual(["first", "second"]);
}

function chained_filter_steps_fixture(this: Context) {
  this.workItemSource = new MockSource();
  this.definition = {
    ...linearDefinition,
    hooks: {
      onBeforeCreateStepList: [
        ({ schedule }) => schedule.steps.filter((step) => step.id !== "step-c"),
        ({ schedule }) => schedule.steps.filter((step) => step.id === "step-a"),
      ],
    },
  };
  this.workItem = {
    workItemId: "workflow-1",
    kind: "workflow",
    name: "linear",
    flow: [],
    state: {
      workingDir: "/tmp",
      phase: "schedule",
    },
    metadata: {},
  };
  this.ctx = makeCtx(this.workItemSource);
}

function chained_filter_keeps_step_a(this: Context) {
  expect(this.error).toBeNull();
  expect(this.workItemSource.drafts).toHaveLength(1);
  expect(this.workItemSource.drafts[0]?.input.name).toBe("a");
}

function makeCtx(workItemSource: MockSource): ScriptContext {
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
    workItemSource,
    async setState(nextState) {
      Object.assign(state, nextState);
    },
  };
}
