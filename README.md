# Universal Images

> Universal Images — drag, drop, resize and optimise images entirely in your browser.

> Open source — self-host free or hosted by UNI SIM.

A clean Progressive Web App for resizing, cropping, converting, and optimising images — works on Windows, macOS, iOS, and Android in any modern browser, with no upload to a server. Files stay on your device.

**[Try the live app →](https://opensource.unisim.co.uk/images/)**

## Features

- **Drag & drop** JPEG, PNG, WebP, HEIC, GIF, AVIF, and SVG — multiple files at once, decoded locally (SVG is rasterised, HEIC decoded automatically)
- **Crop** with a live, mode-less crop region — move and resize handles, no separate crop mode
- **Social presets** for Instagram, X / Twitter, LinkedIn, YouTube, and Facebook at each platform's current pixel specs
- **Resize** to preset or custom dimensions with a live preview
- **Convert** between JPEG, PNG, WebP, and AVIF (AVIF where the browser can encode it) with a quality slider; HEIC input is decoded automatically
- **Remove background** — one-click AI cut-out to a transparent PNG, running entirely on-device (your image is never uploaded; a one-time model download is cached on first use). One tap to undo, and a re-remove after undo is instant
- **Fill background** — replace a transparent background with a solid colour (black / white / orange / any custom colour) on export
- **Redact faces** — detect faces and blur or pixelate them, running entirely on-device (your image is never uploaded; a one-time ~2 MB face model is cached on first use). Adjustable strength, a blur/pixelate toggle, and a per-face toggle to keep individual faces visible — one tap to undo. Blur and background removal stack in either order: the cut-out is always computed from the unblurred photo, and the blur is trimmed back to the subject so it never leaves a blurred block where the background used to be
- **Batch export** — download images individually or all at once as a ZIP
- **Installable** PWA — add to home screen on phone or install on desktop, works offline after first load

## Install on your device

Open the [app URL](https://opensource.unisim.co.uk/images/), then:

- **iOS Safari**: Share → *Add to Home Screen*
- **Android Chrome**: menu → *Install app*
- **Desktop Chrome / Edge**: install icon in the address bar

## How to use

1. **Add images** — click to browse or drag-and-drop files anywhere on the page
2. **Pick an image** from the thumbnail sidebar
3. **Crop, resize, or pick a social preset** in the editor panel
4. **Choose the output format and quality** — the size estimate updates live
5. **Download** the result, or export everything as a ZIP

## Development

Requires Node 22+ and npm.

```sh
git clone https://github.com/universal-simulation-ltd/Universal_Images.git
cd Universal_Images
npm install
npm run dev
```

The dev server runs at <http://localhost:5173>. Build for production with `npm run build`.

Pushes to `main` auto-deploy via Cloudflare Pages, which serves the app at <https://opensource.unisim.co.uk/images>. The production build sets Vite `base: '/images/'` and ships a `public/_redirects` file that rewrites `/images/*` onto the flat `dist/` output.

## Desktop app (Windows)

The same client-side app can be packaged as a native desktop app with
[Electron](https://www.electronjs.org/). The Electron main process lives in
[`electron/main.cjs`](electron/main.cjs) and loads the built bundle; the
`desktop` Vite mode builds with a relative `base` (`./`) and without the PWA
service worker so assets resolve over `file://`.

```sh
npm run build:desktop   # build the web bundle for Electron (dist/)
npm run electron        # run the packaged-style app against that build
npm run dist:win        # build + produce a Windows installer in release/
```

`npm run dist:win` emits an NSIS `.exe` installer under `release/`. **It must
run on Windows** (or Linux/macOS with Wine) because electron-builder packages a
platform-native binary; cross-building from a plain Linux host won't produce a
working Windows `.exe`. The first run downloads the Electron binary (~100 MB).

To cut a release, push a `v*` tag — the
[`build-windows`](.github/workflows/build-windows.yml) workflow builds the
installer on `windows-latest` and attaches it to the matching GitHub Release.
Manual `workflow_dispatch` also works for ad-hoc builds; the installer is
uploaded as a workflow artifact in that case.

## Stack

- **Vite 6 + React 18 + TypeScript** — app shell
- **Canvas API** — client-side decode, crop, resize, and re-encode
- **heic2any** — HEIC → JPEG decoding in the browser
- **JSZip** — batch ZIP export
- **Zustand** — state management
- **Tailwind CSS v4** — styling
- **vite-plugin-pwa** — service worker + manifest

## Contributing

Issues and pull requests welcome. The project is intentionally small and dependency-light; please open an issue before adding a large feature.

## Bundled data

The metadata panel's location map is drawn from data shipped inside the app, so
that showing you where a photo was taken never means telling anybody where it
was taken.

- **Boundaries** — country outlines and admin-1 regions from
  [Natural Earth](https://www.naturalearthdata.com/), which is public domain.
- **Place names** — populated places from [GeoNames](https://www.geonames.org/),
  licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The app
  carries this credit under the map wherever a place name is shown.

Regenerate with `node scripts/build-world-data.mjs` and
`node scripts/build-region-data.mjs`; see [`src/data/README.md`](src/data/README.md).

## License

[MIT](./LICENSE). The bundled data is under its own licences — see above.
