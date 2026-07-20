import { describe, expect, it } from "vite-plus/test";
import type { ToolCallEvent } from "@earendil-works/pi-coding-agent";

import { evaluateToolPermission } from "./permission-extension.js";
import type { ToolPermissionRule } from "./tool-permissions.js";

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

describe("evaluateToolPermission", () => {
  it("blocks tools that are not in the rules map", () => {
    const result = evaluateToolPermission(rules([]), readEvent("src/a.ts"));

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("not permitted"),
    });
  });

  it("allows unrestricted tools with no path patterns", () => {
    const result = evaluateToolPermission(
      rules([{ piName: "read", bifrostName: "Read", allowPatterns: [], denyPatterns: [] }]),
      readEvent("src/a.ts"),
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

    expect(evaluateToolPermission(bashRules, bashEvent("ls -la"))).toBeUndefined();
    expect(evaluateToolPermission(bashRules, bashEvent("git status"))).toBeUndefined();
    expect(evaluateToolPermission(bashRules, bashEvent("rm -rf /"))?.block).toBe(true);
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
    );

    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("denied");
  });
});
