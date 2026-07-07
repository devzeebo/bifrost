import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { BifrostHttpClient } from "./bifrost-http-client.js";

describe("BifrostHttpClient", () => {
  let client = new BifrostHttpClient("https://bifrost.example.com", "test-realm", "test-token");
  let mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    client = new BifrostHttpClient("https://bifrost.example.com", "test-realm", "test-token");
  });

  describe("getReadyRunes", () => {
    it("should fetch ready runes from /api/ready endpoint", async () => {
      const mockRunes = [
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
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRunes,
      });

      const runes = await client.getReadyRunes();

      expect(runes).toEqual(mockRunes);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://bifrost.example.com/api/ready",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
            "X-Bifrost-Realm": "test-realm",
          }),
        }),
      );
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Error details",
      });

      await expect(client.getReadyRunes()).rejects.toThrow(
        "Bifrost API error: 500 Internal Server Error",
      );
    });

    it("should return empty array when API returns null", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      const runes = await client.getReadyRunes();

      expect(runes).toEqual([]);
    });
  });

  describe("claimRune", () => {
    it("should claim rune via POST /api/claim-rune", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await client.claimRune("rune-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://bifrost.example.com/api/claim-rune",
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1"}',
        }),
      );
    });

    it("should throw 409 conflict error when already claimed", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: "Conflict",
      });

      const error = await client.claimRune("rune-1").catch((err) => err);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Rune already claimed");
      expect((error as { status?: number }).status).toBe(409);
    });
  });

  describe("createRune", () => {
    it("should create rune via POST /api/create-rune", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "rune-new",
          title: "New Rune",
          description: "Draft work item",
          status: "draft",
          priority: 1,
          tags: ["agent:implementer"],
          realm_id: "test-realm",
          created_at: "2026-05-08T00:00:00Z",
          updated_at: "2026-05-08T00:00:00Z",
          dependencies: [],
          notes: [],
          acceptance_criteria: [],
          retro_items: [],
          state: {},
        }),
      });

      const detail = await client.createRune({
        title: "New Rune",
        description: "Draft work item",
        priority: 1,
        tags: ["agent:implementer"],
      });

      expect(detail.id).toBe("rune-new");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://bifrost.example.com/api/create-rune",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });

  describe("forgeRune", () => {
    it("should forge rune via POST /api/forge-rune", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await client.forgeRune("rune-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://bifrost.example.com/api/forge-rune",
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1"}',
        }),
      );
    });
  });

  describe("addDependency", () => {
    it("should add dependency via POST /api/add-dependency", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await client.addDependency("rune-1", "rune-2", "blocks");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://bifrost.example.com/api/add-dependency",
        expect.objectContaining({
          method: "POST",
          body: '{"rune_id":"rune-1","target_id":"rune-2","relationship":"blocks"}',
        }),
      );
    });
  });

  describe("fulfillRune", () => {
    it("should fulfill rune via POST /api/fulfill-rune", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await client.fulfillRune("rune-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://bifrost.example.com/api/fulfill-rune",
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1"}',
        }),
      );
    });
  });

  describe("failRune", () => {
    it("should fail rune with error message via POST /api/fail-rune", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await client.failRune("rune-1", "Test failure");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://bifrost.example.com/api/fail-rune",
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1","reason":"Test failure"}',
        }),
      );
    });
  });

  describe("updateRuneState", () => {
    it("should update rune state via POST /api/update-rune-state", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await client.updateRuneState("rune-1", { step: 2, progress: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://bifrost.example.com/api/update-rune-state",
        expect.objectContaining({
          method: "POST",
          body: '{"rune_id":"rune-1","patch":"{\\"step\\":2,\\"progress\\":50}"}',
        }),
      );
    });
  });

  describe("404 handling", () => {
    it("should throw 404 error when rune not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const error = await client.getRune("unknown").catch((err) => err);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Rune not found");
      expect((error as { status?: number }).status).toBe(404);
    });
  });
});
