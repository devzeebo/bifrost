import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";
import { WebSocket } from "ws";

import type { OpenWorkItem, UiAction } from "@bifrost-ai/ui-events";

import { UiEventBus } from "./ui-event-bus.js";
import { startUiServer, type UiServerHandle } from "./ui-server.js";

type Context = {
  bus: UiEventBus;
  server: UiServerHandle;
  received: UiAction[];
  socket: WebSocket;
  loadCalls: number;
};

describe("startUiServer", () => {
  test("hydrates on connect then broadcasts upserts", {
    given: {
      a_ui_server_with_existing_item,
    },
    when: {
      client_connects_and_item_is_upserted,
    },
    then: {
      client_received_hydrate_then_upsert,
    },
  });

  test("backfills from loadVisibleItems on connect", {
    given: {
      a_ui_server_with_backfill,
    },
    when: {
      client_connects_for_backfill,
    },
    then: {
      client_received_backfilled_hydrate,
    },
  });
});

async function a_ui_server_with_existing_item(this: Context) {
  this.bus = new UiEventBus();
  this.bus.upsert({
    workItemId: "existing",
    kind: "task",
    name: "already-open",
    status: "live",
  });
  this.server = await startUiServer(this.bus, { port: 0, host: "127.0.0.1" });
  this.received = [];
}

async function client_connects_and_item_is_upserted(this: Context) {
  const port = this.server.port;
  await new Promise<void>((resolve, reject) => {
    this.socket = new WebSocket(`ws://127.0.0.1:${port}`);
    this.socket.on("message", (data) => {
      const text = Buffer.isBuffer(data)
        ? data.toString("utf8")
        : typeof data === "string"
          ? data
          : Buffer.from(data as ArrayBuffer).toString("utf8");
      this.received.push(JSON.parse(text) as UiAction);
      if (this.received.length === 1) {
        this.bus.upsert({
          workItemId: "new",
          kind: "workflow",
          name: "flow",
          status: "draft",
        });
      }
      if (this.received.length >= 2) {
        resolve();
      }
    });
    this.socket.on("error", reject);
  });
  this.socket.close();
  this.server.close();
}

function client_received_hydrate_then_upsert(this: Context) {
  expect(this.received[0]?.type).toBe("workItems/hydrated");
  expect(this.received[0]).toMatchObject({
    payload: {
      items: [{ workItemId: "existing", name: "already-open" }],
    },
  });
  expect(this.received[1]).toMatchObject({
    type: "workItems/upserted",
    payload: { workItemId: "new", kind: "workflow" },
  });
}

async function a_ui_server_with_backfill(this: Context) {
  this.bus = new UiEventBus();
  this.loadCalls = 0;
  const backfill: OpenWorkItem[] = [
    {
      workItemId: "bf-7c45",
      kind: "workflow",
      name: "bdd-flow",
      status: "live",
    },
    {
      workItemId: "bf-7c45.42",
      kind: "task",
      name: "ensure-story-complete",
      status: "failed",
      parentWorkItemId: "bf-7c45",
    },
  ];
  this.server = await startUiServer(this.bus, {
    port: 0,
    host: "127.0.0.1",
    loadVisibleItems: async () => {
      this.loadCalls += 1;
      return backfill;
    },
  });
  this.received = [];
}

async function client_connects_for_backfill(this: Context) {
  const port = this.server.port;
  await new Promise<void>((resolve, reject) => {
    this.socket = new WebSocket(`ws://127.0.0.1:${port}`);
    this.socket.on("message", (data) => {
      const text = Buffer.isBuffer(data)
        ? data.toString("utf8")
        : typeof data === "string"
          ? data
          : Buffer.from(data as ArrayBuffer).toString("utf8");
      this.received.push(JSON.parse(text) as UiAction);
      resolve();
    });
    this.socket.on("error", reject);
  });
  this.socket.close();
  this.server.close();
}

function client_received_backfilled_hydrate(this: Context) {
  expect(this.loadCalls).toBe(1);
  expect(this.received[0]).toMatchObject({
    type: "workItems/hydrated",
    payload: {
      items: [
        { workItemId: "bf-7c45", status: "live" },
        { workItemId: "bf-7c45.42", status: "failed", parentWorkItemId: "bf-7c45" },
      ],
    },
  });
  expect(this.bus.snapshot()).toHaveLength(2);
}
