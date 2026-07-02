import type { WebSocket } from "ws";

import { decodeEnvelope, encodeEnvelope, isFramePayload } from "./frames.js";
import { signPayload, verifyEnvelope } from "./sign.js";
import type { ConnectedPeer, FramePayload, PeerIdentity } from "./types.js";
import type { KeyObject } from "node:crypto";

type Subscriber = {
  filter: (payload: FramePayload) => boolean;
  callback: (payload: FramePayload) => void;
};

export type ProtocolConnectionOptions = {
  identity: PeerIdentity;
  trustedPublicKeys: ReadonlyMap<string, KeyObject>;
  onClose?: () => void;
};

export type ProtocolConnection = {
  subscribe(
    filter: (payload: FramePayload) => boolean,
    callback: (payload: FramePayload) => void,
  ): () => void;
  send(payload: FramePayload): void;
  close(): void;
};

export function createProtocolConnection(
  socket: WebSocket,
  options: ProtocolConnectionOptions,
): ProtocolConnection {
  const subscribers = new Set<Subscriber>();
  let closed = false;

  const handleMessage = (data: Buffer | ArrayBuffer | Buffer[]) => {
    if (closed) {
      return;
    }

    const raw = Buffer.isBuffer(data)
      ? data.toString("utf8")
      : Buffer.from(data as ArrayBuffer).toString("utf8");
    const envelope = decodeEnvelope(raw);
    if (envelope === null) {
      return;
    }

    if (!verifyEnvelope(envelope, options.trustedPublicKeys)) {
      return;
    }

    if (!isFramePayload(envelope.payload)) {
      return;
    }

    const payload = envelope.payload;
    for (const subscriber of subscribers) {
      if (subscriber.filter(payload)) {
        subscriber.callback(payload);
      }
    }
  };

  const handleClose = () => {
    if (closed) {
      return;
    }
    closed = true;
    socket.removeListener("message", handleMessage);
    socket.removeListener("close", handleClose);
    subscribers.clear();
    options.onClose?.();
  };

  socket.on("message", handleMessage);
  socket.on("close", handleClose);
  socket.on("error", () => {
    handleClose();
  });

  return {
    subscribe(filter, callback) {
      const subscriber: Subscriber = { filter, callback };
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
    send(payload) {
      if (closed || socket.readyState !== socket.OPEN) {
        return;
      }
      const envelope = signPayload(payload, options.identity);
      socket.send(encodeEnvelope(envelope));
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      socket.close();
      handleClose();
    },
  };
}

export function toConnectedPeer(peerId: string, connection: ProtocolConnection): ConnectedPeer {
  return {
    peerId,
    subscribe: connection.subscribe.bind(connection),
    send: connection.send.bind(connection),
    close: connection.close.bind(connection),
  };
}
