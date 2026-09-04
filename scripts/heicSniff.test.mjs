// What a file IS, when what it's called cannot be trusted.
//
//   npm run test:heic-sniff
//
// Runs under Node's type-stripping, so `imageResize.ts` is imported directly —
// its only import is a type, and nothing at module scope touches the DOM.
//
// This is the Android half of HEIC support. On a desktop the name or the MIME
// answers; inside the Android app neither can be relied on — the picker hands
// over a display name that may have no extension (`1000012345`) and a MIME from
// whichever app owns the file, which is usually right and sometimes `image/*`
// or `application/octet-stream`. Get both wrong and a HEIC goes down the
// ordinary path to `createImageBitmap`, which is exactly the failure the HEIC
// support exists to prevent.
//
// ⚠️ What this does NOT test is the decode. `heic-to` is the only thing that
// can answer for that, and it cannot be tested from a made-up file anyway:
// a generated HEIC does not test HEIC (see the HEIC section of
// `Docs_UNI_SIM/landmines.md`). These are header shapes, nothing more.
//
// Negative controls (2026-09-04, both run):
//
//   · dropping the AVIF exclusion → 2 red, both avif cases, which would send a
//     picture every browser draws natively on a lossy round-trip through libheif
//   · returning true for any `ftyp` at all → 1 red, the MP4, which is the same
//     container and not a photograph

import { heicFromBytes } from '../src/lib/imageResize.ts'

let failed = 0
const check = (label, actual, expected) => {
  const ok = actual === expected
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} → ${actual}${ok ? '' : ` (expected ${expected})`}`)
}

/** An ISO-BMFF head: a box length, `ftyp`, a major brand, then compatibles. */
const ftyp = (major, ...compatible) => {
  const brands = [major, ...compatible].join('')
  const head = `\0\0\0${String.fromCharCode(8 + brands.length)}ftyp${brands}`
  return Uint8Array.from(head, (c) => c.charCodeAt(0))
}
const bytes = (...nums) => Uint8Array.from(nums)

// ── What a phone writes ────────────────────────────────────────────────────
// The brand list off a current iPhone capture — the one heic2any cannot read.
check('iPhone capture', heicFromBytes(ftyp('heic', 'mif1', 'MiHB', 'MiHE', 'MiPr', 'miaf', 'tmap')), true)
for (const brand of ['heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']) {
  check(`brand ${brand}`, heicFromBytes(ftyp(brand)), true)
}
// Samsung's "high efficiency" pictures lead with the container brand and only
// say `heic` further down the compatible list.
check('generic major brand', heicFromBytes(ftyp('mif1', 'heic')), true)

// ── What must be left alone ────────────────────────────────────────────────
check('AVIF', heicFromBytes(ftyp('avif', 'mif1', 'miaf')), false)
check('AVIF sequence', heicFromBytes(ftyp('avis', 'avif', 'msf1')), false)
check('MP4', heicFromBytes(ftyp('isom', 'iso2', 'avc1', 'mp41')), false)
check('JPEG', heicFromBytes(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1)), false)
check('PNG', heicFromBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13)), false)
check('WebP', heicFromBytes(Uint8Array.from('RIFF\0\0\0\0WEBPVP8 ', (c) => c.charCodeAt(0))), false)

// ── Too short to have a header: answer, don't throw ────────────────────────
check('empty', heicFromBytes(bytes()), false)
check('truncated', heicFromBytes(bytes(0, 0, 0, 24, 0x66, 0x74)), false)

console.log(failed === 0 ? '\nall passed' : `\n${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
