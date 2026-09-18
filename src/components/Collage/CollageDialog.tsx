import { useEffect, useMemo, useRef, useState } from 'react'
import { useFileDrop } from '@unisim/sdk'
import { useImageStore } from '../../stores/imageStore'
import { useThemeStore } from '../../stores/themeStore'
import { DIALOG_BODY, DIALOG_FOOTER, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_PANEL } from '../../lib/dialog'
import { downloadBlob } from '../../lib/download'
import {
  LAYOUTS,
  SHAPES,
  clamp01,
  coverPlacement,
  drawCollage,
  emptySlot,
  hitSlot,
  layoutById,
  layoutCollage,
  type CollageLayout,
  type CollageShape,
  type CollageSlot,
  type Drawable,
} from '../../lib/collage'
import type { SourceImage } from '../../types/image'

// Several of the open photos on one canvas — one left and one right, one above
// the other, a big one with two beside it, a grid.
//
// How it is used: pick a layout, TAP a space, then tap a photo in the strip to
// put it there (a photo already in another space swaps with it). DRAG inside a
// space to choose which part of the photo shows; the zoom slider crops tighter.
// The result downloads, or goes back into the editor as a new image so every
// other tool (resize, formats, social sizes) works on it.
//
// Everything is drawn by `drawCollage` in lib/collage.ts: the preview is the
// export at a smaller scale, so what is on screen is what is saved.

const MAX_SLOTS = Math.max(...LAYOUTS.map((l) => l.slots))

// The long edge of the saved file. 4096 is the iOS canvas ceiling (16.7M
// pixels for a square) — a bigger canvas there silently draws BLANK.
const SIZES = [
  { px: 1080, label: '1080 px' },
  { px: 2048, label: '2048 px' },
  { px: 4096, label: '4096 px' },
]

const BACKGROUNDS: { id: string; label: string; value: string | null }[] = [
  { id: 'white', label: 'White', value: '#ffffff' },
  { id: 'black', label: 'Black', value: '#000000' },
  { id: 'none', label: 'Transparent', value: null },
]

// Preview decoding: a 12-megapixel photo redrawn on every pointer move is what
// makes dragging stutter on a phone, so the preview draws a copy no bigger than
// this. The export draws the full photo.
const PREVIEW_EDGE = 1400

interface Loaded { full: Drawable; preview: Drawable }

function loadDrawable(img: SourceImage): Promise<Loaded> {
  return new Promise((resolve, reject) => {
    const el = new Image()
    el.decoding = 'async'
    el.onload = () => {
      const w = el.naturalWidth || img.width
      const h = el.naturalHeight || img.height
      const full = { source: el, width: w, height: h }
      const k = Math.min(1, PREVIEW_EDGE / Math.max(w, h))
      if (k >= 1) return resolve({ full, preview: full })
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(w * k))
      c.height = Math.max(1, Math.round(h * k))
      const ctx = c.getContext('2d')
      if (!ctx) return resolve({ full, preview: full })
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(el, 0, 0, c.width, c.height)
      resolve({ full, preview: { source: c, width: w, height: h } })
    }
    el.onerror = () => reject(new Error(`Could not read ${img.name}`))
    el.src = img.objectUrl
  })
}

function fillSlots(prev: CollageSlot[], images: SourceImage[]): CollageSlot[] {
  // Keep every placement the user made; fill the empty spaces with photos that
  // are not in the collage yet, in the order they were opened; drop photos that
  // have since been removed from the app.
  const ids = new Set(images.map((i) => i.id))
  const next = Array.from({ length: MAX_SLOTS }, (_, i) => {
    const s = prev[i]
    return s && s.imageId && ids.has(s.imageId) ? s : emptySlot()
  })
  const used = new Set(next.map((s) => s.imageId).filter(Boolean))
  const spare = images.filter((i) => !used.has(i.id))
  for (const s of next) {
    if (!s.imageId && spare.length) s.imageId = spare.shift()!.id
  }
  return next
}

function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export default function CollageDialog({ onClose }: { onClose: () => void }) {
  const images = useImageStore((s) => s.images)
  const addFiles = useImageStore((s) => s.addFiles)
  const selectImage = useImageStore((s) => s.selectImage)
  const dark = useThemeStore((s) => s.effective) === 'dark'

  // Two photos → side by side, which is what "a collage" means most often.
  const [layoutId, setLayoutId] = useState(() => (images.length >= 4 ? 'grid4' : images.length === 3 ? 'bigL3' : 'row2'))
  const layout = layoutById(layoutId)
  const [shape, setShape] = useState<CollageShape>('fit')
  const [gap, setGap] = useState(2) // % of the long edge
  const [radius, setRadius] = useState(0) // % of a space's short side
  const [bgId, setBgId] = useState('white')
  const [customBg, setCustomBg] = useState('#ea580c')
  const [size, setSize] = useState(2048)
  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg')
  const [slots, setSlots] = useState<CollageSlot[]>(() => fillSlots([], images))
  const [selected, setSelected] = useState<number>(0)
  const [busy, setBusy] = useState<null | 'save' | 'add'>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({})

  // Photos added or removed while the dialog is open.
  useEffect(() => setSlots((prev) => fillSlots(prev, images)), [images])

  // Decode each open photo once.
  useEffect(() => {
    let live = true
    for (const img of images) {
      if (loaded[img.id]) continue
      loadDrawable(img)
        .then((d) => live && setLoaded((m) => ({ ...m, [img.id]: d })))
        .catch((e) => live && setError((e as Error).message))
    }
    return () => { live = false }
    // `loaded` is deliberately not a dependency — it is what this fills in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images])

  useEffect(() => {
    if (selected >= layout.slots) setSelected(0)
  }, [layout.slots, selected])

  const background = bgId === 'custom' ? customBg : BACKGROUNDS.find((b) => b.id === bgId)?.value ?? null
  // No alpha in a JPEG — a transparent background has to save as PNG.
  const outFormat = background === null ? 'image/png' : format
  const effectiveShape: CollageShape = shape === 'fit' && !layout.strip ? '1:1' : shape

  const active = slots.slice(0, layout.slots)
  const aspects = active.map((s) => {
    const d = s.imageId ? loaded[s.imageId]?.full : undefined
    return d ? d.width / d.height : 1
  })
  const geometryFor = (edge: number) => layoutCollage(layout, effectiveShape, aspects, edge, gap / 100)
  const geometry = geometryFor(size)

  // ---- preview ------------------------------------------------------------

  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ w: 600, h: 400 })
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    // Width from the frame; height from the window, so the frame can shrink to
    // the picture instead of leaving empty bands round a wide collage on a phone.
    const ro = new ResizeObserver(([e]) => {
      if (e) setBox({ w: e.contentRect.width, h: window.innerHeight * (window.innerWidth >= 768 ? 0.52 : 0.38) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // CSS size of the preview: the collage's shape, as big as the frame allows.
  const fit = Math.min(box.w / geometry.width, box.h / geometry.height)
  const cssW = Math.max(1, Math.floor(geometry.width * fit))
  const cssH = Math.max(1, Math.floor(geometry.height * fit))

  const previewImages = useMemo(() => {
    const m: Record<string, Drawable> = {}
    for (const [id, d] of Object.entries(loaded)) m[id] = d.preview
    return m
  }, [loaded])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(cssW * dpr)
    c.height = Math.round(cssH * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.scale(c.width / geometry.width, c.height / geometry.height)
    drawCollage(ctx, {
      geometry,
      slots: active,
      images: previewImages,
      background,
      radiusFrac: radius / 100,
      preview: { selected, dark },
    })
  })

  // Tap selects a space; drag slides the photo inside it.
  const drag = useRef<{ i: number; x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null)
  function toCanvas(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * geometry.width, y: ((e.clientY - r.top) / r.height) * geometry.height }
  }
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = toCanvas(e)
    const i = hitSlot(geometry, p.x, p.y)
    if (i < 0) return
    setSelected(i)
    const s = active[i]!
    drag.current = { i, x: p.x, y: p.y, ox: s.ox, oy: s.oy, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    if (!d) return
    const s = active[d.i]
    const img = s?.imageId ? loaded[s.imageId]?.full : undefined
    if (!s || !img) return
    const p = toCanvas(e)
    const dx = p.x - d.x
    const dy = p.y - d.y
    if (!d.moved && Math.hypot(dx, dy) < geometry.width * 0.004) return
    d.moved = true
    const r = geometry.rects[d.i]!
    const placed = coverPlacement(r, img.width, img.height, s)
    // The photo sits at x = space.x + (space.w − drawn.w)·ox, so moving it by
    // dx is a change in ox of dx / (space.w − drawn.w). No overflow on an axis
    // means nothing to slide along it.
    const spareX = r.w - placed.w
    const spareY = r.h - placed.h
    const ox = spareX < -0.5 ? clamp01(d.ox + dx / spareX) : s.ox
    const oy = spareY < -0.5 ? clamp01(d.oy + dy / spareY) : s.oy
    updateSlot(d.i, { ox, oy })
  }
  function onPointerUp() {
    drag.current = null
  }

  function updateSlot(i: number, patch: Partial<CollageSlot>) {
    setSlots((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  }

  // Put a photo in the selected space. If it is already in another visible
  // space the two swap, so a photo never appears twice by accident.
  function place(imageId: string) {
    setSlots((prev) => {
      const next = prev.map((s) => ({ ...s }))
      const cur = next[selected]!
      const other = next.findIndex((s, k) => k !== selected && k < layout.slots && s.imageId === imageId)
      if (other >= 0) next[other] = { ...emptySlot(), imageId: cur.imageId }
      next[selected] = { ...emptySlot(), imageId }
      return next
    })
    // Move on to the next empty space, so filling a grid is tap, tap, tap.
    const nextEmpty = active.findIndex((s, k) => k !== selected && !s.imageId)
    if (nextEmpty >= 0) setSelected(nextEmpty)
  }

  const picker = useFileDrop({ onFiles: addFiles, accept: 'image/*,.heic,.heif', clickToBrowse: false })

  // ---- export -------------------------------------------------------------

  async function render(): Promise<Blob> {
    const c = document.createElement('canvas')
    c.width = geometry.width
    c.height = geometry.height
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('This device could not make an image that size — try a smaller one')
    const full: Record<string, Drawable> = {}
    for (const [id, d] of Object.entries(loaded)) full[id] = d.full
    drawCollage(ctx, { geometry, slots: active, images: full, background, radiusFrac: radius / 100 })
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, outFormat, 0.92))
    // A canvas past the device's limit returns null (or an empty file) rather than throwing.
    if (!blob || blob.size === 0) throw new Error('This device could not make an image that size — try a smaller one')
    return blob
  }

  const filename = `collage-${stamp()}.${outFormat === 'image/png' ? 'png' : 'jpg'}`
  const filled = active.filter((s) => s.imageId).length
  const empty = layout.slots - filled

  async function onSave() {
    setError(null)
    setBusy('save')
    try {
      downloadBlob(await render(), filename)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function onAdd() {
    setError(null)
    setBusy('add')
    try {
      const blob = await render()
      await addFiles([new File([blob], filename, { type: outFormat })])
      const all = useImageStore.getState().images
      const added = all[all.length - 1]
      if (added?.name === filename) selectImage(added.id)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const sel = active[selected]
  const selImg = sel?.imageId ? images.find((i) => i.id === sel.imageId) : undefined

  const chip = (on: boolean) =>
    [
      'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
      on
        ? 'border-orange-400 bg-orange-50 text-orange-800 dark:border-orange-500/60 dark:bg-orange-500/15 dark:text-orange-200'
        : 'border-slate-200 text-slate-600 hover:border-orange-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-orange-500/60 dark:hover:text-white',
    ].join(' ')
  const label = 'text-[11px] uppercase tracking-wide text-slate-400 font-medium'

  return (
    <div
      className={`${DIALOG_OVERLAY} bg-black/50`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className={`${DIALOG_PANEL} bg-white rounded-xl shadow-2xl max-w-5xl sm:max-h-[92dvh] dark:bg-slate-900 dark:ring-1 dark:ring-slate-800`}>
        <div className={`${DIALOG_HEADER} flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800`}>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 dark:text-slate-100">
            <span aria-hidden="true">🧩</span>
            Collage
          </h2>
          {!busy && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>

        <div className={`${DIALOG_BODY} md:flex md:gap-5 px-5 py-4`}>
          {/* Preview + photo strip */}
          <div className="md:flex-1 md:min-w-0 flex flex-col gap-3">
            <div ref={frameRef} style={{ height: cssH }} className="flex items-center justify-center">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`${layout.label} collage, ${filled} of ${layout.slots} spaces filled`}
                style={{ width: cssW, height: cssH, touchAction: 'none' }}
                className={`${background === null ? 'checker-bg' : ''} rounded-md shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 cursor-grab active:cursor-grabbing`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Tap a space, then a photo below to put it there. Drag inside a space to move the photo.
            </p>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className={label}>
                  Photos · space {selected + 1} of {layout.slots}
                </span>
                <div className="flex gap-1">
                  <button type="button" className={chip(false)} aria-label="Previous space" onClick={() => setSelected((selected + layout.slots - 1) % layout.slots)}>‹</button>
                  <button type="button" className={chip(false)} aria-label="Next space" onClick={() => setSelected((selected + 1) % layout.slots)}>›</button>
                </div>
              </div>
              <input {...picker.inputProps} hidden />
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img) => {
                  const at = active.findIndex((s) => s.imageId === img.id)
                  const here = at === selected
                  return (
                    <li key={img.id} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => place(img.id)}
                        title={img.name}
                        aria-label={`Put ${img.name} in space ${selected + 1}`}
                        aria-pressed={here}
                        className={[
                          'relative block w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors',
                          here ? 'border-orange-500' : at >= 0 ? 'border-orange-200 dark:border-orange-500/40' : 'border-slate-200 hover:border-orange-300 dark:border-slate-700',
                        ].join(' ')}
                      >
                        <img src={img.objectUrl} alt="" className="w-full h-full object-cover" />
                        {at >= 0 && (
                          <span className="absolute bottom-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-600 px-1 text-[10px] font-bold text-white tabular-nums">
                            {at + 1}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={picker.open}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-orange-400 hover:text-orange-600 dark:border-slate-600 text-xl"
                    aria-label="Add more photos"
                    title="Add more photos"
                  >
                    +
                  </button>
                </li>
              </ul>
            </div>

            {selImg && sel && (
              <div className="flex items-center gap-3">
                <span className={label}>Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.05}
                  value={sel.zoom}
                  onChange={(e) => updateSlot(selected, { zoom: Number(e.target.value) })}
                  className="flex-1 accent-orange-600"
                  aria-label={`Zoom in space ${selected + 1}`}
                />
                <button type="button" className={chip(false)} onClick={() => updateSlot(selected, { zoom: 1, ox: 0.5, oy: 0.5 })}>
                  Reset
                </button>
                <button type="button" className={chip(false)} onClick={() => updateSlot(selected, emptySlot())}>
                  Empty
                </button>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="md:w-72 md:shrink-0 flex flex-col gap-4 mt-4 md:mt-0">
            <div>
              <div className={`${label} mb-1.5`}>Layout</div>
              <div className="grid grid-cols-4 gap-1.5">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLayoutId(l.id)}
                    title={l.label}
                    aria-label={l.label}
                    aria-pressed={l.id === layoutId}
                    className={`${chip(l.id === layoutId)} !p-1.5 flex items-center justify-center`}
                  >
                    <LayoutIcon layout={l} />
                  </button>
                ))}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{layout.label}</div>
            </div>

            <div>
              <div className={`${label} mb-1.5`}>Shape</div>
              <div className="flex flex-wrap gap-1.5">
                {SHAPES.filter((s) => s.id !== 'fit' || layout.strip).map((s) => (
                  <button key={s.id} type="button" className={chip(effectiveShape === s.id)} onClick={() => setShape(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
              {effectiveShape === 'fit' && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Each photo keeps its whole picture — nothing is cropped.</p>
              )}
            </div>

            <label className="block">
              <div className="flex justify-between">
                <span className={label}>Spacing</span>
                <span className="text-xs text-slate-500 tabular-nums">{gap === 0 ? 'None' : `${gap}%`}</span>
              </div>
              <input type="range" min={0} max={8} step={0.5} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-full accent-orange-600" />
            </label>

            <label className="block">
              <div className="flex justify-between">
                <span className={label}>Rounded corners</span>
                <span className="text-xs text-slate-500 tabular-nums">{radius === 0 ? 'None' : `${radius}%`}</span>
              </div>
              <input type="range" min={0} max={30} step={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-orange-600" />
            </label>

            <div>
              <div className={`${label} mb-1.5`}>Background</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {BACKGROUNDS.map((b) => (
                  <button key={b.id} type="button" className={chip(bgId === b.id)} onClick={() => setBgId(b.id)}>
                    {b.label}
                  </button>
                ))}
                <label className={`${chip(bgId === 'custom')} inline-flex items-center gap-1.5 cursor-pointer`}>
                  <input
                    type="color"
                    value={customBg}
                    onChange={(e) => { setCustomBg(e.target.value); setBgId('custom') }}
                    onClick={() => setBgId('custom')}
                    className="h-4 w-5 cursor-pointer border-0 bg-transparent p-0"
                  />
                  Colour
                </label>
              </div>
            </div>

            <div>
              <div className={`${label} mb-1.5`}>Size (long edge)</div>
              <div className="flex flex-wrap gap-1.5">
                {SIZES.map((s) => (
                  <button key={s.px} type="button" className={chip(size === s.px)} onClick={() => setSize(s.px)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {geometry.width} × {geometry.height} px
              </div>
            </div>

            <div>
              <div className={`${label} mb-1.5`}>Format</div>
              <div className="flex gap-1.5">
                <button type="button" className={chip(outFormat === 'image/jpeg')} disabled={background === null} onClick={() => setFormat('image/jpeg')}>
                  JPEG
                </button>
                <button type="button" className={chip(outFormat === 'image/png')} onClick={() => setFormat('image/png')}>
                  PNG
                </button>
              </div>
              {background === null && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">A transparent background saves as PNG — JPEG has no transparency.</p>
              )}
            </div>
          </div>
        </div>

        <div className={`${DIALOG_FOOTER} border-t border-slate-100 px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 dark:border-slate-800`}>
          <div className="text-xs sm:mr-auto">
            {error ? (
              <span className="text-red-600 dark:text-red-400">{error}</span>
            ) : empty > 0 ? (
              <span className="text-amber-700 dark:text-amber-300">
                {empty} empty space{empty === 1 ? '' : 's'} — {empty === 1 ? 'it saves' : 'they save'} as background.
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAdd}
              disabled={!!busy || filled === 0}
              className="flex-1 sm:flex-none rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Add the collage to your images, to resize or convert it like any other"
            >
              {busy === 'add' ? 'Adding…' : 'Add to images'}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!!busy || filled === 0}
              className="flex-1 sm:flex-none rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {busy === 'save' ? 'Saving…' : 'Download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// A layout's own geometry, drawn small — so the picker can never disagree with
// what the layout actually does.
function LayoutIcon({ layout }: { layout: CollageLayout }) {
  const g = layoutCollage(layout, layout.strip ? (layout.strip === 'row' ? '3:2' : '2:3') : '1:1', [], 28, 0.07)
  return (
    <svg viewBox={`0 0 ${g.width} ${g.height}`} className="h-7 w-7" aria-hidden="true">
      {g.rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={1.2} className="fill-current opacity-70" />
      ))}
    </svg>
  )
}
