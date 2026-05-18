import { useEffect, useRef, useState } from 'react'
import { useImageStore } from '../../stores/imageStore'

export default function AppMenu() {
  const images = useImageStore((s) => s.images)
  const addFiles = useImageStore((s) => s.addFiles)
  const clearAll = useImageStore((s) => s.clearAll)
  const hasImages = images.length > 0

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
        title="Universal Images — menu"
        className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-white/5 transition-colors text-white"
      >
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-orange-600 text-white">
          <svg
            viewBox="0 0 16 16"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1.5" y="2.75" width="13" height="10.5" rx="1.5" />
            <circle cx="5" cy="6" r="1.1" fill="currentColor" stroke="none" />
            <path d="M2.5 11 L5.5 7.8 L8 9.8 L10.5 7 L13.5 10.2" />
          </svg>
        </span>
        <span className="hidden sm:inline font-semibold tracking-tight">Universal Images</span>
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
            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-orange-50 hover:text-orange-700 text-sm"
          >
            <span aria-hidden="true">🖼</span>
            <span className="flex-1 text-left font-medium">
              {hasImages ? 'Add more images…' : 'Open images…'}
            </span>
          </button>

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
