import { useImageStore } from '../stores/imageStore'
import type { ResizeTarget, SourceCrop } from '../types/image'

// "Save to desktop" backup for Universal Images — the editable middle tier
// between the free on-device resize+download and the paid "Hosted by UNI·SIM"
// cloud. A backup bundles the ORIGINAL (un-resized) source image plus the crop
// and target settings, so re-importing drops you back into editing exactly
// where you left off. This is deliberately NOT the processed output the
// Download button / hosted store produce — re-importing a resized image would
// lose the original and the crop.

const MAGIC = 'universal-images-backup'
const VERSION = 1

interface BackupFile {
  app: typeof MAGIC
  version: number
  createdAt: string
  fileName: string
  fileType: string
  /** base64 of the original source image bytes. */
  image: string
  target: ResizeTarget | null
  crop: SourceCrop | null
  socialCrop: SourceCrop | null
}

/** Encode bytes as base64 without blowing the call stack on large images. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function safeStem(name: string): string {
  const dot = name.lastIndexOf('.')
  const stem = dot === -1 ? name : name.slice(0, dot)
  const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return slug || 'image'
}

/** Whether there's a selected image to back up. */
export function canBackup(): boolean {
  const { images, selectedId } = useImageStore.getState()
  return !!images.find((i) => i.id === selectedId)
}

/** Serialise the selected image + its crop/target to a JSON backup. */
export async function buildBackup(): Promise<{ blob: Blob; fileName: string }> {
  const { images, selectedId, target, crop, socialCrop } = useImageStore.getState()
  const selected = images.find((i) => i.id === selectedId)
  if (!selected) throw new Error('No image is selected.')
  const buf = await selected.file.arrayBuffer()
  const payload: BackupFile = {
    app: MAGIC,
    version: VERSION,
    createdAt: new Date().toISOString(),
    fileName: selected.name,
    fileType: selected.file.type || 'image/png',
    image: bytesToBase64(new Uint8Array(buf)),
    target,
    crop,
    socialCrop,
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  return { blob, fileName: `${safeStem(selected.name)}.uniimg.json` }
}

/** Save the selected image + edits to the guest's device as a backup. */
export async function downloadBackup(): Promise<void> {
  const { blob, fileName } = await buildBackup()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Restore a previously-downloaded backup: load the source image back in and
 *  re-apply the saved crop + target. Throws a user-facing message if the file
 *  isn't a valid Universal Images backup. */
export async function importBackup(file: File): Promise<void> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't a Universal Images backup (it isn't valid JSON).")
  }

  const data = json as Partial<BackupFile>
  if (!data || data.app !== MAGIC || typeof data.image !== 'string') {
    throw new Error("That file isn't a Universal Images backup.")
  }
  if (typeof data.version === 'number' && data.version > VERSION) {
    throw new Error('This backup was made by a newer version of Universal Images — update the app to open it.')
  }

  const bytes = base64ToBytes(data.image)
  const restored = new File([bytes as unknown as BlobPart], data.fileName ?? 'image', {
    type: data.fileType || 'image/png',
  })
  // Replace the workspace with the restored image, then apply the saved
  // crop/target over the defaults addFiles sets (crop is in source-pixel space,
  // valid because it's the same image bytes).
  const store = useImageStore.getState()
  store.clearAll()
  await store.addFiles([restored])
  useImageStore.setState({
    target: data.target ?? useImageStore.getState().target,
    crop: data.crop ?? null,
    socialCrop: data.socialCrop ?? null,
  })
}
