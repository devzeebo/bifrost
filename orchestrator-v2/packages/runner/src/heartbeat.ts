import type { RunnerPeer } from "@bifrost-ai/protocol";
import type { PeerIdentity } from "@bifrost-ai/protocol";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;

export type HeartbeatHandle = {
  stop(): void;
};

export function startHeartbeat(
  peer: RunnerPeer,
  identity: PeerIdentity,
  intervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
): HeartbeatHandle {
  const send = () => {
    peer.send({ kind: "heartbeat", runnerId: identity.keyId });
  };

  send();
  const timer = setInterval(send, intervalMs);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
