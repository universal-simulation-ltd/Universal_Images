import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  resolve: {
    // Force a single React instance so @unisim/sdk's hooks share the same
    // dispatcher as the host app. Without this, Vite's dep optimizer can
    // bundle a second copy of React inside the SDK's pre-bundle, which
    // surfaces as "Invalid hook call" at runtime.
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    exclude: ['@unisim/sdk']
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Universal Images',
        short_name: 'UniImg',
        description: 'Drag, drop and resize images — works offline',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  worker: {
    format: 'es'
  }
})
