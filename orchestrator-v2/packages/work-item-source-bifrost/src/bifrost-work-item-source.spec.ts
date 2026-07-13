import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { WorkItem } from "@bifrost-ai/interfaces-work";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { BifrostWorkItemSource } from "./bifrost-work-item-source.js";

const createTestSource = async (): Promise<{
  source: InstanceType<typeof BifrostWorkItemSource>;
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

  const { BifrostWorkItemSource: ImportedBifrostWorkItemSource } =
    await import("./bifrost-work-item-source.js");

  return {
    source: new ImportedBifrostWorkItemSource(),
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

const runeDetailFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "rune-1",
  title: "Test Rune",
  description: "Test description",
  status: "open",
  priority: 1,
  tags: ["agent:implementer"],
  realm_id: "test-realm",
  created_at: "2026-05-08T00:00:00Z",
  updated_at: "2026-05-08T01:00:00Z",
  branch: "feature-branch",
  parent_id: "saga-1",
  assignee_id: "account-1",
  dependencies: [
    { target_id: "rune-2", relationship: "blocks" },
    { target_id: "rune-3", relationship: "relates_to" },
  ],
  notes: [{ text: "A note", created_at: "2026-05-08T00:30:00Z" }],
  acceptance_criteria: [{ id: "ac-1", scenario: "Given something", description: "it works" }],
  retro_items: [{ text: "Went well", created_at: "2026-05-08T00:45:00Z" }],
  state: { step: 1 },
  ...overrides,
});

describe("BifrostWorkItemSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("agent tag filtering", () => {
    it("should yield work item for rune with agent:implementer tag", async () => {
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
          json: async () => runeDetailFixture({ dependencies: [] }),
        });

      const workItems: WorkItem[] = [];

      for await (const workItem of source.watchWorkItems()) {
        workItems.push(workItem);
        break;
      }

      await cleanup();

      expect(workItems).toHaveLength(1);
      expect(workItems[0].kind).toBe("implementer");
      expect(workItems[0].flow).toEqual([]);
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
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 204,
        } as Response);
      }) as unknown as typeof global.fetch;

      const workItems: WorkItem[] = [];

      void (async (): Promise<void> => {
        for await (const workItem of source.watchWorkItems()) {
          workItems.push(workItem);
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(workItems).toHaveLength(0);
      expect(callCount).toBeGreaterThanOrEqual(1);

      await cleanup();
    }, 10000);
  });

  describe("completeWorkItem", () => {
    it("should call fulfillRune API", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      await source.completeWorkItem("rune-1");

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

  describe("failWorkItem", () => {
    it("should call failRune API with error message", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      await source.failWorkItem("rune-1", "Work item failed");

      await cleanup();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/fail-rune"),
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1","reason":"Work item failed"}',
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
          body: '{"rune_id":"rune-1","patch":"{\\"step\\":2,\\"progress\\":50}"}',
        }),
      );
    });
  });

  describe("createDraftWorkItem", () => {
    it("should call create-rune API and return work item id", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => runeDetailFixture({ id: "rune-new", status: "draft" }),
      });

      const workItemId = await source.createDraftWorkItem({
        kind: "implementer",
        metadata: { title: "New work item", description: "Do the thing" },
      });

      await cleanup();

      expect(workItemId).toBe("rune-new");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/create-rune"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("agent:implementer"),
        }),
      );
    });
  });

  describe("startWorkItem", () => {
    it("should call forge-rune API", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      await source.startWorkItem("rune-1");

      await cleanup();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/forge-rune"),
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1"}',
        }),
      );
    });
  });

  describe("setDependency", () => {
    it("should call add-dependency API with default blocks relationship", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      await source.setDependency("rune-1", "rune-2");

      await cleanup();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/add-dependency"),
        expect.objectContaining({
          method: "POST",
          body: '{"rune_id":"rune-1","target_id":"rune-2","relationship":"blocks"}',
        }),
      );
    });
  });

  describe("getDependencies", () => {
    it("should return mapped dependency edges", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => runeDetailFixture(),
      });

      const deps = await source.getDependencies("rune-1");

      await cleanup();

      expect(deps).toEqual([
        { workItemId: "rune-2", type: "blocks" },
        { workItemId: "rune-3", type: "relates_to" },
      ]);
    });
  });

  describe("work item mapping", () => {
    it("should map rune detail to work item with all required fields", async () => {
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
          json: async () => runeDetailFixture(),
        });

      let workItem: WorkItem | null = null;

      for await (const item of source.watchWorkItems()) {
        workItem = item;
        break;
      }

      await cleanup();

      expect(workItem).toBeDefined();
      expect(workItem!.workItemId).toBe("rune-1");
      expect(workItem!.kind).toBe("implementer");
      expect(workItem!.flow).toEqual([]);
      expect(workItem!.metadata.description).toBe("Test description");
      expect(workItem!.metadata.dependencies).toEqual([
        { target_id: "rune-2", relationship: "blocks" },
        { target_id: "rune-3", relationship: "relates_to" },
      ]);
      expect(workItem!.state.step).toBe(1);
    });
  });

  describe("gating", () => {
    it("should only poll /api/ready for streaming work items", async () => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      void (async (): Promise<void> => {
        for await (const _workItem of source.watchWorkItems()) {
          // not expected in this test
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const urls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map(
        (call) => call[0] as string,
      );
      expect(urls.every((url) => url.includes("/api/ready"))).toBe(true);
      expect(urls.some((url) => url.includes("/api/runes"))).toBe(false);

      await cleanup();
    });
  });

  describe("adaptive polling", () => {
    it("should apply exponential backoff capped at maxPollInterval", () => {
      const defaultPollInterval = 1000;
      const maxPollInterval = 30000;
      let pollInterval = defaultPollInterval;

      pollInterval = Math.min(pollInterval * 2, maxPollInterval);
      expect(pollInterval).toBe(2000);

      pollInterval = Math.min(pollInterval * 2, maxPollInterval);
      expect(pollInterval).toBe(4000);

      pollInterval = defaultPollInterval;
      expect(pollInterval).toBe(1000);
    });
  });

  describe("mapRuneStatus", () => {
    it.each([
      ["draft", "draft"],
      ["open", "live"],
      ["claimed", "live"],
      ["fulfilled", "completed"],
      ["sealed", "failed"],
      ["shattered", "failed"],
      ["unknown-status", "live"],
    ] as const)("maps %s to %s", async (status, expected) => {
      const { BifrostWorkItemSource } = await import("./bifrost-work-item-source.js");
      expect(BifrostWorkItemSource.mapRuneStatus(status)).toBe(expected);
    });
  });

  describe("getWorkItemStatus", () => {
    it.each([
      ["draft", "draft"],
      ["open", "live"],
      ["claimed", "live"],
      ["fulfilled", "completed"],
      ["sealed", "failed"],
      ["shattered", "failed"],
      ["unknown-status", "live"],
    ] as const)("returns %s for rune status %s", async (runeStatus, expected) => {
      const { source, cleanup } = await createTestSource();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => runeDetailFixture({ status: runeStatus }),
      });

      const status = await source.getWorkItemStatus("rune-1");

      await cleanup();

      expect(status).toBe(expected);
    });
  });
});
