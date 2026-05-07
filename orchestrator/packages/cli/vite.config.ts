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
      name: 'Cli',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@orchestrator/core'],
      output: {
        globals: {
          '@orchestrator/core': 'Core',
        },
      },
    },
    target: 'esnext',
    emptyOutDir: true,
  },
})
