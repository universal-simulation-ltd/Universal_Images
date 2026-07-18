import type { OutputFormat, PresetSize, SourceCrop } from '../types/image'

const HEIC_EXT_RE = /\.(heic|heif)$/i
const HEIC_MIME = new Set(['image/heic', 'image/heif'])

function isHeic(file: File) {
  return HEIC_MIME.has(file.type) || HEIC_EXT_RE.test(file.name)
}

/**
 * Convert HEIC/HEIF (iPhone) to JPEG on the fly so the rest of the pipeline
 * can treat it as any other raster. The decoder is heavy (~150kB), so we
 * dynamic-import it only when we actually meet a HEIC file.
 */
export async function decodeHeicIfNeeded(file: File): Promise<File> {
  if (!isHeic(file)) return file
  const { default: heic2any } = await import('heic2any')
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  const blob = Array.isArray(converted) ? converted[0]! : converted
  const newName = file.name.replace(HEIC_EXT_RE, '.jpg')
  return new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified })
}

const SVG_EXT_RE = /\.svg$/i

function isSvg(file: File) {
  return file.type === 'image/svg+xml' || SVG_EXT_RE.test(file.name)
}

// An icon-sized SVG (e.g. 24×24) would rasterise to a tiny, un-resizable PNG,
// so we render vectors up to at least this long edge — but never past the cap,
// which keeps a viewBox-less or huge SVG from allocating an enormous canvas.
const SVG_MIN_LONG_EDGE = 1024
const SVG_MAX_LONG_EDGE = 4096

function parseSvgLength(v: string | null): number | null {
  if (!v) return null
  const m = /^\s*(-?[\d.]+)\s*(px)?\s*$/i.exec(v) // absolute px / unitless only
  if (!m) return null
  const n = parseFloat(m[1]!)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Rasterise an SVG to a PNG File so the rest of the pipeline can treat it as
 * any other bitmap. Vectors have no inherent pixel size, so we derive one from
 * the width/height attributes or the viewBox (falling back to a square), scale
 * it up to a crisp minimum, and inject an explicit size + viewBox so the
 * browser rasterises the whole drawing rather than a 300×150 default box.
 */
export async function rasterizeSvgIfNeeded(file: File): Promise<File> {
  if (!isSvg(file)) return file

  const text = await file.text()
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (doc.getElementsByTagName('parsererror').length > 0 || svg.tagName.toLowerCase() !== 'svg') {
    throw new Error(`Could not parse SVG ${file.name}`)
  }

  const viewBox = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n))
  const attrW = parseSvgLength(svg.getAttribute('width'))
  const attrH = parseSvgLength(svg.getAttribute('height'))
  let baseW = attrW ?? (viewBox.length === 4 ? viewBox[2]! : null)
  let baseH = attrH ?? (viewBox.length === 4 ? viewBox[3]! : null)
  if (!baseW || !baseH) { baseW = SVG_MIN_LONG_EDGE; baseH = SVG_MIN_LONG_EDGE }

  const long = Math.max(baseW, baseH)
  const scale = Math.min(SVG_MAX_LONG_EDGE / long, Math.max(1, SVG_MIN_LONG_EDGE / long))
  const renderW = Math.max(1, Math.round(baseW * scale))
  const renderH = Math.max(1, Math.round(baseH * scale))

  // Guarantee the drawing scales to the render box: a viewBox maps the content
  // coordinate space onto the sized canvas; without one, a bare width/height
  // would clip instead of scale.
  if (viewBox.length !== 4) svg.setAttribute('viewBox', `0 0 ${baseW} ${baseH}`)
  svg.setAttribute('width', String(renderW))
  svg.setAttribute('height', String(renderH))

  const markup = new XMLSerializer().serializeToString(svg)
  const svgUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error(`Could not render SVG ${file.name}`))
      i.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = renderW
    canvas.height = renderH
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, renderW, renderH)
    const blob = await new Promise<Blob>((resolve, reject) => {
      // toBlob throws/returns null on a tainted canvas — an SVG that pulls in an
      // external image. Surface it so the file is skipped with a clear reason.
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Could not rasterise SVG ${file.name}`))), 'image/png')
    })
    const newName = file.name.replace(SVG_EXT_RE, '.png')
    return new File([blob], newName.endsWith('.png') ? newName : `${newName}.png`, {
      type: 'image/png',
      lastModified: file.lastModified
    })
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

/**
 * Decode a File into an HTMLImageElement and its natural dimensions.
 * Resolves once the image has loaded — caller is responsible for revoking
 * the returned object URL when the image is no longer needed.
 *
 * Transparently handles HEIC/HEIF input (→ JPEG) and SVG input (→ PNG) first.
 */
export async function loadImage(file: File): Promise<{ image: HTMLImageElement; objectUrl: string; width: number; height: number; file: File }> {
  const usableFile = await rasterizeSvgIfNeeded(await decodeHeicIfNeeded(file))
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(usableFile)
    const image = new Image()
    image.onload = () => {
      resolve({ image, objectUrl, width: image.naturalWidth, height: image.naturalHeight, file: usableFile })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(`Could not decode ${usableFile.name}`))
    }
    image.src = objectUrl
  })
}

const SMALL_TARGET = 800
const LARGE_TARGET = 1920

/**
 * S/M/L sizing strategy.
 *
 * For a large source (e.g. 4032×3024):
 *   S → 800px long edge   (web thumb, downscale)
 *   M → 1920px long edge  (HD, downscale)
 *   L → source size       (no resize)
 *
 * For a small source (e.g. 1500×1000):
 *   S → 750px long edge   (half of source)
 *   M → 1500px            (source size)
 *   L → 1920px            (HD upscale)
 *
 * Always three distinct sizes: if two would collide (e.g. source exactly
 * 1920), the next size down is pushed to ~67% so the three options stay
 * meaningfully different.
 */
export function computePresets(srcW: number, srcH: number): Record<PresetSize, { width: number; height: number }> {
  const longEdge = Math.max(srcW, srcH)
  const aspect = srcW / srcH

  let lLong = Math.max(LARGE_TARGET, longEdge)
  let mLong = longEdge >= LARGE_TARGET ? LARGE_TARGET : longEdge
  let sLong = Math.min(SMALL_TARGET, Math.max(1, Math.floor(mLong / 2)))

  if (mLong >= lLong) mLong = Math.max(1, Math.floor(lLong / 1.5))
  if (sLong >= mLong) sLong = Math.max(1, Math.floor(mLong / 2))

  function fromLongEdge(target: number) {
    if (srcW >= srcH) {
      const w = Math.round(target)
      const h = Math.max(1, Math.round(w / aspect))
      return { width: w, height: h }
    } else {
      const h = Math.round(target)
      const w = Math.max(1, Math.round(h * aspect))
      return { width: w, height: h }
    }
  }

  return {
    S: fromLongEdge(sLong),
    M: fromLongEdge(mLong),
    L: fromLongEdge(lLong)
  }
}

/**
 * High-quality resampled draw: when downscaling by more than 2× the browser's
 * default bilinear filter produces visible aliasing. We step the canvas down
 * in halves until we're within 2× of the target, then do the final draw.
 */
function drawDownscaled(
  source: HTMLImageElement,
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  let currentW = source.naturalWidth
  let currentH = source.naturalHeight

  // Initial canvas holds the source.
  let canvas = document.createElement('canvas')
  canvas.width = currentW
  canvas.height = currentH
  const initialCtx = canvas.getContext('2d')!
  initialCtx.imageSmoothingEnabled = true
  initialCtx.imageSmoothingQuality = 'high'
  initialCtx.drawImage(source, 0, 0)

  while (currentW >= targetW * 2 && currentH >= targetH * 2) {
    const nextW = Math.max(Math.round(currentW / 2), targetW)
    const nextH = Math.max(Math.round(currentH / 2), targetH)
    const next = document.createElement('canvas')
    next.width = nextW
    next.height = nextH
    const ctx = next.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(canvas, 0, 0, currentW, currentH, 0, 0, nextW, nextH)
    canvas = next
    currentW = nextW
    currentH = nextH
  }

  if (currentW === targetW && currentH === targetH) return canvas

  const out = document.createElement('canvas')
  out.width = targetW
  out.height = targetH
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, currentW, currentH, 0, 0, targetW, targetH)
  return out
}

export async function resizeAndEncode(
  source: HTMLImageElement,
  targetW: number,
  targetH: number,
  format: OutputFormat,
  quality: number,
  allowTransparency = true
): Promise<Blob> {
  const canvas = drawDownscaled(source, Math.max(1, Math.round(targetW)), Math.max(1, Math.round(targetH)))
  return encodeCanvas(canvas, format, quality, allowTransparency)
}

/**
 * Paint an opaque white background behind whatever the canvas already holds,
 * flattening any transparent pixels. `destination-over` draws the fill beneath
 * the existing content, so the image itself is untouched.
 */
function flattenOntoWhite(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'source-over'
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
  allowTransparency = true
): Promise<Blob> {
  // Only PNG carries an alpha channel here; flatten it onto white when the
  // user has opted out of transparency.
  if (!allowTransparency && format === 'image/png') flattenOntoWhite(canvas)
  const useQuality = format === 'image/png' ? undefined : Math.min(1, Math.max(0, quality))
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Encoding failed'))
      },
      format,
      useQuality
    )
  })
}

/**
 * Crop a region from the source then iteratively downscale into the target
 * canvas. Mirrors the half-step logic of drawDownscaled to avoid aliasing
 * when the crop rectangle is much bigger than the requested output.
 */
function drawCropAndDownscale(
  source: HTMLImageElement,
  crop: SourceCrop,
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  const cropW = Math.max(1, Math.round(crop.width))
  const cropH = Math.max(1, Math.round(crop.height))

  let canvas = document.createElement('canvas')
  canvas.width = cropW
  canvas.height = cropH
  const c0 = canvas.getContext('2d')!
  c0.imageSmoothingEnabled = true
  c0.imageSmoothingQuality = 'high'
  c0.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, cropW, cropH)

  let currentW = cropW
  let currentH = cropH

  while (currentW >= targetW * 2 && currentH >= targetH * 2) {
    const nextW = Math.max(Math.round(currentW / 2), targetW)
    const nextH = Math.max(Math.round(currentH / 2), targetH)
    const next = document.createElement('canvas')
    next.width = nextW
    next.height = nextH
    const ctx = next.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(canvas, 0, 0, currentW, currentH, 0, 0, nextW, nextH)
    canvas = next
    currentW = nextW
    currentH = nextH
  }

  if (currentW === targetW && currentH === targetH) return canvas

  const out = document.createElement('canvas')
  out.width = targetW
  out.height = targetH
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, currentW, currentH, 0, 0, targetW, targetH)
  return out
}

/**
 * Run the source through an optional crop, then resize and encode to the
 * given output format. Used for both export and the live preview encode.
 */
export async function processAndEncode(
  source: HTMLImageElement,
  crop: SourceCrop | null,
  targetW: number,
  targetH: number,
  format: OutputFormat,
  quality: number,
  allowTransparency = true
): Promise<Blob> {
  const tw = Math.max(1, Math.round(targetW))
  const th = Math.max(1, Math.round(targetH))
  const canvas = crop
    ? drawCropAndDownscale(source, crop, tw, th)
    : drawDownscaled(source, tw, th)
  return encodeCanvas(canvas, format, quality, allowTransparency)
}

/**
 * Largest rectangle with the target aspect ratio that fits inside the source,
 * centered. Used as the default position when a social preset is selected.
 */
export function computeCenteredCoverCrop(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number
): SourceCrop {
  const presetAspect = targetW / targetH
  let w = srcW
  let h = w / presetAspect
  if (h > srcH) {
    h = srcH
    w = h * presetAspect
  }
  const rw = Math.max(1, Math.round(w))
  const rh = Math.max(1, Math.round(h))
  return {
    x: Math.max(0, Math.round((srcW - rw) / 2)),
    y: Math.max(0, Math.round((srcH - rh) / 2)),
    width: rw,
    height: rh
  }
}

/** Autocrop modes — how the trimmed content box is turned into a crop. */
export type AutoCropMode = 'max' | 'square' | 'ratio'

/**
 * Find the tight bounding box of the image's real content by trimming uniform
 * (near-solid-colour or transparent) borders — the "whitespace" around a logo,
 * scan, or screenshot. The background colour is sampled from the four corners,
 * so a photo on a black card trims just as well as a logo on white.
 *
 * Returns the box in source-pixel space, or `null` when the whole image is a
 * single flat colour (nothing to trim) — callers should fall back to the full
 * image in that case.
 */
export function computeContentBounds(
  image: HTMLImageElement,
  tolerance = 24
): SourceCrop | null {
  const iw = image.naturalWidth
  const ih = image.naturalHeight
  if (!iw || !ih) return null

  // Scan at a capped resolution — a tight bounding box doesn't need every pixel,
  // and reading a 40MP buffer would stall the main thread. Coordinates are
  // scaled back up to source space at the end.
  const MAX_SCAN = 1400
  const scale = Math.min(1, MAX_SCAN / Math.max(iw, ih))
  const sw = Math.max(1, Math.round(iw * scale))
  const sh = Math.max(1, Math.round(ih * scale))

  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, sw, sh)

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, sw, sh).data
  } catch {
    // Tainted canvas (should never happen for same-origin object URLs).
    return null
  }

  // Background = average of the four corner pixels. Robust to a logo that
  // happens to touch one edge.
  const corners = [
    0,
    (sw - 1) * 4,
    (sh - 1) * sw * 4,
    ((sh - 1) * sw + (sw - 1)) * 4
  ]
  let bgR = 0, bgG = 0, bgB = 0
  for (const c of corners) {
    bgR += data[c]!
    bgG += data[c + 1]!
    bgB += data[c + 2]!
  }
  bgR /= 4; bgG /= 4; bgB /= 4
  const tol2 = 3 * tolerance * tolerance

  let minX = sw, minY = sh, maxX = -1, maxY = -1
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4
      const a = data[i + 3]!
      let isContent: boolean
      if (a < 16) {
        isContent = false // transparent → background
      } else {
        const dr = data[i]! - bgR
        const dg = data[i + 1]! - bgG
        const db = data[i + 2]! - bgB
        isContent = dr * dr + dg * dg + db * db > tol2
      }
      if (isContent) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) return null // flat colour — nothing to trim

  // Back to source space, growing the box outward by the scan step so a 1px
  // rounding never clips a hair of real content.
  const inv = 1 / scale
  const x = Math.max(0, Math.floor(minX * inv))
  const y = Math.max(0, Math.floor(minY * inv))
  const right = Math.min(iw, Math.ceil((maxX + 1) * inv))
  const bottom = Math.min(ih, Math.ceil((maxY + 1) * inv))
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) }
}

/**
 * Turn a trimmed content box into the crop rectangle for an Autocrop mode,
 * clamped to the image:
 *   - `max`    → the content box verbatim (tightest trim, any ratio)
 *   - `square` → a centred 1:1 crop big enough to hold all the content
 *   - `ratio`  → the smallest crop with the source's aspect ratio that holds
 *                all the content (trims whitespace while keeping the shape)
 */
export function contentCropForMode(
  bounds: SourceCrop,
  mode: AutoCropMode,
  imgW: number,
  imgH: number
): SourceCrop {
  if (mode === 'max') {
    return clampRect(bounds, imgW, imgH)
  }

  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2

  let w: number
  let h: number
  if (mode === 'square') {
    w = h = Math.min(Math.max(bounds.width, bounds.height), imgW, imgH)
  } else {
    // Grow the content box to the source aspect ratio. Since the source ratio
    // is imgW/imgH, the result always fits inside the image.
    const aspect = imgW / imgH
    if (bounds.width / bounds.height > aspect) {
      w = bounds.width
      h = w / aspect
    } else {
      h = bounds.height
      w = h * aspect
    }
    w = Math.min(w, imgW)
    h = Math.min(h, imgH)
  }

  return clampRect({ x: cx - w / 2, y: cy - h / 2, width: w, height: h }, imgW, imgH)
}

/** Clamp a rect to the image bounds, keeping at least 1px on each axis. */
function clampRect(rect: SourceCrop, imgW: number, imgH: number): SourceCrop {
  const width = Math.max(1, Math.min(imgW, Math.round(rect.width)))
  const height = Math.max(1, Math.min(imgH, Math.round(rect.height)))
  const x = Math.max(0, Math.min(imgW - width, Math.round(rect.x)))
  const y = Math.max(0, Math.min(imgH - height, Math.round(rect.y)))
  return { x, y, width, height }
}

export function formatFilename(originalName: string, width: number, height: number, format: OutputFormat) {
  const dot = originalName.lastIndexOf('.')
  const stem = dot === -1 ? originalName : originalName.slice(0, dot)
  const ext =
    format === 'image/jpeg' ? 'jpg'
      : format === 'image/png' ? 'png'
        : format === 'image/avif' ? 'avif'
          : 'webp'
  return `${stem}_${width}x${height}.${ext}`
}

/**
 * Whether this browser can *encode* AVIF from a canvas. Chrome/Edge can;
 * Firefox and Safari silently fall back to PNG when asked for `image/avif`, so
 * we probe once by encoding a tiny canvas and checking the MIME type we get
 * back. Memoised — the answer never changes within a session.
 */
let avifEncodeSupport: Promise<boolean> | null = null
export function supportsAvifEncode(): Promise<boolean> {
  if (avifEncodeSupport) return avifEncodeSupport
  avifEncodeSupport = new Promise<boolean>((resolve) => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 2
      canvas.height = 2
      canvas.toBlob(
        (blob) => resolve(!!blob && blob.type === 'image/avif'),
        'image/avif',
        0.5
      )
    } catch {
      resolve(false)
    }
  })
  return avifEncodeSupport
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
