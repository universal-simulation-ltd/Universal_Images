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

## Hosted backups — and the `pending` path that broke every one of them

**Back up this image → "Hosted by UNI·SIM"** keeps the resized image in the
private `hosted-uploads` bucket against the user's Universal ID for one token,
refunded on delete. `src/lib/hostedStore.ts` does the work; `src/lib/hostedPaths.ts`
owns the object names.

### ⚠️ `hosted_uploads` grants members SELECT and nothing else

Migration 0041 enables RLS on `public.hosted_uploads` and creates exactly two
policies: `hosted_uploads_member_read` (`for select`) and a platform-admin
`for all`. There is **no member UPDATE policy in 0041–0127**, on purpose — the
consume/refund RPCs are meant to be the only writers.

The store flow ignored that and was written in three steps:

1. `consumeHostedUpload({ storagePath: 'pending' })` — reserve the token,
2. upload the bytes to `<org_id>/images/<upload_id>-<slug>.<ext>`,
3. `UPDATE hosted_uploads SET storage_path = <the real path>`.

**Step 3 matched zero rows on every account that isn't the platform admin**, and
PostgREST reports that as a perfectly ordinary success — no error, just `0`.
The call site never looked at the result. So the ledger kept saying `pending`
for every hosted image ever stored: the dialog listed the backup, and Open asked
storage for an object literally named `pending`, which does not exist and never
did — while the real file sat safely in the bucket the whole time. `pending`
also has no org-id first segment, so it fails the bucket's read policy
(`storage.foldername(name)[1]`) as well as being absent: two independent reasons
for the same "Object not found".

### What the fix does

* **Name the object before reserving the token.** `hostedImagePath(orgId,
  newObjectId(), fileName)` is computed first and passed to
  `consumeHostedUpload`, so the RPC's own insert records the truth and the
  update that RLS was blocking no longer exists.
* **Recover the rows already filed as `pending`.** The old path was fully
  determined by data still on the row — `<org_id>/images/<id>-<safeName(file_name)>`
  — so `hostedImagePathCandidates()` rebuilds it and `openHostedImage` tries each
  candidate in turn. Existing broken backups open; nothing has to be migrated,
  re-uploaded or apologised for. ⚠️ **This is why `safeName` must never drift.**
  It is pinned by `npm run test:hosted-paths`.
* **Fail honestly when there really is nothing there.** Only then does
  `openHostedImage` throw `HostedObjectMissingError`, and `HostedStoreDialog`
  answers it against the row itself: which file, that the upload never finished,
  and one button to clear the entry and take the token back. A network or
  session failure is deliberately NOT reported that way — inviting someone to
  delete an image that is fine would be worse than the original bug.
* **Delete every candidate.** `deleteHostedImage` removes all of them, so
  refunding a legacy row cannot orphan its real object in the bucket.

The same landmine was fixed in Universal PDF (`ffae15b`), QR, Exports and
Recorder — all five had copies of the identical three-step flow.

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
action row stay pinned. `HostedStoreDialog` used to scroll the whole panel,
which hid "Back up this image" and its close button as soon as the tier cards
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

## Suite context

This repo is one part of the **Universal Simulation suite** (the open-source
Universal Apps family). For cross-repo context — how the `@unisim/sdk`, edge
routing, and the suite changelog wire together — see the suite docs repo:
[`universal-simulation-ltd/docs`](https://github.com/universal-simulation-ltd/docs)
(private; checked out at the umbrella root as `Docs_UNI_SIM/` for suite
contributors). Start with `ARCHITECTURE.md` (the cross-repo map).
