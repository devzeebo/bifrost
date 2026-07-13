import type { DataRegistry, DecoratorFn, ScriptFn } from "@bifrost-ai/interfaces-work";
import { createRunnerPeer, type RunnerPeer } from "@bifrost-ai/protocol";

import { resolveRunnerOptions } from "./config-loader.js";
import {
  COMPLETE_ON_SUCCESS_DECORATOR,
  completeOnSuccess,
} from "./conventions/complete-on-success.js";
import { FAIL_ON_ERROR_DECORATOR, failOnError } from "./conventions/fail-on-error.js";
import { registerDispatchHandler } from "./dispatch-handler.js";
import { startHeartbeat, type HeartbeatHandle } from "./heartbeat.js";
import { createRpcClient } from "./rpc-client.js";
import { createDataRegistry } from "./data-registry.js";
import { Registry } from "./registry.js";
import type { RunnerOptions } from "./types.js";

const DEFAULT_CONVENTIONS = [FAIL_ON_ERROR_DECORATOR, COMPLETE_ON_SUCCESS_DECORATOR] as const;

export class Runner<TData extends Record<string, unknown> = Record<string, unknown>> {
  private readonly options: RunnerOptions<TData>;
  readonly data: DataRegistry<TData>;
  private readonly scripts = new Registry<ScriptFn<TData>>();
  private readonly decorators = new Registry<DecoratorFn<TData>>();
  private conventions: string[] = [...DEFAULT_CONVENTIONS];
  private peer: RunnerPeer | null = null;
  private heartbeat: HeartbeatHandle | null = null;
  private unsubscribeDispatch: (() => void) | null = null;
  private started = false;

  constructor(options: RunnerOptions<TData> = {}) {
    this.options = options;
    this.data = options.data ?? (createDataRegistry() as DataRegistry<TData>);
    this.registerDecorator(FAIL_ON_ERROR_DECORATOR, failOnError as DecoratorFn<TData>);
    this.registerDecorator(COMPLETE_ON_SUCCESS_DECORATOR, completeOnSuccess as DecoratorFn<TData>);
  }

  registerScript(kind: string, fn: ScriptFn<TData>): void {
    this.scripts.register(kind, fn);
  }

  registerDecorator(name: string, fn: DecoratorFn<TData>): void {
    this.decorators.register(name, fn);
  }

  addConvention(name: string): void {
    if (!this.decorators.has(name)) {
      throw new Error(`Unknown decorator: ${name}`);
    }
    if (!this.conventions.includes(name)) {
      this.conventions.push(name);
    }
  }

  hasScript(kind: string): boolean {
    return this.scripts.has(kind);
  }

  hasDecorator(name: string): boolean {
    return this.decorators.has(name);
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
    this.unsubscribeDispatch = registerDispatchHandler(peer, {
      scripts: this.scripts,
      decorators: this.decorators,
      conventions: this.conventions,
      data: this.data,
      rpc,
    });
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
