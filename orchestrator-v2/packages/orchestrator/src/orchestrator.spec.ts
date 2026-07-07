import { describe, expect } from "vite-plus/test";
import test, { withAspect } from "vitest-gwt";
import { createRunnerPeer } from "@bifrost-ai/protocol";
import type { PeerIdentity, RunnerPeer } from "@bifrost-ai/protocol";

import {
  authorizedRunnersFor,
  createIdentities,
  createMemoryWorkItemSource,
  delay,
  sampleWorkItem,
  startOrchestratorInBackground,
  waitFor,
} from "./test-helpers.js";
import type { MemoryWorkItemSource, StubRunnerBehavior } from "./test-helpers.js";

type Context = {
  orchestratorIdentity: PeerIdentity;
  runnerIdentity: PeerIdentity;
  unauthorizedRunnerIdentity: PeerIdentity;
  workItemSource: MemoryWorkItemSource;
  dispatchedWorkItemIds: string[];
  abort: () => void;
  done: Promise<void>;
  connectRunner: (
    runnerIdentity: PeerIdentity,
    behavior?: StubRunnerBehavior,
  ) => Promise<RunnerPeer>;
  orchestratorAddress: { host: string; port: number };
  unauthorizedRunner: RunnerPeer | null;
  completeAttempts: string[];
};

describe("thin orchestrator", () => {
  withAspect(setup_identities, teardown_orchestrator);

  test("completes work item when runner acks dispatch and sends workItem.complete", {
    given: {
      work_item_source_with_one_item,
      orchestrator_running,
      authorized_runner_connected,
    },
    when: {
      waiting_for_completion,
    },
    then: {
      work_item_is_completed,
    },
  });

  test("fails work item when runner sends workItem.fail", {
    given: {
      work_item_source_with_one_item,
      orchestrator_running,
      runner_connected_with_fail_behavior,
    },
    when: {
      waiting_for_failure,
    },
    then: {
      work_item_is_failed,
    },
  });

  test("pauses work item when runner sends workItem.pause", {
    given: {
      work_item_source_with_one_item,
      orchestrator_running,
      runner_connected_with_pause_behavior,
    },
    when: {
      waiting_for_pause,
    },
    then: {
      work_item_is_paused,
    },
  });

  test("fails work item when runner rejects dispatch", {
    given: {
      work_item_source_with_one_item,
      orchestrator_running,
      runner_connected_with_reject_behavior,
    },
    when: {
      waiting_for_dispatch_rejection,
    },
    then: {
      work_item_is_failed_on_reject,
    },
  });

  test("dispatches multiple work items before first completes", {
    given: {
      work_item_source_with_two_items,
      orchestrator_running_with_concurrency,
      slow_runner_connected,
    },
    when: {
      waiting_for_both_dispatched_then_complete,
    },
    then: {
      both_work_items_completed,
    },
  });

  test("a throwing complete callback still frees the peer for the next work item (I3)", {
    given: {
      work_item_source_that_throws_on_complete,
      orchestrator_running,
      authorized_runner_connected,
    },
    when: {
      waiting_for_both_completes_attempted,
    },
    then: {
      both_completes_were_attempted,
    },
  });

  test("proxies workItemSource.setState from runner", {
    given: {
      work_item_source_with_one_item,
      orchestrator_running,
      runner_connected_with_set_state,
    },
    when: {
      waiting_for_set_state,
    },
    then: {
      set_state_was_persisted,
    },
  });

  test("rejects unknown runner keys", {
    given: {
      work_item_source_with_one_item,
      orchestrator_without_authorized_runners,
      unauthorized_runner_connected,
    },
    when: {
      waiting_briefly,
    },
    then: {
      work_item_was_not_completed,
    },
  });
});

function setup_identities(this: Context) {
  const identities = createIdentities();
  this.orchestratorIdentity = identities.orchestratorIdentity;
  this.runnerIdentity = identities.runnerIdentity;
  this.unauthorizedRunnerIdentity = createIdentities().runnerIdentity;
  this.dispatchedWorkItemIds = [];
  this.unauthorizedRunner = null;
}

async function teardown_orchestrator(this: Context) {
  this.unauthorizedRunner?.close();
  this.abort?.();
  await this.done?.catch(() => undefined);
}

function work_item_source_with_one_item(this: Context) {
  this.workItemSource = createMemoryWorkItemSource([sampleWorkItem("work-item-1")]);
}

function work_item_source_with_two_items(this: Context) {
  this.workItemSource = createMemoryWorkItemSource([
    sampleWorkItem("work-item-a"),
    sampleWorkItem("work-item-b"),
  ]);
}

async function orchestrator_running(this: Context) {
  const running = await startOrchestratorInBackground({
    orchestratorIdentity: this.orchestratorIdentity,
    authorizedRunners: authorizedRunnersFor(this.runnerIdentity),
    workItemSource: this.workItemSource,
  });
  this.abort = running.abort;
  this.done = running.done;
  this.connectRunner = running.connectRunner;
  this.orchestratorAddress = running.address;
}

async function orchestrator_running_with_concurrency(this: Context) {
  const running = await startOrchestratorInBackground({
    orchestratorIdentity: this.orchestratorIdentity,
    authorizedRunners: authorizedRunnersFor(this.runnerIdentity),
    workItemSource: this.workItemSource,
    maxInFlightPerPeer: 2,
  });
  this.abort = running.abort;
  this.done = running.done;
  this.connectRunner = running.connectRunner;
  this.orchestratorAddress = running.address;
}

async function orchestrator_without_authorized_runners(this: Context) {
  const running = await startOrchestratorInBackground({
    orchestratorIdentity: this.orchestratorIdentity,
    authorizedRunners: new Map(),
    workItemSource: this.workItemSource,
  });
  this.abort = running.abort;
  this.done = running.done;
  this.orchestratorAddress = running.address;
}

async function authorized_runner_connected(this: Context) {
  await this.connectRunner(this.runnerIdentity);
}

async function runner_connected_with_fail_behavior(this: Context) {
  await this.connectRunner(this.runnerIdentity, {
    onDispatch: async () => "fail",
    failMessage: "boom",
  });
}

async function runner_connected_with_pause_behavior(this: Context) {
  await this.connectRunner(this.runnerIdentity, {
    onDispatch: async () => "pause",
  });
}

async function runner_connected_with_reject_behavior(this: Context) {
  await this.connectRunner(this.runnerIdentity, {
    onDispatch: async () => "reject",
    rejectReason: "busy",
  });
}

async function slow_runner_connected(this: Context) {
  await this.connectRunner(this.runnerIdentity, {
    dispatchDelayMs: 200,
    onDispatch: async (workItem) => {
      this.dispatchedWorkItemIds.push(workItem.workItemId);
      return "complete";
    },
  });
}

async function runner_connected_with_set_state(this: Context) {
  await this.connectRunner(this.runnerIdentity, {
    setStateOnDispatch: { step: "mid-run" },
  });
}

async function unauthorized_runner_connected(this: Context) {
  const { host, port } = this.orchestratorAddress;
  this.unauthorizedRunner = await createRunnerPeer({
    identity: this.unauthorizedRunnerIdentity,
    trustedPublicKeys: new Map([
      [this.orchestratorIdentity.keyId, this.orchestratorIdentity.publicKey],
    ]),
    url: `ws://${host}:${port}`,
  });
  this.unauthorizedRunner.send({
    kind: "heartbeat",
    runnerId: this.unauthorizedRunnerIdentity.keyId,
  });
}

async function waiting_for_completion(this: Context) {
  await waitFor(() => this.workItemSource.completed.length === 1);
}

async function waiting_for_failure(this: Context) {
  await waitFor(() => this.workItemSource.failed.length === 1);
}

async function waiting_for_pause(this: Context) {
  await waitFor(() => this.workItemSource.paused.length === 1);
}

async function waiting_for_dispatch_rejection(this: Context) {
  await waitFor(() => this.workItemSource.failed.length === 1);
}

async function waiting_for_both_dispatched_then_complete(this: Context) {
  await waitFor(() => this.dispatchedWorkItemIds.length === 2);
  await waitFor(() => this.workItemSource.completed.length === 2);
}

async function waiting_for_set_state(this: Context) {
  await waitFor(() => this.workItemSource.states.has("work-item-1"));
}

async function waiting_briefly(this: Context) {
  await delay(300);
}

function work_item_is_completed(this: Context) {
  expect(this.workItemSource.completed).toEqual(["work-item-1"]);
}

function work_item_is_failed(this: Context) {
  expect(this.workItemSource.failed).toEqual([{ workItemId: "work-item-1", error: "boom" }]);
}

function work_item_is_paused(this: Context) {
  expect(this.workItemSource.paused).toEqual(["work-item-1"]);
}

function work_item_is_failed_on_reject(this: Context) {
  expect(this.workItemSource.failed).toEqual([{ workItemId: "work-item-1", error: "busy" }]);
}

function both_work_items_completed(this: Context) {
  expect(this.dispatchedWorkItemIds).toEqual(["work-item-a", "work-item-b"]);
  expect([...this.workItemSource.completed].sort((a, b) => a.localeCompare(b))).toEqual([
    "work-item-a",
    "work-item-b",
  ]);
}

function set_state_was_persisted(this: Context) {
  expect(this.workItemSource.states.get("work-item-1")).toEqual({ step: "mid-run" });
}

function work_item_was_not_completed(this: Context) {
  expect(this.workItemSource.completed).toEqual([]);
  expect(this.workItemSource.failed).toEqual([]);
}

function work_item_source_that_throws_on_complete(this: Context) {
  const attempts: string[] = [];
  this.completeAttempts = attempts;
  const source = createMemoryWorkItemSource([
    sampleWorkItem("work-item-a"),
    sampleWorkItem("work-item-b"),
  ]);
  this.workItemSource = {
    ...source,
    async completeWorkItem(workItemId: string) {
      attempts.push(workItemId);
      throw new Error("source boom");
    },
  };
}

async function waiting_for_both_completes_attempted(this: Context) {
  await waitFor(() => this.completeAttempts.length === 2);
}

function both_completes_were_attempted(this: Context) {
  // work-item-a's complete threw; had that leaked the peer's slot, work-item-b
  // would never dispatch — so seeing both proves settle() freed the slot anyway.
  expect([...this.completeAttempts].sort((a, b) => a.localeCompare(b))).toEqual([
    "work-item-a",
    "work-item-b",
  ]);
}
