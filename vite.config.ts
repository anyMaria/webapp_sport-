import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)

export default defineConfig({
  define: { __BUILD__: JSON.stringify(`${sha} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Séance',
        short_name: 'Séance',
        description: "Séances d'étirements et de posture à partir de tes vidéos.",
        lang: 'fr',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        background_color: '#161E1B',
        theme_color: '#161E1B',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api\//], globPatterns: ['**/*.{js,css,html,png,woff2,webp,svg}'] },
    }),
  ],
})
