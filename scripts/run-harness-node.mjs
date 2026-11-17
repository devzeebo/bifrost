#!/usr/bin/env node
/**
 * Smoke-test a harness node against a running bifrost-server compose stack.
 * Defaults to passthrough harness mode (BIFROST_HARNESS_MODE=passthrough in compose)
 * so nothing outside the stack is required.
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
const COMPOSE_DIR = path.dirname(COMPOSE_ENV);
const DEFAULT_WORKSPACES_ROOT = path.join(ROOT, ".bifrost-workspaces");

const requireFromOrchestrator = createRequire(
  pathToFileURL(path.join(ROOT, "web/orchestrator/package.json")).href,
);
const { config: loadDotenv } = requireFromOrchestrator("dotenv");

function resolveWorkspacePath(pathValue) {
  return path.isAbsolute(pathValue)
    ? pathValue
    : path.resolve(COMPOSE_DIR, pathValue);
}

async function ensureWorkspacesEnv() {
  loadDotenv({ path: COMPOSE_ENV, quiet: true });
  const configured =
    process.env.BIFROST_WORKSPACES_HOST_PATH?.trim() || DEFAULT_WORKSPACES_ROOT;
  const pathValue = resolveWorkspacePath(configured);
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
  lines.push(`BIFROST_WORKSPACES_HOST_PATH=${pathValue}`);
  await fs.writeFile(COMPOSE_ENV, `${lines.join("\n")}\n`, "utf8");
  process.env.BIFROST_WORKSPACES_HOST_PATH = pathValue;
  console.log(`BIFROST_WORKSPACES_HOST_PATH=${pathValue}`);
  return pathValue;
}

function envConfig() {
  const configured =
    process.env.BIFROST_WORKSPACES_HOST_PATH?.trim() || DEFAULT_WORKSPACES_ROOT;
  return {
    workItemsUrl: process.env.WORK_ITEMS_URL?.trim() || "http://localhost:8080",
    orchestratorUrl:
      process.env.ORCHESTRATOR_URL?.trim() || "http://localhost:8081",
    timeoutSecs: Number(process.env.TIMEOUT_SECS?.trim() || "60") || 60,
    workspacesRoot: resolveWorkspacePath(configured),
  };
}

async function httpJson(method, url, body, signal) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
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

async function findOutputs(workspacesRoot, workItemId) {
  let entries;
  try {
    entries = await fs.readdir(workspacesRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dir = path.join(workspacesRoot, entry.name);
    const runSpecPath = path.join(dir, "run-spec.json");
    try {
      const spec = JSON.parse(await fs.readFile(runSpecPath, "utf8"));
      if (String(spec.workItemId) !== String(workItemId)) {
        continue;
      }
    } catch {
      continue;
    }

    const outputsPath = path.join(dir, "outputs.json");
    try {
      await fs.stat(outputsPath);
      return { outputsPath, dir: entry.name };
    } catch {
      return null;
    }
  }

  return null;
}

async function main() {
  await ensureWorkspacesEnv();
  const cfg = envConfig();
  const workItemId = randomUUID();

  console.log(`work item: ${workItemId}`);
  console.log(`workspaces:${cfg.workspacesRoot}`);
  console.log(`work-items:${cfg.workItemsUrl}`);
  console.log(`orchestrator:${cfg.orchestratorUrl}`);
  console.log("style:     harness (passthrough unless BIFROST_HARNESS_MODE=agent)");

  const deadline = Date.now() + cfg.timeoutSecs * 1000;

  requireOk(
    "create-work-item",
    await httpJson(
      "POST",
      `${cfg.workItemsUrl}/create-work-item`,
      {
        id: workItemId,
        actor: "smoke",
        reason: "run-harness-node smoke",
        status: "pending",
        data: {
          node: {
            style: "harness",
            spec: {},
            outputs: [
              {
                id: randomUUID(),
                name: "result",
                schema: { type: "object" },
              },
            ],
          },
          inputs: { prompt: "harness smoke", outVar: 1 },
        },
      },
      AbortSignal.timeout(Math.max(1, deadline - Date.now())),
    ),
  );

  requireOk(
    "create-tracked-work-item",
    await httpJson(
      "POST",
      `${cfg.orchestratorUrl}/create-tracked-work-item`,
      {
        id: workItemId,
        actor: "smoke",
        reason: "accept",
      },
      AbortSignal.timeout(Math.max(1, deadline - Date.now())),
    ),
  );

  let lastStatus = "";

  while (Date.now() < deadline) {
    let tracked;
    try {
      tracked = await httpJson(
        "QUERY",
        `${cfg.orchestratorUrl}/get-tracked-work-item/${workItemId}`,
        {},
        AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      );
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        break;
      }
      throw error;
    }
    if (tracked.status !== 200) {
      console.error(
        `get-tracked-work-item HTTP ${tracked.status}: ${tracked.text}`,
      );
      await delay(1000);
      continue;
    }
    lastStatus = String(pick(tracked.body, "status", "Status") || "");
    console.log(`status: ${lastStatus}`);

    if (lastStatus === "succeeded") {
      console.log("tracked item succeeded");
      const found = await findOutputs(cfg.workspacesRoot, workItemId);
      if (found) {
        console.log(`outputs: ${found.outputsPath}`);
        console.log(await fs.readFile(found.outputsPath, "utf8"));
        const stdout = path.join(
          cfg.workspacesRoot,
          found.dir,
          "stdout.log",
        );
        try {
          console.log(`stdout.log:\n${await fs.readFile(stdout, "utf8")}`);
        } catch {
          // optional
        }
      } else {
        console.error(`warning: no outputs.json under ${cfg.workspacesRoot}`);
      }
      return;
    }

    if (lastStatus === "failed" || lastStatus === "canceled") {
      console.error(`tracked item ${lastStatus}`);
      process.exitCode = 1;
      return;
    }

    await delay(1000);
  }

  console.error(
    `timed out after ${cfg.timeoutSecs}s (last status: ${lastStatus || "unknown"})`,
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
