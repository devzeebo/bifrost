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
      '/list-worker-nodes': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
      '/list-pending-tracked-work-items': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
      '/list-tracked-work-items-held-by': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
      '/get-tracked-work-item': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
      '/list-runs-for-work-item': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
      '/cancel-tracked-work-item': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
      '/release-tracked-work-item': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
      '/get-virtual-key-quota': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const token = process.env.BIFROST_QUOTA_ACCESS_TOKEN
            if (token !== undefined && token.length > 0) {
              proxyReq.setHeader('Authorization', `Bearer ${token}`)
            }
          })
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
})
