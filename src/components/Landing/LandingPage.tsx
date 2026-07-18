import { useRef, useState } from 'react'
import { useImageStore } from '../../stores/imageStore'
import ImageIllustration from './ImageIllustration'
import { CONTAINER } from '../../lib/layout'

export default function LandingPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  // Set when the user arrives via "Convert" — the next picked files open the
  // editor with the Format & quality section expanded + highlighted.
  const convertIntentRef = useRef(false)
  const addFiles = useImageStore((s) => s.addFiles)
  const setConvertMode = useImageStore((s) => s.setConvertMode)
  const [loadingExample, setLoadingExample] = useState(false)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      setConvertMode(convertIntentRef.current)
      await addFiles(files)
    }
    convertIntentRef.current = false
    e.target.value = ''
  }

  function openPicker(convert: boolean) {
    convertIntentRef.current = convert
    inputRef.current?.click()
  }

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
                Drop one or many. Pick a size, get a smaller file. Nothing leaves your device.
              </p>

              <div className="mt-7 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => openPicker(false)}
                  className="group relative w-full flex items-center gap-4 p-5 border-2 border-dashed border-orange-500 bg-orange-50/40 rounded-xl text-left hover:bg-orange-50 hover:border-orange-600 hover:shadow-lg hover:shadow-orange-500/10 transition-all"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl ring-4 ring-orange-500/0 group-hover:ring-orange-500/15 transition-all" />
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-orange-600 text-white flex items-center justify-center text-2xl shadow-sm group-hover:scale-105 transition-transform">
                    🖼
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 text-base">Open images</div>
                    <div className="text-sm text-slate-600">Click to choose, or drop files anywhere</div>
                  </div>
                  <span className="ml-auto text-orange-600 text-lg group-hover:translate-x-0.5 transition-transform" aria-hidden="true">
                    →
                  </span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  hidden
                  onChange={onPick}
                />

                <button
                  type="button"
                  onClick={() => openPicker(true)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 hover:border-orange-400 hover:bg-orange-50/40 text-sm font-medium text-slate-700 transition-colors"
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
                  <li className="flex items-center gap-2"><span className="text-orange-600">✓</span> JPEG, PNG, WebP, HEIC</li>
                  <li className="flex items-center gap-2"><span className="text-orange-600">✓</span> S / M / L presets</li>
                  <li className="flex items-center gap-2"><span className="text-orange-600">✓</span> Custom width × height</li>
                  <li className="flex items-center gap-2"><span className="text-orange-600">✓</span> Aspect-ratio locked</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
