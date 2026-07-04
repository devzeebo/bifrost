import type { ConnectedPeer, FramePayload } from "@bifrost-ai/protocol";

type PeerState = {
  peer: ConnectedPeer;
  runnerId: string | null;
  lastSeen: number;
  inFlight: number;
  // Advertised capability keys, or null if the runner has not advertised yet
  // (treated as having no capabilities — all runners are expected to advertise).
  capabilities: Set<string> | null;
};

export class PeerRegistry {
  private readonly peers = new Map<string, PeerState>();
  private readonly heartbeatTimeoutMs: number;
  private readonly maxInFlightPerPeer: number;
  private readonly waiters: Array<() => void> = [];

  constructor(options: { heartbeatTimeoutMs: number; maxInFlightPerPeer: number }) {
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs;
    this.maxInFlightPerPeer = options.maxInFlightPerPeer;
  }

  add(peer: ConnectedPeer): void {
    this.peers.set(peer.peerId, {
      peer,
      runnerId: null,
      lastSeen: Date.now(),
      inFlight: 0,
      capabilities: null,
    });
  }

  remove(peerId: string): ConnectedPeer | undefined {
    const state = this.peers.get(peerId);
    if (state === undefined) {
      return undefined;
    }
    this.peers.delete(peerId);
    this.notifyWaiters();
    return state.peer;
  }

  recordHeartbeat(peerId: string, payload: FramePayload): void {
    if (payload.kind !== "heartbeat") {
      return;
    }
    const state = this.peers.get(peerId);
    if (state === undefined) {
      return;
    }
    state.runnerId = payload.runnerId;
    state.lastSeen = Date.now();
    if (payload.capabilities !== undefined) {
      state.capabilities = new Set(payload.capabilities);
    }
    this.notifyWaiters();
  }

  markDispatched(peerId: string): void {
    const state = this.peers.get(peerId);
    if (state === undefined) {
      return;
    }
    state.inFlight += 1;
  }

  markTerminal(peerId: string): void {
    const state = this.peers.get(peerId);
    if (state === undefined) {
      return;
    }
    state.inFlight = Math.max(0, state.inFlight - 1);
    this.notifyWaiters();
  }

  markDispatchRejected(peerId: string): void {
    this.markTerminal(peerId);
  }

  getAvailablePeer(requiredCapability?: string): ConnectedPeer | undefined {
    const now = Date.now();
    for (const state of this.peers.values()) {
      if (!this.isAvailable(state, now)) {
        continue;
      }
      if (!canHandle(state, requiredCapability)) {
        continue;
      }
      return state.peer;
    }
    return undefined;
  }

  waitForAvailablePeer(requiredCapability?: string): Promise<ConnectedPeer> {
    const available = this.getAvailablePeer(requiredCapability);
    if (available !== undefined) {
      return Promise.resolve(available);
    }
    return new Promise((resolve) => {
      const tryResolve = () => {
        const peer = this.getAvailablePeer(requiredCapability);
        if (peer !== undefined) {
          const index = this.waiters.indexOf(tryResolve);
          if (index >= 0) {
            this.waiters.splice(index, 1);
          }
          resolve(peer);
        }
      };
      this.waiters.push(tryResolve);
    });
  }

  private isAvailable(state: PeerState, now: number): boolean {
    if (state.runnerId === null) {
      return false;
    }
    if (now - state.lastSeen > this.heartbeatTimeoutMs) {
      return false;
    }
    if (state.inFlight >= this.maxInFlightPerPeer) {
      return false;
    }
    return true;
  }

  private notifyWaiters(): void {
    for (const waiter of this.waiters) {
      waiter();
    }
  }
}

function canHandle(state: PeerState, requiredCapability: string | undefined): boolean {
  if (requiredCapability === undefined) {
    return true;
  }
  // A runner that has not advertised its capabilities is treated as having none — all
  // runners are expected to advertise.
  if (state.capabilities === null) {
    return false;
  }
  return state.capabilities.has(requiredCapability);
}
