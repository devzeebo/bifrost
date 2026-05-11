---
name: node
description: |
  Use when working with Node.js, npm, package.json, or npx. Alternative package managers
  like Yarn and pnpm as well as monorepo tools like nx, yarn, or turborepo should also use this skill
---

# Node.js

## Invoking scripts

Prefer explicit `scripts` entries over `npx`. Write scripts to package.json:

```json
"scripts": {
  "test": "vitest run",
  "dev": "vitest --watch",
  "build": "vite build"
}
```

Reason: Enforces consistent flags, prevents drift, works better in monorepos.

## Monorepos

Use native npm workspaces unless user explicitly chose otherwise (turborepo, nx, pnpm).

**Workspace pattern** ([examples/workspace-setup](examples/workspace-setup.md)):
- Root `workspaces: ["packages/**"]` in package.json
- Workspace scripts: `npm run build -ws`, `npm run test -ws`
- Local deps use workspace names: `@bifrost-ai/core`

**TypeScript project references** ([examples/tsconfig-references](examples/tsconfig-references.md)):
- Base config with `composite: true`
- Package configs extend base, declare `references`
- Enables cross-package type checking, faster builds

**Build** ([examples/vite-build](examples/vite-build.md)):
- Vite for fast builds
- `vite-plugin-dts` for .d.ts generation
- `external:` workspace deps in rollupOptions

**Testing** ([examples/vitest-setup](examples/vitest-setup.md)):
- Vitest config per workspace or root
- `*.spec.ts` naming, exclude from builds
- Root script runs all: `"test": "vitest run"`

## See also

- [TypeScript config](examples/tsconfig-references.md) - Project references pattern
- [Vite build](examples/vite-build.md) - Library build with deps
- [Vitest setup](examples/vitest-setup.md) - Test config for monorepos
- [Workspace setup](examples/workspace-setup.md) - Complete monorepo structure
