import type { ParsedOutput } from "./devin-types.js";
import type { ExecutionStats } from "@bifrost-ai/engine";

// Parse session ID from Devin output
// Format: "Session ID: abc123" or similar
export const parseSessionId = (output: string): string | null => {
  const patterns = [
    /Session ID: ([a-zA-Z0-9-]+)/i,
    /session["\s:]+([a-zA-Z0-9-]+)/i,
    /abc123([a-zA-Z0-9-]+)/i, // Fallback pattern
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
};

// Parse main content from Devin output
export const parseOutput = (output: string): ParsedOutput => {
  // Extract summary/message
  const lines = output.split("\n");
  const summary = lines
    .filter((line) => !line.startsWith("Session") && !line.startsWith("=="))
    .join("\n")
    .trim();

  return { summary };
};

// Parse execution statistics
export const parseStats = (output: string, startTime: number): ExecutionStats | null => {
  const durationMs = Date.now() - startTime;

  // Try to extract tokens/cost from output
  const tokensMatch = output.match(/tokens?:\s*(\d+)/i);
  const costMatch = output.match(/cost?:\s*\$?([\d.]+)/i);

  return {
    durationMs,
    inputTokens: tokensMatch ? Number.parseInt(tokensMatch[1], 10) : 0,
    outputTokens: 0, // May not be available
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalCostUsd: costMatch ? Number.parseFloat(costMatch[1]) : 0,
    numTurns: 1, // CLI doesn't expose turns
  };
};
