import type {
  ACEntry,
  DependencyRef,
  NoteEntry,
  RetroEntry,
  Task,
  TaskSource,
} from "@bifrost-ai/task-source";
import { BifrostHttpClient } from "./client/bifrost-http-client";
import { loadConfig } from "./config/config-loader";
import { CredentialLoader } from "./config/credential-loader";
import type { BifrostTaskSourceConfig } from "./types";
import createDebug from "debug";

const debug = createDebug("bifrost");

export class BifrostTaskSource implements TaskSource {
  readonly #config: BifrostTaskSourceConfig;
  #client: BifrostHttpClient | null = null;
  #initialized = false;

  public constructor(config: BifrostTaskSourceConfig = {}) {
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
  public async *watchTasks(): AsyncGenerator<Task> {
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
          const agentId = BifrostTaskSource.extractAgentId(rune.tags);
          if (!agentId) {
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

          yield BifrostTaskSource.mapToTask(detail, agentId);
        }

        pollInterval = Math.min(pollInterval * 2, maxPollInterval);
        const jitter = pollInterval * 0.2 * (Math.random() * 2 - 1);
        await BifrostTaskSource.sleep(pollInterval + jitter);
      } catch (error) {
        console.error(error);
        await BifrostTaskSource.sleep(pollInterval);
      }
    }
  }
  /* eslint-enable @typescript-eslint/no-await-in-loop, @typescript-eslint/no-continue */

  public async completeTask(taskId: string): Promise<void> {
    const client = await this.#getClient();
    await client.fulfillRune(taskId);
  }

  public async failTask(taskId: string, error: string): Promise<void> {
    const client = await this.#getClient();
    await client.failRune(taskId, error);
  }

  public async setState(taskId: string, taskState: Record<string, unknown>): Promise<void> {
    try {
      const client = await this.#getClient();
      await client.updateRuneState(taskId, taskState);
    } catch (err) {
      console.error(`Failed to update state for task ${taskId}:`, err);
    }
  }

  public static extractAgentId(tags: string[]): string | null {
    const agentTag = tags.find((tag) => tag.startsWith("agent:"));
    if (!agentTag) {
      return null;
    }
    return agentTag.slice(6);
  }

  public static mapToTask(
    rune: {
      id: string;
      title: string;
      description: string;
      priority: number;
      status: string;
      branch?: string;
      assignee_id?: string;
      tags: string[];
      created_at: string;
      dependencies: { target_id: string; relationship: string }[];
    },
    agentId: string,
  ): Task {
    return {
      id: rune.id,
      agentId,
      taskState: {},
      metadata: {
        title: rune.title,
        description: rune.description,
        priority: rune.priority,
        status: rune.status,
        branch: rune.branch,
        assignee: rune.assignee_id,
        createdAt: rune.created_at,
        dependencies: rune.dependencies.map((dep) => ({
          taskId: dep.target_id,
          type: dep.relationship,
        })) as DependencyRef[],
        notes: [] as NoteEntry[],
        acceptanceCriteria: [] as ACEntry[],
        retro: [] as RetroEntry[],
      },
      instructions: rune.description,
    };
  }

  public static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
