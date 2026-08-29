import { useEffect, useRef, useState } from 'react'
import { DropAnywhere, DropRing, PrivacyNote, useFileDrop } from '@unisim/sdk'
import DropWatermark from './DropWatermark'
import { useImageStore } from '../../stores/imageStore'
import ImageIllustration from './ImageIllustration'
import { CONTAINER } from '../../lib/layout'
// The third column of the closing grid. These are not features, they are the
// answer to "what does it cost me when it isn't money", so each one names the
// thing it is refusing — a struck-through cloud, eye and megaphone — rather than
// wearing the tick its neighbours do. Lucide's `cloud-off` / `eye-off` /
// `megaphone-off` outlines, drawn inline rather than typed as characters: a lone
// symbol falls back to whatever font happens to carry it.
//
// ⚠️ Twin of `PROMISES` in Universal PDF's LandingPage — the same three claims,
// in the same shape, deliberately. Change one and change the other; they are the
// suite making one promise, and two apps disagreeing about it would be worse
// than the duplication.
const PROMISES: { claim: string; paths: string[] }[] = [
  {
    claim: 'No forced uploads',
    paths: [
      'M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.3-.19',
      'M21.53 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 10 5.07',
      'M2 2l20 20'
    ]
  },
  {
    claim: 'No data scraping',
    paths: [
      'M9.88 9.88a3 3 0 1 0 4.24 4.24',
      'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68',
      'M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61',
      'M2 2l20 20'
    ]
  },
  {
    claim: 'No advertising',
    paths: [
      'M9.26 9.26 3 11v3l14.14 3.14',
      'M21 15.34V6l-7.31 2.03',
      'M11.6 16.8a3 3 0 1 1-5.8-1.6',
      'M2 2l20 20'
    ]
  }
]


export default function LandingPage() {
  // Set when the user arrives via "Convert" — the next picked files open the
  // editor with the Format & quality section expanded + highlighted.
  const convertIntentRef = useRef(false)
  const addFiles = useImageStore((s) => s.addFiles)
  const setConvertMode = useImageStore((s) => s.setConvertMode)
  const [loadingExample, setLoadingExample] = useState(false)

  // The picker mechanics come from the SDK (shared with Compress, Converter and
  // the rest), so re-picking the same file still fires. The circle itself is the
  // click target; the two buttons below open the same picker with a different
  // intent through `openPicker`.
  //
  // `pageWide`: the circle is where to aim, not where you have to land. It
  // replaces the `window` listener App.tsx used to keep for this, and with it the
  // stopPropagation wrappers this zone needed to stop that listener adding the
  // same files a second time — the hook skips any drop that landed inside a
  // `data-unisim-dropzone`, which this is.
  const picker = useFileDrop({
    onFiles: async (files) => {
      setConvertMode(convertIntentRef.current)
      convertIntentRef.current = false
      await addFiles(files)
    },
    accept: 'image/*,.heic,.heif,.svg',
    pageWide: true,
    label: 'Drop images here, or click to browse',
  })

  function openPicker(convert: boolean) {
    convertIntentRef.current = convert
    picker.open()
  }

  // Opening from the circle is always a plain open, so it clears the intent
  // first: "Convert" sets the flag *before* its picker appears, and cancelling
  // that dialog would otherwise leave it set — the next click or drop would then
  // arrive in the editor with Format & quality expanded, for no reason the user
  // could see.
  function clearConvertIntent() {
    convertIntentRef.current = false
  }

  // A drop is always a plain open, and since `pageWide` the drop no longer has to
  // land on the circle to happen — so the intent is cleared the moment a file
  // drag enters the PAGE rather than on the zone's own drop handler, which a
  // dropped-in-the-margin file never reaches.
  useEffect(() => {
    if (picker.over) clearConvertIntent()
  }, [picker.over])

  async function loadExample() {
    if (loadingExample) return
    setLoadingExample(true)
    try {
      const url = `${import.meta.env.BASE_URL}Example_Image.jpg`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to load example image (${res.status})`)
      const blob = await res.blob()
      const file = new File([blob], 'Example_Image.jpg', {
        type: blob.type || 'image/jpeg'
      })
      await addFiles([file])
    } catch (err) {
      console.error(err)
      alert(`Couldn't load the example image: ${(err as Error).message}`)
    } finally {
      setLoadingExample(false)
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="min-h-full flex items-center">
        <div className={`${CONTAINER} py-8 lg:py-14`}>
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="flex flex-col items-center lg:items-start gap-4 order-2 lg:order-1">
              <ImageIllustration />
            </div>

            <div className="order-1 lg:order-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-slate-900">
                Universal Images,
                <br />
                That <span className="text-orange-600">just work</span>.
              </h1>
              <p className="mt-3 text-slate-600 max-w-md">
                Drop one or many. Pick a size, get a smaller file.
              </p>

              <div className="mt-7 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
                {/* The suite's shared drop circle (`DropRing` + `useFileDrop`
                    from @unisim/sdk) rather than a copy, so this is the same
                    front door Universal Compress, PDF and the Converter's All
                    tab open on. It replaced a dashed rectangle: one look for
                    "drop a file here" across the suite. Always `idle` — nothing
                    runs on this page, and a busy chase on an empty page reads as
                    "still loading".

                    The drag handlers used to stop the event so App.tsx's own
                    `window` listener would not put the same files through
                    `addFiles` twice. That listener is gone — this zone is
                    `pageWide` now, and the hook recognises its own zones by the
                    `data-unisim-dropzone` marker it spreads on, so a drop that
                    lands here is never picked up a second time. */}
                <div className="flex flex-col items-center">
                  <div
                    {...picker.dropzoneProps}
                    onClick={() => { clearConvertIntent(); picker.dropzoneProps.onClick?.() }}
                    onKeyDown={(e) => { clearConvertIntent(); picker.dropzoneProps.onKeyDown?.(e) }}
                    className={`relative w-full max-w-[260px] cursor-pointer rounded-full transition-transform focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600 ${
                      picker.over ? 'scale-[1.02]' : ''
                    }`}
                  >
                    <DropRing size="100%" over={picker.over} motion="idle" watermark={<DropWatermark />}>
                      <svg
                        viewBox="0 0 24 24"
                        className={`mb-1 h-9 w-9 ${picker.over ? 'text-orange-500' : 'text-slate-400'}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {/* A framed picture — sun and hillside. The thing you
                            drop, not an upload tray. Nothing is uploaded. */}
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <circle cx="8.5" cy="9.5" r="1.5" />
                        <path d="M21 15.5 16 11l-8 8" />
                      </svg>
                      <span className="text-[15px] font-bold text-slate-900">
                        {picker.over ? 'Drop to open' : 'Drop images here'}
                      </span>
                                            <span className="mt-1 text-[11px] text-slate-400">or click to browse</span>
                    </DropRing>
                  </div>
                  <input {...picker.inputProps} className="hidden" />
                </div>

                {/* Try-the-sample first, then the "or" divider, then the tool
                    that does something to your own file — the same order
                    Universal PDF reads in (example / recents, or, 1 Click
                    Compress). Convert &amp; compress was above the divider here,
                    which put a second ask for a file directly under the circle
                    and left the one thing you can press with nothing in hand
                    at the bottom of the card. */}
                <button
                  type="button"
                  onClick={loadExample}
                  disabled={loadingExample}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 hover:border-orange-400 hover:bg-orange-50/40 text-sm font-medium text-slate-700 disabled:opacity-60 disabled:cursor-wait transition-colors"
                >
                  <span aria-hidden="true">🧪</span>
                  {loadingExample ? 'Loading example…' : 'Try with example image'}
                </button>

                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                  <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                </div>

                <button
                  type="button"
                  onClick={() => openPicker(true)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 hover:border-orange-400 hover:bg-orange-50/40 text-sm font-medium text-slate-700 transition-colors"
                >
                  <span aria-hidden="true">🔄</span>
                  Convert &amp; compress — change format or quality
                </button>

                {/* Universal PDF's closing grid, in the same shape (2026-08-29).
                    The six on the left used to name CAPABILITIES — "S / M / L
                    presets", "Aspect-ratio locked" — which answers a question
                    nobody arriving on the page is asking yet. Each now ends
                    "for free" instead, because that IS the question, and one
                    "all free" heading over a list does not answer it the way
                    the word next to each item does.

                    ⚠️ `grid-flow-col` + `grid-rows-3` fills DOWN each column, so
                    the DOM order below IS the column order. Row-flow would deal
                    the promises out across the rows and there would be no third
                    column at all. Three columns only from `sm`, and ONE below
                    it — measured on a 390px phone, two columns leave ~150px
                    and four of these wrapped. (Universal PDF's twin keeps two
                    columns there; its claims are short enough to fit. The
                    breakpoint follows the copy, not a house rule.)

                    ⚠️ `auto-cols-max` + `justify-between`, NOT three equal
                    thirds. This app's claims are much longer than Universal
                    PDF's — "Redact (AI) image faces for free" is half again the
                    width of "Sign PDF for free" — and an equal third of this
                    card is ~135px of text, so every item in the middle column
                    broke onto a second line. Content-sized columns, spread to
                    the edges, fit all nine on one line each. */}
                <ul className="mt-5 grid grid-cols-1 sm:grid-cols-none sm:auto-cols-max sm:grid-rows-3 sm:grid-flow-col sm:justify-between gap-x-3 gap-y-2 text-xs text-slate-600">
                  {[
                    'Edit images for free',
                    'Resize images for free',
                    'Convert images for free',
                    'Remove background (AI) for free',
                    'Redact (AI) image faces for free',
                    'Strips image metadata for free'
                  ].map((claim) => (
                    <li key={claim} className="flex items-center gap-2 pl-2 sm:pl-4">
                      <span className="text-orange-700" aria-hidden="true">✓</span>
                      {claim}
                    </li>
                  ))}
                  {PROMISES.map(({ claim, paths }) => (
                    <li key={claim} className="flex items-center gap-2 pl-2 sm:pl-4">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5 shrink-0 text-orange-700"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {paths.map((d) => <path key={d} d={d} />)}
                      </svg>
                      {claim}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Under the card, outside the box — the suite's placement. */}
              <PrivacyNote
                className="mt-4"
                repo="https://github.com/universal-simulation-ltd/Universal_Images"
                proof="https://github.com/universal-simulation-ltd/Universal_Images/blob/main/PRIVACY.md"
                subject="Your images"
                plural
                except="backup"
              />
            </div>
          </div>
        </div>
      </div>

      {/* The other half of `pageWide` — the circle lights up wherever the drag
          is, and this says why, in the margin where the pointer actually is. */}
      <DropAnywhere
        show={picker.pageOver}
        title="Drop to open"
        hint="JPEG, PNG, WebP, HEIC, GIF — anywhere on this page will do"
        icon={<span aria-hidden="true">🖼</span>}
      />
    </div>
  )
}
