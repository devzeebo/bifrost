import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react() as never],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
    fs: {
      allow: [resolve(__dirname, "../..")],
    },
  },
  test: {
    environment: "node",
  },
});
