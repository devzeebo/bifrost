import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    plugins: ["typescript"],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["apps/**", "packages/**"],
        env: { node: true },
      },
      {
        files: ["**/*.spec.ts"],
        plugins: ["vitest"],
      },
    ],
  },
  test: {
    include: ["src/**/*.spec.ts"],
  },
  run: {
    cache: true,
  },
});
