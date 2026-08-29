// Writes the EXIF block into `public/Example_Image.jpg` — the photo behind the
// landing page's "try an example" button.
//
// Run: node scripts/build-example-image.mjs
//
// The example image used to be clean, which made it useless for the one panel
// it should sell hardest. Somebody who clicks "try an example" to see what
// Universal Images does was shown "No metadata found in this image. Nothing to
// strip." — a demonstration of nothing. It now carries what a phone photo
// really carries: the spot it was taken, the second it was taken, the device,
// its lens and its serial number. Open Actions → Metadata on it and the panel
// has something to say; press Scrub metadata and you can watch it go.
//
// The values are invented, and chosen to be plainly an example rather than a
// real person's file. The coordinates are Trafalgar Square — a public square,
// so the map draws central London without putting anybody's home in a demo.
// The camera make, model and lens are ordinary product names; the serial
// number is made up. Only the artist and copyright name a person, and they
// say "example" for that reason.
//
// Re-running is safe: any Exif APP1 already in the file is dropped first, so
// this never stacks a second block on top of the last run's.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const target = resolve(here, '..', 'public', 'Example_Image.jpg')

// ── What the example claims about itself ───────────────────────────────────

const EXAMPLE = {
  make: 'Apple',
  model: 'iPhone 15 Pro',
  software: '17.5.1',
  artist: 'Example Photographer',
  copyright: 'Example image — UNI·SIM',
  lens: 'iPhone 15 Pro back triple camera 6.86mm f/1.78',
  serial: 'K7X4LPQ9WNZ2',
  taken: '2026:06:14 18:32:05',
  // Trafalgar Square, London.
  latitude: 51.508,
  longitude: -0.1281,
  altitudeMetres: 15,
}

// ── TIFF/EXIF writing ──────────────────────────────────────────────────────

const BYTE = 1
const ASCII = 2
const LONG = 4
const RATIONAL = 5

const ascii = (text) => ({
  type: ASCII,
  count: Buffer.byteLength(text, 'utf8') + 1,
  bytes: Buffer.from(`${text}\0`, 'utf8'),
})

const long = (value) => {
  const bytes = Buffer.alloc(4)
  bytes.writeUInt32LE(value, 0)
  return { type: LONG, count: 1, bytes }
}

const byte = (value) => ({ type: BYTE, count: 1, bytes: Buffer.from([value]) })

const rationals = (pairs) => {
  const bytes = Buffer.alloc(pairs.length * 8)
  pairs.forEach(([numerator, denominator], i) => {
    bytes.writeUInt32LE(numerator, i * 8)
    bytes.writeUInt32LE(denominator, i * 8 + 4)
  })
  return { type: RATIONAL, count: pairs.length, bytes }
}

/**
 * A coordinate as EXIF stores it: three rationals — degrees, minutes, seconds —
 * with the hemisphere carried by a separate letter, so the number itself is
 * never negative.
 */
const dms = (value) => {
  const absolute = Math.abs(value)
  const degrees = Math.floor(absolute)
  const minutes = Math.floor((absolute - degrees) * 60)
  const seconds = Math.round((absolute - degrees - minutes / 60) * 3600 * 10000)
  return rationals([
    [degrees, 1],
    [minutes, 1],
    [seconds, 10000],
  ])
}

/** An IFD is a count, twelve bytes per entry, then the offset of the next one. */
const ifdSize = (entries) => 2 + entries.length * 12 + 4

const ifd0 = [
  [0x010f, ascii(EXAMPLE.make)],
  [0x0110, ascii(EXAMPLE.model)],
  [0x0131, ascii(EXAMPLE.software)],
  [0x0132, ascii(EXAMPLE.taken)],
  [0x013b, ascii(EXAMPLE.artist)],
  [0x8298, ascii(EXAMPLE.copyright)],
  [0x8769, long(0)], // → Exif IFD, filled in below
  [0x8825, long(0)], // → GPS IFD, filled in below
]

const exifIfd = [
  [0x9003, ascii(EXAMPLE.taken)], // DateTimeOriginal
  [0x9004, ascii(EXAMPLE.taken)], // DateTimeDigitized
  [0xa431, ascii(EXAMPLE.serial)], // BodySerialNumber
  [0xa434, ascii(EXAMPLE.lens)], // LensModel
]

const gpsIfd = [
  [0x0001, ascii(EXAMPLE.latitude >= 0 ? 'N' : 'S')],
  [0x0002, dms(EXAMPLE.latitude)],
  [0x0003, ascii(EXAMPLE.longitude >= 0 ? 'E' : 'W')],
  [0x0004, dms(EXAMPLE.longitude)],
  [0x0005, byte(0)], // above sea level
  [0x0006, rationals([[Math.round(EXAMPLE.altitudeMetres * 100), 100]])],
]

// Each IFD's position is fixed by the size of the ones before it, so the two
// pointers in IFD0 can be resolved before anything is written.
const exifIfdOffset = 8 + ifdSize(ifd0)
const gpsIfdOffset = exifIfdOffset + ifdSize(exifIfd)
const dataStart = gpsIfdOffset + ifdSize(gpsIfd)
ifd0[6][1] = long(exifIfdOffset)
ifd0[7][1] = long(gpsIfdOffset)

const tiff = Buffer.alloc(4096)
tiff.write('II', 0, 'latin1') // little endian
tiff.writeUInt16LE(42, 2) // the magic 42
tiff.writeUInt32LE(8, 4) // IFD0 follows the header

let data = dataStart

/** Values over four bytes live in the data area and are referenced by offset. */
function writeIfd(offset, entries, nextIfd) {
  tiff.writeUInt16LE(entries.length, offset)
  let at = offset + 2
  // EXIF requires entries in ascending tag order within an IFD.
  for (const [tag, value] of [...entries].sort((a, b) => a[0] - b[0])) {
    tiff.writeUInt16LE(tag, at)
    tiff.writeUInt16LE(value.type, at + 2)
    tiff.writeUInt32LE(value.count, at + 4)
    if (value.bytes.length <= 4) {
      value.bytes.copy(tiff, at + 8)
    } else {
      tiff.writeUInt32LE(data, at + 8)
      value.bytes.copy(tiff, data)
      data += value.bytes.length
      if (data % 2 === 1) data += 1 // offsets are word-aligned
    }
    at += 12
  }
  tiff.writeUInt32LE(nextIfd, at)
}

writeIfd(8, ifd0, 0)
writeIfd(exifIfdOffset, exifIfd, 0)
writeIfd(gpsIfdOffset, gpsIfd, 0)

const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff.subarray(0, data)])
const app1 = Buffer.concat([
  Buffer.from([0xff, 0xe1]),
  Buffer.from([(payload.length + 2) >> 8, (payload.length + 2) & 0xff]),
  payload,
])

// ── Splicing it into the JPEG ──────────────────────────────────────────────

const jpeg = readFileSync(target)
if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('not a JPEG')

// Walk the marker segments, keeping everything except an Exif APP1 (so a
// re-run replaces rather than stacks), and note where APP0 ends — APP1
// conventionally follows the JFIF header rather than preceding it.
const keep = []
let at = 2
let insertAt = 2
while (at < jpeg.length - 1 && jpeg[at] === 0xff) {
  const marker = jpeg[at + 1]
  if (marker === 0xda) break // start of scan: the rest is image data
  const length = jpeg.readUInt16BE(at + 2)
  const end = at + 2 + length
  const isExif = marker === 0xe1 && jpeg.subarray(at + 4, at + 8).toString('latin1') === 'Exif'
  if (!isExif) keep.push(jpeg.subarray(at, end))
  if (marker === 0xe0) insertAt = keep.length
  at = end
}

const out = Buffer.concat([
  jpeg.subarray(0, 2),
  ...keep.slice(0, insertAt),
  app1,
  ...keep.slice(insertAt),
  jpeg.subarray(at),
])

writeFileSync(target, out)
console.log(
  `Example_Image.jpg: ${EXAMPLE.make} ${EXAMPLE.model}, ` +
    `${EXAMPLE.latitude}, ${EXAMPLE.longitude}, ${app1.length} bytes of EXIF`
)
