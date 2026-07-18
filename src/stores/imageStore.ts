import { create } from 'zustand'
import type { OutputFormat, ResizeTarget, SourceCrop, SourceImage } from '../types/image'
import {
  computeCenteredCoverCrop,
  computeContentBounds,
  contentCropForMode,
  loadImage,
  type AutoCropMode
} from '../lib/imageResize'

function makeId() {
  return Math.random().toString(36).slice(2, 10)
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
const NAME_IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif)$/i

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

  async addFiles(input) {
    const files = Array.from(input).filter(looksLikeImage)
    if (files.length === 0) return
    set({ loading: true })
    try {
      const decoded: SourceImage[] = []
      for (const file of files) {
        try {
          // loadImage transparently converts HEIC → JPEG and returns the usable file.
          const { objectUrl, width, height, file: usableFile } = await loadImage(file)
          decoded.push({
            id: makeId(),
            name: usableFile.name,
            file: usableFile,
            width,
            height,
            objectUrl,
            bytes: usableFile.size
          })
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
    } finally {
      set({ loading: false })
    }
  },

  selectImage(id) {
    const img = get().images.find((i) => i.id === id)
    if (!img) return
    set({ selectedId: id, target: makeDefaultTarget(img), crop: null, socialCrop: null })
  },

  removeImage(id) {
    const { images, selectedId } = get()
    const removed = images.find((i) => i.id === id)
    if (removed) URL.revokeObjectURL(removed.objectUrl)
    const remaining = images.filter((i) => i.id !== id)
    if (remaining.length === 0) {
      set({ images: [], selectedId: null, target: null, crop: null, socialCrop: null })
      return
    }
    if (selectedId === id) {
      const nextSelected = remaining[0]!
      set({
        images: remaining,
        selectedId: nextSelected.id,
        target: makeDefaultTarget(nextSelected),
        crop: null,
        socialCrop: null
      })
    } else {
      set({ images: remaining })
    }
  },

  clearAll() {
    for (const img of get().images) URL.revokeObjectURL(img.objectUrl)
    set({ images: [], selectedId: null, target: null, crop: null, socialCrop: null, convertMode: false })
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
      set({ crop: null })
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
    const { images, selectedId, target, autoCropping } = get()
    if (autoCropping) return
    const img = images.find((i) => i.id === selectedId)
    if (!img) return
    set({ autoCropping: true })
    try {
      const { image, objectUrl } = await loadImage(img.file)
      try {
        const bounds =
          computeContentBounds(image) ?? { x: 0, y: 0, width: img.width, height: img.height }
        const rect = contentCropForMode(bounds, mode, img.width, img.height)
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
    set({ crop: null })
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
  }
}))
