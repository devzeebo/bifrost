import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";
import { exportPrivateKeyPem, exportPublicKeyPem, generateKeyPair } from "@bifrost-ai/protocol";

import { loadRunnerConfig, resolveRunnerOptions } from "./config-loader.js";

type Context = {
  configDir: string;
  configPath: string;
  orchestratorIdentity: ReturnType<typeof generateKeyPair>;
  runnerIdentity: ReturnType<typeof generateKeyPair>;
  loadedConfig: Awaited<ReturnType<typeof loadRunnerConfig>>;
  resolved: Awaited<ReturnType<typeof resolveRunnerOptions>>;
  resolveError: Error | null;
};

describe("config-loader", () => {
  test("loads inline PEM config", {
    given: {
      temp_config_with_inline_pems,
    },
    when: {
      loading_config,
    },
    then: {
      config_has_expected_values,
    },
  });

  test("resolves identity and orchestrator trust from config file", {
    given: {
      temp_config_with_inline_pems,
    },
    when: {
      resolving_options_from_config,
    },
    then: {
      resolved_options_match_config,
    },
  });

  test("explicit options override config file", {
    given: {
      temp_config_with_inline_pems,
      override_identity,
    },
    when: {
      resolving_with_override,
    },
    then: {
      override_identity_is_used,
    },
  });

  test("throws when orchestrator public key is missing", {
    given: {
      invalid_config_missing_orchestrator_key,
    },
    when: {
      loading_invalid_config,
    },
    then: {
      load_error_is_thrown,
    },
  });
});

async function temp_config_with_inline_pems(this: Context) {
  this.orchestratorIdentity = generateKeyPair("orchestrator");
  this.runnerIdentity = generateKeyPair("runner");
  this.configDir = await mkdtemp(join(tmpdir(), "runner-config-"));
  this.configPath = join(this.configDir, "runner.yaml");

  const yaml = [
    "orchestrator:",
    "  url: ws://127.0.0.1:9100",
    "  keyId: orchestrator",
    `  publicKeyPem: |`,
    indentPem(exportPublicKeyPem(this.orchestratorIdentity.publicKey)),
    "identity:",
    "  keyId: runner-1",
    `  privateKeyPem: |`,
    indentPem(exportPrivateKeyPem(this.runnerIdentity.privateKey)),
    `  publicKeyPem: |`,
    indentPem(exportPublicKeyPem(this.runnerIdentity.publicKey)),
    "heartbeatIntervalMs: 5000",
  ].join("\n");

  await writeFile(this.configPath, yaml, "utf-8");
}

function indentPem(pem: string): string {
  return pem
    .trimEnd()
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

async function loading_config(this: Context) {
  this.loadedConfig = await loadRunnerConfig(this.configPath);
}

function config_has_expected_values(this: Context) {
  expect(this.loadedConfig.orchestrator.url).toBe("ws://127.0.0.1:9100");
  expect(this.loadedConfig.orchestrator.keyId).toBe("orchestrator");
  expect(this.loadedConfig.identity.keyId).toBe("runner-1");
  expect(this.loadedConfig.heartbeatIntervalMs).toBe(5000);
}

async function resolving_options_from_config(this: Context) {
  this.resolved = await resolveRunnerOptions({ configPath: this.configPath });
}

function resolved_options_match_config(this: Context) {
  expect(this.resolved.url).toBe("ws://127.0.0.1:9100");
  expect(this.resolved.identity.keyId).toBe("runner-1");
  expect(this.resolved.heartbeatIntervalMs).toBe(5000);
  expect(this.resolved.trustedPublicKeys.has("orchestrator")).toBe(true);
}

function override_identity(this: Context) {
  this.orchestratorIdentity = generateKeyPair("override-orchestrator");
}

async function resolving_with_override(this: Context) {
  this.resolved = await resolveRunnerOptions({
    configPath: this.configPath,
    identity: this.runnerIdentity,
    url: "ws://127.0.0.1:9200",
    orchestratorPublicKey: {
      keyId: this.orchestratorIdentity.keyId,
      publicKeyPem: exportPublicKeyPem(this.orchestratorIdentity.publicKey),
    },
    heartbeatIntervalMs: 1500,
  });
}

function override_identity_is_used(this: Context) {
  expect(this.resolved.url).toBe("ws://127.0.0.1:9200");
  expect(this.resolved.identity.keyId).toBe(this.runnerIdentity.keyId);
  expect(this.resolved.heartbeatIntervalMs).toBe(1500);
  expect(this.resolved.trustedPublicKeys.has(this.orchestratorIdentity.keyId)).toBe(true);
}

async function invalid_config_missing_orchestrator_key(this: Context) {
  this.configDir = await mkdtemp(join(tmpdir(), "runner-config-"));
  this.configPath = join(this.configDir, "runner.yaml");
  await writeFile(
    this.configPath,
    [
      "orchestrator:",
      "  url: ws://127.0.0.1:9100",
      "  keyId: orchestrator",
      "identity:",
      "  keyId: runner-1",
      "  privateKeyPem: |",
      "    -----BEGIN PRIVATE KEY-----",
      "    invalid",
      "    -----END PRIVATE KEY-----",
      "  publicKeyPem: |",
      "    -----BEGIN PUBLIC KEY-----",
      "    invalid",
      "    -----END PUBLIC KEY-----",
    ].join("\n"),
    "utf-8",
  );
}

async function loading_invalid_config(this: Context) {
  this.resolveError = null;
  try {
    await loadRunnerConfig(this.configPath);
  } catch (error) {
    this.resolveError = error as Error;
  }
}

function load_error_is_thrown(this: Context) {
  expect(this.resolveError).not.toBeNull();
  expect(this.resolveError?.message).toContain("orchestrator public key");
}
