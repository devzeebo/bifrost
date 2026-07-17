import type { CreateRuneRequest, ReadyRune, RuneDetail, UpdateRuneRequest } from "../types.js";
import createDebug from "debug";

const debug = createDebug("bifrost");

export class BifrostHttpClient {
  public readonly baseUrl: string;
  public readonly realm: string;
  public readonly token: string;
  public readonly timeout: number = 30000;

  public constructor(baseUrl: string, realm: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.realm = realm;
    this.token = token;
  }

  public async getReadyRunes(parentId?: string): Promise<ReadyRune[]> {
    const url = parentId ? `/api/ready?parent_id=${encodeURIComponent(parentId)}` : "/api/ready";
    const response = await this.request(url, { method: "GET" });
    return (response as ReadyRune[]) ?? [];
  }

  public async getRune(runeId: string): Promise<RuneDetail> {
    const response = await this.request(`/api/rune?id=${encodeURIComponent(runeId)}`, {
      method: "GET",
    });
    return response as RuneDetail;
  }

  public async createRune(request: CreateRuneRequest): Promise<RuneDetail> {
    const response = await this.request("/api/create-rune", {
      method: "POST",
      body: JSON.stringify(request),
    });
    return response as RuneDetail;
  }

  public async claimRune(runeId: string): Promise<void> {
    await this.request("/api/claim-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId }),
    });
  }

  public async forgeRune(runeId: string): Promise<void> {
    await this.request("/api/forge-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId }),
    });
  }

  public async fulfillRune(runeId: string): Promise<void> {
    await this.request("/api/fulfill-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId }),
    });
  }

  public async failRune(runeId: string, reason: string): Promise<void> {
    await this.request("/api/fail-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId, reason }),
    });
  }

  public async unclaimRune(runeId: string): Promise<void> {
    await this.request("/api/unclaim-rune", {
      method: "POST",
      body: JSON.stringify({ id: runeId }),
    });
  }

  public async addDependency(
    runeId: string,
    targetId: string,
    relationship: string,
  ): Promise<void> {
    await this.request("/api/add-dependency", {
      method: "POST",
      body: JSON.stringify({
        rune_id: runeId,
        target_id: targetId,
        relationship,
      }),
    });
  }

  public async updateRuneState(runeId: string, taskState: Record<string, unknown>): Promise<void> {
    await this.request("/api/update-rune-state", {
      method: "POST",
      body: JSON.stringify({ rune_id: runeId, patch: JSON.stringify(taskState) }),
    });
  }

  public async updateRune(request: UpdateRuneRequest): Promise<void> {
    await this.request("/api/update-rune", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  private async request(endpoint: string, options: RequestInit): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    debug("%s %s", options.method, url);
    if (options.body) {
      debug("Request body: %s", options.body);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: Object.assign(
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
            "X-Bifrost-Realm": this.realm,
          },
          options.headers,
        ),
        signal: controller.signal,
      });

      debug("Response status: %d %s", response.status, response.statusText);

      if (!response.ok) {
        if (response.status === 409) {
          const error = new Error("Rune already claimed");
          (error as { status?: number }).status = 409;
          throw error;
        }
        if (response.status === 404) {
          const error = new Error("Rune not found");
          (error as { status?: number }).status = 404;
          throw error;
        }

        debug("Response body: %s", await response.text());

        throw new Error(`Bifrost API error: ${response.status} ${response.statusText}`);
      }

      if (response.status === 204) {
        return null;
      }

      const data = await response.json();
      debug("Response data: %o", data);
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
