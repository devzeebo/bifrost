import { describe, expect, it } from "vite-plus/test";
import type { AgentTool } from "@bifrost-ai/engine";

import { mapAgentToolsToPiPermissions } from "./tool-permissions.js";

describe("mapAgentToolsToPiPermissions", () => {
  it("maps Bifrost tool names to Pi allowlist and extracts path patterns", () => {
    const tools: AgentTool[] = [
      "Read(./**)",
      "Edit(*.spec.ts)",
      "Write(*.spec.ts)",
      "mcp__context7__*",
      "mcp__devzeebo_node__install",
    ];

    const permissions = mapAgentToolsToPiPermissions(tools);

    expect(permissions.hasTools).toBe(true);
    expect(permissions.allowedToolNames).toEqual(
      expect.arrayContaining([
        "read",
        "edit",
        "write",
        "mcp__context7__*",
        "mcp__devzeebo_node__install",
      ]),
    );
    expect(permissions.allowedToolNames).not.toContain("bash");
    expect(permissions.toolkitNames).toEqual(expect.arrayContaining(["context7", "devzeebo_node"]));

    const readRule = permissions.rules.find((rule) => rule.piName === "read");
    expect(readRule?.allowPatterns).toEqual(["./**"]);
    expect(readRule?.denyPatterns).toEqual([]);
  });

  it("expands object tool allow and deny patterns", () => {
    const permissions = mapAgentToolsToPiPermissions([
      {
        name: "Write",
        allow: ["/src/**"],
        deny: ["/src/package.json"],
      },
      "Read",
    ]);

    expect(permissions.allowedToolNames).toEqual(["write", "read"]);
    const writeRule = permissions.rules.find((rule) => rule.piName === "write");
    expect(writeRule?.allowPatterns).toEqual(["/src/**"]);
    expect(writeRule?.denyPatterns).toEqual(["/src/package.json"]);
  });

  it("maps Shell patterns onto bash rules", () => {
    const permissions = mapAgentToolsToPiPermissions(["Shell(ls)", "Shell(git status)", "Read"]);

    expect(permissions.allowedToolNames).toEqual(expect.arrayContaining(["bash", "read"]));
    const bashRule = permissions.rules.find((rule) => rule.piName === "bash");
    expect(bashRule?.allowPatterns).toEqual(["ls", "git status"]);
  });

  it("returns empty allowlist when no tools are declared", () => {
    const permissions = mapAgentToolsToPiPermissions([]);

    expect(permissions.hasTools).toBe(false);
    expect(permissions.allowedToolNames).toEqual([]);
    expect(permissions.rules).toEqual([]);
    expect(permissions.toolkitNames).toEqual([]);
  });

  it("merges allow patterns when the same tool appears multiple times", () => {
    const permissions = mapAgentToolsToPiPermissions(["Write(*.ts)", "Write(*.tsx)"]);

    const writeRule = permissions.rules.find((rule) => rule.piName === "write");
    expect(writeRule?.allowPatterns).toEqual(["*.ts", "*.tsx"]);
    expect(permissions.allowedToolNames).toEqual(["write"]);
  });
});
