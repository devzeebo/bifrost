import { describe, expect, it, vi } from "vitest";
import type { HookExecutionContext } from "./hook-executor.js";
import { executeHooks } from "./hook-executor.js";

describe("Hook Executor - US-4", () => {
  describe("Start hooks execution", () => {
    it("should execute Start hooks in sequence before agent", async () => {
      // Given an AGENT.md with hooks.Start section
      const hooks = [
        {
          name: "validate-args",
          scriptPath: "/hooks/validate-args.mjs",
          timeout: 30000,
        },
      ];

      const context: HookExecutionContext = {
        projectDir: "/test/project",
        params: { language: "python" },
        taskState: { language: { name: "python" } },
      };

      const mockExec = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

      // When the agent is dispatched
      const results = await executeHooks(hooks, "Start", context, mockExec);

      // Then each Start hook executes in declaration order
      expect(results).toHaveLength(1);
      expect(results[0].hookName).toBe("validate-args");
      expect(results[0].exitCode).toBe(0);
    });

    it("should pass exit code 0 allows agent to proceed", async () => {
      const hooks = [{ name: "test", scriptPath: "/test.mjs", timeout: 30000 }];
      const context = {
        projectDir: "/test",
        params: {},
        taskState: {},
      };

      const mockExec = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

      const results = await executeHooks(hooks, "Start", context, mockExec);

      // Exit code 0 allows the agent to proceed
      expect(results[0].shouldProceed).toBe(true);
    });

    it("should pass exit code 1 passes stdout as warning and continues", async () => {
      const hooks = [{ name: "test", scriptPath: "/test.mjs", timeout: 30000 }];
      const context = {
        projectDir: "/test",
        params: {},
        taskState: {},
      };

      const mockExec = vi.fn().mockResolvedValue({
        exitCode: 1,
        stdout: "Warning: deprecated usage",
        stderr: "",
      });

      const results = await executeHooks(hooks, "Start", context, mockExec);

      // Exit code 1 passes hook stdout to agent as warning and continues
      expect(results[0].exitCode).toBe(1);
      expect(results[0].stdout).toBe("Warning: deprecated usage");
      expect(results[0].shouldProceed).toBe(true);
    });

    it("should pass exit code 2 halts agent and marks UoW as failed", async () => {
      const hooks = [{ name: "validate-args", scriptPath: "/test.mjs", timeout: 30000 }];
      const context = {
        projectDir: "/test",
        params: {},
        taskState: {},
      };

      const mockExec = vi.fn().mockResolvedValue({
        exitCode: 2,
        stdout: "",
        stderr: "Validation failed",
      });

      const results = await executeHooks(hooks, "Start", context, mockExec);

      // Exit code 2 halts the agent, marks UoW as failed
      expect(results[0].exitCode).toBe(2);
      expect(results[0].shouldProceed).toBe(false);
      expect(results[0].fatal).toBe(true);
    });
  });

  describe("Hook stdin format", () => {
    it("should receive JSON with projectDir, params, taskState", async () => {
      const hooks = [{ name: "test", scriptPath: "/test.mjs", timeout: 30000 }];
      const context = {
        projectDir: "/test/project",
        params: { language: "python" },
        taskState: { language: { name: "python" } },
      };

      const mockExec = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

      await executeHooks(hooks, "Start", context, mockExec);

      // Hook receives JSON containing: projectDir, params, taskState
      expect(mockExec).toHaveBeenCalledWith(
        expect.objectContaining({
          stdin: expect.stringContaining("projectDir"),
        }),
      );
    });

    it("should NOT include rendered prompt in stdin", async () => {
      const hooks = [{ name: "test", scriptPath: "/test.mjs", timeout: 30000 }];
      const context = {
        projectDir: "/test",
        params: {},
        taskState: {},
      };

      const mockExec = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

      await executeHooks(hooks, "Start", context, mockExec);

      // The rendered prompt is NOT present in stdin
      const callArgs = mockExec.mock.calls[0];
      const {stdin} = callArgs[0];
      expect(stdin).not.toContain("prompt");
    });
  });

  describe("Hook timeout behavior", () => {
    it("should use default timeout of 300000ms when not configured", async () => {
      const hooks = [{ name: "test", scriptPath: "/test.mjs" }]; // no timeout
      const context = {
        projectDir: "/test",
        params: {},
        taskState: {},
      };

      const mockExec = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

      await executeHooks(hooks, "Start", context, mockExec);

      // Default timeout of 300000ms (5 minutes) is applied
      expect(mockExec).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 300000,
        }),
      );
    });

    it("should use configured timeout when specified", async () => {
      const hooks = [{ name: "test", scriptPath: "/test.mjs", timeout: 120000 }];
      const context = {
        projectDir: "/test",
        params: {},
        taskState: {},
      };

      const mockExec = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

      await executeHooks(hooks, "Start", context, mockExec);

      expect(mockExec).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 120000,
        }),
      );
    });

    it("should treat timeout as exit code 2", async () => {
      const hooks = [{ name: "test", scriptPath: "/test.mjs", timeout: 100 }];
      const context = {
        projectDir: "/test",
        params: {},
        taskState: {},
      };

      const mockExec = vi.fn().mockRejectedValue(new Error("Timeout"));

      const results = await executeHooks(hooks, "Start", context, mockExec);

      // Hook execution is terminated and treated as exit code 2
      expect(results[0].fatal).toBe(true);
      expect(results[0].timedOut).toBe(true);
    });
  });

  describe("Stop hooks execution", () => {
    it("should execute Stop hooks after agent finishes", async () => {
      const hooks = [{ name: "check-new-tests", scriptPath: "/check.mjs", timeout: 30000 }];
      const context = {
        projectDir: "/test",
        params: {},
        taskState: {},
      };

      const mockExec = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

      const results = await executeHooks(hooks, "Stop", context, mockExec);

      expect(results).toHaveLength(1);
      expect(results[0].hookName).toBe("check-new-tests");
    });

    it("should trigger follow-up on exit code 1", async () => {
      const hooks = [{ name: "lint", scriptPath: "/lint.mjs", timeout: 30000 }];
      const context = {
        projectDir: "/test",
        params: {},
        taskState: {},
      };

      const mockExec = vi.fn().mockResolvedValue({
        exitCode: 1,
        stdout: "Lint errors found",
        stderr: "",
      });

      const results = await executeHooks(hooks, "Stop", context, mockExec);

      // Exit code 1 returns stdout to agent for remediation (follow-up loop)
      expect(results[0].needsFollowUp).toBe(true);
      expect(results[0].stdout).toBe("Lint errors found");
    });
  });
});
