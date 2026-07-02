import { randomUUID } from "node:crypto";

import { WebSocketServer } from "ws";

import { createProtocolConnection, toConnectedPeer } from "./connection.js";
import type { ConnectedPeer, CreateOrchestratorPeerOptions, OrchestratorPeer } from "./types.js";
import type { ProtocolConnection } from "./connection.js";

export function createOrchestratorPeer(
  options: CreateOrchestratorPeerOptions,
): Promise<OrchestratorPeer> {
  return new Promise((resolve, reject) => {
    const connectCallbacks = new Set<(peer: ConnectedPeer) => void>();
    const disconnectCallbacks = new Set<(peer: ConnectedPeer) => void>();
    const peers = new Map<string, { peer: ConnectedPeer; connection: ProtocolConnection }>();
    let closed = false;

    const wss = new WebSocketServer({
      host: options.host ?? "127.0.0.1",
      port: options.port ?? 0,
    });

    wss.on("error", (error) => {
      if (!closed) {
        reject(error);
      }
    });

    wss.on("listening", () => {
      const address = wss.address();
      if (address === null || typeof address === "string") {
        reject(new Error("WebSocket server address is unavailable"));
        return;
      }

      resolve({
        address: {
          host:
            address.address === "::" || address.address === "0.0.0.0"
              ? "127.0.0.1"
              : address.address,
          port: address.port,
        },
        onPeerConnect(callback) {
          connectCallbacks.add(callback);
          for (const entry of peers.values()) {
            callback(entry.peer);
          }
          return () => {
            connectCallbacks.delete(callback);
          };
        },
        onPeerDisconnect(callback) {
          disconnectCallbacks.add(callback);
          return () => {
            disconnectCallbacks.delete(callback);
          };
        },
        send(peerId, payload) {
          const entry = peers.get(peerId);
          if (entry === undefined) {
            throw new Error(`Unknown peer id: ${peerId}`);
          }
          entry.connection.send(payload);
        },
        close() {
          if (closed) {
            return;
          }
          closed = true;
          for (const entry of peers.values()) {
            entry.connection.close();
          }
          peers.clear();
          wss.close();
        },
      });
    });

    wss.on("connection", (socket) => {
      if (closed) {
        socket.close();
        return;
      }

      const peerId = randomUUID();
      const connection = createProtocolConnection(socket, {
        identity: options.identity,
        trustedPublicKeys: options.trustedPublicKeys,
        onClose: () => {
          const entry = peers.get(peerId);
          if (entry === undefined) {
            return;
          }
          peers.delete(peerId);
          for (const callback of disconnectCallbacks) {
            callback(entry.peer);
          }
        },
      });

      const peer = toConnectedPeer(peerId, connection);
      peers.set(peerId, { peer, connection });

      for (const callback of connectCallbacks) {
        callback(peer);
      }
    });
  });
}
