// Its own module, with no imports, so `scripts/heicSniff.test.mjs` can load it
// under Node's type-stripping. It used to live in `imageResize.ts`, whose
// extensionless `./redact` import Node's ESM loader cannot resolve — the test
// died with ERR_MODULE_NOT_FOUND before running a case (2026-10-11).

/**
 * Is this the thing a phone hands you, judged by what it IS?
 *
 * Because on Android neither the name nor the type is dependable. A file picked
 * out of Google Photos or a third-party file manager reaches the page with a
 * display name that may carry no extension at all (`1000012345`) and a MIME
 * from whichever app owns it — usually right, sometimes `image/*`, sometimes
 * `application/octet-stream`. Get both wrong and a HEIC goes down the ordinary
 * path and dies at `createImageBitmap`, which is the failure this app's HEIC
 * support exists to prevent. This matters more here than on the web: Universal
 * Images ships as a native Android app, where that picker is the only one.
 *
 * HEIC is an ISO-BMFF file: a `ftyp` box at offset 4, a major brand at 8, then
 * a list of compatible brands. AVIF shares the container and every browser this
 * runs in decodes it natively, so it is excluded rather than converted — a slow,
 * lossy round-trip through libheif for a picture Chrome was about to draw free.
 *
 * `bytes` is the head of the file; 32 covers the usual compatible-brand list.
 */
export function heicFromBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, Math.min(to, bytes.length)))
  if (ascii(4, 8) !== 'ftyp') return false
  const brands = new Set<string>()
  for (let at = 8; at + 4 <= bytes.length; at += 4) brands.add(ascii(at, at + 4))
  if (brands.has('avif') || brands.has('avis')) return false
  for (const brand of ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']) {
    if (brands.has(brand)) return true
  }
  return false
}
