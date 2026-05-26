import { useLayoutEffect, useRef, useState } from 'react'
import type { SourceCrop, SourceImage } from '../../types/image'

interface Props {
  image: SourceImage
  crop: SourceCrop
  /** Called with new (x,y) in source pixels while the user drags. */
  onMove: (x: number, y: number) => void
}

/**
 * Pan-only crop preview shown when a social-media size is active. The crop
 * rectangle is fixed in size (the largest covering rect at the preset's
 * aspect ratio); the user drags it to reframe what goes into the export.
 */
export default function SocialCropOverlay({ image, crop, onMove }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const dragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startCropX: number
    startCropY: number
  } | null>(null)

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

  const rectLeft = drawnLeft + crop.x * scale
  const rectTop = drawnTop + crop.y * scale
  const rectWidth = crop.width * scale
  const rectHeight = crop.height * scale

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCropX: crop.x,
      startCropY: crop.y
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = (e.clientX - d.startClientX) / scale
    const dy = (e.clientY - d.startClientY) / scale
    onMove(d.startCropX + dx, d.startCropY + dy)
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  return (
    <div ref={wrapperRef} className="absolute inset-0 select-none touch-none">
      <img
        src={image.objectUrl}
        alt=""
        draggable={false}
        className="pointer-events-none absolute"
        style={{ left: drawnLeft, top: drawnTop, width: drawnW, height: drawnH }}
      />

      <div
        className="pointer-events-none absolute bg-slate-900/55"
        style={{ left: drawnLeft, top: drawnTop, width: drawnW, height: rectTop - drawnTop }}
      />
      <div
        className="pointer-events-none absolute bg-slate-900/55"
        style={{
          left: drawnLeft,
          top: rectTop + rectHeight,
          width: drawnW,
          height: drawnTop + drawnH - (rectTop + rectHeight)
        }}
      />
      <div
        className="pointer-events-none absolute bg-slate-900/55"
        style={{
          left: drawnLeft,
          top: rectTop,
          width: rectLeft - drawnLeft,
          height: rectHeight
        }}
      />
      <div
        className="pointer-events-none absolute bg-slate-900/55"
        style={{
          left: rectLeft + rectWidth,
          top: rectTop,
          width: drawnLeft + drawnW - (rectLeft + rectWidth),
          height: rectHeight
        }}
      />

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute cursor-grab active:cursor-grabbing border-2 border-dashed border-white shadow-[0_0_0_1px_rgba(15,23,42,0.5)]"
        style={{ left: rectLeft, top: rectTop, width: rectWidth, height: rectHeight }}
      />

      <div
        className="pointer-events-none absolute bg-slate-900/85 text-white text-[11px] font-medium tabular-nums px-2 py-1 rounded-md whitespace-nowrap"
        style={{
          left: Math.max(drawnLeft, rectLeft),
          top: Math.max(drawnTop + 6, rectTop + 6)
        }}
      >
        Drag to reframe · {Math.round(crop.width)} × {Math.round(crop.height)} px
      </div>
    </div>
  )
}
