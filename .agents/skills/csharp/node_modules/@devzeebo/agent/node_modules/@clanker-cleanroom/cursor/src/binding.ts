import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";

import {
  asRecord,
  parseAgentJsonOutput,
  readTokenCount,
  type AgentBinding,
  type AgentRunResult,
} from "clanker-cleanroom";

import { CONTAINER_AUTH_PATH, CURSOR_IMAGE, defaultHostAuthFile } from "./constants.js";
import { adaptCursorEvents } from "./trajectory.js";

export const cursorBinding: AgentBinding = {
  image: CURSOR_IMAGE,
  displayName: "Cursor",
  trajectoryKind: "cursor",
  adaptEvents: adaptCursorEvents,
  command: ({ prompt, model }) => {
    const agentArgs = ["agent", "-p", "--force", "--output-format", "stream-json"];
    if (model !== undefined && model !== "") {
      agentArgs.push("--model", model);
    }
    agentArgs.push("--", prompt);
    return agentArgs;
  },
  prepare: async () => {
    const authFile = defaultHostAuthFile(homedir());
    try {
      await access(authFile, fsConstants.R_OK);
    } catch {
      throw new Error(
        `Cursor credentials not found at ${authFile}. Run \`agent login\` on the host first.`,
      );
    }
    return {
      volumes: [{ host: authFile, container: CONTAINER_AUTH_PATH, mode: "ro" }],
    };
  },
  parseResult: parseCursorResult,
};

function parseCursorResult(trajectory: string): AgentRunResult {
  const parsed = parseAgentJsonOutput(trajectory);
  const record = asRecord(parsed);
  const usage = asRecord(record?.usage);

  return {
    durationMs: readTokenCount(record?.duration_ms),
    costUsd: null,
    usage: {
      inputTokens: readTokenCount(usage?.inputTokens),
      outputTokens: readTokenCount(usage?.outputTokens),
      cacheReadTokens: readTokenCount(usage?.cacheReadTokens),
      cacheWriteTokens: readTokenCount(usage?.cacheWriteTokens),
    },
  };
}
