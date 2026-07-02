import { loadKeyPair, loadTrustedPublicKey } from "@bifrost-ai/protocol";
import { parse } from "yaml";
import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

import {
  DEFAULT_CONFIG_FILENAMES,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  type IdentityConfig,
  type OrchestratorPublicKeyConfig,
  type ResolvedRunnerOptions,
  type RunnerConfig,
  type RunnerOptions,
} from "./types.js";

type RawRunnerConfig = {
  orchestrator?: {
    url?: unknown;
    keyId?: unknown;
    publicKeyPem?: unknown;
    publicKeyPath?: unknown;
  };
  identity?: {
    keyId?: unknown;
    privateKeyPem?: unknown;
    privateKeyPath?: unknown;
    publicKeyPem?: unknown;
    publicKeyPath?: unknown;
  };
  heartbeatIntervalMs?: unknown;
};

export async function discoverConfigPath(explicitPath?: string): Promise<string | null> {
  if (explicitPath !== undefined) {
    return resolve(explicitPath);
  }

  const envPath = process.env.RUNNER_CONFIG;
  if (envPath !== undefined && envPath.length > 0) {
    return resolve(envPath);
  }

  for (const filename of DEFAULT_CONFIG_FILENAMES) {
    const candidate = join(process.cwd(), filename);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }

  return null;
}

export async function loadRunnerConfig(configPath: string): Promise<RunnerConfig> {
  const absolutePath = resolve(configPath);
  const content = await readFile(absolutePath, "utf-8");
  const parsed = parse(content) as RawRunnerConfig;
  const baseDir = dirname(absolutePath);

  const orchestratorUrl = readRequiredString(parsed.orchestrator?.url, "orchestrator.url");
  const orchestratorKeyId = readRequiredString(parsed.orchestrator?.keyId, "orchestrator.keyId");
  const orchestratorPublicKeyPem = await readPem({
    label: "orchestrator public key",
    inlinePem: readOptionalString(parsed.orchestrator?.publicKeyPem),
    path: readOptionalString(parsed.orchestrator?.publicKeyPath),
    baseDir,
  });

  const identityKeyId = readRequiredString(parsed.identity?.keyId, "identity.keyId");
  const privateKeyPem = await readPem({
    label: "identity private key",
    inlinePem: readOptionalString(parsed.identity?.privateKeyPem),
    path: readOptionalString(parsed.identity?.privateKeyPath),
    baseDir,
  });
  const publicKeyPem = await readPem({
    label: "identity public key",
    inlinePem: readOptionalString(parsed.identity?.publicKeyPem),
    path: readOptionalString(parsed.identity?.publicKeyPath),
    baseDir,
  });

  const heartbeatIntervalMs = readHeartbeatInterval(parsed.heartbeatIntervalMs);

  return {
    orchestrator: {
      url: orchestratorUrl,
      keyId: orchestratorKeyId,
      publicKeyPem: orchestratorPublicKeyPem,
    },
    identity: {
      keyId: identityKeyId,
      privateKeyPem,
      publicKeyPem,
    },
    heartbeatIntervalMs,
  };
}

export async function resolveRunnerOptions(options: RunnerOptions): Promise<ResolvedRunnerOptions> {
  const configPath = await discoverConfigPath(options.configPath);
  const fileConfig = configPath === null ? null : await loadRunnerConfig(configPath);

  const identity = resolveIdentity(options, fileConfig);
  const url = options.url ?? fileConfig?.orchestrator.url;
  if (url === undefined || url.length === 0) {
    throw new Error("Runner url is required (orchestrator.url in config or url option)");
  }

  const orchestratorKey = resolveOrchestratorPublicKey(options, fileConfig);
  const trustedPublicKeys = loadTrustedPublicKey(orchestratorKey);

  return {
    identity,
    url,
    trustedPublicKeys,
    heartbeatIntervalMs:
      options.heartbeatIntervalMs ??
      fileConfig?.heartbeatIntervalMs ??
      DEFAULT_HEARTBEAT_INTERVAL_MS,
    abortSignal: options.abortSignal,
  };
}

function resolveIdentity(
  options: RunnerOptions,
  fileConfig: RunnerConfig | null,
): ReturnType<typeof loadKeyPair> {
  if (options.identity !== undefined) {
    return options.identity;
  }

  if (fileConfig === null) {
    throw new Error("Runner identity is required (identity in config or identity option)");
  }

  return loadKeyPair({
    keyId: fileConfig.identity.keyId,
    privateKeyPem: fileConfig.identity.privateKeyPem,
    publicKeyPem: fileConfig.identity.publicKeyPem,
  });
}

function resolveOrchestratorPublicKey(
  options: RunnerOptions,
  fileConfig: RunnerConfig | null,
): { keyId: string; publicKeyPem: string } {
  if (options.orchestratorPublicKey !== undefined) {
    const { keyId, publicKeyPem, publicKeyPath } = options.orchestratorPublicKey;
    if (publicKeyPem !== undefined) {
      return { keyId, publicKeyPem };
    }
    if (publicKeyPath !== undefined) {
      throw new Error(
        "orchestratorPublicKey.publicKeyPath requires loading from config file; use publicKeyPem for programmatic overrides",
      );
    }
    throw new Error("orchestratorPublicKey.publicKeyPem is required");
  }

  if (fileConfig === null) {
    throw new Error(
      "Orchestrator public key is required (orchestrator in config or orchestratorPublicKey option)",
    );
  }

  return {
    keyId: fileConfig.orchestrator.keyId,
    publicKeyPem: fileConfig.orchestrator.publicKeyPem,
  };
}

async function readPem(options: {
  label: string;
  inlinePem?: string;
  path?: string;
  baseDir: string;
}): Promise<string> {
  if (options.inlinePem !== undefined) {
    return options.inlinePem;
  }
  if (options.path !== undefined) {
    const pemPath = isAbsolute(options.path) ? options.path : join(options.baseDir, options.path);
    return readFile(pemPath, "utf-8");
  }
  throw new Error(`${options.label} is required (inline PEM or path in config)`);
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid runner config: ${label} is required`);
  }
  return value;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  return value;
}

function readHeartbeatInterval(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_HEARTBEAT_INTERVAL_MS;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid runner config: heartbeatIntervalMs must be a positive number");
  }
  return value;
}

export type { IdentityConfig, OrchestratorPublicKeyConfig };
