import type { RunnerPeer } from "@bifrost-ai/protocol";

export type RpcClient = {
  call(method: string, params: unknown): Promise<unknown>;
};

export function createRpcClient(peer: RunnerPeer): RpcClient {
  return {
    call(method, params) {
      return callRpc(peer, method, params);
    },
  };
}

function callRpc(peer: RunnerPeer, method: string, params: unknown): Promise<unknown> {
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const unsubscribe = peer.subscribe(
      (payload) => payload.kind === "rpc.response" && payload.id === id,
      (payload) => {
        unsubscribe();
        if (payload.kind !== "rpc.response") {
          return;
        }
        if (payload.error !== undefined) {
          reject(new Error(`${payload.error.code}: ${payload.error.message}`));
          return;
        }
        resolve(payload.result);
      },
    );

    peer.send({
      kind: "rpc.request",
      id,
      method,
      params,
    });
  });
}

export function sendRpcResponse(peer: RunnerPeer, id: string, result: unknown): void {
  peer.send({
    kind: "rpc.response",
    id,
    result,
  });
}
