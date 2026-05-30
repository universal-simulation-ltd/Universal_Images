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

// Fall back to a non-empty placeholder so createClient() never throws when
// the env vars aren't set. Auth calls will fail gracefully; the local-first
// image tool still renders and works without authentication.
const universalConfig = {
  supabaseUrl: __SUPABASE_URL__ || 'https://placeholder.supabase.co',
  supabaseAnonKey: __SUPABASE_ANON_KEY__ || 'placeholder-anon-key',
  product: 'images' as const,
  cookieDomain: import.meta.env.PROD ? '.unisim.co.uk' : undefined,
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UniversalProvider config={universalConfig}>
      <App />
    </UniversalProvider>
  </React.StrictMode>
)
