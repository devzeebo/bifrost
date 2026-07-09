import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    testTimeout: 15_000,
  },
  pack: {
    entry: {
      index: resolve(__dirname, "src/index.ts"),
      augment: resolve(__dirname, "src/augment.ts"),
    },
  },
});
