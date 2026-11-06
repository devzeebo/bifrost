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
      '/amend-capability-ask': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/amend-capability-eval': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/duplicate-capability-eval': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/retire-capability-eval': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/rename-capability': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/post-capability-chat-message': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/apply-capability-proposal': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/dismiss-capability-proposal': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/reread-capability-proposal': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/get-capability-chat': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/save-derived-skill': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/restore-capability-version': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/restore-skill-version': {
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
      '/list-capability-versions': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/get-capability-version': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/compare-capability-versions': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/list-skill-versions': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/get-skill-version': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/compare-skill-versions': {
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
