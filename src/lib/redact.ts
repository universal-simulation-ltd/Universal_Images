import type { RedactBox, SourceCrop } from '../types/image'

/**
 * Redaction boxes — solid blocks drawn over the picture to cover a name, a
 * number plate, a face the detector missed. The Universal PDF tool's model:
 * while you edit they are movable markup sitting over the image (the source is
 * never rewritten, the way a crop isn't), and every way out of the app —
 * Download, the ZIP, Back up online, the collage — paints them into the pixels
 * of the file it writes.
 *
 * ⚠️ Every exit has to go through `paintRedactions` (or, in the collage, the
 * Drawable's `redact` list). A new export path that forgets them hands out the
 * picture with what the user covered still showing.
 */

/** The swatches offered for new boxes. Black first: it is what "redact" means. */
export const REDACT_SWATCHES: { label: string; value: string }[] = [
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#ffffff' },
  { label: 'Grey', value: '#64748b' },
  { label: 'Orange', value: '#ea580c' },
]

export const DEFAULT_REDACT_FILL = '#000000'

/** Smallest box a drag creates or a resize leaves, in source pixels. */
export const MIN_REDACT = 4

/**
 * True when a fill is pale enough to vanish against a white picture. Drives the
 * editor-only outline so a white box on a white wall can still be found.
 */
export function isPaleFill(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return false
  const n = parseInt(m[1], 16)
  // Rec. 601 luma — the same test Universal PDF uses for its redactions.
  const luma = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return luma > 160
}

/**
 * The box a tap drops, centred on the tap and clamped to `region` (the part of
 * the picture on screen). A bar about the shape of a line of text or a number
 * plate, sized off the region so it looks the same whatever the resolution.
 */
export function tapRedactBox(x: number, y: number, region: SourceCrop): Omit<RedactBox, 'id' | 'fill'> {
  const short = Math.min(region.width, region.height)
  const width = Math.max(MIN_REDACT, Math.min(region.width, Math.round(short * 0.36)))
  const height = Math.max(MIN_REDACT, Math.min(region.height, Math.round(width * 0.3)))
  return clampBox({ x: x - width / 2, y: y - height / 2, width, height }, region)
}

/** Keep a box inside `bounds`, shrinking it only if it is bigger than them. */
export function clampBox(r: { x: number; y: number; width: number; height: number }, bounds: SourceCrop) {
  const width = Math.max(1, Math.min(bounds.width, r.width))
  const height = Math.max(1, Math.min(bounds.height, r.height))
  const x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - width, r.x))
  const y = Math.max(bounds.y, Math.min(bounds.y + bounds.height - height, r.y))
  return { x, y, width, height }
}

/**
 * Paint `boxes` onto a canvas holding `region` of the source (the crop, or the
 * whole image) drawn at the canvas's size. Edges are rounded OUTWARD to whole
 * output pixels, so a box never leaves a half-covered column of the picture
 * underneath showing through an anti-aliased edge.
 */
export function paintRedactions(
  canvas: HTMLCanvasElement,
  boxes: RedactBox[] | null | undefined,
  region: SourceCrop
) {
  if (!boxes || boxes.length === 0) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const kx = canvas.width / region.width
  const ky = canvas.height / region.height
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor((b.x - region.x) * kx))
    const y0 = Math.max(0, Math.floor((b.y - region.y) * ky))
    const x1 = Math.min(canvas.width, Math.ceil((b.x + b.width - region.x) * kx))
    const y1 = Math.min(canvas.height, Math.ceil((b.y + b.height - region.y) * ky))
    if (x1 <= x0 || y1 <= y0) continue
    ctx.fillStyle = b.fill
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  }
  ctx.restore()
}

/** Rescale boxes drawn on a `fromW × fromH` picture onto a `toW × toH` one. */
export function scaleRedactions(boxes: RedactBox[], fromW: number, fromH: number, toW: number, toH: number): RedactBox[] {
  const kx = toW / fromW
  const ky = toH / fromH
  return boxes.map((b) => ({ ...b, x: b.x * kx, y: b.y * ky, width: b.width * kx, height: b.height * ky }))
}

/** A cheap identity for a list of boxes — what the preview encode keys on. */
export function redactSignature(boxes: RedactBox[] | null | undefined): string {
  if (!boxes || boxes.length === 0) return ''
  return boxes.map((b) => `${b.id}:${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)},${b.fill}`).join('|')
}
