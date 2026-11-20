import { useEffect, useRef } from 'react'
import { phoneListCopy, useLanguage, useUndo } from '@unisim/sdk'
import { useNT } from './strings'

// "Delete offers Undo" (BRANDING.md ▸ "A deletable row swipes: delete one way,
// a second action the other"): a picture swiped out of the grid can be put
// back for six seconds, with its edits. The countdown is the SDK phone kit's `useUndo`; this is the
// toast that shows it.
//
// It lives with the phone chrome, not with the grid, because the grid can go
// with the picture: taking the last one out closes the grid's page and opens
// the landing page, and the Undo has to outlast that.

export interface UndoOffer {
  /** The picture's name, for "Removed …". */
  name: string
  /** Put it back. */
  restore: () => void
  /** The Undo has gone without being used (timed out, or the next one came): free what it kept. */
  forget?: () => void
}

let offerTo: ((offer: UndoOffer) => void) | null = null

/** A row has gone: offer it back (a no-op until the toast is mounted). */
export function offerUndo(offer: UndoOffer): void {
  if (offerTo) offerTo(offer)
  else offer.forget?.()
}

/** Mounted once, with the phone chrome. */
export function UndoToast() {
  const t = useNT()
  const { language } = useLanguage()
  const restored = useRef(new WeakSet<UndoOffer>())
  const undo = useUndo<UndoOffer>((offer) => {
    restored.current.add(offer)
    offer.restore()
  })
  const live = useRef(undo)
  live.current = undo
  useEffect(() => {
    offerTo = (offer) => live.current.deleted(offer)
    return () => {
      offerTo = null
    }
  }, [])
  // An offer that leaves without its Undo (six seconds up, or replaced by the
  // next) is forgotten: the picture's preview and snapshots are freed then.
  const shown = useRef<UndoOffer | null>(null)
  useEffect(() => {
    const was = shown.current
    if (was && was !== undo.item && !restored.current.has(was)) was.forget?.()
    shown.current = undo.item
  }, [undo.item])
  if (!undo.item) return null
  return (
    <div
      role="status"
      data-undo-toast
      // Above the home indicator (or a docked tray's --u-dock-space, which
      // already counts it, should the app ever grow one). Over the grid's
      // page: the phone kit stacks its layers from z-index 1200.
      className="fixed left-1/2 z-[1500] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-slate-900 px-4 py-2.5 text-[15px] text-white shadow-xl dark:bg-slate-100 dark:text-slate-950"
      style={{ bottom: 'calc(1rem + max(var(--u-dock-space, 0px), env(safe-area-inset-bottom, 0px)))' }}
    >
      <span className="min-w-0 truncate">{t('app.removed_named', { name: undo.item.name })}</span>
      <button
        type="button"
        onClick={() => void undo.undo()}
        className="shrink-0 min-h-[36px] px-1 font-semibold text-orange-400 dark:text-orange-700"
      >
        {phoneListCopy(language).undo}
      </button>
    </div>
  )
}
