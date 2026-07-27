import { create } from 'zustand'
import type { OutputFormat, ResizeTarget, SourceCrop, SourceImage } from '../types/image'
import {
  computeCenteredCoverCrop,
  computeContentBounds,
  contentCropForMode,
  loadImage,
  type AutoCropMode
} from '../lib/imageResize'
import { removeImageBackground, deriveNobgName, type BgProgress } from '../lib/backgroundRemoval'
import { detectFaces as runFaceDetection, renderRedactedFile, deriveBlurredName, type FaceBox, type FaceBlurStyle } from '../lib/faceBlur'
import { readImageMetadata, scrubImageMetadata, type ImageMetadata, type ScrubResult } from '../lib/metadata'

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Per-image editing state, stashed when the user switches away so each image
 * keeps its own custom size, crop, background fill and background-removal
 * snapshots. The `edits` map only ever holds the NON-selected images — the
 * selected image's working state lives in the top-level active fields.
 */
interface ImageEdit {
  target: ResizeTarget
  crop: SourceCrop | null
  socialCrop: SourceCrop | null
  bgFill: string | null
  bgOriginal: SourceImage | null
  bgCutout: SourceImage | null
  faceOriginal: SourceImage | null
  faceBoxes: FaceBox[] | null
}

function revokeEditUrls(edit: ImageEdit | undefined) {
  if (!edit) return
  if (edit.bgOriginal) URL.revokeObjectURL(edit.bgOriginal.objectUrl)
  if (edit.bgCutout) URL.revokeObjectURL(edit.bgCutout.objectUrl)
  if (edit.faceOriginal) URL.revokeObjectURL(edit.faceOriginal.objectUrl)
}

/**
 * Free the bitmaps in `dropped` that we're no longer referencing. Snapshots are
 * shared by reference across the active fields, the `edits` stash and the image
 * list (a cut-out can be both "the image shown" and "the clean base held for
 * undo"), so anything still reachable must be spared — `keep` lists those.
 */
function revokeDropped(dropped: (SourceImage | null | undefined)[], keep: (SourceImage | null | undefined)[]) {
  const kept = new Set(keep.filter(Boolean).map((s) => s!.objectUrl))
  const freed = new Set<string>()
  for (const s of dropped) {
    if (!s || kept.has(s.objectUrl) || freed.has(s.objectUrl)) continue
    freed.add(s.objectUrl)
    URL.revokeObjectURL(s.objectUrl)
  }
}

/**
 * Render the face redaction that sits on top of `base` and wrap it as a
 * SourceImage. Pure — it touches no store state, so callers can bake the new
 * bitmap *before* swapping it in and never flash an un-redacted frame.
 *
 * `opaqueSource` is set when `base` is a background cut-out: the blur is then
 * rendered from that pre-removal photo (real, opaque pixels to resample) and
 * stencilled by the cut-out's alpha, so the blurred layer is erased in exactly
 * the same places the background was. Passing null blurs `base` directly.
 */
async function bakeFaceBlur(
  base: SourceImage,
  opaqueSource: SourceImage | null,
  boxes: FaceBox[],
  strength: number,
  style: FaceBlurStyle
): Promise<SourceImage> {
  const { blob, width, height } = await renderRedactedFile(
    (opaqueSource ?? base).file,
    boxes,
    strength,
    style,
    opaqueSource ? base.file : null
  )
  const name = deriveBlurredName(base.name)
  const file = new File([blob], name, { type: 'image/png' })
  return { id: base.id, name, file, width, height, objectUrl: URL.createObjectURL(file), bytes: file.size }
}

/**
 * Re-apply the redaction currently configured in `state` over a new base — the
 * fresh cut-out after a background removal, or the full image after a restore.
 * Returns `base` itself when there's nothing to redact, so callers can tell a
 * real bake from a pass-through by identity.
 */
function rebakeBlur(
  state: { faceBoxes: FaceBox[] | null; faceBlurStrength: number; faceBlurStyle: FaceBlurStyle },
  base: SourceImage,
  opaqueSource: SourceImage | null
): Promise<SourceImage> {
  const boxes = state.faceBoxes
  if (!boxes || boxes.length === 0) return Promise.resolve(base)
  return bakeFaceBlur(base, opaqueSource, boxes, state.faceBlurStrength, state.faceBlurStyle)
}

function chooseDefaultFormat(file: File): OutputFormat {
  const t = file.type
  if (t === 'image/png') return 'image/png'
  if (t === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

interface ImageStore {
  images: SourceImage[]
  selectedId: string | null
  target: ResizeTarget | null
  loading: boolean
  /**
   * Free-form, non-destructive crop on the selected image (any aspect ratio).
   * Lives only in memory and is consumed by the export pipeline — the source
   * image is never rewritten, so changing the size preset just re-exports the
   * same region at a new resolution. Mutually exclusive with `socialCrop`.
   */
  crop: SourceCrop | null
  /**
   * Non-destructive crop applied when a social-media preset is active.
   * Lives only in memory and is consumed by the export pipeline — the source
   * image is never rewritten. Cleared when the user picks a non-social size.
   */
  socialCrop: SourceCrop | null
  /**
   * EXIF / IPTC / XMP read per image, keyed by image id. Populated in the
   * background as images are added so the editor can show the "Metadata"
   * badge only for photos that actually carry any. A `null` entry means the
   * read finished and found nothing.
   */
  metadata: Record<string, ImageMetadata | null>
  /** True while the metadata panel is open. */
  metadataOpen: boolean
  setMetadataOpen: (open: boolean) => void
  /**
   * Strip the selected image's metadata, replacing it in place with a
   * losslessly-rewritten copy. Resolves with what actually happened so the UI
   * can be honest about formats it can't rewrite.
   */
  scrubMetadata: () => Promise<ScrubResult | null>
  /** True while a scrub is running. */
  scrubbing: boolean
  /** Add one or more files; only successfully-decoded images are appended. */
  addFiles: (files: File[] | FileList) => Promise<void>
  selectImage: (id: string) => void
  removeImage: (id: string) => void
  clearAll: () => void
  setTarget: (partial: Partial<ResizeTarget>) => void
  /** Recompute target defaults (size + format) from the currently selected image. */
  resetTargetToSelected: () => void
  /** Set / replace the free-form crop (clamped to the image). null clears it. */
  setCrop: (rect: { x: number; y: number; width: number; height: number } | null) => void
  /** Drop a default centered crop (~60%) so touch users get an editable box. */
  addCenteredCrop: () => void
  /**
   * Trim the whitespace around the selected image and set the result as the
   * free-form crop. `max` gives the tightest box, `square` a centred 1:1, and
   * `ratio` keeps the source aspect. Async — it decodes the image to inspect
   * its pixels.
   */
  autoCrop: (mode: AutoCropMode) => Promise<void>
  /** True while `autoCrop` is decoding + scanning the image. */
  autoCropping: boolean
  /** Forget the free-form crop — the whole image exports again. */
  clearCrop: () => void
  /**
   * Pick a social-media preset: set the output dimensions and initialise a
   * centered, max-size crop at that aspect ratio so the source isn't squished.
   */
  applySocialPreset: (width: number, height: number) => void
  /** Move the social-crop rectangle while keeping its size. */
  moveSocialCrop: (x: number, y: number) => void
  /** Forget the social crop — the source aspect controls again. */
  clearSocialCrop: () => void
  /**
   * One-click AI background removal (runs in-browser). Replaces the selected
   * image in place with a transparent-background PNG, switches the output to
   * PNG-with-transparency, and stashes the pre-removal image so it can be
   * restored. `onProgress` (0..1) tracks the first-use model download.
   */
  removeBackground: (onProgress?: BgProgress) => Promise<void>
  /** True while the segmentation model is downloading / running. */
  removingBg: boolean
  /** 0..1 progress of the current removal (model fetch + inference). */
  bgProgress: number
  /**
   * Snapshot of the selected image *before* its background was removed, kept so
   * "Restore background" can undo it. Null when the selected image hasn't had
   * its background removed (or the snapshot was cleared on select/remove).
   * Always the CLEAN version — never a face-blur bake — so it doubles as the
   * opaque source the blur is re-rendered from while a cut-out is shown.
   */
  bgOriginal: SourceImage | null
  /**
   * Cached cut-out for the selected image, kept after a "Restore background" so
   * that clicking "Remove background" again swaps it straight back in without
   * re-running the model. Held only while that image stays selected (revoked on
   * select-away / remove / clear). Mutually exclusive with `bgOriginal`: whichever
   * version isn't currently shown is the one cached. Clean (un-blurred), like
   * `bgOriginal` — the face blur is re-baked on top after the swap.
   */
  bgCutout: SourceImage | null
  /**
   * Put the pre-removal image back. The cut-out is kept in `bgCutout` (not
   * discarded) so re-removing is instant.
   */
  restoreBackground: () => void
  /**
   * Solid background fill (a CSS colour) composited behind the selected image on
   * preview + export — the "replace the transparent background with a colour"
   * control. Null = leave transparent. Only meaningful when the image has
   * transparency; reset whenever the selected image / its version changes.
   */
  bgFill: string | null
  setBgFill: (color: string | null) => void
  /**
   * Detected face boxes for the selected image (source-pixel space), each with
   * an `enabled` flag so individual faces can be kept un-redacted. Null until
   * the user runs face detection; an empty array means "detected, none found".
   */
  faceBoxes: FaceBox[] | null
  /** True while the on-device face detector is downloading / running. */
  detectingFaces: boolean
  /**
   * Snapshot of the selected image *before* faces were blurred, kept so
   * "Remove blur" can undo it in one tap. Non-null exactly when a redaction is
   * currently applied to the selected image. Cleared on select/remove.
   *
   * The blur sits *above* the background edit: this is the un-blurred image for
   * whichever background state is current — the full original, or the cut-out
   * once the background has been removed — and the blur is re-baked from it
   * whenever that state changes.
   */
  faceOriginal: SourceImage | null
  /** Redaction strength 0..100 (higher = heavier blur / bigger pixels). */
  faceBlurStrength: number
  /** Redaction style — a soft blur or a blocky pixelate. */
  faceBlurStyle: FaceBlurStyle
  setFaceBlurStrength: (n: number) => void
  setFaceBlurStyle: (style: FaceBlurStyle) => void
  /**
   * Detect faces in the selected image on-device (MediaPipe BlazeFace in a
   * worker), then bake a blur over every detected face. The pre-blur image is
   * stashed in `faceOriginal` for undo. The picture is never uploaded.
   */
  detectFaces: () => Promise<void>
  /** Toggle a single face's redaction on/off, then re-render the blur. */
  setFaceEnabled: (id: string, enabled: boolean) => void
  /**
   * Re-render the redaction from the clean original using the current boxes +
   * strength + style. Called by the detect flow and whenever a control changes.
   */
  applyFaceBlur: () => Promise<void>
  /** Put the un-blurred original back. Detected boxes are kept so re-blurring is instant. */
  clearFaceBlur: () => void
  /**
   * Saved editing state for every image that ISN'T currently selected, so
   * switching images preserves each one's size/crop/fill/background edits.
   * Keyed by image id; the selected image's state lives in the active fields.
   */
  edits: Record<string, ImageEdit>
  /** "Hosted by UNI·SIM" cloud-store dialog open state. */
  hostedStoreOpen: boolean
  setHostedStoreOpen: (open: boolean) => void
  /**
   * Set when the user enters via the homepage "Convert" action — the editor
   * opens with the Format & quality section expanded and highlighted. Cleared
   * once the user has seen / dismissed it.
   */
  convertMode: boolean
  setConvertMode: (on: boolean) => void
}

function makeDefaultTarget(img: SourceImage): ResizeTarget {
  return {
    width: img.width,
    height: img.height,
    aspectLocked: true,
    quality: 0.85,
    format: chooseDefaultFormat(img.file),
    allowTransparency: true
  }
}

/** Clamp a crop rect to the image bounds, keeping at least 1px. */
function clampCrop(
  rect: { x: number; y: number; width: number; height: number },
  imgW: number,
  imgH: number
): SourceCrop {
  const width = Math.max(1, Math.min(imgW, Math.round(rect.width)))
  const height = Math.max(1, Math.min(imgH, Math.round(rect.height)))
  const x = Math.max(0, Math.min(imgW - width, Math.round(rect.x)))
  const y = Math.max(0, Math.min(imgH - height, Math.round(rect.y)))
  return { x, y, width, height }
}

// Filenames like 'photo.heic' have no MIME type in some browsers, so we accept
// any file that *looks* like an image by name even when File.type is empty.
const NAME_IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif|svg)$/i

function looksLikeImage(file: File) {
  return file.type.startsWith('image/') || NAME_IMAGE_RE.test(file.name)
}

export const useImageStore = create<ImageStore>((set, get) => ({
  images: [],
  selectedId: null,
  target: null,
  loading: false,
  hostedStoreOpen: false,
  setHostedStoreOpen: (hostedStoreOpen) => set({ hostedStoreOpen }),
  convertMode: false,
  setConvertMode: (convertMode) => set({ convertMode }),
  crop: null,
  socialCrop: null,
  autoCropping: false,
  removingBg: false,
  bgProgress: 0,
  bgOriginal: null,
  bgCutout: null,
  bgFill: null,
  setBgFill: (bgFill) => set({ bgFill }),
  faceBoxes: null,
  detectingFaces: false,
  faceOriginal: null,
  faceBlurStrength: 60,
  faceBlurStyle: 'blur',
  setFaceBlurStrength: (faceBlurStrength) => set({ faceBlurStrength }),
  setFaceBlurStyle: (faceBlurStyle) => set({ faceBlurStyle }),
  edits: {},
  metadata: {},
  metadataOpen: false,
  scrubbing: false,
  setMetadataOpen: (metadataOpen) => set({ metadataOpen }),

  async scrubMetadata() {
    const cur = get()
    const img = cur.images.find((i) => i.id === cur.selectedId)
    if (!img || cur.scrubbing) return null

    set({ scrubbing: true })
    try {
      const result = await scrubImageMetadata(img.file)
      if (result.mode === 'unsupported') return result

      // Same pixels, new container — swap the file (and its object URL, so
      // anything reading from it downstream sees the cleaned bytes) and mark
      // the cached read as empty.
      const objectUrl = URL.createObjectURL(result.file)
      URL.revokeObjectURL(img.objectUrl)
      set((s) => ({
        images: s.images.map((i) =>
          i.id === img.id
            ? { ...i, file: result.file, bytes: result.file.size, objectUrl }
            : i
        ),
        metadata: { ...s.metadata, [img.id]: null }
      }))
      return result
    } finally {
      set({ scrubbing: false })
    }
  },

  async addFiles(input) {
    const files = Array.from(input).filter(looksLikeImage)
    if (files.length === 0) return
    set({ loading: true })
    try {
      const decoded: SourceImage[] = []
      // The file as the user dropped it, kept alongside the decoded image so the
      // metadata read sees the ORIGINAL — a HEIC loses its EXIF in the JPEG
      // conversion below, and reading the converted copy would wrongly report
      // a geotagged photo as clean.
      const originals: { id: string; file: File }[] = []
      for (const file of files) {
        try {
          // loadImage transparently converts HEIC → JPEG and returns the usable file.
          const { objectUrl, width, height, file: usableFile } = await loadImage(file)
          const id = makeId()
          decoded.push({
            id,
            name: usableFile.name,
            file: usableFile,
            width,
            height,
            objectUrl,
            bytes: usableFile.size,
            converted: usableFile !== file
          })
          originals.push({ id, file })
        } catch (err) {
          console.warn('Skipping unreadable image', file.name, err)
        }
      }
      if (decoded.length === 0) return
      const existing = get().images
      const next = [...existing, ...decoded]
      const selectedId = get().selectedId ?? decoded[0]!.id
      const selected = next.find((i) => i.id === selectedId)!
      set({
        images: next,
        selectedId,
        target: get().target ?? makeDefaultTarget(selected)
      })

      // Read metadata in the background — it pulls in `exifr` on first use and
      // must never hold up showing the image.
      for (const { id, file } of originals) {
        readImageMetadata(file)
          .then((meta) => {
            // The image may have been removed while the read was in flight.
            if (!get().images.some((i) => i.id === id)) return
            set((s) => ({ metadata: { ...s.metadata, [id]: meta.hasAny ? meta : null } }))
          })
          .catch((err) => {
            console.warn('Could not read metadata for', file.name, err)
            set((s) => ({ metadata: { ...s.metadata, [id]: null } }))
          })
      }
    } finally {
      set({ loading: false })
    }
  },

  selectImage(id) {
    const cur = get()
    const img = cur.images.find((i) => i.id === id)
    if (!img || cur.selectedId === id) return
    const edits = { ...cur.edits }
    // Stash the outgoing image's working state so it's restored when re-selected.
    if (cur.selectedId && cur.target) {
      edits[cur.selectedId] = {
        target: cur.target,
        crop: cur.crop,
        socialCrop: cur.socialCrop,
        bgFill: cur.bgFill,
        bgOriginal: cur.bgOriginal,
        bgCutout: cur.bgCutout,
        faceOriginal: cur.faceOriginal,
        faceBoxes: cur.faceBoxes
      }
    }
    // Load the incoming image's saved state (or fresh defaults) and remove it
    // from the map — it's the active image now.
    const saved = edits[id]
    delete edits[id]
    set({
      edits,
      selectedId: id,
      target: saved?.target ?? makeDefaultTarget(img),
      crop: saved?.crop ?? null,
      socialCrop: saved?.socialCrop ?? null,
      bgFill: saved?.bgFill ?? null,
      bgOriginal: saved?.bgOriginal ?? null,
      bgCutout: saved?.bgCutout ?? null,
      faceOriginal: saved?.faceOriginal ?? null,
      faceBoxes: saved?.faceBoxes ?? null
    })
  },

  removeImage(id) {
    const cur = get()
    const removed = cur.images.find((i) => i.id === id)
    if (removed) URL.revokeObjectURL(removed.objectUrl)
    const edits = { ...cur.edits }
    // Free the removed image's background snapshots — the active ones if it's the
    // selected image, otherwise its stashed edit.
    if (cur.selectedId === id) {
      if (cur.bgOriginal) URL.revokeObjectURL(cur.bgOriginal.objectUrl)
      if (cur.bgCutout) URL.revokeObjectURL(cur.bgCutout.objectUrl)
      if (cur.faceOriginal) URL.revokeObjectURL(cur.faceOriginal.objectUrl)
    }
    revokeEditUrls(edits[id])
    delete edits[id]
    const metadata = { ...cur.metadata }
    delete metadata[id]

    const remaining = cur.images.filter((i) => i.id !== id)
    if (remaining.length === 0) {
      set({ images: [], selectedId: null, target: null, crop: null, socialCrop: null, bgFill: null, bgOriginal: null, bgCutout: null, faceOriginal: null, faceBoxes: null, edits: {}, metadata: {}, metadataOpen: false })
      return
    }
    if (cur.selectedId === id) {
      const next = remaining[0]!
      const saved = edits[next.id]
      delete edits[next.id]
      set({
        images: remaining,
        edits,
        metadata,
        selectedId: next.id,
        target: saved?.target ?? makeDefaultTarget(next),
        crop: saved?.crop ?? null,
        socialCrop: saved?.socialCrop ?? null,
        bgFill: saved?.bgFill ?? null,
        bgOriginal: saved?.bgOriginal ?? null,
        bgCutout: saved?.bgCutout ?? null,
        faceOriginal: saved?.faceOriginal ?? null,
        faceBoxes: saved?.faceBoxes ?? null
      })
    } else {
      set({ images: remaining, edits, metadata })
    }
  },

  clearAll() {
    const cur = get()
    for (const img of cur.images) URL.revokeObjectURL(img.objectUrl)
    if (cur.bgOriginal) URL.revokeObjectURL(cur.bgOriginal.objectUrl)
    if (cur.bgCutout) URL.revokeObjectURL(cur.bgCutout.objectUrl)
    if (cur.faceOriginal) URL.revokeObjectURL(cur.faceOriginal.objectUrl)
    for (const e of Object.values(cur.edits)) revokeEditUrls(e)
    set({ images: [], selectedId: null, target: null, crop: null, socialCrop: null, convertMode: false, bgOriginal: null, bgCutout: null, bgFill: null, faceOriginal: null, faceBoxes: null, edits: {}, metadata: {}, metadataOpen: false })
  },

  setTarget(partial) {
    const current = get().target
    if (!current) return
    // Editing dimensions manually drops any social-preset crop — the user is
    // back in "literal width × height" mode. A free-form crop is kept: the user
    // is just changing the export resolution of the region they chose.
    const sizeChanged = partial.width !== undefined || partial.height !== undefined
    const next: Partial<ImageStore> = { target: { ...current, ...partial } }
    if (sizeChanged) next.socialCrop = null
    set(next as ImageStore)
  },

  resetTargetToSelected() {
    const { images, selectedId } = get()
    const img = images.find((i) => i.id === selectedId)
    if (!img) return
    set({ target: makeDefaultTarget(img), crop: null, socialCrop: null })
  },

  setCrop(rect) {
    const { images, selectedId, target } = get()
    const img = images.find((i) => i.id === selectedId)
    if (!img) return
    if (!rect) {
      // Removing the crop reverts the export target to the image's original
      // size (format/quality/lock are kept — only the dimensions revert).
      set({ crop: null, target: target ? { ...target, width: img.width, height: img.height } : target })
      return
    }
    const c = clampCrop(rect, img.width, img.height)
    // Keep the output target matched to the crop's native size so a crop never
    // squishes on export. Picking an S/M/L preset afterwards rescales from here;
    // moving the crop (same size) leaves the target untouched.
    const next: Partial<ImageStore> = { crop: c, socialCrop: null }
    if (target && (target.width !== c.width || target.height !== c.height)) {
      next.target = { ...target, width: c.width, height: c.height }
    }
    set(next as ImageStore)
  },

  addCenteredCrop() {
    const { images, selectedId, crop, target } = get()
    const img = images.find((i) => i.id === selectedId)
    if (!img || crop) return
    const width = Math.round(img.width * 0.6)
    const height = Math.round(img.height * 0.6)
    const c = clampCrop({ x: (img.width - width) / 2, y: (img.height - height) / 2, width, height }, img.width, img.height)
    set({
      crop: c,
      socialCrop: null,
      target: target ? { ...target, width: c.width, height: c.height } : target
    })
  },

  async autoCrop(mode) {
    const { images, selectedId, target, autoCropping, crop } = get()
    if (autoCropping) return
    const img = images.find((i) => i.id === selectedId)
    if (!img) return
    set({ autoCropping: true })
    try {
      const { image, objectUrl } = await loadImage(img.file)
      try {
        // When a crop is already active, trim WITHIN it (scan + size relative to
        // the crop) rather than across the whole image. Otherwise use the whole
        // image as the region.
        const region: SourceCrop = crop ?? { x: 0, y: 0, width: img.width, height: img.height }
        const bounds = computeContentBounds(image, 24, crop ?? undefined) ?? region
        const rect = contentCropForMode(bounds, mode, region)
        const c = clampCrop(rect, img.width, img.height)
        set({
          crop: c,
          socialCrop: null,
          target: target ? { ...target, width: c.width, height: c.height } : target
        })
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    } catch (err) {
      console.error('Autocrop failed', err)
    } finally {
      set({ autoCropping: false })
    }
  },

  clearCrop() {
    // Match setCrop(null): reverting the crop restores the original export size.
    const { images, selectedId, target } = get()
    const img = images.find((i) => i.id === selectedId)
    set({ crop: null, target: img && target ? { ...target, width: img.width, height: img.height } : target })
  },

  applySocialPreset(width, height) {
    const { images, selectedId, target } = get()
    const img = images.find((i) => i.id === selectedId)
    if (!img || !target) return
    const crop = computeCenteredCoverCrop(img.width, img.height, width, height)
    set({
      target: { ...target, width, height, aspectLocked: false },
      crop: null,
      socialCrop: crop
    })
  },

  moveSocialCrop(x, y) {
    const { socialCrop, images, selectedId } = get()
    const img = images.find((i) => i.id === selectedId)
    if (!socialCrop || !img) return
    const maxX = Math.max(0, img.width - socialCrop.width)
    const maxY = Math.max(0, img.height - socialCrop.height)
    set({
      socialCrop: {
        ...socialCrop,
        x: Math.max(0, Math.min(maxX, Math.round(x))),
        y: Math.max(0, Math.min(maxY, Math.round(y)))
      }
    })
  },

  clearSocialCrop() {
    set({ socialCrop: null })
  },

  async removeBackground(onProgress) {
    const { images, selectedId, removingBg, bgOriginal, bgCutout, faceOriginal } = get()
    if (removingBg) return
    const img = images.find((i) => i.id === selectedId)
    if (!img) return

    // Always segment the CLEAN image. A baked face blur destroys the detail the
    // model needs, and it answers by keeping the whole blurred block as
    // foreground — the opaque rectangle bug. The blur is re-baked on top of the
    // finished cut-out afterwards (see `applyFaceBlur`), so the layer order the
    // user sees is: photo → cut-out → blur, with the blur erased wherever the
    // background was.
    const blurred = !!faceOriginal && faceOriginal.id === img.id
    const clean = blurred ? faceOriginal! : img

    // Cache hit: the cut-out for this image is already computed (the user
    // restored it earlier). Swap it straight back in — no reprocessing.
    if (bgCutout && bgCutout.id === img.id) {
      // Re-bake the blur onto the cut-out first, so the swap never shows an
      // un-redacted frame.
      const shown = blurred ? await rebakeBlur(get(), bgCutout, clean) : bgCutout
      const cur = get()
      if (cur.bgCutout !== bgCutout || !cur.images.some((i) => i.id === img.id)) {
        revokeDropped([shown], [bgCutout])
        return
      }
      const t = cur.target
      // The blurred bake we're replacing is gone; `clean` lives on as bgOriginal.
      revokeDropped([img], [clean, bgCutout, shown])
      set({
        images: cur.images.map((i) => (i.id === img.id ? shown : i)),
        bgOriginal: clean, // the un-blurred original — enables Restore again
        bgCutout: null,
        target: t ? { ...t, format: 'image/png', allowTransparency: true } : t,
        crop: null,
        socialCrop: null,
        bgFill: null,
        // The cut-out is the un-blurred base for this background state — it's
        // what "Remove blur" restores, and what the blur is re-baked over.
        faceOriginal: shown === bgCutout ? null : bgCutout
      })
      onProgress?.(1)
      return
    }

    set({ removingBg: true, bgProgress: 0 })
    try {
      const { blob, width, height } = await removeImageBackground(clean.file, (f) => {
        set({ bgProgress: f })
        onProgress?.(f)
      })

      // A different image may have been selected mid-run — only apply the result
      // to the image it was requested for.
      const current = get()
      if (!current.images.some((i) => i.id === img.id)) return

      const name = deriveNobgName(clean.name)
      const file = new File([blob], name, { type: 'image/png' })
      const objectUrl = URL.createObjectURL(file)
      const cutout: SourceImage = { id: img.id, name, file, width, height, objectUrl, bytes: file.size }

      // Re-bake the blur over the finished cut-out (stencilled by it) before
      // swapping anything in, so the cut-out is never shown un-redacted. The
      // boxes are still valid: the cut-out has the source's pixel dimensions.
      const shown = blurred && current.selectedId === img.id
        ? await rebakeBlur(current, cutout, clean)
        : cutout
      // `shown === cutout` means no redaction was baked, so the cut-out itself
      // is what's displayed and there's nothing for "Remove blur" to restore.
      const cleanCutout = shown === cutout ? null : cutout

      const after = get()
      if (!after.images.some((i) => i.id === img.id)) {
        revokeDropped([cutout, shown], [])
        return
      }
      const nextImages = after.images.map((i) => (i.id === img.id ? shown : i))

      if (after.selectedId === img.id) {
        // Free the blurred bake we're replacing plus any stale snapshots for
        // this image — but never `clean`, which becomes the restore point.
        revokeDropped(
          [img, bgOriginal?.id === img.id ? bgOriginal : null, after.bgCutout?.id === img.id ? after.bgCutout : null],
          [clean, cutout, shown]
        )
        set({
          images: nextImages,
          bgOriginal: clean,
          bgCutout: null,
          // The cut-out has transparency, so force PNG output so it isn't
          // flattened onto white on export.
          target: after.target ? { ...after.target, format: 'image/png', allowTransparency: true } : after.target,
          // Crops referenced the old bitmap coordinates; clear them for clarity.
          crop: null,
          socialCrop: null,
          bgFill: null,
          // The cut-out is now the un-blurred base that "Remove blur" restores.
          faceOriginal: cleanCutout
        })
      } else {
        // The user switched away during the run — persist the result into the
        // image's saved edit rather than clobbering the now-different active
        // image. The boxes come along, so an un-baked blur is one tap away.
        const edits = { ...after.edits }
        const prev = edits[img.id]
        revokeDropped(
          [img, prev?.bgOriginal, prev?.bgCutout, prev?.faceOriginal],
          [clean, cutout, shown]
        )
        const base = prev?.target ?? makeDefaultTarget(img)
        edits[img.id] = {
          target: { ...base, format: 'image/png', allowTransparency: true },
          crop: null,
          socialCrop: null,
          bgFill: null,
          bgOriginal: clean,
          bgCutout: null,
          faceOriginal: cleanCutout,
          faceBoxes: prev?.faceBoxes ?? null
        }
        set({ images: nextImages, edits })
      }
    } catch (err) {
      console.error('Background removal failed', err)
      throw err
    } finally {
      set({ removingBg: false, bgProgress: 0 })
    }
  },

  async restoreBackground() {
    const state = get()
    const { images, selectedId, bgOriginal, bgCutout, faceOriginal, target } = state
    if (!bgOriginal) return
    const isSelected = selectedId === bgOriginal.id
    const displayed = images.find((i) => i.id === bgOriginal.id) ?? null
    const blurred = isSelected && !!faceOriginal && faceOriginal.id === bgOriginal.id
    // Cache the CLEAN cut-out so re-removing is instant. With a blur applied the
    // shown image is a blurred bake of the cut-out, and the clean cut-out is the
    // one stashed in `faceOriginal`.
    const cutout = blurred ? faceOriginal! : displayed

    // Put the blur back on the full-background image before swapping it in —
    // undoing the cut-out shouldn't un-redact the faces, even for a frame. The
    // original is opaque, so it needs no stencil.
    const shown = blurred ? await rebakeBlur(state, bgOriginal, null) : bgOriginal
    // A second click (or another edit) may have landed while that rendered.
    if (get().bgOriginal !== bgOriginal) {
      revokeDropped([shown], [bgOriginal])
      return
    }

    // Drop the blurred bake we're replacing, plus any older cached cut-out
    // (shouldn't normally exist) — but never the cut-out we're caching.
    revokeDropped(
      [blurred ? displayed : null, bgCutout?.id === bgOriginal.id ? bgCutout : null],
      [cutout, bgOriginal, shown]
    )
    set({
      images: get().images.map((i) => (i.id === bgOriginal.id ? shown : i)),
      bgOriginal: null,
      bgCutout: cutout,
      target: isSelected && target ? makeDefaultTarget(bgOriginal) : target,
      // The restored original is the un-blurred base again, and the boxes are
      // kept so the strength/style controls keep driving the re-bake.
      ...(isSelected ? { crop: null, socialCrop: null, bgFill: null, faceOriginal: shown === bgOriginal ? null : bgOriginal } : {})
    })
  },

  async detectFaces() {
    const { images, selectedId, detectingFaces, faceOriginal, bgOriginal } = get()
    if (detectingFaces) return
    const img = images.find((i) => i.id === selectedId)
    if (!img) return
    // Always detect on the CLEAN image (the pre-blur original when a redaction is
    // already applied, otherwise the selected image itself) — and, when the
    // background has been removed, on the opaque pre-removal original rather
    // than the cut-out, which the detector reads as a face against black. Both
    // share the same pixel dimensions, so the boxes are valid either way.
    const base = faceOriginal && faceOriginal.id === img.id ? faceOriginal : img
    const clean = bgOriginal && bgOriginal.id === img.id ? bgOriginal : base
    set({ detectingFaces: true })
    try {
      const raw = await runFaceDetection(clean.file)
      // The user may have switched away mid-detection — only apply to the image
      // it was requested for.
      const cur = get()
      if (cur.selectedId !== img.id) return
      const boxes: FaceBox[] = raw.map((b, i) => ({ id: `face-${i}`, ...b, enabled: true }))
      set({ faceBoxes: boxes })
      if (boxes.length > 0) await get().applyFaceBlur()
    } catch (err) {
      console.error('Face detection failed', err)
      throw err
    } finally {
      set({ detectingFaces: false })
    }
  },

  setFaceEnabled(id, enabled) {
    const { faceBoxes } = get()
    if (!faceBoxes) return
    set({ faceBoxes: faceBoxes.map((f) => (f.id === id ? { ...f, enabled } : f)) })
  },

  async applyFaceBlur() {
    const { images, selectedId, faceBoxes, faceOriginal, bgOriginal, faceBlurStrength, faceBlurStyle } = get()
    if (!faceBoxes || faceBoxes.length === 0) return
    const img = images.find((i) => i.id === selectedId)
    if (!img) return
    // Bake from the clean base: the stashed original if a redaction is already
    // shown, otherwise the selected image (which then BECOMES the stashed original).
    const clean = faceOriginal && faceOriginal.id === img.id ? faceOriginal : img
    const firstApply = clean === img

    // With the background removed, the clean base is a transparent cut-out —
    // resampling it would smear its alpha and fray the silhouette, and a face at
    // the edge of the subject would blur into the transparency. So render the
    // blur from the opaque pre-removal original and stencil it with the cut-out:
    // the blurred layer then ends exactly where the background was removed.
    const opaqueSource = bgOriginal && bgOriginal.id === img.id ? bgOriginal : null

    const redacted = await bakeFaceBlur(clean, opaqueSource, faceBoxes, faceBlurStrength, faceBlurStyle)

    const cur = get()
    if (cur.selectedId !== img.id || !cur.images.some((i) => i.id === img.id)) {
      URL.revokeObjectURL(redacted.objectUrl)
      return
    }

    // Revoke the previous redaction's URL (but never the clean original — it's
    // held for undo). On first apply the outgoing entry IS the clean original.
    if (!firstApply) URL.revokeObjectURL(img.objectUrl)

    set({
      images: cur.images.map((i) => (i.id === img.id ? redacted : i)),
      faceOriginal: firstApply ? clean : cur.faceOriginal
    })
  },

  clearFaceBlur() {
    const { images, faceOriginal } = get()
    if (!faceOriginal) return
    // Revoke the shown redaction, then restore the clean original in place. The
    // detected boxes are kept so re-blurring is a single click.
    const shown = images.find((i) => i.id === faceOriginal.id)
    if (shown && shown.objectUrl !== faceOriginal.objectUrl) URL.revokeObjectURL(shown.objectUrl)
    set({
      images: images.map((i) => (i.id === faceOriginal.id ? faceOriginal : i)),
      faceOriginal: null
    })
  }
}))
