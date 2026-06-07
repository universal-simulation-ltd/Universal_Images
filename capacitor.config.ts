import type { CapacitorConfig } from '@capacitor/cli'

// Capacitor wraps the same Vite build that ships to the web and to Electron.
// `webDir` is the Vite build output. Capacitor serves it from a local
// `capacitor://` / `https://localhost` origin, so assets must resolve
// relatively — build with `npm run build:desktop` (which sets Vite `base` to
// `./`) before running `npx cap sync`, NOT the production `/images/` base build.
const config: CapacitorConfig = {
  appId: 'uk.co.unisim.images',
  appName: 'Universal Images',
  webDir: 'dist',
}

export default config
