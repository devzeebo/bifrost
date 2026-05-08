import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
    pedantic: "off",
    perf: "error",
    restriction: "error",
    style: "warn",
    suspicious: "error",
  },
  plugins: ["typescript"],
  rules: {
    "capitalized-comments": "off",
    "max-statements": "off",
    "no-console": "off",
    "no-magic-numbers": "off",
    "sort-keys": "off",
    "no-underscore-dangle": "off",
  },
  overrides: [
    {
      files: ["**/*.spec.ts"],
      rules: {
        "no-non-null-assertion": "off",
      },
    },
  ],
});
