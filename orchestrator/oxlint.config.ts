import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
    suspicious: "error",
    pedantic: "error",
    perf: "error",
    style: "warn",
    restriction: "error",
  },
  plugins: ["typescript"],
  rules: {
    "no-console": "off",
  },
  options: {
    typeAware: true,
  },
});
