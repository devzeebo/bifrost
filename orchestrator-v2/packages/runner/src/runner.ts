import type { MutableDataRegistry, WorkItemHandler } from "@bifrost-ai/interfaces-work";
import { createRunnerPeer, type RunnerPeer } from "@bifrost-ai/protocol";

import { resolveRunnerOptions } from "./config-loader.js";
import { asDataRegistry } from "./data-registry.js";
import { registerDispatchHandler } from "./dispatch-handler.js";
import { startHeartbeat, type HeartbeatHandle } from "./heartbeat.js";
import { createRpcClient } from "./rpc-client.js";
import { createDataRegistry } from "./data-registry.js";
import { Registry } from "./registry.js";
import type { RunnerOptions } from "./types.js";

export class Runner<TData extends Record<string, unknown> = Record<string, unknown>> {
  private readonly options: RunnerOptions<TData>;
  readonly data: MutableDataRegistry<TData>;
  private readonly handlers = new Map<string, Registry<WorkItemHandler>>();
  private peer: RunnerPeer | null = null;
  private heartbeat: HeartbeatHandle | null = null;
  private unsubscribeDispatch: (() => void) | null = null;
  private started = false;

  constructor(options: RunnerOptions<TData> = {}) {
    this.options = options;
    this.data = options.data ?? (createDataRegistry() as MutableDataRegistry<TData>);
  }

  registerWorkItemHandler(handler: WorkItemHandler): void {
    this.ensureHandlerRegistry(handler.kind).register(handler.name, handler);
  }

  getWorkItemHandler(kind: string, name: string): WorkItemHandler | undefined {
    return this.handlers.get(kind)?.get(name);
  }

  hasWorkItemHandler(kind: string, name: string): boolean {
    return this.handlers.get(kind)?.has(name) ?? false;
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error("Runner already started");
    }

    const resolved = await resolveRunnerOptions(this.options);
    const peer = await createRunnerPeer({
      identity: resolved.identity,
      trustedPublicKeys: resolved.trustedPublicKeys,
      url: resolved.url,
    });

    const rpc = createRpcClient(peer);
    this.unsubscribeDispatch = registerDispatchHandler(
      peer,
      this.handlers,
      asDataRegistry(this.data),
      rpc,
    );
    this.heartbeat = startHeartbeat(peer, resolved.identity, resolved.heartbeatIntervalMs);

    if (resolved.abortSignal !== undefined) {
      resolved.abortSignal.addEventListener("abort", () => {
        this.close();
      });
    }

    this.peer = peer;
    this.started = true;
  }

  close(): void {
    this.heartbeat?.stop();
    this.unsubscribeDispatch?.();
    this.peer?.close();
    this.heartbeat = null;
    this.unsubscribeDispatch = null;
    this.peer = null;
    this.started = false;
  }

  get connection(): RunnerPeer {
    if (this.peer === null) {
      throw new Error("Runner not started");
    }
    return this.peer;
  }

  private ensureHandlerRegistry(kind: string): Registry<WorkItemHandler> {
    let registry = this.handlers.get(kind);
    if (registry === undefined) {
      registry = new Registry<WorkItemHandler>();
      this.handlers.set(kind, registry);
    }
    return registry;
  }
}
