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
// ⚠️ These used to be `hidden lg:flex`, which meant the iPhone app — where the
// side panel is the whole screen and those two tools are furthest away — had no
// shortcuts at all. They are on every width now, but they cannot simply drop
// the breakpoint: at 390px the bar has roughly 160px of slack between the home
// button and the Actions/profile cluster, and the two labelled buttons want
// ~190px. So below `lg` the label is dropped and the button becomes a square
// icon, which fits twice over.
//
// What the label was carrying has to survive that. It moves to `aria-label`
// (so a screen reader still hears "Removing…" / "Restore bg" / "Faces · 3")
// and `title`; the two states a label was doing VISUAL work for get a visual
// form instead — a spinner in place of the icon while a run is in flight, and
// a count badge on the corner when faces are blurred. The orange pressed state
// was already carrying "this is on" at both sizes.
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
    <div className="flex items-center gap-1">
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
        // The count is the one piece of the label that is data rather than a
        // name, so it is the piece that needs a home when the label goes.
        badge={facesBlurred && !detectingFaces ? blurredCount : null}
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
  badge = null,
  onClick,
}: {
  icon: string
  label: string
  title: string
  active: boolean
  busy: boolean
  badge?: number | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      // `title` explains, `aria-label` states — and below `lg` the aria-label is
      // the ONLY place the state is written down, so it is not optional here.
      title={`${label} — ${title}`}
      aria-label={label}
      aria-pressed={active}
      aria-busy={busy}
      className={[
        // A 38px square below `lg` (icon only), the original label pill from
        // `lg` up. 38px is the size and the chrome of the bar's own home
        // button, and for the same reason the SDK gives it that chrome: a bare
        // glyph on a white bar does not read as something you can press.
        'relative h-[38px] w-[38px] justify-center rounded-xl border border-slate-200 bg-white text-base',
        'lg:h-8 lg:w-auto lg:rounded-md lg:border-0 lg:bg-transparent lg:px-2.5 lg:text-[13px]',
        'font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors',
        'disabled:cursor-wait disabled:opacity-70',
        active
          ? 'border-orange-200 bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100 lg:bg-orange-50'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hover:bg-slate-100',
      ].join(' ')}
    >
      {busy ? <Spinner /> : <span aria-hidden>{icon}</span>}
      <span className="hidden lg:inline">{label}</span>
      {badge != null && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-none text-white tabular-nums lg:hidden"
        >
          {badge}
        </span>
      )}
    </button>
  )
}

// Stands in for the icon while a run is in flight. On a phone the label — the
// only other thing that said "Removing…" — is not rendered, so without this a
// busy button is just a slightly faded emoji.
function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
