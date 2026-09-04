import type { OutputFormat, PresetSize, SourceCrop } from '../types/image'

const HEIC_EXT_RE = /\.(heic|heif)$/i
const HEIC_MIME = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])

/**
 * Is this the thing an iPhone hands you, judged by what it's CALLED?
 *
 * ⚠️ The extension test is not belt-and-braces, it is the one that fires on a
 * desktop. A `.heic` copied off a phone routinely arrives with `file.type ===
 * ''` on Windows, because the OS has no MIME registered for it.
 *
 * Neither half can be relied on inside the Android app, which is what
 * `heicFromBytes` is for.
 */
function isHeicByName(file: File) {
  return HEIC_MIME.has(file.type.toLowerCase()) || HEIC_EXT_RE.test(file.name)
}

/**
 * Is this the thing a phone hands you, judged by what it IS?
 *
 * Because on Android neither the name nor the type is dependable. A file picked
 * out of Google Photos or a third-party file manager reaches the page with a
 * display name that may carry no extension at all (`1000012345`) and a MIME
 * from whichever app owns it — usually right, sometimes `image/*`, sometimes
 * `application/octet-stream`. Get both wrong and a HEIC goes down the ordinary
 * path and dies at `createImageBitmap`, which is the failure this app's HEIC
 * support exists to prevent. This matters more here than on the web: Universal
 * Images ships as a native Android app, where that picker is the only one.
 *
 * HEIC is an ISO-BMFF file: a `ftyp` box at offset 4, a major brand at 8, then
 * a list of compatible brands. AVIF shares the container and every browser this
 * runs in decodes it natively, so it is excluded rather than converted — a slow,
 * lossy round-trip through libheif for a picture Chrome was about to draw free.
 *
 * Exported for its test. `bytes` is the head of the file; 32 covers the usual
 * compatible-brand list.
 */
export function heicFromBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, Math.min(to, bytes.length)))
  if (ascii(4, 8) !== 'ftyp') return false
  const brands = new Set<string>()
  for (let at = 8; at + 4 <= bytes.length; at += 4) brands.add(ascii(at, at + 4))
  if (brands.has('avif') || brands.has('avis')) return false
  for (const brand of ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']) {
    if (brands.has(brand)) return true
  }
  return false
}

/**
 * The head of a file, or a refusal that says it couldn't be read at all.
 *
 * That distinction is the point. On Android a photo picked out of Google Photos
 * can be a placeholder for something that still lives in the cloud and was
 * never downloaded — every read of it fails, and "this image couldn't be
 * decoded" is then true, useless, and blames the picture.
 */
async function head(file: File, n = 32): Promise<Uint8Array> {
  if (file.size === 0) throw new Error(`${file.name} came through empty — try adding it again`)
  try {
    return new Uint8Array(await file.slice(0, n).arrayBuffer())
  } catch {
    throw new Error(
      `${file.name} could not be read from this device — if it lives in the cloud, open it in your photos app first so it downloads`,
    )
  }
}

async function isHeic(file: File): Promise<boolean> {
  return isHeicByName(file) || heicFromBytes(await head(file))
}

// The rest of this app is File-based — the store keeps the file, shows its size
// and hands it to every downstream step — so a HEIC arrives as a JPEG rather
// than as pixels. Lossy, but it is what this app has always done with a HEIC,
// and the alternative (PNG) turns a 2MB photo into a ~50MB one and then reports
// that as its size on screen.
const HEIC_JPEG_QUALITY = 0.92

/**
 * Convert HEIC/HEIF (iPhone) to JPEG on the fly so the rest of the pipeline can
 * treat it as any other raster.
 *
 * ⚠️ **`heic-to` (libheif 1.19), NOT `heic2any`.** heic2any is what this app
 * shipped with, and it fails on every photo a current iPhone takes: those files
 * store the picture as a `grid` of ~45 HEVC tiles with an HDR gain map and a
 * `tmap` tone-map item beside it, and the libheif from 2019 that heic2any
 * bundles answers `ERR_LIBHEIF format not supported`. It decodes a *synthetic*
 * single-item fixture perfectly, which is how a test goes green on something
 * the app cannot do — a generated HEIC does not test HEIC. Verified against
 * real captures, 2026-08-29.
 *
 * ⚠️ **HEIC is checked BEFORE any native decode, deliberately.** This briefly
 * tried `createImageBitmap` first, on the reasoning that Safari and iOS read
 * HEIC natively and would skip a multi-megabyte download. That gives Safari a
 * different code path from every other engine, and only one of the two is ever
 * the one under test — so the saving buys an untested path on the platform the
 * files come from. Universal Converter, Compress and PDF all make the same
 * call, with the same library; the long version is in the HEIC section of
 * `Docs_UNI_SIM/landmines.md`.
 *
 * The decoder is ~3MB, so it is dynamic-imported on the first HEIC and costs
 * nothing to anyone who never opens one. ⚠️ It must also stay out of the PWA
 * precache — see `globIgnores` in `vite.config.ts`, without which the build
 * fails outright on workbox's file-size cap.
 */
export async function decodeHeicIfNeeded(file: File): Promise<File> {
  if (!(await isHeic(file))) return file
  const { heicTo } = await import('heic-to')
  let blob: Blob
  try {
    blob = await heicTo({ blob: file, type: 'image/jpeg', quality: HEIC_JPEG_QUALITY })
  } catch (e) {
    // Name the cause. A friendly sentence that hides the decoder's own words
    // blames the file for something the library did — which is most of how the
    // heic2any breakage stayed invisible for as long as it did.
    const why = e instanceof Error ? e.message : String(e)
    throw new Error(`This HEIC couldn’t be decoded — ${why}`)
  }
  const newName = file.name.replace(HEIC_EXT_RE, '.jpg')
  return new File([blob], newName.endsWith('.jpg') ? newName : `${newName}.jpg`, {
    type: 'image/jpeg',
    lastModified: file.lastModified
  })
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
 * Paint an opaque background of `color` behind whatever the canvas already
 * holds, flattening any transparent pixels. `destination-over` draws the fill
 * beneath the existing content, so the image itself is untouched.
 */
function flattenOnto(canvas: HTMLCanvasElement, color: string) {
  const ctx = canvas.getContext('2d')!
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'source-over'
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
  allowTransparency = true,
  // Explicit background fill (a CSS colour) composited behind the image. When
  // set it wins over `allowTransparency` and applies to every format — this is
  // the "replace the transparent background with a colour" control. Null/omitted
  // leaves the existing behaviour (transparent, or white when transparency off).
  bgFill?: string | null
): Promise<Blob> {
  if (bgFill) {
    flattenOnto(canvas, bgFill)
  } else if (!allowTransparency && format === 'image/png') {
    // Only PNG carries an alpha channel here; flatten it onto white when the
    // user has opted out of transparency.
    flattenOnto(canvas, '#ffffff')
  }
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
  allowTransparency = true,
  bgFill?: string | null
): Promise<Blob> {
  const tw = Math.max(1, Math.round(targetW))
  const th = Math.max(1, Math.round(targetH))
  const canvas = crop
    ? drawCropAndDownscale(source, crop, tw, th)
    : drawDownscaled(source, tw, th)
  return encodeCanvas(canvas, format, quality, allowTransparency, bgFill)
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
 * Alpha below this (0–255) counts as background. It is deliberately well above
 * "barely visible": a matting model (background removal) leaves a wash of
 * near-zero alpha where it was unsure — invisible against the checkerboard, but
 * enough to pin the bounding box to the image edges if we treated any non-zero
 * alpha as content. The subject's own core is opaque, and its anti-aliased rim
 * climbs past this within a pixel or two.
 */
const ALPHA_CONTENT = 64
/**
 * Speck filter. A blob of content is ignored when it is tiny on BOTH axes —
 * under this fraction of the scanned area's long edge — *and* holds under
 * `SPECK_MASS` of all the content found. A mote of dust on a scan, a stray
 * pixel the matting model left behind, a lone JPEG artefact: each is content by
 * colour, and one of them in a corner would otherwise pin the bounding box to
 * the image edge. Both tests must fail before a blob is dropped, so a small but
 * lonely subject (a single icon on white) is still found, and anything with
 * real extent — a hairline rule, a wire, an antenna — is never at risk.
 */
const SPECK_EXTENT = 0.005
const SPECK_MASS = 0.005

/** One connected blob of content: its bounding box and pixel count. */
interface ContentBlob { x0: number; y0: number; x1: number; y1: number; n: number }

/**
 * Connected-component labelling over a binary mask, by horizontal runs: each
 * row's runs are unioned with the runs above them that they touch (8-connected,
 * so a diagonal still counts), and the roots are then reduced to one blob each.
 *
 * Runs rather than pixels because the mask is mostly solid areas — a row of a
 * photo is a single run — and because a per-pixel flood fill over a 1400²
 * scan spends seconds where this spends milliseconds.
 */
function labelRuns(mask: Uint8Array, sw: number, sh: number): ContentBlob[] {
  // Parallel arrays indexed by run, grown geometrically.
  let cap = 1024
  let x0s = new Int32Array(cap)
  let x1s = new Int32Array(cap)
  let ys = new Int32Array(cap)
  let parent = new Int32Array(cap)
  let count = 0
  const addRun = (x0: number, x1: number, y: number) => {
    if (count === cap) {
      cap *= 2
      const grow = (a: Int32Array) => { const b = new Int32Array(cap); b.set(a); return b }
      x0s = grow(x0s); x1s = grow(x1s); ys = grow(ys); parent = grow(parent)
    }
    x0s[count] = x0; x1s[count] = x1; ys[count] = y; parent[count] = count
    return count++
  }
  const find = (a: number) => {
    while (parent[a]! !== a) { parent[a] = parent[parent[a]!]!; a = parent[a]! }
    return a
  }
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[rb > ra ? rb : ra] = rb > ra ? ra : rb
  }

  let prevStart = 0
  let prevEnd = 0
  for (let y = 0; y < sh; y++) {
    const rowStart = count
    const base = y * sw
    let x = 0
    while (x < sw) {
      if (!mask[base + x]) { x++; continue }
      const start = x
      while (x < sw && mask[base + x]) x++
      addRun(start, x - 1, y)
    }
    // Both rows' runs are sorted and disjoint, so one merge walk links them.
    let p = prevStart
    for (let r = rowStart; r < count; r++) {
      while (p < prevEnd && x1s[p]! < x0s[r]! - 1) p++
      for (let q = p; q < prevEnd && x0s[q]! <= x1s[r]! + 1; q++) union(r, q)
    }
    prevStart = rowStart
    prevEnd = count
  }

  // Reduce the runs onto their roots.
  const byRoot = new Map<number, ContentBlob>()
  for (let r = 0; r < count; r++) {
    const root = find(r)
    const x0 = x0s[r]!, x1 = x1s[r]!, y = ys[r]!
    const b = byRoot.get(root)
    if (!b) {
      byRoot.set(root, { x0, y0: y, x1, y1: y, n: x1 - x0 + 1 })
    } else {
      if (x0 < b.x0) b.x0 = x0
      if (x1 > b.x1) b.x1 = x1
      if (y < b.y0) b.y0 = y
      if (y > b.y1) b.y1 = y
      b.n += x1 - x0 + 1
    }
  }
  return [...byRoot.values()]
}

/**
 * Find the tight bounding box of the image's real content by trimming uniform
 * (near-solid-colour or transparent) borders — the "whitespace" around a logo,
 * scan, or screenshot.
 *
 * Always scans the whole image, never the current crop: Autocrop's job is to
 * find the subject, and a crop drawn through it must not be able to hide part
 * of it from the search.
 *
 * Two ways of telling content from background, picked per scan:
 *   - **Alpha** when the image is meaningfully transparent (a cut-out from
 *     background removal). The alpha channel already *is* the answer, and it
 *     stays right when the subject is dark or reaches the edge — colour
 *     sampling would call a black subject "background", since the pixels under
 *     transparency read as black.
 *   - **Colour** otherwise: the background is the median of the image's border
 *     pixels, so a photo on a black card trims like a logo on white. A median
 *     (not the four corners) survives a subject that touches an edge.
 *
 * Returns the box in source-pixel space, or `null` when nothing stands out from
 * the background (a flat colour) — callers decide what to fall back to.
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

  // A cut-out is defined by its alpha channel; anything else by its colour
  // against the border. One transparent pixel in fifty is enough to call it a
  // cut-out — a JPEG or a flattened PNG has none at all.
  let transparent = 0
  for (let i = 3; i < data.length; i += 4) if (data[i]! < ALPHA_CONTENT) transparent++
  const byAlpha = transparent > (sw * sh) / 50

  // Background colour = per-channel median of the image's border pixels.
  let bgR = 0, bgG = 0, bgB = 0
  if (!byAlpha) {
    const edge: number[] = []
    for (let x = 0; x < sw; x++) { edge.push((x) * 4); edge.push(((sh - 1) * sw + x) * 4) }
    for (let y = 0; y < sh; y++) { edge.push((y * sw) * 4); edge.push((y * sw + sw - 1) * 4) }
    const chan = (o: number) => {
      const vals = edge.map((i) => data[i + o]!).sort((a, b) => a - b)
      return vals[vals.length >> 1]!
    }
    bgR = chan(0); bgG = chan(1); bgB = chan(2)
  }
  const tol2 = 3 * tolerance * tolerance

  // Mark every pixel that differs from the background.
  const mask = new Uint8Array(sw * sh)
  let total = 0
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    let content = data[i + 3]! >= ALPHA_CONTENT // transparent → background
    if (content && !byAlpha) {
      const dr = data[i]! - bgR
      const dg = data[i + 1]! - bgG
      const db = data[i + 2]! - bgB
      content = dr * dr + dg * dg + db * db > tol2
    }
    if (content) { mask[p] = 1; total++ }
  }
  if (total === 0) return null // flat colour — nothing to trim

  // Group the marked pixels into blobs so a speck can be judged by its own size
  // rather than by the pixel it happens to sit on. Connected components are
  // labelled a row at a time — each row's horizontal runs are merged with the
  // overlapping runs above them (8-connected) — which costs one pass per row of
  // runs rather than a per-pixel flood fill.
  const blobs = labelRuns(mask, sw, sh)

  // Ignore the specks. If every blob looks like one, the image is made of
  // specks — keep them all rather than reporting nothing.
  const maxSpeck = Math.max(2, Math.round(SPECK_EXTENT * Math.max(sw, sh)))
  const maxSpeckMass = total * SPECK_MASS
  const isSpeck = (b: ContentBlob) =>
    b.x1 - b.x0 + 1 <= maxSpeck && b.y1 - b.y0 + 1 <= maxSpeck && b.n <= maxSpeckMass
  const kept = blobs.some((b) => !isSpeck(b)) ? blobs.filter((b) => !isSpeck(b)) : blobs

  let minX = sw, minY = sh, maxX = -1, maxY = -1
  for (const b of kept) {
    if (b.x0 < minX) minX = b.x0
    if (b.x1 > maxX) maxX = b.x1
    if (b.y0 < minY) minY = b.y0
    if (b.y1 > maxY) maxY = b.y1
  }
  if (maxX < minX || maxY < minY) return null

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
 * True when the image has real transparency — any pixel materially below full
 * opacity. Scans a downscaled copy (a fully-opaque image downscales to alpha
 * 255 everywhere, so this only fires on genuine alpha). Used to enable the
 * background-fill swatches, which only make sense on a transparent image.
 */
export function imageHasAlpha(image: HTMLImageElement, sampleMax = 256): boolean {
  const iw = image.naturalWidth
  const ih = image.naturalHeight
  if (!iw || !ih) return false
  const scale = Math.min(1, sampleMax / Math.max(iw, ih))
  const sw = Math.max(1, Math.round(iw * scale))
  const sh = Math.max(1, Math.round(ih * scale))
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(image, 0, 0, sw, sh)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, sw, sh).data
  } catch {
    return false
  }
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 250) return true
  }
  return false
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
  // Bounding region the result is clamped to — the whole image
  // ({x:0,y:0,width:imgW,height:imgH}). `square`/`ratio` are sized relative to
  // it, so the aspect `ratio` keeps is the source's.
  region: SourceCrop
): SourceCrop {
  if (mode === 'max') {
    return clampRect(bounds, region)
  }

  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2

  let w: number
  let h: number
  if (mode === 'square') {
    w = h = Math.min(Math.max(bounds.width, bounds.height), region.width, region.height)
  } else {
    // Grow the content box to the region's aspect ratio. Since that ratio is
    // region.width/region.height, the result always fits inside the region.
    const aspect = region.width / region.height
    if (bounds.width / bounds.height > aspect) {
      w = bounds.width
      h = w / aspect
    } else {
      h = bounds.height
      w = h * aspect
    }
    w = Math.min(w, region.width)
    h = Math.min(h, region.height)
  }

  return clampRect({ x: cx - w / 2, y: cy - h / 2, width: w, height: h }, region)
}

/** Clamp a rect to a bounding region, keeping at least 1px on each axis. */
function clampRect(rect: SourceCrop, region: SourceCrop): SourceCrop {
  const width = Math.max(1, Math.min(region.width, Math.round(rect.width)))
  const height = Math.max(1, Math.min(region.height, Math.round(rect.height)))
  const x = Math.max(region.x, Math.min(region.x + region.width - width, Math.round(rect.x)))
  const y = Math.max(region.y, Math.min(region.y + region.height - height, Math.round(rect.y)))
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
