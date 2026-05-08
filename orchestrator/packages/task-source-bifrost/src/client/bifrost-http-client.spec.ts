import { beforeEach, describe, expect, it, vi } from "vitest";
import { BifrostHttpClient } from "./bifrost-http-client.js";

describe("BifrostHttpClient", () => {
  let client: BifrostHttpClient;
  let mockFetch: ReturnType<typeof vi.fn>;

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
      });

      await expect(client.getReadyRunes()).rejects.toThrow("Bifrost API error: 500 Internal Server Error");
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
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
            "X-Bifrost-Realm": "test-realm",
          }),
        }),
      );
    });

    it("should throw 409 conflict error when already claimed", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: "Conflict",
      });

      const error = await client.claimRune("rune-1").catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Rune already claimed");
      expect((error as { status?: number }).status).toBe(409);
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
          body: '{"id":"rune-1","error":"Test failure"}',
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

      const taskState = { step: 2, progress: 50 };

      await client.updateRuneState("rune-1", taskState);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://bifrost.example.com/api/update-rune-state",
        expect.objectContaining({
          method: "POST",
          body: '{"id":"rune-1","state":{"step":2,"progress":50}}',
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

      const error = await client.getRune("unknown").catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Rune not found");
      expect((error as { status?: number }).status).toBe(404);
    });
  });

  describe("URL normalization", () => {
    it("should strip trailing slash from base URL", () => {
      const clientWithSlash = new BifrostHttpClient(
        "https://bifrost.example.com/",
        "test-realm",
        "test-token",
      );

      expect((clientWithSlash as any).baseUrl).toBe("https://bifrost.example.com");
    });
  });
});
