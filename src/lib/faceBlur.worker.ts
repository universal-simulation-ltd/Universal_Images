/// <reference lib="webworker" />
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

/**
 * Face-detection worker. Keeps the MediaPipe runtime (and its WASM download)
 * off the main thread so detection never janks the UI. The heavy
 * `@mediapipe/tasks-vision` JS lands in this worker's own chunk — the Worker is
 * only ever constructed lazily (when the "Redact faces" tool runs), so it stays
 * out of the base app bundle.
 *
 * The image bitmap is transferred in from the main thread; only bounding boxes
 * (plain numbers) are posted back. The picture itself never leaves the device.
 */

interface DetectRequest {
  bitmap: ImageBitmap
  /** Directory the MediaPipe WASM fileset is served from (CDN or self-hosted). */
  wasmPath: string
  /** URL of the BlazeFace `.tflite` model. */
  modelPath: string
}

interface RawBox {
  x: number
  y: number
  width: number
  height: number
}

let detectorPromise: Promise<FaceDetector> | null = null

function getDetector(wasmPath: string, modelPath: string): Promise<FaceDetector> {
  // Build the detector once, then reuse it for every subsequent image so the
  // WASM + model are only fetched/initialised on first use.
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(wasmPath)
      return FaceDetector.createFromOptions(vision, {
        // CPU delegate: reliable inside a worker where a WebGL/WebGPU context
        // may be unavailable. A single still image is quick on CPU.
        baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
        runningMode: 'IMAGE',
      })
    })()
  }
  return detectorPromise
}

self.onmessage = async (e: MessageEvent<DetectRequest>) => {
  const { bitmap, wasmPath, modelPath } = e.data
  try {
    const detector = await getDetector(wasmPath, modelPath)
    const result = detector.detect(bitmap)
    const boxes: RawBox[] = (result.detections ?? []).flatMap((d) => {
      const b = d.boundingBox
      if (!b) return []
      return [{ x: b.originX, y: b.originY, width: b.width, height: b.height }]
    })
    ;(self as unknown as Worker).postMessage({ ok: true, boxes })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ ok: false, error: (err as Error)?.message || 'Face detection failed' })
  } finally {
    bitmap.close()
  }
}
