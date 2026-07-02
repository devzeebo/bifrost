import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    rules: {
      "unicorn/no-thenable": "off",
    },
  },
});
