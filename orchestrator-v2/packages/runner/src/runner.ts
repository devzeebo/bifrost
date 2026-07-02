import type { ScriptTaskDefinition } from "@bifrost-ai/interfaces-task";
import { createRunnerPeer, type RunnerPeer } from "@bifrost-ai/protocol";

import { resolveRunnerOptions } from "./config-loader.js";
import { registerDispatchHandler } from "./dispatch-handler.js";
import { startHeartbeat, type HeartbeatHandle } from "./heartbeat.js";
import { createRpcClient } from "./rpc-client.js";
import { ScriptRegistry } from "./script-registry.js";
import type { RunnerOptions } from "./types.js";

export class Runner {
  private readonly options: RunnerOptions;
  private readonly registry = new ScriptRegistry();
  private peer: RunnerPeer | null = null;
  private heartbeat: HeartbeatHandle | null = null;
  private unsubscribeDispatch: (() => void) | null = null;
  private started = false;

  constructor(options: RunnerOptions = {}) {
    this.options = options;
  }

  registerScript(script: ScriptTaskDefinition): void {
    this.registry.register(script);
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
    this.unsubscribeDispatch = registerDispatchHandler(peer, this.registry, rpc);
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
}
