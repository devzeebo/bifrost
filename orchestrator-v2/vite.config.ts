import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "unicorn/no-thenable": "off",
    },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
  pack: {
    dts: true, // Generate declaration files
    sourcemap: true,
  },
});
