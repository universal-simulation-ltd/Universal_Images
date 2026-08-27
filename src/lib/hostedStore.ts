import {
  consumeHostedUpload,
  refundHostedUpload,
  HOSTED_BUCKET,
  type HostedUpload,
} from '@unisim/sdk'
import { useImageStore } from '../stores/imageStore'
import { loadImage, processAndEncode, formatFilename } from './imageResize'
import { hostedImagePath, hostedImagePathCandidates, newObjectId } from './hostedPaths'

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

  // ⚠️ NAME THE OBJECT FIRST. This used to reserve the row with a placeholder
  // `storagePath: 'pending'`, upload, then UPDATE the row with the real path —
  // and that update silently did nothing on every account that isn't the
  // platform admin, because `hosted_uploads` grants members SELECT and nothing
  // else (0041). So the ledger kept saying `pending`, the dialog listed a
  // backup, and opening it asked storage for an object named `pending`:
  // "Object not found", for a file that had uploaded perfectly. See
  // `hostedPaths.ts` for the full write-up and the legacy recovery.
  //
  // A client-side object id removes the round trip the RLS was blocking: the
  // path is known before the token is reserved, so the RPC records the truth
  // at insert time and there is no second write to fail.
  const path = hostedImagePath(orgId, newObjectId(), fileName)

  const consumed = await consumeHostedUpload(supabase, {
    product: 'images',
    storagePath: path,
    fileName,
    sizeBytes: blob.size,
  })
  if (!consumed.ok || !consumed.upload_id) {
    return { ok: false, error: consumed.error ?? 'Could not reserve a token.' }
  }

  const { error: upErr } = await supabase.storage
    .from(HOSTED_BUCKET)
    .upload(path, blob, { contentType, upsert: true })

  if (upErr) {
    await refundHostedUpload(supabase, consumed.upload_id)
    return { ok: false, error: upErr.message }
  }

  return { ok: true, creditsRemaining: consumed.credits }
}

/** Delete a hosted image (storage object first, then refund the token).
 *
 *  Removes EVERY path the bytes could be under, not just the one the ledger
 *  names: a legacy row says `pending`, so deleting only that would refund the
 *  token and leave the real object orphaned in the bucket forever, with the row
 *  that pointed at it gone. */
export async function deleteHostedImage(supabase: Supabase, upload: HostedUpload): Promise<StoreResult> {
  await supabase.storage.from(HOSTED_BUCKET).remove(hostedImagePathCandidates(upload))
  const res = await refundHostedUpload(supabase, upload.id)
  if (!res.ok) return { ok: false, error: res.error ?? 'Could not refund the token.' }
  return { ok: true, creditsRemaining: res.credits }
}

/**
 * Thrown when a listed backup has no object behind it anywhere we know to look.
 *
 * A distinct type so the dialog can answer honestly — name the file, say the
 * upload never completed, and offer to clear the entry and take the token back
 * — instead of surfacing storage's bare "Object not found", which reads like
 * the app has lost the user's image.
 */
export class HostedObjectMissingError extends Error {
  readonly fileName: string
  constructor(fileName: string) {
    super(`"${fileName}" is listed as backed up, but there is no file behind it.`)
    this.name = 'HostedObjectMissingError'
    this.fileName = fileName
  }
}

/**
 * Open a hosted image in a new tab (download → object URL).
 *
 * Tries every candidate path in turn (see `hostedImagePathCandidates`), so the
 * backups the old three-step store flow filed as `pending` still open: their
 * bytes are in the bucket under the name the uploader used, which is fully
 * recoverable from the row itself. Only when nothing is there does this throw
 * — as `HostedObjectMissingError`, so the caller can offer the cleanup.
 */
export async function openHostedImage(supabase: Supabase, upload: HostedUpload): Promise<void> {
  let lastError: string | null = null

  for (const path of hostedImagePathCandidates(upload)) {
    const { data, error } = await supabase.storage.from(HOSTED_BUCKET).download(path)
    if (data && !error) {
      const url = URL.createObjectURL(data)
      window.open(url, '_blank', 'noopener')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return
    }
    lastError = error?.message ?? null
  }

  // Every candidate missed. Distinguish "not there" from "could not ask" — a
  // dropped connection or an expired session must NOT be reported as a dead
  // backup, or the user is invited to delete an image that is perfectly fine.
  if (lastError && !/not.?found|does not exist|404/i.test(lastError)) {
    throw new Error(lastError)
  }
  throw new HostedObjectMissingError(upload.file_name || 'image')
}
