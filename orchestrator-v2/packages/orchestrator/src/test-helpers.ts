import type { Task, TaskSource } from "@bifrost-ai/interfaces-task-source";
import type { FramePayload, PeerIdentity, RunnerPeer } from "@bifrost-ai/protocol";
import { capabilityKey, createRunnerPeer, generateKeyPair } from "@bifrost-ai/protocol";

import { runOrchestrator } from "./orchestrator.js";
import type { Scheduler } from "./types.js";

export type MemoryTaskSource = TaskSource & {
  completed: string[];
  failed: Array<{ taskId: string; error: string }>;
  paused: string[];
  states: Map<string, Record<string, unknown>>;
};

export type StubRunnerBehavior = {
  onDispatch?: (task: Task) => Promise<"complete" | "fail" | "pause" | "reject">;
  dispatchDelayMs?: number;
  failMessage?: string;
  rejectReason?: string;
  setStateOnDispatch?: Record<string, unknown>;
};

export function createMemoryTaskSource(tasks: Task[]): MemoryTaskSource {
  const completed: string[] = [];
  const failed: Array<{ taskId: string; error: string }> = [];
  const paused: string[] = [];
  const states = new Map<string, Record<string, unknown>>();

  return {
    completed,
    failed,
    paused,
    states,
    async *watchTasks() {
      for (const task of tasks) {
        yield task;
      }
    },
    async completeTask(taskId: string) {
      completed.push(taskId);
    },
    async failTask(taskId: string, error: string) {
      failed.push({ taskId, error });
    },
    async pauseTask(taskId: string) {
      paused.push(taskId);
    },
    async setState(taskId: string, taskState: Record<string, unknown>) {
      states.set(taskId, taskState);
    },
  };
}

export function createNoopScheduler(): Scheduler {
  return {
    async call() {
      return { ok: true };
    },
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createIdentities(): {
  orchestratorIdentity: PeerIdentity;
  runnerIdentity: PeerIdentity;
} {
  return {
    orchestratorIdentity: generateKeyPair("orchestrator"),
    runnerIdentity: generateKeyPair("runner"),
  };
}

export function authorizedRunnersFor(
  runnerIdentity: PeerIdentity,
): Map<string, import("node:crypto").KeyObject> {
  return new Map([[runnerIdentity.keyId, runnerIdentity.publicKey]]);
}

export async function waitFor(
  predicate: () => boolean,
  timeoutMs = 3_000,
  intervalMs = 25,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await delay(intervalMs);
  }
}

export async function startOrchestratorInBackground(options: {
  orchestratorIdentity: PeerIdentity;
  authorizedRunners: Map<string, import("node:crypto").KeyObject>;
  taskSource: MemoryTaskSource;
  scheduler?: Scheduler;
  maxInFlightPerPeer?: number;
}): Promise<{
  abort: () => void;
  done: Promise<void>;
  address: { host: string; port: number };
  connectRunner: (
    runnerIdentity: PeerIdentity,
    behavior?: StubRunnerBehavior,
  ) => Promise<RunnerPeer>;
}> {
  const abortController = new AbortController();
  const handle = await runOrchestrator({
    identity: options.orchestratorIdentity,
    authorizedRunners: options.authorizedRunners,
    taskSource: options.taskSource,
    scheduler: options.scheduler ?? createNoopScheduler(),
    maxInFlightPerPeer: options.maxInFlightPerPeer,
    abortSignal: abortController.signal,
  });

  const { host, port } = handle.peer.address;

  return {
    address: { host, port },
    abort: () => {
      abortController.abort();
    },
    done: handle.done,
    connectRunner: (runnerIdentity, behavior) =>
      connectStubRunner({
        url: `ws://${host}:${port}`,
        orchestratorIdentity: options.orchestratorIdentity,
        runnerIdentity,
        behavior,
      }),
  };
}

export async function connectStubRunner(options: {
  url: string;
  orchestratorIdentity: PeerIdentity;
  runnerIdentity: PeerIdentity;
  behavior?: StubRunnerBehavior;
}): Promise<RunnerPeer> {
  const runner = await createRunnerPeer({
    identity: options.runnerIdentity,
    trustedPublicKeys: new Map([
      [options.orchestratorIdentity.keyId, options.orchestratorIdentity.publicKey],
    ]),
    url: options.url,
  });

  runner.subscribe(
    (payload) => payload.kind === "rpc.request" && payload.method === "dispatch",
    (payload) => {
      void handleDispatch(runner, payload, options.behavior ?? {});
    },
  );

  // Advertise the sampleTask capability so the (fail-closed) router will dispatch to this stub.
  runner.send({
    kind: "heartbeat",
    runnerId: options.runnerIdentity.keyId,
    capabilities: [capabilityKey("script", "echo")],
  });
  return runner;
}

async function handleDispatch(
  runner: RunnerPeer,
  payload: FramePayload,
  behavior: StubRunnerBehavior,
): Promise<void> {
  if (payload.kind !== "rpc.request") {
    return;
  }

  const task = payload.params as Task;
  const outcome = behavior.onDispatch
    ? await behavior.onDispatch(task)
    : await defaultOutcome(behavior);

  if (outcome === "reject") {
    runner.send({
      kind: "rpc.response",
      id: payload.id,
      result: { accepted: false, reason: behavior.rejectReason ?? "rejected" },
    });
    return;
  }

  runner.send({
    kind: "rpc.response",
    id: payload.id,
    result: { accepted: true },
  });

  if (behavior.setStateOnDispatch !== undefined) {
    const requestId = `set-state-${task.taskId}`;
    runner.send({
      kind: "rpc.request",
      id: requestId,
      method: "taskSource.setState",
      params: { taskId: task.taskId, taskState: behavior.setStateOnDispatch },
    });
    await waitForRpcResponse(runner, requestId);
  }

  if (behavior.dispatchDelayMs !== undefined && behavior.dispatchDelayMs > 0) {
    await delay(behavior.dispatchDelayMs);
  }

  const terminalId = `terminal-${task.taskId}`;
  switch (outcome) {
    case "complete":
      runner.send({
        kind: "rpc.request",
        id: terminalId,
        method: "task.complete",
        params: { taskId: task.taskId },
      });
      break;
    case "fail":
      runner.send({
        kind: "rpc.request",
        id: terminalId,
        method: "task.fail",
        params: { taskId: task.taskId, message: behavior.failMessage ?? "failed" },
      });
      break;
    case "pause":
      runner.send({
        kind: "rpc.request",
        id: terminalId,
        method: "task.pause",
        params: { taskId: task.taskId },
      });
      break;
  }
  await waitForRpcResponse(runner, terminalId);
}

async function defaultOutcome(behavior: StubRunnerBehavior): Promise<"complete"> {
  if (behavior.dispatchDelayMs !== undefined && behavior.dispatchDelayMs > 0) {
    await delay(behavior.dispatchDelayMs);
  }
  return "complete";
}

function waitForRpcResponse(runner: RunnerPeer, id: string): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = runner.subscribe(
      (payload) => payload.kind === "rpc.response" && payload.id === id,
      () => {
        unsubscribe();
        resolve();
      },
    );
  });
}

export function sampleTask(taskId: string): Task {
  return {
    taskId,
    agentType: "script",
    agentName: "echo",
    taskState: {},
    metadata: {},
  };
}
