import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { AgentTool } from "@bifrost-ai/engine";

import { materializeCursorPolicies } from "./materialize-policies.js";
import { mapAgentToolsToCursorPolicies } from "./tool-permissions.js";

describe("mapAgentToolsToCursorPolicies", () => {
  it("should deny shell and allow MCP for bdd-red-like tools", () => {
    const tools: AgentTool[] = [
      "Read(./**)",
      "Edit(*.spec.ts)",
      "Edit(*.spec.tsx)",
      "Write(*.spec.ts)",
      "Write(*.spec.tsx)",
      "Glob(./**)",
      "Grep(./**)",
      "Search(./**)",
      "LSP",
      "mcp__context7__*",
      "mcp__devzeebo_node__*",
    ];

    const policies = mapAgentToolsToCursorPolicies(tools, { workItemId: "task-1" });

    expect(policies.shellPermitted).toBe(false);
    expect(policies.permissions.terminalAllowlist).toEqual([]);
    expect(policies.permissions.mcpAllowlist).toEqual(["context7:*", "devzeebo_node:*"]);
    expect(policies.permissions.autoRun?.block_instructions).toEqual(
      expect.arrayContaining([expect.stringContaining("shell")]),
    );
    expect(policies.cli.approvalMode).toBe("allowlist");
    expect(policies.cli.permissions.deny).toContain("Shell(*)");
    expect(policies.cli.permissions.allow).toEqual(
      expect.arrayContaining([
        "Read(./**)",
        "Write(*.spec.ts)",
        "Mcp(context7:*)",
        "Mcp(devzeebo_node:*)",
      ]),
    );
    expect(policies.cli.permissions.allow).not.toContain("Shell");
    expect(policies.sandbox).toEqual({
      type: "workspace_readwrite",
      networkPolicy: { default: "deny" },
      additionalReadwritePaths: ["/tmp/.devzeebo/task-1"],
    });
  });

  it("should expand object tool allow and deny patterns into CLI tokens", () => {
    const policies = mapAgentToolsToCursorPolicies([
      {
        name: "Write",
        allow: ["/src/**"],
        deny: ["/src/package.json"],
      },
      "Read",
    ]);

    expect(policies.cli.permissions.allow).toEqual(["Write(/src/**)", "Read"]);
    expect(policies.cli.permissions.deny).toEqual(["Write(/src/package.json)", "Shell(*)"]);
  });

  it("should populate terminalAllowlist from Shell command patterns", () => {
    const policies = mapAgentToolsToCursorPolicies(["Shell(ls)", "Shell(git status)", "Read"]);

    expect(policies.shellPermitted).toBe(true);
    expect(policies.permissions.terminalAllowlist).toEqual(["ls", "git"]);
    expect(policies.permissions.autoRun).toBeUndefined();
    expect(policies.cli.permissions.deny).not.toContain("Shell(*)");
    expect(policies.cli.permissions.allow).toEqual(
      expect.arrayContaining(["Shell(ls)", "Shell(git status)", "Read"]),
    );
  });

  it("should omit terminalAllowlist when Shell is unrestricted", () => {
    const policies = mapAgentToolsToCursorPolicies(["Shell", "Read"]);

    expect(policies.shellPermitted).toBe(true);
    expect(policies.permissions.terminalAllowlist).toBeUndefined();
    expect(policies.cli.permissions.deny).not.toContain("Shell(*)");
  });
});

describe("materializeCursorPolicies", () => {
  let workingDir: string;

  afterEach(async () => {
    if (workingDir !== undefined) {
      await rm(workingDir, { recursive: true, force: true });
    }
  });

  it("should write permissions, cli, and sandbox files under .cursor", async () => {
    workingDir = await mkdtemp(path.join(tmpdir(), "cursor-policies-"));

    const policies = await materializeCursorPolicies({
      workingDir,
      workItemId: "wi-9",
      tools: ["Read(./**)", "mcp__context7__*", "Write(*.spec.ts)"],
    });

    const permissions = JSON.parse(
      await readFile(path.join(workingDir, ".cursor", "permissions.json"), "utf8"),
    ) as unknown;
    const cli = JSON.parse(
      await readFile(path.join(workingDir, ".cursor", "cli.json"), "utf8"),
    ) as unknown;
    const sandbox = JSON.parse(
      await readFile(path.join(workingDir, ".cursor", "sandbox.json"), "utf8"),
    ) as unknown;

    expect(permissions).toEqual(policies.permissions);
    expect(cli).toEqual(policies.cli);
    expect(sandbox).toEqual(policies.sandbox);
    expect(policies.permissions.terminalAllowlist).toEqual([]);
    expect(policies.permissions.mcpAllowlist).toEqual(["context7:*"]);
  });
});
