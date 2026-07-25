// EXIF / IPTC / XMP metadata — read it, and strip it.
//
// A photo off a phone routinely carries the exact spot it was taken, the
// second it was taken, the device's make, model and sometimes its serial
// number. All of that survives being emailed, posted or uploaded. This module
// reads it (via `exifr`, lazily imported so the landing page doesn't pay for
// it) and strips it by rewriting the container — never by re-encoding, so the
// pixels are untouched.
//
// Everything runs on the bytes in the tab. Nothing is uploaded, and the GPS
// coordinates are deliberately shown as plain numbers rather than linked to a
// map — looking a location up would hand it to somebody else's server.

export interface MetadataField {
  key: string
  label: string
  value: string
  /** True when the field points at a person, a place or a specific device. */
  identifying?: boolean
}

export interface ImageMetadata {
  fields: MetadataField[]
  /** Decimal coordinates when the photo is geotagged. */
  gps: { latitude: number; longitude: number } | null
  /**
   * Cameras embed a small preview alongside the full image. It's generated
   * before edits, so a cropped or retouched photo can still carry the original
   * in its thumbnail.
   */
  hasThumbnail: boolean
  /** Tags that were present but aren't worth a row of their own. */
  otherCount: number
  identifyingCount: number
  hasAny: boolean
}

/** How thoroughly a given file type can be scrubbed. */
export type ScrubMode =
  /** Container rewritten, pixel data byte-identical. */
  | 'lossless'
  /** No in-place strip for this container — export re-encodes it clean instead. */
  | 'unsupported'

export interface ScrubResult {
  file: File
  mode: ScrubMode
  /** Bytes removed by the strip (0 when nothing was removed). */
  removedBytes: number
}

// ── Reading ────────────────────────────────────────────────────────────────

/** Tags surfaced as their own row, in reading order. */
const SIMPLE_FIELDS: { tag: string; label: string; identifying?: boolean }[] = [
  { tag: 'DateTimeOriginal', label: 'Date taken', identifying: true },
  { tag: 'CreateDate', label: 'Date created', identifying: true },
  { tag: 'ModifyDate', label: 'Date modified', identifying: true },
  { tag: 'LensModel', label: 'Lens' },
  { tag: 'SerialNumber', label: 'Camera serial number', identifying: true },
  { tag: 'BodySerialNumber', label: 'Camera serial number', identifying: true },
  { tag: 'LensSerialNumber', label: 'Lens serial number', identifying: true },
  { tag: 'Software', label: 'Software', identifying: true },
  { tag: 'HostComputer', label: 'Computer', identifying: true },
  { tag: 'Artist', label: 'Artist', identifying: true },
  { tag: 'Copyright', label: 'Copyright', identifying: true },
  { tag: 'OwnerName', label: 'Owner', identifying: true },
  { tag: 'CameraOwnerName', label: 'Camera owner', identifying: true },
  { tag: 'creator', label: 'Creator (XMP)', identifying: true },
  { tag: 'byline', label: 'By-line (IPTC)', identifying: true },
  { tag: 'credit', label: 'Credit (IPTC)', identifying: true },
  { tag: 'city', label: 'City (IPTC)', identifying: true },
  { tag: 'country', label: 'Country (IPTC)', identifying: true },
  { tag: 'Author', label: 'Author', identifying: true },
  { tag: 'ImageDescription', label: 'Description' },
  { tag: 'Description', label: 'Description' },
  { tag: 'UserComment', label: 'Comment' },
  { tag: 'Comment', label: 'Comment' },
  { tag: 'Orientation', label: 'Orientation' },
]

/**
 * Keys exifr derives from the image header rather than from any metadata
 * block. A PNG always reports its own width, depth and filter — counting those
 * would put a "this file carries metadata" badge on every clean PNG.
 */
const STRUCTURAL_KEYS = new Set([
  'ImageWidth', 'ImageHeight', 'BitDepth', 'ColorType',
  'Compression', 'Filter', 'Interlace', 'ColorComponents', 'Precision',
])

/** Neither listed as its own row nor counted under "other tags". */
const IGNORED_TAGS = new Set([
  'latitude', 'longitude', 'Make', 'Model',
  ...STRUCTURAL_KEYS,
  ...SIMPLE_FIELDS.map((f) => f.tag),
])

function toText(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toLocaleString()
  if (Array.isArray(v)) {
    const joined = v.map((x) => toText(x)).filter(Boolean).join(', ')
    return joined.length > 0 ? joined : null
  }
  if (typeof v === 'object') return null
  const s = String(v).trim()
  if (s.length === 0) return null
  // Long binary-ish blobs (maker notes, raw comment padding) read as noise.
  return s.length > 180 ? `${s.slice(0, 180)}…` : s
}

const EXIFR_OPTIONS = {
  // `tiff: true` already pulls in IFD0, where Make/Model/Software live.
  tiff: true,
  exif: true,
  gps: true,
  iptc: true,
  xmp: true,
  icc: false,
  jfif: false,
  mergeOutput: true,
  translateKeys: true,
  translateValues: true,
  reviveValues: true,
} as const

export async function readImageMetadata(file: File): Promise<ImageMetadata> {
  const { default: exifr } = await import('exifr')
  // Hand exifr the bytes rather than the File: its Blob reader leans on
  // FileReader, and the buffer path behaves identically everywhere. The image
  // is already fully in memory, so this costs nothing extra.
  const bytes = await file.arrayBuffer()

  // A file with no (or malformed) metadata throws in some exifr paths — treat
  // that the same as "found nothing".
  const tryParse = async (input: ArrayBuffer | Uint8Array) => {
    try {
      return (await exifr.parse(input, EXIFR_OPTIONS)) as Record<string, unknown> | undefined
    } catch {
      return undefined
    }
  }

  let parsed = await tryParse(bytes)
  if (!parsed) {
    // exifr doesn't recognise the WebP container, so it reports a geotagged
    // WebP as clean. Its EXIF chunk is a bare TIFF block, which exifr *can*
    // read — pull that out and parse it directly rather than give a false
    // all-clear.
    const exifChunk = findWebpChunk(new Uint8Array(bytes), 'EXIF')
    if (exifChunk) parsed = await tryParse(exifChunk)
  }

  const fields: MetadataField[] = []
  const seenLabels = new Set<string>()

  // Location first — it's the field people actually care about.
  const lat = typeof parsed?.latitude === 'number' ? parsed.latitude : null
  const lon = typeof parsed?.longitude === 'number' ? parsed.longitude : null
  const gps = lat !== null && lon !== null ? { latitude: lat, longitude: lon } : null
  if (gps) {
    fields.push({
      key: 'gps',
      label: 'Location',
      value: `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`,
      identifying: true,
    })
  }

  // Make + Model read as one thing to a human, so join them.
  const make = toText(parsed?.Make)
  const model = toText(parsed?.Model)
  if (make || model) {
    const both = make && model && model.startsWith(make) ? model : [make, model].filter(Boolean).join(' ')
    fields.push({ key: 'camera', label: 'Camera', value: both, identifying: true })
  }

  for (const spec of SIMPLE_FIELDS) {
    const value = toText(parsed?.[spec.tag])
    if (value === null) continue
    // Several tags map to the same human label (SerialNumber vs
    // BodySerialNumber); show the first one that has a value.
    if (seenLabels.has(spec.label)) continue
    seenLabels.add(spec.label)
    fields.push({ key: spec.tag, label: spec.label, value, identifying: spec.identifying })
  }

  const otherCount = parsed
    ? Object.keys(parsed).filter((k) => !IGNORED_TAGS.has(k) && toText(parsed![k]) !== null).length
    : 0

  let hasThumbnail = false
  try {
    const thumb = await exifr.thumbnail(bytes)
    hasThumbnail = !!thumb && thumb.byteLength > 0
  } catch {
    hasThumbnail = false
  }

  return {
    fields,
    gps,
    hasThumbnail,
    otherCount,
    identifyingCount: fields.filter((f) => f.identifying).length,
    hasAny: fields.length > 0 || otherCount > 0 || hasThumbnail,
  }
}

// ── Stripping ──────────────────────────────────────────────────────────────

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/**
 * JPEG markers that carry metadata and are safe to drop. APP0 (JFIF density),
 * APP2 (ICC colour profile) and APP14 (Adobe colour transform) are deliberately
 * KEPT — dropping those changes how the image renders.
 */
const JPEG_DROP_MARKERS = new Set([
  0xe1, // APP1  — Exif and XMP
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, // APP3–APP11, maker-specific
  0xec, // APP12 — Ducky / PictureInfo
  0xed, // APP13 — Photoshop IRB, which is where IPTC lives
  0xef, // APP15
  0xfe, // COM   — free-text comment
])

/**
 * Rewrite a JPEG without its metadata segments. The compressed scan data is
 * copied verbatim, so this is lossless. Returns null if the bytes don't parse
 * as a JPEG — better to refuse than to emit a corrupt file.
 */
function stripJpeg(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  const parts: Uint8Array[] = [bytes.subarray(0, 2)]
  let i = 2
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) return null
    // Runs of 0xff are legal padding before a marker byte.
    let j = i + 1
    while (j < bytes.length && bytes[j] === 0xff) j++
    const marker = bytes[j]
    // Start-of-scan and end-of-image: everything from here is entropy-coded
    // image data, so copy the remainder untouched and stop parsing.
    if (marker === 0xda || marker === 0xd9) {
      parts.push(bytes.subarray(i))
      return concat(parts)
    }
    const lenAt = j + 1
    if (lenAt + 1 >= bytes.length) return null
    const len = (bytes[lenAt] << 8) | bytes[lenAt + 1]
    if (len < 2) return null
    const end = lenAt + len
    if (end > bytes.length) return null
    if (!JPEG_DROP_MARKERS.has(marker)) parts.push(bytes.subarray(i, end))
    i = end
  }
  return concat(parts)
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * PNG chunks worth keeping. Everything else — tEXt/zTXt/iTXt (which is where
 * XMP and generator strings live), eXIf, tIME — is metadata.
 */
const PNG_KEEP_CHUNKS = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS',
  'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'pHYs',
  'acTL', 'fcTL', 'fdAT', // APNG animation chunks
])

/** Rewrite a PNG keeping only image-bearing chunks. Lossless; CRCs are copied. */
function stripPng(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 8) return null
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return null
  }
  const parts: Uint8Array[] = [bytes.subarray(0, 8)]
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let i = 8
  while (i + 8 <= bytes.length) {
    const len = view.getUint32(i)
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7])
    const end = i + 12 + len // length + type + data + CRC
    if (end > bytes.length) return null
    if (PNG_KEEP_CHUNKS.has(type)) parts.push(bytes.subarray(i, end))
    i = end
    if (type === 'IEND') break
  }
  return concat(parts)
}

/** Read a 4-character RIFF/WebP chunk tag at `at`. */
function fourccAt(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3])
}

function isWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && fourccAt(bytes, 0) === 'RIFF' && fourccAt(bytes, 8) === 'WEBP'
}

/**
 * Return the payload of a named WebP chunk, or null. An `EXIF` payload is a
 * bare TIFF block, sometimes with the JPEG-style `Exif\0\0` prefix in front of
 * it — that prefix is stripped so the result parses as TIFF on its own.
 */
export function findWebpChunk(bytes: Uint8Array, want: string): Uint8Array | null {
  if (!isWebp(bytes)) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let i = 12
  while (i + 8 <= bytes.length) {
    const type = fourccAt(bytes, i)
    const size = view.getUint32(i + 4, true)
    const end = i + 8 + size + (size % 2) // RIFF chunks pad to an even length
    if (end > bytes.length) return null
    if (type === want) {
      const payload = bytes.subarray(i + 8, i + 8 + size)
      return fourccAt(payload, 0) === 'Exif' ? payload.subarray(6) : payload
    }
    i = end
  }
  return null
}

/**
 * Rewrite a WebP without its EXIF / XMP RIFF chunks, clearing the matching
 * flags in the VP8X header so decoders don't go looking for them. Lossless —
 * the VP8/VP8L bitstream is copied as-is.
 */
function stripWebp(bytes: Uint8Array): Uint8Array | null {
  if (!isWebp(bytes)) return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const body: Uint8Array[] = []
  let i = 12
  let dropped = false
  while (i + 8 <= bytes.length) {
    const type = fourccAt(bytes, i)
    const size = view.getUint32(i + 4, true)
    // RIFF chunks are padded to an even length.
    const end = i + 8 + size + (size % 2)
    if (end > bytes.length) return null
    if (type === 'EXIF' || type === 'XMP ') {
      dropped = true
    } else if (type === 'VP8X') {
      // Copy the header, then clear the "has EXIF" (0x08) and "has XMP" (0x04)
      // flag bits in its first payload byte.
      const chunk = bytes.slice(i, end)
      chunk[8] &= ~0x0c
      body.push(chunk)
    } else {
      body.push(bytes.subarray(i, end))
    }
    i = end
  }
  if (!dropped) return bytes

  const bodyBytes = concat(body)
  const out = new Uint8Array(12 + bodyBytes.length)
  out.set(bytes.subarray(0, 12))
  out.set(bodyBytes, 12)
  // RIFF size counts everything after the 8-byte RIFF header.
  new DataView(out.buffer).setUint32(4, out.length - 8, true)
  return out
}

/**
 * Return a copy of `file` with its metadata removed. JPEG, PNG and WebP are
 * rewritten losslessly. Anything else comes back untouched with
 * `mode: 'unsupported'` — Universal Images re-encodes on export anyway, which
 * drops metadata, so the caller can say so rather than silently re-compressing
 * the user's photo here.
 */
export async function scrubImageMetadata(file: File): Promise<ScrubResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  let out: Uint8Array | null = null
  if (file.type === 'image/jpeg') out = stripJpeg(bytes)
  else if (file.type === 'image/png') out = stripPng(bytes)
  else if (file.type === 'image/webp') out = stripWebp(bytes)

  if (!out) return { file, mode: 'unsupported', removedBytes: 0 }

  const cleaned = new File([out as BlobPart], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  })
  return { file: cleaned, mode: 'lossless', removedBytes: bytes.length - out.length }
}
