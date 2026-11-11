#!/usr/bin/env node
/**
 * Smoke-test a script node against a running bifrost-server compose stack.
 * Loads bifrost-server/.env (via dotenv from web/orchestrator), creates a work
 * item with data.node, tracks it, and polls until succeed/fail.
 */
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const COMPOSE_ENV = path.join(ROOT, "bifrost-server", ".env");
const DEFAULT_WORKSPACES_ROOT = path.join(ROOT, ".bifrost-workspaces");
const DEFAULT_BODY = "export const handler = () => ({ outVar: 2 + 2 });";

const requireFromOrchestrator = createRequire(
  pathToFileURL(path.join(ROOT, "web/orchestrator/package.json")).href,
);
const { config: loadDotenv } = requireFromOrchestrator("dotenv");

function usage() {
  const name = path.basename(fileURLToPath(import.meta.url));
  console.log(`Usage: ${name} [--body-file PATH] [--workflow-id GUID]

Loads values from bifrost-server/.env (shell env wins over .env).

Environment (after .env):
  WORK_ITEMS_URL
  ORCHESTRATOR_URL
  WORKFLOWS_URL
  TIMEOUT_SECS
  BIFROST_WORKSPACES_HOST_PATH

Examples:
  ${name}
  ${name} --body-file ./my-handler.mjs
  ${name} --workflow-id 293c56ab-f5cc-410d-a289-e455af0de080`);
}

function parseArgs(argv) {
  let bodyFile = "";
  let workflowId = "";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }
    if (arg === "--body-file") {
      bodyFile = argv[++i];
      if (!bodyFile) {
        throw new Error("--body-file requires a path");
      }
      continue;
    }
    if (arg === "--workflow-id") {
      workflowId = argv[++i];
      if (!workflowId) {
        throw new Error("--workflow-id requires a GUID");
      }
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { bodyFile, workflowId };
}

async function ensureWorkspacesEnv() {
  loadDotenv({ path: COMPOSE_ENV, quiet: true });

  const pathValue =
    process.env.BIFROST_WORKSPACES_HOST_PATH?.trim() || DEFAULT_WORKSPACES_ROOT;

  await fs.mkdir(pathValue, { recursive: true });

  let existing = "";
  try {
    existing = await fs.readFile(COMPOSE_ENV, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }

  const lines = existing
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.length > 0 && !line.startsWith("BIFROST_WORKSPACES_HOST_PATH="),
    );
  const alreadySet = existing
    .split(/\r?\n/)
    .some((line) => line.startsWith("BIFROST_WORKSPACES_HOST_PATH="));
  lines.push(`BIFROST_WORKSPACES_HOST_PATH=${pathValue}`);
  await fs.writeFile(COMPOSE_ENV, `${lines.join("\n")}\n`, "utf8");

  // Keep process.env aligned; do not override unrelated shell exports on reload.
  loadDotenv({ path: COMPOSE_ENV, override: false, quiet: true });
  process.env.BIFROST_WORKSPACES_HOST_PATH = pathValue;

  if (!alreadySet) {
    console.log(`wrote ${COMPOSE_ENV}`);
  }
  console.log(`BIFROST_WORKSPACES_HOST_PATH=${pathValue}`);
  return pathValue;
}

function envConfig() {
  return {
    workItemsUrl: process.env.WORK_ITEMS_URL?.trim() || "http://localhost:8080",
    orchestratorUrl:
      process.env.ORCHESTRATOR_URL?.trim() || "http://localhost:8081",
    workflowsUrl: process.env.WORKFLOWS_URL?.trim() || "http://localhost:8083",
    timeoutSecs: Number(process.env.TIMEOUT_SECS?.trim() || "60") || 60,
    workspacesRoot:
      process.env.BIFROST_WORKSPACES_HOST_PATH?.trim() ||
      DEFAULT_WORKSPACES_ROOT,
  };
}

async function httpJson(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: response.status, body: json, text };
}

function requireOk(label, result, expect = 204) {
  if (result.status !== expect) {
    const detail =
      typeof result.body === "string"
        ? result.body
        : JSON.stringify(result.body);
    throw new Error(`${label} failed (HTTP ${result.status}): ${detail || ""}`);
  }
}

function pick(obj, ...keys) {
  for (const key of keys) {
    if (
      obj &&
      Object.prototype.hasOwnProperty.call(obj, key) &&
      obj[key] != null
    ) {
      return obj[key];
    }
  }
  return undefined;
}

async function resolveBodyAndImage({ bodyFile, workflowId, workflowsUrl }) {
  if (bodyFile) {
    const absolute = path.isAbsolute(bodyFile)
      ? bodyFile
      : path.resolve(process.cwd(), bodyFile);
    const body = await fs.readFile(absolute, "utf8");
    return { body, image: "bifrost/node" };
  }

  if (workflowId) {
    const result = await httpJson(
      "QUERY",
      `${workflowsUrl}/get-workflow/${workflowId}`,
      {},
    );
    if (result.status !== 200) {
      throw new Error(
        `failed to load workflow ${workflowId} (HTTP ${result.status}): ${result.text}`,
      );
    }
    const wf = result.body;
    const nodes = pick(wf, "nodes", "Nodes") || [];
    for (const node of nodes) {
      const definition = pick(node, "definition", "Definition") || {};
      const style = String(
        pick(definition, "style", "Style") || "",
      ).toLowerCase();
      if (style !== "script") {
        continue;
      }
      const spec = pick(definition, "spec", "Spec") || {};
      const body = pick(spec, "body", "Body");
      const image = pick(spec, "image", "Image") || "bifrost/node";
      if (!body || !String(body).trim()) {
        throw new Error("script node has empty body");
      }
      console.log(
        `using script body from workflow ${workflowId} (image=${image})`,
      );
      return { body: String(body), image: String(image) };
    }
    throw new Error(`workflow ${workflowId} has no script node`);
  }

  return { body: DEFAULT_BODY, image: "bifrost/node" };
}

async function findOutputs(workspacesRoot, sinceMs) {
  let entries;
  try {
    entries = await fs.readdir(workspacesRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const outputsPath = path.join(workspacesRoot, entry.name, "outputs.json");
    try {
      const stat = await fs.stat(outputsPath);
      candidates.push({ mtime: stat.mtimeMs, outputsPath });
    } catch {
      // missing
    }
  }

  const recent = candidates.filter((c) => c.mtime + 1 >= sinceMs);
  const pool = recent.length > 0 ? recent : candidates;
  if (pool.length === 0) {
    return null;
  }
  pool.sort((a, b) => b.mtime - a.mtime);
  return pool[0].outputsPath;
}

async function printDiagnostics(orchestratorUrl, workItemId, status) {
  console.error(`\n--- diagnostics (status=${status}) ---`);
  console.error("Hints:");
  console.error("  - worker-node container is up");
  console.error("  - worker-bus has /run/bifrost/bus.sock");
  console.error(
    "  - bifrost-server/.env sets absolute BIFROST_WORKSPACES_HOST_PATH",
  );
  console.error(
    "  - bifrost/node image exists (docker images | grep bifrost/node)",
  );

  console.error("\nworker nodes:");
  const workers = await httpJson(
    "QUERY",
    `${orchestratorUrl}/list-worker-nodes`,
    {},
  );
  if (workers.status === 200) {
    console.error(JSON.stringify(workers.body, null, 2));
  } else {
    console.error(`(list-worker-nodes HTTP ${workers.status})`);
  }

  console.error("\nruns for work item:");
  const runs = await httpJson(
    "QUERY",
    `${orchestratorUrl}/list-runs-for-work-item`,
    {
      workItemId,
    },
  );
  if (runs.status !== 200) {
    console.error(`(list-runs-for-work-item HTTP ${runs.status})`);
    return;
  }
  console.error(JSON.stringify(runs.body, null, 2));
  const items = pick(runs.body, "items", "Items") || [];
  for (const item of items) {
    const runId = pick(item, "id", "Id");
    if (!runId) {
      continue;
    }
    console.error(`\nrun ${runId}:`);
    const run = await httpJson(
      "QUERY",
      `${orchestratorUrl}/get-run/${runId}`,
      {},
    );
    if (run.status === 200) {
      console.error(JSON.stringify(run.body, null, 2));
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureWorkspacesEnv();
  const cfg = envConfig();

  const { body, image } = await resolveBodyAndImage({
    bodyFile: args.bodyFile,
    workflowId: args.workflowId,
    workflowsUrl: cfg.workflowsUrl,
  });
  if (!body.trim()) {
    throw new Error("script body is empty");
  }

  const workItemId = randomUUID();
  const startedMs = Date.now();

  console.log(`work item: ${workItemId}`);
  console.log(`image:     ${image}`);
  console.log(`workspaces:${cfg.workspacesRoot}`);
  console.log(`work-items:${cfg.workItemsUrl}`);
  console.log(`orchestrator:${cfg.orchestratorUrl}`);

  requireOk(
    "create-work-item",
    await httpJson("POST", `${cfg.workItemsUrl}/create-work-item`, {
      id: workItemId,
      actor: "smoke",
      reason: "run-script-node smoke",
      status: "pending",
      data: {
        node: {
          style: "script",
          spec: { image, body },
        },
      },
    }),
  );

  requireOk(
    "create-tracked-work-item",
    await httpJson("POST", `${cfg.orchestratorUrl}/create-tracked-work-item`, {
      id: workItemId,
      actor: "smoke",
      reason: "accept",
    }),
  );

  const deadline = Date.now() + cfg.timeoutSecs * 1000;
  let lastStatus = "";
  let lastBody = null;

  while (Date.now() < deadline) {
    const tracked = await httpJson(
      "QUERY",
      `${cfg.orchestratorUrl}/get-tracked-work-item/${workItemId}`,
      {},
    );
    if (tracked.status !== 200) {
      console.error(
        `get-tracked-work-item HTTP ${tracked.status}: ${tracked.text}`,
      );
      await delay(1000);
      continue;
    }
    lastBody = tracked.body;
    lastStatus = String(pick(tracked.body, "status", "Status") || "");
    console.log(`status: ${lastStatus}`);

    if (lastStatus === "succeeded") {
      console.log("tracked item succeeded");
      const outputs = await findOutputs(cfg.workspacesRoot, startedMs);
      if (outputs) {
        console.log(`outputs: ${outputs}`);
        console.log(await fs.readFile(outputs, "utf8"));
      } else {
        console.error(`warning: no outputs.json under ${cfg.workspacesRoot}`);
      }
      return;
    }

    if (lastStatus === "failed" || lastStatus === "canceled") {
      console.error(`tracked item ${lastStatus}`);
      await printDiagnostics(cfg.orchestratorUrl, workItemId, lastStatus);
      process.exitCode = 1;
      return;
    }

    await delay(1000);
  }

  console.error(
    `timed out after ${cfg.timeoutSecs}s (last status: ${lastStatus || "unknown"})`,
  );
  if (lastBody) {
    console.error("last tracked item:", JSON.stringify(lastBody));
  }
  await printDiagnostics(
    cfg.orchestratorUrl,
    workItemId,
    lastStatus || "timeout",
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
