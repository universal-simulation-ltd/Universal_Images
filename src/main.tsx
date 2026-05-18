import React from 'react'
import ReactDOM from 'react-dom/client'
import { UniversalProvider } from '@unisim/sdk'
import App from './App'
import { useImageStore } from './stores/imageStore'
import './index.css'

if (import.meta.env.DEV) {
  ;(window as unknown as { __stores: unknown }).__stores = {
    image: useImageStore
  }
}

// TODO: add 'image' to @unisim/sdk's ProductCode union; using 'pdf' as a
// stand-in so the SDK's typed config accepts us. None of the auth/usage
// features are wired up yet — this is here purely so VersionChip's
// useChangelog() hook has its provider context.
const universalConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  product: 'pdf' as const,
  cookieDomain: import.meta.env.PROD ? '.unisim.co.uk' : undefined,
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UniversalProvider config={universalConfig}>
      <App />
    </UniversalProvider>
  </React.StrictMode>
)
