import { describe, expect, it } from "vite-plus/test";

import { getFlowEntryArgs, getFlowEntryName, isFlowEntry, normalizeFlowEntry } from "./flow.js";

describe("flow", () => {
  it("accepts strings and args-bearing objects", () => {
    expect(isFlowEntry("logging")).toBe(true);
    expect(isFlowEntry({ name: "retry", args: [4] })).toBe(true);
    expect(isFlowEntry({ name: "retry" })).toBe(true);
    expect(isFlowEntry("")).toBe(false);
    expect(isFlowEntry({ name: "" })).toBe(false);
    expect(isFlowEntry({ name: "retry", args: 4 })).toBe(false);
  });

  it("normalizes string entries to zero-arg entries", () => {
    expect(normalizeFlowEntry("outer")).toEqual({ name: "outer", args: [] });
    expect(normalizeFlowEntry({ name: "retry", args: [4] })).toEqual({
      name: "retry",
      args: [4],
    });
  });

  it("extracts name and args", () => {
    expect(getFlowEntryName("outer")).toBe("outer");
    expect(getFlowEntryArgs("outer")).toEqual([]);
    expect(getFlowEntryName({ name: "retry", args: [3] })).toBe("retry");
    expect(getFlowEntryArgs({ name: "retry", args: [3] })).toEqual([3]);
  });
});
