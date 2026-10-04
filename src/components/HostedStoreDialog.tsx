import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Chip, useUniversal, useUser, useOrg, useCredits, useHostedUploads, useAppFreeToken, type HostedUpload } from '@unisim/sdk'
import { useImageStore } from '../stores/imageStore'
import { DIALOG_BODY, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_PANEL } from '../lib/dialog'
import { storeCurrentImage, deleteHostedImage, openHostedImage, HostedObjectMissingError } from '../lib/hostedStore'
import { downloadBackup, importBackup } from '../lib/imageBackup'
import { useFreeAllowance, nearFreeLimit } from '../lib/useFreeAllowance'
import { useDialog } from '../lib/useDialog'

const SIGNIN_URL = 'https://app.unisim.co.uk/login'
// Nothing is for sale for the everyday apps (2026-10-03): at the free limit the
// note says how to make room, and one quiet link asks people who need more to
// tell us — that is the signal for when a paid tier is worth building. It is a
// support link, not a purchase link, so the phone apps show it too.
const NEED_MORE_URL = 'https://www.unisim.co.uk/support'
// Where a signed-in Universal ID with no company sets one up. Opened in a new
// tab so the images being worked on here are not navigated away from.
const SET_UP_COMPANY_URL = 'https://app.unisim.co.uk/branding'

// "Back up this image" — local processing stays free + on-device; the
// "Hosted by UNI·SIM" cloud option (one token per upload, refunded on delete) is
// gated behind a Universal ID. Backend: 0041 + the SDK hosted helpers.
//
// Copy rule (2026-09-30): the allowance is never put in front of anyone before
// they reach it. Signed out, the card only invites them to create a Universal
// ID for FREE; signed in, there is no token talk at all (a purchased-token
// count is the one exception). The limit is explained only once it is hit.
// Near it (80%+ of the shared free "files" pool, migration 0199) one neutral
// line gives the MB used — numbers read from free_allowance_status, never
// hardcoded, and never shown below 80% or signed out.
export default function HostedStoreDialog() {
  const open = useImageStore((s) => s.hostedStoreOpen)
  const setOpen = useImageStore((s) => s.setHostedStoreOpen)
  const hasImage = useImageStore((s) => !!s.images.find((i) => i.id === s.selectedId) && !!s.target)

  const { supabase, session, activeOrgId } = useUniversal()
  // Online copies are kept with a company, so a signed-in ID that belongs to
  // none has nowhere to store one. Only a SUCCESSFUL empty read counts as "no
  // company" — a failed read is unknown, and never a reason to offer one.
  const { orgs, loading: orgsLoading, error: orgsError } = useOrg()
  const noCompany = !orgsLoading && !orgsError && orgs.length === 0
  const { user } = useUser()
  const { credits, refresh: refreshCredits } = useCredits()
  // Every org gets one free returnable Images token (migration 0045) — the RPC
  // spends it before the purchased wallet, so the button gates on either.
  const { status: freeToken, refresh: refreshFreeToken } = useAppFreeToken('images')
  const { uploads, loading: listLoading, refresh: refreshList } = useHostedUploads('images')
  // The shared free "files" pool's numbers — only for the near-the-limit line.
  const { status: allowance, refresh: refreshAllowance } = useFreeAllowance('images', open)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justStored, setJustStored] = useState(false)
  // The one listed backup that turned out to have no file behind it, if any.
  const [missingId, setMissingId] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [importErr, setImportErr] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dialog = useDialog(() => close(), true, open)

  if (!open) return null

  const signedIn = !!session?.user && session.user.is_anonymous !== true
  const tokens = credits ?? 0
  const canStore = freeToken === 'available' || tokens > 0
  // Talk about the limit only once it is close: 80%+ used and still room. At
  // the limit the existing at-limit message takes over instead.
  const near = signedIn && !noCompany && freeToken === 'available' ? nearFreeLimit(allowance) : null
  // What we say once the free allowance is used up and nothing was bought.
  // 'held' can be freed by deleting a backup; 'spent' cannot.
  const limitMessage = (status: typeof freeToken) =>
    status === 'spent'
      ? "You've used your free online storage for images."
      : "You've used your free online storage for images. Delete a stored image to make room."

  function close() {
    setOpen(false)
    setError(null)
    setMissingId(null)
    setJustStored(false)
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

  async function onStore() {
    if (!hasImage || !activeOrgId || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await storeCurrentImage(supabase, activeOrgId)
      if (!res.ok) {
        setError(
          res.error === 'no_credits' || res.error === 'token_in_use'
            ? limitMessage(freeToken === 'spent' ? 'spent' : 'held')
            : res.error ?? 'Could not store this image.',
        )
      } else {
        setJustStored(true)
        refreshCredits()
        refreshFreeToken()
        refreshAllowance()
        refreshList()
        window.setTimeout(() => setJustStored(false), 2200)
      }
    } finally {
      setBusy(false)
    }
  }

  async function onOpen(upload: HostedUpload) {
    if (busy) return
    setBusy(true)
    setError(null)
    setMissingId(null)
    try {
      await openHostedImage(supabase, upload)
    } catch (e) {
      // A genuinely absent file is not an error to shrug at the user — it is a
      // dead entry, and the only useful thing to say is which one and what to
      // do about it. Anything else (offline, session expired) still surfaces as
      // an ordinary message, because deleting the backup would be the wrong
      // advice.
      if (e instanceof HostedObjectMissingError) setMissingId(upload.id)
      else setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(upload: HostedUpload) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await deleteHostedImage(supabase, upload)
      if (!res.ok) setError(res.error ?? 'Could not delete this image.')
      else {
        setMissingId((id) => (id === upload.id ? null : id))
        refreshCredits()
        refreshFreeToken()
        refreshAllowance()
        refreshList()
      }
    } finally {
      setBusy(false)
    }
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

        {/* Only the body scrolls. It used to be the whole panel, so on a phone
            the "Back up this image" title and its close button scrolled away
            the moment the tier cards outgrew the screen. */}
        <div className={`${DIALOG_BODY} space-y-4 p-5`}>
          {/* Tier 1 — On this device: free local resize + Download the result. */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">On this device</span>
              <Chip size="sm">Free</Chip>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Your images are resized entirely in this browser and never uploaded. Use Download to save the result to your device — free.
            </p>
          </div>

          {/* Tier 2 — Save to desktop: a re-importable backup file the guest keeps. */}
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

          {/* Tier 3 — Universal subscription: paid "Hosted by UNI·SIM" cloud. */}
          <div className="rounded-xl border border-orange-200 bg-white p-4 dark:border-orange-500/40 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hosted by UNI SIM</span>
              <Chip size="sm">Free with Universal ID</Chip>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Keep this resized image online against your Universal ID, so you can get it back on any device.
            </p>

            {!signedIn ? (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <p className="text-sm text-slate-700 dark:text-slate-200">Create a <strong>Universal ID</strong> to back up images online for FREE.</p>
                <a href={SIGNIN_URL} className="mt-2 inline-flex rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800">
                  Create / sign in with Universal ID →
                </a>
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex items-center justify-between rounded-lg bg-orange-50/60 px-3 py-2 text-sm dark:bg-orange-500/10">
                  <span className="text-slate-600 dark:text-slate-300">{user?.email}</span>
                  {tokens > 0 && (
                    <span className="font-semibold text-orange-700 dark:text-orange-300">
                      {`${tokens} purchased token${tokens === 1 ? '' : 's'}`}
                    </span>
                  )}
                </div>

                {noCompany ? (
                  <div className="mt-3" data-testid="hosted-no-company">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Online images are kept with your company, and your Universal ID doesn’t have one yet. Setting one up is free.
                    </p>
                    <a href={SET_UP_COMPANY_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800">
                      Set up a company →
                    </a>
                  </div>
                ) : hasImage ? (
                  canStore ? (
                    <button
                      onClick={onStore}
                      disabled={busy}
                      className="mt-3 w-full rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
                    >
                      {busy ? 'Backing up…' : justStored ? '✓ Backed up' : 'Back up this image online'}
                    </button>
                  ) : freeToken === null ? null : (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/40">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        {limitMessage(freeToken)}
                      </p>
                      <a href={NEED_MORE_URL} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs text-amber-800 underline underline-offset-2 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50">
                        Need more? Tell us
                      </a>
                    </div>
                  )
                ) : (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Select an image to back it up.</p>
                )}

                {near && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" data-testid="free-storage-near-limit">
                    {`You've used ${near.usedMb} MB of your ${near.limitMb} MB of free online storage. It's shared by Universal PDF, Images, Exports and Recorder.`}
                  </p>
                )}

                {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

                {/* The user's hosted images */}
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Your backups</p>
                  {listLoading ? (
                    <p className="text-xs text-slate-400">Loading…</p>
                  ) : uploads.length === 0 ? (
                    <p className="text-xs text-slate-400">None yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {uploads.map((u) => (
                        <li key={u.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium text-slate-700 dark:text-slate-200">{u.file_name || 'image'}</span>
                              <span className="block text-[10px] text-slate-400">{new Date(u.created_at).toLocaleDateString()}</span>
                            </span>
                            <button onClick={() => onOpen(u)} disabled={busy} className="shrink-0 rounded-md bg-orange-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-800 disabled:opacity-50">Open</button>
                            <button onClick={() => onDelete(u)} disabled={busy} className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50" title="Delete this backup">Delete</button>
                          </div>

                          {/* A backup with nothing behind it. Say which file,
                              say plainly that the upload never finished, and
                              make clearing it up one click (the token comes
                              back with it, though the copy no longer says so —
                              no token talk below the limit). This replaces storage's bare "Object not
                              found", which read like the app had mislaid the
                              user's image. */}
                          {missingId === u.id && (
                            <div
                              role="alert"
                              data-testid="hosted-missing"
                              className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-800/60 dark:bg-amber-950/40"
                            >
                              <p className="text-[11px] leading-snug text-amber-900 dark:text-amber-200">
                                <strong className="font-semibold">{u.file_name || 'image'}</strong> is listed here,
                                but there is no file behind it — this upload never finished, so nothing was ever stored.
                              </p>
                              <button
                                type="button"
                                onClick={() => onDelete(u)}
                                disabled={busy}
                                className="mt-2 inline-flex rounded-md bg-amber-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
                              >
                                Remove this entry
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
