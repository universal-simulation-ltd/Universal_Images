import { useLayoutEffect, useRef, useState } from 'react'
import type { SourceCrop, SourceImage } from '../../types/image'

interface Props {
  image: SourceImage
  /** Current crop in source pixels, or null when nothing is cropped yet. */
  crop: SourceCrop | null
  /** Live update — pass null to clear the crop. */
  onChange: (rect: { x: number; y: number; width: number; height: number } | null) => void
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
type Mode = 'draw' | 'move' | Handle
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN = 8 // minimum crop size in source pixels

const HANDLE_CURSOR: Record<Handle, string> = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize'
}

/**
 * Live, non-destructive crop layer. There is no separate "crop mode": this
 * sits over the preview, and
 *   - with no crop yet, a mouse drag draws one;
 *   - with a crop, dragging inside moves it and dragging a handle resizes it.
 * The crop is reported in source pixels and consumed by the export pipeline, so
 * the source image is never rewritten and changing the size preset just
 * re-exports the same region. Esc clears the crop.
 */
export default function CropOverlay({ image, crop, onChange }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const gesture = useRef<{ mode: Mode; startPt: { x: number; y: number }; startRect: SourceCrop } | null>(null)

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

  function clientToSource(clientX: number, clientY: number) {
    const wb = wrapperRef.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(image.width, (clientX - wb.left - drawnLeft) / scale)),
      y: Math.max(0, Math.min(image.height, (clientY - wb.top - drawnTop) / scale))
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    // Touch on empty space (no crop) = scroll the panel, don't hijack it.
    if (e.pointerType !== 'mouse' && !crop) return
    const dataHandle = (e.target as HTMLElement).dataset.handle as Mode | undefined
    const pt = clientToSource(e.clientX, e.clientY)
    let mode: Mode
    if (dataHandle) {
      mode = dataHandle
    } else if (crop && pt.x >= crop.x && pt.x <= crop.x + crop.width && pt.y >= crop.y && pt.y <= crop.y + crop.height) {
      mode = 'move'
    } else {
      mode = 'draw'
    }
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* no active pointer (e.g. synthetic) */ }
    gesture.current = { mode, startPt: pt, startRect: crop ?? { x: pt.x, y: pt.y, width: 0, height: 0 } }
    if (mode === 'draw') onChange({ x: pt.x, y: pt.y, width: 0, height: 0 })
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current
    if (!g) return
    const pt = clientToSource(e.clientX, e.clientY)

    if (g.mode === 'draw') {
      onChange({
        x: Math.min(g.startPt.x, pt.x),
        y: Math.min(g.startPt.y, pt.y),
        width: Math.abs(pt.x - g.startPt.x),
        height: Math.abs(pt.y - g.startPt.y)
      })
      return
    }

    if (g.mode === 'move') {
      const dx = pt.x - g.startPt.x
      const dy = pt.y - g.startPt.y
      const x = Math.max(0, Math.min(image.width - g.startRect.width, g.startRect.x + dx))
      const y = Math.max(0, Math.min(image.height - g.startRect.height, g.startRect.y + dy))
      onChange({ x, y, width: g.startRect.width, height: g.startRect.height })
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
    onChange({
      x: Math.min(left, right),
      y: Math.min(top, bottom),
      width: Math.max(MIN, Math.abs(right - left)),
      height: Math.max(MIN, Math.abs(bottom - top))
    })
  }

  function onPointerUp() {
    const g = gesture.current
    gesture.current = null
    // A draw that never grew into a usable box clears the crop instead of
    // leaving a 0×0 sliver behind.
    if (g?.mode === 'draw' && crop && (crop.width < MIN || crop.height < MIN)) onChange(null)
  }

  // Esc clears the crop.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && crop) {
      e.preventDefault()
      onChange(null)
    }
  }

  const render = crop && {
    left: drawnLeft + crop.x * scale,
    top: drawnTop + crop.y * scale,
    width: crop.width * scale,
    height: crop.height * scale
  }

  // Handle screen position (centre) for a given handle id.
  function handlePos(h: Handle) {
    if (!crop) return { left: 0, top: 0 }
    const l = drawnLeft + crop.x * scale
    const t = drawnTop + crop.y * scale
    const w = crop.width * scale
    const ht = crop.height * scale
    const cx = h.includes('w') ? l : h.includes('e') ? l + w : l + w / 2
    const cy = h.includes('n') ? t : h.includes('s') ? t + ht : t + ht / 2
    return { left: cx, top: cy }
  }

  return (
    <div
      ref={wrapperRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`absolute inset-0 select-none outline-none ${crop ? 'touch-none cursor-crosshair' : 'cursor-crosshair'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Source image is only shown while a crop is active, so the rest of the
          time the underlying encoded-output preview stays visible. */}
      {render && (
        <img
          src={image.objectUrl}
          alt=""
          draggable={false}
          className="pointer-events-none absolute"
          style={{ left: drawnLeft, top: drawnTop, width: drawnW, height: drawnH }}
        />
      )}

      {render && (
        <>
          {/* dim mask — four rects around the crop */}
          <div className="pointer-events-none absolute bg-slate-900/55" style={{ left: drawnLeft, top: drawnTop, width: drawnW, height: render.top - drawnTop }} />
          <div className="pointer-events-none absolute bg-slate-900/55" style={{ left: drawnLeft, top: render.top + render.height, width: drawnW, height: drawnTop + drawnH - (render.top + render.height) }} />
          <div className="pointer-events-none absolute bg-slate-900/55" style={{ left: drawnLeft, top: render.top, width: render.left - drawnLeft, height: render.height }} />
          <div className="pointer-events-none absolute bg-slate-900/55" style={{ left: render.left + render.width, top: render.top, width: drawnLeft + drawnW - (render.left + render.width), height: render.height }} />

          {/* crop rectangle — pointer-events on so dragging inside moves it */}
          <div
            data-handle="move"
            className="absolute border-2 border-dashed border-white shadow-[0_0_0_1px_rgba(15,23,42,0.5)] cursor-move"
            style={render}
          />

          {/* resize handles */}
          {HANDLES.map((h) => {
            const p = handlePos(h)
            return (
              <div
                key={h}
                data-handle={h}
                className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-sm bg-white ring-1 ring-slate-500 shadow"
                style={{ left: p.left, top: p.top, cursor: HANDLE_CURSOR[h] }}
              />
            )
          })}

          {/* dims label + clear button */}
          <div
            className="pointer-events-none absolute bg-slate-900/90 text-white text-xs font-medium tabular-nums px-2 py-1 rounded-md whitespace-nowrap"
            style={{ left: Math.max(drawnLeft, render.left), top: render.top + render.height + 8 }}
          >
            {Math.round(crop.width)} × {Math.round(crop.height)} px
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onChange(null)}
            title="Remove crop"
            className="absolute w-7 h-7 rounded-full bg-white text-slate-700 hover:bg-slate-100 shadow-md ring-1 ring-slate-300 flex items-center justify-center text-sm"
            style={{ left: render.left + render.width - 14, top: render.top - 14 }}
          >
            ✕
          </button>
        </>
      )}

      {!render && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 hidden md:block">
          <div className="bg-slate-900/80 text-white text-[11px] px-3 py-1.5 rounded-full">
            Drag to crop
          </div>
        </div>
      )}
    </div>
  )
}
