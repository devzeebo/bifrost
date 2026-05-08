import { describe, expect, it } from "vitest";
import { listAgents } from "./index.js";

describe("CLI - US-9: List Available Agents", () => {
  describe("--list-agents command", () => {
    it("should print each agent name, description, model, tools, start_hooks, stop_hooks", async () => {
      // Given the agent catalog contains agents
      // And agent "reviewer" has description, model, tools, and hooks
      const mockAgent = {
        name: "reviewer",
        description: "Code review agent",
        tools: ["readFile", "edit"],
        model: "claude-opus-4-7",
        hooks: {
          Start: [{ name: "validate-args", scriptPath: "/hooks/validate-args.mjs" }],
          Stop: [{ name: "check-new-tests", scriptPath: "/hooks/check.mjs" }],
        },
      };

      // When the orchestrator CLI is invoked with --list-agents
      const output = await listAgents([mockAgent]);

      // Then each agent name is printed
      expect(output).toContain("reviewer");
      // And agent description is printed if present
      expect(output).toContain("Code review agent");
      // And agent tools are printed as comma-separated list
      expect(output).toContain("readFile, edit");
      // And start_hooks are printed
      expect(output).toContain("validate-args");
      // And stop_hooks are printed
      expect(output).toContain("check-new-tests");
    });

    it('should print "No agents found" when catalog is empty', async () => {
      // Given the agent catalog is empty
      // When the orchestrator CLI is invoked with --list-agents
      const output = await listAgents([]);

      // Then "No agents found." is printed
      expect(output).toContain("No agents found");
    });
  });
});
