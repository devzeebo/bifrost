import type { Engine } from './interface.js'
import type { EngineContext, EngineResult } from './types.js'

export type TestEngineConfig = {
  success?: boolean
  lastMessage?: string
  simulateError?: boolean
  simulateDelay?: number // milliseconds
  mockStats?: Partial<EngineResult['stats']>
}

/**
 * Test Engine implementation for testing and development.
 * Simulates engine execution with configurable behavior.
 */
export class TestEngine implements Engine {
  #config: TestEngineConfig

  constructor(config: TestEngineConfig = {}) {
    this.#config = {
      success: true,
      lastMessage: 'Test execution complete',
      simulateError: false,
      simulateDelay: 0,
      mockStats: undefined,
      ...config
    }
  }

  async execute(context: EngineContext): Promise<EngineResult> {
    // Apply simulated delay if configured
    if (this.#config.simulateDelay && this.#config.simulateDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.#config.simulateDelay))
    }

    // Simulate error if configured
    if (this.#config.simulateError) {
      throw new Error('Simulated engine error')
    }

    const startTime = Date.now()

    const defaultStats: EngineResult['stats'] = {
      durationMs: 0,
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheCreationTokens: 5,
      totalCostUsd: 0.005,
      numTurns: 1
    }

    const stats: EngineResult['stats'] = this.#config.mockStats
      ? { ...defaultStats, ...this.#config.mockStats }
      : defaultStats

    stats.durationMs = Date.now() - startTime

    return {
      success: this.#config.success ?? true,
      skipFulfill: false,
      lastMessage: `${this.#config.lastMessage} (task: ${context.taskId}, agent: ${context.agentName})`,
      stats
    }
  }

  async sendFollowUp(message: string): Promise<EngineResult> {
    // Apply simulated delay if configured
    if (this.#config.simulateDelay && this.#config.simulateDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.#config.simulateDelay))
    }

    const stats: EngineResult['stats'] = {
      durationMs: this.#config.simulateDelay ?? 10,
      inputTokens: 50,
      outputTokens: 25,
      cacheReadTokens: 5,
      cacheCreationTokens: 2,
      totalCostUsd: 0.0025,
      numTurns: 1
    }

    return {
      success: this.#config.success ?? true,
      skipFulfill: false,
      lastMessage: `Follow-up: ${message}`,
      stats
    }
  }

  /**
   * Update engine configuration.
   */
  setConfig(config: Partial<TestEngineConfig>): void {
    this.#config = { ...this.#config, ...config }
  }
}
