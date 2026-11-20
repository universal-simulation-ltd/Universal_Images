const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')
const { installBrowserSignIn, installHubHandoff } = require('@unisim/sdk/electron')

// Set by `npm run electron:dev` to load the live Vite dev server. When unset
// (the packaged app), we load the built bundle from disk over `file://`.
const DEV_SERVER_URL = process.env.ELECTRON_START_URL

const ICON = path.join(__dirname, '..', 'dist', 'icon-512.png')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      // The page uses no Node APIs and stays sandboxed. Its one bridge is the
      // SDK's desktop bridge (preload.cjs): hub pages opened signed in, and
      // sign-in through the system browser.
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // External links (e.g. the UNI SIM navbar) open in the system browser rather
  // than inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
}

app.whenReady().then(() => {
  // Hub pages (profile, account) open in a window this app owns, signed in as
  // the current user: the desktop session lives here and nowhere else.
  installHubHandoff({ icon: ICON })
  // Sign-in goes through the system browser (SDK 0.221.0): the desktop app
  // can't see the browser's UNI·SIM session, so Tune this app → Sign in opens
  // the hub's sign-in page there instead, and a person already signed in
  // presses Continue once and comes back greeted by name. `images` is how the
  // hub's /desktop-sign-in page names this app.
  installBrowserSignIn({ app: 'images' })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
