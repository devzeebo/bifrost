import type {
  CreateAdminRequest,
  CreateAdminResponse,
  LoginRequest,
  OnboardingCheckResponse,
  SessionInfo,
} from "../types/session";
import type { CreateRuneRequest, RuneDetail, RuneListItem, RuneRelationship } from "../types/rune";
import type {
  CreateRealmRequest,
  CreateRealmResponse,
  RealmDetail,
  RealmListEntry,
} from "../types/realm";
import type { AccountListEntry, AdminAccountEntry, PatEntry } from "../types/account";

const API_PREFIX = "/api";

export class ApiError extends Error {
  public status: number;
  public data?: unknown;

  public constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "ApiError";
  }
}

export class ApiClient {
  private baseUrl: string;

  public constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  private async request<TResult>(endpoint: string, options: RequestInit = {}): Promise<TResult> {
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

    const response = await makeRequest(apiUrl);
    if (!response.ok) {
      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        // data remains null
      }
      throw new ApiError(response.status, `Request failed: ${response.statusText}`, data);
    }

    if (response.status === 204) {
      return null as TResult;
    }

    return response.json();
  }

  private static withRealmHeader(realmId?: string, headers?: HeadersInit): HeadersInit {
    if (!realmId) {
      return headers ?? {};
    }

    return {
      ...(headers ?? {}),
      "X-Bifrost-Realm": realmId,
    };
  }

  private static normalizeRuneDetail(
    raw: RuneDetail | (Partial<RuneDetail> & { id: string }),
  ): RuneDetail {
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
        typeof raw.claimant === "string" && raw.claimant !== "<nil>" ? raw.claimant : void 0,
      claimant_username:
        typeof raw.claimant_username === "string" && raw.claimant_username !== "<nil>"
          ? raw.claimant_username
          : void 0,
      realm_id: raw.realm_id ?? "",
      created_at: raw.created_at ?? new Date(0).toISOString(),
      updated_at: raw.updated_at ?? new Date(0).toISOString(),
      description: raw.description ?? "",
      assignee_id: raw.assignee_id,
      saga_id: raw.saga_id,
      dependencies: normalizeDependencies(raw.dependencies),
      tags: Array.isArray(raw.tags)
        ? raw.tags
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag.length > 0)
        : [],
    };
  }

  private static normalizeRuneListItem(raw: RuneListItem): RuneListItem {
    return {
      ...raw,
      tags: Array.isArray(raw.tags)
        ? raw.tags
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag.length > 0)
        : [],
    };
  }

  // Session / Auth
  public async login(request: LoginRequest): Promise<SessionInfo> {
    return this.request<SessionInfo>("/ui/login", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  public async logout(): Promise<void> {
    return this.request("/ui/logout", {
      method: "POST",
    });
  }

  public async getSession(): Promise<SessionInfo | null> {
    return this.request<SessionInfo | null>("/ui/session", {
      method: "GET",
    });
  }

  public async checkOnboarding(): Promise<OnboardingCheckResponse> {
    return this.request<OnboardingCheckResponse>("/ui/check-onboarding", {
      method: "GET",
    });
  }

  // Onboarding
  public async createAdmin(request: CreateAdminRequest): Promise<CreateAdminResponse> {
    return this.request<CreateAdminResponse>("/ui/onboarding/create-admin", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Runes
  public async getRunes(realmId: string): Promise<RuneListItem[]> {
    try {
      const items = await this.request<RuneListItem[]>("/runes", {
        method: "GET",
        headers: ApiClient.withRealmHeader(realmId),
      });
      return items.map((item) => ApiClient.normalizeRuneListItem(item));
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }

      const items = await this.request<RuneListItem[]>(`/realms/${realmId}/runes`, {
        method: "GET",
      });
      return items.map((item) => ApiClient.normalizeRuneListItem(item));
    }
  }

  public async getRune(realmId: string, runeId: string): Promise<RuneDetail> {
    try {
      const detail = await this.request<Partial<RuneDetail> & { id: string }>(
        `/rune?id=${encodeURIComponent(runeId)}`,
        {
          method: "GET",
          headers: ApiClient.withRealmHeader(realmId),
        },
      );
      return ApiClient.normalizeRuneDetail(detail);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }

      const detail = await this.request<RuneDetail>(`/realms/${realmId}/runes/${runeId}`, {
        method: "GET",
      });
      return ApiClient.normalizeRuneDetail(detail);
    }
  }

  public async createRune(request: CreateRuneRequest, realmId?: string): Promise<RuneDetail> {
    return this.request<RuneDetail>("/create-rune", {
      method: "POST",
      body: JSON.stringify(request),
      headers: ApiClient.withRealmHeader(realmId),
    });
  }

  public async addDependency(
    request: {
      rune_id: string;
      target_id: string;
      relationship: string;
    },
    realmId?: string,
  ): Promise<void> {
    return this.request("/add-dependency", {
      method: "POST",
      body: JSON.stringify(request),
      headers: ApiClient.withRealmHeader(realmId),
    });
  }

  public async removeDependency(
    request: {
      rune_id: string;
      target_id: string;
      relationship: string;
    },
    realmId?: string,
  ): Promise<void> {
    return this.request("/remove-dependency", {
      method: "POST",
      body: JSON.stringify(request),
      headers: ApiClient.withRealmHeader(realmId),
    });
  }

  public async forgeRune(runeId: string, realmId?: string): Promise<void> {
    await this.request("/forge-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId }),
      headers: ApiClient.withRealmHeader(realmId),
    });
  }

  public async claimRune(runeId: string, claimant: string, realmId?: string): Promise<void> {
    await this.request("/claim-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId, claimant }),
      headers: ApiClient.withRealmHeader(realmId),
    });
  }

  public async fulfillRune(runeId: string, realmId?: string): Promise<void> {
    await this.request("/fulfill-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId }),
      headers: ApiClient.withRealmHeader(realmId),
    });
  }

  public async sealRune(runeId: string, reason: string, realmId?: string): Promise<void> {
    await this.request("/seal-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId, reason }),
      headers: ApiClient.withRealmHeader(realmId),
    });
  }

  public async shatterRune(runeId: string, realmId?: string): Promise<void> {
    await this.request("/shatter-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId }),
      headers: ApiClient.withRealmHeader(realmId),
    });
  }

  public async updateRune(
    realmId: string,
    runeId: string,
    updates: Partial<RuneDetail>,
  ): Promise<void> {
    const command: {
      id: string;
      title?: string;
      description?: string;
      priority?: number;
      branch?: string;
      tags?: string[];
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
    if (Array.isArray(updates.tags)) {
      command.tags = updates.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);
    }

    await this.request("/update-rune", {
      method: "POST",
      body: JSON.stringify(command),
      headers: ApiClient.withRealmHeader(realmId),
    });
  }

  public async deleteRune(realmId: string, runeId: string): Promise<void> {
    await this.shatterRune(runeId, realmId);
  }

  // Realms
  public async getRealms(includeSuspended = false): Promise<RealmListEntry[]> {
    const url = includeSuspended ? "/realms?include_suspended=true" : "/realms";
    return this.request<RealmListEntry[]>(url, {
      method: "GET",
    });
  }

  public async getRealm(realmId: string): Promise<RealmDetail> {
    try {
      return await this.request<RealmDetail>(`/realm?id=${encodeURIComponent(realmId)}`, {
        method: "GET",
        headers: ApiClient.withRealmHeader(realmId),
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

  public async createRealm(request: CreateRealmRequest): Promise<CreateRealmResponse> {
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

  public async suspendRealm(
    request: { realm_id: string; reason?: string },
    realmId?: string,
  ): Promise<void> {
    void realmId;
    return this.request("/suspend-realm", {
      method: "POST",
      body: JSON.stringify(request),
      headers: ApiClient.withRealmHeader("_admin"),
    });
  }

  public async assignRole(
    request: { account_id: string; realm_id: string; role: string },
    realmId?: string,
  ): Promise<void> {
    return this.request("/assign-role", {
      method: "POST",
      body: JSON.stringify(request),
      headers: ApiClient.withRealmHeader(realmId ?? request.realm_id),
    });
  }

  public async revokeRole(
    request: { account_id: string; realm_id: string },
    realmId?: string,
  ): Promise<void> {
    return this.request("/revoke-role", {
      method: "POST",
      body: JSON.stringify(request),
      headers: ApiClient.withRealmHeader(realmId ?? request.realm_id),
    });
  }

  // Accounts
  public async getAccounts(realmId: string): Promise<AccountListEntry[]> {
    return this.request<AccountListEntry[]>(`/realms/${realmId}/accounts`, {
      method: "GET",
    });
  }

  public async getAccount(realmId: string, accountId: string): Promise<AccountListEntry> {
    return this.request<AccountListEntry>(`/realms/${realmId}/accounts/${accountId}`, {
      method: "GET",
    });
  }

  public async createAccount(
    realmId: string,
    request: { username: string },
  ): Promise<AccountListEntry> {
    return this.request<AccountListEntry>(`/realms/${realmId}/accounts`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Admin Accounts (sysadmin only)
  public async getAdminAccounts(): Promise<AdminAccountEntry[]> {
    return this.request<AdminAccountEntry[]>("/accounts", {
      method: "GET",
    });
  }

  public async getAdminAccount(accountId: string): Promise<AdminAccountEntry> {
    return this.request<AdminAccountEntry>(`/account?id=${encodeURIComponent(accountId)}`, {
      method: "GET",
    });
  }

  public async createAdminAccount(username: string): Promise<{ account_id: string; pat: string }> {
    return this.request<{ account_id: string; pat: string }>("/create-account", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
  }

  public async grantRealmAccess(request: {
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
  public async createPAT(
    accountId: string,
    label?: string,
  ): Promise<{ pat: string; pat_id: string }> {
    return this.request<{ pat: string; pat_id: string }>("/create-pat", {
      method: "POST",
      body: JSON.stringify({ account_id: accountId, label }),
    });
  }

  public async getPATs(accountId: string): Promise<PatEntry[]> {
    return this.request<PatEntry[]>(`/pats?account_id=${accountId}`, {
      method: "GET",
    });
  }

  public async revokePAT(accountId: string, patId: string): Promise<void> {
    return this.request("/revoke-pat", {
      method: "POST",
      body: JSON.stringify({ account_id: accountId, pat_id: patId }),
    });
  }

  public async suspendAccount(accountId: string, suspend = true): Promise<void> {
    return this.request("/suspend-account", {
      method: "POST",
      body: JSON.stringify({ id: accountId, suspend }),
    });
  }
}

export const api = new ApiClient();
