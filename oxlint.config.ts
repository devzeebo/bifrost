import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
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
    "sort-imports": "off",
    "no-underscore-dangle": "off",
    "consistent-type-definitions": ["error", "type"],
    "no-undefined": "off",
    "no-ternary": "off",
    "no-void": "off",
    "typescript/explicit-function-return-type": "off",
    "typescript/explicit-module-boundary-types": "off",
  },
  overrides: [
    {
      files: ["**/*.spec.ts"],
      rules: {
        "no-non-null-assertion": "off",
        "no-empty-function": "off",
        "prefer-destructuring": "off",
      },
    },
  ],
});
