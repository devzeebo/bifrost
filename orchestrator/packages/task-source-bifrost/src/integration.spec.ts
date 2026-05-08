import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@orchestrator/task-source";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

async function createTestSource() {
  const tempDir = join("/tmp", `bifrost-test-${randomBytes(8).toString("hex")}`);
  await mkdir(tempDir, { recursive: true });

  const bifrostConfig = "url: https://bifrost.example.com\nrealm: test-realm\n";
  await writeFile(join(tempDir, ".bifrost.yaml"), bifrostConfig, "utf-8");

  const homeDir = join(tempDir, "home");
  await mkdir(join(homeDir, ".config", "bifrost"), { recursive: true });
  const credentials = "credentials:\n  https://bifrost.example.com:\n    token: test-token\n";
  await writeFile(join(homeDir, ".config", "bifrost", "credentials.yaml"), credentials, "utf-8");

  const originalCwd = process.cwd();
  const originalHome = process.env.BIFROST_TEST_HOME;
  process.chdir(tempDir);
  process.env.BIFROST_TEST_HOME = homeDir;

  const { BifrostTaskSource } = await import("./bifrost-task-source.js");

  return {
    source: new BifrostTaskSource(),
    cleanup: async () => {
      process.chdir(originalCwd);
      if (originalHome === undefined) {
        delete process.env.BIFROST_TEST_HOME;
      } else {
        process.env.BIFROST_TEST_HOME = originalHome;
      }
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

describe("BifrostTaskSource - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("task operations", () => {
    it("should complete task successfully", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      await source.completeTask("rune-1");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/fulfill-rune"),
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1"}',
        }),
      );

      await cleanup();
    }, 1000);

    it("should fail task with error message", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      await source.failTask("rune-1", "Execution failed");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/fail-rune"),
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1","error":"Execution failed"}',
        }),
      );

      await cleanup();
    }, 1000);

    it("should update task state", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      await source.setState("rune-1", { step: 2, progress: 50 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/update-rune-state"),
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1","state":{"step":2,"progress":50}}',
        }),
      );

      await cleanup();
    }, 1000);

    it("should handle setState error gracefully", async () => {
      const { source, cleanup } = await createTestSource();

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(source.setState("rune-1", { step: 2 })).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      await cleanup();
    }, 1000);
  });

  describe("watchTasks yields valid tasks", () => {
    it("should yield task with correct structure", async () => {
      const { source, cleanup } = await createTestSource();

      const fetchCalls: any[] = [];
      global.fetch = vi.fn((...args: any[]) => {
        fetchCalls.push(args);
        const callCount = fetchCalls.length;

        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: "rune-1",
                title: "Test Task",
                description: "Test description",
                status: "open",
                priority: 1,
                tags: ["agent:implementer"],
                realm_id: "test-realm",
                created_at: "2026-05-08T00:00:00Z",
                updated_at: "2026-05-08T00:00:00Z",
                branch: "main",
                saga_id: "saga-1",
                dependencies: [{ target_id: "rune-2", relationship: "blocks" }],
              },
            ],
          });
        } else if (callCount === 2) {
          return Promise.resolve({ ok: true, status: 204 });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "rune-1",
            title: "Test Task",
            description: "Test description",
            status: "open",
            priority: 1,
            tags: ["agent:implementer"],
            realm_id: "test-realm",
            created_at: "2026-05-08T00:00:00Z",
            updated_at: "2026-05-08T00:00:00Z",
            branch: "main",
            saga_id: "saga-1",
            dependencies: [{ target_id: "rune-2", relationship: "blocks" }],
          }),
        });
      });

      let task: Task | undefined;
      for await (const t of source.watchTasks()) {
        task = t;
        break;
      }

      expect(task).toBeDefined();
      expect(task!.id).toBe("rune-1");
      expect(task!.agentId).toBe("implementer");
      expect(task!.metadata.title).toBe("Test Task");
      expect(task!.metadata.description).toBe("Test description");
      expect(task!.metadata.priority).toBe(1);
      expect(task!.metadata.status).toBe("open");
      expect(task!.metadata.branch).toBe("main");
      expect(task!.metadata.sagaId).toBe("saga-1");
      expect(task!.metadata.dependencies).toEqual([{ taskId: "rune-2", type: "blocks" }]);

      await cleanup();
    }, 1000);

    it("should claim rune before yielding task", async () => {
      const { source, cleanup } = await createTestSource();

      const fetchCalls: any[] = [];
      global.fetch = vi.fn((...args: any[]) => {
        fetchCalls.push(args);
        const callCount = fetchCalls.length;

        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: "rune-1",
                title: "Test",
                status: "open",
                priority: 1,
                tags: ["agent:tester"],
                realm_id: "test-realm",
                created_at: "2026-05-08T00:00:00Z",
                updated_at: "2026-05-08T00:00:00Z",
                dependencies: [],
              },
            ],
          });
        } else if (callCount === 2) {
          return Promise.resolve({ ok: true, status: 204 });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "rune-1",
            title: "Test",
            description: "Test",
            status: "open",
            priority: 1,
            tags: ["agent:tester"],
            realm_id: "test-realm",
            created_at: "2026-05-08T00:00:00Z",
            updated_at: "2026-05-08T00:00:00Z",
            dependencies: [],
          }),
        });
      });

      for await (const _task of source.watchTasks()) {
        break;
      }

      const claimCall = fetchCalls[1];
      expect(claimCall[0]).toContain("/api/claim-rune");
      expect(JSON.parse(claimCall[1].body)).toEqual({ id: "rune-1" });

      await cleanup();
    }, 1000);
  });
});
