import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Merge all lucide-react icons into one chunk instead of 50+ micro-files
          if (id.includes('node_modules/lucide-react')) return 'icons';
          // Isolate heavy animation libs (loaded eagerly via Home.jsx)
          if (id.includes('node_modules/gsap')) return 'gsap';
          if (id.includes('node_modules/framer-motion')) return 'framer-motion';
          // Charts are admin-only (lazy), but recharts/d3 are large — own chunk
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts';
          // React core
          if (id.includes('node_modules/react-dom')) return 'react-dom';
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'react-vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5289',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://localhost:5289',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
