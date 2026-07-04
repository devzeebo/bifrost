import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: resolve(__dirname, "src/index.ts"),
      augment: resolve(__dirname, "src/augment.ts"),
    },
  },
});
