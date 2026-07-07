import type {
  CreateDraftWorkItemInput,
  WorkItem,
  WorkItemDependency,
  WorkItemSource,
} from "@bifrost-ai/interfaces-work";
import type { FramePayload, PeerIdentity, RunnerPeer } from "@bifrost-ai/protocol";
import { createRunnerPeer, generateKeyPair } from "@bifrost-ai/protocol";

import { runOrchestrator } from "./orchestrator.js";
import type { Scheduler } from "./types.js";

export type MemoryWorkItemSource = WorkItemSource & {
  completed: string[];
  failed: Array<{ workItemId: string; error: string }>;
  paused: string[];
  states: Map<string, Record<string, unknown>>;
  drafts: Map<string, CreateDraftWorkItemInput>;
  started: Set<string>;
  dependencies: Map<string, WorkItemDependency[]>;
};

export type StubRunnerBehavior = {
  onDispatch?: (workItem: WorkItem) => Promise<"complete" | "fail" | "pause" | "reject">;
  dispatchDelayMs?: number;
  failMessage?: string;
  rejectReason?: string;
  setStateOnDispatch?: Record<string, unknown>;
};

export function createMemoryWorkItemSource(workItems: WorkItem[]): MemoryWorkItemSource {
  const completed: string[] = [];
  const failed: Array<{ workItemId: string; error: string }> = [];
  const paused: string[] = [];
  const states = new Map<string, Record<string, unknown>>();
  const drafts = new Map<string, CreateDraftWorkItemInput>();
  const started = new Set<string>(workItems.map((workItem) => workItem.workItemId));
  const dependencies = new Map<string, WorkItemDependency[]>();
  let nextDraftId = 1;

  return {
    completed,
    failed,
    paused,
    states,
    drafts,
    started,
    dependencies,
    async *watchWorkItems() {
      for (const workItem of workItems) {
        yield workItem;
      }
    },
    async completeWorkItem(workItemId: string) {
      completed.push(workItemId);
    },
    async failWorkItem(workItemId: string, error: string) {
      failed.push({ workItemId, error });
    },
    async pauseWorkItem(workItemId: string) {
      paused.push(workItemId);
    },
    async setState(workItemId: string, state: Record<string, unknown>) {
      states.set(workItemId, state);
    },
    async createDraftWorkItem(input: CreateDraftWorkItemInput) {
      const workItemId = `draft-${nextDraftId}`;
      nextDraftId += 1;
      drafts.set(workItemId, input);
      return workItemId;
    },
    async startWorkItem(workItemId: string) {
      started.add(workItemId);
    },
    async setDependency(workItemId: string, dependsOnWorkItemId: string, type = "blocks") {
      const edges = dependencies.get(workItemId) ?? [];
      edges.push({ workItemId: dependsOnWorkItemId, type });
      dependencies.set(workItemId, edges);
    },
    async getDependencies(workItemId: string) {
      return dependencies.get(workItemId) ?? [];
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
  workItemSource: MemoryWorkItemSource;
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
    workItemSource: options.workItemSource,
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

  runner.send({ kind: "heartbeat", runnerId: options.runnerIdentity.keyId });
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

  const workItem = payload.params as WorkItem;
  const outcome = behavior.onDispatch
    ? await behavior.onDispatch(workItem)
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
    const requestId = `set-state-${workItem.workItemId}`;
    runner.send({
      kind: "rpc.request",
      id: requestId,
      method: "workItemSource.setState",
      params: { workItemId: workItem.workItemId, state: behavior.setStateOnDispatch },
    });
    await waitForRpcResponse(runner, requestId);
  }

  if (behavior.dispatchDelayMs !== undefined && behavior.dispatchDelayMs > 0) {
    await delay(behavior.dispatchDelayMs);
  }

  const terminalId = `terminal-${workItem.workItemId}`;
  switch (outcome) {
    case "complete":
      runner.send({
        kind: "rpc.request",
        id: terminalId,
        method: "workItem.complete",
        params: { workItemId: workItem.workItemId },
      });
      break;
    case "fail":
      runner.send({
        kind: "rpc.request",
        id: terminalId,
        method: "workItem.fail",
        params: { workItemId: workItem.workItemId, message: behavior.failMessage ?? "failed" },
      });
      break;
    case "pause":
      runner.send({
        kind: "rpc.request",
        id: terminalId,
        method: "workItem.pause",
        params: { workItemId: workItem.workItemId },
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

export function sampleWorkItem(workItemId: string): WorkItem {
  return {
    workItemId,
    kind: "script",
    name: "echo",
    state: {},
    metadata: {},
  };
}
