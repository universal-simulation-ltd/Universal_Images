import { useImageStore } from '../stores/imageStore'
import { saveBlob } from '@unisim/media/save'
import type { OutputFormat, ResizeTarget, SourceCrop } from '../types/image'
import { loadImage } from './imageResize'

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
  saveBlob(blob, fileName)
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

  let bytes: Uint8Array
  try {
    bytes = base64ToBytes(data.image)
  } catch {
    throw new Error('This backup is damaged: the picture inside it can’t be read.')
  }
  const restored = new File([bytes as unknown as BlobPart], safeFileName(data.fileName), {
    type: typeof data.fileType === 'string' && data.fileType.startsWith('image/') ? data.fileType : 'image/png',
  })

  // ⚠️ Prove the picture opens BEFORE touching the workspace. The import used
  // to clear every open image first, so a backup that wouldn't decode left
  // the user with nothing: their work gone, and no backup either.
  try {
    const { objectUrl } = await loadImage(restored)
    URL.revokeObjectURL(objectUrl)
  } catch {
    throw new Error('This backup is damaged: the picture inside it can’t be opened.')
  }

  // Replace the workspace with the restored image, then apply the saved
  // crop/target over the defaults addFiles sets (crop is in source-pixel space,
  // valid because it's the same image bytes). Both are checked rather than
  // trusted: a backup is a file anyone can edit, and a width of 10^9 is a
  // canvas no browser will make.
  const store = useImageStore.getState()
  store.clearAll()
  await store.addFiles([restored])
  const fallback = useImageStore.getState().target
  useImageStore.setState({
    target: fallback ? validTarget(data.target, fallback) : fallback,
    crop: validCrop(data.crop),
    socialCrop: validCrop(data.socialCrop),
  })
}

const FORMATS: OutputFormat[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_EDGE = 16384

function validTarget(raw: unknown, fallback: ResizeTarget): ResizeTarget {
  if (!raw || typeof raw !== 'object') return fallback
  const t = raw as Partial<ResizeTarget>
  const edge = (n: unknown, d: number) =>
    typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.min(MAX_EDGE, Math.round(n)) : d
  return {
    ...fallback,
    width: edge(t.width, fallback.width),
    height: edge(t.height, fallback.height),
    aspectLocked: typeof t.aspectLocked === 'boolean' ? t.aspectLocked : fallback.aspectLocked,
    quality:
      typeof t.quality === 'number' && Number.isFinite(t.quality) ? Math.min(1, Math.max(0, t.quality)) : fallback.quality,
    format: FORMATS.includes(t.format as OutputFormat) ? (t.format as OutputFormat) : fallback.format,
    allowTransparency: typeof t.allowTransparency === 'boolean' ? t.allowTransparency : fallback.allowTransparency,
  }
}

function validCrop(raw: unknown): SourceCrop | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Partial<SourceCrop>
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0
  if (!ok(c.x) || !ok(c.y) || !ok(c.width) || !ok(c.height) || c.width < 1 || c.height < 1) return null
  return { x: c.x, y: c.y, width: c.width, height: c.height }
}

/** A plain file name: no folders, no control characters, not absurdly long. */
function safeFileName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw : ''
  // eslint-disable-next-line no-control-regex
  const clean = name.replace(/[\u0000-\u001f\u007f/\\]/g, '').trim().slice(0, 200)
  return clean || 'image'
}
