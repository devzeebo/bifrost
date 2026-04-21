import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import vike from 'vike/plugin';

export default defineConfig({
  base: '/ui',
  plugins: [react(), vike({}), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    allowedHosts: ['ui', 'localhost', '.*'],
    proxy: {
      '/api/ui': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: ['ui', 'localhost', '.*'],
  },
});
