import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {VitePWA} from 'vite-plugin-pwa'

// GitHub Actions provides GITHUB_REPOSITORY, so Pages works regardless of repo name.
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = repositoryName ? `/${repositoryName}/` : '/'

export default defineConfig({
  base,
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
    manifest: {
      name: 'FORM — Fitness Tracker', short_name: 'FORM',
      description: 'Workout, nutrition, recovery, and activity journal',
      display: 'standalone', start_url: '.', scope: '.',
      background_color: '#101116', theme_color: '#101116',
      icons: [
        {src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png'},
        {src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png'},
        {src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}
      ]
    },
    workbox: {globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'], cleanupOutdatedCaches: true, navigateFallback: 'index.html'}
  })],
  test: { environment: 'node' }
})
