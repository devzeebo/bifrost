import { describe, expect, it } from "vite-plus/test";
import type { ToolCallEvent } from "@earendil-works/pi-coding-agent";

import { evaluateToolPermission, normalizePathSubject } from "./permission-extension.js";
import type { ToolPermissionRule } from "./tool-permissions.js";

const CWD = "/home/devzeebo/git/orchestrator-kata/kata";

const rules = (entries: ToolPermissionRule[]): ToolPermissionRule[] => entries;

const readEvent = (path: string): ToolCallEvent =>
  ({
    type: "tool_call",
    toolCallId: "1",
    toolName: "read",
    input: { path },
  }) as ToolCallEvent;

const writeEvent = (path: string): ToolCallEvent =>
  ({
    type: "tool_call",
    toolCallId: "2",
    toolName: "write",
    input: { path, content: "x" },
  }) as ToolCallEvent;

const bashEvent = (command: string): ToolCallEvent =>
  ({
    type: "tool_call",
    toolCallId: "3",
    toolName: "bash",
    input: { command },
  }) as ToolCallEvent;

const findEvent = (input: Record<string, unknown>): ToolCallEvent =>
  ({
    type: "tool_call",
    toolCallId: "4",
    toolName: "find",
    input,
  }) as ToolCallEvent;

const grepEvent = (input: Record<string, unknown>): ToolCallEvent =>
  ({
    type: "tool_call",
    toolCallId: "5",
    toolName: "grep",
    input,
  }) as ToolCallEvent;

const workspaceRules = rules([
  {
    piName: "find",
    bifrostName: "Glob",
    allowPatterns: ["./**"],
    denyPatterns: [],
  },
  {
    piName: "grep",
    bifrostName: "Grep",
    allowPatterns: ["./**"],
    denyPatterns: [],
  },
  {
    piName: "read",
    bifrostName: "Read",
    allowPatterns: ["./**"],
    denyPatterns: [],
  },
  {
    piName: "write",
    bifrostName: "Write",
    allowPatterns: ["*.spec.ts"],
    denyPatterns: [],
  },
]);

describe("normalizePathSubject", () => {
  it("maps cwd and relative paths to ./ form", () => {
    expect(normalizePathSubject(".", CWD)).toBe("./");
    expect(normalizePathSubject("package.json", CWD)).toBe("./package.json");
    expect(normalizePathSubject(CWD, CWD)).toBe("./");
    expect(normalizePathSubject(`${CWD}/src/a.ts`, CWD)).toBe("./src/a.ts");
  });

  it("keeps paths outside cwd absolute", () => {
    expect(normalizePathSubject("/tmp/secret", CWD)).toBe("/tmp/secret");
  });
});

describe("evaluateToolPermission", () => {
  it("blocks tools that are not in the rules map", () => {
    const result = evaluateToolPermission(rules([]), readEvent("src/a.ts"), CWD);

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("not permitted"),
    });
  });

  it("allows unrestricted tools with no path patterns", () => {
    const result = evaluateToolPermission(
      rules([{ piName: "read", bifrostName: "Read", allowPatterns: [], denyPatterns: [] }]),
      readEvent("src/a.ts"),
      CWD,
    );

    expect(result).toBeUndefined();
  });

  it("blocks paths that match deny patterns", () => {
    const result = evaluateToolPermission(
      rules([
        {
          piName: "write",
          bifrostName: "Write",
          allowPatterns: ["/src/**"],
          denyPatterns: ["/src/package.json"],
        },
      ]),
      writeEvent("/src/package.json"),
      CWD,
    );

    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("denied by pattern");
  });

  it("blocks paths outside the allow list", () => {
    const result = evaluateToolPermission(
      rules([
        {
          piName: "write",
          bifrostName: "Write",
          allowPatterns: ["*.spec.ts"],
          denyPatterns: [],
        },
      ]),
      writeEvent("src/app.ts"),
      CWD,
    );

    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("not allowed");
  });

  it("allows paths that match the allow list", () => {
    const result = evaluateToolPermission(
      rules([
        {
          piName: "write",
          bifrostName: "Write",
          allowPatterns: ["**/*.spec.ts"],
          denyPatterns: [],
        },
      ]),
      writeEvent("src/app.spec.ts"),
      CWD,
    );

    expect(result).toBeUndefined();
  });

  it("enforces bash command allowlists", () => {
    const bashRules = rules([
      {
        piName: "bash",
        bifrostName: "Shell",
        allowPatterns: ["ls", "git *"],
        denyPatterns: [],
      },
    ]);

    expect(evaluateToolPermission(bashRules, bashEvent("ls -la"), CWD)).toBeUndefined();
    expect(evaluateToolPermission(bashRules, bashEvent("git status"), CWD)).toBeUndefined();
    expect(evaluateToolPermission(bashRules, bashEvent("rm -rf /"), CWD)?.block).toBe(true);
  });

  it("deny overrides allow for the same subject", () => {
    const result = evaluateToolPermission(
      rules([
        {
          piName: "write",
          bifrostName: "Write",
          allowPatterns: ["/src/**"],
          denyPatterns: ["/src/secrets.ts"],
        },
      ]),
      writeEvent("/src/secrets.ts"),
      CWD,
    );

    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("denied");
  });

  it("allows find/grep under ./** using search root, not pattern", () => {
    expect(
      evaluateToolPermission(workspaceRules, findEvent({ pattern: "**/*" }), CWD),
    ).toBeUndefined();
    expect(
      evaluateToolPermission(workspaceRules, findEvent({ pattern: "*", path: CWD }), CWD),
    ).toBeUndefined();
    expect(
      evaluateToolPermission(workspaceRules, grepEvent({ pattern: "." }), CWD),
    ).toBeUndefined();
    expect(
      evaluateToolPermission(workspaceRules, grepEvent({ pattern: "export", path: "src" }), CWD),
    ).toBeUndefined();
  });

  it("blocks find/grep when search root is outside cwd", () => {
    const result = evaluateToolPermission(
      workspaceRules,
      findEvent({ pattern: "*", path: "/tmp" }),
      CWD,
    );

    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("not allowed");
  });

  it("allows Read(./**) for relative and absolute cwd paths", () => {
    expect(evaluateToolPermission(workspaceRules, readEvent("package.json"), CWD)).toBeUndefined();
    expect(
      evaluateToolPermission(workspaceRules, readEvent(`${CWD}/package.json`), CWD),
    ).toBeUndefined();
  });

  it("allows Write(*.spec.ts) for nested relative paths", () => {
    expect(
      evaluateToolPermission(workspaceRules, writeEvent("src/calendar.spec.ts"), CWD),
    ).toBeUndefined();
  });

  it("allows custom toolkit tools matched by mcp__…__* wildcards", () => {
    const mcpRules = rules([
      {
        piName: "mcp__devzeebo_node__*",
        bifrostName: "mcp__devzeebo_node__*",
        allowPatterns: [],
        denyPatterns: [],
      },
    ]);

    const event = {
      type: "tool_call",
      toolCallId: "6",
      toolName: "mcp__devzeebo_node__install_package",
      input: { package_name: "vitest", dev: true },
    } as ToolCallEvent;

    expect(evaluateToolPermission(mcpRules, event, CWD)).toBeUndefined();
  });
});
