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

/**
 * Decode a File into an HTMLImageElement and its natural dimensions.
 * Resolves once the image has loaded — caller is responsible for revoking
 * the returned object URL when the image is no longer needed.
 *
 * Transparently handles HEIC/HEIF input by converting to JPEG first.
 */
export async function loadImage(file: File): Promise<{ image: HTMLImageElement; objectUrl: string; width: number; height: number; file: File }> {
  const usableFile = await decodeHeicIfNeeded(file)
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
  quality: number
): Promise<Blob> {
  const canvas = drawDownscaled(source, Math.max(1, Math.round(targetW)), Math.max(1, Math.round(targetH)))
  return encodeCanvas(canvas, format, quality)
}

function encodeCanvas(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
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
  quality: number
): Promise<Blob> {
  const tw = Math.max(1, Math.round(targetW))
  const th = Math.max(1, Math.round(targetH))
  const canvas = crop
    ? drawCropAndDownscale(source, crop, tw, th)
    : drawDownscaled(source, tw, th)
  return encodeCanvas(canvas, format, quality)
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

export function formatFilename(originalName: string, width: number, height: number, format: OutputFormat) {
  const dot = originalName.lastIndexOf('.')
  const stem = dot === -1 ? originalName : originalName.slice(0, dot)
  const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp'
  return `${stem}_${width}x${height}.${ext}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
