import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { load_cursor_skill } from "@devzeebo/agent";
import skill from "./SKILL.md" with { type: "text" };

import {
  type AgentContext,
  type TrajectoryToolCall,
  a_workspace,
  agent,
  copy_to_workspace,
  executing_the_agent,
  the_prompt,
} from "agent-gwt";
import { describe, expect } from "vite-plus/test";
import test, { withAspect, withTestOptions } from "vitest-gwt";

const execFileAsync = promisify(execFile);

const AGENT_OUTPUT_FILES = ["src/types.ts", "src/store/create.spec.ts"] as const;
const VITEST_GWT_VERSION = "^4.1.4";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

type Context = AgentContext & {
  workspaceFilesBefore: Map<string, string>;
};

describe("create (RED)", () => {
  withAspect(agent({ name: "cursor", image: "cursor:node26", model: "auto" }));
  withAspect(a_workspace);

  withTestOptions((opts) => {
    opts.timeout = 10 * 60 * 1000;
  });

  test("writes create.spec.ts from requirements", {
    given: {
      red_fixture_is_copied,
      vitest_gwt_is_removed_from_package_json,
      agent_has_no_shell_and_cannot_write_package_json,
      skill_is_installed,
      dependencies_are_installed,
      workspace_is_snapshotted,
      the_prompt: the_prompt("write tests for create as described in PROMPT.md"),
    },
    scenario: [
      {
        when: {
          executing_the_agent,
        },
        then: {
          only_agent_output_files_were_modified,
          create_spec_imports_vitest_gwt,
          create_spec_context_is_below_tests,
          create_spec_with_aspect_uses_hoisted_refs,
          agent_should_NOT_attempted_to_write_package_json,
        },
      },
      {
        then_when: {
          vitest_gwt_is_installed,
          verification_files_are_copied,
        },
        then: {
          workspace_builds_with_tsc,
          workspace_tests_pass,
        },
      },
    ],
  });
});

async function red_fixture_is_copied(this: Context): Promise<void> {
  await copy_to_workspace(
    this.workspace,
    [
      "fixtures/create-red/package.json",
      "fixtures/create-red/tsconfig.json",
      "fixtures/create-red/vitest.config.ts",
      "fixtures/create-red/PROMPT.md",
      "fixtures/create-red/src/**/*.ts",
    ],
    { base: "fixtures/create-red" },
  );
}

async function vitest_gwt_is_removed_from_package_json(this: Context): Promise<void> {
  const pkg = await readPackageJson(this.workspace);
  delete pkg.dependencies?.["vitest-gwt"];
  delete pkg.devDependencies?.["vitest-gwt"];
  await writePackageJson(this.workspace, pkg);
}

async function agent_has_no_shell_and_cannot_write_package_json(this: Context) {
  await mkdir(join(this.workspace, ".cursor"));
  await writeFile(
    join(this.workspace, ".cursor/cli.json"),
    JSON.stringify({
      permissions: {
        deny: ["Shell(*)", "Write(package.json)"],
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

async function create_spec_imports_vitest_gwt(this: Context): Promise<void> {
  const spec = await readFile(join(this.workspace, "src/store/create.spec.ts"), "utf8");
  expect(spec, "create.spec.ts must import from vitest-gwt").toMatch(/from\s+["']vitest-gwt["']/);
}

async function create_spec_context_is_below_tests(this: Context): Promise<void> {
  const spec = await readFile(join(this.workspace, "src/store/create.spec.ts"), "utf8");
  const contextMatch = /(?:type|interface)\s+Context\b/.exec(spec);
  expect(contextMatch, "create.spec.ts must declare a Context type").toBeTruthy();

  let lastTestIndex = -1;
  for (const match of spec.matchAll(/\btest\s*\(/g)) {
    lastTestIndex = match.index ?? lastTestIndex;
  }
  expect(
    lastTestIndex,
    "create.spec.ts must contain at least one test(...)",
  ).toBeGreaterThanOrEqual(0);

  expect(contextMatch!.index, "Context must be declared below the tests").toBeGreaterThan(
    lastTestIndex,
  );
}

async function create_spec_with_aspect_uses_hoisted_refs(this: Context): Promise<void> {
  const spec = await readFile(join(this.workspace, "src/store/create.spec.ts"), "utf8");
  expect(spec, "create.spec.ts must use withAspect").toMatch(/\bwithAspect\s*\(/);

  expect(spec, "withAspect must not take inline function declarations").not.toMatch(
    /\bwithAspect\s*\(\s*(?:async\s+)?function\b/,
  );
  expect(spec, "withAspect must not take inline arrow functions").not.toMatch(
    /\bwithAspect\s*\(\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
  );

  for (const match of spec.matchAll(/\bwithAspect\s*\(([^;]*?)\)\s*;/gs)) {
    const argsSource = match[1] ?? "";
    const args = splitTopLevelArgs(argsSource);
    expect(args.length, "withAspect must receive at least one argument").toBeGreaterThan(0);

    for (const arg of args) {
      expect(arg, `withAspect args must be hoisted identifiers, got: ${arg}`).toMatch(
        /^[A-Za-z_$][\w$]*$/,
      );
    }
  }
}

function splitTopLevelArgs(source: string): string[] {
  const args: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of source) {
    if (char === "(" || char === "{" || char === "[") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")" || char === "}" || char === "]") {
      depth -= 1;
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      if (current.trim()) {
        args.push(current.trim());
      }
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

async function agent_should_NOT_attempted_to_write_package_json(this: Context): Promise<void> {
  const trajectory = await this.agent.trajectory();
  const attempted = trajectory.toolCalls().some(is_package_json_write_attempt);

  expect(attempted, "agent should NOT attempt to write package.json").toBe(false);
}

function is_package_json_write_attempt(call: TrajectoryToolCall): boolean {
  if (!/write/i.test(call.name)) {
    return false;
  }

  if (typeof call.args !== "object" || call.args === null || !("path" in call.args)) {
    return false;
  }

  const path = call.args.path;
  return typeof path === "string" && /(^|\/)package\.json$/.test(path);
}

async function vitest_gwt_is_installed(this: Context): Promise<void> {
  const pkg = await readPackageJson(this.workspace);
  pkg.devDependencies ??= {};
  pkg.devDependencies["vitest-gwt"] = VITEST_GWT_VERSION;
  await writePackageJson(this.workspace, pkg);
  await execFileAsync("pnpm", ["install"], { cwd: this.workspace });
}

async function verification_files_are_copied(this: Context): Promise<void> {
  await copy_to_workspace(
    this.workspace,
    ["fixtures/create-red/verify/src/types.ts", "fixtures/create-red/verify/src/store/create.ts"],
    { base: "fixtures/create-red/verify" },
  );
}

async function workspace_tests_pass(this: Context): Promise<void> {
  await execFileAsync("pnpm", ["test"], { cwd: this.workspace });
}

async function workspace_builds_with_tsc(this: Context): Promise<void> {
  await execFileAsync("npx", ["tsc", "-b"], { cwd: this.workspace });
}

async function only_agent_output_files_were_modified(this: Context): Promise<void> {
  for (const rel of AGENT_OUTPUT_FILES) {
    await stat(join(this.workspace, rel));
  }

  const after = await snapshotWorkspace(this.workspace);

  for (const [rel, hash] of this.workspaceFilesBefore) {
    expect(after.has(rel), `${rel} was deleted`).toBe(true);
    expect(after.get(rel), `${rel} was modified`).toBe(hash);
  }

  const allAfter = await walkFiles(this.workspace);
  const allowed = new Set([...this.workspaceFilesBefore.keys(), ...AGENT_OUTPUT_FILES]);

  for (const rel of allAfter) {
    expect(allowed.has(rel), `unexpected file: ${rel}`).toBe(true);
  }
}

async function readPackageJson(workspace: string): Promise<PackageJson> {
  const raw = await readFile(join(workspace, "package.json"), "utf8");
  return JSON.parse(raw) as PackageJson;
}

async function writePackageJson(workspace: string, pkg: PackageJson): Promise<void> {
  await writeFile(join(workspace, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
}

async function snapshotWorkspace(workspace: string): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();
  const excluded = new Set<string>(AGENT_OUTPUT_FILES);

  for (const rel of await walkFiles(workspace)) {
    if (excluded.has(rel)) {
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
