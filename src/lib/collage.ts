// Collage geometry and drawing — several photos on one canvas, side by side,
// stacked, or in a grid.
//
// Split in two on purpose. `layoutCollage` is pure arithmetic (no DOM), so
// `scripts/collage.test.mjs` can pin it under Node's type-stripping; `drawCollage`
// is the only part that touches a canvas, and it draws the SAME geometry for the
// on-screen preview and the exported file — the preview is the export, scaled.
//
// A layout is a tree of rows and columns whose leaves are the spaces photos go
// in. Every gap — between spaces AND round the outside edge — is the same width,
// so a white 2% gap reads as a consistent border rather than thin lines inside
// a fat frame.

export type LayoutNode = { dir: 'row' | 'col'; children: (LayoutNode | 'slot')[]; weights?: number[] }

export interface CollageLayout {
  id: string
  label: string
  /** How many photos it holds. */
  slots: number
  tree: LayoutNode
  /**
   * A single row or column. Only these can take "Fit photos": each space is
   * sized to its photo's own shape, so nothing is cropped — the canvas grows to
   * fit instead. A grid cannot do that without the rows disagreeing.
   */
  strip?: 'row' | 'col'
}

const row = (children: LayoutNode['children'], weights?: number[]): LayoutNode => ({ dir: 'row', children, weights })
const col = (children: LayoutNode['children'], weights?: number[]): LayoutNode => ({ dir: 'col', children, weights })
const S = 'slot' as const

export const LAYOUTS: CollageLayout[] = [
  { id: 'row2', label: 'Side by side', slots: 2, tree: row([S, S]), strip: 'row' },
  { id: 'col2', label: 'One above the other', slots: 2, tree: col([S, S]), strip: 'col' },
  { id: 'row3', label: 'Three across', slots: 3, tree: row([S, S, S]), strip: 'row' },
  { id: 'col3', label: 'Three stacked', slots: 3, tree: col([S, S, S]), strip: 'col' },
  { id: 'bigL3', label: 'Big left, two right', slots: 3, tree: row([S, col([S, S])], [2, 1]) },
  { id: 'bigT3', label: 'Big top, two below', slots: 3, tree: col([S, row([S, S])], [2, 1]) },
  { id: 'grid4', label: 'Two by two', slots: 4, tree: col([row([S, S]), row([S, S])]) },
  { id: 'bigL4', label: 'Big left, three right', slots: 4, tree: row([S, col([S, S, S])], [2, 1]) },
  { id: 'bigT4', label: 'Big top, three below', slots: 4, tree: col([S, row([S, S, S])], [2, 1]) },
  { id: 'grid6', label: 'Three by two', slots: 6, tree: col([row([S, S, S]), row([S, S, S])]) },
  { id: 'grid9', label: 'Three by three', slots: 9, tree: col([row([S, S, S]), row([S, S, S]), row([S, S, S])]) },
]

export function layoutById(id: string): CollageLayout {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0]!
}

/** Canvas shape. 'fit' = sized to the photos (strips only); the rest are width:height. */
export type CollageShape = 'fit' | '1:1' | '4:5' | '9:16' | '16:9' | '3:2' | '2:3'

export const SHAPES: { id: CollageShape; label: string }[] = [
  { id: 'fit', label: 'Fit photos' },
  { id: '1:1', label: 'Square' },
  { id: '4:5', label: 'Portrait 4:5' },
  { id: '9:16', label: 'Story 9:16' },
  { id: '16:9', label: 'Wide 16:9' },
  { id: '3:2', label: 'Landscape 3:2' },
  { id: '2:3', label: 'Tall 2:3' },
]

export interface Rect { x: number; y: number; w: number; h: number }

export interface CollageGeometry {
  width: number
  height: number
  /** One per space, in the layout's reading order. */
  rects: Rect[]
  /** The gap in output pixels, for the corner radius to scale against. */
  gap: number
}

function ratioOf(shape: Exclude<CollageShape, 'fit'>) {
  const [w, h] = shape.split(':').map(Number) as [number, number]
  return w / h
}

/**
 * Where every space goes on a canvas whose LONG edge is `longEdge` pixels.
 *
 * `aspects` are the photos' width/height, one per space (use 1 for an empty
 * one); they only matter for 'fit'. `gapFrac` is the gap as a fraction of the
 * long edge. A shape of 'fit' on a layout that is not a strip falls back to
 * square — the dialog hides the option there, this is the belt to that brace.
 */
export function layoutCollage(
  layout: CollageLayout,
  shape: CollageShape,
  aspects: number[],
  longEdge: number,
  gapFrac: number,
): CollageGeometry {
  const L = Math.max(1, Math.round(longEdge))
  const g = Math.max(0, gapFrac) * L
  const n = layout.slots
  const a = Array.from({ length: n }, (_, i) => {
    const v = aspects[i]
    return v && Number.isFinite(v) && v > 0 ? v : 1
  })

  if (shape === 'fit' && layout.strip) {
    // A row: every photo the same height H, so each is H·aᵢ wide and nothing
    // is cropped. Total width = H·Σa + (n+1)·g, height = H + 2g. Solve with
    // the long edge on whichever side comes out longer.
    const horizontal = layout.strip === 'row'
    // For a column the same sum runs over 1/a (each photo W/a tall).
    const sum = horizontal ? a.reduce((s, v) => s + v, 0) : a.reduce((s, v) => s + 1 / v, 0)
    let inner = (L - (n + 1) * g) / sum // the shared height (row) / width (col)
    let along = L
    let across = inner + 2 * g
    if (across > along) {
      // The strip is shorter than it is thick (e.g. two very tall photos side
      // by side): the THICKNESS is the long edge instead.
      inner = L - 2 * g
      across = L
      along = inner * sum + (n + 1) * g
    }
    const rects: Rect[] = []
    let pos = g
    for (let i = 0; i < n; i++) {
      const len = horizontal ? inner * a[i]! : inner / a[i]!
      rects.push(horizontal ? { x: pos, y: g, w: len, h: inner } : { x: g, y: pos, w: inner, h: len })
      pos += len + g
    }
    const width = Math.round(horizontal ? along : across)
    const height = Math.round(horizontal ? across : along)
    return { width, height, rects, gap: g }
  }

  const ratio = ratioOf(shape === 'fit' ? '1:1' : shape)
  const width = Math.round(ratio >= 1 ? L : L * ratio)
  const height = Math.round(ratio >= 1 ? L / ratio : L)
  const rects: Rect[] = []
  place(layout.tree, { x: g, y: g, w: width - 2 * g, h: height - 2 * g }, g, rects)
  return { width, height, rects, gap: g }
}

function place(node: LayoutNode, box: Rect, g: number, out: Rect[]) {
  const k = node.children.length
  const weights = node.weights ?? node.children.map(() => 1)
  const total = weights.reduce((s, v) => s + v, 0)
  const horizontal = node.dir === 'row'
  const room = (horizontal ? box.w : box.h) - g * (k - 1)
  let pos = horizontal ? box.x : box.y
  node.children.forEach((child, i) => {
    const len = (room * weights[i]!) / total
    const r = horizontal ? { x: pos, y: box.y, w: len, h: box.h } : { x: box.x, y: pos, w: box.w, h: len }
    if (child === 'slot') out.push(r)
    else place(child, r, g, out)
    pos += len + g
  })
}

/** What sits in one space. */
export interface CollageSlot {
  imageId: string | null
  /** 1 = just covers the space; up to 4. */
  zoom: number
  /** Where the photo sits in the space when it overflows: 0 = left/top edge, 1 = right/bottom, 0.5 = centred. */
  ox: number
  oy: number
}

export const emptySlot = (): CollageSlot => ({ imageId: null, zoom: 1, ox: 0.5, oy: 0.5 })

/**
 * Where a photo is drawn inside its space — scaled to COVER the space, times
 * the zoom, and slid along whichever axis overflows by ox/oy. Returns the drawn
 * box, which may be larger than the space; the caller clips.
 */
export function coverPlacement(space: Rect, iw: number, ih: number, slot: Pick<CollageSlot, 'zoom' | 'ox' | 'oy'>): Rect {
  const scale = Math.max(space.w / iw, space.h / ih) * Math.max(1, slot.zoom)
  const w = iw * scale
  const h = ih * scale
  return { x: space.x + (space.w - w) * clamp01(slot.ox), y: space.y + (space.h - h) * clamp01(slot.oy), w, h }
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Anything drawImage takes and knows the size of. */
export type Drawable = { source: CanvasImageSource; width: number; height: number }

export interface DrawOptions {
  geometry: CollageGeometry
  slots: CollageSlot[]
  images: Record<string, Drawable | undefined>
  /** A CSS colour, or null for transparent. */
  background: string | null
  /** Corner radius as a fraction of each space's shorter side (0–0.5). */
  radiusFrac: number
  /** Preview extras: empty-space placeholders and the selected-space outline. */
  preview?: { selected: number | null; dark: boolean }
}

/** Draws at the geometry's own pixel size — scale the context first for a smaller preview. */
export function drawCollage(ctx: CanvasRenderingContext2D, o: DrawOptions) {
  const { width, height, rects } = o.geometry
  ctx.clearRect(0, 0, width, height)
  if (o.background) {
    ctx.fillStyle = o.background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  rects.forEach((r, i) => {
    const slot = o.slots[i]
    const img = slot?.imageId ? o.images[slot.imageId] : undefined
    const radius = Math.min(r.w, r.h) * Math.min(0.5, Math.max(0, o.radiusFrac))
    ctx.save()
    roundedPath(ctx, r, radius)
    ctx.clip()
    if (img && slot) {
      const d = coverPlacement(r, img.width, img.height, slot)
      ctx.drawImage(img.source, d.x, d.y, d.w, d.h)
    } else if (o.preview) {
      ctx.fillStyle = o.preview.dark ? '#1e293b' : '#e2e8f0'
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.fillStyle = o.preview.dark ? '#64748b' : '#94a3b8'
      const s = Math.min(r.w, r.h) * 0.18
      ctx.font = `600 ${s}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('+', r.x + r.w / 2, r.y + r.h / 2)
    }
    ctx.restore()

    if (o.preview && o.preview.selected === i) {
      // Drawn in canvas pixels, so size the stroke off the canvas, not a CSS px.
      const lw = Math.max(2, Math.max(width, height) * 0.006)
      ctx.save()
      ctx.lineWidth = lw
      ctx.strokeStyle = '#ea580c'
      roundedPath(ctx, { x: r.x + lw / 2, y: r.y + lw / 2, w: r.w - lw, h: r.h - lw }, Math.max(0, radius - lw / 2))
      ctx.stroke()
      ctx.restore()
    }
  })
}

function roundedPath(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath()
  if (radius <= 0) {
    ctx.rect(r.x, r.y, r.w, r.h)
    return
  }
  const rr = Math.min(radius, r.w / 2, r.h / 2)
  // Hand-drawn rather than ctx.roundRect, which is Safari 16+ only and the iOS
  // app's floor is 15.
  ctx.moveTo(r.x + rr, r.y)
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rr)
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rr)
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rr)
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rr)
  ctx.closePath()
}

/** Index of the space under a point (canvas pixels), or -1. */
export function hitSlot(geometry: CollageGeometry, x: number, y: number): number {
  return geometry.rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
}
