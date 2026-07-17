import type {
  CreateDraftWorkItemInput,
  FlowEntry,
  WorkItem,
  WorkItemDependency,
  WorkItemMetadataPatch,
  WorkItemSource,
  WorkItemStatus,
} from "@bifrost-ai/interfaces-work";
import { isFlowEntry } from "@bifrost-ai/interfaces-work";
import { BifrostHttpClient } from "./client/bifrost-http-client.js";
import { loadConfig } from "./config/config-loader.js";
import { CredentialLoader } from "./config/credential-loader.js";
import type {
  BifrostWorkItemSourceConfig,
  CreateRuneRequest,
  RuneDetail,
  UpdateRuneRequest,
} from "./types.js";
import createDebug from "debug";

const debug = createDebug("bifrost");

export const BIFROST_FLOW_STATE_KEY = "bifrost:flow";

export class BifrostWorkItemSource implements WorkItemSource {
  readonly #config: BifrostWorkItemSourceConfig;
  #client: BifrostHttpClient | null = null;
  #initialized = false;

  public constructor(config: BifrostWorkItemSourceConfig = {}) {
    this.#config = {
      pollInterval: config.pollInterval ?? 1000,
      maxPollInterval: config.maxPollInterval ?? 30000,
    };

    Object.freeze(this.#config);
  }

  async #initialize(): Promise<void> {
    if (this.#initialized) {
      return;
    }

    const bifrostConfig = await loadConfig();

    const credentialLoader = new CredentialLoader();
    const token = await credentialLoader.loadToken(bifrostConfig.url);

    this.#client = new BifrostHttpClient(bifrostConfig.url, bifrostConfig.realm, token);
    this.#initialized = true;

    debug("Configuration:");
    debug("  URL: %s", bifrostConfig.url.replace(/\/\/[^@]+@/, "//***@"));
    debug("  Realm: %s", bifrostConfig.realm);
    debug("  Poll interval: %dms", this.#config.pollInterval);
    debug("  Max poll interval: %dms", this.#config.maxPollInterval);
  }

  async #getClient(): Promise<BifrostHttpClient> {
    await this.#initialize();
    if (!this.#client) {
      throw new Error("Client not initialized");
    }
    return this.#client;
  }

  /* eslint-disable @typescript-eslint/no-await-in-loop, @typescript-eslint/no-continue */
  public async *watchWorkItems(): AsyncGenerator<WorkItem> {
    const client = await this.#getClient();
    const defaultPollInterval = this.#config.pollInterval ?? 1000;
    const maxPollInterval = this.#config.maxPollInterval ?? 30000;
    let pollInterval = defaultPollInterval;
    let pollCount = 0;
    const SAMPLE_RATE = 100;

    debug("Starting poll loop");

    while (true) {
      pollCount += 1;
      const shouldLog = pollCount % SAMPLE_RATE === 0;
      if (shouldLog) {
        debug("Poll #%d (interval: %dms)", pollCount, Math.round(pollInterval));
      }
      try {
        const readyRunes = await client.getReadyRunes();
        if (shouldLog || readyRunes.length > 0) {
          debug("Found %d ready runes", readyRunes.length);
        }

        for (const rune of readyRunes) {
          const agentName = BifrostWorkItemSource.extractAgentName(rune.tags);
          if (!agentName) {
            continue;
          }

          try {
            await client.claimRune(rune.id);
          } catch (error) {
            if ((error as { status?: number }).status === 409) {
              continue;
            }
            throw error;
          }

          const detail = await client.getRune(rune.id);
          pollInterval = defaultPollInterval;

          yield BifrostWorkItemSource.mapToWorkItem(detail, agentName);
        }

        pollInterval = Math.min(pollInterval * 2, maxPollInterval);
        const jitter = pollInterval * 0.2 * (Math.random() * 2 - 1);
        await BifrostWorkItemSource.sleep(pollInterval + jitter);
      } catch (error) {
        console.error(error);
        await BifrostWorkItemSource.sleep(pollInterval);
      }
    }
  }
  /* eslint-enable @typescript-eslint/no-await-in-loop, @typescript-eslint/no-continue */

  public async completeWorkItem(workItemId: string): Promise<void> {
    const client = await this.#getClient();
    await client.fulfillRune(workItemId);
  }

  public async failWorkItem(workItemId: string, error: string): Promise<void> {
    const client = await this.#getClient();
    await client.failRune(workItemId, error);
  }

  public async pauseWorkItem(workItemId: string): Promise<void> {
    const client = await this.#getClient();
    await client.unclaimRune(workItemId);
  }

  public async setState(workItemId: string, state: Record<string, unknown>): Promise<void> {
    try {
      const client = await this.#getClient();
      await client.updateRuneState(workItemId, state);
    } catch (err) {
      console.error(`Failed to update state for work item ${workItemId}:`, err);
    }
  }

  public async updateWorkItemMetadata(
    workItemId: string,
    patch: WorkItemMetadataPatch,
  ): Promise<void> {
    const client = await this.#getClient();
    await client.updateRune(BifrostWorkItemSource.buildUpdateRuneRequest(workItemId, patch));
  }

  public async createDraftWorkItem(input: CreateDraftWorkItemInput): Promise<string> {
    const client = await this.#getClient();
    const request = BifrostWorkItemSource.buildCreateRuneRequest(input);
    const detail = await client.createRune(request);
    await client.updateRuneState(detail.id, {
      ...input.state,
      [BIFROST_FLOW_STATE_KEY]: input.flow ?? [],
    });
    return detail.id;
  }

  public async startWorkItem(workItemId: string): Promise<void> {
    const client = await this.#getClient();
    await client.forgeRune(workItemId);
  }

  public async setDependency(
    blockerId: string,
    relationship: "blocks",
    blockedId: string,
  ): Promise<void> {
    const client = await this.#getClient();
    await client.addDependency(blockerId, blockedId, relationship);
  }

  public async getDependencies(workItemId: string): Promise<WorkItemDependency[]> {
    const client = await this.#getClient();
    const detail = await client.getRune(workItemId);
    return detail.dependencies.map((dep) => ({
      workItemId: dep.target_id,
      type: dep.relationship,
    }));
  }

  public async getWorkItemStatus(workItemId: string): Promise<WorkItemStatus> {
    const client = await this.#getClient();
    const detail = await client.getRune(workItemId);
    return BifrostWorkItemSource.mapRuneStatus(detail.status);
  }

  public static mapRuneStatus(status: string): WorkItemStatus {
    switch (status) {
      case "draft":
        return "draft";
      case "open":
      case "claimed":
        return "live";
      case "fulfilled":
        return "completed";
      case "sealed":
      case "shattered":
        return "failed";
      default:
        return "live";
    }
  }

  public static extractAgentName(tags: string[]): string | null {
    const agentTag = tags.find((tag) => tag.startsWith("agent:"));
    if (!agentTag) {
      return null;
    }
    return agentTag.slice(6);
  }

  public static extractAgentKind(tags: string[]): string {
    const kindTag = tags.find((tag) => tag.startsWith("kind:"));
    if (!kindTag) {
      return "task";
    }
    return kindTag.slice(5);
  }

  public static extractFlowFromState(state: Record<string, unknown>): FlowEntry[] {
    const flow = state[BIFROST_FLOW_STATE_KEY];
    if (!Array.isArray(flow)) {
      return [];
    }
    return flow.filter((entry) => isFlowEntry(entry));
  }

  public static buildCreateRuneRequest(input: CreateDraftWorkItemInput): CreateRuneRequest {
    const metadata = input.metadata ?? {};
    const title =
      typeof metadata.title === "string" && metadata.title.length > 0 ? metadata.title : input.name;
    const description = typeof metadata.description === "string" ? metadata.description : undefined;
    const priority = typeof metadata.priority === "number" ? metadata.priority : 1;
    const parentId = typeof metadata.parentId === "string" ? metadata.parentId : undefined;
    const branch = typeof metadata.branch === "string" ? metadata.branch : undefined;
    const type = typeof metadata.type === "string" ? metadata.type : undefined;

    const tags = Array.isArray(metadata.tags) ? [...(metadata.tags as string[])] : ([] as string[]);

    tags.push(`agent:${input.name}`);
    tags.push(`kind:${input.kind}`);

    return {
      title,
      description,
      priority,
      parent_id: parentId,
      branch,
      tags: tags.length > 0 ? tags : undefined,
      type,
    };
  }

  public static buildUpdateRuneRequest(
    workItemId: string,
    patch: WorkItemMetadataPatch,
  ): UpdateRuneRequest {
    const request: UpdateRuneRequest = { id: workItemId };
    if (typeof patch.title === "string") {
      request.title = patch.title;
    }
    if (typeof patch.description === "string") {
      request.description = patch.description;
    }
    if (typeof patch.priority === "number") {
      request.priority = patch.priority;
    }
    if (typeof patch.branch === "string") {
      request.branch = patch.branch;
    }
    if (Array.isArray(patch.tags)) {
      request.tags = patch.tags;
    }
    return request;
  }

  public static mapToWorkItem(rune: RuneDetail, agentName: string): WorkItem {
    return {
      workItemId: rune.id,
      kind: BifrostWorkItemSource.extractAgentKind(rune.tags ?? []),
      name: agentName,
      flow: BifrostWorkItemSource.extractFlowFromState(rune.state),
      state: { ...rune.state },
      metadata: rune as unknown as Record<string, unknown>,
    };
  }

  public static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
