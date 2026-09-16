import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { load_cursor_skill } from "@devzeebo/agent";
import skill from "./SKILL.md" with { type: "text" };

import {
  type AgentContext,
  a_workspace,
  agent,
  cleanup_workspace,
  copy_to_workspace,
  executing_the_agent,
  the_prompt,
} from "agent-gwt";
import { describe, expect } from "vite-plus/test";
import test, { withAspect, withTestOptions } from "vitest-gwt";

const execFileAsync = promisify(execFile);
const ALLOWED_CHANGED_FILE = "src/store/create.ts";

type Context = AgentContext & {
  workspaceFilesBefore: Map<string, string>;
};

describe("create (GREEN)", () => {
  withAspect(agent({ name: "cursor", image: "cursor:node26", model: "auto" }));
  withAspect(a_workspace, cleanup_workspace);
  withAspect(a_workspace);

  withTestOptions((opts) => {
    opts.timeout = 10 * 60 * 1000;
  });

  test("implements create.ts from tests", {
    given: {
      green_fixture_is_copied,
      agent_has_no_shell,
      skill_is_installed,
      dependencies_are_installed,
      workspace_is_snapshotted,
      the_prompt: the_prompt("implement create.ts"),
    },
    when: {
      executing_the_agent,
    },
    then: {
      only_create_ts_was_modified,
      workspace_tests_pass,
      workspace_builds_with_tsc,
    },
  });
});

async function green_fixture_is_copied(this: Context): Promise<void> {
  await copy_to_workspace(
    this.workspace,
    [
      "fixtures/create-green/package.json",
      "fixtures/create-green/tsconfig.json",
      "fixtures/create-green/vitest.config.ts",
      "fixtures/create-green/src/**/*.ts",
    ],
    { base: "fixtures/create-green" },
  );
}

async function agent_has_no_shell(this: Context) {
  await mkdir(join(this.workspace, ".cursor"));
  await writeFile(
    join(this.workspace, ".cursor/cli.json"),
    JSON.stringify({
      permissions: {
        deny: ["Shell(*)"],
        allow: [],
      },
    }),
  );
}

async function skill_is_installed(this: Context) {
  await load_cursor_skill(this.workspace, skill);
}

async function dependencies_are_installed(this: Context): Promise<void> {
  await execFileAsync("pnpm", ["install"], { cwd: this.workspace });
}

async function workspace_is_snapshotted(this: Context): Promise<void> {
  this.workspaceFilesBefore = await snapshotWorkspace(this.workspace);
}

async function workspace_tests_pass(this: Context): Promise<void> {
  await execFileAsync("pnpm", ["test"], { cwd: this.workspace });
}

async function workspace_builds_with_tsc(this: Context): Promise<void> {
  await execFileAsync("npx", ["tsc", "-b"], { cwd: this.workspace });
}

async function only_create_ts_was_modified(this: Context): Promise<void> {
  await stat(join(this.workspace, ALLOWED_CHANGED_FILE));

  const after = await snapshotWorkspace(this.workspace);

  for (const [rel, hash] of this.workspaceFilesBefore) {
    expect(after.has(rel), `${rel} was deleted`).toBe(true);
    expect(after.get(rel), `${rel} was modified`).toBe(hash);
  }

  const allAfter = await walkFiles(this.workspace);
  const allowed = new Set([...this.workspaceFilesBefore.keys(), ALLOWED_CHANGED_FILE]);

  for (const rel of allAfter) {
    expect(allowed.has(rel), `unexpected file: ${rel}`).toBe(true);
  }
}

async function snapshotWorkspace(workspace: string): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();

  for (const rel of await walkFiles(workspace)) {
    if (rel === ALLOWED_CHANGED_FILE) {
      continue;
    }

    snapshot.set(rel, await hashFile(join(workspace, rel)));
  }

  return snapshot;
}

async function hashFile(path: string): Promise<string> {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex");
}

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === "node_modules") {
        continue;
      }

      const absolute = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }

      if (entry.isFile()) {
        files.push(relative(root, absolute));
      }
    }
  }

  await walk(root);
  return files.sort();
}
