import {
  consumeHostedUpload,
  refundHostedUpload,
  HOSTED_BUCKET,
  type HostedUpload,
} from '@unisim/sdk'
import { useImageStore } from '../stores/imageStore'
import { loadImage, processAndEncode, formatFilename } from './imageResize'

// "Hosted by UNI·SIM" cloud storage for Universal Images. Local processing stays
// free + on-device; hosting keeps a resized image online against the user's
// Universal ID for one token (subscriptions.credits), refunded on delete.
// Backend: migration 0041 + the @unisim/sdk hosted helpers (mirrors Universal PDF).

type Supabase = Parameters<typeof consumeHostedUpload>[0]

export interface StoreResult {
  ok: boolean
  error?: string
  creditsRemaining?: number
}

/** Encode the currently-selected image at the chosen target (same bytes the
 *  Download button produces) and return it as a Blob + filename. */
async function currentImageBlob(): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  const { images, selectedId, target, crop, socialCrop } = useImageStore.getState()
  const selected = images.find((i) => i.id === selectedId)
  if (!selected || !target) throw new Error('No image is selected.')
  const effectiveCrop = crop ?? socialCrop
  const { image, objectUrl } = await loadImage(selected.file)
  try {
    const blob = await processAndEncode(
      image,
      effectiveCrop,
      target.width,
      target.height,
      target.format,
      target.quality,
      target.allowTransparency,
    )
    return {
      blob,
      fileName: formatFilename(selected.name, target.width, target.height, target.format),
      contentType: target.format,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** Spend one token and store the current image in the cloud. Reserves the token
 *  first, then uploads; a failed upload refunds it so the user is never charged
 *  for a file that isn't there. */
export async function storeCurrentImage(supabase: Supabase, orgId: string): Promise<StoreResult> {
  const { blob, fileName, contentType } = await currentImageBlob()

  const consumed = await consumeHostedUpload(supabase, {
    product: 'images',
    storagePath: 'pending',
    fileName,
    sizeBytes: blob.size,
  })
  if (!consumed.ok || !consumed.upload_id) {
    return { ok: false, error: consumed.error ?? 'Could not reserve a token.' }
  }

  const path = `${orgId}/images/${consumed.upload_id}-${safeName(fileName)}`
  const { error: upErr } = await supabase.storage
    .from(HOSTED_BUCKET)
    .upload(path, blob, { contentType, upsert: true })

  if (upErr) {
    await refundHostedUpload(supabase, consumed.upload_id)
    return { ok: false, error: upErr.message }
  }

  await supabase.from('hosted_uploads').update({ storage_path: path }).eq('id', consumed.upload_id)
  return { ok: true, creditsRemaining: consumed.credits }
}

/** Delete a hosted image (storage object first, then refund the token). */
export async function deleteHostedImage(supabase: Supabase, upload: HostedUpload): Promise<StoreResult> {
  await supabase.storage.from(HOSTED_BUCKET).remove([upload.storage_path])
  const res = await refundHostedUpload(supabase, upload.id)
  if (!res.ok) return { ok: false, error: res.error ?? 'Could not refund the token.' }
  return { ok: true, creditsRemaining: res.credits }
}

/** Open a hosted image in a new tab (download → object URL). */
export async function openHostedImage(supabase: Supabase, upload: HostedUpload): Promise<void> {
  const { data, error } = await supabase.storage.from(HOSTED_BUCKET).download(upload.storage_path)
  if (error || !data) throw new Error(error?.message ?? 'Could not download the image.')
  const url = URL.createObjectURL(data)
  window.open(url, '_blank', 'noopener')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Keep the object name to a safe slug + its extension. */
function safeName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  const stem = dot === -1 ? fileName : fileName.slice(0, dot)
  const ext = dot === -1 ? 'png' : fileName.slice(dot + 1).toLowerCase()
  const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'image'
  return `${slug}.${ext}`
}
