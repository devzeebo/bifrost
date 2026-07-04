import type { MutableDataRegistry } from "@bifrost-ai/interfaces-work";
import type { PeerIdentity } from "@bifrost-ai/protocol";
import type { KeyObject } from "node:crypto";

export type OrchestratorPublicKeyConfig = {
  keyId: string;
  publicKeyPem?: string;
  publicKeyPath?: string;
};

export type IdentityConfig = {
  keyId: string;
  privateKeyPem?: string;
  privateKeyPath?: string;
  publicKeyPem?: string;
  publicKeyPath?: string;
};

export type RunnerConfig = {
  orchestrator: {
    url: string;
    keyId: string;
    publicKeyPem: string;
  };
  identity: {
    keyId: string;
    privateKeyPem: string;
    publicKeyPem: string;
  };
  heartbeatIntervalMs: number;
};

export type RunnerOptions<TData extends Record<string, unknown> = Record<string, unknown>> = {
  configPath?: string;
  data?: MutableDataRegistry<TData>;
  identity?: PeerIdentity;
  url?: string;
  orchestratorPublicKey?: OrchestratorPublicKeyConfig;
  heartbeatIntervalMs?: number;
  abortSignal?: AbortSignal;
};

export type ResolvedRunnerOptions = {
  identity: PeerIdentity;
  url: string;
  trustedPublicKeys: ReadonlyMap<string, KeyObject>;
  heartbeatIntervalMs: number;
  abortSignal?: AbortSignal;
};

export const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;

export const DEFAULT_CONFIG_FILENAMES = ["runner.yaml", ".bifrost-runner.yaml"] as const;
