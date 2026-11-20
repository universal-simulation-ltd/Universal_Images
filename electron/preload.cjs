const { contextBridge, ipcRenderer } = require('electron')

// The page's half of the SDK's desktop bridge, and the only bridge the page
// gets (main.cjs does the work, see @unisim/sdk/electron):
//
//   • hub handoff (`installHubHandoff`): hub links ("Your Universal ID",
//     profile) open in a window this app owns, signed in as the current user,
//     instead of the system browser, which has never seen the session;
//   • "Sign in with your browser" (`installBrowserSignIn`, SDK 0.221.0): the
//     SDK's sign-in dialog opens the hub's sign-in page in the system browser,
//     so someone already signed in to UNI·SIM there presses Continue once and
//     comes back signed in. The main process runs the loopback listener.
//
// ⚠️ Spelled out rather than required from the SDK on purpose: Electron
// sandboxes preloads, and a sandboxed `require` resolves only `electron` and a
// few built-ins. This is the SDK's PRELOAD_SNIPPET verbatim; its channel names
// must match.
contextBridge.exposeInMainWorld('unisimDesktop', {
  openHub: (url, session) => ipcRenderer.invoke('unisim:open-hub', { url, session }),
  clearHub: () => ipcRenderer.invoke('unisim:clear-hub'),
  signInWithBrowser: (opts) => ipcRenderer.invoke('unisim:browser-sign-in', opts),
  cancelSignInWithBrowser: () => ipcRenderer.invoke('unisim:browser-sign-in-cancel'),
  // One sign-in for every UNI·SIM desktop app on this computer (SDK 0.232.0):
  // signed in to another suite app here, this one signs itself in on start,
  // with a session of its own; "Sign out of every UNI·SIM app on this
  // computer" reaches it too. The grant never leaves the main process.
  suiteSession: (opts) => ipcRenderer.invoke('unisim:suite-session', opts),
  onSuiteSessionChange: (cb) => {
    const h = () => cb()
    ipcRenderer.on('unisim:suite-session-changed', h)
    return () => ipcRenderer.removeListener('unisim:suite-session-changed', h)
  },
})
