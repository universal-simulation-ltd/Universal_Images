import { createThemeStore, type ThemePref } from '@unisim/sdk'

// The light/dark/system preference. The store itself lives in @unisim/sdk
// (createThemeStore, since 0.140.0) — this file only names the key. It opens
// LIGHT and stays light until the user chooses otherwise (the suite rule).
//
// Since SDK 0.143 the key holds this app's OVERRIDE, set from App preferences.
// Absent, the app follows Global preferences (`universal:color-scheme`, itself
// light until chosen). A value saved before 0.143 simply reads as an override.
//
// ⚠️ The key is every user's saved choice. Renaming it silently puts them all
// back on following global. It is written down a second time in index.html's pre-paint script;
// `npm run test:theme` is what keeps the two the same.
export type { ThemePref }

export const useThemeStore = createThemeStore('unisim-images-theme')
