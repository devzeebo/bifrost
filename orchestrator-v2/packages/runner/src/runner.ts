import type { ScriptTaskDefinition } from "@bifrost-ai/interfaces-task";
import { createRunnerPeer, type RunnerPeer } from "@bifrost-ai/protocol";

import { resolveRunnerOptions } from "./config-loader.js";
import { registerDispatchHandler } from "./dispatch-handler.js";
import { startHeartbeat, type HeartbeatHandle } from "./heartbeat.js";
import { createRpcClient } from "./rpc-client.js";
import { Registry } from "./registry.js";
import type { RunnerOptions } from "./types.js";

export class Runner {
  private readonly options: RunnerOptions;
  private readonly registries = new Map<string, Registry<ScriptTaskDefinition>>();
  private peer: RunnerPeer | null = null;
  private heartbeat: HeartbeatHandle | null = null;
  private unsubscribeDispatch: (() => void) | null = null;
  private started = false;

  constructor(options: RunnerOptions = {}) {
    this.options = options;
  }

  registerAgent(agentType: string, handler: ScriptTaskDefinition): void {
    this.ensureRegistry(agentType).register(handler.name, handler);
  }

  getAgent(agentType: string, name: string): ScriptTaskDefinition | undefined {
    return this.registries.get(agentType)?.get(name);
  }

  getRegistry(agentType: string): Registry<ScriptTaskDefinition> | undefined {
    return this.registries.get(agentType);
  }

  hasAgent(agentType: string, name: string): boolean {
    return this.registries.get(agentType)?.has(name) ?? false;
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
    this.unsubscribeDispatch = registerDispatchHandler(peer, this.registries, rpc);
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

  private ensureRegistry(agentType: string): Registry<ScriptTaskDefinition> {
    let registry = this.registries.get(agentType);
    if (registry === undefined) {
      registry = new Registry<ScriptTaskDefinition>();
      this.registries.set(agentType, registry);
    }
    return registry;
  }
}
