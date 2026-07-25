import { useEffect, useRef, useState } from 'react'
import { useImageStore } from '../../stores/imageStore'

// The per-app "Actions" dropdown that slots into <UniversalAppsNavBar />.
// Holds Open-images and Clear-all actions; stays in sync with the store.
export default function AppMenu() {
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const metadataMap = useImageStore((s) => s.metadata)
  const setMetadataOpen = useImageStore((s) => s.setMetadataOpen)
  const addFiles = useImageStore((s) => s.addFiles)
  const clearAll = useImageStore((s) => s.clearAll)
  const hasImages = images.length > 0
  // Unlike the badge above the preview, this entry stays visible whether or not
  // metadata was found — "is there anything in this photo?" is a question worth
  // being able to ask, and a clean answer is a useful one.
  const selectedMeta = selectedId ? metadataMap[selectedId] ?? null : null

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) await addFiles(files)
    e.target.value = ''
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="h-9 px-3 rounded-md bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm"
      >
        Actions
        <svg viewBox="0 0 12 12" className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={onPick}
      />
      {open && (
        <div className="absolute left-0 mt-2 w-60 bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden">
          <button
            onClick={() => { fileInputRef.current?.click(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-emerald-50 hover:text-emerald-700 text-sm"
          >
            <span aria-hidden="true">🖼</span>
            <span className="flex-1 text-left font-medium">
              {hasImages ? 'Add more images…' : 'Open images…'}
            </span>
          </button>

          {hasImages && selectedId && (
            <button
              onClick={() => { setMetadataOpen(true); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-amber-50 hover:text-amber-800 text-sm border-t border-slate-100"
            >
              <span aria-hidden="true">🏷</span>
              <span className="flex-1 text-left">
                <span className="block font-medium leading-tight">Metadata</span>
                <span className="block text-[11px] text-slate-500 leading-tight">
                  {selectedMeta
                    ? 'See where and when this photo was taken — then scrub it'
                    : 'Check what this photo reveals about you'}
                </span>
              </span>
              {selectedMeta && selectedMeta.identifyingCount > 0 && (
                <span className="shrink-0 text-amber-600" title="Can identify you" aria-hidden="true">⚠</span>
              )}
            </button>
          )}

          {hasImages && (
            <button
              onClick={() => {
                if (confirm('Remove all images?')) {
                  clearAll()
                  setOpen(false)
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-red-50 hover:text-red-700 text-sm border-t border-slate-100"
            >
              <span aria-hidden="true">🗑</span>
              <span className="flex-1 text-left">Clear all images</span>
              <span className="text-[11px] text-slate-400 tabular-nums">{images.length}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
