import { describe, expect } from "vite-plus/test";
import test, { withAspect } from "vitest-gwt";
import WebSocket from "ws";

import { encodeEnvelope } from "./frames.js";
import { generateKeyPair } from "./keys.js";
import { createOrchestratorPeer } from "./orchestrator.js";
import { createRunnerPeer } from "./runner.js";
import { signPayload } from "./sign.js";
import type { ConnectedPeer, OrchestratorPeer, PeerIdentity, RunnerPeer } from "./types.js";
import type { KeyObject } from "node:crypto";

type Context = {
  orchestratorIdentity: PeerIdentity;
  runnerIdentity: PeerIdentity;
  trustedByOrchestrator: Map<string, KeyObject>;
  trustedByRunner: Map<string, KeyObject>;
  orchestrator: OrchestratorPeer;
  runner: RunnerPeer;
  connectedPeer: ConnectedPeer;
  peerId: string;
  runnerToOrchestratorResult: unknown;
  orchestratorToRunnerResult: unknown;
  streamChunks: unknown[];
  disconnectPeerId: string | null;
  tamperedReceived: boolean;
};

describe("loopback protocol", () => {
  withAspect(setup_identities, teardown_peers);

  test("runner request round-trips through connected peer", {
    given: {
      peers_connected,
      orchestrator_echo_handler_registered,
    },
    when: {
      runner_sends_echo_request_and_waits,
    },
    then: {
      runner_receives_echo_response,
    },
  });

  test("orchestrator dispatches request via send(peerId)", {
    given: {
      peers_connected,
      runner_dispatch_handler_registered,
    },
    when: {
      orchestrator_sends_dispatch_request_and_waits,
    },
    then: {
      orchestrator_receives_dispatch_response,
    },
  });

  test("streams ordered rpc.stream events", {
    given: {
      peers_connected,
      orchestrator_stream_handler_registered,
    },
    when: {
      runner_requests_stream_and_waits,
    },
    then: {
      runner_collects_stream_chunks,
    },
  });

  test("fires onPeerDisconnect when runner closes", {
    given: {
      peers_connected,
      disconnect_handler_registered,
    },
    when: {
      runner_closes_connection,
    },
    then: {
      disconnect_callback_fires,
    },
  });

  test("rejects tampered frames", {
    given: {
      peers_connected,
      tamper_subscriber_registered,
    },
    when: {
      sending_tampered_frame,
    },
    then: {
      tampered_frame_not_delivered,
    },
  });
});

function setup_identities(this: Context) {
  this.orchestratorIdentity = generateKeyPair("orchestrator");
  this.runnerIdentity = generateKeyPair("runner");
  this.trustedByOrchestrator = new Map([
    [this.runnerIdentity.keyId, this.runnerIdentity.publicKey],
  ]);
  this.trustedByRunner = new Map([
    [this.orchestratorIdentity.keyId, this.orchestratorIdentity.publicKey],
  ]);
  this.streamChunks = [];
  this.disconnectPeerId = null;
  this.tamperedReceived = false;
}

async function teardown_peers(this: Context) {
  this.runner?.close();
  this.orchestrator?.close();
}

async function peers_connected(this: Context) {
  this.orchestrator = await createOrchestratorPeer({
    identity: this.orchestratorIdentity,
    trustedPublicKeys: this.trustedByOrchestrator,
  });

  const peerReady = new Promise<ConnectedPeer>((resolve) => {
    this.orchestrator.onPeerConnect((peer) => {
      resolve(peer);
    });
  });

  const { host, port } = this.orchestrator.address;
  this.runner = await createRunnerPeer({
    identity: this.runnerIdentity,
    trustedPublicKeys: this.trustedByRunner,
    url: `ws://${host}:${port}`,
  });

  this.connectedPeer = await peerReady;
  this.peerId = this.connectedPeer.peerId;
}

function orchestrator_echo_handler_registered(this: Context) {
  this.connectedPeer.subscribe(
    (payload) => payload.kind === "rpc.request" && payload.id === "req-1",
    (payload) => {
      if (payload.kind !== "rpc.request") {
        return;
      }
      this.connectedPeer.send({
        kind: "rpc.response",
        id: payload.id,
        result: payload.params,
      });
    },
  );
}

async function runner_sends_echo_request_and_waits(this: Context) {
  await new Promise<void>((resolve) => {
    this.runner.subscribe(
      (payload) => payload.kind === "rpc.response" && payload.id === "req-1",
      (payload) => {
        if (payload.kind === "rpc.response") {
          this.runnerToOrchestratorResult = payload.result;
          resolve();
        }
      },
    );

    this.runner.send({
      kind: "rpc.request",
      id: "req-1",
      method: "echo",
      params: { x: 1 },
    });
  });
}

function runner_receives_echo_response(this: Context) {
  expect(this.runnerToOrchestratorResult).toEqual({ x: 1 });
}

function runner_dispatch_handler_registered(this: Context) {
  this.runner.subscribe(
    (payload) => payload.kind === "rpc.request" && payload.id === "req-2",
    (payload) => {
      if (payload.kind !== "rpc.request") {
        return;
      }
      this.runner.send({
        kind: "rpc.response",
        id: payload.id,
        result: { ok: true, task: payload.params },
      });
    },
  );
}

async function orchestrator_sends_dispatch_request_and_waits(this: Context) {
  await new Promise<void>((resolve) => {
    this.connectedPeer.subscribe(
      (payload) => payload.kind === "rpc.response" && payload.id === "req-2",
      (payload) => {
        if (payload.kind === "rpc.response") {
          this.orchestratorToRunnerResult = payload.result;
          resolve();
        }
      },
    );

    this.orchestrator.send(this.peerId, {
      kind: "rpc.request",
      id: "req-2",
      method: "dispatch",
      params: { task: "run" },
    });
  });
}

function orchestrator_receives_dispatch_response(this: Context) {
  expect(this.orchestratorToRunnerResult).toEqual({ ok: true, task: { task: "run" } });
}

function orchestrator_stream_handler_registered(this: Context) {
  this.connectedPeer.subscribe(
    (payload) => payload.kind === "rpc.request" && payload.id === "stream-1",
    (payload) => {
      if (payload.kind !== "rpc.request") {
        return;
      }
      this.connectedPeer.send({
        kind: "rpc.stream",
        id: payload.id,
        seq: 0,
        event: "data",
        data: "a",
      });
      this.connectedPeer.send({
        kind: "rpc.stream",
        id: payload.id,
        seq: 1,
        event: "data",
        data: "b",
      });
      this.connectedPeer.send({ kind: "rpc.stream", id: payload.id, seq: 2, event: "end" });
    },
  );
}

async function runner_requests_stream_and_waits(this: Context) {
  await new Promise<void>((resolve) => {
    this.runner.subscribe(
      (payload) => payload.kind === "rpc.stream" && payload.id === "stream-1",
      (payload) => {
        if (payload.kind !== "rpc.stream") {
          return;
        }
        if (payload.event === "data") {
          this.streamChunks.push(payload.data);
        }
        if (payload.event === "end") {
          resolve();
        }
      },
    );

    this.runner.send({
      kind: "rpc.request",
      id: "stream-1",
      method: "stream",
      params: {},
    });
  });
}

function runner_collects_stream_chunks(this: Context) {
  expect(this.streamChunks).toEqual(["a", "b"]);
}

function disconnect_handler_registered(this: Context) {
  this.orchestrator.onPeerDisconnect((peer) => {
    this.disconnectPeerId = peer.peerId;
  });
}

async function runner_closes_connection(this: Context) {
  this.runner.close();
  await delay(50);
}

function disconnect_callback_fires(this: Context) {
  expect(this.disconnectPeerId).toBe(this.peerId);
}

function tamper_subscriber_registered(this: Context) {
  this.connectedPeer.subscribe(
    () => true,
    () => {
      this.tamperedReceived = true;
    },
  );
}

async function sending_tampered_frame(this: Context) {
  const envelope = signPayload({ kind: "heartbeat", runnerId: "evil" }, this.runnerIdentity);
  envelope.payload = { kind: "heartbeat", runnerId: "tampered" };

  const { host, port } = this.orchestrator.address;
  const socket = new WebSocket(`ws://${host}:${port}`);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  socket.send(encodeEnvelope(envelope));
  socket.close();
  await delay(50);
}

function tampered_frame_not_delivered(this: Context) {
  expect(this.tamperedReceived).toBe(false);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
