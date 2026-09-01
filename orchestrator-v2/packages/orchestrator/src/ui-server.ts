import type { OpenWorkItem, UiAction } from "@bifrost-ai/ui-events";
import { WebSocketServer, type WebSocket } from "ws";

import type { UiEventBus } from "./ui-event-bus.js";

export type UiServerOptions = {
  port?: number;
  host?: string;
  /** Load visible work items from the source on each client connect. */
  loadVisibleItems?: () => Promise<OpenWorkItem[]>;
};

export type UiServerHandle = {
  port: number;
  close: () => void;
};

const DEFAULT_UI_PORT = 9101;

/**
 * Unsigned WebSocket fan-out for UI clients. On connect, optionally backfills
 * from the work item source, replaces the projection, hydrates that client,
 * then forwards live bus actions.
 */
export function startUiServer(
  bus: UiEventBus,
  options: UiServerOptions = {},
): Promise<UiServerHandle> {
  const port = options.port ?? DEFAULT_UI_PORT;
  const host = options.host ?? "127.0.0.1";
  const loadVisibleItems = options.loadVisibleItems;

  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port, host });
    const clients = new Set<WebSocket>();
    let closed = false;

    const unsubscribe = bus.subscribe((action) => {
      broadcast(clients, action);
    });

    wss.on("error", (error) => {
      if (!closed) {
        reject(error);
      }
    });

    wss.on("listening", () => {
      const address = wss.address();
      if (address === null || typeof address === "string") {
        reject(new Error("UI WebSocket server address is unavailable"));
        return;
      }

      resolve({
        port: address.port,
        close: () => {
          if (closed) {
            return;
          }
          closed = true;
          unsubscribe();
          for (const client of clients) {
            client.close();
          }
          clients.clear();
          wss.close();
        },
      });
    });

    wss.on("connection", (socket) => {
      clients.add(socket);
      void hydrateClient(socket, bus, loadVisibleItems).catch((error) => {
        console.error("Failed to hydrate UI client:", error);
        sendAction(socket, bus.hydrateAction());
      });
      socket.on("close", () => {
        clients.delete(socket);
      });
    });
  });
}

async function hydrateClient(
  socket: WebSocket,
  bus: UiEventBus,
  loadVisibleItems: (() => Promise<OpenWorkItem[]>) | undefined,
): Promise<void> {
  if (loadVisibleItems !== undefined) {
    const items = await loadVisibleItems();
    bus.replaceProjection(items);
  }
  sendAction(socket, bus.hydrateAction());
}

function broadcast(clients: Set<WebSocket>, action: UiAction): void {
  const message = JSON.stringify(action);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

function sendAction(socket: WebSocket, action: UiAction): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(action));
  }
}
