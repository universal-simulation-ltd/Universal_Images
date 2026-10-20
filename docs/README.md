# Universal Images — docs

## What this repo is

Universal Images is a clean Progressive Web App for **resizing, cropping,
converting, and optimising images entirely in the browser** — drag & drop
JPEG/PNG/WebP/HEIC/GIF, crop with live handles, apply social-media size
presets, convert with a quality slider, remove backgrounds with a one-click
on-device AI cut-out, blur/pixelate faces on-device, and batch-export
(individually or as a ZIP). No upload to a server; files stay on the device.

## Background removal (on-device AI)

The "Remove background" tool (`src/lib/backgroundRemoval.ts` +
`removeBackground` in `src/stores/imageStore.ts`) cuts the subject out to a
transparent PNG using [`@imgly/background-removal`](https://www.npmjs.com/package/@imgly/background-removal),
an ONNX/WASM segmentation model that runs in a web worker. Consistent with the
suite's local-first stance, **the image never leaves the browser** — only the
model weights (the small `isnet_fp16` model, ~40 MB) download once from the
library's CDN and are then browser-cached. The onnxruntime WASM ships in our
own build but is kept out of the PWA install-time precache (`vite.config.ts`
`workbox.globIgnores`) and cached at runtime on first use, so the base app load
stays light. To make the feature **fully offline** (e.g. for the desktop
build), set `VITE_BG_REMOVAL_PATH` at build time to a folder of self-hosted
`@imgly/background-removal-data` assets and the library loads models locally
instead of the CDN.

Related, non-destructive controls on the same cut-out: **Restore background**
undoes a removal (the cut-out is cached in `bgCutout` so a re-remove is instant),
and **Fill background** composites a solid colour behind a transparent image on
preview + export (`bgFill` in the store, threaded through `processAndEncode`; the
swatches are gated on `imageHasAlpha`). Per-image editing state (size, crop,
fill, background snapshots) is preserved when switching images via the `edits`
map in the store.

## Face redaction (on-device AI)

The "Redact faces" tool (`src/lib/faceBlur.ts` + `faceBlur.worker.ts`, driven by
`detectFaces` / `applyFaceBlur` in `src/stores/imageStore.ts`) blurs or pixelates
faces using Google MediaPipe's **BlazeFace short-range** detector via
[`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision).
Detection runs in a web worker (constructed lazily, so the ~126 KB MediaPipe JS
lands in its own `faceBlur.worker` chunk and stays out of the base app bundle);
the blur itself is a pure Canvas resample on the main thread (`renderRedacted` —
pixelate = nearest-neighbour, blur = bilinear, both through a tiny intermediate
canvas to avoid edge bleed). As with background removal, **the image never leaves
the browser** — only the MediaPipe vision WASM runtime (~2 MB) and the BlazeFace
`.tflite` model (~230 KB) download once from their CDNs (jsDelivr + Google model
storage) and are then browser-cached. Neither is in the PWA install-time precache
(`vite.config.ts` `workbox.globIgnores` excludes `**/*.wasm` / `**/*.tflite` /
`**/*.task`); both are cached at runtime on first use (`runtimeCaching` rules
`mediapipe-vision` and `face-model`). To make the feature **fully offline** (e.g.
for the desktop build), set `VITE_FACE_MODEL_PATH` at build time to a base folder
holding the `@mediapipe/tasks-vision` `wasm/` directory and a
`blaze_face_short_range.tflite` — the twin of `VITE_BG_REMOVAL_PATH`.

The redaction is baked into a PNG that replaces the image in place; the pre-blur
original is stashed in `faceOriginal` so **Remove blur** undoes it in one tap
(detected boxes stay cached for an instant re-blur). A **strength** slider, a
**blur/pixelate** toggle, and a **per-face** toggle (`enabled` on each `FaceBox`,
so individual faces can be kept visible) re-render the redaction live from the
clean original. Face snapshots + boxes are preserved across image switches via
the same `edits` map.

### Combining it with background removal

The blur is modelled as a layer **above** the background edit, so the two
compose in either order. `faceOriginal` always holds the un-blurred image for
whichever background state is current (the full photo, or the cut-out once the
background is removed), and `bgOriginal` / `bgCutout` always hold *clean*
(never blurred) snapshots. Two consequences:

- **Segmentation always runs on the clean photo.** Handing the model a baked
  blur destroys the detail it needs and it answers by keeping the whole blurred
  block as foreground — an opaque rectangle around the face. `removeBackground`
  therefore segments `faceOriginal` when a redaction is applied.
- **The blur is re-baked whenever the background state changes**, from the
  *opaque* pre-removal photo, stencilled by the cut-out's alpha
  (`renderRedacted`'s `mask` argument, a `destination-in` composite). Rendering
  from the opaque original keeps the subject's silhouette crisp — resampling the
  transparent cut-out directly would smear its alpha — and the stencil deletes
  the blurred layer in exactly the same places the background was removed.

Both re-bakes happen *before* the new bitmap is swapped in (`bakeFaceBlur` /
`rebakeBlur` are pure and touch no store state), so neither "Remove background"
nor "Restore background" ever shows an un-redacted frame.

- **Live:** [opensource.unisim.co.uk/images](https://opensource.unisim.co.uk/images/)
  — served by path via the `opensource-portal` Worker, which proxies `/images`
  to its Cloudflare Pages project.
- **Stack:** Vite + React 18 + TypeScript PWA (installable, works offline
  after first load).
- **Wrappers:** an `electron/` folder provides a desktop build
  (`npm run dist`), and a `capacitor.config.ts` exists for native mobile
  packaging. Desktop apps are shipped unsigned per suite policy.

MIT licensed — free and open source, like all Universal Apps.

## No sign-in (2026-10-20)

Universal Images has no accounts in any build: `noAccounts: true` in
`src/main.tsx` (James: no logins in first iterations unless they improve the
experience; `Docs_UNI_SIM/login-free-plan.md`, bucket A). The one thing a
Universal ID gave was **Back up this image → "Hosted by UNI·SIM"**, the edited
picture kept online in the `hosted-uploads` bucket. It was removed with
`src/lib/hostedStore.ts`, `hostedPaths.ts`, `useFreeAllowance.ts` and their
test; prod held no Images rows in `hosted_uploads`, so nobody lost a backup.
**Back up this image** is now `src/components/BackupDialog.tsx`: the
**Save to desktop** backup file (original + crop, size and boxes) and
**Import a backup**, which carries an image between devices with no account.
`noAccounts` also turns the SDK's anonymous daily open count off, and there is
no `<UsageTracker />`, so the app sends nothing about its user. The
`hosted_uploads` history (the `pending` path bug) is in git before this commit.

## Phone and iPhone-app layout rules

Three faults reported by the owner on 2026-08-30, all of which only exist below
`lg` and none of which a desktop screenshot or `tsc` can see. Pinned in source
by `npm run test:mobile-ui`, and verified rendered in Playwright at 390×844 with
touch emulation.

### The navbar edit shortcuts are icon-only on a phone

`EditShortcuts.tsx` fills the SDK navbar's `centre` slot with **Remove bg** and
**Blur faces** — the two tools that are otherwise several scrolls down the side
panel. It used to be `hidden lg:flex`, which meant the iPhone app, where that
panel *is* the whole screen, had neither.

Dropping the breakpoint alone does not work: at 390px the bar has roughly 160px
of slack between the home button and the Actions/profile cluster, and the two
labelled buttons want ~190px. So below `lg` the label is dropped and each button
becomes a 38px square — the size and the chrome (white fill, slate hairline) the
SDK gives the bar's own home button, and for the reason its source gives: a bare
glyph on a white bar does not read as something you can press.

Everything the label was carrying has to survive that:

| State | Desktop | Phone |
|---|---|---|
| idle | "Remove bg" / "Blur faces" | icon, `aria-label`, `title` |
| running | "Removing…" / "Detecting…" | **spinner replaces the icon**, `aria-busy` |
| background removed | "Restore bg" + orange pressed fill | orange pressed fill, `aria-label` |
| faces blurred | "Faces · 3" | **count badge** on the corner, `aria-label` |

`aria-label` is the state and `title` is `"<state> — <explanation>"`, so the
label text is never the only place a state is written down.

### Dialogs: `src/lib/dialog.ts`

Every modal is built from the shared shell there, and a new one must be too
(the test fails on any hand-rolled `fixed inset-0` class). Three rules, each of
which was broken:

1. **`z-[1100]`.** `UniversalAppsNavBar` sets an INLINE `zIndex: 1000`. Tailwind
   stops at `z-50` and an inline style beats a class regardless, so a dialog
   below it leaves the bar brightly lit on top of its own backdrop — and a tall
   one slides its own header, title and close button included, underneath the
   bar. This is a suite-wide landmine, not an Images one.
2. **`100dvh`, not `vh`.** `vh` on iOS is the LARGE viewport, measured with the
   browser toolbars hidden whether or not they are, so `max-h-[85vh]` is 85% of
   a box taller than the one the user can see. The panel takes `max-h-full` of
   the padded overlay, so the two numbers cannot drift apart.
3. **Safe-area insets.** The Capacitor build runs full-screen under the Dynamic
   Island (`viewport-fit=cover`) and a `position: fixed` box is laid out against
   the whole SCREEN. `env(safe-area-inset-*)` is 0 in a browser, so this costs
   web and desktop nothing.

The panel is a flex column and **only the body scrolls**, so the title and the
action row stay pinned. The backup dialog used to scroll the whole panel,
which hid "Back up this image" and its close button as soon as the cards
outgrew the screen.

### Fields are floored at 16px on touch

iOS Safari and WKWebView zoom the whole page in the instant you focus an input
whose **computed** `font-size` is under 16px, and there is no matching zoom back
out — the page is simply left scaled with half of it off-screen. Every text
field here was under the line (the rename box is `text-xs`, the custom
width/height boxes `text-sm`).

The fix is in `src/index.css`, under `@media (hover: none) and (pointer: coarse)`
so the desktop type scale is untouched, written `font-size: max(16px, 1em)` so a
field that is already larger keeps its size. It is deliberately **unlayered** —
Tailwind's utilities live in `@layer utilities`, and an unlayered rule outranks
a layered one whatever its specificity, which is what lets a plain element
selector beat `.text-xs`. The `!important` on it is for one control this repo
does not own: the language `<select>` in the SDK's profile dropdown carries an
inline `fontSize: 12`, and iOS zooms for a small `<select>` exactly as it does
for a text box.

⚠️ **Do not "fix" this with `maximum-scale=1` or `user-scalable=no`.** Pinch-zoom
is an accessibility feature; `index.html` stays
`width=device-width, initial-scale=1.0, viewport-fit=cover`, and the test asserts
that it does.

### An Actions row that opens a screen closes the Actions menu

`AppMenu.tsx` supplies the rows inside the SDK's Actions dropdown, and that
dropdown is portaled to `<body>` at `z-index: 2147483000`. Our dialogs are
`z-[1100]` — deliberately, so they clear the navbar (above) — so the menu is
painted **over** anything a row opens. On a phone that covered the metadata
dialog's own title and close button (James, 2026-09-18).

The rows that open a screen therefore call `useCloseAppMenu()` from the SDK
first: `Metadata` and `Make a collage…`. It is a no-op outside a menu, so it
needs no guard.

⚠️ **`Open images…` / `Add more images…` deliberately does not.** The
`<input type="file">` it drives is rendered by `AppMenu` itself, so closing the
menu unmounts the input while the OS picker is still open and the chosen files
never arrive. `npm run test:menu-close` pins both halves, the picker included,
so a later tidy-up cannot "finish the job" and break it.

## Phone builds and the App Store / Google Play requirements

Added 2026-09-14, when the iPhone and Android apps were prepared for the stores.

- **No sign-in, so no Delete my account and no demo login for App Review**
  (2026-10-20). `noAccounts` hides the account rows the SDK would otherwise
  draw, Delete my account among them.
- **The iOS privacy manifest** is `ios/App/App/PrivacyInfo.xcprivacy`. It
  declares no collected data (App Store Connect: "Data Not Collected") and
  `@capacitor/filesystem`'s file-date reads (C617.1). Keep it in step with
  `store-assets/data-safety.json` and the app's section of the
  [privacy policy](https://www.unisim.co.uk/privacy#universal-images).
- **`ITSAppUsesNonExemptEncryption` is `false`** in `Info.plist`: the app uses
  nothing beyond HTTPS.
- **Versions come from `package.json`.** `npm run sync:ios-version` stamps it
  into the iOS project. Android's `versionName`/`versionCode` are derived from
  it in `android/app/build.gradle`, the same way as Universal PDF (0.1.0 →
  build 100). Bump the version before every store upload, because the stores
  refuse a build number twice.
- **Android release builds** come from `.github/workflows/android-release.yml`,
  on a `v*` tag or a manual dispatch. It signs with the upload key when the
  repo secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` are set, and builds unsigned
  otherwise, so a fork still builds. Don't sign release builds on a laptop.
- **Buying tokens is never offered inside the phone app** (App Review 3.1.1).
  `HostedStoreDialog` hides the "Get tokens" link when `isNativeShell()` is
  true. The web and desktop apps are unchanged.

## Suite context

This repo is one part of the **Universal Simulation suite** (the open-source
Universal Apps family). For cross-repo context — how the `@unisim/sdk`, edge
routing, and the suite changelog wire together — see the suite docs repo:
[`universal-simulation-ltd/docs`](https://github.com/universal-simulation-ltd/docs)
(private; checked out at the umbrella root as `Docs_UNI_SIM/` for suite
contributors). Start with `ARCHITECTURE.md` (the cross-repo map).
