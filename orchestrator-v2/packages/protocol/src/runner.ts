import WebSocket from "ws";

import { createProtocolConnection } from "./connection.js";
import type { CreateRunnerPeerOptions, RunnerPeer } from "./types.js";

export function createRunnerPeer(options: CreateRunnerPeerOptions): Promise<RunnerPeer> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(options.url);

    const fail = (error: Error) => {
      socket.removeAllListeners();
      reject(error);
    };

    socket.once("error", fail);

    socket.once("open", () => {
      socket.removeListener("error", fail);
      socket.on("error", () => {
        connection.close();
      });

      const connection = createProtocolConnection(socket, {
        identity: options.identity,
        trustedPublicKeys: options.trustedPublicKeys,
      });

      resolve({
        subscribe: connection.subscribe.bind(connection),
        send: connection.send.bind(connection),
        close: connection.close.bind(connection),
      });
    });
  });
}
