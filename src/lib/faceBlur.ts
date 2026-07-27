import type { FaceDetector } from '@mediapipe/tasks-vision'
import { loadImage } from './imageResize'

/**
 * Local, private **face redaction** — detect faces and blur/pixelate them,
 * running **entirely in the browser**.
 *
 * Detection uses Google MediaPipe's BlazeFace short-range model via
 * [`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision),
 * a WASM face detector. It runs on the **main thread** (the library is
 * dynamically imported the first time the tool is used, so it stays out of the
 * base bundle). We deliberately do NOT run it in a Worker: MediaPipe loads its
 * WASM glue with `importScripts()`, which only exists in *classic* workers —
 * but a classic worker built by Vite can't be served with an ESM `import` in
 * dev ("Cannot use import statement outside a module"), while a *module* worker
 * has no `importScripts` (the glue's factory never registers → "ModuleFactory
 * not set."). On the main thread the runtime loads via a `<script>` tag and
 * just works across browsers and in both dev and build. A single still image is
 * quick, so the brief on-thread detection doesn't jank the UI.
 *
 * Mirroring the background-removal tool, **your image is never uploaded**: the
 * only thing that leaves the browser is a one-time download of the MediaPipe
 * WASM runtime (~2 MB) plus the tiny BlazeFace model (~230 KB), fetched from
 * their official CDNs on first use and then browser-cached (and served locally
 * instead when `VITE_FACE_MODEL_PATH` is set — see below). The blur itself is a
 * pure Canvas operation; no pixels are sent anywhere.
 *
 * `VITE_FACE_MODEL_PATH` (optional): when set at build time, the MediaPipe WASM
 * fileset and the model are loaded from this base path instead of the CDNs —
 * point it at a folder holding `wasm/` (the `@mediapipe/tasks-vision` `wasm`
 * dir) and `blaze_face_short_range.tflite` to make the feature fully offline
 * (e.g. for the desktop build). Left unset, the CDN defaults are used. This is
 * the face-redaction twin of `VITE_BG_REMOVAL_PATH`.
 */

// Pin the CDN runtime to the installed package version so the fetched WASM
// always matches the `@mediapipe/tasks-vision` JS bundled into the worker.
const TASKS_VISION_VERSION = '0.10.35'

const SELF_HOST_BASE = ((import.meta.env.VITE_FACE_MODEL_PATH as string | undefined) || '').trim().replace(/\/$/, '')

/** Directory the MediaPipe WASM fileset is served from. */
export const FACE_WASM_PATH = SELF_HOST_BASE
  ? `${SELF_HOST_BASE}/wasm`
  : `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`

/** URL of the BlazeFace short-range detection model. */
export const FACE_MODEL_PATH = SELF_HOST_BASE
  ? `${SELF_HOST_BASE}/blaze_face_short_range.tflite`
  : 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

/** A detected face box in source-image pixel space, plus its keep/redact flag. */
export interface FaceBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  /** When true the face is blurred; when false the user has chosen to keep it. */
  enabled: boolean
}

export type FaceBlurStyle = 'blur' | 'pixelate'

interface RawBox {
  x: number
  y: number
  width: number
  height: number
}

// Build the MediaPipe detector once (dynamically importing the library on first
// use so its ~126 KB JS stays out of the base bundle), then reuse it for every
// image so the WASM runtime + model are only fetched/initialised once.
let detectorPromise: Promise<FaceDetector> | null = null

function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(FACE_WASM_PATH)
      return FaceDetector.createFromOptions(vision, {
        // CPU delegate: reliable and dependency-free (no WebGL/WebGPU context
        // needed). A single still image is quick on CPU.
        baseOptions: { modelAssetPath: FACE_MODEL_PATH, delegate: 'CPU' },
        runningMode: 'IMAGE',
      })
    })()
    // Don't cache a failed init — a transient CDN hiccup shouldn't wedge the
    // tool forever; let the next attempt rebuild the detector.
    detectorPromise.catch(() => { detectorPromise = null })
  }
  return detectorPromise
}

/**
 * Detect faces in an image file, returning boxes in the image's pixel space.
 * Runs the MediaPipe detector on the main thread (see the module doc for why a
 * Worker isn't used); the detector is cached across calls.
 */
export async function detectFaces(file: File): Promise<Omit<FaceBox, 'id' | 'enabled'>[]> {
  const { image, objectUrl } = await loadImage(file)
  try {
    const detector = await getDetector()
    const result = detector.detect(image)
    const boxes: RawBox[] = (result.detections ?? []).flatMap((d) => {
      const b = d.boundingBox
      if (!b) return []
      return [{ x: b.originX, y: b.originY, width: b.width, height: b.height }]
    })
    // Clamp to the image and order top-to-bottom, left-to-right so the panel's
    // "Face 1, 2, 3…" numbering is stable and matches reading order.
    const iw = image.naturalWidth
    const ih = image.naturalHeight
    return boxes
      .map((b) => {
        const x = Math.max(0, Math.min(iw - 1, b.x))
        const y = Math.max(0, Math.min(ih - 1, b.y))
        return {
          x,
          y,
          width: Math.max(1, Math.min(iw - x, b.width)),
          height: Math.max(1, Math.min(ih - y, b.height)),
        }
      })
      .sort((a, b) => (a.y - b.y) || (a.x - b.x))
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Redact one face box in place on `ctx`. Both styles work by resampling the
 * face region through a tiny intermediate canvas — pixelate keeps it blocky
 * (nearest-neighbour), blur smooths it (bilinear) — which avoids the edge-bleed
 * a Canvas `filter: blur()` shows at the region border and behaves identically
 * across browsers. Higher strength → smaller intermediate → heavier redaction.
 */
function redactBox(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  box: RawBox,
  imgW: number,
  imgH: number,
  strength: number,
  style: FaceBlurStyle
) {
  // Grow the detector's tight box so hairline, chin and ears are covered too.
  const padX = box.width * 0.18
  const padY = box.height * 0.22
  const bx = Math.max(0, Math.floor(box.x - padX))
  const by = Math.max(0, Math.floor(box.y - padY))
  const bw = Math.min(imgW - bx, Math.ceil(box.width + padX * 2))
  const bh = Math.min(imgH - by, Math.ceil(box.height + padY * 2))
  if (bw < 1 || bh < 1) return

  const t = Math.min(1, Math.max(0, strength / 100))
  // Samples across the face: strength 0 → ~24 (subtle), strength 100 → 2 (heavy).
  const maxCells = 24
  const minCells = 2
  const cells = Math.max(minCells, Math.round(maxCells - t * (maxCells - minCells)))
  const tw = Math.max(1, cells)
  const th = Math.max(1, Math.round(cells * (bh / bw)))

  const tmp = document.createElement('canvas')
  tmp.width = tw
  tmp.height = th
  const tctx = tmp.getContext('2d')!
  const smooth = style === 'blur'
  tctx.imageSmoothingEnabled = smooth
  tctx.drawImage(source, bx, by, bw, bh, 0, 0, tw, th)

  ctx.save()
  ctx.imageSmoothingEnabled = smooth
  if (smooth) ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(tmp, 0, 0, tw, th, bx, by, bw, bh)
  ctx.restore()
}

/**
 * Draw `image` into a canvas at natural size and redact every enabled face box.
 * Returns the canvas so the caller can encode it to a file. Disabled boxes are
 * skipped, so per-face un-redaction is just a re-render with that box off.
 *
 * `mask` (optional) is an alpha stencil applied after the redaction: the result
 * keeps only the pixels the mask keeps. It exists for the "blur faces, then
 * remove the background" combination — the blur is rendered from the ORIGINAL
 * opaque photo (so the redaction has real pixels to resample and the subject's
 * silhouette stays crisp), then the cut-out is used as the mask so the blurred
 * layer is erased in exactly the same places the background was.
 */
export function renderRedacted(
  image: HTMLImageElement,
  boxes: FaceBox[],
  strength: number,
  style: FaceBlurStyle,
  mask?: CanvasImageSource | null
): HTMLCanvasElement {
  const w = image.naturalWidth
  const h = image.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  for (const box of boxes) {
    if (box.enabled) redactBox(ctx, canvas, box, w, h, strength, style)
  }
  if (mask) {
    // `destination-in` multiplies what we've drawn by the mask's alpha. Scaled
    // to the canvas defensively — the cut-out is the same size as its source,
    // but a mismatch should stretch the stencil, not offset it.
    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(mask, 0, 0, w, h)
    ctx.restore()
  }
  return canvas
}

/**
 * Bake the redaction into a PNG File (lossless, so no faces leak through JPEG
 * artefacts and any source alpha is preserved). The result replaces the source
 * image in the editor; the pre-redaction original is kept for one-tap undo.
 */
export async function renderRedactedFile(
  file: File,
  boxes: FaceBox[],
  strength: number,
  style: FaceBlurStyle,
  maskFile?: File | null
): Promise<{ blob: Blob; width: number; height: number }> {
  const { image, objectUrl } = await loadImage(file)
  let maskUrl: string | null = null
  try {
    let mask: HTMLImageElement | null = null
    if (maskFile) {
      const loaded = await loadImage(maskFile)
      maskUrl = loaded.objectUrl
      mask = loaded.image
    }
    const canvas = renderRedacted(image, boxes, strength, style, mask)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render redacted image'))), 'image/png')
    })
    return { blob, width: canvas.width, height: canvas.height }
  } finally {
    URL.revokeObjectURL(objectUrl)
    if (maskUrl) URL.revokeObjectURL(maskUrl)
  }
}

/** Derive the redacted filename: `photo.jpg` → `photo-blurred.png`. */
export function deriveBlurredName(originalName: string): string {
  const dot = originalName.lastIndexOf('.')
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName
  return `${stem}-blurred.png`
}
