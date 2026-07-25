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
   */
  bgOriginal: SourceImage | null
  /**
   * Cached cut-out for the selected image, kept after a "Restore background" so
   * that clicking "Remove background" again swaps it straight back in without
   * re-running the model. Held only while that image stays selected (revoked on
   * select-away / remove / clear). Mutually exclusive with `bgOriginal`: whichever
   * version isn't currently shown is the one cached.
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
    const { images, selectedId, removingBg, bgOriginal, bgCutout } = get()
    if (removingBg) return
    const img = images.find((i) => i.id === selectedId)
    if (!img) return

    // Cache hit: the cut-out for this image is already computed (the user
    // restored it earlier). Swap it straight back in — no reprocessing.
    if (bgCutout && bgCutout.id === img.id) {
      const nextImages = images.map((i) => (i.id === img.id ? bgCutout : i))
      const isSelected = selectedId === img.id
      const t = get().target
      if (isSelected && get().faceOriginal) URL.revokeObjectURL(get().faceOriginal!.objectUrl)
      set({
        images: nextImages,
        bgOriginal: img, // the original we just replaced — enables Restore again
        bgCutout: null,
        target: isSelected && t ? { ...t, format: 'image/png', allowTransparency: true } : t,
        ...(isSelected ? { crop: null, socialCrop: null, bgFill: null, faceOriginal: null, faceBoxes: null } : {})
      })
      onProgress?.(1)
      return
    }

    set({ removingBg: true, bgProgress: 0 })
    try {
      const { blob, width, height } = await removeImageBackground(img.file, (f) => {
        set({ bgProgress: f })
        onProgress?.(f)
      })

      // A different image may have been selected mid-run — only apply the result
      // to the image it was requested for.
      const current = get()
      if (!current.images.some((i) => i.id === img.id)) return

      const name = deriveNobgName(img.name)
      const file = new File([blob], name, { type: 'image/png' })
      const objectUrl = URL.createObjectURL(file)
      const cutout: SourceImage = { id: img.id, name, file, width, height, objectUrl, bytes: file.size }

      // Stash the pre-removal image for "Restore background". If a stale snapshot
      // or cached cut-out for this same image exists, drop it first.
      if (bgOriginal && bgOriginal.id === img.id) URL.revokeObjectURL(bgOriginal.objectUrl)
      if (current.bgCutout && current.bgCutout.id === img.id) URL.revokeObjectURL(current.bgCutout.objectUrl)

      const nextImages = current.images.map((i) => (i.id === img.id ? cutout : i))
      if (current.selectedId === img.id) {
        if (current.faceOriginal) URL.revokeObjectURL(current.faceOriginal.objectUrl)
        set({
          images: nextImages,
          bgOriginal: img,
          bgCutout: null,
          // The cut-out has transparency, so force PNG output so it isn't
          // flattened onto white on export.
          target: current.target ? { ...current.target, format: 'image/png', allowTransparency: true } : current.target,
          // Crops referenced the old bitmap coordinates; clear them for clarity.
          crop: null,
          socialCrop: null,
          bgFill: null,
          // A fresh cut-out supersedes any prior face redaction on this image.
          faceOriginal: null,
          faceBoxes: null
        })
      } else {
        // The user switched away during the run — persist the result into the
        // image's saved edit rather than clobbering the now-different active image.
        const edits = { ...current.edits }
        revokeEditUrls(edits[img.id])
        const base = edits[img.id]?.target ?? makeDefaultTarget(img)
        edits[img.id] = {
          target: { ...base, format: 'image/png', allowTransparency: true },
          crop: null,
          socialCrop: null,
          bgFill: null,
          bgOriginal: img,
          bgCutout: null,
          // The revoked edit's face snapshot is gone; a fresh cut-out supersedes it.
          faceOriginal: null,
          faceBoxes: null
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

  restoreBackground() {
    const { images, selectedId, bgOriginal, bgCutout, target } = get()
    if (!bgOriginal) return
    // Keep the cut-out currently in the list as the cache so re-removing is instant.
    const cutout = images.find((i) => i.id === bgOriginal.id) ?? null
    // Drop any older cached cut-out we're about to replace (shouldn't normally exist).
    if (bgCutout && cutout && bgCutout.id === cutout.id && bgCutout !== cutout) {
      URL.revokeObjectURL(bgCutout.objectUrl)
    }
    const nextImages = images.map((i) => (i.id === bgOriginal.id ? bgOriginal : i))
    const isSelected = selectedId === bgOriginal.id
    if (isSelected && get().faceOriginal) URL.revokeObjectURL(get().faceOriginal!.objectUrl)
    set({
      images: nextImages,
      bgOriginal: null,
      bgCutout: cutout,
      target: isSelected && target ? makeDefaultTarget(bgOriginal) : target,
      ...(isSelected ? { crop: null, socialCrop: null, bgFill: null, faceOriginal: null, faceBoxes: null } : {})
    })
  },

  async detectFaces() {
    const { images, selectedId, detectingFaces, faceOriginal } = get()
    if (detectingFaces) return
    const img = images.find((i) => i.id === selectedId)
    if (!img) return
    // Always detect on the CLEAN image (the pre-blur original when a redaction is
    // already applied, otherwise the selected image itself).
    const clean = faceOriginal && faceOriginal.id === img.id ? faceOriginal : img
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
    const { images, selectedId, faceBoxes, faceOriginal, faceBlurStrength, faceBlurStyle } = get()
    if (!faceBoxes || faceBoxes.length === 0) return
    const img = images.find((i) => i.id === selectedId)
    if (!img) return
    // Bake from the clean base: the stashed original if a redaction is already
    // shown, otherwise the selected image (which then BECOMES the stashed original).
    const clean = faceOriginal && faceOriginal.id === img.id ? faceOriginal : img
    const firstApply = clean === img

    const { blob, width, height } = await renderRedactedFile(clean.file, faceBoxes, faceBlurStrength, faceBlurStyle)

    const cur = get()
    if (cur.selectedId !== img.id || !cur.images.some((i) => i.id === img.id)) return

    const name = deriveBlurredName(clean.name)
    const file = new File([blob], name, { type: 'image/png' })
    const objectUrl = URL.createObjectURL(file)
    const redacted: SourceImage = { id: img.id, name, file, width, height, objectUrl, bytes: file.size }

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
