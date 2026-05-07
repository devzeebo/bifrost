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
      name: 'Engine',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
    target: 'esnext',
    emptyOutDir: true,
  },
})
