import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: resolve(__dirname, "src/index.ts"),
      "mcp-bridge": resolve(__dirname, "src/mcp-bridge.ts"),
    },
  },
});
