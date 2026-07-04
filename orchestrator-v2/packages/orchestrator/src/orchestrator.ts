import { createOrchestratorPeer, type OrchestratorPeer } from "@bifrost-ai/protocol";

import { DispatchAckHandler } from "./dispatch-ack-handler.js";
import { DispatchTracker } from "./dispatch-tracker.js";
import { dispatchWorkItem } from "./dispatcher.js";
import { PeerRegistry } from "./peer-registry.js";
import { ResultHandler } from "./result-handler.js";
import { RpcRouter } from "./rpc-router.js";
import { isDispatchAck, isHeartbeat, isRpcRequest, type OrchestratorOptions } from "./types.js";

const DEFAULT_HEARTBEAT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_IN_FLIGHT_PER_PEER = 1;
const DRAIN_POLL_MS = 10;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function drainInFlight(tracker: DispatchTracker, abortSignal?: AbortSignal): Promise<void> {
  while (tracker.hasInFlight()) {
    if (abortSignal?.aborted === true) {
      return;
    }
    await delay(DRAIN_POLL_MS);
  }
}

export type RunOrchestratorOptions = OrchestratorOptions & {
  abortSignal?: AbortSignal;
};

export type OrchestratorHandle = {
  peer: OrchestratorPeer;
  done: Promise<void>;
};

export async function runOrchestrator(
  options: RunOrchestratorOptions,
): Promise<OrchestratorHandle> {
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
  const maxInFlightPerPeer = options.maxInFlightPerPeer ?? DEFAULT_MAX_IN_FLIGHT_PER_PEER;

  const peer = await createOrchestratorPeer({
    identity: options.identity,
    trustedPublicKeys: options.authorizedRunners,
    host: options.host,
    port: options.port,
  });

  const registry = new PeerRegistry({ heartbeatTimeoutMs, maxInFlightPerPeer });
  const tracker = new DispatchTracker();
  const results = new ResultHandler(options.workItemSource, tracker, registry);
  const router = new RpcRouter(options.workItemSource, options.scheduler, results);
  const acks = new DispatchAckHandler(options.workItemSource, tracker, registry);

  const disconnectCleanup = peer.onPeerDisconnect((connected) => {
    results.handleDisconnect(connected);
    registry.remove(connected.peerId);
  });

  const connectCleanup = peer.onPeerConnect((connected) => {
    registry.add(connected);
    connected.subscribe(isHeartbeat, (payload) => {
      registry.recordHeartbeat(connected.peerId, payload);
    });
    connected.subscribe(isRpcRequest, (payload) => {
      router.handle(connected, payload);
    });
    connected.subscribe(isDispatchAck, (payload) => {
      acks.handle(connected, payload);
    });
  });

  const abortSignal = options.abortSignal;
  let closed = false;

  const done = (async () => {
    try {
      for await (const workItem of options.workItemSource.watchWorkItems()) {
        if (abortSignal?.aborted === true) {
          break;
        }
        const runner = await registry.waitForAvailablePeer();
        dispatchWorkItem(runner, workItem, tracker, registry);
      }
      await drainInFlight(tracker, abortSignal);
    } finally {
      cleanup();
    }
  })();

  if (abortSignal !== undefined) {
    if (abortSignal.aborted) {
      cleanup();
      return { peer, done };
    }
    abortSignal.addEventListener("abort", cleanup, { once: true });
  }

  return { peer, done };

  function cleanup(): void {
    if (closed) {
      return;
    }
    closed = true;
    connectCleanup();
    disconnectCleanup();
    peer.close();
  }
}
