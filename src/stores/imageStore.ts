import { create } from 'zustand'
import type { OutputFormat, ResizeTarget, SourceImage } from '../types/image'
import { loadImage } from '../lib/imageResize'

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
  cropMode: boolean
  /** Add one or more files; only successfully-decoded images are appended. */
  addFiles: (files: File[] | FileList) => Promise<void>
  selectImage: (id: string) => void
  removeImage: (id: string) => void
  clearAll: () => void
  setTarget: (partial: Partial<ResizeTarget>) => void
  /** Recompute target defaults (size + format) from the currently selected image. */
  resetTargetToSelected: () => void
  setCropMode: (on: boolean) => void
  /** Replace the currently-selected image with a cropped version. Coords are
   *  in source pixels. After commit, future resize ops work on the cropped data. */
  applyCrop: (rect: { x: number; y: number; width: number; height: number }) => Promise<void>
}

function makeDefaultTarget(img: SourceImage): ResizeTarget {
  return {
    width: img.width,
    height: img.height,
    aspectLocked: true,
    quality: 0.85,
    format: chooseDefaultFormat(img.file)
  }
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
  cropMode: false,

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
    set({ selectedId: id, target: makeDefaultTarget(img) })
  },

  removeImage(id) {
    const { images, selectedId } = get()
    const removed = images.find((i) => i.id === id)
    if (removed) URL.revokeObjectURL(removed.objectUrl)
    const remaining = images.filter((i) => i.id !== id)
    if (remaining.length === 0) {
      set({ images: [], selectedId: null, target: null })
      return
    }
    if (selectedId === id) {
      const nextSelected = remaining[0]!
      set({ images: remaining, selectedId: nextSelected.id, target: makeDefaultTarget(nextSelected) })
    } else {
      set({ images: remaining })
    }
  },

  clearAll() {
    for (const img of get().images) URL.revokeObjectURL(img.objectUrl)
    set({ images: [], selectedId: null, target: null })
  },

  setTarget(partial) {
    const current = get().target
    if (!current) return
    set({ target: { ...current, ...partial } })
  },

  resetTargetToSelected() {
    const { images, selectedId } = get()
    const img = images.find((i) => i.id === selectedId)
    if (!img) return
    set({ target: makeDefaultTarget(img) })
  },

  setCropMode(on) {
    set({ cropMode: on })
  },

  async applyCrop(rect) {
    const { images, selectedId } = get()
    const img = images.find((i) => i.id === selectedId)
    if (!img) return
    const { image, objectUrl } = await loadImage(img.file)
    try {
      const cw = Math.max(1, Math.round(rect.width))
      const ch = Math.max(1, Math.round(rect.height))
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, cw, ch)
      const sourceType = img.file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const quality = sourceType === 'image/png' ? undefined : 0.95
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Crop encoding failed'))), sourceType, quality)
      })
      const ext = sourceType === 'image/png' ? 'png' : 'jpg'
      const dot = img.name.lastIndexOf('.')
      const stem = dot === -1 ? img.name : img.name.slice(0, dot)
      const newName = `${stem}_cropped.${ext}`
      const newFile = new File([blob], newName, { type: sourceType })
      const newObjectUrl = URL.createObjectURL(newFile)
      URL.revokeObjectURL(img.objectUrl)
      const updated: SourceImage = {
        ...img,
        name: newName,
        file: newFile,
        width: cw,
        height: ch,
        objectUrl: newObjectUrl,
        bytes: newFile.size
      }
      set({
        images: images.map((i) => (i.id === img.id ? updated : i)),
        target: makeDefaultTarget(updated),
        cropMode: false
      })
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }
}))
