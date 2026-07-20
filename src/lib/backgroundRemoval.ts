import { loadImage } from './imageResize'

/**
 * One-click AI background removal — runs **entirely in the browser**.
 *
 * The cut-out is computed on-device by an ONNX/WASM segmentation model
 * (`@imgly/background-removal`). Your image is never uploaded: the only thing
 * that leaves the browser is a one-time download of the ~40 MB model weights,
 * fetched from the library's official CDN on first use and then cached by the
 * browser (and, when `VITE_BG_REMOVAL_PATH` is set, served locally instead —
 * see below). This keeps the feature on-brand with the rest of the suite:
 * local-first, no server round-trip, no account.
 *
 * We use the `isnet_fp16` ("small") model — roughly half the size of the full
 * `isnet` model with near-identical quality for photo subjects, so first use is
 * quicker and lighter.
 *
 * `VITE_BG_REMOVAL_PATH` (optional): when set at build time, model + WASM
 * assets are loaded from this path instead of the CDN. Point it at a folder of
 * self-hosted `@imgly/background-removal-data` assets to make the feature fully
 * offline (e.g. for the desktop build). Left unset, the CDN default is used.
 */

/** Progress callback: 0..1 across the download + inference of the model. */
export type BgProgress = (fraction: number) => void

export interface BgResult {
  /** Transparent-background PNG. */
  blob: Blob
  width: number
  height: number
}

// Self-hosted asset path, if the build provides one. Must end in a slash for
// the library to resolve `/models/…` and `/onnxruntime-web/…` beneath it.
const PUBLIC_PATH = ((import.meta.env.VITE_BG_REMOVAL_PATH as string | undefined) || '').trim()

/**
 * Remove the background from an image file, returning a transparent PNG plus
 * its pixel dimensions. `onProgress` (0..1) covers the model fetch + inference
 * so the UI can show a determinate bar on first use.
 */
export async function removeImageBackground(file: File, onProgress?: BgProgress): Promise<BgResult> {
  // Dynamic import: the segmentation library (+ its worker/WASM glue) is only
  // pulled into the bundle when the user actually removes a background, keeping
  // the initial app load lean for the resize-only majority.
  const { removeBackground } = await import('@imgly/background-removal')

  const blob = await removeBackground(file, {
    model: 'isnet_fp16',
    ...(PUBLIC_PATH ? { publicPath: PUBLIC_PATH } : {}),
    output: { format: 'image/png' },
    progress: (_key, current, total) => {
      // The library reports progress per resource (model shards, wasm). Surface
      // a coarse overall fraction; guard against the divide-by-zero it can emit
      // for a zero-length resource.
      if (!onProgress || !total) return
      onProgress(Math.max(0, Math.min(1, current / total)))
    },
  })

  // Read back the true output dimensions (the model preserves the source size,
  // but decode the result rather than trusting that so downstream sizing is
  // always correct).
  const { width, height, objectUrl } = await loadImage(new File([blob], 'nobg.png', { type: 'image/png' }))
  URL.revokeObjectURL(objectUrl)

  return { blob, width, height }
}

/**
 * Derive the cut-out's filename from the original: `photo.jpg` → `photo-nobg.png`.
 * Always `.png`, since the transparent result requires an alpha channel.
 */
export function deriveNobgName(originalName: string): string {
  const dot = originalName.lastIndexOf('.')
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName
  return `${stem}-nobg.png`
}
