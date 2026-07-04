import type { MutableDataRegistry, ScriptTaskDefinition } from "@bifrost-ai/interfaces-task";
import { capabilityKey, createRunnerPeer, type RunnerPeer } from "@bifrost-ai/protocol";

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
  private readonly agents = new Map<string, Registry<ScriptTaskDefinition>>();
  private readonly capabilities: string[] = [];
  private peer: RunnerPeer | null = null;
  private heartbeat: HeartbeatHandle | null = null;
  private unsubscribeDispatch: (() => void) | null = null;
  private started = false;

  constructor(options: RunnerOptions<TData> = {}) {
    this.options = options;
    this.data = options.data ?? (createDataRegistry() as MutableDataRegistry<TData>);
  }

  registerAgent(agentType: string, handler: ScriptTaskDefinition): void {
    this.ensureAgentRegistry(agentType).register(handler.name, handler);
    this.capabilities.push(capabilityKey(agentType, handler.name));
  }

  getAgent(agentType: string, name: string): ScriptTaskDefinition | undefined {
    return this.agents.get(agentType)?.get(name);
  }

  hasAgent(agentType: string, name: string): boolean {
    return this.agents.get(agentType)?.has(name) ?? false;
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
      this.agents,
      asDataRegistry(this.data),
      rpc,
    );
    this.heartbeat = startHeartbeat(
      peer,
      resolved.identity,
      resolved.heartbeatIntervalMs,
      this.capabilities,
    );

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

  private ensureAgentRegistry(agentType: string): Registry<ScriptTaskDefinition> {
    let registry = this.agents.get(agentType);
    if (registry === undefined) {
      registry = new Registry<ScriptTaskDefinition>();
      this.agents.set(agentType, registry);
    }
    return registry;
  }
}
