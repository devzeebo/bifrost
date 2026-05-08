import { describe, it, expect, vi } from "vitest";
import { loadConfig } from "./config.js";
import { readFile } from "node:fs/promises";

vi.mock("node:fs/promises");

describe("Config Loader - US-8, FR-13", () => {
  describe("Load .orchestrator.yaml configuration", () => {
    it("should parse valid configuration file", async () => {
      // Given a .orchestrator.yaml configuration file
      const yamlContent = `
orchestrate:
  task_source:
    type: api
    settings:
      base_url: https://api.example.com
      poll_interval: 30

  engine:
    type: ai-runtime
    settings:
      endpoint: https://ai.example.com

  task_state_store:
    type: redis
    settings:
      url: redis://localhost:6379

  concurrency: 5
  claimant: orchestrator-1
  logging: verbose
`;

      vi.mocked(readFile).mockResolvedValue(yamlContent);

      // When the orchestrator loads configuration
      const config = await loadConfig("/test/project");

      // Then an APITaskSource is created with the specified base_url
      expect(config.orchestrate.task_source.type).toBe("api");
      expect(config.orchestrate.task_source.settings?.base_url).toBe("https://api.example.com");

      // And the task source polls every 30 seconds
      expect(config.orchestrate.task_source.settings?.poll_interval).toBe(30);

      // And an AIRuntimeEngine is created with the specified endpoint
      expect(config.orchestrate.engine.type).toBe("ai-runtime");
      expect(config.orchestrate.engine.settings?.endpoint).toBe("https://ai.example.com");

      // And a RedisTaskStateStore is created
      expect(config.orchestrate.task_state_store.type).toBe("redis");
      expect(config.orchestrate.task_state_store.settings?.url).toBe("redis://localhost:6379");

      // And concurrency is 5
      expect(config.orchestrate.concurrency).toBe(5);

      // And claimant is set
      expect(config.orchestrate.claimant).toBe("orchestrator-1");

      // And logging is verbose
      expect(config.orchestrate.logging).toBe("verbose");
    });

    it("should use default values when optional fields are missing", async () => {
      const yamlContent = `
orchestrate:
  task_source:
    type: memory
  engine:
    type: test
  task_state_store:
    type: memory
`;

      vi.mocked(readFile).mockResolvedValue(yamlContent);

      const config = await loadConfig("/test/project");

      expect(config.orchestrate.concurrency).toBe(1); // default
      expect(config.orchestrate.claimant).toBeNull(); // default
      expect(config.orchestrate.logging).toBe("normal"); // default
    });

    it("should throw error for unknown task source type", async () => {
      // Given an unknown task source type is configured
      const yamlContent = `
orchestrate:
  task_source:
    type: unknown-type
  engine:
    type: test
  task_state_store:
    type: memory
`;

      vi.mocked(readFile).mockResolvedValue(yamlContent);

      // When the orchestrator attempts to create the task source
      // Then an error is raised with message "Unknown task source type: {type}"
      await expect(loadConfig("/test/project")).rejects.toThrow(
        "Unknown task source type: unknown-type",
      );
    });

    it("should load from home directory when not in project", async () => {
      // Test loading config from home directory as fallback
      const yamlContent = `
orchestrate:
  task_source:
    type: memory
  engine:
    type: test
  task_state_store:
    type: memory
`;

      vi.mocked(readFile).mockResolvedValue(yamlContent);

      const config = await loadConfig("/home/user/.orchestrator.yaml");

      expect(config.orchestrate.task_source.type).toBe("memory");
    });
  });
});
