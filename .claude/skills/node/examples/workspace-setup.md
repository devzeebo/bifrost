# Npm Workspace Monorepo Setup

Root package.json:

```json
{
  "name": "my-monorepo",
  "private": true,
  "type": "module",
  "workspaces": ["packages/**"],
  "scripts": {
    "build": "npm run build -ws",
    "test": "vitest run",
    "dev": "vitest --watch"
  },
  "devDependencies": {
    "typescript": "^6.0.3",
    "vite": "^8.0.11",
    "vite-plugin-dts": "^5.0.0",
    "vitest": "^4.1.5"
  }
}
```

Package (packages/core/package.json):

```json
{
  "name": "@my-monorepo/core",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "vite build"
  }
}
```
