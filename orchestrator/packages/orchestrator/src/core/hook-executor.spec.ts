import { describe, expect, it, vi } from "vitest";
import { executeHooks } from "./hook-executor";
import type { HookSpec } from "./types";

describe("Hook Executor", () => {
  const baseContext = {
    projectDir: "/test/project",
    params: { language: "python" },
    getTaskState: () => ({ language: { name: "python" } }),
    setTaskState: vi.fn().mockResolvedValue(void 0),
  };

  describe("Start hooks", () => {
    it("should execute hooks in sequence", async () => {
      const order: string[] = [];
      const hooks: HookSpec[] = [
        {
          name: "first",
          fn: async () => {
            order.push("first");
            return { outcome: "success" as const };
          },
        },
        {
          name: "second",
          fn: async () => {
            order.push("second");
            return { outcome: "success" as const };
          },
        },
      ];

      const results = await executeHooks({ hooks, lifecycle: "Start", context: baseContext });

      expect(results).toHaveLength(2);
      expect(order).toEqual(["first", "second"]);
    });

    it("should stop on fatal", async () => {
      const hooks: HookSpec[] = [
        { name: "fatal", fn: async () => ({ outcome: "fatal" as const, message: "boom" }) },
        { name: "skipped", fn: async () => ({ outcome: "success" as const }) },
      ];

      const results = await executeHooks({ hooks, lifecycle: "Start", context: baseContext });

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe("fatal");
    });

    it("should allow skip outcome", async () => {
      const hooks: HookSpec[] = [
        {
          name: "skip-check",
          fn: async () => ({ outcome: "skip" as const, message: "nothing to do" }),
        },
      ];

      const results = await executeHooks({ hooks, lifecycle: "Start", context: baseContext });

      expect(results[0].outcome).toBe("skip");
      expect(results[0].message).toBe("nothing to do");
    });
  });

  describe("Stop hooks", () => {
    it("should detect follow-up", async () => {
      const hooks: HookSpec[] = [
        {
          name: "lint",
          fn: async () => ({ outcome: "follow-up" as const, message: "Fix lint errors" }),
        },
      ];

      const results = await executeHooks({ hooks, lifecycle: "Stop", context: baseContext });

      expect(results[0].outcome).toBe("follow-up");
      expect(results[0].message).toBe("Fix lint errors");
    });
  });

  describe("Overrides passthrough", () => {
    it("should return overrides unchanged in hook result", async () => {
      const hooks: HookSpec[] = [
        {
          name: "with-overrides",
          fn: async () => ({
            outcome: "success" as const,
            overrides: { cwd: "/custom/dir", instructions: "Do something" },
          }),
        },
      ];

      const results = await executeHooks({ hooks, lifecycle: "Start", context: baseContext });

      expect(results[0].overrides).toEqual({ cwd: "/custom/dir", instructions: "Do something" });
    });
  });

  describe("Error handling", () => {
    it("should treat thrown errors as fatal", async () => {
      const hooks: HookSpec[] = [
        {
          name: "broken",
          fn: async () => {
            throw new Error("crashed");
          },
        },
      ];

      const results = await executeHooks({ hooks, lifecycle: "Start", context: baseContext });

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe("fatal");
      expect(results[0].message).toBe("crashed");
    });

    it("should handle non-Error throws", async () => {
      const hooks: HookSpec[] = [
        // oxlint-disable-next-line no-throw-literal
        {
          name: "weird",
          fn: async () => {
            throw "string error";
          },
        },
      ];

      const results = await executeHooks({ hooks, lifecycle: "Start", context: baseContext });

      expect(results[0].outcome).toBe("fatal");
      expect(results[0].message).toBe("string error");
    });
  });

  describe("Context", () => {
    it("should pass hookName to hook function", async () => {
      let receivedName = "";
      const hooks: HookSpec[] = [
        {
          name: "my-hook",
          fn: async (ctx) => {
            receivedName = ctx.hookName;
            return { outcome: "success" as const };
          },
        },
      ];

      await executeHooks({ hooks, lifecycle: "Start", context: baseContext });

      expect(receivedName).toBe("my-hook");
    });

    it("should propagate state changes through sequential hooks", async () => {
      let latestState: Record<string, unknown> | null = null;
      const setStateMock = vi.fn().mockResolvedValue(void 0);
      let localState = { step: 1 };

      const contextWithMutableState = {
        ...baseContext,
        getTaskState: () => ({ ...localState }),
        setTaskState: setStateMock,
      };

      const hooks: HookSpec[] = [
        {
          name: "first",
          fn: async (ctx) => {
            await ctx.setTaskState({ step: 2 });
            localState = { step: 2 };
            return { outcome: "success" as const };
          },
        },
        {
          name: "second",
          fn: async (ctx) => {
            latestState = ctx.getTaskState();
            return { outcome: "success" as const };
          },
        },
      ];

      await executeHooks({ hooks, lifecycle: "Start", context: contextWithMutableState });

      expect(latestState).toEqual({ step: 2 });
      expect(setStateMock).toHaveBeenCalledWith({ step: 2 });
    });
  });
});
