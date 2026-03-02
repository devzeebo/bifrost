import type {
  SessionInfo,
  LoginRequest,
  OnboardingCheckResponse,
  CreateAdminRequest,
  CreateAdminResponse,
} from "../types/session";
import type {
  RuneListItem,
  RuneDetail,
  CreateRuneRequest,
  RuneRelationship,
} from "../types/rune";
import type {
  RealmListEntry,
  RealmDetail,
  CreateRealmRequest,
  CreateRealmResponse,
} from "../types/realm";
import type { AccountListEntry, AdminAccountEntry, PatEntry } from "../types/account";

const API_PREFIX = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const apiUrl = `${this.baseUrl}${API_PREFIX}${endpoint}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const makeRequest = (url: string) =>
      fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });

    let response = await makeRequest(apiUrl);
    if (!response.ok) {
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = undefined;
      }
      throw new ApiError(
        response.status,
        `Request failed: ${response.statusText}`,
        data
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  private withRealmHeader(realmId?: string, headers?: HeadersInit): HeadersInit {
    if (!realmId) {
      return headers ?? {};
    }

    return {
      ...(headers ?? {}),
      "X-Bifrost-Realm": realmId,
    };
  }

  private normalizeRuneDetail(raw: RuneDetail | (Partial<RuneDetail> & { id: string })): RuneDetail {
    const normalizeDependencies = (dependencies: unknown): RuneRelationship[] => {
      if (!Array.isArray(dependencies)) {
        return [];
      }

      return dependencies.flatMap((dependency) => {
        if (typeof dependency === "string") {
          return [{ target_id: dependency, relationship: "relates_to" }];
        }

        if (
          typeof dependency === "object" &&
          dependency !== null &&
          "target_id" in dependency &&
          typeof (dependency as { target_id?: unknown }).target_id === "string"
        ) {
          const relation =
            "relationship" in dependency &&
            typeof (dependency as { relationship?: unknown }).relationship === "string"
              ? (dependency as { relationship: string }).relationship
              : "relates_to";

          return [
            {
              target_id: (dependency as { target_id: string }).target_id,
              relationship: relation,
            },
          ];
        }

        return [];
      });
    };

    return {
      id: raw.id,
      title: raw.title ?? "",
      status: raw.status ?? "draft",
      priority: raw.priority ?? 1,
      claimant:
        typeof raw.claimant === "string" && raw.claimant !== "<nil>" ? raw.claimant : undefined,
      claimant_username:
        typeof raw.claimant_username === "string" && raw.claimant_username !== "<nil>"
          ? raw.claimant_username
          : undefined,
      realm_id: raw.realm_id ?? "",
      created_at: raw.created_at ?? new Date(0).toISOString(),
      updated_at: raw.updated_at ?? new Date(0).toISOString(),
      description: raw.description ?? "",
      assignee_id: raw.assignee_id,
      saga_id: raw.saga_id,
      dependencies: normalizeDependencies(raw.dependencies),
      tags: Array.isArray(raw.tags) ? raw.tags : [],
    };
  }

  // Session / Auth
  async login(request: LoginRequest): Promise<SessionInfo> {
    return this.request<SessionInfo>("/ui/login", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async logout(): Promise<void> {
    return this.request("/ui/logout", {
      method: "POST",
    });
  }

  async getSession(): Promise<SessionInfo | null> {
    return this.request<SessionInfo | null>("/ui/session", {
      method: "GET",
    });
  }

  async checkOnboarding(): Promise<OnboardingCheckResponse> {
    return this.request<OnboardingCheckResponse>("/ui/check-onboarding", {
      method: "GET",
    });
  }

  // Onboarding
  async createAdmin(request: CreateAdminRequest): Promise<CreateAdminResponse> {
    return this.request<CreateAdminResponse>("/ui/onboarding/create-admin", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Runes
  async getRunes(realmId: string): Promise<RuneListItem[]> {
    try {
      return await this.request<RuneListItem[]>("/runes", {
        method: "GET",
        headers: this.withRealmHeader(realmId),
      });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }

      return this.request<RuneListItem[]>(`/realms/${realmId}/runes`, {
        method: "GET",
      });
    }
  }

  async getRune(realmId: string, runeId: string): Promise<RuneDetail> {
    try {
      const detail = await this.request<Partial<RuneDetail> & { id: string }>(
        `/rune?id=${encodeURIComponent(runeId)}`,
        {
          method: "GET",
          headers: this.withRealmHeader(realmId),
        }
      );
      return this.normalizeRuneDetail(detail);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }

      const detail = await this.request<RuneDetail>(`/realms/${realmId}/runes/${runeId}`, {
        method: "GET",
      });
      return this.normalizeRuneDetail(detail);
    }
  }

  async createRune(request: CreateRuneRequest, realmId?: string): Promise<RuneDetail> {
    return this.request<RuneDetail>("/create-rune", {
      method: "POST",
      body: JSON.stringify(request),
      headers: this.withRealmHeader(realmId),
    });
  }

  async addDependency(request: {
    rune_id: string;
    target_id: string;
    relationship: string;
  }, realmId?: string): Promise<void> {
    return this.request("/add-dependency", {
      method: "POST",
      body: JSON.stringify(request),
      headers: this.withRealmHeader(realmId),
    });
  }

  async removeDependency(request: {
    rune_id: string;
    target_id: string;
    relationship: string;
  }, realmId?: string): Promise<void> {
    return this.request("/remove-dependency", {
      method: "POST",
      body: JSON.stringify(request),
      headers: this.withRealmHeader(realmId),
    });
  }

  async forgeRune(runeId: string, realmId?: string): Promise<void> {
    await this.request<void>("/forge-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId }),
      headers: this.withRealmHeader(realmId),
    });
  }

  async claimRune(runeId: string, claimant: string, realmId?: string): Promise<void> {
    await this.request<void>("/claim-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId, claimant }),
      headers: this.withRealmHeader(realmId),
    });
  }

  async fulfillRune(runeId: string, realmId?: string): Promise<void> {
    await this.request<void>("/fulfill-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId }),
      headers: this.withRealmHeader(realmId),
    });
  }

  async sealRune(runeId: string, reason: string, realmId?: string): Promise<void> {
    await this.request<void>("/seal-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId, reason }),
      headers: this.withRealmHeader(realmId),
    });
  }

  async shatterRune(runeId: string, realmId?: string): Promise<void> {
    await this.request<void>("/shatter-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId }),
      headers: this.withRealmHeader(realmId),
    });
  }

  async updateRune(
    realmId: string,
    runeId: string,
    updates: Partial<RuneDetail>
  ): Promise<void> {
    const command: {
      id: string;
      title?: string;
      description?: string;
      priority?: number;
      branch?: string;
    } = {
      id: runeId,
    };

    if (typeof updates.title === "string") {
      command.title = updates.title;
    }
    if (typeof updates.description === "string") {
      command.description = updates.description;
    }
    if (typeof updates.priority === "number") {
      command.priority = updates.priority;
    }
    if (typeof updates.branch === "string") {
      command.branch = updates.branch;
    }

    await this.request<void>("/update-rune", {
      method: "POST",
      body: JSON.stringify(command),
      headers: this.withRealmHeader(realmId),
    });
  }

  async deleteRune(realmId: string, runeId: string): Promise<void> {
    await this.shatterRune(runeId, realmId);
  }

  // Realms
  async getRealms(): Promise<RealmListEntry[]> {
    return this.request<RealmListEntry[]>("/realms", {
      method: "GET",
    });
  }

  async getRealm(realmId: string): Promise<RealmDetail> {
    try {
      return await this.request<RealmDetail>(`/realm?id=${encodeURIComponent(realmId)}`, {
        method: "GET",
        headers: this.withRealmHeader(realmId),
      });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }

      return this.request<RealmDetail>(`/realms/${realmId}`, {
        method: "GET",
      });
    }
  }

  async createRealm(request: CreateRealmRequest): Promise<CreateRealmResponse> {
    const response = await this.request<{ realm_id?: string }>("/create-realm", {
      method: "POST",
      body: JSON.stringify(request),
    });

    if (typeof response.realm_id !== "string" || response.realm_id.length === 0) {
      throw new Error("Realm creation response missing realm_id");
    }

    return {
      id: response.realm_id,
      name: request.name,
    };
  }

  async suspendRealm(request: { realm_id: string; reason?: string }, realmId?: string): Promise<void> {
    void realmId;
    return this.request("/suspend-realm", {
      method: "POST",
      body: JSON.stringify(request),
      headers: this.withRealmHeader("_admin"),
    });
  }

  async assignRole(
    request: { account_id: string; realm_id: string; role: string },
    realmId?: string
  ): Promise<void> {
    return this.request("/assign-role", {
      method: "POST",
      body: JSON.stringify(request),
      headers: this.withRealmHeader(realmId ?? request.realm_id),
    });
  }

  async revokeRole(
    request: { account_id: string; realm_id: string },
    realmId?: string
  ): Promise<void> {
    return this.request("/revoke-role", {
      method: "POST",
      body: JSON.stringify(request),
      headers: this.withRealmHeader(realmId ?? request.realm_id),
    });
  }

  // Accounts
  async getAccounts(realmId: string): Promise<AccountListEntry[]> {
    return this.request<AccountListEntry[]>(`/realms/${realmId}/accounts`, {
      method: "GET",
    });
  }

  async getAccount(realmId: string, accountId: string): Promise<AccountListEntry> {
    return this.request<AccountListEntry>(
      `/realms/${realmId}/accounts/${accountId}`,
      {
        method: "GET",
      }
    );
  }

  async createAccount(
    realmId: string,
    request: { username: string }
  ): Promise<AccountListEntry> {
    return this.request<AccountListEntry>(`/realms/${realmId}/accounts`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Admin Accounts (sysadmin only)
  async getAdminAccounts(): Promise<AdminAccountEntry[]> {
    return this.request<AdminAccountEntry[]>("/accounts", {
      method: "GET",
    });
  }


  async createAdminAccount(username: string): Promise<{ account_id: string; pat: string }> {
    return this.request<{ account_id: string; pat: string }>("/create-account", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
  }

  async grantRealmAccess(request: {
    account_id: string;
    realm_id: string;
    role: string;
  }): Promise<void> {
    return this.request("/grant-realm", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // PAT Management (admin only)
  async createPAT(accountId: string): Promise<{ pat: string }> {
    return this.request<{ pat: string }>("/create-pat", {
      method: "POST",
      body: JSON.stringify({ account_id: accountId }),
    });
  }

  async getPATs(accountId: string): Promise<PatEntry[]> {
    return this.request<PatEntry[]>(`/pats?account_id=${accountId}`, {
      method: "GET",
    });
  }

  async revokePAT(accountId: string, patId: string): Promise<void> {
    return this.request("/revoke-pat", {
      method: "POST",
      body: JSON.stringify({ account_id: accountId, pat_id: patId }),
    });
  }
}

export const api = new ApiClient();
