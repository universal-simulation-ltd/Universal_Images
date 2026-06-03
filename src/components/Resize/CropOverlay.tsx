import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SourceImage } from '../../types/image'

interface SourceRect {
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  image: SourceImage
  onCommit: (rect: { x: number; y: number; width: number; height: number }) => void
  onCancel: () => void
}

/**
 * Crop interaction layer. Renders the image with a draggable selection
 * rectangle. Coords are kept in source pixels so the overlay's reported
 * dimensions match what the user actually gets, regardless of zoom.
 *
 * Keyboard:  Enter → commit · Esc → cancel
 * Pointer:   click + drag to select. Once a selection exists, drawing is
 *            deactivated until the user accepts (✓) or rejects (✕) it — so a
 *            press on those controls can't accidentally start a fresh crop.
 */
export default function CropOverlay({ image, onCommit, onCancel }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [rect, setRect] = useState<SourceRect | null>(null)
  // Once a usable selection is drawn we lock drawing until the user accepts or
  // rejects. This is what makes the ✓/✕ buttons clickable: without it, the
  // pointer-down on a button would bubble to the wrapper and begin a new crop.
  const [locked, setLocked] = useState(false)

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
    const el = wrapperRef.current!
    const wb = el.getBoundingClientRect()
    const xInWrapper = clientX - wb.left
    const yInWrapper = clientY - wb.top
    return {
      x: Math.max(0, Math.min(image.width, (xInWrapper - drawnLeft) / scale)),
      y: Math.max(0, Math.min(image.height, (yInWrapper - drawnTop) / scale))
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    // Selection is locked awaiting accept/reject — ignore presses so the user
    // can reach the ✓/✕ controls without redrawing.
    if (locked) return
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const p = clientToSource(e.clientX, e.clientY)
    setStart(p)
    setRect({ x: p.x, y: p.y, w: 0, h: 0 })
  }
  function onPointerMove(e: React.PointerEvent) {
    if (locked || !start) return
    const p = clientToSource(e.clientX, e.clientY)
    setRect({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y)
    })
  }
  function onPointerUp() {
    setStart(null)
    // A usable selection finishes the drawing step — deactivate the cropper so
    // the next interaction must be accept or reject.
    if (rect && rect.w >= 4 && rect.h >= 4) setLocked(true)
  }

  const canCommit = !!(rect && rect.w >= 4 && rect.h >= 4)

  function tryCommit() {
    if (!canCommit || !rect) return
    onCommit({ x: rect.x, y: rect.y, width: rect.w, height: rect.h })
  }

  // Reject the current selection and re-activate drawing so the user can try
  // again (full crop-mode exit stays on Esc / the side-panel "Cancel crop").
  function rejectSelection() {
    setRect(null)
    setStart(null)
    setLocked(false)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Enter' && canCommit) {
        e.preventDefault()
        tryCommit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCommit, rect, onCancel])

  const render = rect && {
    left: drawnLeft + rect.x * scale,
    top: drawnTop + rect.y * scale,
    width: rect.w * scale,
    height: rect.h * scale
  }
  const rectWpx = rect ? Math.round(rect.w) : 0
  const rectHpx = rect ? Math.round(rect.h) : 0

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 cursor-crosshair select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img
        src={image.objectUrl}
        alt=""
        draggable={false}
        className="pointer-events-none absolute"
        style={{
          left: drawnLeft,
          top: drawnTop,
          width: drawnW,
          height: drawnH
        }}
      />

      {render && (
        <>
          <div
            className="pointer-events-none absolute bg-slate-900/55"
            style={{ left: drawnLeft, top: drawnTop, width: drawnW, height: render.top - drawnTop }}
          />
          <div
            className="pointer-events-none absolute bg-slate-900/55"
            style={{
              left: drawnLeft,
              top: render.top + render.height,
              width: drawnW,
              height: drawnTop + drawnH - (render.top + render.height)
            }}
          />
          <div
            className="pointer-events-none absolute bg-slate-900/55"
            style={{
              left: drawnLeft,
              top: render.top,
              width: render.left - drawnLeft,
              height: render.height
            }}
          />
          <div
            className="pointer-events-none absolute bg-slate-900/55"
            style={{
              left: render.left + render.width,
              top: render.top,
              width: drawnLeft + drawnW - (render.left + render.width),
              height: render.height
            }}
          />

          <div
            className="pointer-events-none absolute border-2 border-dashed border-white shadow-[0_0_0_1px_rgba(15,23,42,0.5)]"
            style={render}
          />

          <div
            className="pointer-events-none absolute bg-slate-900/90 text-white text-xs font-medium tabular-nums px-2 py-1 rounded-md whitespace-nowrap"
            style={{
              left: Math.max(drawnLeft, render.left),
              top: render.top + render.height + 8
            }}
          >
            {rectWpx} × {rectHpx} px
          </div>

          {canCommit && (
            <div
              className="absolute flex gap-1.5"
              // Keep button presses from reaching the wrapper's pointer-down,
              // which would otherwise start a brand-new crop selection.
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                left: Math.max(drawnLeft, render.left + render.width - 80),
                top: render.top + render.height + 6
              }}
            >
              <button
                type="button"
                onClick={rejectSelection}
                title="Reject selection — draw again"
                className="w-8 h-8 rounded-full bg-white text-slate-700 hover:bg-slate-100 shadow-md ring-1 ring-slate-300 flex items-center justify-center text-base"
              >
                ✕
              </button>
              <button
                type="button"
                onClick={tryCommit}
                title="Apply crop (Enter)"
                className="w-8 h-8 rounded-full bg-orange-600 text-white hover:bg-orange-700 shadow-md flex items-center justify-center text-base"
              >
                ✓
              </button>
            </div>
          )}
        </>
      )}

      {!rect && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="bg-slate-900/85 text-white text-xs px-3 py-1.5 rounded-full">
            Click and drag to choose a crop area · Esc to cancel
          </div>
        </div>
      )}
    </div>
  )
}
