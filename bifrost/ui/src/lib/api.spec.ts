import { describe, expect, vi, beforeEach, afterEach, test } from "vitest";
import { ApiClient, ApiError } from "./api";

describe("ApiClient", () => {
  let apiClient: ApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiClient = new ApiClient();
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("login", () => {
    test("sends POST request to /api/ui/login", async () => {
      const loginRequest = { pat: "test-pat-token" };
      const sessionInfo = {
        account_id: "123",
        username: "testuser",
        realms: [],
        roles: {},
        is_admin: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sessionInfo,
      });

      const result = await apiClient.login(loginRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/ui/login",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(loginRequest),
          credentials: "include",
        })
      );
      expect(result).toEqual(sessionInfo);
    });

    test("throws ApiError on failed request", async () => {
      const loginRequest = { pat: "invalid-pat-token" };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: "Invalid credentials" }),
      });

      await expect(apiClient.login(loginRequest)).rejects.toThrow(ApiError);
    });
  });

  describe("logout", () => {
    test("sends POST request to /api/ui/logout", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await apiClient.logout();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/ui/logout",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );
    });
  });

  describe("getSession", () => {
    test("sends GET request to /api/ui/session", async () => {
      const sessionInfo = {
        account_id: "123",
        username: "testuser",
        realms: [],
        roles: {},
        is_admin: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sessionInfo,
      });

      const result = await apiClient.getSession();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/ui/session",
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );
      expect(result).toEqual(sessionInfo);
    });

    test("returns null when session is not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      const result = await apiClient.getSession();

      expect(result).toBeNull();
    });
  });

  describe("checkOnboarding", () => {
    test("sends GET request to /api/ui/check-onboarding", async () => {
      const onboardingResponse = {
        needs_onboarding: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => onboardingResponse,
      });

      const result = await apiClient.checkOnboarding();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/ui/check-onboarding",
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );
      expect(result).toEqual(onboardingResponse);
    });
  });

  describe("createAdmin", () => {
    test("sends POST request to /api/ui/onboarding/create-admin", async () => {
      const createAdminRequest = {
        username: "admin",
        realm_name: "default-realm",
      };
      const createAdminResponse = {
        account_id: "123",
        pat: "test-pat",
        realm_id: "realm-123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createAdminResponse,
      });

      const result = await apiClient.createAdmin(createAdminRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/ui/onboarding/create-admin",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(createAdminRequest),
          credentials: "include",
        })
      );
      expect(result).toEqual(createAdminResponse);
    });
  });

  describe("getRunes", () => {
    test("sends GET request to /api/runes with realm header", async () => {
      const runes = [
        { id: "1", title: "Rune 1", status: "open" as const, priority: 1, realm_id: "test-realm", created_at: "", updated_at: "", tags: [] },
        { id: "2", title: "Rune 2", status: "open" as const, priority: 1, realm_id: "test-realm", created_at: "", updated_at: "", tags: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => runes,
      });

      const result = await apiClient.getRunes("test-realm");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/runes",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "X-Bifrost-Realm": "test-realm",
          }),
          credentials: "include",
        })
      );
      expect(result).toEqual(runes);
    });

  });

  describe("getRunes tag normalization", () => {
    test("normalizes tags to lowercase", async () => {
      const runes = [
        {
          id: "1",
          title: "Rune 1",
          status: "open" as const,
          priority: 1,
          realm_id: "test-realm",
          created_at: "",
          updated_at: "",
          tags: ["Backend", " urgent "],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => runes,
      });

      const result = await apiClient.getRunes("test-realm");
      expect(result[0].tags).toEqual(["backend", "urgent"]);
    });
  });

  describe("getRune", () => {
    test("sends GET request to /api/rune with realm header", async () => {
      const rune = {
        id: "1",
        title: "Rune 1",
        status: "open" as const,
        priority: 1,
        realm_id: "test-realm",
        created_at: "",
        updated_at: "",
        description: "Test rune",
        dependencies: [],
        tags: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => rune,
      });

      const result = await apiClient.getRune("test-realm", "1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/rune?id=1",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "X-Bifrost-Realm": "test-realm",
          }),
          credentials: "include",
        })
      );
      expect(result).toEqual(rune);
    });

  });

  describe("createRune", () => {
    test("sends POST request to /api/create-rune", async () => {
      const createRuneRequest = {
        title: "New Rune",
        description: "Test description",
        priority: 2,
        branch: "",
      };
      const rune = {
        id: "1",
        ...createRuneRequest,
        status: "open" as const,
        priority: 0,
        created_at: "",
        updated_at: "",
        dependencies: [],
        tags: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => rune,
      });

      const result = await apiClient.createRune(createRuneRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/create-rune",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(createRuneRequest),
          credentials: "include",
        })
      );
      expect(result).toEqual(rune);
    });
  });

  describe("addDependency", () => {
    test("sends POST request to /api/add-dependency", async () => {
      const request = {
        rune_id: "bf-new",
        target_id: "bf-existing",
        relationship: "blocked_by",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await apiClient.addDependency(request);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/add-dependency",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(request),
          credentials: "include",
        })
      );
    });
  });

  describe("updateRune", () => {
    test("sends POST request to /api/update-rune with command payload", async () => {
      const updates = { title: "Updated Rune", status: "in_progress" as const };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await apiClient.updateRune("test-realm", "1", updates);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/update-rune",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ id: "1", title: "Updated Rune" }),
          headers: expect.objectContaining({
            "X-Bifrost-Realm": "test-realm",
          }),
          credentials: "include",
        })
      );
    });

    test("includes lowercase tags in update command", async () => {
      const updates = { tags: ["Backend", " urgent "] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await apiClient.updateRune("test-realm", "1", updates);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/update-rune",
        expect.objectContaining({
          body: JSON.stringify({ id: "1", tags: ["backend", "urgent"] }),
        })
      );
    });
  });

  describe("deleteRune", () => {
    test("sends POST request to /api/shatter-rune", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await apiClient.deleteRune("test-realm", "1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/shatter-rune",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ id: "1" }),
          headers: expect.objectContaining({
            "X-Bifrost-Realm": "test-realm",
          }),
          credentials: "include",
        })
      );
    });
  });

  describe("getRealms", () => {
    test("sends GET request to /api/realms", async () => {
      const realms = [
        { id: "1", name: "Realm 1" },
        { id: "2", name: "Realm 2" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => realms,
      });

      const result = await apiClient.getRealms();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/realms",
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );
      expect(result).toEqual(realms);
    });
  });

  describe("getRealm", () => {
    test("sends GET request to /api/realm?id={realmId}", async () => {
      const realm = {
        id: "1",
        name: "Realm 1",
        description: "Test realm",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => realm,
      });

      const result = await apiClient.getRealm("1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/realm?id=1",
        expect.objectContaining({
          method: "GET",
          credentials: "include",
          headers: expect.objectContaining({
            "X-Bifrost-Realm": "1",
          }),
        })
      );
      expect(result).toEqual(realm);
    });
  });

  describe("createRealm", () => {
    test("sends POST request to /api/create-realm", async () => {
      const createRealmRequest = {
        name: "New Realm",
        description: "Test realm",
      };
      const response = { realm_id: "1" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response,
      });

      const result = await apiClient.createRealm(createRealmRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/create-realm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(createRealmRequest),
          credentials: "include",
        })
      );
      expect(result).toEqual({ id: "1", name: "New Realm" });
    });
  });

  describe("getAccounts", () => {
    test("sends GET request to /api/realms/{realmId}/accounts", async () => {
      const accounts = [
        { id: "1", username: "user1" },
        { id: "2", username: "user2" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => accounts,
      });

      const result = await apiClient.getAccounts("test-realm");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/realms/test-realm/accounts",
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );
      expect(result).toEqual(accounts);
    });
  });

  describe("getAccount", () => {
    test("sends GET request to /api/realms/{realmId}/accounts/{accountId}", async () => {
      const account = {
        id: "1",
        username: "user1",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => account,
      });

      const result = await apiClient.getAccount("test-realm", "1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/realms/test-realm/accounts/1",
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );
      expect(result).toEqual(account);
    });
  });

  describe("createAccount", () => {
    test("sends POST request to /api/realms/{realmId}/accounts", async () => {
      const createAccountRequest = { username: "newuser" };
      const account = {
        id: "1",
        ...createAccountRequest,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => account,
      });

      const result = await apiClient.createAccount("test-realm", createAccountRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/realms/test-realm/accounts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(createAccountRequest),
          credentials: "include",
        })
      );
      expect(result).toEqual(account);
    });
  });

  describe("getAdminAccounts", () => {
    test("sends GET request to /api/accounts", async () => {
      const adminAccounts = [
        { account_id: "1", username: "admin1" },
        { account_id: "2", username: "admin2" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => adminAccounts,
      });

      const result = await apiClient.getAdminAccounts();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/accounts",
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );
      expect(result).toEqual(adminAccounts);
    });
  });

  describe("createAdminAccount", () => {
    test("sends POST request to /api/create-account", async () => {
      const response = {
        account_id: "123",
        pat: "test-pat",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response,
      });

      const result = await apiClient.createAdminAccount("newadmin");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/create-account",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ username: "newadmin" }),
          credentials: "include",
        })
      );
      expect(result).toEqual(response);
    });
  });

  describe("grantRealmAccess", () => {
    test("sends POST request to /api/grant-realm", async () => {
      const request = {
        account_id: "acct-1",
        realm_id: "realm-1",
        role: "member",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await apiClient.grantRealmAccess(request);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/grant-realm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(request),
          credentials: "include",
        })
      );
    });
  });

  describe("createPAT", () => {
    test("sends POST request to /api/create-pat", async () => {
      const response = {
        pat: "new-pat-token",
        pat_id: "pat-123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response,
      });

      const result = await apiClient.createPAT("123");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/create-pat",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ account_id: "123" }),
          credentials: "include",
        })
      );
      expect(result).toEqual(response);
    });
  });

  describe("getPATs", () => {
    test("sends GET request to /api/pats with account_id query param", async () => {
      const pats = [
        { id: "1", pat: "pat1" },
        { id: "2", pat: "pat2" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => pats,
      });

      const result = await apiClient.getPATs("123");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/pats?account_id=123",
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );
      expect(result).toEqual(pats);
    });
  });

  describe("revokePAT", () => {
    test("sends POST request to /api/revoke-pat", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await apiClient.revokePAT("123", "pat-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/revoke-pat",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ account_id: "123", pat_id: "pat-1" }),
          credentials: "include",
        })
      );
    });
  });

  describe("Error Handling", () => {
    test("throws ApiError with status and message on non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ error: "Resource not found" }),
      });

      try {
        await apiClient.getRealm("nonexistent");
        throw new Error("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
        expect((error as ApiError).message).toBe("Request failed: Internal Server Error");
        expect((error as ApiError).data).toEqual({ error: "Resource not found" });
      }
    });

    test("handles non-JSON error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      try {
        await apiClient.getRealm("error");
        throw new Error("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).data).toBeUndefined();
      }
    });
  });

  describe("Base URL", () => {
    test("uses custom base URL when provided", async () => {
      const customClient = new ApiClient("https://custom.example.com");
      const realm = { id: "1", name: "Realm 1" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => realm,
      });

      await customClient.getRealm("1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.example.com/api/realm?id=1",
        expect.any(Object)
      );
    });

    test("uses empty base URL by default", async () => {
      const realm = { id: "1", name: "Realm 1" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => realm,
      });

      await apiClient.getRealm("1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/realm?id=1",
        expect.any(Object)
      );
    });
  });
});
