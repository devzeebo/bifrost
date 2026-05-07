# Vitest Testing Setup

Root vitest.config.ts:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
```

Test file naming:
- `*.spec.ts` for unit tests
- Exclude from tsconfig `exclude` array

Usage:

```bash
npm run test           # run all tests once
npm run dev            # watch mode
npm run test -- -ui    # vitest ui (if installed)
```
