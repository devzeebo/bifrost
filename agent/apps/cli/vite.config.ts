import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    dts: {
      tsgo: true,
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      "no-console": "off",
    },
  },
  fmt: {},
  test: {
    include: ["src/**/*.spec.ts"],
  },
});
