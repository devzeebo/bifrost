import type {
  CreateDraftWorkItemInput,
  WorkItem,
  WorkItemDependency,
  WorkItemSource,
} from "@bifrost-ai/interfaces-work";
import { BifrostHttpClient } from "./client/bifrost-http-client.js";
import { loadConfig } from "./config/config-loader.js";
import { CredentialLoader } from "./config/credential-loader.js";
import type { BifrostWorkItemSourceConfig, CreateRuneRequest, RuneDetail } from "./types.js";
import createDebug from "debug";

const debug = createDebug("bifrost");

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

  public async createDraftWorkItem(input: CreateDraftWorkItemInput): Promise<string> {
    const client = await this.#getClient();
    const request = BifrostWorkItemSource.buildCreateRuneRequest(input);
    const detail = await client.createRune(request);
    return detail.id;
  }

  public async startWorkItem(workItemId: string): Promise<void> {
    const client = await this.#getClient();
    await client.forgeRune(workItemId);
  }

  public async setDependency(
    workItemId: string,
    dependsOnWorkItemId: string,
    type = "blocks",
  ): Promise<void> {
    const client = await this.#getClient();
    await client.addDependency(workItemId, dependsOnWorkItemId, type);
  }

  public async getDependencies(workItemId: string): Promise<WorkItemDependency[]> {
    const client = await this.#getClient();
    const detail = await client.getRune(workItemId);
    return detail.dependencies.map((dep) => ({
      workItemId: dep.target_id,
      type: dep.relationship,
    }));
  }

  public static extractAgentName(tags: string[]): string | null {
    const agentTag = tags.find((tag) => tag.startsWith("agent:"));
    if (!agentTag) {
      return null;
    }
    return agentTag.slice(6);
  }

  public static buildCreateRuneRequest(input: CreateDraftWorkItemInput): CreateRuneRequest {
    const metadata = input.metadata ?? {};
    const title =
      typeof metadata.title === "string" && metadata.title.length > 0
        ? metadata.title
        : `${input.kind}:${input.name}`;
    const description =
      typeof metadata.description === "string"
        ? metadata.description
        : typeof input.state?.instructions === "string"
          ? input.state.instructions
          : undefined;
    const priority = typeof metadata.priority === "number" ? metadata.priority : 1;
    const parentId = typeof metadata.parentId === "string" ? metadata.parentId : undefined;
    const branch = typeof metadata.branch === "string" ? metadata.branch : undefined;
    const type = typeof metadata.type === "string" ? metadata.type : undefined;

    const tags = Array.isArray(metadata.tags) ? [...(metadata.tags as string[])] : ([] as string[]);

    if (input.kind === "task") {
      tags.push(`agent:${input.name}`);
    }

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

  public static mapToWorkItem(rune: RuneDetail, agentName: string): WorkItem {
    const state = { ...rune.state };

    return {
      workItemId: rune.id,
      kind: "task",
      name: agentName,
      state,
      metadata: {
        title: rune.title,
        description: rune.description,
        priority: rune.priority,
        status: rune.status,
        branch: rune.branch,
        parentId: rune.parent_id,
        type: rune.type,
        assignee: rune.assignee_id,
        tags: rune.tags,
        realmId: rune.realm_id,
        createdAt: rune.created_at,
        updatedAt: rune.updated_at,
        dependencies: rune.dependencies.map((dep) => ({
          workItemId: dep.target_id,
          type: dep.relationship,
        })),
        notes: rune.notes.map((note) => ({ content: note.text, createdAt: note.created_at })),
        acceptanceCriteria: rune.acceptance_criteria.map((ac) => ({
          id: ac.id,
          scenario: ac.scenario,
          criteria: ac.description,
          satisfied: false,
        })),
        retro: rune.retro_items.map((item) => ({
          content: item.text,
          createdAt: item.created_at,
        })),
      },
    };
  }

  public static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
