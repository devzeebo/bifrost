import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { WorkItemHandler } from "@bifrost-ai/interfaces-work";
import type { PeerIdentity } from "@bifrost-ai/protocol";
import { describe, expect } from "vite-plus/test";
import test, { withAspect } from "vitest-gwt";
import { exportPrivateKeyPem, exportPublicKeyPem, generateKeyPair } from "@bifrost-ai/protocol";
import {
  authorizedRunnersFor,
  createIdentities,
  createMemoryWorkItemSource,
  delay,
  startOrchestratorInBackground,
  waitFor,
} from "@bifrost-ai/orchestrator/test-helpers";
import type { MemoryWorkItemSource } from "@bifrost-ai/orchestrator/test-helpers";

import { Runner } from "./runner.js";

type Context = {
  orchestratorIdentity: PeerIdentity;
  runnerIdentity: PeerIdentity;
  unauthorizedRunnerIdentity: PeerIdentity;
  workItemSource: MemoryWorkItemSource;
  configPath: string;
  runner: Runner;
  abort: () => void;
  done: Promise<void>;
  orchestratorAddress: { host: string; port: number };
  duplicateError: Error | null;
};

const echoHandler: WorkItemHandler = {
  kind: "script",
  name: "echo",
  async run(workItem, ctx) {
    const message = workItem.metadata.message as string;
    await ctx.setState({ echoed: message });
    return { outcome: "completed" };
  },
};

const failHandler: WorkItemHandler = {
  kind: "script",
  name: "fail",
  async run() {
    throw new Error("boom");
  },
};

const pauseHandler: WorkItemHandler = {
  kind: "script",
  name: "pause",
  async run() {
    return { outcome: "paused" };
  },
};

describe("runner", () => {
  withAspect(setup_identities, teardown_runner);

  test("completes dispatched work item via config-driven runner", {
    given: {
      work_item_source_with_echo,
      orchestrator_running,
      runner_config_written,
      runner_with_echo_registered,
    },
    when: {
      runner_started,
      waiting_for_completion,
    },
    then: {
      work_item_is_completed,
      state_was_persisted,
    },
  });

  test("fails when handler throws", {
    given: {
      work_item_source_with_fail,
      orchestrator_running,
      runner_config_written,
      runner_with_fail_registered,
    },
    when: {
      runner_started,
      waiting_for_failure,
    },
    then: {
      work_item_is_failed,
    },
  });

  test("pauses when handler returns paused", {
    given: {
      work_item_source_with_pause,
      orchestrator_running,
      runner_config_written,
      runner_with_pause_registered,
    },
    when: {
      runner_started,
      waiting_for_pause,
    },
    then: {
      work_item_is_paused,
    },
  });

  test("registerWorkItemHandler throws on duplicate name within a kind", {
    given: {
      empty_runner,
    },
    when: {
      registering_duplicate_handler,
    },
    then: {
      duplicate_error_thrown,
    },
  });

  test("handler enrollment via registerWorkItemHandler", {
    given: {
      work_item_source_with_echo,
      orchestrator_running,
      runner_config_written,
      runner_with_plugin_enrollment,
    },
    when: {
      runner_started,
      waiting_for_completion,
    },
    then: {
      work_item_is_completed,
    },
  });
});

function setup_identities(this: Context) {
  const identities = createIdentities();
  this.orchestratorIdentity = identities.orchestratorIdentity;
  this.runnerIdentity = identities.runnerIdentity;
  this.unauthorizedRunnerIdentity = generateKeyPair("unauthorized");
}

async function teardown_runner(this: Context) {
  this.runner?.close();
  this.abort?.();
  await this.done?.catch(() => undefined);
}

function work_item_source_with_echo(this: Context) {
  this.workItemSource = createMemoryWorkItemSource([
    {
      workItemId: "work-item-1",
      kind: "script",
      name: "echo",
      state: {},
      metadata: { message: "hello" },
    },
  ]);
}

function work_item_source_with_fail(this: Context) {
  this.workItemSource = createMemoryWorkItemSource([
    {
      workItemId: "work-item-fail",
      kind: "script",
      name: "fail",
      state: {},
      metadata: {},
    },
  ]);
}

function work_item_source_with_pause(this: Context) {
  this.workItemSource = createMemoryWorkItemSource([
    {
      workItemId: "work-item-pause",
      kind: "script",
      name: "pause",
      state: {},
      metadata: {},
    },
  ]);
}

async function orchestrator_running(this: Context) {
  const running = await startOrchestratorInBackground({
    orchestratorIdentity: this.orchestratorIdentity,
    authorizedRunners: authorizedRunnersFor(this.runnerIdentity),
    workItemSource: this.workItemSource,
  });
  this.abort = running.abort;
  this.done = running.done;
  this.orchestratorAddress = running.address;
}

async function runner_config_written(this: Context) {
  const configDir = await mkdtemp(join(tmpdir(), "runner-int-"));
  this.configPath = join(configDir, "runner.yaml");
  const { host, port } = this.orchestratorAddress;

  const yaml = [
    "orchestrator:",
    `  url: ws://${host}:${port}`,
    `  keyId: ${this.orchestratorIdentity.keyId}`,
    "  publicKeyPem: |",
    indentPem(exportPublicKeyPem(this.orchestratorIdentity.publicKey)),
    "identity:",
    `  keyId: ${this.runnerIdentity.keyId}`,
    "  privateKeyPem: |",
    indentPem(exportPrivateKeyPem(this.runnerIdentity.privateKey)),
    "  publicKeyPem: |",
    indentPem(exportPublicKeyPem(this.runnerIdentity.publicKey)),
  ].join("\n");

  await writeFile(this.configPath, yaml, "utf-8");
}

function runner_with_echo_registered(this: Context) {
  this.runner = new Runner({ configPath: this.configPath });
  this.runner.registerWorkItemHandler(echoHandler);
}

function runner_with_fail_registered(this: Context) {
  this.runner = new Runner({ configPath: this.configPath });
  this.runner.registerWorkItemHandler(failHandler);
}

function runner_with_pause_registered(this: Context) {
  this.runner = new Runner({ configPath: this.configPath });
  this.runner.registerWorkItemHandler(pauseHandler);
}

function empty_runner(this: Context) {
  this.runner = new Runner();
}

function runner_with_plugin_enrollment(this: Context) {
  this.runner = new Runner({ configPath: this.configPath });
  enrollEchoHandler(this.runner);
}

function enrollEchoHandler(runner: Runner): void {
  runner.registerWorkItemHandler(echoHandler);
}

async function runner_started(this: Context) {
  await this.runner.start();
  await delay(50);
}

async function registering_duplicate_handler(this: Context) {
  this.runner.registerWorkItemHandler(echoHandler);
  try {
    this.runner.registerWorkItemHandler(echoHandler);
    this.duplicateError = null;
  } catch (error) {
    this.duplicateError = error as Error;
  }
}

async function waiting_for_completion(this: Context) {
  await waitFor(() => this.workItemSource.completed.length === 1);
}

async function waiting_for_failure(this: Context) {
  await waitFor(() => this.workItemSource.failed.length === 1);
}

async function waiting_for_pause(this: Context) {
  await waitFor(() => this.workItemSource.paused.length === 1);
}

function work_item_is_completed(this: Context) {
  expect(this.workItemSource.completed.length).toBe(1);
}

function state_was_persisted(this: Context) {
  expect(this.workItemSource.states.get("work-item-1")).toEqual({ echoed: "hello" });
}

function work_item_is_failed(this: Context) {
  expect(this.workItemSource.failed).toEqual([{ workItemId: "work-item-fail", error: "boom" }]);
}

function work_item_is_paused(this: Context) {
  expect(this.workItemSource.paused).toEqual(["work-item-pause"]);
}

function duplicate_error_thrown(this: Context) {
  expect(this.duplicateError?.message).toContain("Already registered");
}

function indentPem(pem: string): string {
  return pem
    .trimEnd()
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}
