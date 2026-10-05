import { useEffect, useRef, useState } from 'react'
import type { RedactBox, SourceCrop } from '../../types/image'
import { MIN_REDACT, clampBox, isPaleFill, tapRedactBox } from '../../lib/redact'

/**
 * Source pixels → pane pixels: `screen = left + source * s`, per axis because
 * the preview is drawn with `object-fill` and a custom output size can stretch
 * it. The same shape CropOverlay uses.
 */
export type RedactView = { left: number; top: number; sx: number; sy: number }

/** Pane-pixel rectangle. */
export type PaneRect = { left: number; top: number; width: number; height: number }

/** The view that draws `region` of the source into `rect` of the pane. */
export function viewFor(region: SourceCrop, rect: PaneRect): RedactView {
  const sx = rect.width / region.width
  const sy = rect.height / region.height
  return { sx, sy, left: rect.left - region.x * sx, top: rect.top - region.y * sy }
}

function toScreen(v: RedactView, r: { x: number; y: number; width: number; height: number }): PaneRect {
  return { left: v.left + r.x * v.sx, top: v.top + r.y * v.sy, width: r.width * v.sx, height: r.height * v.sy }
}

function boxStyle(b: RedactBox, v: RedactView, clip: PaneRect) {
  const r = toScreen(v, b)
  return { left: r.left - clip.left, top: r.top - clip.top, width: r.width, height: r.height, backgroundColor: b.fill }
}

/**
 * The boxes as they will be painted, laid over whatever picture is on screen.
 * Read-only. Clipped to `clip` (the picture's own rectangle) so a box that runs
 * past a crop is cut off exactly where the export cuts it.
 */
export function RedactBoxesView({ boxes, view, clip }: { boxes: RedactBox[]; view: RedactView; clip: PaneRect }) {
  if (boxes.length === 0) return null
  return (
    <div className="pointer-events-none absolute overflow-hidden" style={clip} aria-hidden="true">
      {boxes.map((b) => (
        <div
          key={b.id}
          className={['absolute', isPaleFill(b.fill) ? 'outline outline-1 outline-slate-400/80' : ''].join(' ')}
          style={boxStyle(b, view, clip)}
        />
      ))}
    </div>
  )
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const HANDLE_CURSOR: Record<Handle, string> = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize'
}
/** How far (screen px) a pointer must travel before a press becomes a drag. */
const DRAG_SLOP = 6

type Rect = { x: number; y: number; width: number; height: number }

interface EditorProps {
  imageWidth: number
  imageHeight: number
  /** The part of the source on screen (the crop, or the whole image). */
  region: SourceCrop
  /** Where that region is drawn in the pane. */
  rect: PaneRect
  boxes: RedactBox[]
  selectedId: string | null
  fill: string
  onAdd: (r: Rect) => void
  onUpdate: (id: string, r: Rect) => void
  onRemove: (id: string) => void
  onSelect: (id: string | null) => void
  onDone: () => void
}

/**
 * "Draw boxes" mode over the preview. A drag on the picture draws a box, a tap
 * drops a default-sized one (Universal PDF's "tap drops a box"), a press on a
 * box selects and moves it, the handles resize it, and the ✕ or Delete removes
 * it. Everything is reported in source pixels.
 */
export function RedactEditor({
  imageWidth,
  imageHeight,
  region,
  rect,
  boxes,
  selectedId,
  fill,
  onAdd,
  onUpdate,
  onRemove,
  onSelect,
  onDone
}: EditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const view = viewFor(region, rect)
  const whole: SourceCrop = { x: 0, y: 0, width: imageWidth, height: imageHeight }
  // A box being drawn is held here until the pointer lifts, so a drag that
  // never grows past the minimum leaves nothing behind.
  const [draft, setDraft] = useState<Rect | null>(null)
  const gesture = useRef<{
    kind: 'draw' | 'move' | Handle
    id: string | null
    startClient: { x: number; y: number }
    startPt: { x: number; y: number }
    startRect: Rect
    dragging: boolean
  } | null>(null)

  // Focus the layer on entry so Delete / Esc work without a click first.
  useEffect(() => {
    wrapperRef.current?.focus({ preventScroll: true })
  }, [])

  function clientToSource(clientX: number, clientY: number, bounds: SourceCrop) {
    const wb = wrapperRef.current!.getBoundingClientRect()
    return {
      x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, (clientX - wb.left - view.left) / view.sx)),
      y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, (clientY - wb.top - view.top) / view.sy))
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return
    const el = e.target as HTMLElement
    const handle = el.dataset.handle as Handle | undefined
    const boxId = el.dataset.boxId
    const wb = wrapperRef.current!.getBoundingClientRect()
    const px = e.clientX - wb.left
    const py = e.clientY - wb.top
    const onPicture = px >= rect.left && px <= rect.left + rect.width && py >= rect.top && py <= rect.top + rect.height

    let kind: 'draw' | 'move' | Handle
    let id: string | null = null
    let startRect: Rect
    if (handle && selectedId) {
      const b = boxes.find((x) => x.id === selectedId)
      if (!b) return
      kind = handle
      id = b.id
      startRect = b
    } else if (boxId) {
      const b = boxes.find((x) => x.id === boxId)
      if (!b) return
      kind = 'move'
      id = b.id
      startRect = b
      onSelect(b.id)
    } else if (onPicture) {
      kind = 'draw'
      startRect = { x: 0, y: 0, width: 0, height: 0 }
    } else {
      // The pasteboard round the picture: just let go of the selection.
      onSelect(null)
      return
    }

    e.preventDefault()
    wrapperRef.current?.focus({ preventScroll: true })
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
    gesture.current = {
      kind,
      id,
      startClient: { x: e.clientX, y: e.clientY },
      startPt: clientToSource(e.clientX, e.clientY, kind === 'draw' ? region : whole),
      startRect,
      dragging: false
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current
    if (!g) return
    if (!g.dragging) {
      if (Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y) < DRAG_SLOP) return
      g.dragging = true
    }
    if (g.kind === 'draw') {
      const pt = clientToSource(e.clientX, e.clientY, region)
      setDraft({
        x: Math.min(g.startPt.x, pt.x),
        y: Math.min(g.startPt.y, pt.y),
        width: Math.abs(pt.x - g.startPt.x),
        height: Math.abs(pt.y - g.startPt.y)
      })
      return
    }
    const pt = clientToSource(e.clientX, e.clientY, whole)
    if (g.kind === 'move') {
      const r = clampBox(
        { ...g.startRect, x: g.startRect.x + pt.x - g.startPt.x, y: g.startRect.y + pt.y - g.startPt.y },
        whole
      )
      onUpdate(g.id!, r)
      return
    }
    // Resize: move only the edges the handle names.
    let left = g.startRect.x
    let right = g.startRect.x + g.startRect.width
    let top = g.startRect.y
    let bottom = g.startRect.y + g.startRect.height
    if (g.kind.includes('w')) left = pt.x
    if (g.kind.includes('e')) right = pt.x
    if (g.kind.includes('n')) top = pt.y
    if (g.kind.includes('s')) bottom = pt.y
    onUpdate(g.id!, {
      x: Math.min(left, right),
      y: Math.min(top, bottom),
      width: Math.max(MIN_REDACT, Math.abs(right - left)),
      height: Math.max(MIN_REDACT, Math.abs(bottom - top))
    })
  }

  function onPointerUp() {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.kind === 'draw') {
      if (g.dragging) {
        if (draft && draft.width >= MIN_REDACT && draft.height >= MIN_REDACT) onAdd(draft)
      } else if (selectedId) {
        // A tap with a box selected lets go of it, rather than dropping a new
        // box on top of whatever the user was about to look at.
        onSelect(null)
      } else {
        onAdd(tapRedactBox(g.startPt.x, g.startPt.y, region))
      }
      setDraft(null)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
      e.preventDefault()
      onRemove(selectedId)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (selectedId) onSelect(null)
      else onDone()
    }
  }

  const selected = selectedId ? boxes.find((b) => b.id === selectedId) ?? null : null
  const selRect = selected ? toScreen(view, selected) : null
  const draftRect = draft ? toScreen(view, draft) : null

  return (
    <div
      ref={wrapperRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute inset-0 select-none outline-none touch-none cursor-crosshair"
    >
      {/* The boxes themselves, clipped to the picture like the export. Each one
          is a hit target: a press selects and moves it. */}
      <div className="absolute overflow-hidden" style={rect}>
        {boxes.map((b) => (
          <div
            key={b.id}
            data-box-id={b.id}
            className={[
              'absolute cursor-move',
              b.id === selectedId
                ? 'outline outline-2 outline-offset-1 outline-orange-500'
                : isPaleFill(b.fill)
                  ? 'outline outline-1 outline-dashed outline-slate-500'
                  : 'outline outline-1 outline-dashed outline-white/70'
            ].join(' ')}
            style={boxStyle(b, view, rect)}
          />
        ))}
        {draftRect && (
          <div
            className="pointer-events-none absolute opacity-80 outline outline-2 outline-orange-500"
            style={{
              left: draftRect.left - rect.left,
              top: draftRect.top - rect.top,
              width: draftRect.width,
              height: draftRect.height,
              backgroundColor: fill
            }}
          />
        )}
      </div>

      {selected && selRect && (
        <>
          {HANDLES.map((h) => {
            const cx = h.includes('w') ? selRect.left : h.includes('e') ? selRect.left + selRect.width : selRect.left + selRect.width / 2
            const cy = h.includes('n') ? selRect.top : h.includes('s') ? selRect.top + selRect.height : selRect.top + selRect.height / 2
            return (
              <div
                key={h}
                data-handle={h}
                className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-sm bg-white shadow ring-1 ring-orange-600"
                style={{ left: cx, top: cy, cursor: HANDLE_CURSOR[h] }}
              />
            )
          })}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(selected.id)}
            title="Remove this box (Delete)"
            aria-label="Remove this box"
            className="absolute w-7 h-7 rounded-full bg-white text-slate-700 hover:bg-slate-100 shadow-md ring-1 ring-slate-300 flex items-center justify-center"
            style={{ left: selRect.left + selRect.width - 14, top: Math.max(4, selRect.top - 34) }}
          >
            {/* An SVG, not `✕`: U+2715 has no glyph in iOS's system font. */}
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
            </svg>
          </button>
        </>
      )}

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onDone}
        title="Stop drawing boxes (Esc)"
        className="absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 bg-orange-700 hover:bg-orange-800 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-md"
      >
        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 10.5l4 4 8-9" />
        </svg>
        Done
      </button>
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[calc(100%-24px)]">
        <div className="bg-slate-900/80 text-white text-[11px] px-3 py-1.5 rounded-full text-center">
          Drag to cover something · tap to drop a box · drag a box to move it
        </div>
      </div>
    </div>
  )
}
