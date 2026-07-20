import { describe, expect, it } from "vite-plus/test";

import { isMcpToolName, toBifrostToolName, toPiToolName } from "./tool-names.js";

describe("toPiToolName", () => {
  it("maps Bifrost built-ins to Pi names", () => {
    expect(toPiToolName("Read")).toBe("read");
    expect(toPiToolName("Write")).toBe("write");
    expect(toPiToolName("Edit")).toBe("edit");
    expect(toPiToolName("Shell")).toBe("bash");
    expect(toPiToolName("Bash")).toBe("bash");
    expect(toPiToolName("Grep")).toBe("grep");
    expect(toPiToolName("Glob")).toBe("find");
    expect(toPiToolName("Find")).toBe("find");
    expect(toPiToolName("LS")).toBe("ls");
  });

  it("passes through mcp and unknown names", () => {
    expect(toPiToolName("mcp__mykit__echo")).toBe("mcp__mykit__echo");
    expect(toPiToolName("CustomTool")).toBe("CustomTool");
  });
});

describe("toBifrostToolName", () => {
  it("maps Pi built-ins back to Bifrost names", () => {
    expect(toBifrostToolName("read")).toBe("Read");
    expect(toBifrostToolName("bash")).toBe("Shell");
    expect(toBifrostToolName("find")).toBe("Glob");
  });
});

describe("isMcpToolName", () => {
  it("detects mcp toolkit tool names", () => {
    expect(isMcpToolName("mcp__context7__resolve")).toBe(true);
    expect(isMcpToolName("Read")).toBe(false);
  });
});
