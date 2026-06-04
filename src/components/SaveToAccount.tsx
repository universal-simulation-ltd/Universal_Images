import { useState } from 'react'
import { useUser } from '@unisim/sdk'
import { useImageStore } from '../stores/imageStore'

// "Save to account" — only rendered for visitors signed in with their
// Universal ID (useUser() returns a non-null user once the shared
// .unisim.co.uk session cookie is present). The core app stays 100% free and
// in-browser; this affordance is simply hidden for anonymous visitors.
//
// UI-only stage for now: there's no server-side image library yet, so a save
// records a lightweight descriptor (name + output dimensions + timestamp) to
// localStorage keyed by the user's id. Swap the body of save() for a real
// upload (Supabase Storage + an images table) when that lands. Mirrors
// Universal_QR/src/components/qr/SaveToAccount.tsx.
const SAVED_KEY = 'universal-images:saved'

export default function SaveToAccount() {
  const { user, loading } = useUser()
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const target = useImageStore((s) => s.target)
  const [status, setStatus] = useState<'idle' | 'saved' | 'fail'>('idle')

  const selected = images.find((i) => i.id === selectedId) ?? null

  // Hidden until we know the visitor is signed in, and only meaningful once an
  // image is selected.
  if (loading || !user || !selected || !target) return null

  function save() {
    if (!user || !selected || !target) return
    try {
      const raw = localStorage.getItem(SAVED_KEY)
      const all: Record<string, unknown[]> = raw ? JSON.parse(raw) : {}
      const mine = Array.isArray(all[user.id]) ? all[user.id] : []
      mine.push({
        savedAt: new Date().toISOString(),
        name: selected.name,
        width: target.width,
        height: target.height,
        format: target.format
      })
      all[user.id] = mine
      localStorage.setItem(SAVED_KEY, JSON.stringify(all))
      setStatus('saved')
    } catch (err) {
      console.error(err)
      setStatus('fail')
    }
    setTimeout(() => setStatus('idle'), 1800)
  }

  return (
    <button
      type="button"
      onClick={save}
      title={user.email ? `Save to ${user.email}` : 'Save to your account'}
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-orange-300 bg-orange-50 text-sm font-semibold text-orange-700 hover:bg-orange-100 hover:border-orange-400 transition-colors"
    >
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 4h8l2 2v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
        <path d="M7 4v4h5M7 17v-5h6v5" />
      </svg>
      {status === 'saved' ? '✓ Saved to account' : status === 'fail' ? "Couldn't save — try again" : 'Save to account'}
    </button>
  )
}
