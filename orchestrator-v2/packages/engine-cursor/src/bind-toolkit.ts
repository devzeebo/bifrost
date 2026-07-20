import { fileURLToPath } from "node:url";
import type { EngineContext } from "@bifrost-ai/engine";
import { toToolkitContext } from "@bifrost-ai/engine";
import type { McpServerConfig } from "@cursor/sdk";

export function bindToolkitToCursor(moduleRef: string, context: EngineContext): McpServerConfig {
  return {
    type: "stdio",
    command: process.execPath,
    args: [fileURLToPath(new URL("./mcp-bridge.mjs", import.meta.url))],
    env: {
      BIFROST_TOOLKIT_MODULE: moduleRef,
      BIFROST_TOOLKIT_CONTEXT: JSON.stringify(toToolkitContext(context)),
    },
  };
}
