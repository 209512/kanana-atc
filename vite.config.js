// NOTE: vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
  // NOTE: secure: false,
  // NOTE: },
  // NOTE: Add configuration for SSE streaming
  // NOTE: '/api/stream': {
  // NOTE: target: 'http://127.0.0.1:3000',
  // NOTE: changeOrigin: true,
  // NOTE: bypass: (req, res) => {
  // NOTE: req.headers['connection'] = 'keep-alive';
  // NOTE: req.headers['cache-control'] = 'no-cache';
  // NOTE: }
      }
    }
  }
})