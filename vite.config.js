// vite.config.js
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
        target: 'http://localhost:3000',
        changeOrigin: true,
  //       secure: false,
  //     },
  //     // SSE 스트리밍을 위한 설정 추가
  //     '/api/stream': {
  //       target: 'http://localhost:3000',
  //       changeOrigin: true,
  //       bypass: (req, res) => {
  //         req.headers['connection'] = 'keep-alive';
  //         req.headers['cache-control'] = 'no-cache';
  //       }
      }
    }
  }
})