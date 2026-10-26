import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('react-router-dom')) {
            return 'router'
          }

          if (id.includes('react-dom') || id.includes(`${'/'}react${'/'}`)) {
            return 'react-vendor'
          }

          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'i18n-vendor'
          }
        },
      },
    },
  },
  server: {
    allowedHosts: ['essentially-stop-bunny-miami.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'https://api.project.cims.cognilabs.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
