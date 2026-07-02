import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ScriptTaskDefinition } from "@bifrost-ai/interfaces-task";
import type { PeerIdentity } from "@bifrost-ai/protocol";
import { describe, expect } from "vite-plus/test";
import test, { withAspect } from "vitest-gwt";
import { exportPrivateKeyPem, exportPublicKeyPem, generateKeyPair } from "@bifrost-ai/protocol";
import {
  authorizedRunnersFor,
  createIdentities,
  createMemoryTaskSource,
  delay,
  startOrchestratorInBackground,
  waitFor,
} from "@bifrost-ai/orchestrator/test-helpers";
import type { MemoryTaskSource } from "@bifrost-ai/orchestrator/test-helpers";

import { Runner } from "./runner.js";

type Context = {
  orchestratorIdentity: PeerIdentity;
  runnerIdentity: PeerIdentity;
  unauthorizedRunnerIdentity: PeerIdentity;
  taskSource: MemoryTaskSource;
  configPath: string;
  runner: Runner;
  abort: () => void;
  done: Promise<void>;
  orchestratorAddress: { host: string; port: number };
  duplicateError: Error | null;
};

const echoScript: ScriptTaskDefinition = {
  name: "echo",
  async run(ctx) {
    const message = ctx.metadata.message as string;
    await ctx.setState({ echoed: message });
    return { outcome: "completed" };
  },
};

const failScript: ScriptTaskDefinition = {
  name: "fail",
  async run() {
    throw new Error("boom");
  },
};

const pauseScript: ScriptTaskDefinition = {
  name: "pause",
  async run() {
    return { outcome: "paused" };
  },
};

describe("runner", () => {
  withAspect(setup_identities, teardown_runner);

  test("completes dispatched script via config-driven runner", {
    given: {
      task_source_with_echo_task,
      orchestrator_running,
      runner_config_written,
      runner_with_echo_registered,
    },
    when: {
      runner_started,
      waiting_for_completion,
    },
    then: {
      task_is_completed,
      state_was_persisted,
    },
  });

  test("fails when script throws", {
    given: {
      task_source_with_fail_task,
      orchestrator_running,
      runner_config_written,
      runner_with_fail_registered,
    },
    when: {
      runner_started,
      waiting_for_failure,
    },
    then: {
      task_is_failed,
    },
  });

  test("pauses when script returns paused", {
    given: {
      task_source_with_pause_task,
      orchestrator_running,
      runner_config_written,
      runner_with_pause_registered,
    },
    when: {
      runner_started,
      waiting_for_pause,
    },
    then: {
      task_is_paused,
    },
  });

  test("registerAgent throws on duplicate name within an agent registry", {
    given: {
      empty_runner,
    },
    when: {
      registering_duplicate_agent,
    },
    then: {
      duplicate_error_thrown,
    },
  });

  test("plugin enrollment via registerAgent", {
    given: {
      task_source_with_echo_task,
      orchestrator_running,
      runner_config_written,
      runner_with_plugin_enrollment,
    },
    when: {
      runner_started,
      waiting_for_completion,
    },
    then: {
      task_is_completed,
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

function task_source_with_echo_task(this: Context) {
  this.taskSource = createMemoryTaskSource([
    {
      taskId: "task-1",
      agentType: "script",
      agentName: "echo",
      taskState: {},
      metadata: { message: "hello" },
    },
  ]);
}

function task_source_with_fail_task(this: Context) {
  this.taskSource = createMemoryTaskSource([
    {
      taskId: "task-fail",
      agentType: "script",
      agentName: "fail",
      taskState: {},
      metadata: {},
    },
  ]);
}

function task_source_with_pause_task(this: Context) {
  this.taskSource = createMemoryTaskSource([
    {
      taskId: "task-pause",
      agentType: "script",
      agentName: "pause",
      taskState: {},
      metadata: {},
    },
  ]);
}

async function orchestrator_running(this: Context) {
  const running = await startOrchestratorInBackground({
    orchestratorIdentity: this.orchestratorIdentity,
    authorizedRunners: authorizedRunnersFor(this.runnerIdentity),
    taskSource: this.taskSource,
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
  this.runner.registerAgent("script", echoScript);
}

function runner_with_fail_registered(this: Context) {
  this.runner = new Runner({ configPath: this.configPath });
  this.runner.registerAgent("script", failScript);
}

function runner_with_pause_registered(this: Context) {
  this.runner = new Runner({ configPath: this.configPath });
  this.runner.registerAgent("script", pauseScript);
}

function empty_runner(this: Context) {
  this.runner = new Runner();
}

function runner_with_plugin_enrollment(this: Context) {
  this.runner = new Runner({ configPath: this.configPath });
  enrollEchoPlugin(this.runner);
}

function enrollEchoPlugin(runner: Runner): void {
  runner.registerAgent("script", echoScript);
}

async function runner_started(this: Context) {
  await this.runner.start();
  await delay(50);
}

async function registering_duplicate_agent(this: Context) {
  this.runner.registerAgent("script", echoScript);
  try {
    this.runner.registerAgent("script", echoScript);
    this.duplicateError = null;
  } catch (error) {
    this.duplicateError = error as Error;
  }
}

async function waiting_for_completion(this: Context) {
  await waitFor(() => this.taskSource.completed.length === 1);
}

async function waiting_for_failure(this: Context) {
  await waitFor(() => this.taskSource.failed.length === 1);
}

async function waiting_for_pause(this: Context) {
  await waitFor(() => this.taskSource.paused.length === 1);
}

function task_is_completed(this: Context) {
  expect(this.taskSource.completed.length).toBe(1);
}

function state_was_persisted(this: Context) {
  expect(this.taskSource.states.get("task-1")).toEqual({ echoed: "hello" });
}

function task_is_failed(this: Context) {
  expect(this.taskSource.failed).toEqual([{ taskId: "task-fail", error: "boom" }]);
}

function task_is_paused(this: Context) {
  expect(this.taskSource.paused).toEqual(["task-pause"]);
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
