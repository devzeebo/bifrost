import type { Engine, EngineContext, EngineResult } from "@bifrost-ai/engine";
import { DevinCli } from "./devin-cli.js";
import { parseSessionId, parseOutput, parseStats } from "./devin-parser.js";

export class DevinCliEngine implements Engine {
  #cli: DevinCli;

  public constructor(cwd?: string) {
    // Use workingDir from context, default to current directory
    this.#cli = new DevinCli(cwd ?? process.cwd());
  }

  public async execute(context: EngineContext, sessionId?: string): Promise<EngineResult> {
    const startTime = Date.now();

    try {
      // Execute via CLI
      const result = await this.#cli.execute(context.instructions, sessionId);

      if (!result.success) {
        return DevinCliEngine.#handleError(result.stderr, new Error(result.stderr));
      }

      // Parse output
      const parsed = parseOutput(result.stdout);
      const extractedSessionId = parseSessionId(result.stdout) ?? sessionId;

      // Build stats
      const stats = parseStats(result.stdout, startTime);

      return {
        success: true,
        skipFulfill: false,
        lastMessage: parsed.summary,
        stats,
        sessionId: extractedSessionId,
      };
    } catch (error) {
      return DevinCliEngine.#handleError("Execution failed", error);
    }
  }

  static #handleError(message: string, error: unknown): EngineResult {
    // Include error details in message for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      skipFulfill: false,
      lastMessage: `${message}: ${errorMessage}`,
      stats: null,
    };
  }
}
