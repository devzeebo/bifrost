# Vite Build for Libraries

Fast builds, TypeScript declarations, workspace deps.

vite.config.ts:

```ts
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import pkg from './package.json'

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: './tsconfig.json',
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: './src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        '@my-monorepo/utils',
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
      ],
      output: {
        globals: {
          '@my-monorepo/utils': 'Utils',
        },
      },
    },
    target: 'esnext',
    emptyOutDir: true,
  },
})
```

**Key points:**
- `external:` workspace deps + all deps
- `rollupTypes: true` bundles .d.ts files
- `formats: ['es']` for ESM-only packages
