import type {
  TaskSource,
  Task,
  DependencyRef,
  NoteEntry,
  ACEntry,
  RetroEntry,
} from "@orchestrator/task-source";
import type { BifrostTaskSourceConfig } from "./types.js";
import { ConfigLoader } from "./config/config-loader.js";
import { CredentialLoader } from "./config/credential-loader.js";
import { BifrostHttpClient } from "./client/bifrost-http-client.js";

export class BifrostTaskSource implements TaskSource {
  readonly #config: BifrostTaskSourceConfig;
  #client: BifrostHttpClient | null = null;
  #initialized: boolean = false;

  constructor(config: BifrostTaskSourceConfig = {}) {
    this.#config = {
      pollInterval: config.pollInterval ?? 1000,
      maxPollInterval: config.maxPollInterval ?? 30000,
    };
  }

  async #initialize(): Promise<void> {
    if (this.#initialized) return;

    const configLoader = new ConfigLoader();
    const bifrostConfig = await configLoader.load();

    const credentialLoader = new CredentialLoader();
    const token = await credentialLoader.loadToken(bifrostConfig.url);

    this.#client = new BifrostHttpClient(bifrostConfig.url, bifrostConfig.realm, token);
    this.#initialized = true;
  }

  async #getClient(): Promise<BifrostHttpClient> {
    await this.#initialize();
    return this.#client!;
  }

  async *watchTasks(): AsyncGenerator<Task> {
    const client = await this.#getClient();
    let pollInterval = this.#config.pollInterval!;

    while (true) {
      try {
        const readyRunes = await client.getReadyRunes();

        for (const rune of readyRunes) {
          const agentId = this.#extractAgentId(rune.tags);
          if (!agentId) continue;

          try {
            await client.claimRune(rune.id);
          } catch (error) {
            if ((error as { status?: number }).status === 409) {
              continue;
            }
            throw error;
          }

          const detail = await client.getRune(rune.id);
          pollInterval = this.#config.pollInterval!;

          yield this.#mapToTask(detail, agentId);
          return;
        }

        pollInterval = Math.min(pollInterval * 2, this.#config.maxPollInterval!);
        const jitter = pollInterval * 0.2 * (Math.random() * 2 - 1);
        await this.#sleep(pollInterval + jitter);
      } catch {
        await this.#sleep(pollInterval);
      }
    }
  }

  async completeTask(taskId: string): Promise<void> {
    const client = await this.#getClient();
    await client.fulfillRune(taskId);
  }

  async failTask(taskId: string, error: string): Promise<void> {
    const client = await this.#getClient();
    await client.failRune(taskId, error);
  }

  async setState(taskId: string, taskState: Record<string, unknown>): Promise<void> {
    try {
      const client = await this.#getClient();
      await client.updateRuneState(taskId, taskState);
    } catch (err) {
      console.error(`Failed to update state for task ${taskId}:`, err);
    }
  }

  #extractAgentId(tags: string[]): string | null {
    const agentTag = tags.find((tag) => tag.startsWith("agent:"));
    if (!agentTag) return null;
    return agentTag.slice(6);
  }

  #mapToTask(
    rune: {
      id: string;
      title: string;
      description: string;
      priority: number;
      status: string;
      branch?: string;
      saga_id?: string;
      assignee_id?: string;
      tags: string[];
      created_at: string;
      dependencies: Array<{ target_id: string; relationship: string }>;
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
        sagaId: rune.saga_id,
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
    };
  }

  #sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
