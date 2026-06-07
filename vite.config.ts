import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Universal Images is served at opensource.unisim.co.uk/images in production.
// `base` + PWA scope derive from Vite's `mode`; local dev stays `/`. The
// `desktop` mode targets the Electron build, which loads index.html over
// `file://`, so assets must resolve relative to it (`./`) and the PWA service
// worker is skipped (it cannot register under a `file://` origin).
export default defineConfig(({ mode }) => {
  // Merge .env files with process.env (Cloudflare Pages injects vars into
  // process.env at build time without the VITE_ prefix requirement).
  // Accept both VITE_SUPABASE_URL and SUPABASE_URL so either naming works.
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const env = { ...process.env, ...fileEnv }

  const isDesktop = mode === 'desktop'
  const BASE_PATH = isDesktop ? './' : mode === 'production' ? '/images/' : '/'
  return {
    base: BASE_PATH,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? ''),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY ?? ''),
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
      // The PWA service worker is for the hosted web app only — under Electron's
      // `file://` origin it cannot register and is unnecessary, so skip it.
      ...(isDesktop ? [] : [VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Universal Images',
          short_name: 'UniImg',
          description: 'Drag, drop and resize images — works offline',
          theme_color: '#0f172a',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: BASE_PATH,
          scope: BASE_PATH,
          icons: [
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
          ]
        },
        workbox: {
          // SPA navigations under the base path fall back to the prefixed shell.
          navigateFallback: `${BASE_PATH}index.html`,
        },
        devOptions: { enabled: false }
      })]),
    ],
    worker: {
      format: 'es'
    }
  }
})
