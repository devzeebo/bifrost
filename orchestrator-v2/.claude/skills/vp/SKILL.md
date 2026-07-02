---
name: vp
description: Conventions for running Vite+ (`vp`) commands in this repo. Use whenever invoking vp — check, test, install, build, add, remove, run. Key rule: always run `vp check --fix`, never bare `vp check` followed by `vp check --fix`.
---

# vp conventions (this repo)

This repo uses Vite+ (`vp`) as its only toolchain — formatting, lint, type-check, test, build, and package management all go through `vp`. Never call `npm`, `pnpm`, `vite`, or `vitest` directly; use the `vp` equivalent.

## Validation

- **Always run `vp check --fix`**, not bare `vp check` followed by `vp check --fix`. `--fix` applies formatting and auto-fixable lint corrections in a single pass; bare `vp check` only reports, then `--fix` repeats the same work. The two-step form is redundant.
  - Use bare `vp check` (no `--fix`) only when you need a read-only report that must not modify files.
- Run `vp test` for tests.
- Full gate: `vp check --fix && vp run -r test && vp run -r build` (also exposed as the `ready` script: `vp run ready`).

## Dependencies

- Package manager is **pnpm** (managed by `vp`). Always `vp install` / `vp add` / `vp remove` — never raw `pnpm`.
- Monorepo: workspace + catalog live in `pnpm-workspace.yaml`. Shared dep versions are pinned in its `catalog:` block and referenced as `"catalog:"` in each `package.json`. To bump a shared dep, edit the catalog once.
- `overrides` also live in `pnpm-workspace.yaml` — pnpm 10+ ignores a `pnpm.overrides` field in `package.json`.
- Run `vp install` after pulling remote changes.

## If something looks wrong

- `vp env doctor` — runtime / package-manager diagnostics. Include its output when asking for help.
- Docs: `node_modules/vite-plus/docs` or https://viteplus.dev/guide/.
