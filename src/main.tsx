import React from 'react'
import ReactDOM from 'react-dom/client'
import { UniversalProvider } from '@unisim/sdk'
import App from './App'
import UsageTracker from './UsageTracker'
import { useImageStore } from './stores/imageStore'
import './index.css'

console.log(`build: ${import.meta.env.VITE_BUILD_SHA}`)

if (import.meta.env.DEV) {
  ;(window as unknown as { __stores: unknown }).__stores = {
    image: useImageStore
  }
}

// The packaged Electron renderer loads index.html over file://, which has
// no parent zone to scope a cookie to — leave cookieDomain undefined so the
// SDK falls back to localStorage. The browser web build (Vite mode
// 'production') still rides the shared .unisim.co.uk cookie.
const isDesktop = import.meta.env.MODE === 'desktop'

// Fall back to the REAL public suite project when the build define is empty
// (publishable anon key — safe to ship; RLS is the security boundary). A
// placeholder fallback left the SDK on a dead project when the build lacked the
// VITE_SUPABASE_*/SUPABASE_* env vars, so the suite session never resolved and
// the navbar showed no profile/avatar. The local-first image tool still works
// without auth; env vars (via the vite define) still override.
const universalConfig = {
  supabaseUrl: __SUPABASE_URL__ || 'https://rygfxgalojojppxmhddo.supabase.co',
  supabaseAnonKey: __SUPABASE_ANON_KEY__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5Z2Z4Z2Fsb2pvanBweG1oZGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTY4MjUsImV4cCI6MjA5NDMzMjgyNX0.hLy_vt9vY_rdPKF3nL32yAuMCD604E3CH5VM7D7CaNE',
  product: 'images' as const,
  cookieDomain: !isDesktop && import.meta.env.PROD ? '.unisim.co.uk' : undefined,
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UniversalProvider config={universalConfig}>
      <UsageTracker />
      <App />
    </UniversalProvider>
  </React.StrictMode>
)
