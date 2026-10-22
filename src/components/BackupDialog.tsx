import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Chip } from '@unisim/sdk'
import { useImageStore } from '../stores/imageStore'
import { DIALOG_BODY, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_PANEL } from '../lib/dialog'
import { downloadBackup, importBackup } from '../lib/imageBackup'
import { useDialog } from '../lib/useDialog'
import { Page } from '../native/parts'
import { PHONE } from '../native/shell'

// "Back up this image" — a backup FILE the person keeps (the original plus the
// crop, size and boxes), to import later on any device and carry on editing.
//
// It used to have a third card, "Hosted by UNI·SIM": the edited picture kept
// online against a Universal ID. That went on 2026-10-20 with sign-in itself
// (James: no logins in first iterations unless they improve the experience;
// Docs_UNI_SIM/login-free-plan.md). Prod held no Images backups, so nobody
// lost one. The file does the same job — getting an image back on another
// device — with no account and nothing uploaded.
export default function BackupDialog() {
  const open = useImageStore((s) => s.backupOpen)
  const setOpen = useImageStore((s) => s.setBackupOpen)
  const hasImage = useImageStore((s) => !!s.images.find((i) => i.id === s.selectedId) && !!s.target)

  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [importErr, setImportErr] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // Not on the phone, where it is a page (which has its own focus and Escape).
  const dialog = useDialog(() => close(), true, open && !PHONE)

  if (!open) return null

  function close() {
    setOpen(false)
    setImportMsg(null)
    setImportErr(null)
  }

  async function onDownloadBackup() {
    if (!hasImage || importBusy) return
    setImportErr(null)
    try {
      await downloadBackup()
    } catch (err) {
      setImportErr((err as Error).message)
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked later
    if (!file) return
    setImportErr(null)
    setImportMsg(null)
    setImportBusy(true)
    try {
      await importBackup(file)
      setImportMsg('✓ Backup restored — your image is loaded.')
      window.setTimeout(() => setImportMsg(null), 2600)
    } catch (err) {
      setImportErr((err as Error).message)
    } finally {
      setImportBusy(false)
    }
  }

  const body = (
    <>
        {/* Only the body scrolls. It used to be the whole panel, so on a phone
            the "Back up this image" title and its close button scrolled away
            the moment the cards outgrew the screen. */}
        <div className={`${DIALOG_BODY} space-y-4 p-5`}>
          {/* On this device: free local resize + Download the result. */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">On this device</span>
              <Chip size="sm">Free</Chip>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Your images are resized entirely in this browser and never uploaded. Use Download to save the result to your device — free.
            </p>
          </div>

          {/* Save to desktop: a re-importable backup file the person keeps. */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Save to desktop</span>
              <Chip size="sm">Re-import later</Chip>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Download a backup of your original image plus your crop and size settings. Import it any time — on any device — to carry on editing where you left off.
              {' '}It holds your original image as you added it, so it can still carry the photo’s location and camera details — unlike Download. Scrub metadata first if you’ll share it.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onDownloadBackup}
                disabled={!hasImage || importBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 16h12" />
                </svg>
                Download backup
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importBusy}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 17V7m0 0L6.5 10.5M10 7l3.5 3.5M4 4h12" />
                </svg>
                {importBusy ? 'Importing…' : 'Import a backup'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={onImportFile}
                className="hidden"
              />
            </div>
            {!hasImage && <p className="mt-2 text-xs text-slate-400">Select an image to back it up — or import a backup to restore one.</p>}
            {importMsg && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{importMsg}</p>}
            {importErr && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{importErr}</p>}
          </div>
        </div>
    </>
  )

  // The phone app opens this as a page of its own (back on a swipe from the
  // left edge), not a dialog over the editor: see src/native/.
  if (PHONE) {
    return (
      <Page title="Back up this image" onBack={close}>
        {body}
      </Page>
    )
  }

  return createPortal(
    <div
      className={`${DIALOG_OVERLAY} bg-slate-900/50`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div {...dialog.panelProps} className={`${DIALOG_PANEL} max-w-lg rounded-2xl bg-white shadow-xl outline-none sm:max-h-[88dvh] dark:bg-slate-900 dark:ring-1 dark:ring-slate-800`}>
        <div className={`${DIALOG_HEADER} flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800`}>
          <h2 id={dialog.titleId} className="text-base font-bold text-slate-900 dark:text-slate-100">Back up this image</h2>
          <button onClick={close} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" /></svg>
          </button>
        </div>

        {body}
      </div>
    </div>,
    document.body,
  )
}
