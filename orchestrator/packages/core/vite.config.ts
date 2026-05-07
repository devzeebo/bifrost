import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

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
      name: 'Core',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@orchestrator/engine', '@orchestrator/task-source', 'gray-matter'],
      output: {
        globals: {
          '@orchestrator/engine': 'Engine',
          '@orchestrator/task-source': 'TaskSource',
          'gray-matter': 'grayMatter',
        },
      },
    },
    target: 'esnext',
    emptyOutDir: true,
  },
})
