import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// In development and preview, forward /api to the FastAPI server (backend/, port 8000).
const api = { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } };

export default defineConfig({
  server: { proxy: api },
  preview: { proxy: api },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'LabSim - Virtual Laboratory',
        short_name: 'LabSim',
        description: 'Browser-based practical learning simulator',
        theme_color: '#00284d',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,woff2}'],
        navigateFallbackDenylist: [/^\/api/]
      }
    })
  ]
});
