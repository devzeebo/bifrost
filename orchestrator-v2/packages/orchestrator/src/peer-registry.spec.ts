import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";
import { capabilityKey } from "@bifrost-ai/protocol";
import type { ConnectedPeer, FramePayload } from "@bifrost-ai/protocol";

import { PeerRegistry } from "./peer-registry.js";

type Context = {
  registry: PeerRegistry;
  generic: ConnectedPeer;
  specialist: ConnectedPeer;
  bare: ConnectedPeer;
  selected: ConnectedPeer | undefined;
};

const fakePeer = (peerId: string): ConnectedPeer => ({
  peerId,
  subscribe: () => () => undefined,
  send: () => undefined,
  close: () => undefined,
});

const heartbeat = (runnerId: string, capabilities?: string[]): FramePayload => ({
  kind: "heartbeat",
  runnerId,
  ...(capabilities !== undefined ? { capabilities } : {}),
});

describe("PeerRegistry capability routing (regression: I1)", () => {
  test("routes to the peer that advertises the required capability", {
    given: { two_runners_with_different_capabilities },
    when: { selecting_a_peer_for_the_special_agent },
    then: { the_specialist_is_selected },
  });

  test("treats a runner that advertised nothing as capable of anything", {
    given: { a_runner_that_advertises_no_capabilities },
    when: { selecting_a_peer_for_the_special_agent },
    then: { the_bare_runner_is_selected },
  });
});

function two_runners_with_different_capabilities(this: Context) {
  this.registry = new PeerRegistry({ heartbeatTimeoutMs: 10_000, maxInFlightPerPeer: 1 });
  this.generic = fakePeer("generic");
  this.specialist = fakePeer("specialist");
  this.registry.add(this.generic);
  this.registry.add(this.specialist);
  // generic advertises only "done"; specialist advertises "done" AND "special".
  this.registry.recordHeartbeat(
    "generic",
    heartbeat("rGeneric", [capabilityKey("script", "done")]),
  );
  this.registry.recordHeartbeat(
    "specialist",
    heartbeat("rSpecial", [capabilityKey("script", "done"), capabilityKey("script", "special")]),
  );
}

function a_runner_that_advertises_no_capabilities(this: Context) {
  this.registry = new PeerRegistry({ heartbeatTimeoutMs: 10_000, maxInFlightPerPeer: 1 });
  this.bare = fakePeer("bare");
  this.registry.add(this.bare);
  this.registry.recordHeartbeat("bare", heartbeat("rBare")); // no capabilities field
}

function selecting_a_peer_for_the_special_agent(this: Context) {
  this.selected = this.registry.getAvailablePeer(capabilityKey("script", "special"));
}

function the_specialist_is_selected(this: Context) {
  // The generic runner is first in insertion order but lacks "special", so it is
  // skipped in favour of the capable specialist (before the fix, the generic runner
  // was chosen and the task would have failed).
  expect(this.selected).toBe(this.specialist);
}

function the_bare_runner_is_selected(this: Context) {
  expect(this.selected).toBe(this.bare);
}
