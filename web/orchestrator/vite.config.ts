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
          const server = proxy as unknown as {
            on: (
              event: 'proxyReq',
              listener: (proxyReq: { setHeader: (name: string, value: string) => void }) => void,
            ) => void
          }
          server.on('proxyReq', (proxyReq) => {
            const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
              .process?.env
            const token = env?.BIFROST_QUOTA_ACCESS_TOKEN
            if (token !== undefined && token.length > 0) {
              proxyReq.setHeader('Authorization', `Bearer ${token}`)
            }
          })
        },
      },
      '/create-capability': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/amend-capability-ask': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/amend-capability-criterion': {
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
      '/run-capability-eval': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/run-capability-suite': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/cancel-eval-suite-run': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/get-eval-case-run': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/get-eval-suite-run': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/list-eval-case-runs': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/get-capability-eval-outcomes': {
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
