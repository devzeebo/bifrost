import type { ConnectedPeer, FramePayload } from "@bifrost-ai/protocol";

type PeerState = {
  peer: ConnectedPeer;
  runnerId: string | null;
  lastSeen: number;
  inFlight: number;
};

type PeerWaiter = {
  tryResolve: () => void;
  reject: (error: Error) => void;
};

export class PeerRegistry {
  private readonly peers = new Map<string, PeerState>();
  private readonly heartbeatTimeoutMs: number;
  private readonly maxInFlightPerPeer: number;
  private readonly waiters: PeerWaiter[] = [];

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

  getAvailablePeer(): ConnectedPeer | undefined {
    const now = Date.now();
    for (const state of this.peers.values()) {
      if (!this.isAvailable(state, now)) {
        continue;
      }
      return state.peer;
    }
    return undefined;
  }

  waitForAvailablePeer(abortSignal?: AbortSignal): Promise<ConnectedPeer> {
    const available = this.getAvailablePeer();
    if (available !== undefined) {
      return Promise.resolve(available);
    }
    if (abortSignal?.aborted === true) {
      return Promise.reject(new Error("Orchestrator aborted"));
    }

    return new Promise((resolve, reject) => {
      const tryResolve = () => {
        const peer = this.getAvailablePeer();
        if (peer !== undefined) {
          removeWaiter();
          resolve(peer);
        }
      };

      const onAbort = () => {
        removeWaiter();
        reject(new Error("Orchestrator aborted"));
      };

      const removeWaiter = () => {
        const index = this.waiters.findIndex((waiter) => waiter.tryResolve === tryResolve);
        if (index >= 0) {
          this.waiters.splice(index, 1);
        }
        abortSignal?.removeEventListener("abort", onAbort);
      };

      if (abortSignal !== undefined) {
        abortSignal.addEventListener("abort", onAbort, { once: true });
      }

      this.waiters.push({ tryResolve, reject });
      tryResolve();
    });
  }

  cancelWaiters(): void {
    for (const waiter of this.waiters.splice(0)) {
      waiter.reject(new Error("Orchestrator closed"));
    }
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
      waiter.tryResolve();
    }
  }
}
