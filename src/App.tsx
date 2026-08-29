import { useEffect, useState } from 'react'
import { DropAnywhere, UniversalAppsNavBar, UpdateNotice, useFileDrop } from '@unisim/sdk'
import AppMenu from './components/Header/AppMenu'
import ProductLogo from './components/Header/ProductLogo'
import LandingPage from './components/Landing/LandingPage'
import ImageGrid from './components/Grid/ImageGrid'
import ResizePanel from './components/Resize/ResizePanel'
import HostedStoreDialog from './components/HostedStoreDialog'
import LoadErrorNotice from './components/LoadErrorNotice'
import MetadataDialog from './components/Metadata/MetadataDialog'
import { useImageStore } from './stores/imageStore'
import EditShortcuts from './components/Header/EditShortcuts'
import { CONTAINER, EDITOR_CONTAINER } from './lib/layout'

const REPO_URL = 'https://github.com/universal-simulation-ltd/Universal_Images'

export default function App() {
  const images = useImageStore((s) => s.images)
  const loading = useImageStore((s) => s.loading)
  const addFiles = useImageStore((s) => s.addFiles)
  const metadataOpen = useImageStore((s) => s.metadataOpen)
  const setMetadataOpen = useImageStore((s) => s.setMetadataOpen)
  const clearAll = useImageStore((s) => s.clearAll)

  // Mobile image-picker overlay — hidden by default; shown when user taps the grid button.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const hasImages = images.length > 0
  useEffect(() => {
    if (!hasImages) setMobileSidebarOpen(false)
  }, [hasImages])

  // Drop images anywhere on the page and they are added — the SDK's `pageWide`,
  // not the hand-rolled `window` listener this used to be. That copy predated the
  // hook and paid its whole cost: a depth counter, a bubble-phase drop handler,
  // and a SECOND capture-phase one whose only job was to clear the overlay after
  // the landing circle stopped the event so one file was not added twice. All
  // three now live once, in `useFileDrop`, which skips any drop that landed
  // inside a `data-unisim-dropzone` rather than asking the zone to stop it.
  //
  // This one covers the EDITOR only. The landing page runs its own page-wide zone
  // around the drop circle, and `disabled` hands the page to it — the hook picks
  // the last-mounted zone that isn't disabled, and the landing page mounts inside
  // this component.
  const pageDrop = useFileDrop({
    onFiles: addFiles,
    clickToBrowse: false,
    pageWide: true,
    disabled: !hasImages,
  })
  // ⚠️ `pageOver` goes true for any page drag whether or not this zone is
  // disabled — the hook lights every page-wide zone and only checks `disabled`
  // when deciding who TAKES the file. Promising a drop that will not be taken is
  // a lie, so the hint is gated on the same condition.
  const showDropHint = pageDrop.pageOver && hasImages

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* With an image open the bar stops being a navbar and becomes the
          editor's toolbar: identity out for a home button, brand claim out for
          the quick edits, and the whole row widened to the viewport so its two
          ends line up with the full-bleed editor below. Universal PDF's
          open-document chrome is the shape being matched.

          `clearAll` for home rather than following productHomeHref: navigating
          would reload and drop the open images anyway, and this brings the
          landing page straight back. */}
      <UniversalAppsNavBar
        product="images"
        productLogo={<ProductLogo />}
        productHomeHref={import.meta.env.BASE_URL}
        onHome={hasImages ? clearAll : undefined}
        centre={hasImages ? <EditShortcuts /> : undefined}
        actions={hasImages ? <AppMenu /> : undefined}
        suiteSwitcherIconSrc={`${import.meta.env.BASE_URL}unisim-icon.png`}
        contentClassName={hasImages ? EDITOR_CONTAINER : CONTAINER}
      />

      {/* Renders nothing until this tab is genuinely running superseded code.
          See the SDK's useAppUpdate: an autoUpdate PWA hands the new worker
          control but leaves the running page on its old JavaScript. */}
      <div className={`${hasImages ? EDITOR_CONTAINER : CONTAINER} pt-4`}>
        <UpdateNotice />
        <LoadErrorNotice />
      </div>

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
          <div className={`${CONTAINER} py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-xs text-slate-500`}>
            <span>
              With{' '}
              <span aria-hidden="true" className="text-orange-600">&hearts;</span>
              <span className="sr-only">love</span>{' '}
              from{' '}
              <a href="https://www.unisim.co.uk" target="_blank" rel="noreferrer" className="text-slate-700 hover:text-orange-700 underline-offset-2 hover:underline">
                UNISIM.co.uk
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

      {/* The suite's shared page-wide hint, replacing a per-app overlay. Same
          sentence, same orange, but now identical to the one Compress, PDF,
          Video and Signatures show. */}
      <DropAnywhere
        show={showDropHint}
        title="Drop to add"
        hint="JPEG, PNG, WebP, HEIC, GIF"
        icon={<span aria-hidden="true">🖼</span>}
      />

      <HostedStoreDialog />
      {metadataOpen && <MetadataDialog onClose={() => setMetadataOpen(false)} />}
    </div>
  )
}
