import { execSync } from 'node:child_process'
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
// Build-version marker: prefer the Cloudflare Pages commit SHA baked in at build
// time, fall back to the local git short SHA, then 'dev'. Surfaced as a
// <meta name="build-sha"> tag and a startup console.log so the live build is
// identifiable in-browser without wrangler.
function resolveBuildSha(): string {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}
const BUILD_SHA = resolveBuildSha()

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
      'import.meta.env.VITE_BUILD_SHA': JSON.stringify(BUILD_SHA),
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
      {
        name: 'build-sha-meta',
        transformIndexHtml() {
          return [
            { tag: 'meta', attrs: { name: 'build-sha', content: BUILD_SHA }, injectTo: 'head' as const },
          ]
        },
      },
      react(),
      tailwindcss(),
      // The PWA service worker is for the hosted web app only — under Electron's
      // `file://` origin it cannot register and is unnecessary, so skip it.
      ...(isDesktop ? [] : [VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'],
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
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          // SPA navigations under the base path fall back to the prefixed shell.
          navigateFallback: `${BASE_PATH}index.html`,
          // The in-browser AI runtimes are large and only loaded when their
          // optional tool is used: onnxruntime-web WASM (~24 MB) for "Remove
          // background", and the MediaPipe vision WASM + BlazeFace `.tflite`
          // (~2 MB) for "Redact faces". Keep them OUT of the install-time
          // precache — they would bloat the PWA install and blow past workbox's
          // 2 MB file limit — and cache them at runtime on first use instead, so
          // they still work offline once the user has run the tool once.
          // The country boundaries behind the metadata panel's location map
          // (~250 KB gzipped) DO stay in the precache, unlike the runtimes
          // above. They are a fraction of the size, and precaching them is
          // what makes "turn the network off and it still tells you where the
          // photo was taken" true — which is the claim the whole feature is
          // built to support. See src/data/README.md.
          // ⚠️ The HEIC decoder is a ~3 MB .js chunk, not a .wasm, so none of
          // the patterns above catch it — and precaching it is a hard BUILD
          // FAILURE here rather than a warning, because this config never
          // raises workbox's 2 MB default cap. It is also the same bargain as
          // the runtimes above: dynamic-imported in `imageResize.ts` precisely
          // so that people who never open an iPhone photo never pay for it.
          globIgnores: ['**/*.wasm', '**/*.tflite', '**/*.task', '**/heic-to-*.js'],
          runtimeCaching: [
            {
              // The HEIC decoder — cached after the first iPhone photo, so HEIC
              // input keeps working offline from then on.
              urlPattern: /\/assets\/heic-to-.*\.js$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'heic-to',
                expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /\/assets\/ort[-.].*\.(?:js|wasm)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'onnx-runtime',
                expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // MediaPipe tasks-vision WASM runtime (CDN or self-hosted) used by
              // the on-device face detector.
              urlPattern: /tasks-vision.*\/wasm\/.*\.(?:js|wasm)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'mediapipe-vision',
                expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // The BlazeFace face-detection model (Google model storage, or a
              // self-hosted copy) — cached on first "Redact faces" use.
              urlPattern: /blaze_face.*\.tflite$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'face-model',
                expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: { enabled: false }
      })]),
    ],
    worker: {
      format: 'es'
    }
  }
})
