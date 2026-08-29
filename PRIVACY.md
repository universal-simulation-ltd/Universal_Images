# What Universal Images does with your pictures

You landed here from the word **Guaranteed**, so this page owes you something
better than a privacy policy. It is written to be checked: every claim below
names the file in this repository that makes it true, and you are welcome to
go and read it.

The short version: **your images are resized, converted, blurred and stripped
by your own browser.** They are not uploaded to us to be processed, and there
is no copy of them on our servers unless you pressed a button that says so.

---

## What happens when you drop images in

The browser hands the app the bytes of your files, and everything after that
happens on your machine:

| Step | Where it happens | The code |
|---|---|---|
| Reading the files | your browser | [`src/stores/imageStore.ts`](src/stores/imageStore.ts) |
| Resizing, cropping and re-encoding | your browser's own canvas | [`src/lib/imageResize.ts`](src/lib/imageResize.ts) |
| Reading and stripping EXIF/GPS metadata | your browser | [`src/lib/metadata.ts`](src/lib/metadata.ts) |
| Naming the country and drawing the location map | your browser, on boundaries bundled with the app | [`src/lib/geo.ts`](src/lib/geo.ts) |
| Naming the county and the nearest town, and zooming to them | your browser, on one county file fetched from this app (see below) | [`src/lib/geo.ts`](src/lib/geo.ts) |
| Removing a background | your browser, on a downloaded AI model | [`src/lib/backgroundRemoval.ts`](src/lib/backgroundRemoval.ts) |
| Blurring faces | your browser, on a downloaded AI model | [`src/lib/faceBlur.ts`](src/lib/faceBlur.ts) |
| Saving the result | your browser's download | [`src/lib/download.ts`](src/lib/download.ts) |

Worth calling out, because it is the opposite of what most photo tools do:
**when the app shows you where a photo says it was taken, it draws that map
without asking anybody where the photo was taken.**

Every other tool does this by sending the coordinates away — to a geocoder, to
a tile server, or to whoever is behind the "view on map" link. Any of those
hands over the exact thing you came here to protect, along with your IP
address, and it happens before you have decided to keep the photo at all.

So the map ships with the app. The country boundaries are a file in this
repository ([`src/data/world.json`](src/data/world.json), built by
[`scripts/build-world-data.mjs`](scripts/build-world-data.mjs)), and naming the
country and drawing the outline are arithmetic your browser does on that file
([`src/lib/geo.ts`](src/lib/geo.ts)). Open your Network tab and put a geotagged
photo in: nothing goes out. Turn the network off entirely and it still works.

### The one request the map does make

The map then zooms in to name the **county, state or province** too, and that
part is worth being exact about, because it is not free.

County outlines for every country come to about 1.7 MB — too much to hand every
visitor to answer a question about one country. So they are split into one file
per country ([`src/data/regions/`](src/data/regions/)), and your browser fetches
only the one it needs. **That fetch is a request, and it is the only one this
panel makes.** Specifically:

- It goes to **this app's own server**, not a third party. There is no geocoder
  and no tile server involved, and no other company learns anything.
- It asks for one file named after a country — `gbr`, `fra`, `usa`. Somebody
  reading the server log could infer **which country** your photo is from.
- It does **not** carry your coordinates, your county, or anything about the
  photo. Those never leave the tab, and nothing is sent back.
- It happens only after you open the Metadata panel on a geotagged photo, and
  only once per country — after that it is cached, including offline.
- The country-level map is drawn **before** this and does not depend on it. If
  you are offline, or it fails, you still get the country map and no request.

The panel says which of the two you are looking at, under the map. That is a
narrower promise than "nothing is sent", and it is narrower on purpose: a claim
your own Network tab can disprove in one click is worse than no claim.

The map also names the nearest **town or village**, and that costs nothing
extra: those names travel inside the very same county file, so there is no
second request. They come from GeoNames, which requires crediting — the panel
does, under the map.

### What it still will not do

You get a county and a dot, never a **street address**. That cannot be worked
out from a file small enough to bundle — it needs somebody else's server, which
is the whole point. The coordinates themselves are printed in full above the
map, and there is a **Copy** button, so sending them somewhere stays a thing you
choose to do.

---

## The one way an image *can* leave — a button you press

### "Store with UNI·SIM"

If you are signed in with a Universal ID and you choose to store an image
online, the app uploads it so you can get it back on another device. It uploads
the processed image — the same bytes the Download button would have given you.

- The code: [`src/lib/hostedStore.ts`](src/lib/hostedStore.ts)
- The dialog that asks you: [`src/components/HostedStoreDialog.tsx`](src/components/HostedStoreDialog.tsx)
- Deleting it in the app deletes it from storage.

⚠️ **This is ordinary cloud storage, not end-to-end encryption.** It is
encrypted in transit and at rest, and access is restricted to your own account,
but we hold the keys — so this is a promise about our conduct, not a
mathematical guarantee. If that distinction matters for a particular photo,
don't store it; the app works completely without an account.

---

## Two downloads that are not uploads

If you open your browser's Network tab and use **Remove background** or
**Blur faces**, you will see the app fetch tens of megabytes from a domain that
isn't ours. That is worth explaining rather than hiding, because from the
outside it looks like exactly the thing this page says doesn't happen.

Those two features run an AI model, and the model has to come from somewhere.
The app downloads the **model weights** — a fixed file, identical for every
user, the same as downloading a font — and then runs it against your picture
locally. Your picture goes *into* the model on your machine. It does not go out
with the request.

- Background removal fetches from the `@imgly/background-removal` CDN
  (~40 MB, once, then cached by your browser) —
  [`src/lib/backgroundRemoval.ts`](src/lib/backgroundRemoval.ts)
- Face blurring fetches MediaPipe's BlazeFace model from Google's model
  storage and its WASM runtime from jsDelivr —
  [`src/lib/faceBlur.ts`](src/lib/faceBlur.ts)

**What this does mean honestly:** those two CDNs see a request from your IP
address, the way any CDN does. They do not see your image. Both paths can be
pointed at self-hosted copies at build time (`VITE_BG_REMOVAL_PATH` and its
face-detection equivalent) if you would rather they never happened — which is
how the offline builds are made.

---

## What the app talks to a server for, even when your images don't

- **Signing in.** Only if you choose to.
- **"You opened the app".** When you are signed in, the app records one event
  saying the app was opened, so your account's activity page is accurate. It
  does not include anything about your images — not their names, not their
  sizes. See [`src/UsageTracker.tsx`](src/UsageTracker.tsx).
- **The changelog and update notice.**

**There is no third-party analytics, no tracking pixel, and no advertising
script.**

---

## How to prove it to yourself in about a minute

1. Open the app, then open your browser's developer tools (F12) on the
   **Network** tab.
2. Drop some photos on the page and resize or convert them.
3. Watch the list. Your images are never in it.

Or, more conclusively: **turn off your Wi-Fi and use the app anyway.** Resizing,
converting and metadata stripping keep working, because that work was never
happening anywhere else. (Background removal and face blur will need the
connection once, for the model, and then work offline too.)

---

## If you find this page is wrong

That is worth more to us than it costs. Open an issue on
[the repository](https://github.com/universal-simulation-ltd/Universal_Images/issues).
A claim nobody can correct isn't a guarantee either.
