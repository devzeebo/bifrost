import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";
import { exportPrivateKeyPem, exportPublicKeyPem } from "@bifrost-ai/protocol";
import { Runner } from "@bifrost-ai/runner";
import "./augment.js";
import {
  authorizedRunnersFor,
  createGraphMemoryWorkItemSource,
  createIdentities,
  startOrchestratorInBackground,
  waitFor,
} from "@bifrost-ai/orchestrator/test-helpers";

import { continueStep } from "./step-result.js";
import { script } from "./step-refs.js";
import { Workflow } from "./workflow.js";

type Context = {
  source: ReturnType<typeof createGraphMemoryWorkItemSource>;
  runner: Runner;
  abort: () => void;
  done: Promise<void>;
  configPath: string;
};

describe("workflow agent integration", () => {
  test("linear workflow completes after children run", {
    given: { linear_integration_setup },
    when: { waiting_for_workflow_completion },
    then: { workflow_and_children_completed },
  });
});

async function linear_integration_setup(this: Context) {
  this.source = createGraphMemoryWorkItemSource([
    {
      workItemId: "workflow-1",
      kind: "workflow",
      name: "linear-flow",
      flow: [],
      state: {
        workingDir: "/tmp",
        definitionName: "linear-flow",
      },
      metadata: {},
    },
  ]);

  const { orchestratorIdentity, runnerIdentity } = createIdentities();
  const background = await startOrchestratorInBackground({
    orchestratorIdentity,
    authorizedRunners: authorizedRunnersFor(runnerIdentity),
    workItemSource: this.source,
    maxInFlightPerPeer: 4,
  });
  this.abort = background.abort;
  this.done = background.done;

  const configDir = await mkdtemp(join(tmpdir(), "workflow-runner-"));
  this.configPath = join(configDir, "runner.yaml");
  await writeFile(
    this.configPath,
    [
      "orchestrator:",
      `  url: ws://${background.address.host}:${background.address.port}`,
      `  keyId: ${orchestratorIdentity.keyId}`,
      `  publicKeyPem: |`,
      ...exportPublicKeyPem(orchestratorIdentity.publicKey)
        .split("\n")
        .map((line) => `    ${line}`),
      "identity:",
      `  keyId: ${runnerIdentity.keyId}`,
      `  privateKeyPem: |`,
      ...exportPrivateKeyPem(runnerIdentity.privateKey)
        .split("\n")
        .map((line) => `    ${line}`),
      `  publicKeyPem: |`,
      ...exportPublicKeyPem(runnerIdentity.publicKey)
        .split("\n")
        .map((line) => `    ${line}`),
      "heartbeatIntervalMs: 1000",
    ].join("\n"),
  );

  this.runner = new Runner({ configPath: this.configPath });
  const workflow = new Workflow({ name: "linear-flow" })
    .step(script(() => continueStep(), "a"))
    .step(script(() => continueStep(), "b"))
    .step(script(() => continueStep(), "c"));
  this.runner.registerWorkflowAgent(workflow);
  await this.runner.start();
}

async function waiting_for_workflow_completion(this: Context) {
  try {
    await waitFor(() => this.source.completed.includes("workflow-1"), 10_000);
  } catch (error) {
    console.error("workflow debug", {
      completed: this.source.completed,
      failed: this.source.failed,
      paused: this.source.paused,
      startedOrder: this.source.startedOrder,
      statuses: [...this.source.statuses.entries()],
    });
    throw error;
  } finally {
    this.runner.close();
    this.source.abort();
    this.abort();
  }
}

function workflow_and_children_completed(this: Context) {
  expect(this.source.completed).toContain("workflow-1");
  const childCompleted = this.source.completed.filter((id) => id !== "workflow-1");
  expect(childCompleted).toEqual(["draft-1", "draft-2", "draft-3"]);
}
