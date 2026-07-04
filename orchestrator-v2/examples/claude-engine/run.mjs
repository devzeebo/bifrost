// A real Orchestrator v2 deployment, end to end:
//   - ed25519 keys generated in-process
//   - a real runner.yaml written and loaded via `new Runner({ configPath })`
//   - a Task Agent (agent-3-task) enrolled on the runner
//   - a REAL engine backed by the `claude` CLI: its JSON output maps straight to
//     EngineResult, so real token/cost/turn telemetry flows to the task source.
//
// Prereqs: `vp install && vp run -r build` (the packages are imported from dist),
// and the `claude` CLI on PATH. Run: `node run.mjs` (makes 2 small haiku calls).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runOrchestrator, loadAuthorizedRunners } from "@bifrost-ai/orchestrator";
import { generateKeyPair, exportPublicKeyPem, exportPrivateKeyPem } from "@bifrost-ai/protocol";
import { Runner, createDataRegistry } from "@bifrost-ai/runner";
import { enrollTaskAgent, taskAgentDataGuards } from "@bifrost-ai/agent-3-task";

const execFileAsync = promisify(execFile);
const log = (...a) => console.log(...a);

// ── The reusable bit: an Engine backed by the `claude` CLI ──────────────────
// An Engine is just `{ execute(context, sessionId?) => Promise<EngineResult> }`.
const claudeEngine = {
  async execute(ctx, sessionId) {
    const args = ["-p", ctx.instructions, "--output-format", "json", "--model", "haiku"];
    if (sessionId !== undefined) args.push("--resume", sessionId);
    try {
      const { stdout } = await execFileAsync("claude", args, {
        cwd: ctx.workingDir,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 90_000,
      });
      const r = JSON.parse(stdout);
      return {
        success: !r.is_error,
        skipFulfill: false,
        lastMessage: r.result ?? null,
        sessionId: r.session_id,
        stats: {
          durationMs: r.duration_ms ?? 0,
          inputTokens: r.usage?.input_tokens ?? 0,
          outputTokens: r.usage?.output_tokens ?? 0,
          cacheReadTokens: r.usage?.cache_read_input_tokens ?? 0,
          cacheCreationTokens: r.usage?.cache_creation_input_tokens ?? 0,
          totalCostUsd: r.total_cost_usd ?? 0,
          numTurns: r.num_turns ?? 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        skipFulfill: false,
        lastMessage: String(error?.message ?? error),
        stats: null,
      };
    }
  },
};

// ── A minimal in-memory TaskSource that records telemetry ───────────────────
const fmt = (t) =>
  t
    ? `{in:${t.inputTokens}, out:${t.outputTokens}, turns:${t.numTurns}, $${t.totalCostUsd.toFixed(4)}}`
    : "none";
const workDir = await mkdtemp(join(tmpdir(), "claude-engine-example-"));
const tasks = [
  {
    taskId: "t1",
    agentType: "task",
    agentName: "assistant",
    metadata: {},
    taskState: {
      workingDir: workDir,
      engineName: "claude",
      instructions: "Reply with exactly one word, no punctuation: HELLO",
    },
  },
  {
    taskId: "t2",
    agentType: "task",
    agentName: "assistant",
    metadata: {},
    taskState: {
      workingDir: workDir,
      engineName: "claude",
      instructions: "In one short sentence, describe what a task orchestrator does.",
    },
  },
];
const source = {
  async *watchTasks() {
    for (const t of tasks) yield t;
  },
  async completeTask(taskId, telemetry) {
    log(`  ✓ ${taskId} completed  telemetry=${fmt(telemetry)}`);
  },
  async failTask(taskId, error) {
    log(`  ✗ ${taskId} failed: ${error}`);
  },
  async pauseTask() {},
  async setState() {},
};

// ── Wire it up ──────────────────────────────────────────────────────────────
const orchestratorIdentity = generateKeyPair("orchestrator");
const runnerIdentity = generateKeyPair("runner-1");

const handle = await runOrchestrator({
  identity: orchestratorIdentity,
  authorizedRunners: loadAuthorizedRunners([
    { keyId: runnerIdentity.keyId, publicKeyPem: exportPublicKeyPem(runnerIdentity.publicKey) },
  ]),
  taskSource: source,
  scheduler: {
    async call() {
      return { ok: true };
    },
  },
  port: 0,
});
const { host, port } = handle.peer.address;
log(`orchestrator listening on ws://${host}:${port}`);

// Write a real runner.yaml and load the runner's keys/URL from it.
const indentPem = (pem) =>
  pem
    .trimEnd()
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n");
const cfgDir = await mkdtemp(join(tmpdir(), "claude-engine-cfg-"));
const configPath = join(cfgDir, "runner.yaml");
await writeFile(
  configPath,
  [
    "orchestrator:",
    `  url: ws://${host}:${port}`,
    `  keyId: ${orchestratorIdentity.keyId}`,
    "  publicKeyPem: |",
    indentPem(exportPublicKeyPem(orchestratorIdentity.publicKey)),
    "identity:",
    `  keyId: ${runnerIdentity.keyId}`,
    "  privateKeyPem: |",
    indentPem(exportPrivateKeyPem(runnerIdentity.privateKey)),
    "  publicKeyPem: |",
    indentPem(exportPublicKeyPem(runnerIdentity.publicKey)),
  ].join("\n"),
  "utf-8",
);

const data = createDataRegistry(taskAgentDataGuards);
data.get("engine").register("claude", claudeEngine);
const runner = new Runner({ data, configPath });
enrollTaskAgent(runner, {
  name: "assistant",
  description: "Answers small prompts via the Claude engine",
  tools: [],
  template: { parameters: {} },
  promptBody: "",
});
await runner.start();

await handle.done;
runner.close();
handle.peer.close();
log("done.");
process.exit(0);
