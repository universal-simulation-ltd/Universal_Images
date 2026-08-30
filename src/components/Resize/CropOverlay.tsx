import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SourceCrop, SourceImage } from '../../types/image'

interface Props {
  image: SourceImage
  /** Current crop in source pixels, or null when nothing is cropped yet. */
  crop: SourceCrop | null
  /** Live update — pass null to clear the crop. */
  onChange: (rect: { x: number; y: number; width: number; height: number } | null) => void
  /**
   * "Committed" = the user accepted the crop (tick / Enter). Owned by the parent
   * so the preview underneath can hide the encoded-output image while the crop
   * is still being EDITED (otherwise the full-size source drawn here and the
   * target-size encoded preview show at once — the "two overlapping images" bug).
   */
  committed: boolean
  onCommittedChange: (v: boolean) => void
  /**
   * Where the parent has drawn the encoded result inside this pane, in pane
   * pixels. That box IS the crop region on screen, so it's what the committed
   * chrome (adjust handles, crop-within-a-crop) is measured against. Null until
   * the pane has been measured.
   */
  resultRect: { left: number; top: number; width: number; height: number } | null
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
type Mode = 'draw' | 'move' | Handle
/**
 * Source pixels → pane pixels: `screen = left + source * s`. The scale is
 * per-axis because the encoded result is drawn with `object-fill`, so a custom
 * output size with a different aspect ratio stretches it — the mapping has to
 * stretch with it or the handles drift off the picture.
 */
type View = { left: number; top: number; sx: number; sy: number }
/** What a gesture is editing: the real crop, or the pending crop-within-a-crop. */
type Subject = 'crop' | 'sub'

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN = 8 // minimum crop size in source pixels

const HANDLE_CURSOR: Record<Handle, string> = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize'
}

function toScreen(v: View, r: SourceCrop) {
  return { left: v.left + r.x * v.sx, top: v.top + r.y * v.sy, width: r.width * v.sx, height: r.height * v.sy }
}

/**
 * Live, non-destructive crop layer. There is no separate "crop mode": this sits
 * over the preview, and
 *   - with no crop yet, a mouse drag draws one;
 *   - with a crop being edited, dragging inside moves it and dragging a handle
 *     resizes it, against the whole source image;
 *   - with an ACCEPTED crop, those same gestures work on the cropped result
 *     itself — the handles round its edge adjust the crop (the source fades
 *     back in while you drag, so picture the result doesn't contain can still be
 *     pulled in), and a drag inside it draws a crop within the crop.
 * The crop is reported in source pixels and consumed by the export pipeline, so
 * the source image is never rewritten and changing the size preset just
 * re-exports the same region. Esc clears the crop.
 */
export default function CropOverlay({ image, crop, onChange, committed, onCommittedChange, resultRect }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  // `started` guards the draw gesture: a fresh draw doesn't emit a crop until
  // the pointer has actually moved past MIN, so a plain click never creates a
  // degenerate (1×1) crop — which the store would otherwise clamp up from 0×0
  // and then lock the export target to. It is also what keeps a stray click on
  // an accepted crop from disturbing it.
  const gesture = useRef<{ mode: Mode; subject: Subject; view: View; startPt: { x: number; y: number }; startRect: SourceCrop; started: boolean } | null>(null)
  // A crop drawn INSIDE an accepted crop, held locally until accepted: emitting
  // it live would re-encode the preview underneath the very rectangle being
  // drawn, so the picture would zoom away mid-drag. Accepting just replaces the
  // crop — it is already in source pixels, and a crop within a crop is only a
  // smaller region of the same source, so there is nothing to compose.
  const [sub, setSub] = useState<SourceCrop | null>(null)
  // While a handle on the accepted result is being dragged the source comes
  // back, anchored so the crop stays exactly where the result was — that is what
  // lets the crop be pulled back OUT over picture the result doesn't contain.
  // Frozen at pointer-down: the live crop changes would otherwise move the
  // ground under the cursor.
  const [adjustView, setAdjustView] = useState<View | null>(null)
  // "Committed" (parent-owned): the user accepted the crop (tick / Enter), so
  // the full-image editing chrome is hidden and the cropped result preview
  // underneath shows through. The crop itself stays in the store and is still
  // applied to the export — accepting only collapses the full-image editor. A
  // plain click on the result does NOT re-open it (that read as "my crop was
  // undone", because the whole photo and the dashed box came straight back).
  const setCommitted = onCommittedChange

  useEffect(() => {
    if (!crop || !committed) setSub(null)
  }, [crop, committed])

  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    function update() {
      const node = wrapperRef.current
      if (!node) return
      setBox({ w: node.clientWidth, h: node.clientHeight })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = box.w && box.h ? Math.min(box.w / image.width, box.h / image.height) : 1
  const drawnW = image.width * scale
  const drawnH = image.height * scale
  const drawnLeft = (box.w - drawnW) / 2
  const drawnTop = (box.h - drawnH) / 2
  const whole: SourceCrop = { x: 0, y: 0, width: image.width, height: image.height }

  /** The whole source fitted to the pane — the view used while editing. */
  const fitView: View = { left: drawnLeft, top: drawnTop, sx: scale, sy: scale }
  /** The accepted result as the parent drew it — the view used once committed. */
  const resultView: View | null = (() => {
    if (!crop || !resultRect || !crop.width || !crop.height) return null
    const sx = resultRect.width / crop.width
    const sy = resultRect.height / crop.height
    return { sx, sy, left: resultRect.left - crop.x * sx, top: resultRect.top - crop.y * sy }
  })()
  // Committed *and* measurable: the committed chrome and its gestures key off
  // this rather than `committed` alone, so an unmeasured pane stays inert.
  const onResult = committed && !!crop && !!resultView

  function clientToSource(view: View, clientX: number, clientY: number, bounds: SourceCrop) {
    const wb = wrapperRef.current!.getBoundingClientRect()
    return {
      x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, (clientX - wb.left - view.left) / view.sx)),
      y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, (clientY - wb.top - view.top) / view.sy))
    }
  }

  function inside(r: SourceCrop, pt: { x: number; y: number }) {
    return pt.x >= r.x && pt.x <= r.x + r.width && pt.y >= r.y && pt.y <= r.y + r.height
  }

  function onPointerDown(e: React.PointerEvent) {
    // Touch on empty space (no crop) = scroll the panel, don't hijack it.
    if (e.pointerType !== 'mouse' && !crop) return
    if (committed && !onResult) return
    const view = onResult ? resultView! : fitView
    const dataHandle = (e.target as HTMLElement).dataset.handle as Mode | undefined
    const handle = dataHandle && dataHandle !== 'move' ? (dataHandle as Handle) : null
    let mode: Mode
    let subject: Subject = 'crop'
    let startRect: SourceCrop
    let startPt: { x: number; y: number }

    if (onResult) {
      // On the accepted result: a handle adjusts the crop, a drag inside draws a
      // crop within it. Neither can act on a plain click (see `started`).
      const ptCrop = clientToSource(view, e.clientX, e.clientY, crop!)
      if (sub) {
        startPt = ptCrop
        subject = 'sub'
        if (handle) { mode = handle; startRect = sub }
        else if (dataHandle === 'move' || inside(sub, ptCrop)) { mode = 'move'; startRect = sub }
        else { mode = 'draw'; startRect = { x: ptCrop.x, y: ptCrop.y, width: 0, height: 0 } }
      } else if (handle) {
        mode = handle
        subject = 'crop'
        startRect = crop!
        startPt = clientToSource(view, e.clientX, e.clientY, whole)
      } else {
        mode = 'draw'
        subject = 'sub'
        startRect = { x: ptCrop.x, y: ptCrop.y, width: 0, height: 0 }
        startPt = ptCrop
      }
    } else {
      const pt = clientToSource(view, e.clientX, e.clientY, whole)
      startPt = pt
      if (handle) mode = handle
      else if (crop && (dataHandle === 'move' || inside(crop, pt))) mode = 'move'
      else mode = 'draw'
      startRect = crop ?? { x: pt.x, y: pt.y, width: 0, height: 0 }
    }

    e.preventDefault()
    // Take focus so Enter (accept) / Esc (back out) are captured by the overlay
    // rather than landing on whatever was focused before the drag.
    wrapperRef.current?.focus({ preventScroll: true })
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* no active pointer (e.g. synthetic) */ }
    // A move/resize gesture is "started" immediately (it edits an existing rect);
    // a draw only starts once the pointer moves past MIN (see onPointerMove), so
    // a click never spawns a crop — nor disturbs one that has been accepted.
    gesture.current = { mode, subject, view, startPt, startRect, started: mode !== 'draw' }
    // Adjusting an accepted crop brings the source back, anchored to the result.
    if (onResult && subject === 'crop') setAdjustView(view)
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current
    if (!g) return
    // A crop within a crop lives inside the crop; the crop lives inside the image.
    const bounds = g.subject === 'sub' && crop ? crop : whole
    const emit = g.subject === 'sub' ? (r: SourceCrop) => setSub(r) : onChange
    const pt = clientToSource(g.view, e.clientX, e.clientY, bounds)

    if (g.mode === 'draw') {
      const w = Math.abs(pt.x - g.startPt.x)
      const h = Math.abs(pt.y - g.startPt.y)
      // Ignore the sub-threshold jitter of a click/tap so no crop is created
      // until the pointer has genuinely dragged.
      if (!g.started && w < MIN && h < MIN) return
      g.started = true
      emit({
        x: Math.min(g.startPt.x, pt.x),
        y: Math.min(g.startPt.y, pt.y),
        width: w,
        height: h
      })
      return
    }

    if (g.mode === 'move') {
      const dx = pt.x - g.startPt.x
      const dy = pt.y - g.startPt.y
      const x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - g.startRect.width, g.startRect.x + dx))
      const y = Math.max(bounds.y, Math.min(bounds.y + bounds.height - g.startRect.height, g.startRect.y + dy))
      emit({ x, y, width: g.startRect.width, height: g.startRect.height })
      return
    }

    // Resize: move only the edges named in the handle; the rest stay put.
    let left = g.startRect.x
    let right = g.startRect.x + g.startRect.width
    let top = g.startRect.y
    let bottom = g.startRect.y + g.startRect.height
    if (g.mode.includes('w')) left = pt.x
    if (g.mode.includes('e')) right = pt.x
    if (g.mode.includes('n')) top = pt.y
    if (g.mode.includes('s')) bottom = pt.y
    emit({
      x: Math.min(left, right),
      y: Math.min(top, bottom),
      width: Math.max(MIN, Math.abs(right - left)),
      height: Math.max(MIN, Math.abs(bottom - top))
    })
  }

  function onPointerUp() {
    const g = gesture.current
    gesture.current = null
    setAdjustView(null)
    // A draw that started but never grew into a usable box clears the sliver.
    // A draw that never started (a plain click) leaves everything alone.
    if (g?.mode !== 'draw' || !g.started) return
    if (g.subject === 'sub') {
      if (sub && (sub.width < MIN || sub.height < MIN)) setSub(null)
    } else if (crop && (crop.width < MIN || crop.height < MIN)) {
      onChange(null)
    }
  }

  function acceptSub() {
    if (!sub || sub.width < MIN || sub.height < MIN) return
    onChange(sub)
    setSub(null)
  }

  // Enter accepts (commits) the crop, or the crop within it when one is being
  // drawn; Esc backs out of whichever of the two is in play. Previously only Esc
  // was handled, so pressing Enter fell through to whatever element had focus
  // (e.g. the remove "✕" button → the crop was deleted) — surprising.
  function onKeyDown(e: React.KeyboardEvent) {
    if (!crop) return
    if (e.key === 'Enter') {
      e.preventDefault()
      if (sub) acceptSub()
      else if (!committed && crop.width >= MIN && crop.height >= MIN) setCommitted(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (sub) setSub(null)
      else onChange(null)
    }
  }

  /** Dim everything inside `area` except `rect`, both in source pixels. */
  function Mask({ view, area, rect }: { view: View; area: SourceCrop; rect: SourceCrop }) {
    const a = toScreen(view, area)
    const r = toScreen(view, rect)
    const cls = 'pointer-events-none absolute bg-slate-900/55'
    return (
      <>
        <div className={cls} style={{ left: a.left, top: a.top, width: a.width, height: r.top - a.top }} />
        <div className={cls} style={{ left: a.left, top: r.top + r.height, width: a.width, height: a.top + a.height - (r.top + r.height) }} />
        <div className={cls} style={{ left: a.left, top: r.top, width: r.left - a.left, height: r.height }} />
        <div className={cls} style={{ left: r.left + r.width, top: r.top, width: a.left + a.width - (r.left + r.width), height: r.height }} />
      </>
    )
  }

  /** The eight resize handles around `rect`. */
  function Handles({ view, rect, subtle = false }: { view: View; rect: SourceCrop; subtle?: boolean }) {
    const r = toScreen(view, rect)
    return (
      <>
        {HANDLES.map((h) => {
          const cx = h.includes('w') ? r.left : h.includes('e') ? r.left + r.width : r.left + r.width / 2
          const cy = h.includes('n') ? r.top : h.includes('s') ? r.top + r.height : r.top + r.height / 2
          return (
            <div
              key={h}
              data-handle={h}
              title={subtle ? 'Drag to adjust the crop' : undefined}
              className={[
                'absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-sm bg-white shadow',
                subtle ? 'ring-1 ring-orange-700/70' : 'ring-1 ring-slate-500'
              ].join(' ')}
              style={{ left: cx, top: cy, cursor: HANDLE_CURSOR[h] }}
            />
          )
        })}
      </>
    )
  }

  const editing = !!crop && !committed
  const editRect = editing ? toScreen(fitView, crop!) : null
  const adjustRect = onResult && adjustView ? toScreen(adjustView, crop!) : null
  const subRect = onResult && sub ? toScreen(resultView!, sub) : null

  return (
    <div
      ref={wrapperRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`absolute inset-0 select-none outline-none cursor-crosshair ${crop ? 'touch-none' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Source image is only shown while a crop is being EDITED — in the
          full-image editor here, or anchored under the result further down while
          an accepted crop's handle is dragged. Once accepted it is hidden so the
          cropped encoded-output preview shows. */}
      {editing && editRect && (
        <>
          <img
            src={image.objectUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{ left: drawnLeft, top: drawnTop, width: drawnW, height: drawnH }}
          />
          <Mask view={fitView} area={whole} rect={crop!} />

          {/* crop rectangle — pointer-events on so dragging inside moves it */}
          <div
            data-handle="move"
            className="absolute border-2 border-dashed border-white shadow-[0_0_0_1px_rgba(15,23,42,0.5)] cursor-move"
            style={editRect}
          />
          <Handles view={fitView} rect={crop!} />

          {/* dims label */}
          <div
            className="pointer-events-none absolute bg-slate-900/90 text-white text-xs font-medium tabular-nums px-2 py-1 rounded-md whitespace-nowrap"
            style={{ left: Math.max(drawnLeft, editRect.left), top: editRect.top + editRect.height + 8 }}
          >
            {Math.round(crop!.width)} × {Math.round(crop!.height)} px
          </div>
          {/* Accept crop (tick) — collapses the editor and shows the cropped
              result. Keyboard activation is suppressed so a focused button
              doesn't swallow Enter; Enter is handled by the wrapper (accept). */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault() }}
            onClick={() => { if (crop!.width >= MIN && crop!.height >= MIN) setCommitted(true) }}
            title="Apply crop (Enter)"
            aria-label="Apply crop"
            className="absolute w-7 h-7 rounded-full bg-orange-700 text-white hover:bg-orange-800 shadow-md ring-1 ring-orange-700/40 flex items-center justify-center"
            style={{ left: editRect.left + editRect.width - 48, top: editRect.top - 14 }}
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
          </button>
          {/* Remove crop (✕) */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault() }}
            onClick={() => onChange(null)}
            title="Remove crop (Esc)"
            aria-label="Remove crop"
            className="absolute w-7 h-7 rounded-full bg-white text-slate-700 hover:bg-slate-100 shadow-md ring-1 ring-slate-300 flex items-center justify-center text-sm"
            style={{ left: editRect.left + editRect.width - 14, top: editRect.top - 14 }}
          >
            {/* ⚠️ An SVG, not `✕`: U+2715 has no glyph in iOS's system font
                and WebKit will not fall back, so this drew as ▯?▯ — on the one
                control that gets rid of the crop. Matches the tick above. */}
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
            </svg>
          </button>
        </>
      )}

      {/* Accepted crop, handle being dragged: the source comes back anchored so
          the crop sits exactly where the result was and the picture around it
          can be pulled back in. The backdrop hides the encoded result
          underneath, which is re-encoding as the crop changes. */}
      {onResult && adjustView && adjustRect && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-white checker-bg" />
          {/* max-w-none: preflight caps images at max-width:100%, which silently
              squashes this one (it is drawn wider than the pane by design) and
              slides it out of register with the crop box. */}
          <img
            src={image.objectUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{
              left: adjustView.left,
              top: adjustView.top,
              width: image.width * adjustView.sx,
              height: image.height * adjustView.sy
            }}
          />
          <Mask view={adjustView} area={whole} rect={crop!} />
          <div
            className="pointer-events-none absolute border-2 border-dashed border-white shadow-[0_0_0_1px_rgba(15,23,42,0.5)]"
            style={adjustRect}
          />
          <Handles view={adjustView} rect={crop!} subtle />
          <div
            className="pointer-events-none absolute bg-slate-900/90 text-white text-xs font-medium tabular-nums px-2 py-1 rounded-md whitespace-nowrap"
            style={{ left: adjustRect.left, top: adjustRect.top + adjustRect.height + 8 }}
          >
            {Math.round(crop!.width)} × {Math.round(crop!.height)} px
          </div>
        </>
      )}

      {/* A crop within the crop, drawn straight onto the result. Nothing is
          applied until it is accepted, so the picture stays put while it's
          drawn. */}
      {onResult && sub && subRect && !adjustView && (
        <>
          <Mask view={resultView!} area={crop!} rect={sub} />
          <div
            data-handle="move"
            className="absolute border-2 border-dashed border-white shadow-[0_0_0_1px_rgba(15,23,42,0.5)] cursor-move"
            style={subRect}
          />
          <Handles view={resultView!} rect={sub} />
          <div
            className="pointer-events-none absolute bg-slate-900/90 text-white text-xs font-medium tabular-nums px-2 py-1 rounded-md whitespace-nowrap"
            style={{ left: Math.max(resultRect!.left, subRect.left), top: subRect.top + subRect.height + 8 }}
          >
            {Math.round(sub.width)} × {Math.round(sub.height)} px
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault() }}
            onClick={acceptSub}
            title="Apply crop (Enter)"
            aria-label="Apply crop"
            className="absolute w-7 h-7 rounded-full bg-orange-700 text-white hover:bg-orange-800 shadow-md ring-1 ring-orange-700/40 flex items-center justify-center"
            style={{ left: subRect.left + subRect.width - 48, top: subRect.top - 14 }}
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
          </button>
          {/* Discard just this inner crop — the accepted crop is untouched. */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault() }}
            onClick={() => setSub(null)}
            title="Discard this crop (Esc)"
            aria-label="Discard this crop"
            className="absolute w-7 h-7 rounded-full bg-white text-slate-700 hover:bg-slate-100 shadow-md ring-1 ring-slate-300 flex items-center justify-center text-sm"
            style={{ left: subRect.left + subRect.width - 14, top: subRect.top - 14 }}
          >
            {/* ⚠️ An SVG, not `✕`: U+2715 has no glyph in iOS's system font
                and WebKit will not fall back, so this drew as ▯?▯ — on the one
                control that gets rid of the crop. Matches the tick above. */}
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
            </svg>
          </button>
        </>
      )}

      {/* Accepted crop at rest: the cropped result shows through, ringed by the
          handles that adjust it. The pill re-opens the whole photo, for a big
          change or to move the crop somewhere else entirely. */}
      {onResult && !sub && !adjustView && (
        <>
          <div
            className="pointer-events-none absolute ring-1 ring-orange-700/60"
            style={toScreen(resultView!, crop!)}
          />
          <Handles view={resultView!} rect={crop!} subtle />
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setCommitted(false)}
            title="Edit the crop against the whole photo"
            className="absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 bg-slate-900/85 hover:bg-slate-900 text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow-md"
          >
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M13 4l3 3-8 8H5v-3z" />
            </svg>
            Edit crop
          </button>
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 hidden md:block">
            <div className="bg-slate-900/80 text-white text-[11px] px-3 py-1.5 rounded-full">
              Drag a handle to adjust · drag inside to crop again
            </div>
          </div>
        </>
      )}

      {!crop && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 hidden md:block">
          <div className="bg-slate-900/80 text-white text-[11px] px-3 py-1.5 rounded-full">
            Drag to crop
          </div>
        </div>
      )}
    </div>
  )
}
