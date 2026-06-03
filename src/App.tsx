import { useEffect, useRef, useState } from 'react'
import { UniversalAppsNavBar } from '@unisim/sdk'
import AppMenu from './components/Header/AppMenu'
import ProductLogo from './components/Header/ProductLogo'
import LandingPage from './components/Landing/LandingPage'
import ImageGrid from './components/Grid/ImageGrid'
import ResizePanel from './components/Resize/ResizePanel'
import { useImageStore } from './stores/imageStore'

const REPO_URL = 'https://github.com/universal-simulation-ltd/Universal_Images'

export default function App() {
  const images = useImageStore((s) => s.images)
  const loading = useImageStore((s) => s.loading)
  const addFiles = useImageStore((s) => s.addFiles)

  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)

  // Mobile image-picker overlay — hidden by default; shown when user taps the grid button.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const hasImages = images.length > 0
  useEffect(() => {
    if (!hasImages) setMobileSidebarOpen(false)
  }, [hasImages])

  useEffect(() => {
    function onEnter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      dragCounter.current++
      setDragOver(true)
    }
    function onOver(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
    }
    function onLeave(e: DragEvent) {
      e.preventDefault()
      dragCounter.current = Math.max(0, dragCounter.current - 1)
      if (dragCounter.current === 0) setDragOver(false)
    }
    async function onDrop(e: DragEvent) {
      e.preventDefault()
      dragCounter.current = 0
      setDragOver(false)
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      await addFiles(files)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [addFiles])

  return (
    <div className="flex flex-col h-full bg-slate-100">
      <UniversalAppsNavBar
        product="images"
        productLogo={<ProductLogo />}
        productHomeHref={import.meta.env.BASE_URL}
        fileMenu={hasImages ? <AppMenu /> : undefined}
        suiteSwitcherIconSrc={`${import.meta.env.BASE_URL}unisim-icon.png`}
      />

      <main className="flex-1 min-h-0 flex relative">
        {loading && !hasImages ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Decoding images…
          </div>
        ) : hasImages ? (
          <>
            {/* Thumbnail sidebar — always visible on desktop, hidden on mobile */}
            <div className="hidden md:flex shrink-0">
              <ImageGrid />
            </div>

            {/* Editor panel — full-width on mobile since sidebar is hidden */}
            <ResizePanel onShowGrid={() => setMobileSidebarOpen(true)} />

            {/* Mobile image-picker overlay */}
            {mobileSidebarOpen && (
              <div className="absolute inset-0 z-30 flex md:hidden">
                <ImageGrid
                  mobileExpanded
                  onBack={() => setMobileSidebarOpen(false)}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 min-h-0">
            <LandingPage />
          </div>
        )}
      </main>

      {!hasImages && !loading && (
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-xs text-slate-500">
            <span>
              100% Open source and free. Hosted by{' '}
              <a
                href="https://www.unisim.co.uk"
                target="_blank"
                rel="noreferrer"
                className="text-slate-700 hover:text-orange-600 underline-offset-2 hover:underline"
              >
                UNI SIM
              </a>
            </span>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Universal Images on GitHub"
              title="View source on GitHub"
              className="sm:ml-auto inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12.02c0 5.09 3.29 9.4 7.86 10.92.57.1.78-.25.78-.55 0-.27-.01-1-.02-1.96-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.39-5.26 5.68.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.21.66.79.55 4.57-1.52 7.86-5.83 7.86-10.92C23.5 5.65 18.35.5 12 .5z" />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </footer>
      )}

      {dragOver && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-orange-600/20">
          <div className="absolute inset-4 border-4 border-dashed border-orange-500 rounded-2xl" />
          <div className="bg-white shadow-xl rounded-xl px-6 py-5 flex items-center gap-3">
            <div className="text-3xl">🖼</div>
            <div>
              <div className="font-semibold text-slate-900">Drop to add</div>
              <div className="text-xs text-slate-500">JPEG, PNG, WebP, HEIC, GIF</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
