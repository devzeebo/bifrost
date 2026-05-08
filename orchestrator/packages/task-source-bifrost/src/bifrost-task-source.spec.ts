import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@orchestrator/task-source";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

const createTestSource = async (): Promise<{
  source: BifrostTaskSource;
  cleanup: () => Promise<void>;
}> => {
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

  const { BifrostTaskSource } = await import("./bifrost-task-source");

  return {
    source: new BifrostTaskSource(),
    cleanup: async (): Promise<void> => {
      process.chdir(originalCwd);
      if (originalHome === void 0) {
        delete process.env.BIFROST_TEST_HOME;
      } else {
        process.env.BIFROST_TEST_HOME = originalHome;
      }
      await rm(tempDir, { recursive: true, force: true });
    },
  };
};

describe("BifrostTaskSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("agent tag filtering", () => {
    it("should yield task for rune with agent:implementer tag", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: "rune-1",
              title: "Test Rune",
              status: "open",
              priority: 1,
              tags: ["agent:implementer"],
              realm_id: "test-realm",
              created_at: "2026-05-08T00:00:00Z",
              updated_at: "2026-05-08T00:00:00Z",
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "rune-1",
            title: "Test Rune",
            description: "Test description",
            status: "open",
            priority: 1,
            tags: ["agent:implementer"],
            realm_id: "test-realm",
            created_at: "2026-05-08T00:00:00Z",
            updated_at: "2026-05-08T00:00:00Z",
            dependencies: [],
          }),
        });

      const tasks: Task[] = [];

      for await (const taskItem of source.watchTasks()) {
        tasks.push(taskItem);
        break;
      }

      await cleanup();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].agentId).toBe("implementer");
    });

    it("should skip rune without agent tag", async () => {
      const { source, cleanup } = await createTestSource();

      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: "rune-1",
                title: "Test Rune",
                status: "open",
                priority: 1,
                tags: ["bug", "high-priority"],
                realm_id: "test-realm",
                created_at: "2026-05-08T00:00:00Z",
                updated_at: "2026-05-08T00:00:00Z",
              },
            ],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      });

      const tasks: Task[] = [];

      void (async (): Promise<void> => {
        for await (const taskItem of source.watchTasks()) {
          tasks.push(taskItem);
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(tasks).toHaveLength(0);
      expect(callCount).toBeGreaterThanOrEqual(1);

      await cleanup();
    }, 10000);

    it("should use first agent tag when multiple exist", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: "rune-1",
              title: "Test Rune",
              status: "open",
              priority: 1,
              tags: ["agent:implementer", "agent:tester"],
              realm_id: "test-realm",
              created_at: "2026-05-08T00:00:00Z",
              updated_at: "2026-05-08T00:00:00Z",
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "rune-1",
            title: "Test Rune",
            description: "Test description",
            status: "open",
            priority: 1,
            tags: ["agent:implementer", "agent:tester"],
            realm_id: "test-realm",
            created_at: "2026-05-08T00:00:00Z",
            updated_at: "2026-05-08T00:00:00Z",
            dependencies: [],
          }),
        });

      const tasks: Task[] = [];

      for await (const taskItem of source.watchTasks()) {
        tasks.push(taskItem);
        break;
      }

      await cleanup();

      expect(tasks[0].agentId).toBe("implementer");
    });
  });

  describe("completeTask", () => {
    it("should call fulfillRune API", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      await source.completeTask("rune-1");

      await cleanup();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/fulfill-rune"),
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1"}',
        }),
      );
    });
  });

  describe("failTask", () => {
    it("should call failRune API with error message", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      await source.failTask("rune-1", "Task failed");

      await cleanup();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/fail-rune"),
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1","error":"Task failed"}',
        }),
      );
    });
  });

  describe("setState", () => {
    it("should call updateRuneState API", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      await source.setState("rune-1", { step: 2, progress: 50 });

      await cleanup();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/update-rune-state"),
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1","state":{"step":2,"progress":50}}',
        }),
      );
    });

    it("should log error but not throw when state update fails", async () => {
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
    });
  });

  describe("task mapping", () => {
    it("should map rune detail to task with all required fields", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: "rune-1",
              title: "Test Rune",
              status: "open",
              priority: 1,
              tags: ["agent:implementer"],
              realm_id: "test-realm",
              created_at: "2026-05-08T00:00:00Z",
              updated_at: "2026-05-08T00:00:00Z",
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "rune-1",
            title: "Test Rune",
            description: "Test description",
            status: "open",
            priority: 1,
            tags: ["agent:implementer"],
            realm_id: "test-realm",
            created_at: "2026-05-08T00:00:00Z",
            updated_at: "2026-05-08T00:00:00Z",
            branch: "feature-branch",
            saga_id: "saga-1",
            assignee_id: "account-1",
            dependencies: [
              { target_id: "rune-2", relationship: "blocks" },
              { target_id: "rune-3", relationship: "relates_to" },
            ],
          }),
        });

      let task: Task | null = null;

      for await (const taskItem of source.watchTasks()) {
        task = taskItem;
        break;
      }

      await cleanup();

      expect(task).toBeDefined();
      expect(task!.id).toBe("rune-1");
      expect(task!.agentId).toBe("implementer");
      expect(task!.metadata.title).toBe("Test Rune");
      expect(task!.metadata.description).toBe("Test description");
      expect(task!.metadata.priority).toBe(1);
      expect(task!.metadata.status).toBe("open");
      expect(task!.metadata.branch).toBe("feature-branch");
      expect(task!.metadata.sagaId).toBe("saga-1");
      expect(task!.metadata.assignee).toBe("account-1");
      expect(task!.metadata.createdAt).toBe("2026-05-08T00:00:00Z");
      expect(task!.metadata.dependencies).toEqual([
        { taskId: "rune-2", type: "blocks" },
        { taskId: "rune-3", type: "relates_to" },
      ]);
    });
  });
});
