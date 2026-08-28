import { useEffect, useRef, useState } from 'react'
import { DropAnywhere, DropRing, PrivacyNote, useFileDrop } from '@unisim/sdk'
import DropWatermark from './DropWatermark'
import { useImageStore } from '../../stores/imageStore'
import ImageIllustration from './ImageIllustration'
import { CONTAINER } from '../../lib/layout'

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

                <button
                  type="button"
                  onClick={() => openPicker(true)}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 hover:border-orange-400 hover:bg-orange-50/40 text-sm font-medium text-slate-700 transition-colors"
                >
                  <span aria-hidden="true">🔄</span>
                  Convert &amp; compress — change format or quality
                </button>

                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                  <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                </div>

                <button
                  type="button"
                  onClick={loadExample}
                  disabled={loadingExample}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 hover:border-orange-400 hover:bg-orange-50/40 text-sm font-medium text-slate-700 disabled:opacity-60 disabled:cursor-wait transition-colors"
                >
                  <span aria-hidden="true">🧪</span>
                  {loadingExample ? 'Loading example…' : 'Try with example image'}
                </button>

                <ul className="mt-5 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2"><span className="text-orange-700">✓</span> JPEG, PNG, WebP, HEIC</li>
                  <li className="flex items-center gap-2"><span className="text-orange-700">✓</span> S / M / L presets</li>
                  <li className="flex items-center gap-2"><span className="text-orange-700">✓</span> Custom width × height</li>
                  <li className="flex items-center gap-2"><span className="text-orange-700">✓</span> Aspect-ratio locked</li>
                  <li className="flex items-center gap-2"><span className="text-orange-700">✓</span> Remove background (AI)</li>
                  <li className="flex items-center gap-2"><span className="text-orange-700">✓</span> Batch ZIP export</li>
                </ul>
              </div>

              {/* Under the card, outside the box — the suite's placement. */}
              <PrivacyNote
                className="mt-4"
                repo="https://github.com/universal-simulation-ltd/Universal_Images"
                subject="Your images"
                plural
                except="backup"
                badge="on-device · works offline"
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
