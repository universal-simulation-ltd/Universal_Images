import type { Source } from './types'

// The research, standards and reports behind each article, keyed by article
// id. The same in every language, so kept once here and attached by index.ts.
//
// Original research papers first, then the standards, then guidance — and
// only sources for what the app really does (checked against src/ on
// 2026-09-29: the canvas resizes in halving steps and encodes JPEG, PNG, WebP
// and AVIF through the browser; heic-to (libheif) decodes HEIC; exifr reads
// Exif, and lib/metadata.ts strips JPEG APPn segments and PNG/WebP chunks
// without re-encoding; @imgly/background-removal runs the IS-Net `isnet_fp16`
// model; @mediapipe/tasks-vision runs `blaze_face_short_range`; the location
// map is Natural Earth 1:50m admin-0 plus 1:10m admin-1, with GeoNames places
// folded into the per-country files). HEIC is only decoded on the way in, so
// HEVC/HEIF are deliberately not cited.
//
// ⚠️ `pdf` (our hosted copy at opensource.unisim.co.uk/kb/papers/) ONLY where
// the licence allows redistribution: IETF RFCs, and the BlazeFace model card,
// which Google publishes under the Apache License 2.0. arXiv's default licence,
// IEEE, ACM, USENIX, W3C, AOMedia and CIPA documents link out instead. IEEE
// Xplore and the ACM Digital Library bot-block curl, so those two DOIs were
// confirmed through doi.org's handle API and a Wayback Machine capture of the
// landing page. army.mil also blocks curl, so that article links to its
// Wayback capture. naturalearthdata.com refuses a bare `Mozilla/5.0` agent
// (406) but serves a full browser user agent, which is how it was checked.

const PIXEL_MEMO: Source = {
  kind: 'paper',
  title: 'A Pixel Is Not A Little Square, A Pixel Is Not A Little Square, A Pixel Is Not A Little Square! (And a Voxel is Not a Little Cube)',
  authors: 'Alvy Ray Smith',
  publisher: 'Microsoft Technical Memo 6',
  year: 1995,
  href: 'http://alvyray.com/Memos/CG/Microsoft/6_pixel.pdf',
}

const JPEG_WALLACE: Source = {
  kind: 'paper',
  title: 'The JPEG Still Picture Compression Standard',
  authors: 'Gregory K. Wallace',
  publisher: 'IEEE Transactions on Consumer Electronics',
  year: 1992,
  href: 'https://www.ijg.org/files/Wallace.JPEG.pdf',
}

const PNG_SPEC: Source = {
  kind: 'standard',
  title: 'Portable Network Graphics (PNG) Specification (Third Edition)',
  publisher: 'W3C',
  year: 2025,
  href: 'https://www.w3.org/TR/png-3/',
}

export const SOURCES: Record<string, Source[]> = {
  'raster-and-vector': [
    {
      kind: 'paper',
      title: 'Sketchpad: A man-machine graphical communication system',
      authors: 'Ivan Edward Sutherland',
      publisher: 'MIT PhD thesis, republished as University of Cambridge Computer Laboratory UCAM-CL-TR-574',
      year: 1963,
      href: 'https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-574.pdf',
    },
    PIXEL_MEMO,
    {
      kind: 'standard',
      title: 'Scalable Vector Graphics (SVG) 1.1 (Second Edition)',
      publisher: 'W3C',
      year: 2011,
      href: 'https://www.w3.org/TR/SVG11/',
    },
  ],
  'image-formats': [
    JPEG_WALLACE,
    PNG_SPEC,
    {
      kind: 'standard',
      title: 'WebP Image Format (RFC 9649)',
      authors: 'James Zern, Pascal Massimino, Jyrki Alakuijala',
      publisher: 'IETF',
      year: 2024,
      href: 'https://www.rfc-editor.org/rfc/rfc9649.html',
      pdf: 'papers/rfc-9649-webp.pdf',
      licence: 'IETF Trust — RFC, freely redistributable unmodified',
    },
    {
      kind: 'standard',
      title: 'AV1 Image File Format (AVIF)',
      publisher: 'Alliance for Open Media',
      year: 2025,
      href: 'https://aomediacodec.github.io/av1-avif/latest-approved.html',
    },
  ],
  'pixels-resolution-dpi': [
    PIXEL_MEMO,
    {
      kind: 'standard',
      title: 'JPEG File Interchange Format, Version 1.02 (the X and Y density fields)',
      authors: 'Eric Hamilton',
      publisher: 'C-Cube Microsystems',
      year: 1992,
      href: 'https://www.w3.org/Graphics/JPEG/jfif3.pdf',
    },
    { ...PNG_SPEC, title: 'Portable Network Graphics (PNG) Specification (Third Edition), §11.3.4.3: pHYs, physical pixel dimensions' },
  ],
  'what-compression-does': [
    {
      kind: 'paper',
      title: 'Discrete Cosine Transform',
      authors: 'Nasir Ahmed, T. Natarajan, K. R. Rao',
      publisher: 'IEEE Transactions on Computers',
      year: 1974,
      href: 'https://doi.org/10.1109/T-C.1974.223784',
    },
    JPEG_WALLACE,
    {
      kind: 'standard',
      title: 'DEFLATE Compressed Data Format Specification version 1.3 (RFC 1951) — PNG\'s lossless compression',
      authors: 'L. Peter Deutsch',
      publisher: 'IETF',
      year: 1996,
      href: 'https://www.rfc-editor.org/rfc/rfc1951.html',
      pdf: 'papers/rfc-1951-deflate.pdf',
      licence: 'IETF Trust — RFC, freely redistributable unmodified',
    },
  ],
  'how-universal-images-works': [
    {
      kind: 'paper',
      title: 'Highly Accurate Dichotomous Image Segmentation (IS-Net, the background-removal model)',
      authors: 'Xuebin Qin, Hang Dai, Xiaobin Hu, Deng-Ping Fan, Ling Shao, Luc Van Gool',
      publisher: 'ECCV',
      year: 2022,
      href: 'https://arxiv.org/abs/2203.03041',
    },
    {
      kind: 'paper',
      title: 'BlazeFace: Sub-millisecond Neural Face Detection on Mobile GPUs',
      authors: 'Valentin Bazarevsky, Yury Kartynnik, Andrey Vakunov, Karthik Raveendran, Matthias Grundmann',
      publisher: 'CVPR Workshop on Computer Vision for AR/VR',
      year: 2019,
      href: 'https://arxiv.org/abs/1907.05047',
    },
    {
      kind: 'guidance',
      title: 'MediaPipe BlazeFace Model Card (Short Range) — the face detector this app runs, and what it misses',
      authors: 'Valentin Bazarevsky, Yury Kartynnik, Artsiom Ablavatski',
      publisher: 'Google',
      year: 2021,
      href: 'https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf',
      pdf: 'papers/mediapipe-blazeface-short-range-model-card.pdf',
      licence: 'Apache License 2.0 — Google (model card documentation)',
    },
    {
      kind: 'paper',
      title: 'Defeating Image Obfuscation with Deep Learning',
      authors: 'Richard McPherson, Reza Shokri, Vitaly Shmatikov',
      publisher: 'arXiv',
      year: 2016,
      href: 'https://arxiv.org/abs/1609.00408',
    },
  ],
  'photo-metadata-and-location': [
    {
      kind: 'standard',
      title: 'CIPA DC-008-2026: Exchangeable image file format for digital still cameras: Exif Version 3.1',
      publisher: 'CIPA / JEITA',
      year: 2026,
      href: 'https://www.cipa.jp/std/documents/download_e.html?CIPA_DC-008-2026-E',
    },
    {
      kind: 'paper',
      title: 'Cybercasing the Joint: On the Privacy Implications of Geo-Tagging',
      authors: 'Gerald Friedland, Robin Sommer',
      publisher: 'USENIX HotSec',
      year: 2010,
      href: 'https://www.usenix.org/legacy/event/hotsec10/tech/full_papers/Friedland.pdf',
    },
    {
      kind: 'report',
      title: 'Geotagging poses security risks',
      authors: 'Cheryl Rodewig',
      publisher: 'U.S. Army',
      year: 2012,
      href: 'https://web.archive.org/web/20250816183319/https://www.army.mil/article/75165/Geotagging_poses_security_risks/?print',
    },
    {
      kind: 'guidance',
      title: 'Natural Earth — 1:50m admin-0 countries and 1:10m admin-1 states and provinces (the map data the app ships)',
      publisher: 'Natural Earth',
      href: 'https://www.naturalearthdata.com/',
    },
  ],
  'what-leaves-your-device': [
    {
      kind: 'paper',
      title: 'Local-first software: You own your data, in spite of the cloud',
      authors: 'Martin Kleppmann, Adam Wiggins, Peter van Hardenberg, Mark McGranaghan',
      publisher: 'ACM Onward!',
      year: 2019,
      href: 'https://www.inkandswitch.com/local-first/static/local-first.pdf',
    },
    {
      kind: 'paper',
      title: 'Bringing the Web up to Speed with WebAssembly',
      authors: 'Andreas Haas, Andreas Rossberg, Derek L. Schuff, Ben L. Titzer et al.',
      publisher: 'ACM PLDI',
      year: 2017,
      href: 'https://people.mpi-sws.org/~rossberg/papers/Haas,%20Rossberg,%20Schuff,%20Titzer,%20Gohman,%20Wagner,%20Zakai,%20Bastien,%20Holman%20-%20Bringing%20the%20Web%20up%20to%20Speed%20with%20WebAssembly.pdf',
    },
    {
      kind: 'standard',
      title: 'The Transport Layer Security (TLS) Protocol Version 1.3 (RFC 8446)',
      authors: 'Eric Rescorla',
      publisher: 'IETF',
      year: 2018,
      href: 'https://www.rfc-editor.org/rfc/rfc8446.html',
    },
  ],
}
