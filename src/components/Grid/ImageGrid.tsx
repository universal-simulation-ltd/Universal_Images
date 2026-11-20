import { Button, PhonePage, SelectCheckbox, SelectionBar, SwipeGroup, SwipeRow, buttonClass } from '@unisim/sdk'
import { useImageStore } from '../../stores/imageStore'
import { formatBytes } from '../../lib/imageResize'
import { removeSwipe, selectSwipe, useListSelect } from '../../native/listGestures'
import { PHONE } from '../../native/shell'
import { useNT } from '../../native/strings'
import { offerUndo } from '../../native/undo'
import { web } from '../Key'

// Each thumbnail is a tile you tap to open that image in the editor, so it
// wears the suite's Orbit corner (BRANDING.md → Boxes, A) on the website. The
// selected one keeps its orange edge, as a ring OUTSIDE the box so the arc
// still sits on the corner. The phone app keeps its own tiles (see Key.tsx).
const tileClass = (selected: boolean, phone: string) =>
  web(
    [
      'u-box u-box--orbit u-box--row p-0 text-left transition-[border-color,box-shadow]',
      selected
        ? 'border-orange-500 ring-1 ring-orange-500 dark:border-orange-400 dark:ring-orange-400'
        : 'border-slate-200 dark:border-slate-700'
    ].join(' '),
    phone
  )
// Inside an orbit tile the picture and caption round their own corners: the box
// can't clip them (overflow would cut the arc off its corner).
const tileTop = web('rounded-t-[13px] overflow-hidden', '')
const tileFoot = web('rounded-b-[13px]', '')

interface Props {
  /** Full-screen overlay mode used on mobile. */
  mobileExpanded?: boolean
  /** Called after an image is selected (mobile) or when "Done" is tapped. */
  onBack?: () => void
}

export default function ImageGrid({ mobileExpanded = false, onBack }: Props) {
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const selectImage = useImageStore((s) => s.selectImage)
  const removeImage = useImageStore((s) => s.removeImage)
  const setCollageOpen = useImageStore((s) => s.setCollageOpen)
  const t = useNT()
  // The phone app's grid gestures (BRANDING.md ▸ "A deletable row swipes"):
  // swipe a picture left to take it out (with Undo, edits and all), right to
  // select it; hold to select. Only on the phone's grid page.
  const phoneGrid = PHONE && mobileExpanded
  const pick = useListSelect(images.map((i) => i.id), phoneGrid)

  if (images.length === 0) return null

  function swipeOut(id: string, name: string) {
    const { takeImage, restoreImage, forgetImage } = useImageStore.getState()
    const taken = takeImage(id)
    if (taken) offerUndo({ name, restore: () => restoreImage(taken), forget: () => forgetImage(taken) })
  }

  // Two photos is the least a collage can be, so the shortcut waits for them.
  // The Actions menu's row is there from one (it can add the second).
  const collageButton = images.length >= 2 && (
    <button
      type="button"
      onClick={() => { setCollageOpen(true); onBack?.() }}
      title="Put these photos together in one image"
      className={web(`${buttonClass('soft', 'sm')} normal-case tracking-normal -my-1.5`, 'normal-case tracking-normal text-xs font-semibold text-orange-700 hover:text-orange-800 px-2 py-1 -my-1 rounded-md hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-500/10 transition-colors')}
    >
      🧩 Collage
    </button>
  )

  function handleSelect(id: string) {
    selectImage(id)
    if (mobileExpanded) onBack?.()
  }

  if (mobileExpanded) {
    const grid = (
          <ul className="grid grid-cols-2 gap-3 p-3">
            {images.map((img) => {
              const isSelected = img.id === selectedId
              const ticked = pick.sel.has(img.id)
              const tile = (
                <>
                  <button
                    type="button"
                    onClick={() => (pick.selecting ? pick.sel.toggle(img.id) : handleSelect(img.id))}
                    aria-current={isSelected ? 'true' : undefined}
                    className={tileClass(isSelected, [
                      'w-full rounded-xl border-2 overflow-hidden text-left transition-all',
                      isSelected
                        ? 'border-orange-500 shadow-md shadow-orange-500/20'
                        : 'border-slate-200 hover:border-orange-300 dark:border-slate-700 dark:hover:border-orange-500/60'
                    ].join(' '))}
                  >
                    <div className={`checker-bg checker-pane aspect-square w-full ${tileTop}`}>
                      <img
                        src={img.objectUrl}
                        alt={img.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className={`px-2 py-2 bg-white border-t border-slate-100 dark:bg-slate-900 dark:border-slate-800 ${tileFoot}`}>
                      <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{img.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {img.width}×{img.height} · {formatBytes(img.bytes)}
                      </div>
                    </div>
                  </button>
                  {pick.selecting ? (
                    // Selection mode: a tick box where the ✕ was, and a tap
                    // anywhere on the tile ticks it.
                    <span className="absolute top-2 left-2 flex">
                      <SelectCheckbox
                        checked={ticked}
                        onChange={() => pick.sel.toggle(img.id)}
                        label={t('app.swipe_select_named', { name: img.name })}
                      />
                    </span>
                  ) : (
                  <button
                    type="button"
                    aria-label={`Remove ${img.name}`}
                    onClick={(e) => { e.stopPropagation(); removeImage(img.id) }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-slate-900/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 hover:bg-rose-600 transition-all cursor-pointer"
                  >
                    {/* ⚠️ An SVG, not `✕` — U+2715 has no glyph in iOS's
                        system font and WebKit does not fall back, so the
                        remove badge drew as a hollow ▯?▯ box on the phone. */}
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="m4 4 8 8M12 4l-8 8" />
                    </svg>
                  </button>
                  )}
                </>
              )
              if (!phoneGrid) return <li key={img.id} className="group relative">{tile}</li>
              return (
                <li
                  key={img.id}
                  className="group relative"
                  // A hold selects: no system menu (Save image…) under the finger.
                  style={{ WebkitTouchCallout: 'none' }}
                  onTouchStart={pick.selecting ? undefined : pick.holdStart(img.id)}
                  data-grid-tile={img.id}
                >
                  <SwipeRow
                    id={img.id}
                    left={selectSwipe(t, img.name, () => pick.start(img.id))}
                    right={removeSwipe(t, img.name, () => swipeOut(img.id, img.name))}
                    disabled={pick.selecting}
                    actionWidth={76}
                    className="rounded-xl"
                    frontClassName="relative bg-white dark:bg-slate-900"
                  >
                    {tile}
                  </SwipeRow>
                </li>
              )
            })}
          </ul>
    )

    // The phone app: a page of its own, back on a swipe from the left edge
    // (Done is the page's Back). See src/native/.
    if (PHONE) {
      return (
        <PhonePage title={`${images.length} image${images.length === 1 ? '' : 's'}`} onBack={() => onBack?.()}>
          {pick.selecting ? (
            // The suite's select-several bar: Remove selected (the pictures
            // leave the app, the photos on the phone stay), Clear, and Done.
            <SelectionBar
              sel={pick.sel}
              action="remove"
              noun={{ one: t('app.noun_one'), other: t('app.noun_other') }}
              onDelete={(ids) => {
                for (const id of ids) removeImage(id)
                pick.leave()
              }}
              extra={
                <Button size="sm" onClick={pick.leave} data-select-done>
                  {t('app.select_done')}
                </Button>
              }
              className="flex-wrap px-3 pt-3"
            />
          ) : (
            collageButton && <div className="flex justify-end px-3 pt-3">{collageButton}</div>
          )}
          <SwipeGroup>{grid}</SwipeGroup>
        </PhonePage>
      )
    }

    return (
      <div className="flex flex-col flex-1 bg-white overflow-hidden dark:bg-slate-900">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-slate-100 bg-white sticky top-0 z-10 flex items-center justify-between dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
            {images.length} image{images.length === 1 ? '' : 's'}
          </span>
          <span className="ml-auto mr-1">{collageButton}</span>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className={web(`${buttonClass('soft', 'sm')} -my-1.5`, 'text-xs font-semibold text-orange-700 hover:text-orange-800 px-2 py-1 rounded-md hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-500/10 transition-colors')}
            >
              Done
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto">
          {grid}
        </div>
      </div>
    )
  }

  // Desktop sidebar
  return (
    <div className="border-r border-slate-200 bg-white w-44 shrink-0 overflow-y-auto dark:border-slate-800 dark:bg-slate-900">
      <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400 font-medium border-b border-slate-100 sticky top-0 bg-white z-10 flex items-center justify-between gap-1 dark:border-slate-800 dark:bg-slate-900">
        <span>{images.length} image{images.length === 1 ? '' : 's'}</span>
        {collageButton}
      </div>
      <ul className="p-2 space-y-2">
        {images.map((img) => {
          const isSelected = img.id === selectedId
          return (
            <li key={img.id} className="group relative">
              <button
                type="button"
                onClick={() => selectImage(img.id)}
                aria-current={isSelected ? 'true' : undefined}
                className={tileClass(isSelected, [
                  'w-full rounded-lg border-2 overflow-hidden text-left transition-all',
                  isSelected
                    ? 'border-orange-500 shadow-md shadow-orange-500/20'
                    : 'border-slate-200 hover:border-orange-300 dark:border-slate-700 dark:hover:border-orange-500/60'
                ].join(' '))}
              >
                <div className={`checker-bg checker-pane aspect-square w-full ${tileTop}`}>
                  <img
                    src={img.objectUrl}
                    alt={img.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className={`px-2 py-1.5 bg-white border-t border-slate-100 dark:bg-slate-900 dark:border-slate-800 ${tileFoot}`}>
                  <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{img.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {img.width}×{img.height} · {formatBytes(img.bytes)}
                  </div>
                </div>
              </button>
              <button
                type="button"
                aria-label={`Remove ${img.name}`}
                onClick={(e) => { e.stopPropagation(); removeImage(img.id) }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 hover:bg-rose-600 transition-all cursor-pointer"
              >
                {/* SVG, not `✕` — see the note on the badge above. */}
                <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
