import { describe, expect } from "vite-plus/test";
import test, { withAspect } from "vitest-gwt";
import { createRunnerPeer } from "@bifrost-ai/protocol";
import type { PeerIdentity, RunnerPeer } from "@bifrost-ai/protocol";

import {
  authorizedRunnersFor,
  createIdentities,
  createMemoryTaskSource,
  delay,
  sampleTask,
  startOrchestratorInBackground,
  waitFor,
} from "./test-helpers.js";
import type { MemoryTaskSource, StubRunnerBehavior } from "./test-helpers.js";

type Context = {
  orchestratorIdentity: PeerIdentity;
  runnerIdentity: PeerIdentity;
  unauthorizedRunnerIdentity: PeerIdentity;
  taskSource: MemoryTaskSource;
  dispatchedTaskIds: string[];
  abort: () => void;
  done: Promise<void>;
  connectRunner: (
    runnerIdentity: PeerIdentity,
    behavior?: StubRunnerBehavior,
  ) => Promise<RunnerPeer>;
  orchestratorAddress: { host: string; port: number };
  unauthorizedRunner: RunnerPeer | null;
};

describe("thin orchestrator", () => {
  withAspect(setup_identities, teardown_orchestrator);

  test("completes task when runner acks dispatch and sends task.complete", {
    given: {
      task_source_with_one_task,
      orchestrator_running,
      authorized_runner_connected,
    },
    when: {
      waiting_for_completion,
    },
    then: {
      task_is_completed,
    },
  });

  test("fails task when runner sends task.fail", {
    given: {
      task_source_with_one_task,
      orchestrator_running,
      runner_connected_with_fail_behavior,
    },
    when: {
      waiting_for_failure,
    },
    then: {
      task_is_failed,
    },
  });

  test("pauses task when runner sends task.pause", {
    given: {
      task_source_with_one_task,
      orchestrator_running,
      runner_connected_with_pause_behavior,
    },
    when: {
      waiting_for_pause,
    },
    then: {
      task_is_paused,
    },
  });

  test("fails task when runner rejects dispatch", {
    given: {
      task_source_with_one_task,
      orchestrator_running,
      runner_connected_with_reject_behavior,
    },
    when: {
      waiting_for_dispatch_rejection,
    },
    then: {
      task_is_failed_on_reject,
    },
  });

  test("dispatches multiple tasks before first completes", {
    given: {
      task_source_with_two_tasks,
      orchestrator_running_with_concurrency,
      slow_runner_connected,
    },
    when: {
      waiting_for_both_dispatched_then_complete,
    },
    then: {
      both_tasks_completed,
    },
  });

  test("proxies taskSource.setState from runner", {
    given: {
      task_source_with_one_task,
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
      task_source_with_one_task,
      orchestrator_without_authorized_runners,
      unauthorized_runner_connected,
    },
    when: {
      waiting_briefly,
    },
    then: {
      task_was_not_completed,
    },
  });
});

function setup_identities(this: Context) {
  const identities = createIdentities();
  this.orchestratorIdentity = identities.orchestratorIdentity;
  this.runnerIdentity = identities.runnerIdentity;
  this.unauthorizedRunnerIdentity = createIdentities().runnerIdentity;
  this.dispatchedTaskIds = [];
  this.unauthorizedRunner = null;
}

async function teardown_orchestrator(this: Context) {
  this.unauthorizedRunner?.close();
  this.abort?.();
  await this.done?.catch(() => undefined);
}

function task_source_with_one_task(this: Context) {
  this.taskSource = createMemoryTaskSource([sampleTask("task-1")]);
}

function task_source_with_two_tasks(this: Context) {
  this.taskSource = createMemoryTaskSource([sampleTask("task-a"), sampleTask("task-b")]);
}

async function orchestrator_running(this: Context) {
  const running = await startOrchestratorInBackground({
    orchestratorIdentity: this.orchestratorIdentity,
    authorizedRunners: authorizedRunnersFor(this.runnerIdentity),
    taskSource: this.taskSource,
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
    taskSource: this.taskSource,
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
    taskSource: this.taskSource,
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
    onDispatch: async (task) => {
      this.dispatchedTaskIds.push(task.id);
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
  await waitFor(() => this.taskSource.completed.length === 1);
}

async function waiting_for_failure(this: Context) {
  await waitFor(() => this.taskSource.failed.length === 1);
}

async function waiting_for_pause(this: Context) {
  await waitFor(() => this.taskSource.paused.length === 1);
}

async function waiting_for_dispatch_rejection(this: Context) {
  await waitFor(() => this.taskSource.failed.length === 1);
}

async function waiting_for_both_dispatched_then_complete(this: Context) {
  await waitFor(() => this.dispatchedTaskIds.length === 2);
  await waitFor(() => this.taskSource.completed.length === 2);
}

async function waiting_for_set_state(this: Context) {
  await waitFor(() => this.taskSource.states.has("task-1"));
}

async function waiting_briefly(this: Context) {
  await delay(300);
}

function task_is_completed(this: Context) {
  expect(this.taskSource.completed).toEqual(["task-1"]);
}

function task_is_failed(this: Context) {
  expect(this.taskSource.failed).toEqual([{ taskId: "task-1", error: "boom" }]);
}

function task_is_paused(this: Context) {
  expect(this.taskSource.paused).toEqual(["task-1"]);
}

function task_is_failed_on_reject(this: Context) {
  expect(this.taskSource.failed).toEqual([{ taskId: "task-1", error: "busy" }]);
}

function both_tasks_completed(this: Context) {
  expect(this.dispatchedTaskIds).toEqual(["task-a", "task-b"]);
  expect([...this.taskSource.completed].sort((a, b) => a.localeCompare(b))).toEqual([
    "task-a",
    "task-b",
  ]);
}

function set_state_was_persisted(this: Context) {
  expect(this.taskSource.states.get("task-1")).toEqual({ step: "mid-run" });
}

function task_was_not_completed(this: Context) {
  expect(this.taskSource.completed).toEqual([]);
  expect(this.taskSource.failed).toEqual([]);
}
