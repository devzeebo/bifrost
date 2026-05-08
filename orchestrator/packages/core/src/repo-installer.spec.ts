import { describe, expect, it, vi } from "vitest";
import { installRepoScripts } from "./repo-installer.js";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

vi.mock("node:fs/promises");

describe("Repo Script Installer - US-5", () => {
  describe("First run installs repo scripts into working repository", () => {
    it("should hard-copy repo scripts to .ai/<agent>/hooks/<lifecycle>.d/<hook-name>.mjs", async () => {
      // Given an orchestrator program with built-in agents that have repo scripts
      const agents = [
        {
          name: "test-agent",
          hooks: {
            Start: [
              {
                name: "validate-args",
                scriptPath: "hooks/Start.d/validate-args.mjs",
                isRepoScript: true,
              },
            ],
            Stop: [
              {
                name: "check-new-tests",
                scriptPath: "hooks/Stop.d/check-new-tests.mjs",
                isRepoScript: true,
              },
            ],
          },
        },
      ];

      const mockScriptContent = "export default async () => { return { exitCode: 0 } }";

      vi.mocked(readFile).mockResolvedValue(mockScriptContent);
      vi.mocked(stat).mockRejectedValue(new Error("File not found"));
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);

      // When the orchestrator runs against the working repository for the first time
      await installRepoScripts("/test/project", agents, "/orchestrator/packages");

      // Then each repo script is hard-copied to .ai/<agent-name>/hooks/<lifecycle>.d/<hook-name>.mjs
      expect(writeFile).toHaveBeenCalledWith(
        "/test/project/.ai/test-agent/hooks/Start.d/validate-args.mjs",
        mockScriptContent,
        "utf-8",
      );
      expect(writeFile).toHaveBeenCalledWith(
        "/test/project/.ai/test-agent/hooks/Stop.d/check-new-tests.mjs",
        mockScriptContent,
        "utf-8",
      );
    });

    it("should create no symlinks - only hard copies", async () => {
      const agents = [
        {
          name: "test-agent",
          hooks: {
            Start: [{ name: "test", scriptPath: "hooks/Start.d/test.mjs", isRepoScript: true }],
            Stop: [],
          },
        },
      ];

      vi.mocked(readFile).mockResolvedValue("content");
      vi.mocked(stat).mockRejectedValue(new Error("not found"));

      await installRepoScripts("/test/project", agents, "/orchestrator/packages");

      // Verify copy was made (not symlink)
      expect(writeFile).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining(".ai"),
        expect.any(String),
        "utf-8",
      );
    });

    it("should log each installed path", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const agents = [
        {
          name: "test-agent",
          hooks: {
            Start: [
              { name: "validate", scriptPath: "hooks/Start.d/validate.mjs", isRepoScript: true },
            ],
            Stop: [],
          },
        },
      ];

      vi.mocked(readFile).mockResolvedValue("content");
      vi.mocked(stat).mockRejectedValue(new Error("not found"));

      await installRepoScripts("/test/project", agents, "/orchestrator/packages");

      // Then the orchestrator logs each installed path
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("test-agent/hooks/Start.d/validate.mjs"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Idempotent installation", () => {
    it("should not overwrite existing scripts", async () => {
      // Given a working repository that has already been initialized
      // And a repo script already exists at the expected path
      const agents = [
        {
          name: "test-agent",
          hooks: {
            Start: [
              { name: "validate", scriptPath: "hooks/Start.d/validate.mjs", isRepoScript: true },
            ],
            Stop: [],
          },
        },
      ];

      vi.mocked(readFile).mockResolvedValue("new content");
      vi.mocked(stat).mockResolvedValue({ isFile: () => true } as any);

      // Clear previous calls
      vi.clearAllMocks();

      // When the orchestrator runs again
      await installRepoScripts("/test/project", agents, "/orchestrator/packages");

      // Then the existing script is not overwritten
      expect(writeFile).not.toHaveBeenCalled();
    });

    it("should log that script is already present", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const agents = [
        {
          name: "test-agent",
          hooks: {
            Start: [
              { name: "validate", scriptPath: "hooks/Start.d/validate.mjs", isRepoScript: true },
            ],
            Stop: [],
          },
        },
      ];

      vi.mocked(readFile).mockResolvedValue("content");
      vi.mocked(stat).mockResolvedValue({ isFile: () => true } as any);

      vi.clearAllMocks();

      await installRepoScripts("/test/project", agents, "/orchestrator/packages");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Already present:"));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("test-agent/hooks/Start.d/validate.mjs"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Framework hooks not installed", () => {
    it("should skip hooks where isRepoScript is false", async () => {
      const agents = [
        {
          name: "test-agent",
          hooks: {
            Start: [
              {
                name: "validate-args",
                scriptPath: "hooks/Start.d/validate-args.mjs",
                isRepoScript: false,
              },
            ],
            Stop: [],
          },
        },
      ];

      vi.clearAllMocks();

      await installRepoScripts("/test/project", agents, "/orchestrator/packages");

      // Framework hooks run from the orchestrator's packages/ context
      // They should not be installed to the working repo
      expect(writeFile).not.toHaveBeenCalled();
    });
  });
});
