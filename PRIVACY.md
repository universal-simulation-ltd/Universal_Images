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
| Removing a background | your browser, on a downloaded AI model | [`src/lib/backgroundRemoval.ts`](src/lib/backgroundRemoval.ts) |
| Blurring faces | your browser, on a downloaded AI model | [`src/lib/faceBlur.ts`](src/lib/faceBlur.ts) |
| Saving the result | your browser's download | [`src/lib/download.ts`](src/lib/download.ts) |

Worth calling out, because it is the opposite of what most photo tools do:
**when the app shows you the GPS coordinates buried in a photo, it prints them
as plain numbers and does not link them to a map.** Looking a location up would
mean handing that location to somebody else's server, which is precisely the
thing you came here to avoid. That decision is written down at the top of
[`src/lib/metadata.ts`](src/lib/metadata.ts).

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
