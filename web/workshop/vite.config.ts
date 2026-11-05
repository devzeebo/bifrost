import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      disableLogging: true,
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/create-capability': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/change-capability-ask': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/rename-capability': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/get-capability': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/list-capabilities': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
})
