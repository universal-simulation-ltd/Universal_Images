import { useState } from 'react'
import { useImageStore } from '../../stores/imageStore'

// Quick edits for the middle of the navbar while an image is open — the SDK's
// `centre` slot, which replaces the "100% Open Source (FREE)" claim. The claim
// is the right thing on the landing page and dead weight over an open image;
// this turns the bar into a working toolbar, the way Universal PDF's editor
// chrome does.
//
// Deliberately a SHORTCUT layer, not a second home for these features: every
// action here also lives in the side panel with its full controls (background
// fill colour, per-face toggles, crop nudging). What earns a spot is being one
// click away from useful with no configuration — so background removal and face
// blur, the two that are otherwise several scrolls down the panel.
//
// Hidden below `lg`: the editor's own panel is the whole screen on mobile, and
// half a toolbar is worse than none.
export default function EditShortcuts() {
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const bgOriginal = useImageStore((s) => s.bgOriginal)
  const removeBackground = useImageStore((s) => s.removeBackground)
  const restoreBackground = useImageStore((s) => s.restoreBackground)
  const faceOriginal = useImageStore((s) => s.faceOriginal)
  const faceBoxes = useImageStore((s) => s.faceBoxes)
  const detectingFaces = useImageStore((s) => s.detectingFaces)
  const detectFaces = useImageStore((s) => s.detectFaces)

  const [removingBg, setRemovingBg] = useState(false)

  const selected = images.find((i) => i.id === selectedId) ?? null
  // The store keeps ONE undo image at a time, tagged with the id it came from —
  // so "has this image had its background removed" is that tag matching, not
  // merely that some image somewhere has a saved original.
  const bgRemoved = !!bgOriginal && !!selected && bgOriginal.id === selected.id
  const facesBlurred = !!faceOriginal && !!selected && faceOriginal.id === selected.id
  const blurredCount = faceBoxes ? faceBoxes.filter((f) => f.enabled).length : 0

  if (!selected) return null

  async function onBackground() {
    if (removingBg) return
    if (bgRemoved) {
      restoreBackground()
      return
    }
    setRemovingBg(true)
    try {
      await removeBackground()
    } catch {
      // The side panel owns the error surface — it has the room to explain and
      // to offer a retry. Swallowing here keeps a failed shortcut from throwing
      // an unhandled rejection; the panel still shows what went wrong.
    } finally {
      setRemovingBg(false)
    }
  }

  async function onFaces() {
    if (detectingFaces) return
    try {
      await detectFaces()
    } catch {
      // As above — the panel reports face-detection failures.
    }
  }

  return (
    <div className="hidden lg:flex items-center gap-1">
      <Shortcut
        icon="🪄"
        label={removingBg ? 'Removing…' : bgRemoved ? 'Restore bg' : 'Remove bg'}
        title={bgRemoved ? 'Put the original background back' : 'Remove the background (runs on your device)'}
        active={bgRemoved}
        busy={removingBg}
        onClick={onBackground}
      />
      <Shortcut
        icon="🙈"
        label={detectingFaces ? 'Detecting…' : facesBlurred ? `Faces · ${blurredCount}` : 'Blur faces'}
        title={facesBlurred ? 'Faces blurred — open the panel to choose which' : 'Find faces and blur them (runs on your device)'}
        active={facesBlurred}
        busy={detectingFaces}
        onClick={onFaces}
      />
    </div>
  )
}

function Shortcut({
  icon,
  label,
  title,
  active,
  busy,
  onClick,
}: {
  icon: string
  label: string
  title: string
  active: boolean
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={title}
      aria-pressed={active}
      className={[
        'h-8 px-2.5 rounded-md text-[13px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors',
        'disabled:cursor-wait disabled:opacity-70',
        active
          ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      ].join(' ')}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  )
}
