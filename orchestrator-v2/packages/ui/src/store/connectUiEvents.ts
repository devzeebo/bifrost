import { isUiAction } from "@bifrost-ai/ui-events";

import { setConnectionStatus } from "./uiSlice.js";
import type { AppStore } from "./store.js";

const DEFAULT_WS_URL = "ws://127.0.0.1:9101";
const INITIAL_RETRY_MS = 500;
const MAX_RETRY_MS = 8_000;

export function getUiWsUrl(): string {
  return import.meta.env.VITE_UI_WS_URL ?? DEFAULT_WS_URL;
}

/**
 * Connects to the orchestrator UI WebSocket and dispatches every received
 * Redux action into the store unchanged.
 */
export function connectUiEvents(store: AppStore, url = getUiWsUrl()): () => void {
  let closed = false;
  let socket: WebSocket | null = null;
  let retryMs = INITIAL_RETRY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) {
      return;
    }
    store.dispatch(setConnectionStatus("connecting"));
    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      retryMs = INITIAL_RETRY_MS;
      store.dispatch(setConnectionStatus("connected"));
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!isUiAction(parsed)) {
        return;
      }
      store.dispatch(parsed);
    });

    socket.addEventListener("close", () => {
      store.dispatch(setConnectionStatus("disconnected"));
      scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      socket?.close();
    });
  };

  const scheduleReconnect = () => {
    if (closed) {
      return;
    }
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
    }
    retryTimer = setTimeout(() => {
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      connect();
    }, retryMs);
  };

  connect();

  return () => {
    closed = true;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
    }
    socket?.close();
  };
}
