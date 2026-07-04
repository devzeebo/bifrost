import type { EngineContext, EngineResult } from "./types.js";
import type { Engine } from "./interface.js";

export type TestEngineConfig = {
  success?: boolean;
  lastMessage?: string;
  simulateError?: boolean;
  simulateDelay?: number;
  mockStats?: Partial<EngineResult["stats"]>;
};

export class TestEngine implements Engine {
  #config: TestEngineConfig;
  #currentSessionId?: string;

  public constructor(config: TestEngineConfig = {}) {
    this.#config = {
      success: true,
      lastMessage: "Test execution complete",
      simulateError: false,
      simulateDelay: 0,
      mockStats: null,
      ...config,
    };
  }

  public async execute(context: EngineContext, sessionId?: string): Promise<EngineResult> {
    if (this.#config.simulateDelay && this.#config.simulateDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.#config.simulateDelay));
    }

    if (this.#config.simulateError) {
      throw new Error("Simulated engine error");
    }

    const startTime = Date.now();

    const defaultStats: EngineResult["stats"] = {
      durationMs: 0,
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheCreationTokens: 5,
      totalCostUsd: 0.005,
      numTurns: 1,
    };

    const stats: EngineResult["stats"] = { ...defaultStats, ...this.#config.mockStats };

    stats.durationMs = Date.now() - startTime;

    if (sessionId) {
      this.#currentSessionId = sessionId;
    } else {
      this.#currentSessionId = `test-session-${Date.now()}`;
    }

    const isFollowUp = Boolean(sessionId);

    return {
      success: this.#config.success ?? true,
      skipFulfill: false,
      lastMessage: isFollowUp
        ? `Follow-up: ${this.#config.lastMessage} (session: ${this.#currentSessionId})`
        : `${this.#config.lastMessage} (work item: ${context.workItemId}, agent: ${context.agent.name})`,
      stats,
      sessionId: this.#currentSessionId,
    };
  }

  public setConfig(config: Partial<TestEngineConfig>): void {
    this.#config = { ...this.#config, ...config };
  }
}
